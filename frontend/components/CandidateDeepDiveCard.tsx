"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { AssoCandidate } from "@/types/geneSilencing";
import { Card } from "./ui";
import AsoScoreGauge from "./AsoScoreGauge";
import NucleotideCompositionChart from "./NucleotideCompositionChart";

function DuplexEnergyBadge({ energy }: { energy: number }) {
  const label = energy <= -25 ? "Very Stable" : energy <= -15 ? "Stable" : energy <= -10 ? "Moderate" : "Weak";
  const cls =
    energy <= -25
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : energy <= -15
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : energy <= -10
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

export default function CandidateDeepDiveCard({
  candidate,
  rank,
}: {
  candidate: AssoCandidate;
  rank: number;
}) {
  const rm = candidate.realMetrics;

  const composition = { A: 0, C: 0, G: 0, T: 0, U: 0 };
  for (const b of candidate.sequence.toUpperCase()) {
    if (b in composition) composition[b as keyof typeof composition] += 1;
  }

  const selfDimerLabel =
    rm.selfStructureMfe === 0
      ? "None"
      : rm.selfStructureMfe > -3
        ? "Low"
        : rm.selfStructureMfe > -6
          ? "Moderate"
          : "High";

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-700 text-[12px] font-bold text-white">
            {rank}
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-800">{candidate.targetRegion}</p>
            <p className="text-[10.5px] text-slate-500">
              {candidate.chemistry} · {candidate.length} nt · {candidate.mechanismId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <DuplexEnergyBadge energy={rm.targetDuplexEnergy} />
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Score {candidate.compositeScore}
          </span>
        </div>
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Score &amp; metrics</p>
          <AsoScoreGauge candidate={candidate} />
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Base composition</p>
          <NucleotideCompositionChart composition={composition} />
          <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-2.5 text-[11.5px] text-slate-500">
            <MetricRow label="Duplex ΔG" value={`${rm.targetDuplexEnergy} kcal/mol`} />
            <MetricRow label="Melting temp" value={`${rm.meltingTempC}°C`} />
            <MetricRow label="Self-structure" value={`${rm.selfStructureMfe} kcal/mol (${selfDimerLabel})`} />
            <MetricRow label="GC / skew / complexity" value={`${rm.gcContent}% · ${rm.gcSkew.toFixed(2)} · ${rm.sequenceComplexity.toFixed(2)}`} />
            <MetricRow label="CpG / homopolymer" value={`${rm.cpgCount} · ${rm.longestHomopolymer} bp`} />
          </div>
        </div>
      </div>

      {/* Sequence strip */}
      <div className="mx-5 mb-4 rounded-xl bg-slate-900 px-4 py-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          Antisense sequence (5'→3') · {candidate.sequence.length} nt
        </p>
        <p className="break-all font-mono text-[12.5px] leading-relaxed tracking-widest text-emerald-400 select-all">
          {candidate.sequence}
        </p>
      </div>

      {candidate.alleleSpecific && (
        <p className="mx-5 mb-4 flex items-start gap-1.5 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-[11px] leading-relaxed text-teal-800">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {candidate.alleleNotes}
        </p>
      )}
      {candidate.defectNotes && candidate.defectNotes !== "No defect-specific note available." && (
        <p className="mx-5 mb-5 flex items-start gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          {candidate.defectNotes}
        </p>
      )}
    </Card>
  );
}
