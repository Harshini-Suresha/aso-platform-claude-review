import argparse
from pathlib import Path

import torch
import yaml

_torch_safe_globals_added = False


def _ensure_torch_safe_globals():
    global _torch_safe_globals_added
    if not _torch_safe_globals_added:
        torch.serialization.add_safe_globals([argparse.Namespace])
        _torch_safe_globals_added = True


def load_config(path: str) -> dict:
    config_path = Path(path)
    with open(config_path) as f:
        return yaml.safe_load(f)
