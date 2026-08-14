"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Loader2, Trash2, ExternalLink } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile, deleteFavorite } from "@/lib/auth";

interface Fav { id: number; geneSymbol: string; ensemblId: string; note: string; createdAt: number }

export default function FavoritesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState<Fav[]>([]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    getProfile().then((p) => { if (p) setFavs(p.favorites); }).finally(() => setLoading(false));
  }, [user, router]);

  async function handleDelete(id: number) {
    await deleteFavorite(id);
    setFavs(favs.filter((f) => f.id !== id));
  }

  if (loading) return <div className="flex min-h-screen bg-[#F8FAFC]"><Sidebar /><div className="flex min-h-screen flex-1 flex-col"><Topbar /><main className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></main></div></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><Bookmark className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Favorite Genes</p><p className="text-[11px] text-slate-500">Genes you are tracking</p></div>
          </Card>
          <Card>
            <SectionHeader title={`Favorites (${favs.length})`} />
            <div className="px-5 pb-5">
              {favs.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-4 text-center">No favorite genes yet. Search for a gene and add it to favorites.</p>
              ) : (
                <div className="space-y-2">
                  {favs.map((f) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-mono font-medium text-slate-800">{f.geneSymbol}</p>
                        {f.note && <p className="text-[11px] text-slate-500">{f.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {f.ensemblId && <a href={`https://ensembl.org/id/${f.ensemblId}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-500"><ExternalLink className="h-3.5 w-3.5" /></a>}
                        <button onClick={() => handleDelete(f.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
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
