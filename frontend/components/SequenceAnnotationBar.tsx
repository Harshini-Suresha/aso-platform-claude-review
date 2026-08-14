"use client";

import { useState } from "react";

interface Annotation {
  id: string;
  label: string;
  start: number;
  end: number;
  type: "restriction" | "mirna" | "immune" | "orfs" | "complexity" | "structure";
}

const TYPE_COLORS: Record<string, string> = {
  restriction: "#6366f1",
  mirna: "#8b5cf6",
  immune: "#f59e0b",
  orfs: "#3b82f6",
  complexity: "#ef4444",
  structure: "#10b981",
};

export default function SequenceAnnotationBar({
  annotations,
  seqLength,
}: {
  annotations: Annotation[];
  seqLength: number;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  if (annotations.length === 0) {
    return (
      <>
        <p className="text-[14px] font-semibold text-slate-800 mb-3">
          Sequence Annotation Overview
        </p>
        <p className="text-[12px] text-slate-400">
          No annotations to display.
        </p>
      </>
    );
  }

  const W = 560;
  const H = 120;
  const PAD = { left: 30, right: 10, top: 10, bottom: 20 };
  const plotW = W - PAD.left - PAD.right;
  const xScale = (pos: number) =>
    PAD.left + (pos / seqLength) * plotW;

  const types = [...new Set(annotations.map((a) => a.type))];
  const filtered = filter
    ? annotations.filter((a) => a.type === filter)
    : annotations;

  // Group annotations into rows to avoid overlap
  const ROW_H = 10;
  const rows: Annotation[][] = [];
  for (const ann of filtered) {
    let placed = false;
    for (const row of rows) {
      const lastEnd = row[row.length - 1].end;
      if (ann.start > lastEnd + seqLength * 0.005) {
        row.push(ann);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([ann]);
  }

  const barY = 20;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          Sequence Annotation Overview
        </p>
        <span className="text-[10px] text-slate-400">
          {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
            filter === null
              ? "bg-brand text-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          All
        </button>
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              filter === type
                ? "text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            style={
              filter === type
                ? { backgroundColor: TYPE_COLORS[type] }
                : undefined
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[type] }}
            />
            {type.charAt(0).toUpperCase() + type.slice(1)}
            <span className="opacity-60">
              ({annotations.filter((a) => a.type === type).length})
            </span>
          </button>
        ))}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Sequence backbone */}
          <rect
            x={PAD.left}
            y={barY}
            width={plotW}
            height={6}
            rx={3}
            fill="#e2e8f0"
          />

          {/* Annotation rows */}
          {rows.map((row, ri) => {
            const yOff = barY + 10 + ri * (ROW_H + 2);
            return row.map((ann, ai) => {
              const x1 = xScale(ann.start);
              const x2 = xScale(ann.end);
              const w = Math.max(x2 - x1, 3);
              const color = TYPE_COLORS[ann.type];
              return (
                <rect
                  key={`${ri}-${ai}`}
                  x={x1}
                  y={yOff}
                  width={w}
                  height={ROW_H}
                  rx={2}
                  fill={color}
                  opacity={0.7}
                  className="cursor-pointer"
                  onMouseEnter={(e) =>
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      text: `${ann.label} (${ann.type}) @ ${ann.start}–${ann.end}`,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            });
          })}

          {/* X axis */}
          {Array.from({ length: 7 }, (_, i) =>
            Math.round((seqLength * i) / 6)
          ).map((p) => (
            <g key={p}>
              <line
                x1={xScale(p)}
                y1={barY + 6}
                x2={xScale(p)}
                y2={barY + 8}
                stroke="#cbd5e1"
                strokeWidth={0.5}
              />
              <text
                x={xScale(p)}
                y={barY + rows.length * (ROW_H + 2) + 16}
                textAnchor="middle"
                className="fill-slate-400"
                fontSize={8}
              >
                {p}
              </text>
            </g>
          ))}
        </svg>
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
