"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile, addInterest, deleteInterest } from "@/lib/auth";

interface Interest { id: number; topic: string; description: string }

export default function InterestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [topic, setTopic] = useState("");
  const [desc, setDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    getProfile().then((p) => { if (p) setInterests(p.interests); }).finally(() => setLoading(false));
  }, [user, router]);

  async function handleAdd() {
    if (!topic.trim()) return;
    setAdding(true); setError("");
    try {
      const r = await addInterest(topic, desc);
      setInterests([...interests, r]);
      setTopic(""); setDesc("");
    } catch (err: any) { setError(err.message); }
    finally { setAdding(false); }
  }

  async function handleDelete(id: number) {
    await deleteInterest(id);
    setInterests(interests.filter((i) => i.id !== id));
  }

  if (loading) return <div className="flex min-h-screen bg-[#F8FAFC]"><Sidebar /><div className="flex min-h-screen flex-1 flex-col"><Topbar /><main className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></main></div></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><FlaskConical className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Research Interests</p><p className="text-[11px] text-slate-500">Topics you are focused on</p></div>
          </Card>
          <Card>
            <SectionHeader title="Add Interest" />
            <div className="px-5 pb-5 space-y-3">
              {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (e.g. Spinal Muscular Atrophy)" className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Brief description (optional)" className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
              </div>
              <button onClick={handleAdd} disabled={adding || !topic.trim()} className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Add
              </button>
            </div>
          </Card>
          {interests.length > 0 && (
            <Card>
              <SectionHeader title={`Your Interests (${interests.length})`} />
              <div className="px-5 pb-5 space-y-2">
                {interests.map((i) => (
                  <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                    <div><p className="text-[13px] font-medium text-slate-800">{i.topic}</p>{i.description && <p className="text-[11px] text-slate-500">{i.description}</p>}</div>
                    <button onClick={() => handleDelete(i.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
