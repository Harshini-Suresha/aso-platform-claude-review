"use client";

import { useState, useRef, useEffect } from "react";

interface GcPoint {
  position: number;
  gc: number;
}

export default function GcContentChart({
  data,
  seqLength,
}: {
  data: GcPoint[];
  seqLength: number;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; pos: number; gc: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data.length) return null;

  const W = 600;
  const H = 140;
  const PAD = { top: 10, right: 10, bottom: 24, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const minGc = Math.max(0, data.reduce((min, d) => Math.min(min, d.gc), Infinity) - 5);
  const maxGc = Math.min(100, data.reduce((max, d) => Math.max(max, d.gc), -Infinity) + 5);
  const gcRange = maxGc - minGc || 1;

  const xScale = (pos: number) => PAD.left + (pos / seqLength) * plotW;
  const yScale = (gc: number) => PAD.top + plotH - ((gc - minGc) / gcRange) * plotH;

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xScale(d.position).toFixed(1)},${yScale(d.gc).toFixed(1)}`)
    .join(" ");

  const areaD =
    pathD +
    ` L${xScale(data[data.length - 1].position).toFixed(1)},${(PAD.top + plotH).toFixed(1)}` +
    ` L${xScale(data[0].position).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minGc + (gcRange * i) / yTicks);

  const xTicks = 5;
  const xTickValues = Array.from({ length: xTicks + 1 }, (_, i) => Math.round((seqLength * i) / xTicks));

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    const pos = Math.round(((mx - PAD.left) / plotW) * seqLength);
    const closest = data.reduce((best, d) =>
      Math.abs(d.position - pos) < Math.abs(best.position - pos) ? d : best
    );
    setHover({
      x: xScale(closest.position),
      y: yScale(closest.gc),
      pos: closest.position,
      gc: closest.gc,
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
        {/* Optimal band 40-60% */}
        <rect
          x={PAD.left}
          y={yScale(60)}
          width={plotW}
          height={yScale(40) - yScale(60)}
          fill="#10b981"
          opacity={0.07}
        />
        <text x={PAD.left + 4} y={yScale(60) - 3} className="fill-emerald-400" fontSize={8}>
          60%
        </text>
        <text x={PAD.left + 4} y={yScale(40) + 10} className="fill-emerald-400" fontSize={8}>
          40%
        </text>

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
        <path d={areaD} fill="url(#gcGrad)" opacity={0.3} />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={1.5} />

        {/* Hover crosshair */}
        {hover && (
          <>
            <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + plotH} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3" />
            <line x1={PAD.left} y1={hover.y} x2={W - PAD.right} y2={hover.y} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3" />
            <circle cx={hover.x} cy={hover.y} r={3} fill="#6366f1" stroke="#fff" strokeWidth={1.5} />
            <rect x={hover.x + 6} y={hover.y - 22} width={68} height={18} rx={3} fill="#1e293b" opacity={0.9} />
            <text x={hover.x + 10} y={hover.y - 10} fill="#fff" fontSize={9} fontFamily="monospace">
              pos {hover.pos} — {hover.gc.toFixed(1)}%
            </text>
          </>
        )}

        {/* Y axis labels */}
        {yTickValues.map((v, i) => (
          <text key={i} x={PAD.left - 4} y={yScale(v) + 3} textAnchor="end" className="fill-black" fontSize={8} fontWeight={700}>
            {Math.round(v)}%
          </text>
        ))}

        {/* X axis labels */}
        {xTickValues.map((v, i) => (
          <text key={i} x={xScale(v)} y={H - 4} textAnchor="middle" className="fill-black" fontSize={8} fontWeight={700}>
            {v}
          </text>
        ))}

        {/* Gradient def */}
        <defs>
          <linearGradient id="gcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
