"use client";

import { IsoformCandidate } from "@/types/isoformEngineering";
import { Card } from "@/components/ui";

export default function IsoformDeepDiveCard({
  candidate,
  rank,
}: {
  candidate: IsoformCandidate;
  rank: number;
}) {
  const tlrScore =
    candidate.diagnostics.tlr3Score +
    candidate.diagnostics.tlr7Score +
    candidate.diagnostics.tlr8Score;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">
          #{rank}
        </span>
        <div>
          <p className="text-[13px] font-semibold text-slate-800 font-mono">
            {candidate.constructId}
          </p>
          <p className="text-[11px] text-slate-500">{candidate.modality}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Splice Efficiency
          </p>
          <p
            className={`text-[14px] font-bold ${
              candidate.spliceEfficiency >= 85
                ? "text-emerald-600"
                : candidate.spliceEfficiency >= 70
                  ? "text-amber-600"
                  : "text-red-600"
            }`}
          >
            {candidate.spliceEfficiency}%
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Isoform Yield
          </p>
          <p
            className={`text-[14px] font-bold ${
              candidate.predictedIsoformYield.includes("High")
                ? "text-emerald-600"
                : candidate.predictedIsoformYield.includes("Medium")
                  ? "text-blue-600"
                  : "text-amber-600"
            }`}
          >
            {candidate.predictedIsoformYield}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Codon Adaptation (CAI)
          </p>
          <p
            className={`text-[14px] font-bold ${
              candidate.cai >= 0.92 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {candidate.cai.toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Uridine Content
          </p>
          <p
            className={`text-[14px] font-bold ${
              candidate.uContent < 20 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {candidate.uContent.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400 mb-0.5">TLR3</p>
          <p className="text-[12px] font-bold text-slate-700">
            {candidate.diagnostics.tlr3Score}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400 mb-0.5">TLR7</p>
          <p className="text-[12px] font-bold text-slate-700">
            {candidate.diagnostics.tlr7Score}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400 mb-0.5">TLR8</p>
          <p className="text-[12px] font-bold text-slate-700">
            {candidate.diagnostics.tlr8Score}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
          MFE Plot (ViennaRNA)
        </p>
        <div className="font-mono text-[10px] text-slate-600 break-all leading-relaxed select-all">
          {candidate.diagnostics.mfePlot}
        </div>
        <div className="mt-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              candidate.diagnostics.fiveUtrHairpin
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {candidate.diagnostics.fiveUtrHairpin
              ? "FAILED — 5' UTR Hairpin"
              : "PASSED — No 5' UTR Hairpin"}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
          Construct Sequence (5' → 3')
        </p>
        <div className="font-mono text-[10px] text-slate-700 break-all leading-relaxed select-all">
          {candidate.sequence}
        </div>
      </div>
    </Card>
  );
}
