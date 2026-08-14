"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  LogOut,
  Star,
  Bookmark,
  FileText,
  Users,
  Palette,
  Bell,
  Sliders,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

const PROFILE_ITEMS = [
  { label: "Profile", icon: User, href: "/settings" },
];

const SAVED_ITEMS = [
  { label: "Saved Designs", icon: Star, href: "/settings/saved-designs" },
  { label: "Favorite Genes", icon: Bookmark, href: "/settings/favorites" },
  { label: "Recent Reports", icon: FileText, href: "/settings/reports" },
  { label: "Collaborators", icon: Users, href: "/settings/collaborators" },
];

const PREFERENCES = [
  { label: "Theme", icon: Palette, href: "/settings/theme" },
  { label: "Notifications", icon: Bell, href: "/settings/notifications" },
  { label: "Preferences", icon: Sliders, href: "/settings/preferences" },
];

export default function AccountMenu({
  initials,
  name,
  email,
  role,
  institution,
  verified,
}: {
  initials: string;
  name: string;
  email: string;
  role?: string;
  institution?: string;
  verified?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useKeyboardShortcut("escape", () => setOpen(false), { enabled: open });
  useKeyboardShortcut("a", () => setOpen((o) => !o), { ctrl: true, shift: true });

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleLogout() {
    setOpen(false);
    logout();
    router.push("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded py-1 pl-1 pr-2 hover:bg-slate-100 transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
          {initials}
        </span>
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 border border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
          {/* User Header */}
          <div className="border-b border-slate-100 dark:border-slate-700 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-white shrink-0">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200 truncate">{name}</p>
                {(role || institution) && (
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-500 truncate">
                    {role}{role && institution ? " \u00b7 " : ""}{institution}
                  </p>
                )}
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 truncate">{email}</p>
              </div>
            </div>
            {verified === false && (
              <a href="/verify-email" className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 text-[10.5px] text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                Email not verified — click to resend
              </a>
            )}
          </div>

          {/* Workspace */}
          <div className="border-b border-slate-100 dark:border-slate-700 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
              Workspace
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 dark:bg-indigo-900 text-[9px] font-bold text-indigo-600 dark:text-indigo-300">
                  {institution ? institution.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "WS"}
                </span>
                <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">{institution || "Workspace"}</span>
              </div>
              <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
            </div>
          </div>

          <div className="p-1.5 max-h-[380px] overflow-y-auto">
            {/* Profile */}
            {PROFILE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-[11.5px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  {item.label}
                </button>
              );
            })}

            <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />

            {/* Saved Work */}
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Saved Work
            </p>
            {SAVED_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-[11.5px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  {item.label}
                </button>
              );
            })}

            <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />

            {/* Preferences */}
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Preferences
            </p>
            {PREFERENCES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-[11.5px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  {item.label}
                </button>
              );
            })}

            <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />

            <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-left text-[11.5px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
