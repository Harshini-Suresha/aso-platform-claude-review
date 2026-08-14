"use client";

import { useState } from "react";

interface DotPlotPoint {
  x: number;
  y: number;
  matchLen: number;
}

export default function BasePairDotPlot({
  points,
  seqLength,
}: {
  points: DotPlotPoint[];
  seqLength: number;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const W = 280;
  const H = 280;
  const PAD = { left: 30, right: 10, top: 10, bottom: 30 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const xScale = (pos: number) =>
    PAD.left + (pos / seqLength) * plotW;
  const yScale = (pos: number) =>
    PAD.top + plotH - (pos / seqLength) * plotH;

  const maxMatch = Math.max(...points.map((p) => p.matchLen), 1);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          Self-Complementarity Dot Plot
        </p>
        <span className="text-[10px] text-slate-400">
          {points.length} match{points.length !== 1 ? "es" : ""} · k=6
        </span>
      </div>

      <div className="flex items-start gap-5">
        <div
          className="shrink-0"
          onMouseLeave={() => setTooltip(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[240px] w-[240px]"
          >
            {/* Grid */}
            <line
              x1={PAD.left}
              y1={PAD.top}
              x2={PAD.left}
              y2={PAD.top + plotH}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
            <line
              x1={PAD.left}
              y1={PAD.top + plotH}
              x2={PAD.left + plotW}
              y2={PAD.top + plotH}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />

            {/* Diagonal line */}
            <line
              x1={xScale(0)}
              y1={yScale(0)}
              x2={xScale(seqLength)}
              y2={yScale(seqLength)}
              stroke="#e2e8f0"
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />

            {/* Off-diagonal dots (exclude diagonal) */}
            {points
              .filter((p) => Math.abs(p.x - p.y) > 3)
              .map((p, i) => {
                const size = 1 + (p.matchLen / maxMatch) * 4;
                const opacity = 0.3 + (p.matchLen / maxMatch) * 0.7;
                return (
                  <circle
                    key={i}
                    cx={xScale(p.x)}
                    cy={yScale(p.y)}
                    r={size}
                    fill="#6366f1"
                    opacity={opacity}
                    className="cursor-pointer"
                    onMouseEnter={(e) =>
                      setTooltip({
                        x: e.clientX,
                        y: e.clientY,
                        text: `Match: pos ${p.x}↔${p.y} (${p.matchLen} bp)`,
                      })
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}

            {/* Axis labels */}
            {[0, 0.5, 1].map((v) => (
              <text
                key={`x-${v}`}
                x={xScale(v * seqLength)}
                y={H - 6}
                textAnchor="middle"
                className="fill-slate-400"
                fontSize={8}
              >
                {Math.round(v * seqLength)}
              </text>
            ))}
            {[0, 0.5, 1].map((v) => (
              <text
                key={`y-${v}`}
                x={PAD.left - 4}
                y={yScale(v * seqLength) + 3}
                textAnchor="end"
                className="fill-slate-400"
                fontSize={8}
              >
                {Math.round(v * seqLength)}
              </text>
            ))}

            {/* Axis titles */}
            <text
              x={PAD.left + plotW / 2}
              y={H - 0}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize={8}
            >
              Position
            </text>
            <text
              x={2}
              y={PAD.top + plotH / 2}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize={8}
              transform={`rotate(-90, 6, ${PAD.top + plotH / 2})`}
            >
              Position
            </text>
          </svg>
        </div>

        {/* Summary stats */}
        <div className="flex-1 space-y-3 min-w-[140px]">
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-[10px] text-slate-400">Off-diagonal Matches</p>
            <p className="text-[18px] font-bold text-slate-800 mt-0.5">
              {points.filter((p) => Math.abs(p.x - p.y) > 3).length}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-[10px] text-slate-400">Avg Match Length</p>
            <p className="text-[18px] font-bold text-slate-800 mt-0.5">
              {points.length > 0
                ? (
                    points.reduce((s, p) => s + p.matchLen, 0) / points.length
                  ).toFixed(1)
                : "—"}{" "}
              bp
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-[10px] text-slate-400">Longest Match</p>
            <p className="text-[18px] font-bold text-slate-800 mt-0.5">
              {Math.max(...points.map((p) => p.matchLen), 0)} bp
            </p>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Off-diagonal dots indicate potential self-dimers or hairpin
            structures.
          </p>
        </div>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-white shadow-lg"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}
