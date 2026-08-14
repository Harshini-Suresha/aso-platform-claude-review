"use client";

import { useState } from "react";
import { Puzzle, Eye, EyeOff, CheckCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";

const KEYS = [
  { key: "anthropic", label: "Claude (Anthropic)", placeholder: "sk-ant-..." },
  { key: "openai", label: "OpenAI", placeholder: "sk-..." },
  { key: "google", label: "Google Gemini", placeholder: "AIza..." },
];

export default function IntegrationsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  function save() {
    KEYS.forEach((k) => {
      if (values[k.key]) localStorage.setItem(`aso:apikey:${k.key}`, values[k.key]);
    });
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
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><Puzzle className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Integrations</p><p className="text-[11px] text-slate-500">API keys for external services</p></div>
          </Card>
          <Card>
            <SectionHeader title="API Keys" right={saved && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle className="h-3 w-3" />Saved</span>} />
            <div className="px-5 pb-5 space-y-4">
              <p className="text-[11px] text-slate-500">API keys are stored locally in your browser and never sent to our servers.</p>
              {KEYS.map((k) => (
                <div key={k.key}>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">{k.label}</label>
                  <div className="relative">
                    <input
                      type={visible[k.key] ? "text" : "password"}
                      value={values[k.key] || ""}
                      onChange={(e) => setValues({ ...values, [k.key]: e.target.value })}
                      placeholder={k.placeholder}
                      className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 pr-10 text-[13px] font-mono text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                    />
                    <button type="button" onClick={() => setVisible({ ...visible, [k.key]: !visible[k.key] })} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {visible[k.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={save} className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[12px] font-semibold text-white hover:bg-indigo-700">Save Keys</button>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
