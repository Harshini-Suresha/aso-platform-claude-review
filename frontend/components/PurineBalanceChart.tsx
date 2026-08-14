"use client";

import { useState, useRef } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

export default function PurineBalanceChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  if (n === 0) return null;

  const W = 760;
  const PAD = { top: 16, right: 52, bottom: 36, left: 52 };
  const rowH = 42;
  const H = PAD.top + n * rowH + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const cx = PAD.left + plotW / 2;
  const half = plotW / 2;

  const maxDev = Math.max(50, ...candidates.map((c) => Math.abs(c.realMetrics.purineContent - 0.5) * 100));

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
        {/* Center axis (balanced 50/50) */}
        <line x1={cx} y1={PAD.top} x2={cx} y2={H - PAD.bottom} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3,3" />
        <text x={cx} y={PAD.top - 6} textAnchor="middle" className="fill-black" fontSize={11} fontWeight={700}>
          balanced 50/50
        </text>

        {/* Diverging bars */}
        {candidates.map((c, i) => {
          const purine = c.realMetrics.purineContent * 100;
          const pyrimidine = 100 - purine;
          const dev = (purine - 50) / maxDev;
          const bw = Math.abs(dev) * half;
          const x = dev >= 0 ? cx : cx - bw;
          const y = rowY(i) - 9.5;
          const isHover = hover === i;
          const color = dev >= 0 ? "#2563EB" : "#F43F5E";
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
              <text x={cx - 10} y={rowY(i) + 4.5} textAnchor="end" className="fill-black" fontSize={13} fontWeight={700}>
                #{i + 1}
              </text>
              <rect x={x} y={y} width={Math.max(2, bw)} height={19} rx={4} fill={color} opacity={isHover ? 1 : 0.85} />
              {isHover && (
                <g>
                  <rect x={W - PAD.right - 210} y={PAD.top + i * rowH - 30} width={210} height={rowH + 18} rx={5} fill="#1e293b" opacity={0.95} />
                  <text x={W - PAD.right - 202} y={PAD.top + i * rowH - 11} className="fill-emerald-300" fontSize={12} fontWeight={600}>
                    {c.targetRegion}
                  </text>
                  <text x={W - PAD.right - 202} y={PAD.top + i * rowH + 12} className="fill-slate-300" fontSize={12}>
                    Purines {purine.toFixed(1)}% · Pyrimidines {pyrimidine.toFixed(1)}%
                  </text>
                </g>
              )}
            </g>
          );
        })}

        <text x={cx} y={H - 5} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700}>
          Base balance — right = purine-rich (A+G), left = pyrimidine-rich (C+T)
        </text>
      </svg>
    </div>
  );
}
