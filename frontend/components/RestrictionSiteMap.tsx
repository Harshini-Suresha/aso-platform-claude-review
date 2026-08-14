"use client";

import { useState } from "react";

interface RestrictionSite {
  enzyme: string;
  recognitionSite: string;
  cutPosition: number;
  strand: "+" | "-";
  overhang: "5'" | "3'" | "blunt";
}

const ENZYME_COLORS: Record<string, string> = {
  EcoRI: "#6366f1",
  BamHI: "#8b5cf6",
  HindIII: "#ec4899",
  NotI: "#10b981",
  XhoI: "#f59e0b",
  SacI: "#3b82f6",
  KpnI: "#ef4444",
  SpeI: "#14b8a6",
  NdeI: "#f97316",
  SmaI: "#a855f7",
};

function getEnzymeColor(enzyme: string): string {
  return ENZYME_COLORS[enzyme] ?? "#64748b";
}

export default function RestrictionSiteMap({
  sites,
  seqLength,
}: {
  sites: RestrictionSite[];
  seqLength: number;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  if (sites.length === 0) {
    return (
      <>
        <p className="text-[14px] font-semibold text-slate-800 mb-3">
          Restriction Enzyme Map
        </p>
        <p className="text-[12px] text-slate-400">
          No common restriction sites detected in this sequence.
        </p>
      </>
    );
  }

  const W = 560;
  const H = 80;
  const PAD = { left: 30, right: 10, top: 10, bottom: 20 };
  const plotW = W - PAD.left - PAD.right;
  const barH = 16;
  const barY = PAD.top + 10;
  const xScale = (pos: number) =>
    PAD.left + (pos / seqLength) * plotW;

  const uniqueEnzymes = [...new Set(sites.map((s) => s.enzyme))];
  const enzymeGroups = uniqueEnzymes.map((enz) => ({
    enzyme: enz,
    color: getEnzymeColor(enz),
    sites: sites.filter((s) => s.enzyme === enz),
  }));

  return (
    <>
      <p className="text-[14px] font-semibold text-slate-800 mb-1">
        Restriction Enzyme Map
      </p>
      <p className="text-[11px] text-slate-400 mb-3">
        {sites.length} cut site{sites.length !== 1 ? "s" : ""} from{" "}
        {uniqueEnzymes.length} enzyme{uniqueEnzymes.length !== 1 ? "s" : ""}
      </p>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Sequence bar */}
          <rect
            x={PAD.left}
            y={barY}
            width={plotW}
            height={barH}
            rx={3}
            fill="#e2e8f0"
          />

          {/* Cut site markers */}
          {sites.map((site, i) => {
            const x = xScale(site.cutPosition);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={barY - 4}
                  x2={x}
                  y2={barY + barH + 4}
                  stroke={getEnzymeColor(site.enzyme)}
                  strokeWidth={2}
                  opacity={0.8}
                />
                <circle
                  cx={x}
                  cy={barY - 6}
                  r={3}
                  fill={getEnzymeColor(site.enzyme)}
                  stroke="#fff"
                  strokeWidth={1}
                  className="cursor-pointer"
                  onMouseEnter={(e) =>
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      text: `${site.enzyme} (${site.recognitionSite}) @ pos ${site.cutPosition} [${site.strand} strand, ${site.overhang} overhang]`,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              </g>
            );
          })}

          {/* X axis ticks */}
          {Array.from({ length: 7 }, (_, i) => Math.round((seqLength * i) / 6)).map(
            (p) => (
              <g key={p}>
                <line
                  x1={xScale(p)}
                  y1={barY + barH}
                  x2={xScale(p)}
                  y2={barY + barH + 4}
                  stroke="#cbd5e1"
                  strokeWidth={0.5}
                />
                <text
                  x={xScale(p)}
                  y={barY + barH + 14}
                  textAnchor="middle"
                  className="fill-slate-400"
                  fontSize={8}
                >
                  {p}
                </text>
              </g>
            )
          )}
        </svg>
      </div>

      {/* Enzyme legend */}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
        {enzymeGroups.map(({ enzyme, color, sites: es }) => (
          <span key={enzyme} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {enzyme} ({es.length})
          </span>
        ))}
      </div>

      {/* Enzyme table */}
      <div className="mt-3 max-h-32 overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="pb-1 font-medium">Enzyme</th>
              <th className="pb-1 font-medium">Site</th>
              <th className="pb-1 font-medium">Pos</th>
              <th className="pb-1 font-medium">Overhang</th>
            </tr>
          </thead>
          <tbody>
            {sites.slice(0, 15).map((s, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-0.5 font-medium text-slate-600">
                  {s.enzyme}
                </td>
                <td className="py-0.5 font-mono text-slate-500">
                  {s.recognitionSite}
                </td>
                <td className="py-0.5 text-slate-500">{s.cutPosition}</td>
                <td className="py-0.5 text-slate-500">{s.overhang}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sites.length > 15 && (
          <p className="text-[9px] text-slate-400 mt-1">
            +{sites.length - 15} more sites
          </p>
        )}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-white shadow-lg"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}
