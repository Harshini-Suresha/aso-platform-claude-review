"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, Clock } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/lib/auth";

function timeAgo(ts: number): string {
  const sec = Math.floor(Date.now() / 1000 - ts);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function ActivityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<{ id: number; action: string; detail: string; timestamp: number }[]>([]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    getProfile().then((p) => { if (p) setActivity(p.activity); }).finally(() => setLoading(false));
  }, [user, router]);

  if (loading) return <div className="flex min-h-screen bg-[#F8FAFC]"><Sidebar /><div className="flex min-h-screen flex-1 flex-col"><Topbar /><main className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></main></div></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><BarChart3 className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Recent Activity</p><p className="text-[11px] text-slate-500">Your recent actions on the platform</p></div>
          </Card>
          <Card>
            <SectionHeader title="Activity Feed" />
            <div className="px-5 pb-5">
              {activity.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-4 text-center">No activity yet. Start using the platform to see your actions here.</p>
              ) : (
                <div className="space-y-2">
                  {activity.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-slate-700">{a.action}</p>
                        {a.detail && <p className="text-[11px] text-slate-500 truncate">{a.detail}</p>}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(a.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
