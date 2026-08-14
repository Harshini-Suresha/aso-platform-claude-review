"""Backward-compatible FastAPI entry point.

The target-initialisation endpoint is implemented in ``main.py``.  Keeping a
second implementation here caused the two server commands to return different
results; in particular, the legacy NCBI lookup could not resolve the Ensembl
species slug ``homo_sapiens`` that the frontend sends.
"""

try:  # ``uvicorn backend.app:app`` from the repository root
    from .main import app
except ImportError:  # ``uvicorn app:app`` while working in backend/
    from main import app
