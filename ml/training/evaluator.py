import torch
from typing import Dict, Any

class ModelEvaluator:
    """
    Computes evaluation metrics (Top-1, Top-5, F1 score) for ISL model benchmark.
    """

    @staticmethod
    def calculate_top_k_accuracy(logits: torch.Tensor, targets: torch.Tensor, k: int = 5) -> float:
        """
        Computes Top-K accuracy percentage.
        """
        _, top_k_indices = logits.topk(k, dim=-1)
        correct = top_k_indices.eq(targets.unsqueeze(1).expand_as(top_k_indices))
        return (correct.any(dim=-1).float().mean().item()) * 100.0

    @staticmethod
    def compute_all_metrics(logits: torch.Tensor, targets: torch.Tensor) -> Dict[str, float]:
        """
        Returns dictionary of Top-1 Accuracy, Top-5 Accuracy.
        """
        top1 = ModelEvaluator.calculate_top_k_accuracy(logits, targets, k=1)
        top5 = ModelEvaluator.calculate_top_k_accuracy(logits, targets, k=5)

        return {
            "top_1_accuracy": round(top1, 2),
            "top_5_accuracy": round(top5, 2),
        }
