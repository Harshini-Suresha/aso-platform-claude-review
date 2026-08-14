"use client";

import { useState } from "react";

interface ModificationLandscapePoint {
  position: number;
  accessibilityScore: number;
  recommendedModification: string;
  confidenceLevel: "high" | "medium" | "low";
}

const MOD_COLORS: Record<string, string> = {
  LNA: "#6366f1",
  "2'-OMe": "#8b5cf6",
  "2'-MOE": "#a78bfa",
  PMO: "#3b82f6",
  PS: "#ec4899",
  UNA: "#f59e0b",
  default: "#64748b",
};

function getModColor(mod: string): string {
  for (const [key, color] of Object.entries(MOD_COLORS)) {
    if (mod.toUpperCase().includes(key.toUpperCase())) return color;
  }
  return MOD_COLORS.default;
}

function confidenceColor(level: string): string {
  if (level === "high") return "bg-emerald-100 text-emerald-700";
  if (level === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function ModificationLandscapeCard({
  landscape,
  seqLength,
}: {
  landscape: ModificationLandscapePoint[];
  seqLength: number;
}) {
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    pos: number;
    score: number;
    mod: string;
    conf: string;
  } | null>(null);

  if (landscape.length === 0) {
    return (
      <>
        <p className="text-[14px] font-semibold text-slate-800 mb-3">
          Modification Landscape
        </p>
        <p className="text-[12px] text-slate-400">
          Insufficient sequence length for modification mapping.
        </p>
      </>
    );
  }

  const W = 560;
  const H = 120;
  const PAD = { top: 10, right: 10, bottom: 24, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xScale = (pos: number) =>
    PAD.left + (pos / seqLength) * plotW;
  const yScale = (score: number) =>
    PAD.top + plotH - score * plotH;

  const pathD = landscape
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"}${xScale(d.position).toFixed(1)},${yScale(d.accessibilityScore).toFixed(1)}`
    )
    .join(" ");

  const areaD =
    pathD +
    ` L${xScale(landscape[landscape.length - 1].position).toFixed(1)},${(PAD.top + plotH).toFixed(1)}` +
    ` L${xScale(landscape[0].position).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => i / yTicks);
  const xTicks = 5;
  const xTickValues = Array.from(
    { length: xTicks + 1 },
    (_, i) => Math.round((seqLength * i) / xTicks)
  );

  const uniqueMods = [...new Set(landscape.map((l) => l.recommendedModification))];

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          Modification Landscape
        </p>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {uniqueMods.slice(0, 5).map((mod) => (
            <span
              key={mod}
              className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 font-medium text-slate-600"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getModColor(mod) }}
              />
              {mod}
            </span>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseMove={(e) => {
            const svg = e.currentTarget;
            const rect = svg.getBoundingClientRect();
            const mx = ((e.clientX - rect.left) / rect.width) * W;
            const pos = Math.round(((mx - PAD.left) / plotW) * seqLength);
            const closest = landscape.reduce((best, d) =>
              Math.abs(d.position - pos) < Math.abs(best.position - pos)
                ? d
                : best
            );
            setHover({
              x: xScale(closest.position),
              y: yScale(closest.accessibilityScore),
              pos: closest.position,
              score: closest.accessibilityScore,
              mod: closest.recommendedModification,
              conf: closest.confidenceLevel,
            });
          }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Grid */}
          {yTickValues.map((v) => (
            <line
              key={v}
              x1={PAD.left}
              y1={yScale(v)}
              x2={W - PAD.right}
              y2={yScale(v)}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
          ))}

          {/* Area fill */}
          <defs>
            <linearGradient
              id="modLandGrad"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#modLandGrad)" />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#6366f1"
            strokeWidth={1.5}
          />

          {/* Hover */}
          {hover && (
            <>
              <line
                x1={hover.x}
                y1={PAD.top}
                x2={hover.x}
                y2={PAD.top + plotH}
                stroke="#94a3b8"
                strokeWidth={0.5}
                strokeDasharray="3,3"
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={3}
                fill="#6366f1"
                stroke="#fff"
                strokeWidth={1.5}
              />
              <rect
                x={hover.x + 6}
                y={hover.y - 35}
                width={140}
                height={28}
                rx={3}
                fill="#1e293b"
                opacity={0.9}
              />
              <text
                x={hover.x + 10}
                y={hover.y - 21}
                fill="#fff"
                fontSize={9}
                fontFamily="monospace"
              >
                pos {hover.pos} — {hover.mod}
              </text>
              <text
                x={hover.x + 10}
                y={hover.y - 10}
                fill="#cbd5e1"
                fontSize={8}
              >
                access: {hover.score.toFixed(2)} · {hover.conf}
              </text>
            </>
          )}

          {/* Y axis */}
          {yTickValues.map((v) => (
            <text
              key={v}
              x={PAD.left - 4}
              y={yScale(v) + 3}
              textAnchor="end"
              className="fill-slate-400"
              fontSize={8}
            >
              {v.toFixed(1)}
            </text>
          ))}

          {/* X axis */}
          {xTickValues.map((v) => (
            <text
              key={v}
              x={xScale(v)}
              y={H - 4}
              textAnchor="middle"
              className="fill-slate-400"
              fontSize={8}
            >
              {v}
            </text>
          ))}
        </svg>
      </div>

      {/* Confidence legend */}
      <div className="mt-2 flex gap-3 text-[10px]">
        {(["high", "medium", "low"] as const).map((level) => (
          <span
            key={level}
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${confidenceColor(level)}`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)} confidence
          </span>
        ))}
      </div>

      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span className="shrink-0 mt-0.5">ℹ</span>
        Accessibility scores estimate local RNA structural accessibility for
        antisense binding. Modifications are heuristic recommendations.
      </div>
    </>
  );
}
