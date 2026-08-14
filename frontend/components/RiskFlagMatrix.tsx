"use client";

import { useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";
import { ShieldAlert, ShieldCheck, Info } from "lucide-react";

interface Flag {
  key: string;
  label: string;
  test: (c: AssoCandidate) => boolean;
  detail: (c: AssoCandidate) => string;
}

const FLAGS: Flag[] = [
  {
    key: "polyG",
    label: "Poly-G",
    test: (c) => !c.realMetrics.polyGPass,
    detail: (c) => `${c.realMetrics.longestHomopolymer >= 3 ? `${c.realMetrics.longestHomopolymer}× G run` : ""} poly-G tract detected`,
  },
  {
    key: "cpg",
    label: "CpG ≥3",
    test: (c) => c.realMetrics.cpgCount >= 3,
    detail: (c) => `${c.realMetrics.cpgCount} CpG dinucleotides — elevated immune-stimulation risk`,
  },
  {
    key: "homo",
    label: "Homo ≥4",
    test: (c) => c.realMetrics.longestHomopolymer >= 4,
    detail: (c) => `longest homopolymer run of ${c.realMetrics.longestHomopolymer} bases`,
  },
  {
    key: "selfStruct",
    label: "Self-struct",
    test: (c) => c.realMetrics.selfStructureMfe <= -6,
    detail: (c) => `self-structure MFE ${c.realMetrics.selfStructureMfe} kcal/mol — may block target access`,
  },
  {
    key: "gc",
    label: "GC off-window",
    test: (c) => c.realMetrics.gcContent < 40 || c.realMetrics.gcContent > 60,
    detail: (c) => `GC ${c.realMetrics.gcContent}% outside the 40-60% design window`,
  },
];

export default function RiskFlagMatrix({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  const [hover, setHover] = useState<{ rank: number; flag: string } | null>(null);

  const flagCounts = FLAGS.map((f) => candidates.filter(f.test).length);
  const cleanCount = candidates.filter((c) => !FLAGS.some((f) => f.test(c))).length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th className="pb-2 pr-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Candidate</th>
            {FLAGS.map((f) => (
              <th key={f.key} className="px-2 pb-2 text-center text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c, i) => (
            <tr key={c.sequence}>
              <td className="py-1.5 pr-2 text-[12.5px] text-slate-600">#{i + 1}</td>
              {FLAGS.map((f) => {
                const flagged = f.test(c);
                const active = hover?.rank === i && hover?.flag === f.key;
                return (
                  <td key={f.key} className="px-2 py-1.5 text-center">
                    <span
                      onMouseEnter={() => setHover({ rank: i, flag: f.key })}
                      onMouseLeave={() => setHover(null)}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                        flagged ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                      } ${active ? "ring-2 ring-slate-300" : ""}`}
                    >
                      {flagged ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-2 pr-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Flagged</td>
            {flagCounts.map((c, i) => (
              <td key={i} className={`pt-2 text-center text-[12px] font-bold ${c > 0 ? "text-red-500" : "text-slate-300"}`}>
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Hover a cell for details.
        {cleanCount > 0 && (
          <span>
            {" "}
            <strong className="text-emerald-600">{cleanCount}</strong> candidate{cleanCount > 1 ? "s" : ""} {" "}
            {cleanCount > 1 ? "carry" : "carries"} no flags.
          </span>
        )}
      </p>

      {hover && (() => {
        const f = FLAGS.find((x) => x.key === hover.flag)!;
        const c = candidates[hover.rank];
        const flagged = f.test(c);
        return (
          <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
            <span className="font-semibold text-slate-700">
              #{hover.rank + 1} · {f.label}:
            </span>{" "}
            <span className={flagged ? "text-red-600" : "text-emerald-600"}>{flagged ? f.detail(c) : "No flag — passes this check."}</span>
          </div>
        );
      })()}
    </div>
  );
}
