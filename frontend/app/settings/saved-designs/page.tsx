"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, Trash2, ExternalLink } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile, deleteDesign } from "@/lib/auth";

interface Design { id: number; name: string; geneSymbol: string; ensemblId: string; disease: string; notes: string; createdAt: number }

export default function SavedDesignsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [designs, setDesigns] = useState<Design[]>([]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    getProfile().then((p) => { if (p) setDesigns(p.savedDesigns); }).finally(() => setLoading(false));
  }, [user, router]);

  async function handleDelete(id: number) {
    await deleteDesign(id);
    setDesigns(designs.filter((d) => d.id !== id));
  }

  if (loading) return <div className="flex min-h-screen bg-[#F8FAFC]"><Sidebar /><div className="flex min-h-screen flex-1 flex-col"><Topbar /><main className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></main></div></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><Star className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Saved Designs</p><p className="text-[11px] text-slate-500">ASO designs you have saved</p></div>
          </Card>
          <Card>
            <SectionHeader title={`Saved Designs (${designs.length})`} />
            <div className="px-5 pb-5">
              {designs.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-4 text-center">No saved designs yet. Design an ASO and save it from the pipeline.</p>
              ) : (
                <div className="space-y-2">
                  {designs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800">{d.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {d.geneSymbol && <span className="font-mono">{d.geneSymbol}</span>}
                          {d.disease && <span> · {d.disease}</span>}
                        </p>
                      </div>
                      <button onClick={() => handleDelete(d.id)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
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
