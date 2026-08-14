"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HardDrive, Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/lib/auth";

export default function StoragePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState({ designs: 0, favorites: 0, interests: 0 });

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    getProfile().then((p) => { if (p) setStorage(p.storage); }).finally(() => setLoading(false));
  }, [user, router]);

  if (loading) return <div className="flex min-h-screen bg-[#F8FAFC]"><Sidebar /><div className="flex min-h-screen flex-1 flex-col"><Topbar /><main className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></main></div></div>;

  const items = [
    { label: "Saved Designs", count: storage.designs, color: "bg-indigo-50 text-indigo-600" },
    { label: "Favorite Genes", count: storage.favorites, color: "bg-emerald-50 text-emerald-600" },
    { label: "Research Interests", count: storage.interests, color: "bg-violet-50 text-violet-600" },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><HardDrive className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Storage</p><p className="text-[11px] text-slate-500">Your saved data summary</p></div>
          </Card>
          <Card>
            <SectionHeader title="Storage Usage" />
            <div className="px-5 pb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <div key={item.label} className={`rounded-lg border border-slate-100 px-4 py-3 ${item.color.split(" ")[0]}`}>
                  <p className={`text-[22px] font-bold ${item.color.split(" ")[1]}`}>{item.count}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
