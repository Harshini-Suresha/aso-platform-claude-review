"use client";

import { useRef, useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

function MiniBar({
  candidates,
  get,
  fmt,
  color,
  label,
  unit,
}: {
  candidates: AssoCandidate[];
  get: (c: AssoCandidate) => number;
  fmt: (v: number) => string;
  color: string;
  label: string;
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  const W = 340;
  const H = 190;
  const PAD = { top: 16, right: 8, bottom: 28, left: 8 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = candidates.map(get);
  const max = Math.max(...values, 1);
  const slot = plotW / n;
  const barW = Math.min(24, slot * 0.55);
  const yScale = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const avg = values.reduce((s, v) => s + v, 0) / n;

  function handleMove(e: React.MouseEvent) {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(n - 1, Math.floor((mx - PAD.left) / slot)));
    setHover(idx);
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <p className="text-[12px] font-semibold text-slate-700">{label}</p>
        <span className="text-[10px] text-slate-400">{unit}</span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {candidates.map((c, i) => {
          const v = values[i];
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
                fill={color}
                opacity={active ? 1 : 0.85}
              />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-slate-700" fontSize={9.5} fontWeight={700}>
                {fmt(v)}
              </text>
              {active && (
                <text x={x + barW / 2} y={H - PAD.bottom + 16} textAnchor="middle" className="fill-black" fontSize={10.5} fontWeight={700}>
                  #{i + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
        <span>Avg {fmt(avg)}</span>
        <span>{n} candidates</span>
      </div>
    </div>
  );
}

export default function PhysicochemicalChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  if (!candidates.length) return null;
  return (
    <div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MiniBar
          candidates={candidates}
          get={(c) => c.realMetrics.molecularWeight}
          fmt={(v) => v.toLocaleString()}
          color="#0F766E"
          label="Molecular weight"
          unit="Da"
        />
        <MiniBar
          candidates={candidates}
          get={(c) => c.realMetrics.extinctionCoefficient}
          fmt={(v) => v.toLocaleString()}
          color="#7C3AED"
          label="Molar extinction coefficient (ε₂₆₀)"
          unit="L/mol·cm"
        />
      </div>
      <div className="mt-3 space-y-1 text-[11.5px] leading-relaxed text-slate-400">
        <p>
          Molecular weight is the sum of nucleotide masses minus water for each
          phosphodiester bond; ε₂₆₀ uses the nearest-neighbor method for UV
          absorbance at 260 nm. Larger ε means the oligo absorbs more per mole —
          relevant for quantification.
        </p>
      </div>
    </div>
  );
}
