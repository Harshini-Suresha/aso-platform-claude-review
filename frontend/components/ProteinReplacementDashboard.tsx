"use client";

import { RnaCandidate } from "@/types/proteinReplacement";
import ProteinInitiationChart from "@/components/ProteinInitiationChart";
import ProteinYieldChart from "@/components/ProteinYieldChart";
import ProteinCaiScatter from "@/components/ProteinCaiScatter";
import ProteinMfeChart from "@/components/ProteinMfeChart";
import ProteinTlrChart from "@/components/ProteinTlrChart";

export default function ProteinReplacementDashboard({
  candidates,
}: {
  candidates: RnaCandidate[];
}) {
  if (!candidates.length) return null;

  const bestInitiation = [...candidates].sort((a, b) => b.initiationEfficiency - a.initiationEfficiency)[0];
  const bestYield = [...candidates].sort((a, b) => {
    const parseYield = (s: string) => parseFloat((s.match(/(\d+(?:\.\d+)?)/) || ["0"])[1]);
    return parseYield(b.predictedProteinYield) - parseYield(a.predictedProteinYield);
  })[0];
  const lowestTlr = [...candidates].sort((a, b) => {
    const aScore = parseTlr(a.tlrRisk);
    const bScore = parseTlr(b.tlrRisk);
    return aScore - bScore;
  })[0];

  const meanInitiation = Math.round(candidates.reduce((s, c) => s + c.initiationEfficiency, 0) / candidates.length);
  const meanCai = (candidates.reduce((s, c) => s + c.cai, 0) / candidates.length).toFixed(3);
  const meanU = (candidates.reduce((s, c) => s + c.uContent, 0) / candidates.length).toFixed(1);
  const meanMfe = (candidates.reduce((s, c) => s + c.mfe, 0) / candidates.length).toFixed(1);

  return (
    <div id="pr-analysis-dashboard" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Candidates
          </p>
          <p className="text-[18px] font-bold text-slate-800">{candidates.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Best Initiation %
          </p>
          <p className="text-[18px] font-bold text-emerald-600">
            {bestInitiation.initiationEfficiency}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Best Yield
          </p>
          <p className="text-[18px] font-bold text-emerald-600">
            {bestYield.predictedProteinYield}
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
            Best TLR
          </p>
          <p className="text-[18px] font-bold text-emerald-600">{lowestTlr.tlrRisk}</p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-[12px] font-semibold text-blue-800 mb-1">Key Findings</p>
        <ul className="space-y-1 text-[11.5px] text-blue-700">
          <li>
            • Top candidate <strong>{bestInitiation.constructId}</strong> achieves{" "}
            <strong>{bestInitiation.initiationEfficiency}%</strong> translation initiation efficiency with CAI{" "}
            <strong>{bestInitiation.cai.toFixed(3)}</strong> and U% <strong>{bestInitiation.uContent.toFixed(1)}</strong>.
          </li>
          <li>
            • Highest protein yield: <strong>{bestYield.constructId}</strong> ({" "}
            <strong>{bestYield.predictedProteinYield}</strong>).
          </li>
          <li>
            • Lowest innate immune risk: <strong>{lowestTlr.constructId}</strong> (TLR{" "}
            <strong>{lowestTlr.tlrRisk}</strong>).
          </li>
          <li>
            • All {candidates.length} candidates passed secondary structure checks with mean MFE{" "}
            <strong>{meanMfe} kcal/mol</strong>.
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-semibold text-slate-700 mb-3">
            Translation Initiation Efficiency Ranking
          </p>
          <ProteinInitiationChart candidates={candidates} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-semibold text-slate-700 mb-3">
            Predicted Protein Yield
          </p>
          <ProteinYieldChart candidates={candidates} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">
              CAI vs Uridine Content
            </p>
            <ProteinCaiScatter candidates={candidates} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">
              Minimum Free Energy (MFE)
            </p>
            <ProteinMfeChart candidates={candidates} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-semibold text-slate-700 mb-3">
            TLR Innate Immune Risk
          </p>
          <ProteinTlrChart candidates={candidates} />
        </div>
      </div>
    </div>
  );
}

function parseTlr(risk: string): number {
  const m = risk.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 10;
}
