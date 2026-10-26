from sqlalchemy import String, Integer, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import TimestampMixin

class SignVocabulary(Base, TimestampMixin):
    __tablename__ = "sign_vocabulary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sign_label: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    samples = relationship("DatasetSample", back_populates="sign_vocabulary")

class DatasetSample(Base, TimestampMixin):
    __tablename__ = "dataset_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vocabulary_id: Mapped[int] = mapped_column(Integer, ForeignKey("sign_vocabulary.id"), nullable=False)
    signer_id: Mapped[str] = mapped_column(String(100), nullable=True)
    num_frames: Mapped[int] = mapped_column(Integer, default=30)
    keypoint_data: Mapped[dict] = mapped_column(JSON, nullable=False)  # Stores JSON landmark array sequence
    file_path: Mapped[str] = mapped_column(String(500), nullable=True)  # Optional .npy path

    sign_vocabulary = relationship("SignVocabulary", back_populates="samples")
