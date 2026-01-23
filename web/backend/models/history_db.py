"""
History database model
"""
from sqlalchemy import Column, String, DateTime, Boolean, JSON, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from core.database import Base


class HistoryDB(Base):
    __tablename__ = "history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    face_image_url = Column(String(500), nullable=False)
    face_image_id = Column(String(255), nullable=True)
    reference_image_url = Column(String(500), nullable=True)
    reference_image_id = Column(String(255), nullable=True)
    result_urls = Column(JSON, default=list)
    prompt = Column(Text, nullable=True)
    params = Column(JSON, default=dict)
    count = Column(String, default="1")
    parallel = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", backref="history_items")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "face_image_url": self.face_image_url,
            "face_image_id": self.face_image_id,
            "reference_image_url": self.reference_image_url,
            "reference_image_id": self.reference_image_id,
            "result_urls": self.result_urls or [],
            "prompt": self.prompt,
            "params": self.params or {},
            "count": self.count,
            "parallel": self.parallel,
            "is_favorite": self.is_favorite,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<History {self.id}>"
