from sqlalchemy import String, Integer, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import TimestampMixin

class ModelCheckpoint(Base, TimestampMixin):
    __tablename__ = "model_checkpoints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    model_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    architecture: Mapped[str] = mapped_column(String(50), nullable=False)  # ST-GCN, Transformer, Bi-LSTM
    checkpoint_file: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=False)

    evaluations = relationship("EvaluationMetric", back_populates="checkpoint")

class EvaluationMetric(Base, TimestampMixin):
    __tablename__ = "evaluation_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    checkpoint_id: Mapped[int] = mapped_column(Integer, ForeignKey("model_checkpoints.id"), nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False)
    top_5_accuracy: Mapped[float] = mapped_column(Float, nullable=False)
    f1_score: Mapped[float] = mapped_column(Float, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    checkpoint = relationship("ModelCheckpoint", back_populates="evaluations")
