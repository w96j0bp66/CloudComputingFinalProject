from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from .database import Base
import enum

class ItemStatus(str, enum.Enum):
    ON_SALE = "on_sale"
    SOLD = "sold"
    RESERVED = "reserved"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    nickname = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_admin = Column(Boolean, default=False)

    items = relationship("Item", back_populates="owner")

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), index=True, nullable=False)
    description = Column(String(500))
    price = Column(Float, nullable=False)
    category = Column(String(50), index=True) # 例如: 書籍, 3C
    image_url = Column(String(500))
    status = Column(Enum(ItemStatus), default=ItemStatus.ON_SALE)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sold_at = Column(DateTime(timezone=True), nullable=True)

    owner = relationship("User", back_populates="items")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String(255), index=True)  # 對應 item_id
    sender = Column(String(255))               # 傳送者 (email 或 暱稱)
    content = Column(String(1024))             # 訊息內容
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String(255), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_read_timestamp = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('room_id', 'user_id', name='_room_user_uc'),)