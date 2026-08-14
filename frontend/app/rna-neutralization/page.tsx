"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Dna,
  ChevronRight,
  Eye,
  FlaskConical,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import RepeatMaskingMap from "@/components/RepeatMaskingMap";
import CandidateInspectorPanel from "@/components/CandidateInspectorPanel";
import AsoDesignPipeline from "@/components/AsoDesignPipeline";
import { RnaNeutralizationCandidate, RnaNeutralizationResult } from "@/types/rnaNeutralization";
import { saveReport } from "@/lib/auth";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";
const SELECTED_MECHANISM_KEY = "aso:selectedMechanism";
const PROJECT_TARGET_TISSUE_KEY = "aso:projectTargetTissue";

function complementSequence(seq: string): string {
  const comp: Record<string, string> = { A: "U", U: "A", G: "C", C: "G", T: "A" };
  return seq.split("").map((c) => comp[c.toUpperCase()] || c).join("");
}

function generateMockCandidates(
  repeatUnit: string,
  stericChemistry: string,
  oligoLength: number,
  targetRbp: string
): RnaNeutralizationCandidate[] {
  const chemistryMap: Record<string, string> = {
    "2-o-moe-full-ps": "2'-O-MOE Full PS",
    pmo: "PMO",
    "lna-dna-mixmer": "LNA/DNA Mixmer",
  };
  const chem = chemistryMap[stericChemistry] ?? "2'-O-MOE Full PS";

  const baseSeq = Array(Math.ceil(oligoLength / repeatUnit.length) + 1)
    .fill(repeatUnit)
    .join("")
    .slice(0, oligoLength)
    .toLowerCase();

  const frameShift1 = baseSeq.slice(1) + baseSeq[0];
  const frameShift2 = baseSeq.slice(2) + baseSeq.slice(0, 2);

  const candidates: Omit<RnaNeutralizationCandidate, "rank">[] = [
    {
      sequence: baseSeq,
      tilingPattern: "17-mer Complementary Tiling",
      chemistry: chem,
      tm: 71.2,
      stericBindingDeltaG: -28.4,
      rbpDisplacementScore: 95,
      repeatUnit,
      oligoLength,
      offTargetRepeatCount: 3,
      rbpBindingDeltaG: -12.3,
      asoDuplexDeltaG: -28.4,
      hasCentralDnaGap: false,
      centralGapSizeNt: 0,
      selfDimerMfe: -1.8,
      hairpinRisk: "Low",
      gcContent: 52.9,
      deliveryContext: "cns",
      recommendedConjugation: "unconjugated",
      modificationPattern: "uniform-2moess",
    },
    {
      sequence: frameShift1,
      tilingPattern: "Frame-Shifted Tiling",
      chemistry: "PMO",
      tm: 68.5,
      stericBindingDeltaG: -25.1,
      rbpDisplacementScore: 89,
      repeatUnit,
      oligoLength,
      offTargetRepeatCount: 7,
      rbpBindingDeltaG: -11.8,
      asoDuplexDeltaG: -25.1,
      hasCentralDnaGap: false,
      centralGapSizeNt: 0,
      selfDimerMfe: -2.5,
      hairpinRisk: "Low",
      gcContent: 47.1,
      deliveryContext: "cns",
      recommendedConjugation: "unconjugated",
      modificationPattern: "full-pmo",
    },
    {
      sequence: frameShift2,
      tilingPattern: "Frame-Shifted Tiling",
      chemistry: "LNA/DNA Mixmer",
      tm: 76.0,
      stericBindingDeltaG: -31.0,
      rbpDisplacementScore: 84,
      repeatUnit,
      oligoLength,
      offTargetRepeatCount: 12,
      rbpBindingDeltaG: -13.1,
      asoDuplexDeltaG: -31.0,
      hasCentralDnaGap: false,
      centralGapSizeNt: 0,
      selfDimerMfe: -4.2,
      hairpinRisk: "Moderate",
      gcContent: 58.8,
      deliveryContext: "cns",
      recommendedConjugation: "unconjugated",
      modificationPattern: "lnana-flank-dna-core",
    },
  ];

  return candidates.map((c, i) => ({ ...c, rank: i + 1 }));
}

