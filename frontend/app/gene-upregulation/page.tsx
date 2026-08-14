"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Dna, Beaker, Download, ChevronDown, Filter } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import TargetAnalysisCard from "@/components/TargetAnalysisCard";
import AssoDesignForm from "@/components/AssoDesignForm";
import AssoCandidateCard from "@/components/AssoCandidateCard";
import AsoReportCard from "@/components/AsoReportCard";
import AsoVisualizationSuite from "@/components/AsoVisualizationSuite";
import { Card, SectionHeader, FieldLabel } from "@/components/ui";
import { GeneTargetObject } from "@/types/gene";
import { TargetAnalysis, DesignOptions } from "@/types/geneSilencing";
import { UpregulationDesignOptions } from "@/types/geneUpregulation";
import { AsoReportContext } from "@/lib/asoReport";
import {
  fetchUpregulationTargetAnalysis,
  fetchUpregulationDesignOptions,
  generateUpregulationCandidates,
} from "@/lib/geneUpregulationApi";
import { saveReport } from "@/lib/auth";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";
const SELECTED_MECHANISM_KEY = "aso:selectedMechanism";

export default function GeneUpregulationPage() {
  const router = useRouter();

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [mechanism, setMechanism] = useState<{ id: string; name: string } | null>(null);
  const [mechanismDetail, setMechanismDetail] = useState<Record<string, unknown> | null>(null);
  const [therapeuticGoal, setTherapeuticGoal] = useState<string | null>(null);
  const [defectType, setDefectType] = useState<string>("");
  const [knownRegulatoryElement, setKnownRegulatoryElement] = useState<string>("");

  const [target, setTarget] = useState<TargetAnalysis | null>(null);
  const [targetLoading, setTargetLoading] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);

  const [options, setOptions] = useState<UpregulationDesignOptions | null>(null);

  const [asoLength, setAsoLength] = useState(21);
  const [chemistry, setChemistry] = useState("gapmer");
  const [selectedMods, setSelectedMods] = useState<string[]>(["phosphorothioate"]);
  
  // TANGO-specific fields (mechanism A3 only)
  const [targetPoisonExon, setTargetPoisonExon] = useState<string>("");
  const [spliceElement, setSpliceElement] = useState<string>("");

  const [results, setResults] = useState<any>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [candidateViewMode, setCandidateViewMode] = useState<"top10" | "all">("top10");
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
     const header = "Rank,Sequence,Length,GC%,Tm (C),MFE,Duplex Energy,Target Region,Chemistry,Modifications,Purine Content,Complexity,Molecular Weight\n";
     const body = displayedCandidates.map((c: any, i: number) =>
       `${i + 1},${c.sequence},${c.length},${c.realMetrics.gcContent},${c.realMetrics.meltingTempC},${c.realMetrics.selfStructureMfe},${c.realMetrics.targetDuplexEnergy},"${c.targetRegion}",${c.chemistry},"${(c.modifications || []).join("; ")}",${c.realMetrics.purineContent},${c.realMetrics.sequenceComplexity},${c.realMetrics.molecularWeight}`
     ).join("\n");
     triggerDownload(header + body, `${gene?.geneSymbol ?? "aso"}-candidates.csv`, "text/csv");
     setShowExport(false);
   }

  function exportJson() {
    if (!results) return;
    triggerDownload(JSON.stringify(results, null, 2), `${gene?.geneSymbol ?? "aso"}-results.json`, "application/json");
    setShowExport(false);
  }

  function exportFasta() {
    if (!results) return;
    const content = displayedCandidates.map((c: any, i: number) =>
      `>ASO_${i + 1} rank=${i + 1} region=${c.targetRegion} gc=${c.realMetrics.gcContent}% tm=${c.realMetrics.meltingTempC}C\n${c.sequence.match(/.{1,80}/g)?.join("\n") || c.sequence}`
    ).join("\n\n");
    triggerDownload(content, `${gene?.geneSymbol ?? "aso"}-sequences.fasta`, "text/plain");
    setShowExport(false);
  }

  function exportReport() {
    const content = exportReportContent();
    if (!content || !gene) return;
    triggerDownload(content, `${gene.geneSymbol}-upregulation-report.txt`, "text/plain");
    setShowExport(false);
  }

  function collectVisualizationSvg(): string {
    const root = document.getElementById("aso-visualizations");
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
    const content = exportReportContent();
    if (!content || !gene) return;
    const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    triggerDownload(`<!doctype html><html><head><meta charset="utf-8"><title>Gene Upregulation Design Report</title></head><body style="font-family:ui-monospace,monospace;white-space:pre-wrap;line-height:1.5;padding:32px;color:#1e293b">${escaped}<hr style="border:none;border-top:2px solid #e2e8f0;margin:32px 0">${collectVisualizationSvg()}</body></html>`, `${gene.geneSymbol}-upregulation-report.html`, "text/html");
    setShowExport(false);
  }

  function exportReportContent(): string | null {
    if (!results || !gene) return null;
    const lines = [
      "═══════════════════════════════════════════════════",
      "  GENE UPREGULATION DESIGN REPORT",
      `  ${gene.geneSymbol} — ${mechanism?.name ?? results.mechanismId}`,
      "═══════════════════════════════════════════════════",
      "",
      `  Gene:          ${gene.geneSymbol} (${gene.geneName ?? "—"})`,
      `  Organism:      ${gene.organism ?? "—"}`,
      `  Mechanism:     ${mechanism?.name ?? results.mechanismId}`,
      `  Chemistry:     ${results.chemistry}`,
      `  ASO Length:    ${results.asoLength} nt`,
      `  Modifications: ${(results.modifications || []).join(", ")}`,
      `  Candidates:    ${displayedCandidates.length}${results.candidates.length !== displayedCandidates.length ? ` (of ${results.candidates.length} generated)` : ""}`,
      `  Ranked by:     Composite score (0.65×duplex ΔG + 0.35×Tm fit)`,
      `  View mode:     ${candidateViewMode === "top10" ? "Top 10 candidates" : "All candidates"}`,
      "",
    ];
    if (results.mechanismNotes) lines.push(`  Mechanism note: ${results.mechanismNotes}`, "");
    lines.push(
      "───────────────────────────────────────────────────",
      "  RESULTS",
      "───────────────────────────────────────────────────",
      "  Lower (more negative) target duplex ΔG indicates stronger predicted",
      "  binding of the antisense ASO to its target window. Candidates are ranked",
      "  by a composite design score built exclusively from real metrics.",
      ""
    );
    displayedCandidates.forEach((c: any, i: number) => {
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
        `    Modifications:${(c.modifications || []).join(", ") || "None selected"}`,
        ""
      );
    });
    lines.push("═══════════════════════════════════════════════════");
    return lines.join("\n");
  }
  const [genError, setGenError] = useState<string | null>(null);

  const MECHANISM_NOTES: Record<string, string> = {
    A3: "TANGO (Poison Exon Skipping): Masks poison exon splice sites to prevent inclusion of PTC-containing exons, reducing nonsense-mediated decay. Targets exon-exon junctions.",
    A4: "NAT Silencing: Degrades inhibitory antisense lncRNAs that repress the sense gene using RNase H1 gapmers. Full transcript scanning.",
    A5: "uORF Blocking: Blocks inhibitory upstream ORFs to enhance translation of the main coding sequence. Focused on 5' translation-initiation region.",
    A6: "miRNA Site Blocking (Target Protector): Masks the miRNA seed binding site on the target mRNA so the repressive miRNA cannot dock. Steric-blocking chemistries only.",
    A23: "saRNA: Uses siRNA duplex chemistry to target promoter regions for transcriptional activation. CDS-derived candidates approximate target complement.",
  };

  useEffect(() => {
    const stored = sessionStorage.getItem(CONFIRMED_TARGET_KEY);
    if (stored) {
      try {
        setGene(JSON.parse(stored));
      } catch {
        setGene(null);
      }
    }
    const mechStored = sessionStorage.getItem(SELECTED_MECHANISM_KEY);
    if (mechStored) {
      try {
        const parsed = JSON.parse(mechStored);
        setMechanism({
          id: parsed.mechanism?.id ?? "",
          name: parsed.mechanism?.name ?? "",
        });
        setMechanismDetail(parsed.mechanism ?? null);
        setTherapeuticGoal(parsed.therapeuticGoal ?? null);
        setDefectType(parsed.upregDefectType ?? "");
        setKnownRegulatoryElement(parsed.knownRegulatoryElement ?? "");
      } catch {
        setMechanism(null);
      }
    }

  }, []);

  useEffect(() => {
    if (!gene?.geneId) return;
    setTargetLoading(true);
    setTargetError(null);
    fetchUpregulationTargetAnalysis(
      gene.geneId,
      gene.geneSymbol ?? undefined,
      gene.organism ?? undefined
    )
      .then(setTarget)
      .catch((e) =>
        setTargetError(e instanceof Error ? e.message : "Failed to load target.")
      )
      .finally(() => setTargetLoading(false));
  }, [gene?.geneId]);

  useEffect(() => {
    fetchUpregulationDesignOptions().then(setOptions).catch(() => {});
  }, []);

  function handleToggleMod(id: string) {
    setSelectedMods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
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
    setCandidateViewMode("top10");
    try {
      const res = await generateUpregulationCandidates({
        ensemblGeneId: gene.geneId,
        mechanismId: mechanism.id,
        asoLength,
        chemistry,
        modifications: selectedMods,
        defectType: defectType || undefined,
        knownRegulatoryElement: knownRegulatoryElement || undefined,
        geneSymbol: gene.geneSymbol ?? undefined,
        organism: gene.organism ?? undefined,
        targetPoisonExon: mechanism.id === "A3" ? targetPoisonExon || undefined : undefined,
        spliceElement: mechanism.id === "A3" ? spliceElement || undefined : undefined,
      });
      setResults(res);
      saveReport({
        step: "aso_design",
        title: `ASO Design: ${gene.geneSymbol} — ${mechanism.name} (Upregulation)`,
        geneSymbol: gene.geneSymbol,
        disease: gene.disease || "",
        summary: `Generated ${res.candidates.length} upregulation ASO candidates for ${mechanism.name}. Top candidate: ${res.candidates[0]?.targetRegion || "N/A"}.`,
        data: {
          mechanismId: mechanism.id,
          mechanismName: mechanism.name,
          candidateCount: res.candidates.length,
        },
      });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed.");
     } finally {
      setGenLoading(false);
    }
  }

  const displayedCandidates = results?.candidates?.slice(
    0,
    candidateViewMode === "top10" ? 10 : results.candidates.length
  ) ?? [];

  if (!gene) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex flex-1 items-center justify-center px-6">
            <Card className="max-w-md p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-[14px] font-medium text-slate-700">
                No confirmed target
              </p>
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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand/10 to-blue-50">
              <Dna className="h-4.5 w-4.5 text-brand" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">
                {gene.geneSymbol}{" "}
                <span className="font-normal text-slate-400">
                  · {gene.organism}
                </span>
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

          {/* Step 4: Gene Upregulation — ASO Design */}
          <Card>
            <SectionHeader step="4" title="Gene Upregulation — ASO Design" />
            <p className="px-6 pb-3 text-[12.5px] text-slate-500">
              {mechanism?.id === "A3"
                ? "TANGO candidates mask poison exon splice sites at exon-exon junctions to restore functional mRNA."
                : mechanism?.id === "A4"
                  ? "NAT silencing candidates degrade inhibitory antisense lncRNAs using RNase H1 gapmers."
                  : mechanism?.id === "A5"
                    ? "uORF-blocking candidates target the 5' translation-initiation region to enhance protein production."
                    : mechanism?.id === "A6"
                      ? "miRNA site-blocking candidates mask the miRNA seed site on the target mRNA to relieve repression."
                      : mechanism?.id === "A23"
                        ? "saRNA candidates target promoter-proximal regions for transcriptional activation via siRNA duplexes."
                        : "Design ASOs for gene upregulation. The service scans the transcript for candidates compatible with the selected mechanism."}
            </p>
          </Card>

          {results && results.candidates.length > 0 && (
            <AsoReportCard
              ctx={
                {
                  gene,
                  mechanism: mechanism
                    ? { id: mechanism.id, name: mechanism.name, detail: mechanismDetail }
                    : null,
                  therapeuticGoal,
                  target,
                  design: {
                    asoLength,
                    chemistry,
                    modifications: selectedMods,
                    defectType: defectType || null,
                    knownRegulatoryElement: knownRegulatoryElement || null,
                    targetPoisonExon: mechanism?.id === "A3" ? targetPoisonExon || null : null,
                    spliceElement: mechanism?.id === "A3" ? spliceElement || null : null,
                  },
                  results,
                  reportTitle: "Gene Upregulation — ASO Design",
                } satisfies AsoReportContext
              }
            />
          )}

          {/* Mechanism notes card */}
          {mechanism && (
            <Card className="p-5">
              <SectionHeader step="" title={`Mechanism: ${mechanism.name}`} />
              <div className="px-5 pb-3">
                <p className="text-[12.5px] text-slate-500 leading-relaxed">
                  {MECHANISM_NOTES[mechanism.id] ||
                    "No mechanism-specific notes available."}
                </p>
              </div>
            </Card>
          )}

          {/* Step 1: Target Analysis */}
          {targetLoading ? (
            <Card className="flex items-center gap-3 px-6 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <span className="text-[13px] text-slate-500">
                Loading target analysis...
              </span>
            </Card>
          ) : targetError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {targetError}
            </div>
          ) : target ? (
            <TargetAnalysisCard target={target} selectedExons={[]} isTotalKnockdown={true} onToggleTotalKnockdown={() => {}} showTargetingMode={false} />
          ) : null}

          {/* Step 2 + 3: Design Form + Results */}
          <div className="space-y-5">
             <div className="space-y-4">
               {/* Upregulation Design Parameters */}
                 <div className="flex justify-end">
                   <div ref={exportRef} className="relative inline-block">
                     <button
                       onClick={() => setShowExport(!showExport)}
                       disabled={!results}
                       className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                     >
                       <Download className="h-3.5 w-3.5" />
                       Export
                     </button>
                     {showExport && (
                       <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                         <button onClick={exportCsv} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">CSV summary</button>
                         <button onClick={exportJson} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">Raw JSON</button>
                         <button onClick={exportFasta} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">FASTA file</button>
                         <button onClick={exportReport} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">Text report</button>
                         <button onClick={exportHtmlReport} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">HTML report</button>
                       </div>
                     )}
                   </div>
                 </div>
               <Card className="p-5">
                <SectionHeader step="2" title="Upregulation Design Parameters" />
                <div className="px-5 pb-5 space-y-4">
                  {/* Defect Type */}
                  <div>
                    <FieldLabel>Molecular Defect Type</FieldLabel>
                    <select
                      value={defectType}
                      onChange={(e) => setDefectType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="">Select defect type</option>
                      <option value="haploinsufficiency">
                        Haploinsufficiency / Loss-of-function
                      </option>
                      <option value="dominant_negative">
                        Dominant-negative variant
                      </option>
                      <option value="poison_exon_inclusion">
                        Poison exon inclusion / NMD
                      </option>
                      <option value="nat_repression">
                        NAT/lncRNA-mediated repression
                      </option>
                      <option value="uorf_repression">
                        uORF-mediated repression
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Known Regulatory Element */}
                  <div>
                    <FieldLabel>Known Regulatory Element</FieldLabel>
                    <input
                      type="text"
                      value={knownRegulatoryElement}
                      onChange={(e) => setKnownRegulatoryElement(e.target.value)}
                      placeholder="e.g., promoter, enhancer, uORF #3, NAT transcript XYZ"
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12.5px] text-slate-700 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                    <p className="mt-1 text-[10.5px] text-slate-400">
                      Specify any known regulatory element the ASO should
                      target. This context is included in mechanism notes for
                      each candidate.
                    </p>
                  </div>

                  {/* TANGO-specific fields (mechanism A3 only) */}
                  {mechanism?.id === "A3" && (
                    <div className="space-y-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
                      <div className="flex items-center gap-2">
                        <Dna className="h-4 w-4 text-brand" />
                        <p className="text-[12.5px] font-semibold text-brand-dark">
                          TANGO: Poison Exon Skipping Parameters
                        </p>
                      </div>
                      <p className="text-[11.5px] text-brand">
                        TANGO (Targeted NMD Suppression) masks poison exon splice sites to prevent inclusion of PTC-containing exons, reducing nonsense-mediated decay.
                      </p>
                      
                      {/* Target Poison Exon */}
                      <div>
                        <FieldLabel>Target Poison Exon</FieldLabel>
                        <select
                          value={targetPoisonExon}
                          onChange={(e) => setTargetPoisonExon(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-[12.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        >
                          <option value="">Select poison exon to skip</option>
                          {target?.exons?.map((exon: any, idx: number) => (
                            <option key={idx} value={`exon_${idx + 1}`}>
                              Exon {idx + 1} ({exon.length} bp)
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10.5px] text-slate-400">
                          Select the poison exon that introduces a premature termination codon (PTC).
                        </p>
                      </div>

                      {/* Splice Element */}
                      <div>
                        <FieldLabel>Splice Element to Mask</FieldLabel>
                        <select
                          value={spliceElement}
                          onChange={(e) => setSpliceElement(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-[12.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        >
                          <option value="">Select splice element</option>
                          <option value="5ss">5' Splice Site (Donor)</option>
                          <option value="3ss">3' Splice Site (Acceptor)</option>
                          <option value="bps">Branch Point Sequence</option>
                          <option value="iss_ise">ISS-ISE (Splicing Silencer/Enhancer)</option>
                        </select>
                        <p className="mt-1 text-[10.5px] text-slate-400">
                          Select the splice element to mask with the ASO. 5'SS and 3'SS are most common for poison exon skipping.
                        </p>
                      </div>

                      {/* Chemistry restriction notice */}
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-[11.5px] font-medium text-amber-700">
                          TANGO Chemistry Restriction
                        </p>
                        <p className="mt-1 text-[11px] text-amber-600">
                          TANGO requires steric-blocking chemistries only (PMO, 2'-MOE, LNA Mixmer). Gapmers and siRNA are not suitable for precise splice control.
                        </p>
                      </div>
                    </div>
                  )}

                  <AssoDesignForm
                    options={options as unknown as DesignOptions | null}
                    asoLength={asoLength}
                    setAsoLength={setAsoLength}
                    chemistry={chemistry}
                    setChemistry={setChemistry}
                    selectedMods={selectedMods}
                     onToggleMod={handleToggleMod}
                     onGenerate={handleGenerate}
                    loading={genLoading}
                    disabled={!target || !mechanism}
                    hasResults={!!results}
                    mechanismId={mechanism?.id}
                  />
                  {results && (
                    <button
                      onClick={() => {
                        setResults(null);
                        setGenError(null);
                      }}
                      className="mt-3 w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-[12.5px] font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Reset &amp; choose different options
                    </button>
                  )}
                </div>
              </Card>
            </div>

              {/* Visualizations (two-column grid) */}
              {results && results.candidates.length > 0 && (
                <div id="aso-visualizations">
                  <AsoVisualizationSuite candidates={displayedCandidates} />
                </div>
              )}

            <div className="space-y-3">
              <SectionHeader step="3" title="Generated ASO Candidates" />

              {genError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {genError}
                </div>
              )}

               {!results && !genLoading && (
                 <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
                   <Beaker className="h-8 w-8 text-slate-300" />
                   <p className="mt-3 text-[13px] font-medium text-slate-500">
                     Click Generate to create upregulation ASO candidates
                   </p>
                   <p className="mt-1 text-[12px] text-slate-400">
                     Candidates are ranked by composite score (0.65× duplex ΔG + 0.35× Tm fit)
                   </p>
                 </Card>
               )}

               {results && results.candidates.length === 0 && (
                 <Card className="px-6 py-8 text-center">
                   <p className="text-[13px] text-slate-500">
                     No valid candidates generated for this configuration. Try a
                     different chemistry, modifications, or length.
                   </p>
                 </Card>
               )}

               {results && results.candidates.length > 0 && (
                 <>
                   {/* View mode selector: top 10 vs all candidates */}
                   <Card className="p-4">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <Filter className="h-4 w-4 text-slate-600" />
                          <span className="text-[12.5px] font-medium text-slate-700">
                            Displaying {candidateViewMode === "top10" ? "top 10" : "all"} candidates
                          </span>
                     </div>
                     <div className="flex gap-1.5">
                       <button
                         onClick={() => setCandidateViewMode("top10")}
                         className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                           candidateViewMode === "top10"
                             ? "bg-brand text-white"
                             : "border border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50"
                         }`}
                       >
                         Top 10 candidates
                       </button>
                       <button
                         onClick={() => setCandidateViewMode("all")}
                         className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                           candidateViewMode === "all"
                             ? "bg-brand text-white"
                             : "border border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50"
                         }`}
                       >
                         All candidates
                        </button>
                      </div>
                      </div>
                    </Card>

                    <p className="text-[12.5px] text-slate-500">
                      {displayedCandidates.length} candidate
                      {displayedCandidates.length !== 1 ? "s" : ""} for{" "}
                      {results.mechanismId} · {results.chemistry} ·{" "}
                      {results.asoLength} nt
                       {results.candidates.length > displayedCandidates.length && (
                         <span className="text-[11px] text-slate-400">
                           {" "}
                           (showing top 10 of {results.candidates.length})
                         </span>
                       )}
                    </p>
                    {results.mechanismNotes && (
                      <p className="text-[11.5px] text-slate-400 italic mb-3">
                        {results.mechanismNotes}
                      </p>
                    )}
                    {displayedCandidates.map((c: any, i: number) => (
                      <AssoCandidateCard
                        key={c.sequence}
                        candidate={c}
                        rank={i + 1}
                      />
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
