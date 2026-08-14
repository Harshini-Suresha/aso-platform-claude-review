"use client";

const DASH = "—";

interface TissueBarChartProps {
  tissues: { name: string; tpm: number }[];
  maxBars?: number;
}

export default function TissueBarChart({ tissues, maxBars = 5 }: TissueBarChartProps) {
  if (!tissues.length) {
    return <p className="py-6 text-center text-[12px] text-slate-400">{DASH}</p>;
  }

  const sorted = [...tissues].sort((a, b) => b.tpm - a.tpm).slice(0, maxBars);
  const maxTpm = sorted[0]?.tpm ?? 1;

  return (
    <div className="space-y-2">
      {sorted.map((t) => (
        <div key={t.name} className="flex items-center gap-3">
          <p className="w-[110px] shrink-0 truncate text-[11px] text-slate-600" title={t.name}>
            {t.name}
          </p>
          <div className="flex-1">
            <div className="h-4 rounded-md bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-md bg-[#16A34A] transition-all duration-500"
                style={{ width: `${(t.tpm / maxTpm) * 100}%` }}
              />
            </div>
          </div>
          <span className="w-[52px] shrink-0 text-right text-[11px] font-medium text-slate-600">
            {t.tpm}
          </span>
        </div>
      ))}
    </div>
  );
}
