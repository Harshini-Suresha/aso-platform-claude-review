"use client";

import { AssoCandidate } from "@/types/geneSilencing";

interface GaugeSpec {
  key: string;
  label: string;
  raw: number;
  display: string;
  pct: number;
  color: string;
}

function gaugeColor(pct: number): string {
  if (pct >= 70) return "#10b981";
  if (pct >= 45) return "#0F766E";
  if (pct >= 25) return "#f59e0b";
  return "#dc2626";
}

function Ring({
  key,
  cx,
  cy,
  r,
  pct,
  color,
  label,
  display,
}: {
  key: string;
  cx: number;
  cy: number;
  r: number;
  pct: number;
  color: string;
  label: string;
  display: string;
}) {
  const circ = 2 * Math.PI * r;
  const fill = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <div key={key} className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${cx * 2} ${cy * 2}`} className="w-[108px] h-[108px]">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 1} textAnchor="middle" className="fill-slate-800" fontSize="17" fontWeight="700">
          {display}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400" fontSize="9">
          {label}
        </text>
      </svg>
    </div>
  );
}

export default function AsoScoreGauge({
  candidate,
}: {
  candidate: AssoCandidate;
}) {
  const rm = candidate.realMetrics;

  // Real, cited reference ranges for normalization (shown on the gauges so the
  // mapping is transparent): duplex ΔG typically −8 to −40 kcal/mol for
  // 12-30 nt oligos; Tm 20-90°C spans the design space; GC and score are 0-100.
  const duplexPct = ((rm.targetDuplexEnergy - -8) / (40 - 8)) * 100;
  const tmPct = ((rm.meltingTempC - 20) / (90 - 20)) * 100;
  const gcPct = rm.gcContent;

  const specs: GaugeSpec[] = [
    { key: "composite", label: "Composite", raw: candidate.compositeScore, display: String(candidate.compositeScore), pct: candidate.compositeScore, color: gaugeColor(candidate.compositeScore) },
    { key: "duplex", label: "ΔG kcal/mol", raw: rm.targetDuplexEnergy, display: String(rm.targetDuplexEnergy), pct: duplexPct, color: gaugeColor(duplexPct) },
    { key: "tm", label: "Tm °C", raw: rm.meltingTempC, display: String(rm.meltingTempC), pct: tmPct, color: gaugeColor(tmPct) },
    { key: "gc", label: "GC %", raw: gcPct, display: `${rm.gcContent}`, pct: gcPct, color: gaugeColor(gcPct) },
  ];

  return (
    <div className="flex flex-wrap items-start justify-around gap-3">
      {specs.map((s) => (
        <Ring key={s.key} cx={52} cy={52} r={40} pct={s.pct} color={s.color} label={s.label} display={s.display} />
      ))}
      <div className="mt-1 w-full text-[10.5px] leading-relaxed text-slate-400">
        Normalization references — Composite 0-100 · Duplex ΔG −8 to −40 kcal/mol (typical ASO duplex range) · Tm 20-90°C · GC 0-100%.
      </div>
    </div>
  );
}
