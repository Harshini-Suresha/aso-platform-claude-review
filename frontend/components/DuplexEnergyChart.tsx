"use client";

import { useState, useRef } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

function dgColor(dg: number): string {
  if (dg <= -25) return "#10b981";
  if (dg <= -15) return "#0F766E";
  if (dg <= -10) return "#f59e0b";
  return "#dc2626";
}

export default function DuplexEnergyChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  if (n === 0) return null;

  const W = 760;
  const PAD = { top: 16, right: 64, bottom: 36, left: 52 };
  const rowH = 42;
  const H = PAD.top + n * rowH + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;

  const dgs = candidates.map((c) => c.realMetrics.targetDuplexEnergy);
  const maxAbs = Math.max(...dgs.map((d) => Math.abs(d)), 8);

  function rowY(i: number) {
    return PAD.top + i * rowH + rowH / 2;
  }

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const my = ((e.clientY - rect.top) / rect.height) * H;
    setHover(Math.max(0, Math.min(n - 1, Math.floor((my - PAD.top) / rowH))));
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
        {/* Zero baseline */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="3,3" />
        <text x={PAD.left - 6} y={PAD.top + 5} textAnchor="end" className="fill-black" fontSize={10} fontWeight={700}>
          0
        </text>

        {/* Bars (length ∝ |ΔG|; more negative = stronger = longer) */}
        {candidates.map((c, i) => {
          const dg = c.realMetrics.targetDuplexEnergy;
          const bw = (Math.abs(dg) / maxAbs) * plotW;
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
              <text x={PAD.left - 10} y={rowY(i) + 4.5} textAnchor="end" className="fill-black" fontSize={13} fontWeight={700}>
                #{i + 1}
              </text>
              <rect x={PAD.left} y={y} width={Math.max(2, bw)} height={20} rx={4} fill={dgColor(dg)} opacity={isHover ? 1 : 0.85} />
              <text x={Math.max(bw + 8, 34)} y={rowY(i) + 4.5} className="fill-slate-700" fontSize={13} fontWeight={600}>
                {dg}
              </text>
              {isHover && (
                <g>
                  <rect x={W - PAD.right - 230} y={PAD.top + i * rowH - 30} width={230} height={rowH + 18} rx={5} fill="#1e293b" opacity={0.95} />
                  <text x={W - PAD.right - 222} y={PAD.top + i * rowH - 11} className="fill-emerald-300" fontSize={12} fontWeight={600}>
                    {c.targetRegion}
                  </text>
                  <text x={W - PAD.right - 222} y={PAD.top + i * rowH + 12} className="fill-slate-300" fontSize={12}>
                    duplex ΔG {dg} kcal/mol · GC {c.realMetrics.gcContent}%
                  </text>
                </g>
              )}
            </g>
          );
        })}

        <text x={PAD.left + plotW / 2} y={H - 5} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700}>
          Target duplex ΔG (kcal/mol) — more negative = stronger predicted binding
        </text>
      </svg>
    </div>
  );
}
