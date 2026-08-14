"use client";

interface MeltingTemp {
  tmNearestNeighbor: number;
  tmBasicGC: number;
  length: number;
  gcContent?: number;
  method: string;
  note: string;
}

export default function MeltingTemperatureCard({ tm }: { tm: MeltingTemp }) {
  const methods = [
    {
      name: "Nearest-Neighbor",
      value: tm.tmNearestNeighbor,
      unit: "°C",
      desc: "SantaLucia 1998 at 50 mM Na+, 250 µM oligo",
      barPct: Math.max(0, Math.min(100, (tm.tmNearestNeighbor / 80) * 100)),
      color: "bg-indigo-500",
    },
    {
      name: "GC% Formula",
      value: tm.tmBasicGC,
      unit: "°C",
      desc: "Bolton & McCarthy simplified",
      barPct: Math.max(0, Math.min(100, (tm.tmBasicGC / 80) * 100)),
      color: "bg-violet-400",
    },
  ];

  const tmRange = tm.tmNearestNeighbor;
  const recommendedTm = tmRange >= 57 && tmRange <= 63;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[14px] font-semibold text-slate-800">Melting Temperature (Tm)</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{tm.method}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            recommendedTm
              ? "bg-emerald-100 text-emerald-700"
              : tmRange > 0
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {recommendedTm ? "Optimal range" : tmRange > 0 ? "Outside 57-63°C" : "N/A"}
        </span>
      </div>

      <div className="space-y-3">
        {methods.map((m) => (
          <div key={m.name}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500">{m.name}</span>
              <span className="font-mono font-semibold text-slate-700">
                {m.value > 0 ? `${m.value}${m.unit}` : "—"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${m.color} transition-all`}
                style={{ width: `${m.barPct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Length</p>
          <p className="text-[13px] font-bold text-slate-700">{tm.length} nt</p>
        </div>
        {tm.gcContent !== undefined && (
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-[10px] text-slate-400">GC Content</p>
            <p className="text-[13px] font-bold text-slate-700">{tm.gcContent}%</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
        <span className="shrink-0 mt-0.5">⚠</span>
        {tm.note}
      </div>
    </>
  );
}
