"use client";

import { useState } from "react";
import { Download, Save, Check, FileText, Info } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui";
import { buildAsoReport, reportFilename, triggerDownload, AsoReportContext } from "@/lib/asoReport";
import { saveReport } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { THERAPEUTIC_GOALS } from "@/types/mechanism";

interface AsoReportCardProps {
  ctx: AsoReportContext;
  step?: string;
}

export default function AsoReportCard({ ctx, step = "aso_design" }: AsoReportCardProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const gene = ctx.gene;
  const results = ctx.results;
  const candidates = results?.candidates ?? [];
  const top = candidates[0] as any;
  const goal = THERAPEUTIC_GOALS.find((g) => g.id === ctx.therapeuticGoal);
  const topDuplexEnergy = top?.realMetrics?.targetDuplexEnergy ?? top?.targetDuplexEnergy;

  function handleDownload() {
    const report = buildAsoReport(ctx);
    triggerDownload(report, reportFilename(gene?.geneSymbol));
  }

  async function handleSave() {
    if (!user) {
      setError("Sign in to save reports to your account.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const mechanismName = ctx.mechanism?.name || "";
    try {
      const res = await saveReport({
        step,
        title: `ASO Design Report: ${gene?.geneSymbol || "Gene"} — ${mechanismName || ctx.therapeuticGoal || "Design"}`,
        geneSymbol: gene?.geneSymbol ?? "",
        disease: gene?.disease || gene?.diseaseName || "",
        summary: `Full design report for ${mechanismName}. Generated ${candidates.length} candidate${candidates.length === 1 ? "" : "s"} for ${ctx.therapeuticGoal || "therapeutic goal"}.`,
        data: {
          reportType: "aso_design",
          therapeuticGoal: ctx.therapeuticGoal,
          therapeuticGoalName: goal?.name ?? ctx.therapeuticGoal,
          mechanismId: ctx.mechanism?.id ?? null,
          mechanismName: ctx.mechanism?.name ?? null,
          mechanismDetail: ctx.mechanism?.detail ?? null,
          geneSymbol: gene?.geneSymbol ?? null,
          designInputs: ctx.design,
          target: ctx.target ?? null,
          results: results as Record<string, unknown> | null,
        },
      });
      if (res) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError("Could not save report. Please try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save report.");
    } finally {
      setSaving(false);
    }
  }

  if (!results || candidates.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <SectionHeader
        step=""
        title="Design Report"
        right={
          <span className="flex items-center gap-1 text-[10.5px] text-slate-400">
            <FileText className="h-3.5 w-3.5" /> Covers goal · mechanism · all candidates
          </span>
        }
      />
      <div className="px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Therapeutic Goal</p>
            <p className="mt-1 text-[13px] font-semibold text-slate-800">
              {ctx.therapeuticGoal || "—"}
              {goal ? <span className="ml-1.5 text-[11px] font-normal text-slate-500">{goal.name}</span> : null}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mechanism</p>
            <p className="mt-1 text-[13px] font-semibold text-slate-800">
              {ctx.mechanism?.id || "—"}
              {ctx.mechanism?.name ? <span className="ml-1.5 text-[11px] font-normal text-slate-500">{ctx.mechanism.name}</span> : null}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Candidates</p>
            <p className="mt-1 text-[13px] font-semibold text-slate-800">
              {candidates.length} generated
              {topDuplexEnergy != null ? (
                <span className="ml-1.5 text-[11px] font-normal text-slate-500">
                  top {topDuplexEnergy} kcal/mol
                </span>
              ) : null}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Gene</p>
            <p className="mt-1 text-[13px] font-semibold text-slate-800">
              {gene?.geneSymbol || "—"}
              {gene?.organism ? <span className="ml-1.5 text-[11px] font-normal text-slate-500">{gene.organism}</span> : null}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[12.5px] font-medium text-white hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> Download report (.txt)
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-[12.5px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {saved ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved to Reports" : saving ? "Saving..." : "Save to Reports"}
          </button>
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-[12.5px] font-medium text-slate-500 hover:bg-slate-50"
          >
            <Info className="h-3.5 w-3.5" /> {showPreview ? "Hide preview" : "Preview report"}
          </button>
        </div>

        {ctx.therapeuticGoal === "TG01" && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Composite Design Score</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-800">
                0.65×duplex ΔG + 0.35×Tm fit
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Normalized Formula</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-800">
                65% duplex ΔG + 35% Tm fit (normalized 0–100)
              </p>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-[12px] text-amber-600">{error}</p>}

        {showPreview && (
          <div className="mt-4">
            <div className="rounded-xl border border-[#E5E7EB] bg-slate-900 p-4">
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-emerald-300">
                {buildAsoReport(ctx)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
