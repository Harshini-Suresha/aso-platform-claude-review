"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Dna, Beaker, Download, ChevronDown, Mail } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import TargetAnalysisCard from "@/components/TargetAnalysisCard";
import AssoDesignForm from "@/components/AssoDesignForm";
import AssoCandidateCard from "@/components/AssoCandidateCard";
import AsoAnalysisDashboard from "@/components/AsoAnalysisDashboard";
import { Card, SectionHeader } from "@/components/ui";
import { GeneTargetObject } from "@/types/gene";
import { TargetAnalysis, DesignOptions, GenerateResponse, ClinVarVariant } from "@/types/geneSilencing";
import {
  fetchTargetAnalysis,
  fetchDesignOptions,
  generateCandidates,
  emailAsoReport,
  fetchClinVarVariants,
} from "@/lib/geneSilencingApi";
import { saveReport } from "@/lib/auth";
import { parseHgvsC } from "@/lib/hgvsParser";
import { HgvsParseResult } from "@/lib/hgvsParser";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";
const SELECTED_MECHANISM_KEY = "aso:selectedMechanism";
const PROJECT_TARGET_TISSUE_KEY = "aso:projectTargetTissue";

// Map free-text target tissue to deliveryContext dropdown values
function mapTargetTissueToDeliveryContext(tissue: string): string {
  const t = tissue.toLowerCase().trim();
  if (t.includes("liver") || t.includes("hepatic")) return "liver";
  if (t.includes("kidney") || t.includes("renal")) return "kidney";
  if (t.includes("brain") || t.includes("cns") || t.includes("central nervous")) return "cns";
  if (t.includes("muscle") || t.includes("skeletal") || t.includes("myocyte")) return "muscle";
  if (t.includes("heart") || t.includes("cardiac") || t.includes("myocard")) return "heart";
  if (t.includes("lung") || t.includes("pulmonary") || t.includes("respiratory")) return "lung";
  if (t.includes("eye") || t.includes("retina") || t.includes("ocular") || t.includes("vitreous")) return "eye";
  if (t.includes("tumor") || t.includes("cancer") || t.includes("neoplasm") || t.includes("malignan")) return "tumor";
  if (t.includes("blood") || t.includes("bone marrow") || t.includes("hematopoietic") || t.includes("leukemia") || t.includes("lymphoma")) return "blood";
  if (t.includes("skin") || t.includes("dermal") || t.includes("epidermal") || t.includes("cutaneous")) return "skin";
  if (t.includes("pancreas") || t.includes("pancreatic")) return "pancreas";
  if (t.includes("gut") || t.includes("intestine") || t.includes("intestinal") || t.includes("colon") || t.includes("bowel")) return "gut";
  if (t.includes("spinal") || t.includes("cord")) return "spinal cord";
  return "";
}

