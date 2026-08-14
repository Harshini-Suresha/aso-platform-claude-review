"use client";

import { useState, useRef } from "react";

interface StabilityIndexPoint {
  position: number;
  rnaseH: number;
  duplexStability: number;
  singleStrandStability: number;
}

const SERIES = [
  {
    key: "rnaseH" as const,
    label: "RNase H Susceptibility",
    color: "#6366f1",
  },
  {
    key: "duplexStability" as const,
    label: "Duplex Stability",
    color: "#10b981",
  },
  {
    key: "singleStrandStability" as const,
    label: "Single-Strand Stability",
    color: "#f59e0b",
  },
];

export default function StabilityIndexChart({
  data,
  seqLength,
}: {
  data: StabilityIndexPoint[];
  seqLength: number;
}) {
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    pos: number;
    values: Record<string, number>;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data.length) {
    return (
      <>
        <p className="text-[14px] font-semibold text-slate-800 mb-3">
          Stability Index
        </p>
        <p className="text-[12px] text-slate-400">
          Insufficient data for stability index calculation.
        </p>
      </>
    );
  }

  const W = 560;
  const H = 160;
  const PAD = { top: 10, right: 10, bottom: 24, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const allVals = data.flatMap((d) => [
    d.rnaseH,
    d.duplexStability,
    d.singleStrandStability,
  ]);
  const minV = Math.min(...allVals) - 0.05;
  const maxV = Math.max(...allVals) + 0.05;
  const range = maxV - minV || 1;

  const xScale = (pos: number) =>
    PAD.left + (pos / seqLength) * plotW;
  const yScale = (v: number) =>
    PAD.top + plotH - ((v - minV) / range) * plotH;

  const yTicks = 5;
  const yTickValues = Array.from(
    { length: yTicks + 1 },
    (_, i) => minV + (range * i) / yTicks
  );
  const xTicks = 5;
  const xTickValues = Array.from(
    { length: xTicks + 1 },
    (_, i) => Math.round((seqLength * i) / xTicks)
  );

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const pos = Math.round(((mx - PAD.left) / plotW) * seqLength);
    const closest = data.reduce((best, d) =>
      Math.abs(d.position - pos) < Math.abs(best.position - pos) ? d : best
    );
    setHover({
      x: xScale(closest.position),
      y: yScale(closest.rnaseH),
      pos: closest.position,
      values: {
        rnaseH: closest.rnaseH,
        duplexStability: closest.duplexStability,
        singleStrandStability: closest.singleStrandStability,
      },
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          Stability Index
        </p>
        <div className="flex items-center gap-2 text-[10px]">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>

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
            <line
              key={i}
              x1={PAD.left}
              y1={yScale(v)}
              x2={W - PAD.right}
              y2={yScale(v)}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
          ))}

          {/* Lines */}
          {SERIES.map((s) => {
            const pathD = data
              .map(
                (d, i) =>
                  `${i === 0 ? "M" : "L"}${xScale(d.position).toFixed(1)},${yScale(d[s.key]).toFixed(1)}`
              )
              .join(" ");
            return (
              <path
                key={s.key}
                d={pathD}
                fill="none"
                stroke={s.color}
                strokeWidth={1.5}
                opacity={0.8}
              />
            );
          })}

          {/* Hover crosshair */}
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
              <rect
                x={hover.x + 6}
                y={PAD.top}
                width={130}
                height={52}
                rx={3}
                fill="#1e293b"
                opacity={0.92}
              />
              <text
                x={hover.x + 10}
                y={PAD.top + 12}
                fill="#cbd5e1"
                fontSize={8}
              >
                Position: {hover.pos}
              </text>
              {SERIES.map((s, i) => (
                <text
                  key={s.key}
                  x={hover.x + 10}
                  y={PAD.top + 22 + i * 12}
                  fill="#fff"
                  fontSize={8}
                  fontFamily="monospace"
                >
                  <tspan fill={s.color}>●</tspan>{" "}
                  {s.label.split(" ")[0]}:{" "}
                  {hover.values[s.key].toFixed(3)}
                </text>
              ))}
            </>
          )}

          {/* Y axis */}
          {yTickValues.map((v, i) => (
            <text
              key={i}
              x={PAD.left - 4}
              y={yScale(v) + 3}
              textAnchor="end"
              className="fill-black"
              fontSize={8}
              fontWeight={700}
            >
              {v.toFixed(2)}
            </text>
          ))}

          {/* X axis */}
          {xTickValues.map((v) => (
            <text
              key={v}
              x={xScale(v)}
              y={H - 4}
              textAnchor="middle"
              className="fill-black"
              fontSize={8}
              fontWeight={700}
            >
              {v}
            </text>
          ))}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Avg RNase H</p>
          <p className="text-[13px] font-bold text-slate-700">
            {(
              data.reduce((s, d) => s + d.rnaseH, 0) / data.length
            ).toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Avg Duplex</p>
          <p className="text-[13px] font-bold text-slate-700">
            {(
              data.reduce((s, d) => s + d.duplexStability, 0) / data.length
            ).toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Avg Single-Strand</p>
          <p className="text-[13px] font-bold text-slate-700">
            {(
              data.reduce((s, d) => s + d.singleStrandStability, 0) /
              data.length
            ).toFixed(3)}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span className="shrink-0 mt-0.5">ℹ</span>
        Stability indices are sliding-window GC/stacking-energy proxies. RNase H
        susceptibility indicates where an ASO-DNA heteroduplex is most likely to
        recruit RNase H.
      </div>
    </>
  );
}