export default function RnaNeutralizationPage() {
  const router = useRouter();

  const [gene, setGene] = useState<{ geneSymbol: string; geneName?: string; organism?: string } | null>(null);
  const [mechanism, setMechanism] = useState<{ id: string; name: string } | null>(null);
  const [mechanismParams, setMechanismParams] = useState<Record<string, unknown> | null>(null);

  const [results, setResults] = useState<RnaNeutralizationResult | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [selectedCandidate, setSelectedCandidate] = useState<RnaNeutralizationCandidate | null>(null);
  const [showInspector, setShowInspector] = useState(false);
  const [showDesignPipeline, setShowDesignPipeline] = useState(false);
  const [designComplete, setDesignComplete] = useState(false);
  const [finalDesign, setFinalDesign] = useState<{
    candidate: RnaNeutralizationCandidate;
    modifications: string[];
    conjugation: string;
    secondaryStructurePassed: boolean;
    selfDimerPassed: boolean;
  } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(CONFIRMED_TARGET_KEY);
    if (stored) {
      try { setGene(JSON.parse(stored)); } catch { setGene(null); }
    }
    const mechStored = sessionStorage.getItem(SELECTED_MECHANISM_KEY);
    if (mechStored) {
      try {
        const parsed = JSON.parse(mechStored);
        setMechanism({ id: parsed.mechanism?.id ?? "", name: parsed.mechanism?.name ?? "" });
        setMechanismParams(parsed);
      } catch { setMechanism(null); }
    }
  }, []);

  const deliveryContext = mechanismParams?.deliveryContext as string || "";
  const repeatUnit = (mechanismParams?.repeatUnit as string) || "CUG";
  const stericChemistry = (mechanismParams?.stericChemistry as string) || "2-o-moe-full-ps";
  const oligoLength = (mechanismParams?.oligoLength as number) || 17;
  const targetRbp = (mechanismParams?.targetRbp as string) || "MBNL1";

  const handleGenerate = useCallback(() => {
    setGenLoading(true);
    setGenError(null);
    setResults(null);

    setTimeout(() => {
      try {
        const candidates = generateMockCandidates(
          repeatUnit,
          stericChemistry,
          oligoLength,
          targetRbp
        );

        const result: RnaNeutralizationResult = {
          geneSymbol: gene?.geneSymbol ?? "UNKNOWN",
          mechanismId: mechanism?.id ?? "A14",
          mechanismName: mechanism?.name ?? "Steric Repeat Masking",
          molecularDefect: (mechanismParams?.molecularDefect as string) ?? "toxic_rna_gain_of_function",
          neutralizationMode: (mechanismParams?.neutralizationMode as string) ?? "steric_repeat_masking",
          repeatUnit,
          estimatedRepeatCount: (mechanismParams?.estimatedRepeatCount as string) || ">50",
          stericChemistry,
          targetRbp,
          oligoLength,
          deliveryContext,
          candidates,
        };

        setResults(result);
        saveReport({
          step: "rna_neutralization",
          title: `RNA Neutralization: ${gene?.geneSymbol} — ${mechanism?.name}`,
          geneSymbol: gene?.geneSymbol ?? "",
          disease: "",
          summary: `Generated ${candidates.length} steric-blocking candidates. Top displacement score: ${candidates[0]?.rbpDisplacementScore}/100.`,
          data: { mechanismId: mechanism?.id, candidateCount: candidates.length },
        });
      } catch (err) {
        setGenError(err instanceof Error ? err.message : "Generation failed.");
      } finally {
        setGenLoading(false);
      }
    }, 800);
  }, [gene, mechanism, mechanismParams, repeatUnit, stericChemistry, oligoLength, targetRbp, deliveryContext]);

  function handleInspectCandidate(candidate: RnaNeutralizationCandidate) {
    setSelectedCandidate(candidate);
    setShowInspector(true);
  }

  function handleProceedToDesign(candidate: RnaNeutralizationCandidate) {
    setShowInspector(false);
    setSelectedCandidate(candidate);
    setShowDesignPipeline(true);
    setDesignComplete(false);
  }

  function handleDesignComplete(design: {
    candidate: RnaNeutralizationCandidate;
    modifications: string[];
    conjugation: string;
    secondaryStructurePassed: boolean;
    selfDimerPassed: boolean;
  }) {
    setFinalDesign(design);
    setDesignComplete(true);
    setShowDesignPipeline(false);

    saveReport({
      step: "aso_design_finalized",
      title: `ASO Design Finalized: ${gene?.geneSymbol} — Candidate #${design.candidate.rank}`,
      geneSymbol: gene?.geneSymbol ?? "",
      disease: "",
      summary: `Finalized ${design.candidate.chemistry} steric blocker with ${design.conjugation} conjugation.`,
      data: { rank: design.candidate.rank, chemistry: design.candidate.chemistry, conjugation: design.conjugation },
    });
  }

  if (!gene) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex flex-1 items-center justify-center px-6">
            <Card className="max-w-md p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-[14px] font-medium text-slate-700">No confirmed target</p>
              <p className="mt-1 text-[13px] text-slate-500">
                Go back to Basic Information and confirm a target first.
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-5 px-6 py-6">
          {/* Gene + mechanism banner */}
          <Card className="flex items-center gap-3 px-5 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50">
              <Dna className="h-4.5 w-4.5 text-indigo-500" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">
                {gene.geneSymbol} <span className="font-normal text-slate-400">· {gene.organism}</span>
              </p>
              <p className="text-[12px] text-slate-500">
                {gene.geneName ?? "—"}
                {mechanism ? ` · ${mechanism.name}` : ""}
              </p>
            </div>
            <button
              onClick={() => router.push("/mechanisms")}
              className="ml-auto text-[12.5px] font-medium text-brand hover:underline"
            >
              Change mechanism
            </button>
          </Card>

          {/* Step indicator */}
          <Card>
            <SectionHeader step="4" title="RNA Neutralization — Steric Blocker Design" />
            <p className="px-6 pb-3 text-[12.5px] text-slate-500">
              Generate non-cleaving steric-blocking oligonucleotides that outcompete RBP sequestration
              at the expanded repeat tract. Candidates are ranked by RBP displacement potential.
            </p>
          </Card>

          {/* Parameters summary + Generate */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Repeat Unit</p>
                  <p className="text-[13px] font-semibold text-slate-700">({repeatUnit})<sub>n</sub></p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Target RBP</p>
                  <p className="text-[13px] font-semibold text-slate-700">{targetRbp}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Chemistry</p>
                  <p className="text-[13px] font-semibold text-slate-700">{stericChemistry === "2-o-moe-full-ps" ? "2′-O-MOE Full PS" : stericChemistry === "pmo" ? "PMO" : "LNA/DNA Mixmer"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Oligo Length</p>
                  <p className="text-[13px] font-semibold text-slate-700">{oligoLength} nt</p>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={genLoading}
                className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {genLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {genLoading ? "Generating..." : showDesignPipeline || results ? "Regenerate" : "Generate Candidates"}
              </button>
            </div>
          </Card>

          {genError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {genError}
            </div>
          )}

          {/* Results Dashboard */}
          {results && !showDesignPipeline && !designComplete && (
            <div className="space-y-5">
              {/* Summary Badges */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Target RBP Displacement
                  </p>
                  <p className="mt-2 text-[28px] font-bold text-emerald-600">
                    {results.candidates[0]?.rbpDisplacementScore}/100
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Top candidate competitive binding vs {targetRbp}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Duplex ΔG (Top Candidate)
                  </p>
                  <p className="mt-2 text-[28px] font-bold text-indigo-600">
                    {results.candidates[0]?.stericBindingDeltaG.toFixed(1)}
                    <span className="text-[14px] font-normal text-slate-400"> kcal/mol</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Thermodynamic stability of ASO–RNA duplex
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Off-Target Gene Repeats
                  </p>
                  <p className={`mt-2 text-[28px] font-bold ${
                    (results.candidates[0]?.offTargetRepeatCount ?? 0) <= 5
                      ? "text-emerald-600"
                      : (results.candidates[0]?.offTargetRepeatCount ?? 0) <= 15
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}>
                    {results.candidates[0]?.offTargetRepeatCount}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Non-pathogenic repeat loci that could bind
                  </p>
                </Card>
              </div>

              {/* Repeat Masking Map */}
              <Card className="p-5">
                <SectionHeader step="A" title="Interactive Repeat Masking Map" />
                <div className="px-5 pb-2">
                  <RepeatMaskingMap
                    repeatUnit={repeatUnit}
                    oligoLength={oligoLength}
                    tilingPattern={results.candidates[0]?.tilingPattern ?? "Complementary Tiling"}
                    selectedCandidateSequence={results.candidates[0]?.sequence}
                  />
                </div>
              </Card>

              {/* Candidate Ranking Table */}
              <Card className="p-5">
                <SectionHeader step="B" title="Candidate Oligo Ranking" />
                <div className="px-5 pb-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Rank</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sequence (5′→3′)</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tiling Pattern</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Chemistry</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tm</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">ΔG</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">RBP Disp.</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.candidates.map((c) => (
                          <tr key={c.rank} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="py-3 pr-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                                {c.rank}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="font-mono text-[11.5px] text-slate-700 tracking-wide">{c.sequence}</span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="text-[11px] text-slate-600">{c.tilingPattern}</span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                                {c.chemistry}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="text-[12px] font-semibold text-slate-700">{c.tm.toFixed(1)}°C</span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="text-[12px] font-semibold text-indigo-600">{c.stericBindingDeltaG.toFixed(1)}</span>
                            </td>
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${
                                      c.rbpDisplacementScore >= 90
                                        ? "bg-emerald-400"
                                        : c.rbpDisplacementScore >= 70
                                          ? "bg-blue-400"
                                          : "bg-amber-400"
                                    }`}
                                    style={{ width: `${c.rbpDisplacementScore}%` }}
                                  />
                                </div>
                                <span className={`text-[12px] font-bold ${
                                  c.rbpDisplacementScore >= 90
                                    ? "text-emerald-600"
                                    : c.rbpDisplacementScore >= 70
                                      ? "text-blue-600"
                                      : "text-amber-600"
                                }`}>
                                  {c.rbpDisplacementScore}
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleInspectCandidate(c)}
                                  className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                  title="Inspect candidate details"
                                >
                                  <Eye className="h-3 w-3" /> Inspect
                                </button>
                                <button
                                  onClick={() => handleProceedToDesign(c)}
                                  className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[10px] font-medium text-white hover:bg-brand-dark transition-colors"
                                >
                                  Proceed <ChevronRight className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ASO Design Pipeline */}
          {showDesignPipeline && selectedCandidate && (
            <Card className="p-5">
              <AsoDesignPipeline
                candidate={selectedCandidate}
                deliveryContext={deliveryContext}
                onComplete={handleDesignComplete}
                onBack={() => {
                  setShowDesignPipeline(false);
                  setSelectedCandidate(null);
                }}
              />
            </Card>
          )}

          {/* Design Complete Summary */}
          {designComplete && finalDesign && (
            <Card className="border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-[14px] font-semibold text-emerald-800">
                    ASO Design Finalized — Candidate #{finalDesign.candidate.rank}
                  </p>
                  <p className="text-[12px] text-emerald-600">
                    {finalDesign.candidate.chemistry} · {finalDesign.conjugation} conjugation · Secondary structure validated
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white p-4">
                <p className="font-mono text-[13px] text-slate-700 tracking-widest select-all">
                  {finalDesign.candidate.sequence}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                  <span>Tm: {finalDesign.candidate.tm.toFixed(1)}°C</span>
                  <span>ΔG: {finalDesign.candidate.stericBindingDeltaG.toFixed(1)} kcal/mol</span>
                  <span>RBP Displacement: {finalDesign.candidate.rbpDisplacementScore}/100</span>
                  <span>Non-cleaving: Confirmed</span>
                </div>
              </div>
            </Card>
          )}

          {/* Empty state */}
          {!results && !genLoading && (
            <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Dna className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-[13px] font-medium text-slate-500">
                Click Generate Candidates to create steric-blocking oligonucleotides
              </p>
              <p className="mt-1 text-[12px] text-slate-400">
                Candidates will be ranked by RBP displacement potential and binding affinity
              </p>
            </Card>
          )}
        </main>
      </div>

      {/* Inspector Panel Modal */}
      {showInspector && selectedCandidate && (
        <CandidateInspectorPanel
          candidate={selectedCandidate}
          onClose={() => {
            setShowInspector(false);
            setSelectedCandidate(null);
          }}
          onProceedToDesign={handleProceedToDesign}
        />
      )}
    </div>
  );
}
