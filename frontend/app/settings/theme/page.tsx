"use client";

import { useState } from "react";
import { Palette, CheckCircle, Sun, Moon, Monitor } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";

const THEMES = [
  { id: "light" as const, label: "Light", icon: Sun, bg: "bg-white", ring: "ring-slate-300", iconColor: "text-amber-500" },
  { id: "dark" as const, label: "Dark", icon: Moon, bg: "bg-slate-800", ring: "ring-slate-600", iconColor: "text-slate-300" },
  { id: "system" as const, label: "System", icon: Monitor, bg: "bg-gradient-to-r from-white to-slate-800", ring: "ring-indigo-400", iconColor: "text-slate-600 dark:text-slate-300" },
];

export default function ThemePage() {
  const { theme, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);

  function select(id: "light" | "dark" | "system") {
    setTheme(id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-[#0f172a]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 dark:bg-slate-700">
              <Palette className="h-4 w-4 text-slate-500 dark:text-slate-300" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">Theme</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose your visual theme</p>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Appearance"
              right={saved && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                  <CheckCircle className="h-3 w-3" />Saved
                </span>
              )}
            />
            <div className="px-5 pb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {THEMES.map((t) => {
                const Icon = t.icon;
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => select(t.id)}
                    className={`flex flex-col items-center gap-3 rounded-xl border-2 px-4 py-5 transition-all ${
                      active
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950 shadow-sm"
                        : "border-[#E5E7EB] dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full ${t.bg} ring-2 ${active ? "ring-indigo-500" : t.ring}`}>
                      <Icon className={`h-5 w-5 ${t.iconColor}`} />
                    </span>
                    <span className={`text-[12px] font-semibold ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"}`}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
