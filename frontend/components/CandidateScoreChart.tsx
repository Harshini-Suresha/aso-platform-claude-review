"use client";

import { useState, useRef } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

function scoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#0F766E";
  if (score >= 30) return "#f59e0b";
  return "#dc2626";
}

export default function CandidateScoreChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  if (n === 0) return null;

  const W = 760;
  const PAD = { top: 16, right: 56, bottom: 36, left: 52 };
  const rowH = 42;
  const H = PAD.top + n * rowH + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;

  const maxScore = Math.max(100, ...candidates.map((c) => c.compositeScore));

  function rowY(i: number) {
    return PAD.top + i * rowH + rowH / 2;
  }

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const my = ((e.clientY - rect.top) / rect.height) * H;
    const idx = Math.max(
      0,
      Math.min(n - 1, Math.floor((my - PAD.top) / rowH))
    );
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
        {/* Grid + axis labels */}
        {[0, 25, 50, 75, 100].map((v) => {
          const x = PAD.left + (v / maxScore) * plotW;
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
         <text x={PAD.left + plotW / 4} y={H - 5} textAnchor="middle" className="fill-black" fontSize={10} fontWeight={700}>
          Composite design score
        </text>
        <text x={PAD.left + (plotW * 3) / 4} y={H - 5} textAnchor="middle" className="fill-black" fontSize={10} fontWeight={700}>
          Composite score = 65% duplex ΔG + 35% Tm fit (normalized 0–100)
        </text>

        {/* Bars */}
        {candidates.map((c, i) => {
          const x0 = PAD.left;
          const bw = (c.compositeScore / maxScore) * plotW;
          const y = rowY(i) - 10;
          const isHover = hover === i;
          return (
            <g key={c.sequence}>
              <rect
                x={PAD.left - 4}
                y={PAD.top + i * rowH}
                width={plotW + PAD.right + 2}
                height={rowH}
                rx={4}
                fill={isHover ? "#f1f5f9" : "transparent"}
              />
              <text x={x0 - 10} y={rowY(i) + 4.5} textAnchor="end" className="fill-black" fontSize={13} fontWeight={700}>
                #{i + 1}
              </text>
              <rect x={x0} y={y} width={Math.max(2, bw)} height={20} rx={4} fill={scoreColor(c.compositeScore)} opacity={isHover ? 1 : 0.85} />
              <text
                x={Math.max(bw + 8, 40)}
                y={rowY(i) + 4.5}
                className="fill-slate-700"
                fontSize={13}
                fontWeight={600}
              >
                {c.compositeScore}
              </text>
              {isHover && (
                <g>
                  <rect x={W - PAD.right - 230} y={PAD.top + i * rowH - 30} width={230} height={rowH + 18} rx={5} fill="#1e293b" opacity={0.95} />
                  <text x={W - PAD.right - 222} y={PAD.top + i * rowH - 11} className="fill-emerald-300" fontSize={12} fontWeight={600}>
                    {c.targetRegion}
                  </text>
                  <text x={W - PAD.right - 222} y={PAD.top + i * rowH + 12} className="fill-slate-300" fontSize={12}>
                    ΔG {c.realMetrics.targetDuplexEnergy} kcal/mol · Tm {c.realMetrics.meltingTempC}°C · GC {c.realMetrics.gcContent}%
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
