"use client";

import { useRef, useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

interface Metric {
  key: string;
  label: string;
  direction: string;
  fav: (c: AssoCandidate, all: AssoCandidate[]) => number;
  raw: (c: AssoCandidate) => string;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

const METRICS: Metric[] = [
  {
    key: "duplex",
    label: "Duplex ΔG",
    direction: "more negative = stronger",
    fav: (c, all) => {
      const dgs = all.map((x) => x.realMetrics.targetDuplexEnergy);
      const minG = Math.min(...dgs);
      const maxG = Math.max(...dgs);
      return clamp(((c.realMetrics.targetDuplexEnergy - maxG) / (minG - maxG || 1)) * 100);
    },
    raw: (c) => `${c.realMetrics.targetDuplexEnergy} kcal/mol`,
  },
  {
    key: "selfStruct",
    label: "Self-structure",
    direction: "closer to 0 = safer",
    fav: (c, all) => {
      const mfes = all.map((x) => x.realMetrics.selfStructureMfe);
      const minM = Math.min(...mfes);
      const maxM = Math.max(...mfes);
      return clamp(((c.realMetrics.selfStructureMfe - minM) / (maxM - minM || 1)) * 100);
    },
    raw: (c) => `${c.realMetrics.selfStructureMfe} kcal/mol`,
  },
  {
    key: "gc",
    label: "GC content",
    direction: "40-60% ideal",
    fav: (c) => clamp(100 * (1 - Math.abs(c.realMetrics.gcContent - 50) / 10)),
    raw: (c) => `${c.realMetrics.gcContent}%`,
  },
  {
    key: "complexity",
    label: "Sequence complexity",
    direction: "higher = better",
    fav: (c) => clamp(c.realMetrics.sequenceComplexity * 100),
    raw: (c) => c.realMetrics.sequenceComplexity.toFixed(2),
  },
  {
    key: "cpg",
    label: "CpG dinucleotides",
    direction: "fewer = better",
    fav: (c) => clamp(100 * (1 - c.realMetrics.cpgCount / 3)),
    raw: (c) => `${c.realMetrics.cpgCount}×`,
  },
  {
    key: "homo",
    label: "Homopolymer run",
    direction: "shorter = better",
    fav: (c) => clamp(100 * (1 - c.realMetrics.longestHomopolymer / 4)),
    raw: (c) => `${c.realMetrics.longestHomopolymer} bp`,
  },
  {
    key: "purine",
    label: "Purine balance",
    direction: "50% = balanced",
    fav: (c) => clamp(100 - Math.abs(c.realMetrics.purineContent * 100 - 50) * 2),
    raw: (c) => `${(c.realMetrics.purineContent * 100).toFixed(0)}% purine`,
  },
];

function heatColor(fav: number): string {
  if (fav >= 70) return "#10b981";
  if (fav >= 50) return "#0F766E";
  if (fav >= 30) return "#f59e0b";
  return "#dc2626";
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (trial.length * fontSize * 0.6 <= maxWidth) {
      line = trial;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export default function CandidateHeatmap({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<{ m: number; c: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = candidates.length;
  if (n === 0) return null;

  const W = 760;
  const PAD = { top: 32, right: 12, bottom: 40, left: 150 };
  const cellH = 38;
  const H = PAD.top + METRICS.length * cellH + PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const cellW = plotW / n;

  function handleMouseMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    const ci = Math.floor((mx - PAD.left) / cellW);
    const mi = Math.floor((my - PAD.top) / cellH);
    if (ci >= 0 && ci < n && mi >= 0 && mi < METRICS.length) {
      setHover({ m: mi, c: ci });
    } else {
      setHover(null);
    }
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
        {/* Column headers */}
        {candidates.map((_, i) => (
          <text
            key={i}
            x={PAD.left + i * cellW + cellW / 2}
            y={PAD.top - 10}
            textAnchor="middle"
            className={`fill-black ${hover?.c === i ? "font-bold" : ""}`}
            fontSize={12}
            fontWeight={700}
          >
            #{i + 1}
          </text>
        ))}

        {/* Rows */}
        {METRICS.map((m, mi) => {
          const y = PAD.top + mi * cellH;
          return (
            <g key={m.key}>
              <text x={PAD.left - 8} y={y + cellH / 2 + 4} textAnchor="end" className="fill-black" fontSize={12} fontWeight={700}>
                {m.label}
              </text>
              {candidates.map((c, ci) => {
                const fav = Math.round(m.fav(c, candidates));
                const active = hover?.m === mi && hover?.c === ci;
                return (
                  <g key={ci}>
                    <rect
                      x={PAD.left + ci * cellW}
                      y={y}
                      width={cellW - 1.5}
                      height={cellH - 1.5}
                      rx={4}
                      fill={heatColor(fav)}
                      opacity={active ? 1 : 0.85}
                    />
                    <text
                      x={PAD.left + ci * cellW + (cellW - 1.5) / 2}
                      y={y + cellH / 2 + 3.5}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize={cellW >= 52 ? 10.5 : 8.5}
                      fontWeight={600}
                    >
                      {wrapText(m.raw(c), cellW - 1.5 - 8, cellW >= 52 ? 10.5 : 8.5).map((ln, li) => (
                        <tspan
                          key={li}
                          x={PAD.left + ci * cellW + (cellW - 1.5) / 2}
                          dy={li === 0 ? 0 : (cellW >= 52 ? 10.5 : 8.5) + 2}
                        >
                          {ln}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

      </svg>

      {/* Direction legend */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {METRICS.map((m) => (
          <span key={m.key} className="text-[11px] text-slate-400">
            <strong className="text-slate-600">{m.label}:</strong> {m.direction}
          </span>
        ))}
      </div>

      {hover && (() => {
        const m = METRICS[hover.m];
        const c = candidates[hover.c];
        const fav = Math.round(m.fav(c, candidates));
        return (
          <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            <span className="font-semibold text-slate-700">
              #{hover.c + 1} · {m.label}:
            </span>{" "}
            {m.raw(c)} ({m.direction}) — favorability {fav}/100.
            <span className="ml-1 text-slate-400">Region: {c.targetRegion}</span>
          </div>
        );
      })()}
    </div>
  );
}
