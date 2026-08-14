"use client";

import { RankedMechanism } from "@/types/mechanism";
import { Card } from "./ui";

function scoreColor(score: number, eligible: boolean): string {
  if (!eligible) return "#94a3b8";
  if (score >= 12) return "#10b981";
  if (score >= 9) return "#0F766E";
  if (score >= 6) return "#f59e0b";
  return "#dc2626";
}

export default function MechanismRankingChart({
  results,
}: {
  results: RankedMechanism[];
}) {
  const n = results.length;
  if (n === 0) return null;

  const W = 760;
  const PAD = { top: 16, right: 56, bottom: 36, left: 180 };
  const rowH = 38;
  const H = PAD.top + n * rowH + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const maxScore = 15;

  function rowY(i: number) {
    return PAD.top + i * rowH + rowH / 2;
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-700"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>
        <p className="text-[11.5px] font-semibold text-slate-700">Mechanism ranking — contextual fit score</p>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {[0, 5, 10, 15].map((v) => {
            const x = PAD.left + (v / maxScore) * plotW;
            return (
              <g key={v}>
                <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke="#e2e8f0" strokeWidth={0.7} />
                <text x={x} y={H - PAD.bottom + 18} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700}>
                  {v}
                </text>
              </g>
            );
          })}
          <text x={PAD.left + plotW / 2} y={H - 5} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700}>
            Contextual fit score (0–15)
          </text>

          {results.map((m, i) => {
            const bw = (m.score / maxScore) * plotW;
            const y = PAD.top + i * rowH;
            const label = m.name.length > 32 ? m.name.slice(0, 30) + "…" : m.name;
            return (
              <g key={m.id}>
                <rect x={PAD.left - 4} y={y} width={plotW + PAD.right + 2} height={rowH} rx={4} fill="transparent" />
                <text x={PAD.left - 8} y={rowY(i) + 4.5} textAnchor="end" className="fill-black" fontSize={12} fontWeight={700}>
                  {m.id}
                </text>
                <text x={PAD.left - 8} y={rowY(i) + 14} textAnchor="end" className="fill-slate-500" fontSize={10}>
                  {label}
                </text>
                <rect x={PAD.left} y={y + 9} width={Math.max(2, bw)} height={20} rx={4} fill={scoreColor(m.score, m.eligible)} opacity={m.eligible ? 0.9 : 0.4} />
                <text x={PAD.left + bw + 8} y={rowY(i) + 4.5} className="fill-slate-700" fontSize={13} fontWeight={600}>
                  {m.score}
                </text>
                {!m.eligible && (
                  <text x={PAD.left + bw + 36} y={rowY(i) + 4.5} className="fill-slate-400" fontSize={10}>
                    poor fit
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-emerald-500" /> Eligible (score ≥ 6)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-amber-500" /> Low fit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-red-500" /> Poor fit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-slate-400" /> Not eligible
        </span>
      </div>
    </Card>
  );
}
