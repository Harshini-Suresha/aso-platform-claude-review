"use client";

import { useState, useRef } from "react";

interface KmerData {
  k: number;
  totalKmers: number;
  uniqueKmers: number;
  repeats: { kmer: string; count: number; positions: number[] }[];
  shannonEntropy: number;
}

export default function KmerFrequencyChart({
  kmerData,
}: {
  kmerData: KmerData;
}) {
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    kmer: string;
    count: number;
    pct: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 560;
  const H = 160;
  const PAD = { top: 10, right: 10, bottom: 30, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const barData = kmerData.repeats
    .filter((r) => r.count > 1)
    .slice(0, 30)
    .map((r) => ({
      kmer: r.kmer,
      count: r.count,
      pct: (r.count / kmerData.totalKmers) * 100,
    }));

  const maxCount = Math.max(...barData.map((d) => d.count), 1);
  const barW = Math.max(4, Math.min(14, plotW / Math.max(barData.length, 1) - 2));
  const gap = 2;

  const entropyColor =
    kmerData.shannonEntropy >= 3.0
      ? "text-emerald-600 bg-emerald-50"
      : kmerData.shannonEntropy >= 2.0
      ? "text-amber-600 bg-amber-50"
      : "text-red-600 bg-red-50";

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          {kmerData.k}-mer Frequency Analysis
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${entropyColor}`}
          >
            Shannon H = {kmerData.shannonEntropy.toFixed(2)} bits
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Total {kmerData.k}-mers</p>
          <p className="text-[14px] font-bold text-slate-700">
            {kmerData.totalKmers.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Unique</p>
          <p className="text-[14px] font-bold text-slate-700">
            {kmerData.uniqueKmers.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Repeated</p>
          <p
            className={`text-[14px] font-bold ${
              kmerData.repeats.filter((r) => r.count > 2).length > 0
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          >
            {kmerData.repeats.filter((r) => r.count > 1).length}
          </p>
        </div>
      </div>

      {barData.length > 0 ? (
        <div className="w-full overflow-x-auto">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            onMouseMove={(e) => {
              const svg = svgRef.current;
              if (!svg) return;
              const rect = svg.getBoundingClientRect();
              const mx = ((e.clientX - rect.left) / rect.width) * W;
              const idx = Math.floor((mx - PAD.left) / (barW + gap));
              if (idx >= 0 && idx < barData.length) {
                const d = barData[idx];
                setHover({
                  x: PAD.left + idx * (barW + gap) + barW / 2,
                  y:
                    PAD.top +
                    plotH -
                    (d.count / maxCount) * plotH,
                  kmer: d.kmer,
                  count: d.count,
                  pct: d.pct,
                });
              } else {
                setHover(null);
              }
            }}
            onMouseLeave={() => setHover(null)}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <line
                key={v}
                x1={PAD.left}
                y1={PAD.top + plotH - v * plotH}
                x2={W - PAD.right}
                y2={PAD.top + plotH - v * plotH}
                stroke="#e2e8f0"
                strokeWidth={0.5}
              />
            ))}

            {/* Bars */}
            {barData.map((d, i) => {
              const x = PAD.left + i * (barW + gap);
              const h = (d.count / maxCount) * plotH;
              const color =
                d.count >= 5
                  ? "#ef4444"
                  : d.count >= 3
                  ? "#f59e0b"
                  : "#6366f1";
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={PAD.top + plotH - h}
                    width={barW}
                    height={h}
                    rx={1}
                    fill={color}
                    opacity={0.8}
                  />
                  {/* Label */}
                  {barW >= 6 && (
                    <text
                      x={x + barW / 2}
                      y={PAD.top + plotH + 10}
                      textAnchor="middle"
                      className="fill-black"
                      fontSize={7}
                      fontWeight={700}
                      transform={`rotate(-45, ${x + barW / 2}, ${
                        PAD.top + plotH + 10
                      })`}
                    >
                      {d.kmer}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Y axis labels */}
            {[0, 0.5, 1].map((v) => (
              <text
                key={v}
                x={PAD.left - 4}
                y={PAD.top + plotH - v * plotH + 3}
                textAnchor="end"
                className="fill-black"
                fontSize={8}
                fontWeight={700}
              >
                {Math.round(v * maxCount)}
              </text>
            ))}

            {/* Hover tooltip */}
            {hover && (
              <>
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
                  y={hover.y - 28}
                  width={100}
                  height={22}
                  rx={3}
                  fill="#1e293b"
                  opacity={0.9}
                />
                <text
                  x={hover.x + 10}
                  y={hover.y - 13}
                  fill="#fff"
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {hover.kmer}: {hover.count}× ({hover.pct.toFixed(2)}%)
                </text>
              </>
            )}
          </svg>
        </div>
      ) : (
        <p className="text-[12px] text-slate-400">
          No repeated {kmerData.k}-mers detected.
        </p>
      )}

      {/* Top repeated kmers table */}
      {kmerData.repeats.filter((r) => r.count > 1).length > 0 && (
        <div className="mt-3 max-h-28 overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-1 font-medium">K-mer</th>
                <th className="pb-1 font-medium">Count</th>
                <th className="pb-1 font-medium">Positions</th>
              </tr>
            </thead>
            <tbody>
              {kmerData.repeats
                .filter((r) => r.count > 1)
                .slice(0, 8)
                .map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-0.5 font-mono font-medium text-slate-600">
                      {r.kmer}
                    </td>
                    <td className="py-0.5 text-slate-600">{r.count}×</td>
                    <td className="py-0.5 text-slate-500">
                      {r.positions.slice(0, 4).join(", ")}
                      {r.positions.length > 4 ? "…" : ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span className="shrink-0 mt-0.5">ℹ</span>
        Shannon entropy quantifies sequence complexity. Higher values indicate
        more uniform k-mer distribution (desirable for therapeutic oligos).
      </div>
    </>
  );
}
