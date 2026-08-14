"use client";

import { useState, useRef } from "react";
import { RnaCandidate } from "@/types/proteinReplacement";

function scoreColor(score: number): string {
  if (score >= 0.92) return "#10b981";
  if (score >= 0.85) return "#0F766E";
  if (score >= 0.70) return "#f59e0b";
  return "#dc2626";
}

export default function ProteinCaiScatter({
  candidates,
}: {
  candidates: RnaCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!candidates.length) return null;

  const W = 520;
  const H = 400;
  const PAD = { top: 26, right: 24, bottom: 54, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const cais = candidates.map((c) => c.cai);
  const us = candidates.map((c) => c.uContent);

  const minC = Math.max(0, Math.floor(Math.min(...cais) * 20) / 20 - 0.05);
  const maxC = Math.min(1, Math.ceil(Math.max(...cais) * 20) / 20 + 0.05);
  const cRange = maxC - minC || 0.1;

  const minU = Math.max(0, Math.floor(Math.min(...us)) - 2);
  const maxU = Math.ceil(Math.max(...us)) + 2;
  const uRange = maxU - minU || 1;

  const xScale = (cai: number) => PAD.left + ((cai - minC) / cRange) * plotW;
  const yScale = (u: number) => PAD.top + ((u - minU) / uRange) * plotH;

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    let best = 0;
    let bestD = Infinity;
    candidates.forEach((c, i) => {
      const d = Math.hypot(xScale(c.cai) - mx, yScale(c.uContent) - my);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(bestD < 40 ? best : null);
  }

  const xTicks = 5;
  const xTickValues = Array.from({ length: xTicks + 1 }, (_, i) => minC + (cRange * i) / xTicks);
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minU + (uRange * i) / yTicks);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {yTickValues.map((v, i) => (
          <line key={`y${i}`} x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="#e2e8f0" strokeWidth={0.7} />
        ))}
        {xTickValues.map((v, i) => (
          <line key={`x${i}`} x1={xScale(v)} y1={PAD.top} x2={xScale(v)} y2={H - PAD.bottom} stroke="#e2e8f0" strokeWidth={0.7} />
        ))}

        <text x={PAD.left + plotW / 2} y={H - 8} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700}>
          Codon Adaptation Index (CAI)
        </text>
        <text x={18} y={PAD.top + plotH / 2} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700} transform={`rotate(-90 18 ${PAD.top + plotH / 2})`}>
          Uridine Content (%)
        </text>

        {yTickValues.map((v, i) => (
          <text key={`yl${i}`} x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-black" fontSize={11} fontWeight={700}>
            {v.toFixed(0)}%
          </text>
        ))}
        {xTickValues.map((v, i) => (
          <text key={`xl${i}`} x={xScale(v)} y={H - PAD.bottom + 16} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700}>
            {v.toFixed(2)}
          </text>
        ))}

        {candidates.map((c, i) => {
          const x = xScale(c.cai);
          const y = yScale(c.uContent);
          const active = hover === i;
          const r = active ? 9 : 7;
          return (
            <g key={c.constructId}>
              {active && (
                <>
                  <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="3,3" />
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="3,3" />
                </>
              )}
              <circle cx={x} cy={y} r={r} fill={scoreColor(c.cai)} stroke="#fff" strokeWidth={2} />
              <text x={x} y={y - r - 4} textAnchor="middle" className="fill-slate-500" fontSize={12} fontWeight={600}>
                {i + 1}
              </text>
            </g>
          );
        })}

        {hover !== null && (() => {
          const c = candidates[hover];
          const x = xScale(c.cai);
          const y = yScale(c.uContent);
          const boxX = x > W / 2 ? x - 240 : x + 14;
          const boxY = Math.max(PAD.top, Math.min(H - PAD.bottom - 66, y - 34));
          return (
            <g>
              <rect x={boxX} y={boxY} width={236} height={64} rx={5} fill="#1e293b" opacity={0.95} />
              <text x={boxX + 10} y={boxY + 18} className="fill-emerald-300" fontSize={12} fontWeight={600}>
                #{hover + 1} {c.constructId}
              </text>
              <text x={boxX + 10} y={boxY + 36} className="fill-slate-300" fontSize={12}>
                CAI {c.cai.toFixed(3)} · U% {c.uContent.toFixed(1)} · Initiation {c.initiationEfficiency}%
              </text>
              <text x={boxX + 10} y={boxY + 54} className="fill-slate-300" fontSize={12}>
                MFE {c.mfe.toFixed(1)} kcal/mol · Yield {c.predictedProteinYield}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
