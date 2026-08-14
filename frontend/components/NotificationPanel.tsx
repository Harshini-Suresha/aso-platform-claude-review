"use client";

import { useEffect, useState } from "react";
import {
  X,
  Bell,
  CheckCheck,
  BarChart3,
  AlertCircle,
  FileText,
  BookOpen,
  FlaskConical,
  CheckCircle2,
  Sparkles,
  Folder,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { fetchNotifications, markAllNotificationsRead, PlatformNotification } from "@/lib/platformApi";

type NotifFilter = "all" | "analysis" | "projects" | "validation" | "literature";

const FILTERS: { id: NotifFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "analysis", label: "Analysis" },
  { id: "projects", label: "Projects" },
  { id: "validation", label: "Validation" },
  { id: "literature", label: "Literature" },
];

const CATEGORY_ICON: Record<string, React.ElementType> = {
  analysis: BarChart3,
  projects: Folder,
  validation: FlaskConical,
  literature: BookOpen,
};

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  analysis: { bg: "bg-blue-50", text: "text-blue-600" },
  projects: { bg: "bg-emerald-50", text: "text-emerald-600" },
  validation: { bg: "bg-purple-50", text: "text-purple-600" },
  literature: { bg: "bg-amber-50", text: "text-amber-600" },
};

function timeAgo(ts: number): string {
  const diffSec = Math.floor(Date.now() / 1000 - ts);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hour${Math.floor(diffSec / 3600) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diffSec / 86400)} day${Math.floor(diffSec / 86400) === 1 ? "" : "s"} ago`;
}

export default function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotifFilter>("all");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchNotifications()
      .then((res) => setNotifications(res.notifications))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  }

  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.category === filter);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const runningCount = notifications.filter((n) => n.status === "running").length;
  const failedCount = notifications.filter((n) => n.status === "failed").length;
  const completedCount = notifications.filter((n) => n.status === "completed").length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose}>
      <div
        className="absolute right-6 top-16 flex max-h-[75vh] w-[400px] flex-col border border-[#E5E7EB] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-600" />
            <p className="text-[13px] font-semibold text-slate-800">Notifications</p>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-600">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status Badges */}
        {!loading && notifications.length > 0 && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            {runningCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1">
                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                <span className="text-[10.5px] font-medium text-blue-600">{runningCount} Running</span>
              </div>
            )}
            {failedCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                <span className="text-[10.5px] font-medium text-red-600">{failedCount} Failed</span>
              </div>
            )}
            {completedCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="text-[10.5px] font-medium text-emerald-600">{completedCount} Completed</span>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        {!loading && notifications.length > 0 && (
          <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2">
            {FILTERS.map((f) => {
              const count = f.id === "all"
                ? notifications.length
                : notifications.filter((n) => n.category === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    filter === f.id
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1 py-0 text-[8px] font-semibold ${
                        filter === f.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-slate-400">Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-6 w-6 text-slate-300" />
              <p className="text-[12.5px] text-slate-400">
                {filter === "all"
                  ? "No notifications yet \u2014 they\u2019ll appear here as you use the platform."
                  : `No ${filter} notifications.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((n) => {
                const Icon = CATEGORY_ICON[n.category] ?? Bell;
                const colors = CATEGORY_COLOR[n.category] ?? { bg: "bg-slate-50", text: "text-slate-500" };
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
                      n.read ? "" : "bg-blue-50/30"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-[12px] font-medium truncate ${
                            n.read ? "text-slate-600" : "text-slate-800"
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400 truncate">{n.detail}</p>
                      <p className="mt-1 text-[10px] text-slate-300">{timeAgo(n.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-2.5">
          <button className="w-full text-center text-[11px] font-medium text-brand hover:underline">
            View all notifications
          </button>
        </div>
      </div>
    </div>
  );
}
