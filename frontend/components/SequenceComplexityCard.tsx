"use client";

interface ComplexityRegion {
  start: number;
  end: number;
  length: number;
  pattern?: string;
  repeats?: number;
  count?: number;
  positions?: number[];
}

interface SelfComp {
  sequence: string;
  position: number;
  size: number;
}

interface SequenceComplexity {
  dinucRepeats: (ComplexityRegion & { pattern: string; repeats: number })[];
  trinucRepeats: (ComplexityRegion & { pattern: string; count: number; positions: number[] })[];
  gcRichRegions: ComplexityRegion[];
  atRichRegions: ComplexityRegion[];
  selfComplementarity: SelfComp[];
  complexityScore: number;
}

function scoreColor(s: number): string {
  if (s >= 0.8) return "text-emerald-600 bg-emerald-50";
  if (s >= 0.5) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

function scoreLabel(s: number): string {
  if (s >= 0.8) return "High complexity";
  if (s >= 0.5) return "Moderate complexity";
  return "Low complexity — may cause issues";
}

export default function SequenceComplexityCard({ complexity }: { complexity: SequenceComplexity }) {
  const totalIssues =
    complexity.dinucRepeats.length +
    complexity.trinucRepeats.length +
    complexity.gcRichRegions.length +
    complexity.atRichRegions.length;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">Sequence Complexity</p>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${scoreColor(complexity.complexityScore)}`}>
          {scoreLabel(complexity.complexityScore)}
        </span>
      </div>

      {/* Complexity score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>Complexity score</span>
          <span className="font-mono font-semibold text-slate-600">{complexity.complexityScore.toFixed(3)}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              complexity.complexityScore >= 0.8 ? "bg-emerald-500" : complexity.complexityScore >= 0.5 ? "bg-amber-400" : "bg-red-400"
            }`}
            style={{ width: `${complexity.complexityScore * 100}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Dinuc. Repeats</p>
          <p className={`text-[14px] font-bold ${complexity.dinucRepeats.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {complexity.dinucRepeats.length}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">Trinuc. Repeats</p>
          <p className={`text-[14px] font-bold ${complexity.trinucRepeats.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {complexity.trinucRepeats.length}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">GC-Rich Runs</p>
          <p className="text-[14px] font-bold text-slate-700">{complexity.gcRichRegions.length}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[10px] text-slate-400">AT-Rich Runs</p>
          <p className="text-[14px] font-bold text-slate-700">{complexity.atRichRegions.length}</p>
        </div>
      </div>

      {/* Repeat details */}
      {complexity.dinucRepeats.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] font-medium text-slate-500 mb-1">Dinucleotide Repeats</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {complexity.dinucRepeats.slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[10px]">
                <span className="font-mono font-semibold text-amber-700 shrink-0">({r.pattern}){r.repeats}</span>
                <span className="text-slate-500">pos {r.start}–{r.end}</span>
                <span className="text-slate-400">{r.repeats}× repeat</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {complexity.trinucRepeats.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] font-medium text-slate-500 mb-1">Trinucleotide Repeats</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {complexity.trinucRepeats.slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-blue-50 border border-blue-200 px-2 py-1 text-[10px]">
                <span className="font-mono font-semibold text-blue-700 shrink-0">{r.pattern}</span>
                <span className="text-slate-500">{r.count}× at {r.positions.slice(0, 4).join(", ")}{r.positions.length > 4 ? "…" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {complexity.gcRichRegions.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] font-medium text-slate-500 mb-1">GC-Rich Regions</p>
          <div className="flex flex-wrap gap-1">
            {complexity.gcRichRegions.slice(0, 8).map((r, i) => (
              <span key={i} className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-mono text-emerald-700">
                pos {r.start}–{r.end} ({r.length} nt)
              </span>
            ))}
          </div>
        </div>
      )}

      {complexity.atRichRegions.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] font-medium text-slate-500 mb-1">AT-Rich Regions</p>
          <div className="flex flex-wrap gap-1">
            {complexity.atRichRegions.slice(0, 8).map((r, i) => (
              <span key={i} className="rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-[9px] font-mono text-red-700">
                pos {r.start}–{r.end} ({r.length} nt)
              </span>
            ))}
          </div>
        </div>
      )}

      {complexity.selfComplementarity.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] font-medium text-slate-500 mb-1">Self-Complementarity</p>
          <div className="space-y-1">
            {complexity.selfComplementarity.slice(0, 6).map((sc, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-slate-600">
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{sc.sequence}</span>
                <span className="text-slate-400">@ pos {sc.position} ({sc.size}-mer)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalIssues === 0 && (
        <p className="text-[11px] text-emerald-600">No problematic repetitive regions detected.</p>
      )}
    </>
  );
}
