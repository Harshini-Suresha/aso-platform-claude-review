"use client";

import { useRef, useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

interface CandidateWithBreakdown extends AssoCandidate {
  scoreBreakdown?: {
    duplexScore: number;
    tmFitScore: number;
    duplexRaw: number;
    tmRaw: number;
  };
}

function fallbackDuplexScore(c: CandidateWithBreakdown): number {
  const dg = c.realMetrics.targetDuplexEnergy;
  return Math.round(Math.min(100, Math.max(0, (-dg - 8) * 3.5)) * 10) / 10;
}

export default function CompositeBreakdownChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  if (n === 0) return null;

  const list = candidates as CandidateWithBreakdown[];

  const W = 760;
  const PAD = { top: 20, right: 68, bottom: 38, left: 52 };
  const rowH = 42;
  const H = PAD.top + n * rowH + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;

  function rowY(i: number) {
    return PAD.top + i * rowH + rowH / 2;
  }

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const my = ((e.clientY - rect.top) / rect.height) * H;
    const idx = Math.max(0, Math.min(n - 1, Math.floor((my - PAD.top) / rowH)));
    setHover(idx);
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid + axis */}
        {[0, 25, 50, 75, 100].map((v) => {
          const x = PAD.left + (v / 100) * plotW;
          return (
            <g key={v}>
              <line
                x1={x}
                y1={PAD.top}
                x2={x}
                y2={H - PAD.bottom}
                stroke="#e2e8f0"
                strokeWidth={0.7}
              />
              <text x={x} y={H - PAD.bottom + 18} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700}>
                {v}
              </text>
            </g>
          );
        })}
        <text x={PAD.left + plotW / 2} y={H - 5} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700}>
          Composite score = 65% duplex ΔG + 35% Tm fit (normalized 0–100)
        </text>

        {list.map((c, i) => {
          const sb = c.scoreBreakdown;
          const duplex = sb ? sb.duplexScore : fallbackDuplexScore(c);
          const tmFit = sb ? sb.tmFitScore : Math.round(c.compositeScore);
          const total = Math.min(100, 0.65 * duplex + 0.35 * tmFit);
          const y = PAD.top + i * rowH;
          const barH = 20;
          const isHover = hover === i;
          const wDuplex = (duplex / 100) * plotW;
          const wTm = (tmFit / 100) * plotW;
          const wTotal = (total / 100) * plotW;

          return (
            <g key={c.sequence}>
              <rect
                x={PAD.left - 4}
                y={y}
                width={plotW + PAD.right + 2}
                height={rowH}
                rx={4}
                fill={isHover ? "#f1f5f9" : "transparent"}
              />
              <text x={PAD.left - 10} y={rowY(i) + 4.5} textAnchor="end" className="fill-black" fontSize={13} fontWeight={700}>
                #{i + 1}
              </text>

              {/* duplex contribution bar (weighted 0.65) */}
              <rect x={PAD.left} y={y + (barH - 14) / 2} width={Math.max(2, wDuplex * 0.65)} height={14} rx={3} fill="#0F766E" opacity={isHover ? 1 : 0.85} />
              {/* tm-fit contribution bar (weighted 0.35) */}
              <rect x={PAD.left + wDuplex * 0.65} y={y + (barH - 14) / 2} width={Math.max(2, wTm * 0.35)} height={14} rx={3} fill="#F59E0B" opacity={isHover ? 1 : 0.85} />
              {/* total marker */}
              <rect x={PAD.left} y={y + (barH - 14) / 2} width={Math.max(2, wTotal)} height={14} rx={3} fill="none" stroke="#0F172A" strokeWidth={1.4} strokeDasharray={isHover ? "none" : "4 3"} />

              <text x={PAD.left + wTotal + 8} y={rowY(i) + 4.5} className="fill-slate-800" fontSize={13} fontWeight={700}>
                {c.compositeScore}
              </text>

              {isHover && (
                <g>
                  <rect x={W - PAD.right - 260} y={y - 32} width={260} height={rowH + 22} rx={5} fill="#1e293b" opacity={0.95} />
                  <text x={W - PAD.right - 252} y={y - 13} className="fill-emerald-300" fontSize={12} fontWeight={600}>
                    {c.targetRegion}
                  </text>
                  <text x={W - PAD.right - 252} y={y + 12} className="fill-slate-300" fontSize={11.5}>
                    ΔG {sb ? sb.duplexRaw : c.realMetrics.targetDuplexEnergy} kcal/mol → duplex {duplex}/100 (×0.65 = {Math.round(duplex * 0.65 * 10) / 10})
                  </text>
                  <text x={W - PAD.right - 252} y={y + 26} className="fill-slate-300" fontSize={11.5}>
                    Tm {sb ? sb.tmRaw : c.realMetrics.meltingTempC}°C → fit {tmFit}/100 (×0.35 = {Math.round(tmFit * 0.35 * 10) / 10})
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-teal-700" /> Duplex ΔG (65% weight)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-amber-500" /> Tm fit (35% weight)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm border border-slate-900 bg-transparent" /> Total composite
        </span>
        <span className="ml-auto italic text-slate-400">hover a row for the raw inputs</span>
      </div>
    </div>
  );
}
