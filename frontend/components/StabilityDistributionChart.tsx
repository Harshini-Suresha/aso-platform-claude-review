"use client";

import { AssoCandidate } from "@/types/geneSilencing";

interface Slice {
  label: string;
  count: number;
  color: string;
}

function Donut({
  slices,
  centerLabel,
  size = 200,
}: {
  slices: Slice[];
  centerLabel: string;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  if (total === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 12;
  const r = R * 0.55;

  let acc = 0;
  const arcs = slices.map((s) => {
    const start = acc;
    acc += s.count / total;
    return { ...s, start, end: acc };
  });

  function arcPath(s: number, e: number, outerR: number, innerR: number) {
    const s1 = s * 2 * Math.PI - Math.PI / 2;
    const e1 = e * 2 * Math.PI - Math.PI / 2;
    const large = e - s > 0.5 ? 1 : 0;
    const x1 = cx + outerR * Math.cos(s1);
    const y1 = cy + outerR * Math.sin(s1);
    const x2 = cx + outerR * Math.cos(e1);
    const y2 = cy + outerR * Math.sin(e1);
    const x3 = cx + innerR * Math.cos(e1);
    const y3 = cy + innerR * Math.sin(e1);
    const x4 = cx + innerR * Math.cos(s1);
    const y4 = cy + innerR * Math.sin(s1);
    return [
      `M${x1.toFixed(1)},${y1.toFixed(1)}`,
      `A${outerR},${outerR} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`,
      `L${x3.toFixed(1)},${y3.toFixed(1)}`,
      `A${innerR},${innerR} 0 ${large} 0 ${x4.toFixed(1)},${y4.toFixed(1)}`,
      "Z",
    ].join(" ");
  }

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[200px] w-[200px]">
        {arcs.map((a) => (
          <path key={a.label} d={arcPath(a.start, a.end, R, r)} fill={a.color} stroke="#fff" strokeWidth={2} />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-slate-700" fontSize={20} fontWeight={700}>
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-400" fontSize={9}>
          {centerLabel}
        </text>
      </svg>
      <div className="mt-3 space-y-1.5">
        {arcs.map((a) => (
          <div key={a.label} className="flex items-center gap-2 text-[12px]">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: a.color }} />
            <span className="text-slate-600">
              {a.label} <span className="font-semibold">{a.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StabilityDistributionChart({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const n = candidates.length;
  if (n === 0) return null;

  const stabilities = ["Very Stable", "Stable", "Moderate", "Weak"];
  const stabilityColors = ["#10b981", "#0F766E", "#f59e0b", "#dc2626"];
  const stabilitySlices: Slice[] = stabilities.map((label, i) => ({
    label,
    count: candidates.filter((c) => c.realMetrics.duplexStability === label).length,
    color: stabilityColors[i],
  }));

  const riskLabels = ["None", "Low", "Moderate", "High"];
  const riskColors = ["#10b981", "#0F766E", "#f59e0b", "#dc2626"];
  const riskSlices: Slice[] = riskLabels.map((label, i) => ({
    label,
    count: candidates.filter((c) => {
      const mfe = c.realMetrics.selfStructureMfe;
      if (mfe === 0) return label === "None";
      if (mfe > -3) return label === "Low";
      if (mfe > -6) return label === "Moderate";
      return label === "High";
    }).length,
    color: riskColors[i],
  }));

  return (
    <div>
      <div className="grid grid-cols-2 items-start gap-6">
        <div className="flex flex-col items-center">
          <p className="mb-3 text-center text-[12.5px] font-semibold text-slate-700">Duplex stability</p>
          <Donut slices={stabilitySlices} centerLabel="candidates" />
        </div>
        <div className="flex flex-col items-center">
          <p className="mb-3 text-center text-[12.5px] font-semibold text-slate-700">Self-structure risk</p>
          <Donut slices={riskSlices} centerLabel="candidates" />
        </div>
      </div>
      <p className="mt-4 text-[11.5px] text-slate-400 italic">
        Self-structure risk derived from ViennaRNA MFE (0 = none, &gt; −3 low, &gt; −6 moderate, ≤ −6 high).
      </p>
    </div>
  );
}
