"use client";

import { useRef, useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

export default function TargetCoverageChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  if (n === 0) return null;

  const mapped = candidates
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.exonNumber != null && c.exonLength != null);
  const unmapped = candidates
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.exonNumber == null || c.exonLength == null);

  const exonNumbers = Array.from(
    new Set(mapped.map(({ c }) => c.exonNumber as number))
  ).sort((a, b) => a - b);
  const exonLengths: Record<number, number> = {};
  for (const { c } of mapped) {
    const ex = c.exonNumber as number;
    exonLengths[ex] = Math.max(exonLengths[ex] ?? 0, c.exonLength as number);
  }
  const totalLen = Object.values(exonLengths).reduce((s, v) => s + v, 0) || 1;

  const W = 760;
  const PAD = { top: 40, right: 24, bottom: 44, left: 24 };
  const trackW = W - PAD.left - PAD.right;
  const trackH = 46;

  const exonX = (ex: number) =>
    PAD.left +
    Object.entries(exonLengths)
      .filter(([k]) => Number(k) < ex)
      .reduce((s, [, v]) => s + (v / totalLen) * trackW, 0);
  const exonW = (ex: number) => (exonLengths[ex] / totalLen) * trackW;

  function scoreColor(s: number) {
    if (s >= 70) return "#10b981";
    if (s >= 50) return "#0F766E";
    if (s >= 30) return "#f59e0b";
    return "#dc2626";
  }

  function handleMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * 220;
    const idx = candidates.findIndex((c, i) => {
      if (c.exonNumber == null) return false;
      const x = exonX(c.exonNumber) + exonW(c.exonNumber) / 2;
      const dx = (mx - x) / trackW;
      const dy = (my - (candidates.indexOf(c) === 0 ? 120 : 150)) / 100;
      return Math.abs(dx) < 0.06 && Math.abs(dy) < 0.4;
    });
    setHover(idx >= 0 ? idx : null);
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} 220`}
        className="w-full h-auto"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Exon track */}
        <text x={PAD.left} y={PAD.top - 12} className="fill-black" fontSize={12} fontWeight={700}>
          Exon track (width ∝ exon length)
        </text>
        <rect x={PAD.left} y={PAD.top} width={trackW} height={trackH} rx={8} fill="#f8fafc" stroke="#e2e8f0" />
        {exonNumbers.map((ex) => {
          const x = exonX(ex);
          const w = exonW(ex);
          return (
            <g key={ex}>
              <rect
                x={x + 1.5}
                y={PAD.top + 3}
                width={Math.max(w - 3, 8)}
                height={trackH - 6}
                rx={4}
                fill="#e2e8f0"
                stroke="#cbd5e1"
              />
              <text
                x={x + w / 2}
                y={PAD.top + trackH - 14}
                textAnchor="middle"
                className="fill-slate-600"
                fontSize={w > 46 ? 11 : 9}
                fontWeight={700}
              >
                Exon {ex}
              </text>
              <text
                x={x + w / 2}
                y={PAD.top + trackH + 16}
                textAnchor="middle"
                className="fill-slate-400"
                fontSize={w > 60 ? 9.5 : 0}
              >
                {exonLengths[ex]} bp
              </text>
            </g>
          );
        })}

        {/* Candidate markers */}
        {mapped.map(({ c, i }) => {
          const x = exonX(c.exonNumber as number) + exonW(c.exonNumber as number) / 2;
          const active = hover === i;
          return (
            <g key={c.sequence}>
              <circle
                cx={x}
                cy={PAD.top + trackH + 40}
                r={active ? 12 : 9}
                fill={scoreColor(c.compositeScore)}
                opacity={active ? 1 : 0.85}
                stroke="#fff"
                strokeWidth={2}
              />
              <text
                x={x}
                y={PAD.top + trackH + 44}
                textAnchor="middle"
                fill="#fff"
                fontSize={10}
                fontWeight={700}
              >
                {i + 1}
              </text>
              <text
                x={x}
                y={PAD.top + trackH + 70}
                textAnchor="middle"
                className={active ? "fill-slate-700" : "fill-slate-400"}
                fontSize={10.5}
                fontWeight={active ? 700 : 500}
              >
                {active ? c.targetRegion : ""}
              </text>
            </g>
          );
        })}

        {/* Unmapped candidates note */}
        {unmapped.length > 0 && (
          <text x={PAD.left} y={210} className="fill-amber-600" fontSize={11.5}>
            {unmapped.length} candidate{unmapped.length > 1 ? "s" : ""} target{unmapped.length > 1 ? "" : "s"} a non-exonic region (e.g., promoter) —{" "}
            {unmapped.map(({ i }) => `#${i + 1}`).join(", ")}
          </text>
        )}
      </svg>
      <p className="mt-2 text-[11.5px] text-slate-400 italic">
        Hover a numbered dot to see which transcript region it targets. Dots are
        colored by composite score; marker size shows emphasis on hover.
      </p>
    </div>
  );
}
