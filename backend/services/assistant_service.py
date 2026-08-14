"""
Platform AI assistant — a real call to the Anthropic API, not a canned
response system. Requires ANTHROPIC_API_KEY to be set in the backend
environment; returns a clear "not configured" error otherwise rather than
faking a response.
"""

from __future__ import annotations

import os
from typing import Optional

import requests

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"

# If this model string is retired, check
# https://docs.claude.com/en/docs/about-claude/models for the current one.
MODEL = "claude-sonnet-5"

SYSTEM_PROMPT = """You are the assistant embedded in the RNA Therapeutics AI Platform, \
a research tool for antisense oligonucleotide (ASO) design. You help researchers \
understand ASO/RNA-therapeutic biology, the mechanisms in the platform's rulebook \
(RNase H gapmers, exon skipping/inclusion, siRNA, anti-miR, transcriptional silencing, \
and others), and how to use the platform's own workflow: gene verification, mechanism \
selection, candidate design, and sequence upload/analysis.

Be accurate. Say clearly when something is uncertain, approximate, or outside \
established science, rather than presenting a guess with confidence. This is a \
research tool, not a source of clinical or medical advice — if asked about an actual \
patient's care, say so plainly and suggest they consult a qualified clinician."""


def ask_assistant(message: str, context: Optional[dict] = None) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "reply": None,
            "error": "The AI assistant isn't configured yet. Set the ANTHROPIC_API_KEY environment variable on the backend to enable it.",
        }

    if not message or not message.strip():
        return {"reply": None, "error": "Message cannot be empty."}

    user_content = message.strip()
    if context:
        ctx_str = ", ".join(f"{k}: {v}" for k, v in context.items() if v)
        if ctx_str:
            user_content = f"[Current platform context — {ctx_str}]\n\n{user_content}"

    try:
        resp = requests.post(
            ANTHROPIC_API_URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": 1024,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_content}],
            },
            timeout=30,
        )
        if resp.status_code != 200:
            detail = ""
            try:
                detail = resp.json().get("error", {}).get("message", "")
            except ValueError:
                pass
            return {
                "reply": None,
                "error": f"Assistant request failed (HTTP {resp.status_code}){': ' + detail if detail else ''}.",
            }

        data = resp.json()
        text_blocks = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
        reply = "\n".join(text_blocks).strip()
        return {"reply": reply or None, "error": None if reply else "Assistant returned an empty response."}

    except requests.RequestException:
        return {"reply": None, "error": "Could not reach the AI assistant service. Please try again."}
