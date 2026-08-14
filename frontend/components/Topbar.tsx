"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import HelpMenu from "@/components/HelpMenu";
import NotificationPanel from "@/components/NotificationPanel";
import AccountMenu from "@/components/AccountMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useClientSearchParams } from "@/utils/useClientSearchParams";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export default function Topbar() {
  const router = useRouter();
  const searchParams = useClientSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchText, setSearchText] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = searchParams?.get("q") ?? "";
    setSearchText(query);
  }, [searchParams]);

  useKeyboardShortcut("k", () => searchRef.current?.focus(), { ctrl: true, meta: true });
  useKeyboardShortcut("n", () => setShowNotifications((o) => !o), { ctrl: true, shift: true, meta: true });

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = searchText.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-slate-900 px-6" style={{ height: "64px" }}>
      <div className="min-w-0">
        <h1 className="text-[16px] font-bold leading-tight text-[#0F172A] dark:text-slate-100">Dashboard</h1>
        <p className="mt-0.5 text-[12px] font-medium text-[#64748B] dark:text-slate-400">RNA therapeutics design workspace</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative hidden w-[313px] md:block">
          <span className="sr-only">Search targets, genes, projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B] dark:text-slate-400" />
          <input
            ref={searchRef}
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search targets, genes, projects..."
            className="h-9 w-full rounded-lg border border-[#E5E7EB] dark:border-slate-600 bg-white dark:bg-slate-800 pl-9 pr-3 text-[11px] text-[#0F172A] dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <button type="submit" className="sr-only">Search</button>
        </form>
        <HelpMenu />

        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              showNotifications ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Bell className="h-4 w-4" />
          </button>
          <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>

        {!authLoading && (
          <AccountMenu
            initials={user?.initials ?? "U"}
            name={user?.name ?? "User"}
            email={user?.email ?? ""}
            role={user?.role}
            institution={user?.institution}
            verified={user?.verified}
          />
        )}
        {authLoading && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 animate-pulse" />
        )}
      </div>
    </header>
  );
}
