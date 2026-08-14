"use client";

import { useRef, useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";

interface Col {
  key: string;
  label: string;
  unit?: string;
  get: (c: AssoCandidate) => string;
  warn?: (c: AssoCandidate) => boolean;
}

const COLS: Col[] = [
  {
    key: "region",
    label: "Target region",
    get: (c) => c.targetRegion,
  },
  {
    key: "exon",
    label: "Exon",
    get: (c) => (c.exonNumber != null ? String(c.exonNumber) : "—"),
  },
  {
    key: "length",
    label: "Length",
    unit: "nt",
    get: (c) => String(c.length),
  },
  {
    key: "gc",
    label: "GC",
    unit: "%",
    get: (c) => c.realMetrics.gcContent.toFixed(1),
    warn: (c) => c.realMetrics.gcContent < 40 || c.realMetrics.gcContent > 60,
  },
  {
    key: "tm",
    label: "Tm",
    unit: "°C",
    get: (c) => c.realMetrics.meltingTempC.toFixed(1),
  },
  {
    key: "dg",
    label: "Duplex ΔG",
    unit: "kcal/mol",
    get: (c) => c.realMetrics.targetDuplexEnergy.toFixed(1),
  },
  {
    key: "mfe",
    label: "Self-structure",
    unit: "kcal/mol",
    get: (c) => c.realMetrics.selfStructureMfe.toFixed(1),
  },
  {
    key: "mw",
    label: "MW",
    unit: "Da",
    get: (c) => c.realMetrics.molecularWeight.toLocaleString(),
  },
  {
    key: "ec",
    label: "ε₂₆₀",
    unit: "L/mol·cm",
    get: (c) => c.realMetrics.extinctionCoefficient.toLocaleString(),
  },
  {
    key: "skew",
    label: "GC skew",
    get: (c) => c.realMetrics.gcSkew.toFixed(3),
  },
  {
    key: "complexity",
    label: "Complexity",
    get: (c) => c.realMetrics.sequenceComplexity.toFixed(3),
    warn: (c) => c.realMetrics.sequenceComplexity < 0.7,
  },
  {
    key: "cpg",
    label: "CpG",
    get: (c) => String(c.realMetrics.cpgCount),
    warn: (c) => c.realMetrics.cpgCount >= 3,
  },
  {
    key: "homo",
    label: "Homo run",
    unit: "bp",
    get: (c) => String(c.realMetrics.longestHomopolymer),
    warn: (c) => c.realMetrics.longestHomopolymer >= 4,
  },
  {
    key: "purine",
    label: "Purine",
    unit: "%",
    get: (c) => `${(c.realMetrics.purineContent * 100).toFixed(0)}`,
  },
  {
    key: "nuc",
    label: "Nuc. res.",
    get: (c) => String(c.heuristicEstimates.nucleaseResistance.value),
  },
  {
    key: "uptake",
    label: "Uptake",
    get: (c) => String(c.heuristicEstimates.cellularUptake.value),
  },
  {
    key: "bbb",
    label: "BBB",
    get: (c) => String(c.heuristicEstimates.bbbCrossing.value),
  },
  {
    key: "synth",
    label: "Synthesis",
    get: (c) => String(c.heuristicEstimates.synthesisDifficulty.value),
    warn: (c) => c.heuristicEstimates.synthesisDifficulty.value > 55,
  },
  {
    key: "offtarget",
    label: "Off-target",
    get: (c) => String(c.heuristicEstimates.offTargetRisk.value),
    warn: (c) => c.heuristicEstimates.offTargetRisk.value > 40,
  },
  {
    key: "immune",
    label: "Immune",
    get: (c) => String(c.heuristicEstimates.immuneStimulation.value),
    warn: (c) => c.heuristicEstimates.immuneStimulation.value > 35,
  },
];

export default function CandidateMetricsTable({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const n = candidates.length;
  if (n === 0) return null;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            <th className="sticky left-0 z-10 bg-slate-100 px-2.5 py-2 text-left font-semibold">
              Rank
            </th>
            {COLS.map((col) => (
              <th
                key={col.key}
                className="whitespace-nowrap px-2.5 py-2 text-center font-semibold"
                title={col.unit ? `${col.label} (${col.unit})` : col.label}
              >
                {col.label}
                {col.unit && <span className="ml-0.5 font-normal text-slate-400">{col.unit}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {candidates.map((c, i) => (
            <tr key={c.sequence} className="hover:bg-slate-50">
              <td className="sticky left-0 z-10 bg-white px-2.5 py-1.5 font-bold text-brand">
                #{i + 1}
              </td>
              {COLS.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-2.5 py-1.5 text-center ${
                    col.key === "region"
                      ? "max-w-[180px] truncate text-left"
                      : col.warn && col.warn(c)
                        ? "font-semibold text-rose-600"
                        : "text-slate-600"
                  }`}
                  title={col.get(c)}
                >
                  {col.get(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> Rose = outside ideal window / risk flag
        </span>
        <span className="ml-auto">
          Duplex, Tm, GC, MFE, MW, ε₂₆₀ are computed; Nuc res / Uptake / BBB / Synthesis / Off-target / Immune are rule-of-thumb estimates.
        </span>
      </div>
    </div>
  );
}
