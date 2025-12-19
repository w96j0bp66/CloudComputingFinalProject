from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from typing import List, Optional
import shutil
import os
import json
import uuid
import asyncio
import time
from sqlalchemy.exc import OperationalError

from . import models, s3_utils, crud, schemas
from . import auth
from .database import engine, get_db, Base

# 自動建立資料表 (正式環境通常用 Alembic 做遷移，這裡簡化直接建立)
MAX_RETRIES = 30
for i in range(MAX_RETRIES):
    try:
        Base.metadata.create_all(bind=engine)
        break
    except OperationalError as e:
        if i == MAX_RETRIES - 1:
            raise e
        print(f"Database not ready yet, retrying in 2 seconds... (Attempt {i+1}/{MAX_RETRIES})")
        time.sleep(2)

app = FastAPI(title="Campus Second-hand Market")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# --- WebSocket Chat Manager ---
class ConnectionManager:
    def __init__(self):
        # 存放活躍連線: room_id -> List[WebSocket]
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: str, sender: str, room_id: str):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_json({"sender": sender, "message": message})
                except:
                    pass

manager = ConnectionManager()
# ------------------------------

# --- 背景任務與初始化 ---
@app.on_event("startup")
async def startup_event():
    # 1. 初始化管理員帳號
    with Session(engine) as db:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@campus.com")
        admin_user = crud.get_user_by_email(db, admin_email)
        if not admin_user:
            print(f"Creating default admin user: {admin_email}")
            crud.create_user(db, email=admin_email, password="admin123", nickname="超級管理員", is_admin=True)
    
    # 2. 啟動自動刪除過期商品的背景任務
    asyncio.create_task(schedule_cleanup())

async def schedule_cleanup():
    while True:
        try:
            print("Running cleanup task: Deleting old sold items...")
            with Session(engine) as db:
                # 設定刪除 7 天前的已售出商品
                crud.delete_expired_sold_items(db, days=7)
        except Exception as e:
            print(f"Cleanup task failed: {e}")
        
        # 每天執行一次 (86400 秒)
        await asyncio.sleep(86400)

# --- API Routes ---

# 1. 註冊使用者
@app.post("/users/", status_code=201)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 檢查 Email 是否存在
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        new_user = crud.create_user(db=db, email=user.email, password=user.password, nickname=user.nickname)
        return {"message": "User created successfully", "user_id": new_user.id}
    except Exception as e:
        print(f"Create user error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

# 2. 登入 (取得 Token)
@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email})
    # 回傳 user_id 讓前端可以判斷是否為商品擁有者
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "user_email": user.email, "is_admin": user.is_admin}

# 2.5 取得當前使用者資訊
@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user_email: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=current_user_email)
    return user

# 新增：修改個人資料 (例如暱稱)
@app.put("/users/me", response_model=schemas.UserResponse)
def update_user_me(
    user_update: schemas.UserUpdate,
    current_user_email: str = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, email=current_user_email)
    updated_user = crud.update_user(db, user.id, user_update)
    return updated_user

# 3. 刊登物品 (包含圖片上傳)
@app.post("/items/", response_model=schemas.ItemResponse)
async def create_item(
    title: str = Form(...),
    price: float = Form(...),
    description: str = Form(None),
    category: str = Form(...),
    file: UploadFile = File(...), # 圖片檔案
    current_user_email: str = Depends(auth.get_current_user), # 需要登入
    db: Session = Depends(get_db)
):
    # 1. 找使用者 ID
    user = crud.get_user_by_email(db, email=current_user_email)

    # 2. 上傳圖片 (暫時改為本地儲存，不依賴 AWS S3)
    # 為了方便開發，我們先將圖片存在 app/static/images 資料夾
    upload_dir = "app/static/images"
    os.makedirs(upload_dir, exist_ok=True)
    
    # 產生唯一檔名
    extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{extension}"
    file_path = os.path.join(upload_dir, filename)
    
    # 寫入檔案
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 設定圖片 URL (對應到 StaticFiles 的掛載路徑)
    image_url = f"/static/images/{filename}"

    # # 2. 上傳圖片到 S3
    # image_url = s3_utils.upload_file_to_s3(file)
    # if not image_url:
    #     raise HTTPException(status_code=500, detail="Image upload failed. Please check AWS configuration.")

    # 3. 寫入資料庫
    new_item = crud.create_item(
        db=db,
        title=title,
        price=price,
        description=description,
        category=category,
        image_url=image_url,
        owner_id=user.id
    )
    return new_item

