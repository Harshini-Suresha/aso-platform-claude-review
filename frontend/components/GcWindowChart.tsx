"use client";

import { useState, useRef } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

export default function GcWindowChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  if (n === 0) return null;

  const W = 760;
  const H = 320;
  const PAD = { top: 20, right: 16, bottom: 62, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const slot = plotW / n;
  const barW = Math.min(40, slot * 0.5);
  const yScale = (gc: number) => PAD.top + plotH - (gc / 100) * plotH;

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(n - 1, Math.floor((mx - PAD.left) / slot)));
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
        {/* Optimal 40-60% band */}
        <rect
          x={PAD.left}
          y={yScale(60)}
          width={plotW}
          height={yScale(40) - yScale(60)}
          fill="#10b981"
          opacity={0.07}
        />
        <text x={PAD.left + 6} y={yScale(60) - 4} className="fill-emerald-400" fontSize={10.5}>
          60%
        </text>
        <text x={PAD.left + 6} y={yScale(40) + 14} className="fill-emerald-400" fontSize={10.5}>
          40%
        </text>
        <line x1={PAD.left} y1={yScale(40)} x2={W - PAD.right} y2={yScale(40)} stroke="#10b981" strokeWidth={0.8} strokeDasharray="3,3" opacity={0.5} />
        <line x1={PAD.left} y1={yScale(60)} x2={W - PAD.right} y2={yScale(60)} stroke="#10b981" strokeWidth={0.8} strokeDasharray="3,3" opacity={0.5} />

        {/* Grid */}
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="#e2e8f0" strokeWidth={0.7} />
            <text x={PAD.left - 6} y={yScale(v) + 4} textAnchor="end" className="fill-black" fontSize={10.5} fontWeight={700}>
              {v}
            </text>
          </g>
        ))}

        {/* Bars */}
        {candidates.map((c, i) => {
          const gc = c.realMetrics.gcContent;
          const inWindow = gc >= 40 && gc <= 60;
          const x = PAD.left + i * slot + slot / 2 - barW / 2;
          const y = yScale(gc);
          const active = hover === i;
          return (
            <g key={c.sequence}>
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill={active ? "#f1f5f9" : "transparent"}
                rx={3}
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, PAD.top + plotH - y)}
                rx={3}
                fill={inWindow ? "#10b981" : gc < 40 ? "#f59e0b" : "#dc2626"}
                opacity={active ? 1 : 0.85}
              />
              {active && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-slate-700" fontSize={11} fontWeight={700}>
                  {gc}%
                </text>
              )}
              <text x={PAD.left + i * slot + slot / 2} y={H - 34} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700}>
                #{i + 1}
              </text>
            </g>
          );
        })}

        <text x={PAD.left + plotW / 2} y={H - 12} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700}>
          Candidate (design rank)
        </text>
        <text x={16} y={PAD.top + plotH / 2} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700} transform={`rotate(-90 16 ${PAD.top + plotH / 2})`}>
          GC content (%)
        </text>
      </svg>
    </div>
  );
}
