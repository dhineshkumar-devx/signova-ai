import torch
import torch.nn as nn
import os

class ModelExporter:
    """
    Utilities for exporting PyTorch model stubs to ONNX and TorchScript
    for edge and browser-side execution.
    """

    @staticmethod
    def export_to_torchscript(model: nn.Module, example_input: torch.Tensor, output_path: str) -> str:
        """
        Traces and saves model as TorchScript (.pt).
        """
        model.eval()
        traced_model = torch.jit.trace(model, example_input)
        traced_model.save(output_path)
        return output_path

    @staticmethod
    def export_to_onnx(model: nn.Module, example_input: torch.Tensor, output_path: str) -> str:
        """
        Exports model to ONNX format (.onnx).
        """
        model.eval()
        torch.onnx.export(
            model,
            example_input,
            output_path,
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=["landmarks"],
            output_names=["logits"],
            dynamic_axes={"landmarks": {0: "batch_size", 1: "sequence_length"}, "logits": {0: "batch_size"}},
        )
        return output_path
