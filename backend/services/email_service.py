"""
Email verification: send verification links via SMTP.
Falls back to console logging when SMTP is not configured.
"""

from __future__ import annotations

import os
import secrets
import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "rnatherapeuticsai@gmail.com")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def send_verification_email(email: str, name: str, token: str) -> bool:
    """
    Send a verification email. Returns True if sent (or logged), False on failure.
    When SMTP is not configured, logs the link to the console for development.
    """
    verify_url = f"{FRONTEND_URL}/verify-email?token={token}"

    if not SMTP_HOST:
        logger.info("═══════════════════════════════════════════════════")
        logger.info("  EMAIL VERIFICATION (SMTP not configured)")
        logger.info(f"  To: {email}")
        logger.info(f"  Name: {name}")
        logger.info(f"  Verify link: {verify_url}")
        logger.info("═══════════════════════════════════════════════════")
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = "Verify your RNA Therapeutics Platform account"
        msg["From"] = SMTP_FROM
        msg["To"] = email
        msg.set_content(f"""Hi {name or 'there'},

Welcome to the RNA Therapeutics Platform!

Please verify your email address by clicking the link below:

{verify_url}

This link will expire in 24 hours.

If you did not create an account, you can safely ignore this email.

— RNA Therapeutics Platform
""")
        msg.add_alternative(f"""\
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <h2 style="color: #1e293b;">Verify your email</h2>
  <p style="color: #475569; font-size: 14px;">Hi {name or 'there'},</p>
  <p style="color: #475569; font-size: 14px;">Welcome to the RNA Therapeutics Platform! Please verify your email address:</p>
  <p style="margin: 24px 0;">
    <a href="{verify_url}" style="background: #4f46e5; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Verify Email</a>
  </p>
  <p style="color: #94a3b8; font-size: 12px;">This link expires in 24 hours. If you did not create an account, ignore this email.</p>
</body>
</html>
""", subtype="html")

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            if SMTP_PORT != 25:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        logger.info(f"Verification email sent to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {e}")
        return False


def send_bug_report_email(email: str, name: str, area: str, summary: str, steps: str, expected: str, actual: str, page_url: str) -> tuple[bool, str]:
    """Send a bug report to support via SMTP.

    Returns (sent, message).
    """
    if not SMTP_HOST:
        logger.warning("Bug report email requested for %s, but SMTP is not configured.", email)
        return False, "SMTP is not configured, so the bug report could not be emailed."

    subject = f"[Bug] {area}: {summary}"
    body = (
        f"Area: {area}\n\n"
        f"Summary:\n{summary}\n\n"
        f"Steps to reproduce:\n{steps}\n\n"
        f"Expected behavior:\n{expected}\n\n"
        f"Actual behavior:\n{actual}\n\n"
        f"Page URL: {page_url}\n\n"
        f"---\n"
        f"Reported by: {name} <{email}>\n"
    )

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = "mail@koshkey.com"
        msg["Reply-To"] = email
        msg.set_content(
            f"Bug report from {name or 'a user'} <{email}>:\n\n{body}"
        )

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            if SMTP_PORT != 25:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        logger.info("Bug report email sent from %s", email)
        return True, f"Bug report emailed to support from {email}."
    except Exception as exc:
        logger.error("Failed to send bug report email from %s: %s", email, exc)
        return False, "The bug report could not be emailed. Please try again later."


def send_report_email(email: str, name: str, report_content: str, filename: str) -> tuple[bool, str]:
    """Email a user-requested report to the account's registered address.

    Returns an explicit delivery status so development environments without
    SMTP never claim that an email was sent.
    """
    if not SMTP_HOST:
        logger.warning("Report email requested for %s, but SMTP is not configured.", email)
        return False, "SMTP is not configured, so the report could not be emailed."

    try:
        msg = EmailMessage()
        msg["Subject"] = "Your ASO candidate report"
        msg["From"] = SMTP_FROM
        msg["To"] = email
        msg.set_content(
            f"Hi {name or 'there'},\n\n"
            "Your requested ASO candidate report is attached.\n\n"
            "— RNA Therapeutics Platform"
        )
        msg.add_attachment(
            report_content.encode("utf-8"),
            maintype="text",
            subtype="plain",
            filename=filename,
        )

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            if SMTP_PORT != 25:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        logger.info("ASO report email sent to %s", email)
        return True, f"Report emailed to {email}."
    except Exception as exc:
        logger.error("Failed to send ASO report email to %s: %s", email, exc)
        return False, "The report could not be emailed. Please try again later."
