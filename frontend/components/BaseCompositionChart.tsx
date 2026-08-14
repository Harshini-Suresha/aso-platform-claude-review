"use client";

import { useRef, useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

const BASES = ["A", "C", "G", "T"] as const;
const BASE_COLORS: Record<string, string> = {
  A: "#f59e0b",
  C: "#3b82f6",
  G: "#10b981",
  T: "#ef4444",
};

export default function BaseCompositionChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  if (n === 0) return null;

  const compositions = candidates.map((c) => {
    const counts: Record<string, number> = { A: 0, C: 0, G: 0, T: 0 };
    for (const b of c.sequence.toUpperCase()) {
      if (b in counts) counts[b] += 1;
    }
    return counts;
  });

  const W = 760;
  const PAD = { top: 20, right: 56, bottom: 38, left: 52 };
  const rowH = 42;
  const H = PAD.top + n * rowH + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const barH = 20;

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
        {/* Grid */}
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
                {v}%
              </text>
            </g>
          );
        })}
        <text x={PAD.left + plotW / 2} y={H - 5} textAnchor="middle" className="fill-black" fontSize={12} fontWeight={700}>
          Sequence base composition (5'→3', % of {candidates[0].length} nt)
        </text>

        {candidates.map((c, i) => {
          const counts = compositions[i];
          const total = c.sequence.length;
          const y = PAD.top + i * rowH;
          const isHover = hover === i;
          let acc = 0;

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

              {BASES.map((b) => {
                const pct = (counts[b] / total) * 100;
                const x = PAD.left + (acc / 100) * plotW;
                acc += pct;
                const w = (pct / 100) * plotW;
                return (
                  <rect
                    key={b}
                    x={x}
                    y={y + (barH - 18) / 2}
                    width={Math.max(w, pct > 0 ? 1.5 : 0)}
                    height={18}
                    fill={BASE_COLORS[b]}
                    opacity={isHover ? 1 : 0.85}
                    stroke="#fff"
                    strokeWidth={0.5}
                  />
                );
              })}

              <text x={PAD.left + plotW + 8} y={rowY(i) + 4.5} className="fill-slate-700" fontSize={12} fontWeight={600}>
                {total} nt
              </text>

              {isHover && (
                <g>
                  <rect x={W - PAD.right - 260} y={y - 30} width={260} height={rowH + 20} rx={5} fill="#1e293b" opacity={0.95} />
                  <text x={W - PAD.right - 252} y={y - 11} className="fill-emerald-300" fontSize={12} fontWeight={600}>
                    {c.targetRegion}
                  </text>
                  <text x={W - PAD.right - 252} y={y + 13} className="fill-slate-300" fontSize={11.5}>
                    {BASES.map((b) => `${b} ${counts[b]} (${((counts[b] / total) * 100).toFixed(0)}%)`).join(" · ")}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-slate-500">
        {BASES.map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3 rounded-sm" style={{ backgroundColor: BASE_COLORS[b] }} />
            {b}
          </span>
        ))}
        <span className="ml-auto italic text-slate-400">hover a row for exact counts</span>
      </div>
    </div>
  );
}
