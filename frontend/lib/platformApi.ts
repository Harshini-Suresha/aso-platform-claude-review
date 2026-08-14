const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface AssistantResponse {
  reply: string | null;
  error: string | null;
}

export async function askAssistant(
  message: string,
  context?: Record<string, string>
): Promise<AssistantResponse> {
  const res = await fetch(`${API_BASE}/api/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });
  return res.json();
}

export interface PlatformNotification {
  id: string;
  category: "analysis" | "projects" | "validation" | "literature";
  title: string;
  detail: string;
  timestamp: number;
  read: boolean;
  status?: "running" | "failed" | "completed";
}

export async function fetchNotifications(): Promise<{
  notifications: PlatformNotification[];
  unreadCount: number;
}> {
  const res = await fetch(`${API_BASE}/api/notifications`, { cache: "no-store" });
  if (!res.ok) return { notifications: [], unreadCount: 0 };
  return res.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch(`${API_BASE}/api/notifications/mark-all-read`, { method: "POST" });
}
