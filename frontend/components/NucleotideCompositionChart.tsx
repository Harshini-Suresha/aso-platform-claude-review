export default function NucleotideCompositionChart({
  composition,
}: {
  composition: Record<string, number>;
}) {
  const entries = Object.entries(composition).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const size = 190;
  const cx = size / 2;
  const cy = size / 2;
  const R = 72;
  const r = 40;

  const COLORS: Record<string, string> = {
    A: "#f59e0b",
    C: "#3b82f6",
    G: "#10b981",
    T: "#ef4444",
    U: "#8b5cf6",
  };

  const fallbackColors = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#8b5cf6", "#f43f5e"];
  let colorIdx = 0;
  const getColor = (key: string) => COLORS[key] ?? fallbackColors[colorIdx++ % fallbackColors.length];

  let acc = 0;
  const arcs = entries.map(([base, count]) => {
    const start = acc;
    acc += count / total;
    const end = acc;
    return { base, count, pct: ((count / total) * 100).toFixed(1), start, end };
  });

  function describeArc(start: number, end: number, outerR: number, innerR: number) {
    const s1 = start * 2 * Math.PI - Math.PI / 2;
    const e1 = end * 2 * Math.PI - Math.PI / 2;
    const large = end - start > 0.5 ? 1 : 0;
    const x1 = cx + outerR * Math.cos(s1);
    const y1 = cy + outerR * Math.sin(s1);
    const x2 = cx + outerR * Math.cos(e1);
    const y2 = cy + outerR * Math.sin(e1);
    const x3 = cx + innerR * Math.cos(e1);
    const y3 = cy + innerR * Math.sin(e1);
    const x4 = cx + innerR * Math.cos(s1);
    const y4 = cy + innerR * Math.sin(s1);
    return [
      `M${x1},${y1}`,
      `A${outerR},${outerR} 0 ${large} 1 ${x2},${y2}`,
      `L${x3},${y3}`,
      `A${innerR},${innerR} 0 ${large} 0 ${x4},${y4}`,
      "Z",
    ].join(" ");
  }

  const isProtein = entries.some(([base]) => !"ACGTU".includes(base));

  return (
    <div className="flex items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[190px] w-[190px] shrink-0">
        {arcs.map((a) => (
          <path
            key={a.base}
            d={describeArc(a.start, a.end, R, r)}
            fill={getColor(a.base)}
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" className="fill-slate-700" fontSize={20} fontWeight={700}>
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" className="fill-slate-400" fontSize={10.5}>
          {isProtein ? "total aa" : "total nt"}
        </text>
      </svg>
      <div className="space-y-2">
        {arcs.map((a) => (
          <div key={a.base} className="flex items-center gap-2 text-[13px]">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: getColor(a.base) }}
            />
            <span className="font-mono font-semibold text-slate-700 w-4">{a.base}</span>
            <span className="text-slate-500">
              {a.count} <span className="text-slate-400">({a.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
