"use client";

import { useRef, useState } from "react";
import { AssoCandidate, HeuristicEstimates } from "@/types/geneSilencing";

interface MetricDef {
  key: keyof HeuristicEstimates;
  label: string;
  color: string;
  direction: "higher-better" | "higher-worse";
  blurb: string;
}

const METRICS: MetricDef[] = [
  { key: "nucleaseResistance", label: "Nuclease Resistance", color: "#2563EB", direction: "higher-better", blurb: "Serum stability" },
  { key: "cellularUptake", label: "Cellular Uptake", color: "#0F766E", direction: "higher-better", blurb: "Cell penetration" },
  { key: "bbbCrossing", label: "BBB Crossing", color: "#7C3AED", direction: "higher-better", blurb: "CNS access" },
  { key: "synthesisDifficulty", label: "Synthesis Difficulty", color: "#F59E0B", direction: "higher-worse", blurb: "Manufacturing" },
  { key: "offTargetRisk", label: "Off-target Risk", color: "#DC2626", direction: "higher-worse", blurb: "Specificity" },
  { key: "immuneStimulation", label: "Immune Stimulation", color: "#F43F5E", direction: "higher-worse", blurb: "TLR activation" },
];

function MiniBarChart({
  metric,
  candidates,
}: {
  metric: MetricDef;
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  const W = 280;
  const H = 190;
  const PAD = { top: 16, right: 8, bottom: 26, left: 34 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const slot = plotW / n;
  const barW = Math.min(22, slot * 0.55);
  const yScale = (v: number) => PAD.top + plotH - (v / 100) * plotH;
  const avg =
    candidates.reduce((s, c) => s + c.heuristicEstimates[metric.key].value, 0) / n;

  function handleMove(e: React.MouseEvent) {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(
      0,
      Math.min(n - 1, Math.floor((mx - PAD.left) / slot))
    );
    setHover(idx);
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="#e2e8f0" strokeWidth={0.7} />
            <text x={PAD.left - 4} y={yScale(v) + 3.5} textAnchor="end" className="fill-black" fontSize={9} fontWeight={700}>
              {v}
            </text>
          </g>
        ))}
        {candidates.map((c, i) => {
          const v = c.heuristicEstimates[metric.key].value;
          const x = PAD.left + i * slot + slot / 2 - barW / 2;
          const y = yScale(v);
          const active = hover === i;
          return (
            <g key={c.sequence}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={PAD.top + plotH - y}
                rx={3}
                fill={metric.color}
                opacity={active ? 1 : v >= 70 ? 0.9 : 0.7}
              />
              {active && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-slate-700" fontSize={9.5} fontWeight={700}>
                  #{i + 1} {Math.round(v)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
        <span>Avg {Math.round(avg)}/100</span>
        <span className="text-slate-300">{metric.blurb}</span>
      </div>
    </div>
  );
}

export default function HeuristicComparisonChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  if (!candidates.length) return null;
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((m) => (
          <div key={m.key}>
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <p className="truncate text-[12px] font-semibold text-slate-700">{m.label}</p>
              <span
                className={`shrink-0 rounded px-1 py-px text-[9px] font-semibold ${
                  m.direction === "higher-better" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                }`}
              >
                {m.direction === "higher-better" ? "higher = better" : "higher = worse"}
              </span>
            </div>
            <MiniBarChart metric={m} candidates={candidates} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] text-slate-400 italic">
        Heuristic estimates from chemistry/length rules of thumb — informational only, excluded from ranking.
      </p>
    </div>
  );
}
