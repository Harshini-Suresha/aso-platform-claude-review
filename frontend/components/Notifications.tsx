"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bell,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  BookOpen,
  FlaskConical,
  BarChart3,
  Folder,
  Sparkles,
  Filter,
} from "lucide-react";

type NotifFilter = "all" | "analysis" | "projects" | "validation" | "literature";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: "analysis" | "projects" | "validation" | "literature";
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "DMD analysis completed",
    description: "Exon 51 skipping analysis finished with 12 candidates.",
    time: "2 min ago",
    read: false,
    type: "analysis",
    icon: BarChart3,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    id: "2",
    title: "Off-target prediction finished",
    description: "23 off-target sites identified for ASO-0041.",
    time: "15 min ago",
    read: false,
    type: "analysis",
    icon: AlertCircle,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
  },
  {
    id: "3",
    title: "New ClinVar update available",
    description: "47 new variants added for DMD gene.",
    time: "1 hour ago",
    read: false,
    type: "literature",
    icon: BookOpen,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-50",
  },
  {
    id: "4",
    title: "Literature update: 4 new papers",
    description: "New publications found for DMD exon skipping.",
    time: "2 hours ago",
    read: true,
    type: "literature",
    icon: FileText,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
  },
  {
    id: "5",
    title: "Validation report generated",
    description: "RT-qPCR results for candidate ASO-0038 ready.",
    time: "3 hours ago",
    read: true,
    type: "validation",
    icon: FlaskConical,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
  {
    id: "6",
    title: "Database synchronized",
    description: "RefSeq, ClinVar, and GTEx data updated.",
    time: "5 hours ago",
    read: true,
    type: "analysis",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
  {
    id: "7",
    title: "Platform found 3 higher-scoring ASOs",
    description: "New candidates with improved specificity scores.",
    time: "6 hours ago",
    read: true,
    type: "analysis",
    icon: Sparkles,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50",
  },
  {
    id: "8",
    title: "Wet-lab results uploaded",
    description: "Western blot images for DMD-Project-01 added.",
    time: "1 day ago",
    read: true,
    type: "validation",
    icon: FlaskConical,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
  {
    id: "9",
    title: "Project milestone reached",
    description: "DMD Exon 51 project is 75% complete.",
    time: "1 day ago",
    read: true,
    type: "projects",
    icon: Folder,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
];

const FILTERS: { id: NotifFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "analysis", label: "Analysis" },
  { id: "projects", label: "Projects" },
  { id: "validation", label: "Validation" },
  { id: "literature", label: "Literature" },
];

export default function Notifications({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<NotifFilter>("all");
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.type === filter);
  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[400px] max-h-[80vh] rounded-xl border border-[#E5E7EB] bg-white shadow-xl z-50 flex flex-col overflow-hidden"
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
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] font-medium text-brand hover:underline"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2">
        <Filter className="h-3 w-3 text-slate-400 mr-1" />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
              filter === f.id
                ? "bg-brand text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto h-6 w-6 text-slate-300 mb-2" />
            <p className="text-[12px] text-slate-400">No notifications in this category.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((n) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                    !n.read ? "bg-brand/[0.02]" : ""
                  }`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${n.iconBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${n.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-[12px] font-medium truncate ${!n.read ? "text-slate-800" : "text-slate-600"}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.description}</p>
                    <p className="text-[10px] text-slate-300 mt-1">{n.time}</p>
                  </div>
                </button>
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
  );
}