export default function GeneSilencingPage() {
  const router = useRouter();

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [mechanism, setMechanism] = useState<{ id: string; name: string } | null>(null);
  const [silencingScope, setSilencingScope] = useState<string | null>(null);
  const [defectType, setDefectType] = useState<string | null>(null);
  const [therapeuticGoal, setTherapeuticGoal] = useState<string | null>(null);

  const [target, setTarget] = useState<TargetAnalysis | null>(null);
  const [targetLoading, setTargetLoading] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);

  const [options, setOptions] = useState<DesignOptions | null>(null);

  const [selectedExons, setSelectedExons] = useState<number[]>([]);
  const [isTotalKnockdown, setIsTotalKnockdown] = useState(false);
  const [asoLength, setAsoLength] = useState(18);
  const [chemistry, setChemistry] = useState("gapmer");
  const [selectedMods, setSelectedMods] = useState<string[]>(["phosphorothioate"]);
  const [deliveryContext, setDeliveryContext] = useState("");
  const [knownVariant, setKnownVariant] = useState("");
  const [parsedVariant, setParsedVariant] = useState<HgvsParseResult | null>(null);
  const [clinvarVariants, setClinvarVariants] = useState<ClinVarVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const isAlleleSpecific = silencingScope === "allele_specific";

  const [results, setResults] = useState<GenerateResponse | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function triggerDownload(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    if (!results) return;
    const header = "Rank,Sequence,Length,GC%,Tm (C),MFE,Duplex Energy,Target Region,Chemistry,Modifications,Exon,CPG Count,Purine Content,Complexity,Molecular Weight,Extinction Coeff\n";
    const body = results.candidates.map((c, i) =>
      `${i + 1},${c.sequence},${c.length},${c.realMetrics.gcContent},${c.realMetrics.meltingTempC},${c.realMetrics.selfStructureMfe},${c.realMetrics.targetDuplexEnergy},"${c.targetRegion}",${c.chemistry},"${c.modifications.join("; ")}",${c.exonNumber ?? ""},${c.realMetrics.cpgCount},${c.realMetrics.purineContent},${c.realMetrics.sequenceComplexity},${c.realMetrics.molecularWeight},${c.realMetrics.extinctionCoefficient}`
    ).join("\n");
    triggerDownload(header + body, `${gene?.geneSymbol ?? "aso"}-candidates.csv`, "text/csv");
    setShowExport(false);
  }

  function exportTsv() {
    if (!results) return;
    const header = "Rank\tSequence\tLength (nt)\tGC (%)\tTm (C)\tSelf-structure MFE\tTarget duplex ΔG\tTarget region\tChemistry\tModifications\tExon\n";
    const body = results.candidates.map((c, i) =>
      [i + 1, c.sequence, c.length, c.realMetrics.gcContent, c.realMetrics.meltingTempC, c.realMetrics.selfStructureMfe, c.realMetrics.targetDuplexEnergy, c.targetRegion, c.chemistry, c.modifications.join("; "), c.exonNumber ?? ""].join("\t")
    ).join("\n");
    triggerDownload(header + body, `${gene?.geneSymbol ?? "aso"}-candidates.tsv`, "text/tab-separated-values");
    setShowExport(false);
  }

  function exportJson() {
    if (!results) return;
    triggerDownload(JSON.stringify(results, null, 2), `${gene?.geneSymbol ?? "aso"}-results.json`, "application/json");
    setShowExport(false);
  }

  function exportFasta() {
    if (!results) return;
    const content = results.candidates.map((c, i) =>
      `>ASO_${i + 1} rank=${i + 1} region=${c.targetRegion} gc=${c.realMetrics.gcContent}% tm=${c.realMetrics.meltingTempC}C\n${c.sequence.match(/.{1,80}/g)?.join("\n") || c.sequence}`
    ).join("\n\n");
    triggerDownload(content, `${gene?.geneSymbol ?? "aso"}-sequences.fasta`, "text/plain");
    setShowExport(false);
  }

  function buildReportContent() {
    if (!results || !gene) return;
    const lines = [
      "═══════════════════════════════════════════════════",
      "  ASO DESIGN REPORT",
      `  ${gene.geneSymbol} — ${mechanism?.name ?? results.mechanismId}`,
      "═══════════════════════════════════════════════════",
      "",
      `  Gene:          ${gene.geneSymbol} (${gene.geneName ?? "—"})`,
      `  Organism:      ${gene.organism ?? "—"}`,
      `  Mechanism:     ${mechanism?.name ?? results.mechanismId}`,
      `  Chemistry:     ${results.chemistry}`,
      `  ASO Length:    ${results.asoLength} nt`,
      `  Modifications: ${results.modifications.join(", ")}`,
      `  Candidates:    ${results.candidates.length}`,
      `  Target scope:  ${isAlleleSpecific ? `Allele-specific — variant ${knownVariant || "selected"}` : results.targetExons?.length ? `Exons ${results.targetExons.join(", ")}` : "Total transcript"}`,
      `  Ranked by:     Composite score (0.65×duplex ΔG + 0.35×Tm fit)`,
      "",
    ];
    if (results.mechanismNotes) lines.push(`  Mechanism note: ${results.mechanismNotes}`, "");
    lines.push(
      "───────────────────────────────────────────────────",
      "  RESULTS",
      "───────────────────────────────────────────────────",
      "  Lower (more negative) target duplex ΔG indicates stronger predicted",
      "  binding of the antisense ASO to its target window. Candidates are ranked",
      "  by a composite design score built exclusively from real metrics: the",
      "  ViennaRNA target-duplex ΔG plus the chemistry-adjusted Tm fit. Heuristic",
      "  drug-like estimates are reported per candidate but do not affect ranking.",
      ""
    );
    results.candidates.forEach((c, i) => {
      lines.push(
        `  #${i + 1}  ${c.targetRegion}`,
        `    Sequence:     ${c.sequence}`,
        `    Length:       ${c.length} nt`,
        `    GC Content:   ${c.realMetrics.gcContent}%`,
        `    Melting Temp: ${c.realMetrics.meltingTempC} C`,
        `    MFE:          ${c.realMetrics.selfStructureMfe} kcal/mol`,
        `    Duplex Energy:${c.realMetrics.targetDuplexEnergy} kcal/mol`,
        `    Composite:    ${c.compositeScore}/100`,
        `    Chemistry:    ${c.chemistry}`,
        `    Modifications:${c.modifications.join(", ") || "None selected"}`,
        `    Nuclease resistance (est.): ${c.heuristicEstimates.nucleaseResistance.value}/100`,
        `    Cellular uptake (est.):     ${c.heuristicEstimates.cellularUptake.value}/100`,
        `    Off-target risk (est.):     ${c.heuristicEstimates.offTargetRisk.value}/100`,
        `    Immune stimulation (est.):  ${c.heuristicEstimates.immuneStimulation.value}/100`,
        `    Purine %:     ${c.realMetrics.purineContent}`,
        `    Complexity:   ${c.realMetrics.sequenceComplexity}`,
        ...(c.alleleSpecific
          ? [
              `    Allele-specific: yes (spans ${c.knownVariant || "variant"})`,
              c.alleleDiscriminationScore != null
                ? `    Allele discrimination: ${(c.alleleDiscriminationScore * 100).toFixed(0)}/100 (mismatch proximity to RNase H gap center)`
                : "",
              c.alleleDiscriminationNote ? `    Allele note: ${c.alleleDiscriminationNote}` : "",
            ].filter(Boolean)
          : []),
        ""
      );
    });
    lines.push(
      "───────────────────────────────────────────────────",
      "  INTERPRETATION",
      "───────────────────────────────────────────────────",
      "  These are computational design candidates, not experimentally validated",
      "  therapeutic recommendations. Confirm target accessibility, specificity,",
      "  cellular activity, and safety experimentally before further use.",
      "═══════════════════════════════════════════════════"
    );
    return lines.join("\n");
  }

  function exportReport() {
    const content = buildReportContent();
    if (!content || !gene) return;
    triggerDownload(content, `${gene.geneSymbol}-design-report.txt`, "text/plain");
    setShowExport(false);
  }

  function collectVisualizationSvg(): string {
    const root = document.getElementById("aso-analysis-dashboard");
    if (!root) return "";
    const svgs = Array.from(root.querySelectorAll("svg"));
    if (!svgs.length) return "";
    const gallery = svgs
      .map((svg) => {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.removeAttribute("class");
        clone.setAttribute("width", "100%");
        clone.setAttribute("height", "auto");
        clone.setAttribute("style", "width:100%;height:auto;display:block");
        return `<div style="margin:24px 0;border:1px solid #e2e8f0;border-radius:12px;padding:20px;background:#fff;overflow:hidden">${new XMLSerializer().serializeToString(clone)}</div>`;
      })
      .join("");
    return `<h2 style="font-family:ui-monospace,monospace;font-size:16px;margin:32px 0 8px;color:#0f172a">VISUALIZATIONS</h2><p style="font-family:ui-monospace,monospace;font-size:12px;color:#64748b;margin:0">Charts captured from the analysis dashboard.</p>${gallery}`;
  }

  function exportHtmlReport() {
    const content = buildReportContent();
    if (!content || !gene) return;
    const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    triggerDownload(`<!doctype html><html><head><meta charset="utf-8"><title>ASO Design Report</title></head><body style="font-family:ui-monospace,monospace;white-space:pre-wrap;line-height:1.5;padding:32px;color:#1e293b">${escaped}<hr style="border:none;border-top:2px solid #e2e8f0;margin:32px 0">${collectVisualizationSvg()}</body></html>`, `${gene.geneSymbol}-design-report.html`, "text/html");
    setShowExport(false);
  }

  async function emailReport() {
    const content = buildReportContent();
    if (!content || !gene) return;
    setEmailSending(true);
    setEmailStatus(null);
    try {
      const response = await emailAsoReport(content, `${gene.geneSymbol}-design-report.txt`);
      setEmailStatus(response.message);
    } catch (error) {
      setEmailStatus(error instanceof Error ? error.message : "Could not email the report.");
    } finally {
      setEmailSending(false);
    }
  }

  // Load gene + mechanism from sessionStorage
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
        setSilencingScope(parsed.silencingScope ?? null);
        setDefectType(parsed.defectType ?? null);
        setTherapeuticGoal(parsed.therapeuticGoal ?? null);
        setKnownVariant(parsed.knownVariant ?? "");
        setParsedVariant(parsed.parsedVariant ?? null);
      } catch { setMechanism(null); }
    }

    // Load project target tissue and map to deliveryContext
    const projectTissue = sessionStorage.getItem(PROJECT_TARGET_TISSUE_KEY);
    if (projectTissue) {
      const mapped = mapTargetTissueToDeliveryContext(projectTissue);
      if (mapped) {
        setDeliveryContext(mapped);
      }
    }
  }, []);

  // Fetch target analysis when gene loads
  useEffect(() => {
    if (!gene?.geneId) return;
    setTargetLoading(true);
    setTargetError(null);
    fetchTargetAnalysis(gene.geneId, gene.geneSymbol ?? undefined, gene.organism ?? undefined)
      .then(setTarget)
      .catch((e) => setTargetError(e instanceof Error ? e.message : "Failed to load target."))
      .finally(() => setTargetLoading(false));
  }, [gene?.geneId]);

  // Fetch design options
  useEffect(() => {
    fetchDesignOptions().then(setOptions).catch(() => {});
  }, []);

  // Fetch ClinVar variants for allele-specific targeting
  useEffect(() => {
    if (!gene?.geneId || !isAlleleSpecific) return;
    setVariantsLoading(true);
    fetchClinVarVariants(gene.geneId)
      .then(setClinvarVariants)
      .catch(() => setClinvarVariants([]))
      .finally(() => setVariantsLoading(false));
  }, [gene?.geneId, isAlleleSpecific]);

  function handleToggleMod(id: string) {
    setSelectedMods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
    setResults(null);
  }

  function handleToggleExon(idx: number) {
    setSelectedExons((prev) =>
      prev.includes(idx) ? prev.filter((e) => e !== idx) : [...prev, idx]
    );
    setResults(null);
  }

  function handleSelectAllExons(allIndices: number[]) {
    setSelectedExons((prev) =>
      prev.length === allIndices.length ? [] : [...allIndices]
    );
  }

  function handleToggleTotalKnockdown() {
    setIsTotalKnockdown((prev) => {
      if (!prev) setSelectedExons([]);
      return !prev;
    });
    setResults(null);
  }

  async function handleGenerate() {
    if (!gene?.geneId) return;
    if (!mechanism?.id) {
      setGenError("Select a mechanism before generating candidates.");
      return;
    }
    setGenLoading(true);
    setGenError(null);
    setResults(null);
    try {
      const res = await generateCandidates({
        ensemblGeneId: gene.geneId,
        mechanismId: mechanism.id,
        targetExonIndices: isTotalKnockdown || isAlleleSpecific ? null : selectedExons,
        asoLength,
        chemistry,
        modifications: selectedMods,
        deliveryContext: deliveryContext || undefined,
        defectType: defectType || undefined,
        silencingScope: silencingScope || undefined,
        knownVariant: knownVariant || undefined,
      });
      setResults(res);
      saveReport({
        step: "aso_design",
        title: `ASO Design: ${gene.geneSymbol} — ${mechanism.name}`,
        geneSymbol: gene.geneSymbol,
        disease: gene.disease || "",
        summary: `Generated ${res.candidates.length} ASO candidates for ${mechanism.name}. Top candidate: ${res.candidates[0]?.targetRegion || "N/A"}.`,
        data: { mechanismId: mechanism.id, mechanismName: mechanism.name, candidateCount: res.candidates.length },
      });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenLoading(false);
    }
  }

  // No gene → redirect
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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50">
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

           {/* Step 4: ASO Design */}
           <Card>
             <SectionHeader step="4" title={therapeuticGoal === "TG04" ? "RNA Processing Modulation — ASO Design" : "Gene Silencing — ASO Design"} />
               <p className="px-6 pb-3 text-[12.5px] text-slate-500">
               {therapeuticGoal === "TG04"
                 ? "Design antisense oligonucleotides for RNA processing modulation. Select an exon, choose chemistry and modifications, then generate candidates."
                 : mechanism?.id === "A2"
                   ? "Translation-blocking candidates are restricted to the 5′ translation-initiation region."
                   : mechanism?.id === "A21"
                     ? "RNA interference (A21) requires a double-stranded siRNA duplex, which the single-stranded ASO designer does not support."
                     : "Design antisense oligonucleotides targeting the confirmed gene. Select an exon, choose chemistry and modifications, then generate candidates."}
             </p>
           </Card>

          {/* Step 1: Target Analysis */}
          {targetLoading ? (
            <Card className="flex items-center gap-3 px-6 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <span className="text-[13px] text-slate-500">Loading target analysis...</span>
            </Card>
          ) : targetError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {targetError}
            </div>
          ) : target ? (
            <TargetAnalysisCard
              target={target}
              selectedExons={selectedExons}
              isTotalKnockdown={isTotalKnockdown}
              onToggleTotalKnockdown={handleToggleTotalKnockdown}
              showTargetingMode={!isAlleleSpecific}
            />
          ) : null}

          {/* Step 1a: Target Selection — Exon picker */}
          {target && !targetLoading && !isTotalKnockdown && !isAlleleSpecific && mechanism?.id !== "A2" && (
            <Card className="p-5">
              <SectionHeader step="1a" title="Target Selection" />
              <div className="px-5 pb-5">
                <p className="mb-3 text-[12px] text-slate-500">
                  {isTotalKnockdown
                    ? "Total Transcript Knockdown — all exons will be targeted."
                    : `Select exon(s) to target. ${selectedExons.length > 0 ? `${selectedExons.length} exon(s) selected.` : "At least one exon required."}`}
                </p>
                {!isTotalKnockdown && target.exons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {target.exons.map((exon) => {
                      const idx = exon.index ?? 0;
                      const isSelected = selectedExons.includes(idx);
                      return (
                        <button
                          key={exon.id ?? idx}
                          onClick={() => handleToggleExon(idx)}
                          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                            isSelected
                              ? "bg-brand text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Exon {idx}{exon.length ? ` · ${exon.length}bp` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!isTotalKnockdown && selectedExons.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Targeting: {selectedExons.sort((a, b) => a - b).join(", ")}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Step 1a: Allele-Specific Targeting */}
          {target && !targetLoading && isAlleleSpecific && mechanism?.id !== "A2" && (
            <Card className="p-5">
              <SectionHeader step="1a" title="Allele-Specific Targeting" />
              <div className="px-5 pb-5">
                <div className="rounded-lg border border-brand/20 bg-brand/5 px-4 py-3">
                  <p className="text-[12.5px] font-medium text-brand">
                    {knownVariant
                      ? `Targeting variant: ${knownVariant}`
                      : "Allele-specific silencing selected"}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                    ASOs will be generated across the transcript and ranked to prioritise candidates whose binding window spans{" "}
                    {knownVariant ? <strong>{knownVariant}</strong> : "the pathogenic variant"}, sparing the wild-type allele. No exon selection needed.
                  </p>

                  {/* Variant picker */}
                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-medium text-slate-600">
                        Choose a known variant (ClinVar)
                      </p>
                      <select
                        value={clinvarVariants.some((v) => v.hgvsc === knownVariant) ? knownVariant : ""}
                        onChange={(e) => {
                          const hgvs = e.target.value;
                          setKnownVariant(hgvs);
                          setParsedVariant(hgvs ? parseHgvsC(hgvs) : null);
                          setResults(null);
                        }}
                        disabled={variantsLoading}
                        className="mt-1 w-full rounded-lg border border-brand/30 bg-white px-3 py-2 text-[12.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
                      >
                        <option value="">
                          {variantsLoading
                            ? "Loading ClinVar variants…"
                            : clinvarVariants.length
                              ? "Select a variant…"
                              : "No ClinVar variants available for this gene"}
                        </option>
                        {clinvarVariants.map((v, i) => (
                          <option key={v.variantId ?? i} value={v.hgvsc || v.hgvsp}>
                            {v.hgvsc || v.hgvsp}
                            {v.clinicalSignificance ? ` — ${v.clinicalSignificance}` : ""}
                            {v.rsid ? ` · ${v.rsid}` : ""}
                            {v.goldStars ? ` · ★${v.goldStars}` : ""}
                          </option>
                        ))}
                      </select>
                      {clinvarVariants.length > 0 && !variantsLoading && (
                        <p className="mt-1 text-[10.5px] text-slate-400">
                          {clinvarVariants.length} pathogenic variant{clinvarVariants.length !== 1 ? "s" : ""} loaded from ClinVar.
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-600">
                        Or enter a variant manually
                      </p>
                      <input
                        type="text"
                        value={knownVariant}
                        onChange={(e) => {
                          setKnownVariant(e.target.value);
                          setParsedVariant(parseHgvsC(e.target.value));
                          setResults(null);
                        }}
                        placeholder="e.g. c.1521_1523delCTT"
                        className="mt-1 w-full rounded-lg border border-brand/30 bg-white px-3 py-2 text-[12.5px] text-slate-700 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>

                  {knownVariant.trim() && (() => {
                    const p = parsedVariant ?? parseHgvsC(knownVariant);
                    if (p && p.parsed) {
                      return (
                        <p className="mt-2 rounded-md bg-emerald-50 px-3 py-1.5 text-[11.5px] text-emerald-700">
                          Parsed position: CDS index {p.cdsStart}
                          {p.cdsStart !== p.cdsEnd ? `–${p.cdsEnd}` : ""} ({p.type})
                          {p.length != null && p.length > 1 ? `, ${p.length} bp` : ""} — candidates will be
                          ranked by mismatch proximity to the RNase H gap center.
                        </p>
                      );
                    }
                    return (
                      <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-700">
                        {p?.reason ??
                          "Could not parse the variant to a CDS coordinate. Candidates will be generated, but none can be verified to discriminate mutant from wild-type."}
                      </p>
                    );
                  })()}
                  {!knownVariant.trim() && (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-700">
                      Allele-specific ranking without a variant position can only confirm a mechanism
                      supports this approach in principle — it can't verify a specific candidate will
                      discriminate mutant from wild-type.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Steps 2 + 3: Design Form + Results */}
          <div className="space-y-5">
             <div className="space-y-4">
                {/* ASO Design Parameters */}
                <Card className="p-5">
                <SectionHeader step="2" title="ASO Design Parameters" />
                <div className="px-5 pb-5">
                  {mechanism?.id === "A2" && (
                    <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11.5px] leading-relaxed text-blue-700">
                      Translation-blocking designs target the 5′ translation-initiation region. Exon selection is not applicable for this mechanism.
                    </p>
                  )}
                  {mechanism?.id === "A21" && (
                    <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-700">
                      A21 (RNA interference) is a double-stranded duplex modality — it cannot be designed with the single-stranded ASO designer. Choose a single-stranded mechanism (A1, A2, A12, or A15) to generate candidates.
                    </p>
                  )}
                  <AssoDesignForm
                    options={options}
                    asoLength={asoLength}
                    setAsoLength={(length) => { setAsoLength(length); setResults(null); }}
                    chemistry={chemistry}
                    setChemistry={(selectedChemistry) => { setChemistry(selectedChemistry); setResults(null); }}
                    selectedMods={selectedMods}
                    onToggleMod={handleToggleMod}
                     onGenerate={handleGenerate}
                     loading={genLoading}
                     disabled={!target || mechanism?.id === "A21" || (!isTotalKnockdown && !isAlleleSpecific && selectedExons.length === 0)}
                     hasResults={!!results}
                   />
                  {results && (
                    <button
                      onClick={() => { setResults(null); setGenError(null); }}
                      className="mt-3 w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-[12.5px] font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Reset & choose different options
                    </button>
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-3">
              <SectionHeader
                step="3"
                title="Generated ASO Candidates"
              />

              {emailStatus && (
                <p className={`rounded-lg px-3 py-2 text-[11.5px] ${emailStatus.startsWith("Report emailed") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {emailStatus}
                </p>
              )}

              {genError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {genError}
                </div>
              )}

              {results && results.isAlleleSpecific && results.variantParse && !results.variantParse.parsed && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    The variant "{results.candidates[0]?.knownVariant || knownVariant}" could not be parsed
                    to a CDS coordinate ({results.variantParse.reason?.toLowerCase() ?? "unrecognized format"}).
                    The candidates below are ranked by composite score only — none can be verified to
                    discriminate mutant from wild-type.
                  </span>
                </div>
              )}

              {!results && !genLoading && (
                <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <Beaker className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-[13px] font-medium text-slate-500">
                  {isAlleleSpecific
                    ? `Click Generate to create allele-specific ASO candidates${knownVariant ? ` for ${knownVariant}` : ""}`
                    : isTotalKnockdown
                    ? "Click Generate to create ASO candidates for total transcript knockdown"
                    : "Select exon(s) and click Generate to create ASO candidates"}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-400">
                    Candidates are ranked by composite score from real metrics (target duplex ΔG + Tm fit)
                  </p>
                </Card>
              )}

              {results && results.candidates.length === 0 && (
                <Card className="px-6 py-8 text-center">
                  <p className="text-[13px] text-slate-500">
                    No valid candidates generated for this configuration. Try a different exon, length, or chemistry.
                  </p>
                </Card>
              )}

              {results && results.candidates.length > 0 && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Card className="flex flex-col gap-3 p-5">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">Email report</p>
                        <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
                          Sends the complete ASO design report to your inbox, including all generated candidates, their predicted properties, and analysis details.
                        </p>
                      </div>
                      <button
                        onClick={emailReport}
                        disabled={emailSending}
                        className="mt-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {emailSending ? "Sending…" : "Email report"}
                      </button>
                      {emailStatus && (
                        <p className={`rounded-lg px-3 py-2 text-[11.5px] ${emailStatus.startsWith("Report emailed") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {emailStatus}
                        </p>
                      )}
                    </Card>

                    <Card className="flex flex-col gap-3 p-5">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">Download report</p>
                        <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
                          Export your ASO design data in multiple formats for offline analysis, sharing, or integration with other tools and pipelines.
                        </p>
                      </div>
                      <div className="mt-auto relative inline-block">
                        <button
                          onClick={() => setShowExport(!showExport)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
                          aria-expanded={showExport}
                          aria-haspopup="menu"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download report
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {showExport && (
                          <div ref={exportRef} role="menu" className="absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                            <button onClick={exportCsv} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">CSV summary</button>
                            <button onClick={exportTsv} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">TSV spreadsheet</button>
                            <button onClick={exportJson} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">Raw JSON</button>
                            <button onClick={exportFasta} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">FASTA sequences</button>
                            <button onClick={exportReport} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">Detailed text report</button>
                            <button onClick={exportHtmlReport} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">HTML report</button>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  <p className="text-[12.5px] text-slate-500">
                    {results.candidates.length} candidate{results.candidates.length !== 1 ? "s" : ""} for{" "}
                    {isAlleleSpecific
                      ? `variant ${knownVariant || "allele-specific targeting"}`
                      : results.targetExons && results.targetExons.length > 0
                      ? `Exons ${results.targetExons.join(", ")}`
                      : "all exons (total knockdown)"}{" "}
                    &middot; {results.mechanismId} &middot; {results.chemistry} &middot; {results.asoLength} nt
                  </p>
                  {results.mechanismNotes && (
                    <p className="text-[11.5px] text-slate-400 italic mb-3">{results.mechanismNotes}</p>
                  )}
                  <AsoAnalysisDashboard candidates={results.candidates} />
                  {results.candidates.map((c, i) => (
                    <AssoCandidateCard key={c.sequence} candidate={c} rank={i + 1} />
                  ))}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
