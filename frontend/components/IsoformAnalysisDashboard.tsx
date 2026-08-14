"use client";

import { IsoformCandidate } from "@/types/isoformEngineering";
import IsoformScoreChart from "@/components/IsoformScoreChart";
import IsoformMfeChart from "@/components/IsoformMfeChart";
import IsoformCaiScatter from "@/components/IsoformCaiScatter";
import IsoformTlrChart from "@/components/IsoformTlrChart";
import IsoformYieldChart from "@/components/IsoformYieldChart";
import IsoformDeepDiveCard from "@/components/IsoformDeepDiveCard";

export default function IsoformAnalysisDashboard({
  candidates,
}: {
  candidates: IsoformCandidate[];
}) {
  if (!candidates.length) return null;

  const bestSplice = candidates[0];
  const bestCai = [...candidates].sort((a, b) => b.cai - a.cai)[0];
  const lowestTlr = [...candidates].sort((a, b) => {
    const aScore = a.diagnostics.tlr3Score + a.diagnostics.tlr7Score + a.diagnostics.tlr8Score;
    const bScore = b.diagnostics.tlr3Score + b.diagnostics.tlr7Score + b.diagnostics.tlr8Score;
    return aScore - bScore;
  })[0];

  const meanSplice = Math.round(candidates.reduce((s, c) => s + c.spliceEfficiency, 0) / candidates.length);
  const meanCai = (candidates.reduce((s, c) => s + c.cai, 0) / candidates.length).toFixed(3);
  const meanU = (candidates.reduce((s, c) => s + c.uContent, 0) / candidates.length).toFixed(1);
  const meanMfe = (candidates.reduce((s, c) => s + c.mfe, 0) / candidates.length).toFixed(1);

  return (
    <div id="isoform-analysis-dashboard" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Candidates
          </p>
          <p className="text-[18px] font-bold text-slate-800">{candidates.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Best Splice %
          </p>
          <p className="text-[18px] font-bold text-emerald-600">
            {bestSplice.spliceEfficiency}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Mean CAI
          </p>
          <p className="text-[18px] font-bold text-slate-800">{meanCai}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Mean U%
          </p>
          <p className="text-[18px] font-bold text-slate-800">{meanU}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Mean MFE
          </p>
          <p className="text-[18px] font-bold text-slate-800">{meanMfe}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Best TLR
          </p>
          <p className="text-[18px] font-bold text-emerald-600">{lowestTlr.tlrRisk}</p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-[12px] font-semibold text-blue-800 mb-1">Key Findings</p>
        <ul className="space-y-1 text-[11.5px] text-blue-700">
          <li>
            • Top candidate <strong>{bestSplice.constructId}</strong> achieves{" "}
            <strong>{bestSplice.spliceEfficiency}%</strong> predicted splice efficiency with CAI{" "}
            <strong>{bestSplice.cai.toFixed(3)}</strong> and U% <strong>{bestSplice.uContent.toFixed(1)}</strong>.
          </li>
          <li>
            • Best codon adaptation: <strong>{bestCai.constructId}</strong> (CAI{" "}
            <strong>{bestCai.cai.toFixed(3)}</strong>).
          </li>
          <li>
            • Lowest innate immune risk: <strong>{lowestTlr.constructId}</strong> (TLR{" "}
            <strong>{lowestTlr.tlrRisk}</strong>).
          </li>
          <li>
            • All {candidates.length} candidates are {candidates.every((c) => c.inFrameStatus === "In-Frame") ? "in-frame" : "mixed frame status"}.
            {candidates.every((c) => c.secondaryStructureFlag === "PASSED")
              ? " All passed secondary structure checks."
              : " Some candidates show secondary structure concerns."}
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-semibold text-slate-700 mb-3">
            Splice Efficiency Ranking
          </p>
          <IsoformScoreChart candidates={candidates} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-semibold text-slate-700 mb-3">
            Predicted Isoform Yield
          </p>
          <IsoformYieldChart candidates={candidates} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">
              CAI vs Uridine Content
            </p>
            <IsoformCaiScatter candidates={candidates} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">
              Minimum Free Energy (MFE)
            </p>
            <IsoformMfeChart candidates={candidates} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-semibold text-slate-700 mb-3">
            TLR Innate Immune Risk
          </p>
          <IsoformTlrChart candidates={candidates} />
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-slate-700 mb-3">
          Candidate Deep Dive
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {candidates.slice(0, 4).map((c, i) => (
            <IsoformDeepDiveCard key={c.constructId} candidate={c} rank={i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
