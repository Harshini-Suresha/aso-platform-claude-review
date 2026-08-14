"use client";

import { useState, useEffect } from "react";
import { Sliders, CheckCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";

const ORGANISMS = ["Homo sapiens", "Mus musculus", "Rattus norvegicus", "Danio rerio"];
const UNITS = ["Metric", "Imperial"];

export default function PreferencesPage() {
  const [organism, setOrganism] = useState("Homo sapiens");
  const [unit, setUnit] = useState("Metric");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setOrganism(localStorage.getItem("aso:organism") || "Homo sapiens");
    setUnit(localStorage.getItem("aso:units") || "Metric");
  }, []);

  function save() {
    localStorage.setItem("aso:organism", organism);
    localStorage.setItem("aso:units", unit);
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
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><Sliders className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Preferences</p><p className="text-[11px] text-slate-500">General platform settings</p></div>
          </Card>
          <Card>
            <SectionHeader title="General Preferences" right={saved && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle className="h-3 w-3" />Saved</span>} />
            <div className="px-5 pb-5 space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">Default Organism</label>
                <select value={organism} onChange={(e) => { setOrganism(e.target.value); save(); }} className="h-10 w-full max-w-xs rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15">
                  {ORGANISMS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">Unit System</label>
                <div className="flex gap-2">
                  {UNITS.map((u) => (
                    <button key={u} onClick={() => { setUnit(u); save(); }} className={`h-9 rounded-lg border px-4 text-[12px] font-medium ${unit === u ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-[#E5E7EB] text-slate-600 hover:border-slate-300"}`}>{u}</button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
