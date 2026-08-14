"use client";

interface RiskScores {
  specificity: number;
  stability: number;
  immunogenicity: number;
  delivery: number;
  toxicity: number;
  overall: number;
}

function gaugeColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function gaugeLabel(score: number): string {
  if (score >= 70) return "Favorable";
  if (score >= 40) return "Moderate";
  return "Concerning";
}

function gaugeBg(score: number): string {
  if (score >= 70) return "bg-emerald-50 text-emerald-700";
  if (score >= 40) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function GaugeRing({
  score,
  label,
  size = 64,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const R = (size - 8) / 2;
  const circ = 2 * Math.PI * R;
  const fill = (score / 100) * circ;
  const color = gaugeColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${size} ${size}`} className={`w-[${size}px] h-[${size}px]`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          className="fill-slate-700"
          fontSize="13"
          fontWeight="700"
        >
          {score}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 9}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize="6"
        >
          /100
        </text>
      </svg>
      <span className="text-[9px] font-medium text-slate-500 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

export default function RiskScoreDashboard({
  riskScores,
}: {
  riskScores: RiskScores;
}) {
  const categories = [
    { key: "specificity" as const, label: "Specificity" },
    { key: "stability" as const, label: "Stability" },
    { key: "immunogenicity" as const, label: "Immunogenicity" },
    { key: "delivery" as const, label: "Delivery" },
    { key: "toxicity" as const, label: "Toxicity" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[14px] font-semibold text-slate-800">
          Unified Risk Dashboard
        </p>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${gaugeBg(riskScores.overall)}`}
        >
          Overall: {riskScores.overall}/100 —{" "}
          {gaugeLabel(riskScores.overall)}
        </span>
      </div>

      {/* Overall gauge */}
      <div className="flex items-center justify-center mb-4">
        <GaugeRing score={riskScores.overall} label="Overall Score" size={80} />
      </div>

      {/* Individual gauges */}
      <div className="flex items-center justify-around mb-4">
        {categories.map((cat) => (
          <GaugeRing
            key={cat.key}
            score={riskScores[cat.key]}
            label={cat.label}
            size={60}
          />
        ))}
      </div>

      {/* Score bars */}
      <div className="space-y-2.5">
        {categories.map((cat) => (
          <div key={cat.key}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="font-medium text-slate-600">{cat.label}</span>
              <span
                className="font-mono font-semibold"
                style={{ color: gaugeColor(riskScores[cat.key]) }}
              >
                {riskScores[cat.key]}/100
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${riskScores[cat.key]}%`,
                  backgroundColor: gaugeColor(riskScores[cat.key]),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
        <span className="shrink-0 mt-0.5">⚠</span>
        Risk scores are heuristic estimates derived from sequence composition
        alone. They do not replace in vitro or in vivo assessments.
      </div>
    </>
  );
}
