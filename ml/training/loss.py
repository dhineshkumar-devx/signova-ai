import torch
import torch.nn as nn

class LabelSmoothingCrossEntropy(nn.Module):
    """
    Cross Entropy Loss with Label Smoothing for preventing overconfidence in sign classification.
    """

    def __init__(self, smoothing: float = 0.1):
        super(LabelSmoothingCrossEntropy, self).__init__()
        self.smoothing = smoothing

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        num_classes = logits.size(-1)
        log_preds = torch.log_softmax(logits, dim=-1)

        nll_loss = -log_preds.gather(dim=-1, index=targets.unsqueeze(1)).squeeze(1)
        smooth_loss = -log_preds.mean(dim=-1)

        loss = (1.0 - self.smoothing) * nll_loss + self.smoothing * smooth_loss
        return loss.mean()

class CTCLossStub(nn.Module):
    """
    Connectionist Temporal Classification (CTC) Loss Stub for Continuous ISL Translation.
    """

    def __init__(self, blank: int = 0):
        super(CTCLossStub, self).__init__()
        self.ctc_loss = nn.CTCLoss(blank=blank, zero_infinity=True)

    def forward(
        self,
        log_probs: torch.Tensor,
        targets: torch.Tensor,
        input_lengths: torch.Tensor,
        target_lengths: torch.Tensor,
    ) -> torch.Tensor:
        return self.ctc_loss(log_probs, targets, input_lengths, target_lengths)
