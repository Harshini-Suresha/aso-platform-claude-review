"use client";

import { useState, useRef } from "react";

interface PhysicochemicalProfile {
  molecularWeight: number;
  netCharge: number;
  hydrophobicityIndex: number;
  hydrophobicityProfile: { position: number; value: number }[];
  chargeProfile: { position: number; value: number }[];
}

function LineChart({
  data,
  seqLength,
  label,
  unit,
  color,
  gradientId,
}: {
  data: { position: number; value: number }[];
  seqLength: number;
  label: string;
  unit: string;
  color: string;
  gradientId: string;
}) {
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    pos: number;
    val: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 280;
  const H = 110;
  const PAD = { top: 8, right: 8, bottom: 18, left: 32 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const vals = data.map((d) => d.value);
  const minV = Math.min(...vals) - 0.1;
  const maxV = Math.max(...vals) + 0.1;
  const range = maxV - minV || 1;

  const xScale = (pos: number) =>
    PAD.left + (pos / seqLength) * plotW;
  const yScale = (v: number) =>
    PAD.top + plotH - ((v - minV) / range) * plotH;

  const pathD = data
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"}${xScale(d.position).toFixed(1)},${yScale(d.value).toFixed(1)}`
    )
    .join(" ");

  const areaD =
    pathD +
    ` L${xScale(data[data.length - 1].position).toFixed(1)},${(PAD.top + plotH).toFixed(1)}` +
    ` L${xScale(data[0].position).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  return (
    <div>
      <p className="text-[11px] font-medium text-slate-600 mb-1">{label}</p>
      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseMove={(e) => {
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const mx = ((e.clientX - rect.left) / rect.width) * W;
            const pos = Math.round(((mx - PAD.left) / plotW) * seqLength);
            const closest = data.reduce((best, d) =>
              Math.abs(d.position - pos) < Math.abs(best.position - pos)
                ? d
                : best
            );
            setHover({
              x: xScale(closest.position),
              y: yScale(closest.value),
              pos: closest.position,
              val: closest.value,
            });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <path d={areaD} fill={`url(#${gradientId})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth={1.2} />

          {hover && (
            <>
              <line
                x1={hover.x}
                y1={PAD.top}
                x2={hover.x}
                y2={PAD.top + plotH}
                stroke="#94a3b8"
                strokeWidth={0.5}
                strokeDasharray="3,3"
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={2.5}
                fill={color}
                stroke="#fff"
                strokeWidth={1}
              />
              <rect
                x={hover.x + 4}
                y={hover.y - 18}
                width={72}
                height={16}
                rx={2}
                fill="#1e293b"
                opacity={0.9}
              />
              <text
                x={hover.x + 7}
                y={hover.y - 7}
                fill="#fff"
                fontSize={8}
                fontFamily="monospace"
              >
                pos {hover.pos} — {hover.val.toFixed(2)} {unit}
              </text>
            </>
          )}

          {/* Y axis */}
          {[minV, (minV + maxV) / 2, maxV].map((v, i) => (
            <text
              key={i}
              x={PAD.left - 3}
              y={yScale(v) + 3}
              textAnchor="end"
              className="fill-slate-400"
              fontSize={7}
            >
              {v.toFixed(1)}
            </text>
          ))}

          {/* X axis */}
          {[0, seqLength].map((v) => (
            <text
              key={v}
              x={xScale(v)}
              y={H - 3}
              textAnchor="middle"
              className="fill-slate-400"
              fontSize={7}
            >
              {v}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function PhysicochemicalCard({
  profile,
}: {
  profile: PhysicochemicalProfile;
}) {
  return (
    <>
      <p className="text-[14px] font-semibold text-slate-800 mb-3">
        Physicochemical Properties
      </p>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Mol. Weight</p>
          <p className="text-[14px] font-bold text-slate-800 mt-0.5">
            {profile.molecularWeight.toFixed(0)} Da
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Net Charge</p>
          <p
            className={`text-[14px] font-bold mt-0.5 ${
              profile.netCharge === 0
                ? "text-slate-800"
                : profile.netCharge < 0
                ? "text-red-600"
                : "text-blue-600"
            }`}
          >
            {profile.netCharge > 0 ? "+" : ""}
            {profile.netCharge.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Hydrophobicity</p>
          <p className="text-[14px] font-bold text-slate-800 mt-0.5">
            {profile.hydrophobicityIndex.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Profiles */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {profile.hydrophobicityProfile.length > 0 && (
          <LineChart
            data={profile.hydrophobicityProfile}
            seqLength={
              profile.hydrophobicityProfile[
                profile.hydrophobicityProfile.length - 1
              ]?.position ?? 1
            }
            label="Hydrophobicity Along Sequence"
            unit="kcal/mol"
            color="#8b5cf6"
            gradientId="hydroGrad"
          />
        )}
        {profile.chargeProfile.length > 0 && (
          <LineChart
            data={profile.chargeProfile}
            seqLength={
              profile.chargeProfile[profile.chargeProfile.length - 1]
                ?.position ?? 1
            }
            label="Charge Distribution"
            unit="e"
            color="#3b82f6"
            gradientId="chargeGrad"
          />
        )}
      </div>

      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span className="shrink-0 mt-0.5">ℹ</span>
        Values are Kyte-Doolittle hydrophobicity estimates averaged over a
        sliding window. Molecular weight assumes standard oligonucleotide
        composition.
      </div>
    </>
  );
}
