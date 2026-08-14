"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile, updateProfile } from "@/lib/auth";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [institution, setInstitution] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    getProfile().then((p) => {
      if (p) {
        setName(p.name);
        setEmail(p.email);
        setRole(p.role);
        setInstitution(p.institution);
        setDepartment(p.department);
        setBio(p.bio);
      }
    }).finally(() => setLoading(false));
  }, [user, router]);

  useKeyboardShortcut("s", handleKeyboardSave, { ctrl: true, meta: true });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await updateProfile({ name, email, role, institution, department, bio });
      if (user) setUser({ ...user, name, email, role, institution, department, bio, initials: res.initials });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleKeyboardSave() {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await updateProfile({ name, email, role, institution, department, bio });
      if (user) setUser({ ...user, name, email, role, institution, department, bio, initials: res.initials });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100">
              <span className="text-[14px] font-bold text-slate-500">{user?.initials ?? "U"}</span>
            </span>
            <div>
              <p className="text-[12px] font-semibold text-slate-800">Profile</p>
              <p className="text-[11px] text-slate-500">Manage your personal information</p>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Personal Information" />
            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}
              {saved && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-600">
                  <CheckCircle className="h-4 w-4 shrink-0" />Profile updated successfully
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">Full name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">Role</label>
                  <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Research Scientist" className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">Institution</label>
                  <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. MIT" className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">Department</label>
                  <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. RNA Biology Lab" className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell us about your research focus..." className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 resize-none" />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save changes
                </button>
              </div>
            </form>
          </Card>
        </main>
      </div>
    </div>
  );
}
