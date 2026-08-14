"use client";

interface ThermoProfile {
  avgEnthalpy: number;
  avgEntropy: number;
  freeEnergy37: number;
  gcEnrichment: number;
  atEnrichment: number;
  stabilityClass: "stable" | "moderate" | "unstable";
  notes: string[];
}

function classColor(cls: string): string {
  if (cls === "stable") return "bg-emerald-100 text-emerald-700";
  if (cls === "moderate") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function classDotColor(cls: string): string {
  if (cls === "stable") return "bg-emerald-500";
  if (cls === "moderate") return "bg-amber-500";
  return "bg-red-500";
}

export default function ThermodynamicProfile({
  profile,
}: {
  profile: ThermoProfile;
}) {
  const metrics = [
    {
      label: "Avg Enthalpy (ΔH)",
      value: profile.avgEnthalpy,
      unit: "kcal/mol",
      color: "bg-indigo-500",
      barPct: Math.min(100, Math.abs(profile.avgEnthalpy) / 50 * 100),
    },
    {
      label: "Avg Entropy (ΔS)",
      value: profile.avgEntropy,
      unit: "cal/mol·K",
      color: "bg-violet-500",
      barPct: Math.min(100, Math.abs(profile.avgEntropy) / 200 * 100),
    },
    {
      label: "Free Energy (37°C)",
      value: profile.freeEnergy37,
      unit: "kcal/mol",
      color: "bg-emerald-500",
      barPct: Math.min(100, Math.abs(profile.freeEnergy37) / 30 * 100),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          Thermodynamic Profile
        </p>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${classColor(profile.stabilityClass)}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${classDotColor(profile.stabilityClass)} mr-1.5`} />
          {profile.stabilityClass.charAt(0).toUpperCase() +
            profile.stabilityClass.slice(1)}
        </span>
      </div>

      {/* Enthalpy / Entropy / Free Energy bars */}
      <div className="space-y-3 mb-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500">{m.label}</span>
              <span className="font-mono font-semibold text-slate-700">
                {m.value > 0 ? "+" : ""}
                {m.value.toFixed(2)} {m.unit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${m.color} transition-all`}
                style={{ width: `${m.barPct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Composition pie */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-[10px] text-slate-400">GC Enrichment</p>
          <p className="text-[18px] font-bold text-slate-800 mt-0.5">
            {profile.gcEnrichment.toFixed(1)}%
          </p>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${profile.gcEnrichment}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-[10px] text-slate-400">AT/UA Enrichment</p>
          <p className="text-[18px] font-bold text-slate-800 mt-0.5">
            {profile.atEnrichment.toFixed(1)}%
          </p>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${profile.atEnrichment}%` }}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      {profile.notes.length > 0 && (
        <div className="space-y-1.5">
          {profile.notes.map((note, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700"
            >
              <span className="shrink-0 mt-0.5">⚠</span>
              {note}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span className="shrink-0 mt-0.5">ℹ</span>
        Values are simplified nearest-neighbor approximations at standard
        conditions (37°C, 1M NaCl). Actual thermodynamics depend on
        oligonucleotide concentration, salt, and DMSO.
      </div>
    </>
  );
}
