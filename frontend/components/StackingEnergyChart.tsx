"use client";

import { useState, useRef } from "react";

interface EnergyPoint {
  position: number;
  energy: number;
}

export default function StackingEnergyChart({ data, seqLength }: { data: EnergyPoint[]; seqLength: number }) {
  const [hover, setHover] = useState<{ x: number; y: number; pos: number; energy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data.length) return null;

  const W = 560;
  const H = 140;
  const PAD = { top: 10, right: 10, bottom: 24, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const energies = data.map((d) => d.energy);
  const minE = Math.min(...energies) - 0.2;
  const maxE = Math.max(...energies) + 0.2;
  const eRange = maxE - minE || 1;

  const xScale = (pos: number) => PAD.left + (pos / seqLength) * plotW;
  const yScale = (e: number) => PAD.top + plotH - ((e - minE) / eRange) * plotH;

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xScale(d.position).toFixed(1)},${yScale(d.energy).toFixed(1)}`)
    .join(" ");

  const areaD =
    pathD +
    ` L${xScale(data[data.length - 1].position).toFixed(1)},${(PAD.top + plotH).toFixed(1)}` +
    ` L${xScale(data[0].position).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minE + (eRange * i) / yTicks);

  const xTicks = 5;
  const xTickValues = Array.from({ length: xTicks + 1 }, (_, i) => Math.round((seqLength * i) / xTicks));

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
      y: yScale(closest.energy),
      pos: closest.position,
      energy: closest.energy,
    });
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Zero line */}
        {minE < 0 && maxE > 0 && (
          <line
            x1={PAD.left}
            y1={yScale(0)}
            x2={W - PAD.right}
            y2={yScale(0)}
            stroke="#94a3b8"
            strokeWidth={0.5}
            strokeDasharray="4,3"
          />
        )}

        {/* Grid lines */}
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

        {/* Area fill */}
        <defs>
          <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#energyGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth={1.5} />

        {/* Hover crosshair */}
        {hover && (
          <>
            <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + plotH} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3" />
            <circle cx={hover.x} cy={hover.y} r={3} fill="#8b5cf6" stroke="#fff" strokeWidth={1.5} />
            <rect x={hover.x + 6} y={hover.y - 22} width={80} height={18} rx={3} fill="#1e293b" opacity={0.9} />
            <text x={hover.x + 10} y={hover.y - 10} fill="#fff" fontSize={9} fontFamily="monospace">
              pos {hover.pos} — {hover.energy.toFixed(3)} kcal
            </text>
          </>
        )}

        {/* Y axis labels */}
        {yTickValues.map((v, i) => (
          <text key={i} x={PAD.left - 4} y={yScale(v) + 3} textAnchor="end" className="fill-black" fontSize={8} fontWeight={700}>
            {v.toFixed(2)}
          </text>
        ))}

        {/* X axis labels */}
        {xTickValues.map((v, i) => (
          <text key={i} x={xScale(v)} y={H - 4} textAnchor="middle" className="fill-black" fontSize={8} fontWeight={700}>
            {v}
          </text>
        ))}
      </svg>
    </div>
  );
}
