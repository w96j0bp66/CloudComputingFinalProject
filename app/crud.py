from sqlalchemy.orm import Session
from . import models, auth, schemas
from sqlalchemy.dialects.mysql import insert
from sqlalchemy.sql import func
from datetime import datetime, timedelta

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, email: str, password: str, nickname: str, is_admin: bool = False):
    hashed_password = auth.get_password_hash(password)
    db_user = models.User(
        email=email, 
        hashed_password=hashed_password, 
        nickname=nickname,
        is_admin=is_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        if user_update.nickname is not None:
            db_user.nickname = user_update.nickname
        db.commit()
        db.refresh(db_user)
    return db_user

def get_items(db: Session, skip: int = 0, limit: int = 100, category: str = None, search: str = None, owner_id: int = None):
    # 修改：移除 status == ON_SALE 的過濾，讓列表能顯示已售出的商品 (前端再做視覺區隔)
    query = db.query(models.Item)
    if category:
        query = query.filter(models.Item.category == category)
    if search:
        query = query.filter(models.Item.title.contains(search))
    if owner_id:
        query = query.filter(models.Item.owner_id == owner_id)
    # 依照建立時間排序，新的在前面
    return query.order_by(models.Item.created_at.desc()).offset(skip).limit(limit).all()

def get_item(db: Session, item_id: int):
    return db.query(models.Item).filter(models.Item.id == item_id).first()

def create_item(db: Session, title: str, price: float, description: str, category: str, image_url: str, owner_id: int):
    db_item = models.Item(
        title=title,
        price=price,
        description=description,
        category=category,
        image_url=image_url,
        owner_id=owner_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def update_item(db: Session, item_id: int, item_update: schemas.ItemUpdate):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item:
        if item_update.title is not None:
            db_item.title = item_update.title
        if item_update.price is not None:
            db_item.price = item_update.price
        if item_update.description is not None:
            db_item.description = item_update.description
        if item_update.category is not None:
            db_item.category = item_update.category
        db.commit()
        db.refresh(db_item)
    return db_item

def update_item_status(db: Session, item_id: int, status: str):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if item:
        item.status = status
        # 如果狀態變成已售出，記錄時間；否則清空時間
        if status == models.ItemStatus.SOLD:
            item.sold_at = func.now()
        else:
            item.sold_at = None
        db.commit()
        db.refresh(item)
    return item

def delete_item(db: Session, item_id: int):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if item:
        db.delete(item)
        db.commit()

def delete_expired_sold_items(db: Session, days: int = 7):
    """刪除已售出超過指定天數的商品"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    # 找出狀態為 SOLD 且售出時間早於截止日期的商品
    db.query(models.Item).filter(models.Item.status == models.ItemStatus.SOLD, models.Item.sold_at < cutoff_date).delete(synchronize_session=False)
    db.commit()

def create_message(db: Session, room_id: str, sender: str, content: str):
    db_message = models.Message(room_id=room_id, sender=sender, content=content)
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_messages(db: Session, room_id: str):
    return db.query(models.Message).filter(models.Message.room_id == room_id).order_by(models.Message.timestamp.asc()).all()

def update_last_read(db: Session, room_id: str, user_id: int):
    """使用 MySQL 的 ON DUPLICATE KEY UPDATE 來更新或插入已讀時間戳"""
    stmt = insert(models.ChatParticipant).values(
        room_id=room_id,
        user_id=user_id,
        last_read_timestamp=func.now()
    )
    on_duplicate_key_stmt = stmt.on_duplicate_key_update(
        last_read_timestamp=func.now()
    )
    db.execute(on_duplicate_key_stmt)
    db.commit()

def get_user_conversations(db: Session, user_id: int, user_email: str):
    # 邏輯：找出所有與我有關的 room_id
    # room_id 格式約定: "{item_id}-{buyer_id}"
    
    # 1. 我是買家：room_id 結尾是 "-{my_user_id}"
    suffix = f"-{user_id}"
    buyer_rooms = db.query(models.Message.room_id).filter(models.Message.room_id.like(f"%{suffix}")).distinct().all()
    
    # 2. 我是賣家：找出我賣的商品，並找出這些商品的所有對話
    my_items = db.query(models.Item).filter(models.Item.owner_id == user_id).all()
    my_item_ids = [str(item.id) for item in my_items]
    
    seller_rooms = []
    if my_item_ids:
        # 取得所有有訊息的 room_id，並在 Python 過濾 (簡單實作)
        all_rooms = db.query(models.Message.room_id).distinct().all()
        for r in all_rooms:
            room_str = r[0]
            if "-" in room_str:
                i_id, _ = room_str.split("-", 1)
                if i_id in my_item_ids:
                    seller_rooms.append(room_str)

    # 合併並去重
    all_relevant_rooms = set([r[0] for r in buyer_rooms] + seller_rooms)
    
    # 取得此使用者所有對話的最後已讀時間
    last_reads = db.query(models.ChatParticipant).filter(models.ChatParticipant.user_id == user_id).all()
    last_read_map = {lr.room_id: lr.last_read_timestamp for lr in last_reads}

    results = []
    for room_id in all_relevant_rooms:
        if "-" not in room_id: continue
        item_id_str, buyer_id_str = room_id.split("-", 1)
        if not item_id_str.isdigit() or not buyer_id_str.isdigit(): continue
        
        item = db.query(models.Item).filter(models.Item.id == int(item_id_str)).first()
        if not item: continue
        
        # 判斷身分與對方暱稱
        if str(user_id) == buyer_id_str:
            # 我是買家，對方是賣家
            counterpart = db.query(models.User).filter(models.User.id == item.owner_id).first()
            role = "買家"
        else:
            # 我是賣家，對方是買家
            counterpart = db.query(models.User).filter(models.User.id == int(buyer_id_str)).first()
            role = "賣家"
            
        # 計算未讀訊息
        last_read_time = last_read_map.get(room_id)
        unread_query = db.query(models.Message).filter(models.Message.room_id == room_id)
        if last_read_time:
            unread_query = unread_query.filter(models.Message.timestamp > last_read_time)
        # 別人的訊息才算未讀
        unread_query = unread_query.filter(models.Message.sender != user_email)
        unread_count = unread_query.count()

        results.append({
            "room_id": room_id,
            "item_id": item.id,
            "item_title": item.title,
            "item_image_url": item.image_url,
            "counterpart_nickname": counterpart.nickname if counterpart else "未知用戶",
            "role": role,
            "unread_count": unread_count
        })
        
    return results