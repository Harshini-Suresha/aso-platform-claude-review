"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile, updateProfile } from "@/lib/auth";

export default function OrganizationPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [institution, setInstitution] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    getProfile().then((p) => {
      if (p) { setInstitution(p.institution); setDepartment(p.department); }
    }).finally(() => setLoading(false));
  }, [user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      await updateProfile({ institution, department });
      if (user) setUser({ ...user, institution, department });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-screen bg-[#F8FAFC]"><Sidebar /><div className="flex min-h-screen flex-1 flex-col"><Topbar /><main className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></main></div></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><Building2 className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Organization</p><p className="text-[11px] text-slate-500">Your institution and department details</p></div>
          </Card>
          <Card>
            <SectionHeader title="Organization Details" />
            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
              {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              {saved && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-600"><CheckCircle className="h-4 w-4 shrink-0" />Saved</div>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">Institution</label>
                  <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. MIT" className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">Department</label>
                  <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. RNA Biology Lab" className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save</button>
              </div>
            </form>
          </Card>
        </main>
      </div>
    </div>
  );
}
