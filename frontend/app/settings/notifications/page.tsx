"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";

const OPTIONS = [
  { key: "email_notifications", label: "Email notifications", desc: "Receive email updates about your analyses" },
  { key: "pipeline_complete", label: "Pipeline completion", desc: "Notify when ASO design pipeline finishes" },
  { key: "new_diseases", label: "New disease data", desc: "Alert when new disease-gene associations are available" },
  { key: "browser_push", label: "Browser push notifications", desc: "Real-time alerts in your browser" },
];

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored: Record<string, boolean> = {};
    OPTIONS.forEach((o) => { stored[o.key] = localStorage.getItem(`aso:notif:${o.key}`) === "true"; });
    setPrefs(stored);
  }, []);

  function toggle(key: string) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem(`aso:notif:${key}`, String(next[key]));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><Bell className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Notifications</p><p className="text-[11px] text-slate-500">Manage notification preferences</p></div>
          </Card>
          <Card>
            <SectionHeader title="Notification Preferences" right={saved && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle className="h-3 w-3" />Saved</span>} />
            <div className="px-5 pb-5 space-y-3">
              {OPTIONS.map((o) => (
                <div key={o.key} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                  <div><p className="text-[12px] font-medium text-slate-700">{o.label}</p><p className="text-[11px] text-slate-500">{o.desc}</p></div>
                  <button onClick={() => toggle(o.key)} className={`relative h-5 w-9 rounded-full transition-colors ${prefs[o.key] ? "bg-indigo-500" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${prefs[o.key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
