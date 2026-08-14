"use client";

import { useState } from "react";

interface Hairpin {
  start: number;
  end: number;
  stemLength: number;
  loopSize: number;
  stabilityScore: number;
  type: "hairpin" | "bulge" | "internal_loop";
}

function typeColor(type: string): string {
  if (type === "hairpin") return "#6366f1";
  if (type === "bulge") return "#f59e0b";
  return "#ec4899";
}

function typeBg(type: string): string {
  if (type === "hairpin") return "bg-indigo-50 text-indigo-700";
  if (type === "bulge") return "bg-amber-50 text-amber-700";
  return "bg-pink-50 text-pink-700";
}

function stabilityColor(score: number): string {
  if (score >= 0.7) return "text-red-600";
  if (score >= 0.4) return "text-amber-600";
  return "text-emerald-600";
}

export default function HairpinDiagram({
  hairpins,
  seqLength,
}: {
  hairpins: Hairpin[];
  seqLength: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  if (hairpins.length === 0) {
    return (
      <>
        <p className="text-[14px] font-semibold text-slate-800 mb-3">
          Predicted Secondary Structures
        </p>
        <p className="text-[12px] text-slate-400">
          No significant hairpin structures detected.
        </p>
      </>
    );
  }

  const W = 560;
  const H = 140;
  const PAD = { left: 30, right: 10, top: 10, bottom: 20 };
  const plotW = W - PAD.left - PAD.right;
  const xScale = (pos: number) =>
    PAD.left + (pos / seqLength) * plotW;
  const barY = 30;
  const barH = 14;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          Predicted Secondary Structures
        </p>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: "#6366f1" }}
            />
            Hairpin
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: "#f59e0b" }}
            />
            Bulge
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: "#ec4899" }}
            />
            Internal loop
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* Sequence bar */}
          <rect
            x={PAD.left}
            y={barY}
            width={plotW}
            height={barH}
            rx={3}
            fill="#e2e8f0"
          />

          {/* Hairpin arcs + bars */}
          {hairpins.map((h, i) => {
            const x1 = xScale(h.start);
            const x2 = xScale(h.end);
            const cx = (x1 + x2) / 2;
            const arcH = Math.min(40, h.stemLength * 3 + h.loopSize * 2);
            const color = typeColor(h.type);
            const isSelected = selected === i;

            return (
              <g
                key={i}
                className="cursor-pointer"
                onClick={() => setSelected(isSelected ? null : i)}
              >
                {/* Arc */}
                <path
                  d={`M${x1},${barY + barH} Q${cx},${barY - arcH} ${x2},${barY + barH}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  opacity={isSelected ? 1 : 0.6}
                />
                {/* Start/end markers */}
                <circle
                  cx={x1}
                  cy={barY + barH}
                  r={2.5}
                  fill={color}
                  opacity={0.9}
                />
                <circle
                  cx={x2}
                  cy={barY + barH}
                  r={2.5}
                  fill={color}
                  opacity={0.9}
                />
                {/* Selected highlight */}
                {isSelected && (
                  <rect
                    x={x1}
                    y={barY}
                    width={x2 - x1}
                    height={barH}
                    rx={2}
                    fill={color}
                    opacity={0.15}
                  />
                )}
              </g>
            );
          })}

          {/* X axis */}
          {Array.from({ length: 7 }, (_, i) =>
            Math.round((seqLength * i) / 6)
          ).map((p) => (
            <g key={p}>
              <line
                x1={xScale(p)}
                y1={barY + barH}
                x2={xScale(p)}
                y2={barY + barH + 4}
                stroke="#cbd5e1"
                strokeWidth={0.5}
              />
              <text
                x={xScale(p)}
                y={barY + barH + 14}
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

      {/* Detail card */}
      {selected !== null && hairpins[selected] && (
        <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-slate-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeBg(hairpins[selected].type)}`}
            >
              {hairpins[selected].type.replace("_", " ")}
            </span>
            <span className="text-[11px] text-slate-500">
              {hairpins[selected].start}–{hairpins[selected].end}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">Stem</span>
              <span className="ml-1 font-medium text-slate-700">
                {hairpins[selected].stemLength} bp
              </span>
            </div>
            <div>
              <span className="text-slate-400">Loop</span>
              <span className="ml-1 font-medium text-slate-700">
                {hairpins[selected].loopSize} nt
              </span>
            </div>
            <div>
              <span className="text-slate-400">Stability</span>
              <span
                className={`ml-1 font-medium ${stabilityColor(hairpins[selected].stabilityScore)}`}
              >
                {hairpins[selected].stabilityScore.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["hairpin", "bulge", "internal_loop"] as const).map((type) => {
          const count = hairpins.filter((h) => h.type === type).length;
          return (
            <div key={type} className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-[10px] text-slate-400 capitalize">
                {type.replace("_", " ")}s
              </p>
              <p
                className="text-[15px] font-bold"
                style={{ color: typeColor(type) }}
              >
                {count}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span className="shrink-0 mt-0.5">ℹ</span>
        Composition-based structure prediction. For accurate folding, use
        RNAfold or NUPACK with proper thermodynamic parameters.
      </div>
    </>
  );
}
