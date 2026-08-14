"""
Report auto-save service. Call from any endpoint to persist a pipeline report.
"""

from __future__ import annotations

import json
import time
from typing import Optional

from sqlalchemy.orm import Session

from database.models import Report


def save_report(
    db: Session,
    user_id: int,
    step: str,
    title: str,
    gene_symbol: str = "",
    disease: str = "",
    summary: str = "",
    data: Optional[dict] = None,
) -> int:
    """Save a report and return its ID."""
    report = Report(
        user_id=user_id,
        step=step,
        title=title,
        gene_symbol=gene_symbol,
        disease=disease,
        summary=summary,
        data=json.dumps(data or {}),
        created_at=time.time(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report.id
