from typing import Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
import re

class UserCreate(BaseModel):
    email: str
    password: str = Field(..., max_length=64)  # 字元數保底
    nickname: str

    @validator("password")
    def bcrypt_72_bytes_limit(cls, v: str):
        if len(v.encode("utf-8")) > 72:
            raise ValueError("密碼太長:bcrypt 最多 72 bytes(含中文大約 24 字以內）。")
        return v

    @validator("email")
    def validate_email(cls, v):
        if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", v):
            raise ValueError("Email 格式不正確")
        return v

class UserResponse(BaseModel):
    id: int
    email: str
    nickname: str
    is_admin: bool = False
    
    class Config:
        orm_mode = True

class UserUpdate(BaseModel):
    nickname: Optional[str] = None

class ItemResponse(BaseModel):
    id: int
    title: str
    price: float
    description: Optional[str] = None
    category: str
    image_url: Optional[str] = None
    status: str
    owner_id: int
    owner_nickname: Optional[str] = "匿名"
    
    class Config:
        orm_mode = True

class ItemUpdate(BaseModel):
    title: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    category: Optional[str] = None

class ChatConversation(BaseModel):
    room_id: str
    item_id: int
    item_title: str
    item_image_url: Optional[str]
    counterpart_nickname: str  # 對方暱稱
    role: str  # 我在這場對話的身分 (買家/賣家)
    unread_count: int = 0

    class Config:
        orm_mode = True

class Message(BaseModel):
    sender: str
    content: str
    
    class Config:
        orm_mode = True