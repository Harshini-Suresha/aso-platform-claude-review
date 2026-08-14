import { AssoCandidate } from "@/types/geneSilencing";
import { RnaEditingCandidate } from "@/types/rnaEditing";

/**
 * Adapts candidates from the different design engines into the canonical
 * AssoCandidate shape so the shared TG01 visualization suite
 * (AsoAnalysisDashboard / AsoVisualizationSuite) can render for every
 * therapeutic goal.
 *
 * - TG01 / TG02 candidates already carry nested realMetrics / heuristicEstimates
 *   and are passed through untouched.
 * - TG03 (RNA editing) candidates are flat RnaEditingCandidate objects; their
 *   biophysical metrics are mapped 1:1, and the drug-like estimates the editing
 *   engine does not report are derived from the guide's own sequence, length,
 *   and chemistry purely for display (they never feed back into ranking).
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function duplexStabilityLabel(dg: number): string {
  if (dg <= -25) return "Very Stable";
  if (dg <= -15) return "Stable";
  if (dg <= -10) return "Moderate";
  return "Weak";
}

function isAssoShape(c: unknown): c is AssoCandidate {
  return (
    typeof c === "object" &&
    c !== null &&
    "realMetrics" in c &&
    "heuristicEstimates" in c &&
    "compositeScore" in c
  );
}

export function toVisualAssoCandidate(c: unknown): AssoCandidate {
  if (isAssoShape(c)) return c;

  const r = c as RnaEditingCandidate;
  const length = r.guideLength ?? r.sequence?.length ?? 0;

  const uptake = clamp(Math.round(85 - Math.max(0, length - 25) * 0.35), 15, 95);
  const bbb = clamp(Math.round(45 - length * 0.3), 5, 70);
  const synthesis = clamp(
    Math.round(
      30 +
        (r.longestHomopolymer >= 4 ? 25 : 0) +
        (r.polygTracts > 0 ? 15 : 0) +
        (length > 90 ? 15 : 0),
    ),
    10,
    90,
  );
  const offTarget = clamp(
    Math.round((1 - r.sequenceComplexity) * 55 + (r.polygTracts > 0 ? 20 : 0)),
    5,
    90,
  );
  const immune = clamp(Math.round(r.cpgCount * 15), 5, 85);

  return {
    sequence: r.sequence,
    length,
    compositeScore: r.qualityScore,
    learnedEfficacy: {
      available: false,
      value: null,
      modelInfo: "Not yet trained",
      scopeCaveat: null,
    },
    realMetrics: {
      targetDuplexEnergy: r.targetDuplexEnergy,
      meltingTempC: r.meltingTempC,
      selfStructureMfe: r.selfStructureMfe,
      gcContent: r.gcContent,
      cpgCount: r.cpgCount,
      longestHomopolymer: r.longestHomopolymer,
      purineContent: r.purineContent,
      gcSkew: r.gcSkew,
      sequenceComplexity: r.sequenceComplexity,
      polyGPass: (r.polygTracts ?? 0) === 0,
      molecularWeight: r.molecularWeight,
      extinctionCoefficient: r.extinctionCoefficient,
      duplexStability: duplexStabilityLabel(r.targetDuplexEnergy),
    },
    heuristicEstimates: {
      nucleaseResistance: {
        value: r.nucleaseResistance,
        note: "Chemistry/backbone rule of thumb.",
      },
      cellularUptake: { value: uptake, note: "Length-based estimate for display." },
      bbbCrossing: { value: bbb, note: "Length-based estimate for display." },
      synthesisDifficulty: { value: synthesis, note: "Sequence-based estimate for display." },
      offTargetRisk: { value: offTarget, note: "Complexity-based estimate for display." },
      immuneStimulation: { value: immune, note: "CpG-count estimate for display." },
    },
    targetRegion: r.targetRegion,
    mechanismId: r.mechanismId,
    chemistry: r.chemistry,
    modifications: r.modifications ?? [],
    exonNumber: null,
    exonLength: null,
    deliveryContext: "",
    defectType: "",
    defectNotes: "",
    mechanismNotes: r.mechanismNotes,
  };
}

export function visualAssoCandidates(candidates: unknown[]): AssoCandidate[] {
  return (candidates ?? []).map(toVisualAssoCandidate);
}
