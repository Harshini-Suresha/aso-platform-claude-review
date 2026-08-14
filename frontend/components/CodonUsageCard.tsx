"use client";

import { useState, useRef, useEffect } from "react";

interface CodonInfo {
  codon: string;
  position: number;
  adaptiveness: number;
  isRare: boolean;
}

interface CodonUsage {
  codons: CodonInfo[];
  cai: number;
  rareCodons: { codon: string; position: number; adaptiveness: number }[];
  totalCodons: number;
  note: string;
}

function adaptivenessColor(a: number): string {
  if (a >= 0.7) return "bg-emerald-500";
  if (a >= 0.4) return "bg-amber-400";
  return "bg-red-400";
}

function adaptivenessLabel(a: number): string {
  if (a >= 0.7) return "Common";
  if (a >= 0.4) return "Moderate";
  return "Rare";
}

export default function CodonUsageCard({ codonUsage }: { codonUsage: CodonUsage }) {
  const [hovered, setHovered] = useState<{ x: number; y: number; info: CodonInfo } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (codonUsage.totalCodons === 0) {
    return (
      <>
        <p className="text-[14px] font-semibold text-slate-800 mb-3">Codon Usage</p>
        <p className="text-[12px] text-slate-400">No coding region detected for codon analysis.</p>
      </>
    );
  }

  const codons = codonUsage.codons;
  const W = 560;
  const H = 120;
  const PAD = { top: 10, right: 10, bottom: 20, left: 30 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const barW = Math.max(2, Math.min(12, plotW / codons.length - 1));
  const gap = barW < 6 ? 1 : 2;

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.floor((mx - PAD.left) / (barW + gap));
    if (idx >= 0 && idx < codons.length) {
      setHovered({
        x: PAD.left + idx * (barW + gap) + barW / 2,
        y: PAD.top + plotH - codons[idx].adaptiveness * plotH,
        info: codons[idx],
      });
    } else {
      setHovered(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">Codon Usage</p>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Common</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" /> Moderate</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400" /> Rare</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Grid lines */}
          {[0, 0.5, 1].map((v) => (
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
          {codons.map((c, i) => {
            const x = PAD.left + i * (barW + gap);
            const h = c.adaptiveness * plotH;
            return (
              <rect
                key={i}
                x={x}
                y={PAD.top + plotH - h}
                width={barW}
                height={h}
                rx={1}
                fill={c.isRare ? "#ef4444" : c.adaptiveness >= 0.7 ? "#10b981" : "#f59e0b"}
                opacity={0.85}
              />
            );
          })}

          {/* Y axis labels */}
          {[0, 0.5, 1].map((v) => (
            <text
              key={v}
              x={PAD.left - 4}
              y={PAD.top + plotH - v * plotH + 3}
              textAnchor="end"
              className="fill-slate-400"
              fontSize={8}
            >
              {v.toFixed(1)}
            </text>
          ))}

          {/* Hover tooltip */}
          {hovered && (
            <>
              <line x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={PAD.top + plotH} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3" />
              <circle cx={hovered.x} cy={hovered.y} r={3} fill="#6366f1" stroke="#fff" strokeWidth={1.5} />
              <rect x={hovered.x + 6} y={hovered.y - 30} width={110} height={24} rx={3} fill="#1e293b" opacity={0.9} />
              <text x={hovered.x + 10} y={hovered.y - 14} fill="#fff" fontSize={9} fontFamily="monospace">
                {hovered.info.codon} — {hovered.info.adaptiveness.toFixed(2)} ({adaptivenessLabel(hovered.info.adaptiveness)})
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">CAI</p>
          <p className={`text-[15px] font-bold ${codonUsage.cai >= 0.7 ? "text-emerald-600" : codonUsage.cai >= 0.4 ? "text-amber-600" : "text-red-600"}`}>
            {codonUsage.cai.toFixed(3)}
          </p>
          <p className="text-[9px] text-slate-400">0-1 scale</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Total Codons</p>
          <p className="text-[15px] font-bold text-slate-700">{codonUsage.totalCodons}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Rare Codons</p>
          <p className={`text-[15px] font-bold ${codonUsage.rareCodons.length > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {codonUsage.rareCodons.length}
          </p>
        </div>
      </div>

      {codonUsage.rareCodons.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          <span className="font-semibold">Rare codons detected:</span>{" "}
          {codonUsage.rareCodons.slice(0, 8).map((r, i) => (
            <span key={i} className="font-mono">{r.codon} (pos {r.position}){i < Math.min(codonUsage.rareCodons.length, 8) - 1 ? ", " : ""}</span>
          ))}
          {codonUsage.rareCodons.length > 8 && ` +${codonUsage.rareCodons.length - 8} more`}
        </div>
      )}

      <p className="mt-2 text-[10px] text-slate-400">{codonUsage.note}</p>
    </>
  );
}
