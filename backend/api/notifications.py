from fastapi import APIRouter

from services.notification_service import get_notifications, mark_all_read, unread_count

router = APIRouter()


@router.get("/api/notifications")
async def list_notifications(limit: int = 50):
    return {"notifications": get_notifications(limit), "unreadCount": unread_count()}


@router.post("/api/notifications/mark-all-read")
async def mark_read():
    mark_all_read()
    return {"status": "ok"}
