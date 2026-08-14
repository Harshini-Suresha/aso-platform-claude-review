"""
Real, event-sourced notifications. Nothing in here is generated speculatively
— add_notification() is only ever called from an endpoint that just
completed real work (a gene lookup, a mechanism ranking, a candidate
generation run, a sequence analysis). There is no background job, no
simulated activity, and no "off-target sites found" style claim for work
that was never actually performed.
"""

from __future__ import annotations

import json
import os
import time
from typing import Optional

NOTIF_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "notifications.json"
)
MAX_STORED = 200


def _load() -> list:
    if not os.path.exists(NOTIF_PATH):
        return []
    try:
        with open(NOTIF_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save(items: list) -> None:
    os.makedirs(os.path.dirname(NOTIF_PATH), exist_ok=True)
    with open(NOTIF_PATH, "w", encoding="utf-8") as f:
        json.dump(items[-MAX_STORED:], f, indent=2)


def add_notification(category: str, title: str, detail: str, meta: Optional[dict] = None) -> None:
    """
    category: "analysis" | "projects" | "validation" | "literature"
    Call this ONLY from a code path that just completed real work.
    """
    items = _load()
    items.append({
        "id": f"n{int(time.time() * 1000)}",
        "category": category,
        "title": title,
        "detail": detail,
        "timestamp": time.time(),
        "read": False,
        "meta": meta or {},
    })
    _save(items)


def get_notifications(limit: int = 50) -> list:
    items = sorted(_load(), key=lambda n: n["timestamp"], reverse=True)
    return items[:limit]


def mark_all_read() -> None:
    items = _load()
    for n in items:
        n["read"] = True
    _save(items)


def unread_count() -> int:
    return sum(1 for n in _load() if not n.get("read"))
