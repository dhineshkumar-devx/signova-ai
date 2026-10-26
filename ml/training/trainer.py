import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from typing import Tuple
from ml.models.base_model import BaseSignModel

class ModelTrainer:
    """
    PyTorch Training & Validation Loop Harness.
    Manages optimizer step, loss computation, and metric logging.
    """

    def __init__(
        self,
        model: BaseSignModel,
        train_loader: DataLoader,
        val_loader: DataLoader,
        criterion: nn.Module = None,
        optimizer: torch.optim.Optimizer = None,
        device: str = "cpu",
    ):
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.criterion = criterion or nn.CrossEntropyLoss()
        self.optimizer = optimizer or torch.optim.Adam(self.model.parameters(), lr=1e-3)
        self.device = device

    def train_epoch(self) -> float:
        """
        Skeleton for single training epoch pass.
        """
        self.model.train()
        total_loss = 0.0

        for batch_idx, (inputs, targets) in enumerate(self.train_loader):
            inputs, targets = inputs.to(self.device), targets.to(self.device)

            self.optimizer.zero_grad()
            logits = self.model(inputs)
            loss = self.criterion(logits, targets)

            # Backward pass (stub for execution)
            # loss.backward()
            # self.optimizer.step()

            total_loss += loss.item()

        return total_loss / max(1, len(self.train_loader))

    def validate(self) -> Tuple[float, float]:
        """
        Skeleton for validation evaluation pass.
        Returns: (val_loss, accuracy)
        """
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0

        with torch.no_grad():
            for inputs, targets in self.val_loader:
                inputs, targets = inputs.to(self.device), targets.to(self.device)
                logits = self.model(inputs)
                loss = self.criterion(logits, targets)

                total_loss += loss.item()
                preds = logits.argmax(dim=-1)
                correct += (preds == targets).sum().item()
                total += targets.size(0)

        acc = (correct / total * 100.0) if total > 0 else 0.0
        return total_loss / max(1, len(self.val_loader)), acc