# 4. 瀏覽物品列表 (支援搜尋與分類)
@app.get("/items/", response_model=List[schemas.ItemResponse])
def read_items(
    skip: int = 0, 
    limit: int = 100, 
    category: Optional[str] = None, 
    search: Optional[str] = None,
    owner_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    items = crud.get_items(db, skip=skip, limit=limit, category=category, search=search, owner_id=owner_id)
    return items

# 5. 查看單一物品詳情
@app.get("/items/{item_id}", response_model=schemas.ItemResponse)
def read_item(item_id: int, db: Session = Depends(get_db)):
    db_item = crud.get_item(db, item_id=item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # 取得賣家暱稱
    owner = crud.get_user(db, user_id=db_item.owner_id)
    owner_nickname = owner.nickname if owner else "匿名"
    
    # 將 ORM 物件轉為 Dict 並加入 nickname
    item_data = db_item.__dict__
    item_data["owner_nickname"] = owner_nickname
    
    return item_data

# 新增：編輯商品資訊 (僅限擁有者)
@app.put("/items/{item_id}", response_model=schemas.ItemResponse)
def update_item(item_id: int, item_update: schemas.ItemUpdate, current_user_email: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_item = crud.get_item(db, item_id=item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # 權限檢查
    user = crud.get_user_by_email(db, email=current_user_email)
    if db_item.owner_id != user.id:
        raise HTTPException(status_code=403, detail="您無權修改此商品")
        
    updated_item = crud.update_item(db, item_id, item_update)
    return updated_item

# 新增：更新商品狀態 (僅限擁有者)
@app.put("/items/{item_id}/status")
def update_item_status(item_id: int, status: str = Form(...), current_user_email: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_item = crud.get_item(db, item_id=item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    # 權限檢查：只有賣家本人可以修改
    user = crud.get_user_by_email(db, email=current_user_email)
    if db_item.owner_id != user.id:
        raise HTTPException(status_code=403, detail="您無權修改此商品")
    
    updated_item = crud.update_item_status(db, item_id, status)
    return updated_item

# 新增：刪除商品 (僅限擁有者)
@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, current_user_email: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_item = crud.get_item(db, item_id=item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # 權限檢查
    user = crud.get_user_by_email(db, email=current_user_email)
    if db_item.owner_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="您無權刪除此商品 (僅限擁有者或管理員)")
        
    crud.delete_item(db, item_id=item_id)
    return

# 9. 取得使用者的聊天列表 (一對一對話)
@app.get("/users/chats", response_model=List[schemas.ChatConversation])
def get_user_chats(current_user_email: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=current_user_email)
    return crud.get_user_conversations(db, user_id=user.id, user_email=user.email)

# 8. 取得聊天室歷史訊息
@app.get("/chat/{room_id}", response_model=List[schemas.Message])
def get_chat_history(room_id: str, db: Session = Depends(get_db), current_user_email: str = Depends(auth.get_current_user)):
    user = crud.get_user_by_email(db, email=current_user_email)
    if user:
        # 更新已讀時間戳
        crud.update_last_read(db, room_id=room_id, user_id=user.id)
    return crud.get_messages(db, room_id=room_id)

# 7. 聊天室 WebSocket
@app.websocket("/ws/{room_id}/{client_name}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_name: str, db: Session = Depends(get_db)):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            # 儲存訊息到資料庫
            crud.create_message(db, room_id=room_id, sender=client_name, content=data)
            await manager.broadcast(data, client_name, room_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        await manager.broadcast("離開了聊天室", client_name, room_id)

# 6. 測試首頁
@app.get("/")
def read_root():
    return FileResponse('app/static/index.html')
