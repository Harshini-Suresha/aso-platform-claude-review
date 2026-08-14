"use client";

import { useState, useRef } from "react";
import { RnaCandidate } from "@/types/proteinReplacement";

function scoreColor(score: number): string {
  if (score >= 0.92) return "#10b981";
  if (score >= 0.85) return "#0F766E";
  if (score >= 0.70) return "#f59e0b";
  return "#dc2626";
}

export default function ProteinMfeChart({
  candidates,
}: {
  candidates: RnaCandidate[];
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

  const mfes = candidates.map((c) => c.mfe);
  const minMfe = Math.floor(Math.min(...mfes)) - 5;
  const maxMfe = Math.ceil(Math.max(...mfes)) + 5;
  const mfeRange = maxMfe - minMfe || 1;

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
        {Array.from({ length: 6 }).map((_, i) => {
          const v = minMfe + (mfeRange * i) / 5;
          const x = PAD.left + ((v - minMfe) / mfeRange) * plotW;
          return (
            <g key={i}>
              <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke="#e2e8f0" strokeWidth={0.7} />
              <text x={x} y={H - PAD.bottom + 18} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700}>
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}
        <text x={PAD.left + plotW / 2} y={H - 5} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700}>
          Minimum Free Energy (MFE, kcal/mol)
        </text>

        {candidates.map((c, i) => {
          const bw = ((c.mfe - minMfe) / mfeRange) * plotW;
          const y = rowY(i) - 10;
          const isHover = hover === i;
          return (
            <g key={c.constructId}>
              <rect x={PAD.left - 4} y={PAD.top + i * rowH} width={plotW + PAD.right + 2} height={rowH} rx={4} fill={isHover ? "#f1f5f9" : "transparent"} />
              <text x={PAD.left - 10} y={rowY(i) + 4.5} textAnchor="end" className="fill-black" fontSize={13} fontWeight={700}>
                #{i + 1}
              </text>
              <rect x={PAD.left} y={y} width={Math.max(2, bw)} height={20} rx={4} fill={scoreColor(Math.abs(c.mfe) / 400)} opacity={isHover ? 1 : 0.85} />
              <text x={Math.max(bw + 8, 40)} y={rowY(i) + 4.5} className="fill-slate-700" fontSize={13} fontWeight={600}>
                {c.mfe.toFixed(1)}
              </text>
              {isHover && (
                <g>
                  <rect x={W - PAD.right - 240} y={PAD.top + i * rowH - 30} width={240} height={rowH + 18} rx={5} fill="#1e293b" opacity={0.95} />
                  <text x={W - PAD.right - 232} y={PAD.top + i * rowH - 11} className="fill-emerald-300" fontSize={12} fontWeight={600}>
                    {c.constructId}
                  </text>
                  <text x={W - PAD.right - 232} y={PAD.top + i * rowH + 12} className="fill-slate-300" fontSize={12}>
                    CAI {c.cai.toFixed(2)} · Initiation {c.initiationEfficiency}% · Yield {c.predictedProteinYield}
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
