"use client";

import { useState, useRef } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

function scoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#0F766E";
  if (score >= 30) return "#f59e0b";
  return "#dc2626";
}

export default function BindingLandscapeChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!candidates.length) return null;

  const W = 760;
  const H = 430;
  const PAD = { top: 26, right: 24, bottom: 54, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const tms = candidates.map((c) => c.realMetrics.meltingTempC);
  const dgs = candidates.map((c) => c.realMetrics.targetDuplexEnergy);

  const minT = Math.max(0, Math.floor(Math.min(...tms) / 5) * 5 - 5);
  const maxT = Math.ceil(Math.max(...tms) / 5) * 5 + 5;
  const tRange = maxT - minT || 1;

  // More negative ΔG = stronger binding → plotted toward the top.
  const minG = Math.floor(Math.min(...dgs)) - 2;
  const maxG = Math.ceil(Math.max(...dgs)) + 2;
  const gRange = maxG - minG || 1;

  const xScale = (t: number) => PAD.left + ((t - minT) / tRange) * plotW;
  // Most negative ΔG (strongest binding) plotted at the top.
  const yScale = (g: number) => PAD.top + ((g - minG) / gRange) * plotH;

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    let best = 0;
    let bestD = Infinity;
    candidates.forEach((c, i) => {
      const d = Math.hypot(xScale(c.realMetrics.meltingTempC) - mx, yScale(c.realMetrics.targetDuplexEnergy) - my);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(bestD < 40 ? best : null);
  }

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minG + (gRange * i) / yTicks);
  const xTicks = 5;
  const xTickValues = Array.from({ length: xTicks + 1 }, (_, i) => minT + (tRange * i) / xTicks);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid */}
        {yTickValues.map((v, i) => (
          <line key={i} x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="#e2e8f0" strokeWidth={0.7} />
        ))}
        {xTickValues.map((v, i) => (
          <line key={i} x1={xScale(v)} y1={PAD.top} x2={xScale(v)} y2={H - PAD.bottom} stroke="#e2e8f0" strokeWidth={0.7} />
        ))}

        {/* Axis labels */}
        <text x={PAD.left + plotW / 2} y={H - 8} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700}>
          Melting temperature Tm (°C)
        </text>
        <text x={18} y={PAD.top + plotH / 2} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700} transform={`rotate(-90 18 ${PAD.top + plotH / 2})`}>
          Target duplex ΔG (kcal/mol)
        </text>
        <text x={W - PAD.right - 2} y={PAD.top - 6} textAnchor="end" className="fill-slate-300" fontSize={11}>
          stronger binding ↑
        </text>

        {/* Y ticks */}
        {yTickValues.map((v, i) => (
          <text key={i} x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-black" fontSize={11} fontWeight={700}>
            {v}
          </text>
        ))}
        {/* X ticks */}
        {xTickValues.map((v, i) => (
          <text key={i} x={xScale(v)} y={H - PAD.bottom + 16} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700}>
            {v}
          </text>
        ))}

        {/* Points */}
        {candidates.map((c, i) => {
          const x = xScale(c.realMetrics.meltingTempC);
          const y = yScale(c.realMetrics.targetDuplexEnergy);
          const active = hover === i;
          const r = active ? 9 : 7;
          return (
            <g key={c.sequence}>
              {active && (
                <>
                  <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="3,3" />
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="3,3" />
                </>
              )}
              <circle cx={x} cy={y} r={r} fill={scoreColor(c.compositeScore)} stroke="#fff" strokeWidth={2} />
              <text x={x} y={y - r - 4} textAnchor="middle" className="fill-slate-500" fontSize={12} fontWeight={600}>
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {hover !== null && (() => {
          const c = candidates[hover];
          const x = xScale(c.realMetrics.meltingTempC);
          const y = yScale(c.realMetrics.targetDuplexEnergy);
          const boxX = x > W / 2 ? x - 250 : x + 14;
          const boxY = Math.max(PAD.top, Math.min(H - PAD.bottom - 66, y - 34));
          return (
            <g>
              <rect x={boxX} y={boxY} width={236} height={64} rx={5} fill="#1e293b" opacity={0.95} />
              <text x={boxX + 10} y={boxY + 18} className="fill-emerald-300" fontSize={12} fontWeight={600}>
                #{hover + 1} {c.targetRegion}
              </text>
              <text x={boxX + 10} y={boxY + 36} className="fill-slate-300" fontSize={12}>
                ΔG {c.realMetrics.targetDuplexEnergy} kcal/mol · Tm {c.realMetrics.meltingTempC}°C
              </text>
              <text x={boxX + 10} y={boxY + 54} className="fill-slate-300" fontSize={12}>
                GC {c.realMetrics.gcContent}% · Score {c.compositeScore}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
