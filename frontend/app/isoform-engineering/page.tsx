"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Dna,
  Download,
  FlaskConical,
  FileText,
  X,
  Copy,
  Check,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader, FieldLabel, InfoField, Pill } from "@/components/ui";
import IsoformAnalysisDashboard from "@/components/IsoformAnalysisDashboard";
import { GeneTargetObject } from "@/types/gene";
import { saveReport } from "@/lib/auth";
import {
  IsoformEngineeringInputs,
  IsoformEngineeringResponse,
  DesignOptions,
  IsoformCandidate,
} from "@/types/isoformEngineering";
import {
  fetchDesignOptions,
  generateConstructs,
} from "@/lib/isoformEngineeringApi";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";

export default function IsoformEngineeringPage() {
  const router = useRouter();
  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [options, setOptions] = useState<DesignOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [targetSymbol, setTargetSymbol] = useState("");
  const [isoformGoal, setIsoformGoal] = useState("");
  const [targetExonLocus, setTargetExonLocus] = useState("");
  const [spliceElementTarget, setSpliceElementTarget] = useState("");
  const [stericChemistry, setStericChemistry] = useState("");
  const [enforceInFrame, setEnforceInFrame] = useState(true);

  const [results, setResults] = useState<IsoformEngineeringResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCandidate, setSelectedCandidate] = useState<IsoformCandidate | null>(null);
  const [copied, setCopied] = useState(false);
  const selectedCandidateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCandidate && selectedCandidateRef.current) {
      selectedCandidateRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedCandidate]);

  useEffect(() => {
    const stored = sessionStorage.getItem(CONFIRMED_TARGET_KEY);
    if (stored) {
      try {
        const g = JSON.parse(stored) as GeneTargetObject;
        setGene(g);
        setTargetSymbol(g.geneSymbol || "");
      } catch {
        setGene(null);
      }
    }
    fetchDesignOptions()
      .then(setOptions)
      .catch((e) => setOptionsError(e instanceof Error ? e.message : "Failed to load options."));
  }, []);

  function handleReset() {
    setResults(null);
    setSelectedCandidate(null);
    setError(null);
  }

  async function handleGenerate() {
    if (!targetSymbol.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedCandidate(null);
    try {
      const res = await generateConstructs({
        targetSymbol: targetSymbol.trim(),
        isoformGoal,
        targetExonLocus,
        spliceElementTarget,
        stericChemistry,
        enforceInFrame,
      });
      setResults(res);
      saveReport({
        step: "isoform_engineering",
        title: `Isoform Engineering: ${targetSymbol.toUpperCase()}`,
        geneSymbol: targetSymbol.toUpperCase(),
        disease: gene?.disease || "",
        summary: `Generated ${res.candidates.length} isoform engineering constructs for ${targetSymbol.toUpperCase()}. Top: ${res.candidates[0]?.constructId || "N/A"}.`,
        data: {
          isoformGoal,
          topCandidates: res.candidates.slice(0, 3).map((c) => ({
            constructId: c.constructId,
            spliceEfficiency: c.spliceEfficiency,
            yield: c.predictedIsoformYield,
          })),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectCandidate(candidate: IsoformCandidate) {
    setSelectedCandidate(candidate);
  }

  function copySequence(seq: string) {
    navigator.clipboard.writeText(seq).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function isFormValid(): boolean {
    return (
      !!targetSymbol.trim() &&
      !!isoformGoal &&
      !!targetExonLocus &&
      !!spliceElementTarget &&
      !!stericChemistry
    );
  }

  if (!gene) {
    return (
      <div className="flex min-h-screen bg-[#F5F6FA]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex flex-1 items-center justify-center px-6">
            <Card className="max-w-md p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-[14px] font-medium text-slate-700">No confirmed target found</p>
              <p className="mt-1 text-[13px] text-slate-500">
                Go back to Basic Information, load a gene, and hit Confirm &amp; Proceed first.
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Basic Information
              </button>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-5 px-6 py-6">
          <Card className="flex items-center gap-3 px-5 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50">
              <Dna className="h-4.5 w-4.5 text-indigo-500" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">
                {gene.geneSymbol}{" "}
                <span className="font-normal text-slate-400">· {gene.organism}</span>
              </p>
              <p className="text-[12px] text-slate-500">
                {gene.geneName ?? "—"}
                {gene.diseaseName ? ` · ${gene.diseaseName}` : ""}
              </p>
            </div>
            <button
              onClick={() => router.push("/mechanisms")}
              className="ml-auto text-[12.5px] font-medium text-brand hover:underline"
            >
              Change target
            </button>
          </Card>

          {!results && (
            <Card>
              <SectionHeader step="1" title="Isoform Engineering Design" />
              <p className="px-6 pb-3 text-[12.5px] text-slate-500">
                Configure RNA payload parameters for isoform engineering. Select your isoform goal, target exon locus, splice element, and steric chemistry to generate optimized constructs.
              </p>
              {optionsError && (
                <p className="px-6 pb-2 text-[12.5px] text-red-600">{optionsError}</p>
              )}
              <div className="grid grid-cols-1 gap-4 px-6 pb-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <FieldLabel hint="The gene symbol for the protein you want to engineer (e.g., DMD, CFTR, SMN2)">
                    Target Gene Symbol <span className="text-red-500">*</span>
                  </FieldLabel>
                  <input
                    value={targetSymbol}
                    onChange={(e) => setTargetSymbol(e.target.value)}
                    placeholder="e.g. DMD, CFTR, SMN2"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>

                <div>
                  <FieldLabel hint="What type of isoform switching do you want to achieve?">
                    Isoform Goal <span className="text-red-500">*</span>
                  </FieldLabel>
                  <select
                    value={isoformGoal}
                    onChange={(e) => setIsoformGoal(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">Select isoform goal</option>
                    {options?.isoformGoals.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {isoformGoal && (
                    <p className="mt-1 text-[10.5px] text-slate-400">
                      {options?.isoformGoals.find((o) => o.id === isoformGoal)?.description}
                    </p>
                  )}
                </div>

                <div>
                  <FieldLabel hint="The exon locus you want to target for isoform modulation">
                    Target Exon Locus <span className="text-red-500">*</span>
                  </FieldLabel>
                  <select
                    value={targetExonLocus}
                    onChange={(e) => setTargetExonLocus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">Select exon locus</option>
                    {options?.targetExonLoci.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel hint="Which splice regulatory element should the ASO target?">
                    Splice Element Target <span className="text-red-500">*</span>
                  </FieldLabel>
                  <select
                    value={spliceElementTarget}
                    onChange={(e) => setSpliceElementTarget(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">Select splice element</option>
                    {options?.spliceElementTargets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel hint="Steric-blocking chemistry for splice modulation">
                    Steric Chemistry <span className="text-red-500">*</span>
                  </FieldLabel>
                  <select
                    value={stericChemistry}
                    onChange={(e) => setStericChemistry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">Select chemistry</option>
                    {options?.stericChemistries.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enforceInFrame}
                      onChange={(e) => setEnforceInFrame(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    <span className="text-[13px] text-slate-700">Enforce In-Frame splicing</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end px-6 pb-5">
                <button
                  onClick={handleGenerate}
                  disabled={!isFormValid() || loading}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Generating Constructs..." : "Generate Constructs / Candidates"}
                </button>
              </div>
            </Card>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {results && (
            <>
              <Card>
                <SectionHeader
                  step="2"
                  title="Header & Construct Overview"
                  right={
                    <button
                      onClick={handleReset}
                      className="text-[12px] font-medium text-slate-500 hover:text-slate-700"
                    >
                      Modify Parameters
                    </button>
                  }
                />
                <div className="px-6 pb-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-3">
                      <InfoField label="Target Gene & Wild-Type RefSeq" value={`${results.overview.targetGene} · ${results.overview.refSeq}`} />
                      <InfoField label="Selected Isoform Goal" value={isoformGoal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} />
                      <InfoField label="Native Protein Length" value={results.overview.nativeLength} />
                    </div>
                    <div className="space-y-3">
                      <InfoField label="Codon Adaptation Index (CAI)" value={results.overview.cai.toFixed(2)} valueClassName={results.overview.cai >= 0.92 ? "text-emerald-600" : "text-amber-600"} />
                      <InfoField label="Uridine Percentage (U%)" value={`${results.overview.uContent.toFixed(1)}%`} valueClassName={results.overview.uContent < 20 ? "text-emerald-600" : "text-amber-600"} />
                      <InfoField label="Predicted Intracellular Half-Life" value={results.overview.predictedHalfLife} />
                    </div>
                    <div className="space-y-3">
                      <InfoField label="Primary Mechanism Assigned" value={results.overview.primaryMechanism} />
                      <InfoField label="Expression Feasibility Score" value={`${results.overview.feasibilityScore}/100`} valueClassName={results.overview.feasibilityScore >= 80 ? "text-emerald-600" : "text-amber-600"} />
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionHeader step="3" title="Candidate Construct Table" />
                <div className="px-5 pb-5 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Rank</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Construct ID</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Modality</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">CAI</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">U%</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">MFE</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Splice %</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Isoform Yield</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">TLR Risk</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">In-Frame</th>
                        <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Structure</th>
                        <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.candidates.map((c) => (
                        <tr
                          key={c.constructId}
                          className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer ${selectedCandidate?.constructId === c.constructId ? "bg-brand/5" : ""}`}
                          onClick={() => handleSelectCandidate(c)}
                        >
                          <td className="py-3 pr-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                              {c.rank}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className="text-[11.5px] font-semibold text-slate-800 font-mono">{c.constructId}</span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className="text-[11px] text-slate-600">{c.modality}</span>
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <span className={`text-[11.5px] font-semibold ${c.cai >= 0.92 ? "text-emerald-600" : "text-amber-600"}`}>
                              {c.cai.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <span className={`text-[11.5px] font-semibold ${c.uContent < 20 ? "text-emerald-600" : "text-amber-600"}`}>
                              {c.uContent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <span className="text-[11.5px] font-mono text-slate-700">{c.mfe.toFixed(1)}</span>
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <span className={`text-[11.5px] font-semibold ${c.spliceEfficiency >= 85 ? "text-emerald-600" : c.spliceEfficiency >= 70 ? "text-amber-600" : "text-red-600"}`}>
                              {c.spliceEfficiency}%
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <Pill tone={c.predictedIsoformYield.includes("High") ? "green" : c.predictedIsoformYield.includes("Medium") ? "blue" : "amber"}>
                              {c.predictedIsoformYield}
                            </Pill>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.tlrRisk.includes("Very Low") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : c.tlrRisk.includes("Low") ? "border-blue-200 bg-blue-50 text-blue-700" : c.tlrRisk.includes("Moderate") ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                              {c.tlrRisk}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.inFrameStatus === "In-Frame" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                              {c.inFrameStatus}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.secondaryStructureFlag === "PASSED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                              {c.secondaryStructureFlag}
                            </span>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectCandidate(c); }}
                              className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-white transition-colors"
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-5">
                <SectionHeader step="3a" title="Candidate Analysis & Visualizations" />
                <div className="px-5 pb-5">
                  <IsoformAnalysisDashboard candidates={results.candidates} />
                </div>
              </Card>

              {selectedCandidate && (
                <div ref={selectedCandidateRef}>
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-slate-100">
                    <SectionHeader step="3b" title={`Inspection: ${selectedCandidate.constructId}`} />
                    <button onClick={() => setSelectedCandidate(null)} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="px-6 pb-5 space-y-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Full Transcript Feature Map</p>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 overflow-x-auto">
                        <div className="flex items-center gap-1 min-w-[600px]">
                          {selectedCandidate.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <div className={`flex flex-col items-center rounded-md px-2 py-1.5 text-[10px] font-medium text-center min-w-[70px] ${f.type === "utr" ? "bg-blue-50 text-blue-600" : f.type === "kozak" ? "bg-emerald-50 text-emerald-600" : f.type === "orf" ? "bg-slate-200 text-slate-700" : f.type === "exon" ? "bg-indigo-50 text-indigo-700" : f.type === "intron" ? "bg-amber-50 text-amber-700" : f.type === "splice" ? "bg-purple-50 text-purple-700" : f.type === "scarsplice" ? "bg-teal-50 text-teal-700" : f.type === "polyA" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
                                <span className="font-mono text-[9px] opacity-70">{f.start}-{f.end}</span>
                                <span className="leading-tight">{f.name}</span>
                              </div>
                              {i < selectedCandidate.features.length - 1 && <span className="text-slate-300 text-[10px]">→</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Construct Transcript Sequence (5' → 3')</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 font-mono text-[11px] text-emerald-400 break-all leading-relaxed select-all">
                          {selectedCandidate.sequence}
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(selectedCandidate.sequence); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-white transition-colors">
                          {copied ? <><Check className="h-3 w-3 text-emerald-500" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Amino Acid Sequence Identity</p>
                        <p className="text-[14px] font-bold text-emerald-600">{selectedCandidate.diagnostics.aminoAcidIdentity}%</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Match with wild-type functional protein</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Splice Site Score</p>
                        <p className="text-[14px] font-bold text-slate-700">{selectedCandidate.diagnostics.spliceSiteScore.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">MaxEntScan-like splice site strength</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">TLR3 / TLR7 / TLR8 Risk</p>
                        <p className="text-[14px] font-bold text-slate-700">{selectedCandidate.diagnostics.tlr3Score} / {selectedCandidate.diagnostics.tlr7Score} / {selectedCandidate.diagnostics.tlr8Score}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Innate immune receptor activation risk</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">5' UTR / Ribosome Entry Secondary Structure (ViennaRNA MFE)</p>
                      <div className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-3 font-mono text-[11px] text-slate-300 break-all leading-relaxed">
                        {selectedCandidate.diagnostics.mfePlot}
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${selectedCandidate.diagnostics.fiveUtrHairpin ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                          {selectedCandidate.diagnostics.fiveUtrHairpin ? "FAILED — 5' UTR Hairpin Obstacle Detected" : "PASSED — No 5' UTR Hairpin Obstacles"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
                </div>
              )}

              <Card>
                <SectionHeader step="4" title="Downstream Action & Export" />
                <div className="px-6 pb-5 flex flex-wrap items-center gap-3">
                  <button onClick={() => { const blob = new Blob([results.candidates.map((c) => `>${c.constructId}\n${c.sequence}`).join("\n\n")], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${targetSymbol}_isoform_constructs.fasta`; a.click(); URL.revokeObjectURL(url); }} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <Download className="h-4 w-4" /> Export Candidate Sequences to FASTA
                  </button>
                  <button onClick={() => alert("Splice Modulation & ASO Synthesis module is under development.")} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <FlaskConical className="h-4 w-4" /> Proceed to Splice Modulation & ASO Synthesis
                  </button>
                  <button onClick={() => alert("IVT Plasmid Template & Synthesis Protocol generation is under development.")} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <FileText className="h-4 w-4" /> Generate IVT Plasmid Template & Synthesis Protocol
                  </button>
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
