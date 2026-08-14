"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Beaker, Dna, Download, ChevronDown } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import TargetAnalysisCard from "@/components/TargetAnalysisCard";
import RnaEditingDesignForm from "@/components/RnaEditingDesignForm";
import GuideRnaCandidateCard from "@/components/GuideRnaCandidateCard";
import AsoReportCard from "@/components/AsoReportCard";
import AsoAnalysisDashboard from "@/components/AsoAnalysisDashboard";
import AsoVisualizationSuite from "@/components/AsoVisualizationSuite";
import { Card, SectionHeader } from "@/components/ui";
import { GeneTargetObject } from "@/types/gene";
import { TargetAnalysis, ClinVarVariant } from "@/types/geneSilencing";
import { AsoReportContext } from "@/lib/asoReport";
import {
  RnaEditingDesignOptions,
  RnaEditingGenerateResponse,
  RnaEditingCandidate,
} from "@/types/rnaEditing";
import {
  fetchRnaEditingTarget,
  fetchRnaEditingOptions,
  generateRnaEditingCandidates,
  fetchRnaEditingClinVarVariants,
} from "@/lib/rnaEditingApi";
import { saveReport } from "@/lib/auth";
import { visualAssoCandidates } from "@/lib/visualizeCandidates";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";
const SELECTED_MECHANISM_KEY = "aso:selectedMechanism";

const MECHANISM_NOTES: Record<string, string> = {
  A13: "ADAR1 LEAPER: Recruits endogenous ADAR1 to convert adenosine to inosine (A→I/G) via a long single-stranded guide RNA.",
  A16: "C-to-U Editing: Uses APOBEC/RESCUE to convert cytidine to uridine (C→U/T) for T>C correction.",
  A17: "ADAR2 Editing: Recruits endogenous ADAR2 (CNS-enriched) for high-efficiency A→I editing.",
  A18: "Exogenous Deaminase: Engineered deaminase for enhanced editing without endogenous enzyme dependence.",
  A19: "Dual-ADAR: Combines ADAR1 + ADAR2 recruitment for maximum editing efficiency.",
  A20: "SMaRT Trans-Splicing: Pre-trans-splicing molecules replace exons via spliceosomal machinery.",
};

export default function RnaEditingPage() {
  const router = useRouter();

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [mechanism, setMechanism] = useState<{ id: string; name: string } | null>(null);
  const [mechanismDetail, setMechanismDetail] = useState<Record<string, unknown> | null>(null);
  const [therapeuticGoal, setTherapeuticGoal] = useState<string | null>(null);
  const [editType, setEditType] = useState<string>("a_to_i");
  const [variantHgvs, setVariantHgvs] = useState<string>("");

  const [target, setTarget] = useState<TargetAnalysis | null>(null);
  const [targetLoading, setTargetLoading] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);

  const [options, setOptions] = useState<RnaEditingDesignOptions | null>(null);
  const [clinvarVariants, setClinvarVariants] = useState<ClinVarVariant[]>([]);

  // Design parameters
  const [guideLength, setGuideLength] = useState(71);
  const [mismatchPocket, setMismatchPocket] = useState("c");
  const [maxBystanderEdits, setMaxBystanderEdits] = useState(0);
  const [splicingDirection, setSplicingDirection] = useState("three_prime");
  const [abdLength, setAbdLength] = useState(150);
  const [chemistry, setChemistry] = useState("2ome_ps");
  const [selectedMods, setSelectedMods] = useState<string[]>(["phosphorothioate"]);

  const [results, setResults] = useState<RnaEditingGenerateResponse | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
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
    const header = "Rank,Sequence,Guide Length,Target BP,GC%,Tm (C),Adjusted Tm,MFE,Duplex Energy,On-Target Score,Bystander Risk,ADAR Score\n";
    const body = results.candidates.map((c, i) =>
      `${i + 1},${c.sequence},${c.guideLength},"${c.targetBasePair}",${c.gcContent},${c.meltingTempC},${c.adjustedTmC},${c.selfStructureMfe},${c.targetDuplexEnergy},${c.onTargetEditScore ?? ""},${c.bystanderRiskCount},${c.adarRecruitmentScore ?? ""}`
    ).join("\n");
    triggerDownload(header + body, `${gene?.geneSymbol ?? "rna-editing"}-guides.csv`, "text/csv");
    setShowExport(false);
  }

  function exportJson() {
    if (!results) return;
    triggerDownload(JSON.stringify(results, null, 2), `${gene?.geneSymbol ?? "rna-editing"}-results.json`, "application/json");
    setShowExport(false);
  }

  function exportFasta() {
    if (!results) return;
    const content = results.candidates.map((c, i) =>
      `>Guide_${i + 1} rank=${i + 1} target_bp=${c.targetBasePair} gc=${c.gcContent}% tm=${c.meltingTempC}C\n${c.sequence.match(/.{1,80}/g)?.join("\n") || c.sequence}`
    ).join("\n\n");
    triggerDownload(content, `${gene?.geneSymbol ?? "rna-editing"}-guides.fasta`, "text/plain");
    setShowExport(false);
  }

  function exportReport() {
    const content = exportReportContent();
    if (!content || !gene) return;
    triggerDownload(content, `${gene.geneSymbol}-rna-editing-report.txt`, "text/plain");
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
    const content = exportReportContent();
    if (!content || !gene) return;
    const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    triggerDownload(`<!doctype html><html><head><meta charset="utf-8"><title>RNA Editing Design Report</title></head><body style="font-family:ui-monospace,monospace;white-space:pre-wrap;line-height:1.5;padding:32px;color:#1e293b">${escaped}<hr style="border:none;border-top:2px solid #e2e8f0;margin:32px 0">${collectVisualizationSvg()}</body></html>`, `${gene.geneSymbol}-rna-editing-report.html`, "text/html");
    setShowExport(false);
  }

  function exportReportContent(): string | null {
    if (!results || !gene) return null;
    const lines = [
      "═══════════════════════════════════════════════════",
      "  RNA EDITING DESIGN REPORT",
      `  ${gene.geneSymbol} — ${mechanism?.name ?? results.mechanismId}`,
      "═══════════════════════════════════════════════════",
      "",
      `  Gene:          ${gene.geneSymbol} (${gene.geneName ?? "—"})`,
      `  Organism:      ${gene.organism ?? "—"}`,
      `  Mechanism:     ${mechanism?.name ?? results.mechanismId}`,
      `  Edit Type:     ${results.editType}`,
      `  Guide Length:  ${results.guideLength} nt`,
      `  Chemistry:     ${results.chemistry}`,
      `  Candidates:    ${results.candidates.length}`,
      "",
    ];
    if (results.mechanismNotes) lines.push(`  Notes: ${results.mechanismNotes}`, "");
    lines.push(
      "───────────────────────────────────────────────────",
      "  GUIDE RNA CANDIDATES",
      "───────────────────────────────────────────────────",
      ""
    );
    results.candidates.forEach((c, i) => {
      lines.push(
        `  #${i + 1}  Target BP: ${c.targetBasePair}`,
        `    Sequence:      ${c.sequence}`,
        `    Length:        ${c.guideLength} nt`,
        `    GC Content:    ${c.gcContent}%`,
        `    Melting Temp:  ${c.meltingTempC} C`,
        `    On-Target:     ${c.onTargetEditScore ?? "N/A"}`,
        `    Bystander Risk:${c.bystanderRiskCount}`,
        ""
      );
    });
    lines.push("═══════════════════════════════════════════════════");
    return lines.join("\n");
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
        setMechanismDetail(parsed.mechanism ?? null);
        setTherapeuticGoal(parsed.therapeuticGoal ?? null);
        setEditType(parsed.editType ?? "a_to_i");
        setVariantHgvs(parsed.variantHggs ?? parsed.variantHgvs ?? "");
      } catch { setMechanism(null); }
    }
  }, []);

  // Fetch target analysis
  useEffect(() => {
    if (!gene?.geneId) return;
    setTargetLoading(true);
    setTargetError(null);
    fetchRnaEditingTarget(gene.geneId, gene.geneSymbol ?? undefined, gene.organism ?? undefined)
      .then(setTarget)
      .catch((e) => setTargetError(e instanceof Error ? e.message : "Failed to load target."))
      .finally(() => setTargetLoading(false));
  }, [gene?.geneId]);

  // Fetch design options
  useEffect(() => {
    fetchRnaEditingOptions().then(setOptions).catch(() => {});
  }, []);

  // Fetch ClinVar variants
  useEffect(() => {
    if (!gene?.geneId) return;
    fetchRnaEditingClinVarVariants(gene.geneId).then(setClinvarVariants).catch(() => {});
  }, [gene?.geneId]);

  // Update guide length default when edit type changes
  useEffect(() => {
    if (editType === "trans_splicing") {
      setGuideLength(150);
    } else {
      setGuideLength(71);
    }
  }, [editType]);

  function handleToggleMod(id: string) {
    setSelectedMods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    if (!gene?.geneId || !mechanism?.id) return;
    if (!variantHgvs) {
      setGenError("Select or enter a target variant before generating.");
      return;
    }
    setGenLoading(true);
    setGenError(null);
    setResults(null);
    try {
      const res = await generateRnaEditingCandidates({
        ensemblGeneId: gene.geneId,
        mechanismId: mechanism.id,
        variantHgvs,
        editType,
        guideLength,
        chemistry,
        modifications: selectedMods,
        mismatchPocket,
        maxBystanderEdits,
        splicingDirection: editType === "trans_splicing" ? splicingDirection : undefined,
        abdLength: editType === "trans_splicing" ? abdLength : undefined,
        geneSymbol: gene.geneSymbol ?? undefined,
        organism: gene.organism ?? undefined,
      });
      setResults(res);
      saveReport({
        step: "rna_editing",
        title: `RNA Editing: ${gene.geneSymbol} — ${mechanism.name}`,
        geneSymbol: gene.geneSymbol,
        disease: gene.disease || "",
        summary: `Generated ${res.candidates.length} guide RNA candidates for ${mechanism.name}. Top candidate: ${res.candidates[0]?.targetBasePair || "N/A"}.`,
        data: { mechanismId: mechanism.id, mechanismName: mechanism.name, candidateCount: res.candidates.length },
      });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenLoading(false);
    }
  }

  const visualCandidates = visualAssoCandidates(results?.candidates ?? []);

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
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-6xl space-y-5">
            {/* Gene + Mechanism Banner */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Dna className="h-5 w-5 text-brand" />
                  <div>
                    <h1 className="text-[15px] font-semibold text-slate-800">
                      {gene.geneSymbol} <span className="text-slate-400 font-normal">· {gene.organism || "homo_sapiens"}</span>
                    </h1>
                    <p className="text-[12px] text-slate-500">
                      {mechanism?.name || "RNA Editing"} · {MECHANISM_NOTES[mechanism?.id ?? ""] || "Guide RNA design for RNA editing"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/mechanisms")}
                  className="text-[12px] font-medium text-brand hover:text-brand-dark transition-colors"
                >
                  Change mechanism
                </button>
              </div>
              {/* Variant info */}
              {variantHgvs && (
                <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5">
                  <p className="text-[12px] font-medium text-brand-dark">
                    Target Variant: {variantHgvs}
                  </p>
                  <p className="text-[11px] text-brand mt-0.5">
                    Edit Type: {editType === "a_to_i" ? "A-to-I (ADAR)" : editType === "c_to_u" ? "C-to-U (APOBEC)" : "Trans-Splicing (SMaRT)"}
                    {clinvarVariants.length > 0 && ` · ${clinvarVariants.length} ClinVar variants available`}
                  </p>
                </div>
              )}
            </Card>

            {results && results.candidates.length > 0 && (
              <AsoReportCard
                step="rna_editing"
                ctx={
                  {
                    gene,
                    mechanism: mechanism
                      ? { id: mechanism.id, name: mechanism.name, detail: mechanismDetail }
                      : null,
                    therapeuticGoal,
                    target,
                    design: {
                      editType,
                      variantHgvs: variantHgvs || null,
                      guideLength,
                      chemistry,
                      modifications: selectedMods,
                      mismatchPocket,
                      maxBystanderEdits,
                      splicingDirection: editType === "trans_splicing" ? splicingDirection : null,
                      abdLength: editType === "trans_splicing" ? abdLength : null,
                    },
                    results,
                    reportTitle: "RNA Editing — Guide RNA Design",
                  } satisfies AsoReportContext
                }
              />
            )}

            {/* Target Analysis */}
            {target && (
              <TargetAnalysisCard
                target={target}
                selectedExons={[]}
                isTotalKnockdown={true}
                onToggleTotalKnockdown={() => {}}
                showTargetingMode={false}
              />
            )}

            {/* Analysis dashboard + visualization suite (mirrors TG01) */}
            {results && results.candidates.length > 0 && (
              <>
                <AsoAnalysisDashboard candidates={visualCandidates} />
                <AsoVisualizationSuite candidates={visualCandidates} />
              </>
            )}

            {/* Two-column layout */}
            <div className="space-y-5">
              {/* Left: Design Form */}
              <div className="space-y-4">
                <div className="flex justify-end">
                  <div ref={exportRef} className="relative">
                    <button
                      onClick={() => setShowExport(!showExport)}
                      disabled={!results}
                      className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Reports
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showExport && (
                      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                        <button onClick={exportCsv} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">CSV (guides)</button>
                        <button onClick={exportJson} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">Raw JSON</button>
                        <button onClick={exportFasta} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">FASTA sequences</button>
                        <button onClick={exportReport} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">Text report</button>
                        <button onClick={exportHtmlReport} className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50">HTML report</button>
                      </div>
                    )}
                  </div>
                </div>
                <Card className="p-5">
                  <SectionHeader step="2" title="Guide RNA Design Parameters" />
                  <div className="px-5 pb-5">
                    <RnaEditingDesignForm
                      options={options}
                      editType={editType}
                      guideLength={guideLength}
                      setGuideLength={setGuideLength}
                      mismatchPocket={mismatchPocket}
                      setMismatchPocket={setMismatchPocket}
                      maxBystanderEdits={maxBystanderEdits}
                      setMaxBystanderEdits={setMaxBystanderEdits}
                      splicingDirection={splicingDirection}
                      setSplicingDirection={setSplicingDirection}
                      abdLength={abdLength}
                      setAbdLength={setAbdLength}
                      chemistry={chemistry}
                      setChemistry={setChemistry}
                      selectedMods={selectedMods}
                      onToggleMod={handleToggleMod}
                      onGenerate={handleGenerate}
                      loading={genLoading}
                      disabled={!variantHgvs}
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

              {/* Right: Results */}
              <div className="space-y-3">
                <SectionHeader step="3" title="Generated Guide RNA Candidates" />

                {genError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {genError}
                  </div>
                )}

                {!results && !genLoading && (
                  <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <Beaker className="h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-[13px] font-medium text-slate-500">
                      {variantHgvs
                        ? "Click Generate to create guide RNA candidates"
                        : "Select or enter a target variant first"}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-400">
                      Candidates are ranked by {editType === "trans_splicing" ? "splice site strength, binding domain quality, and spliceosome compatibility" : "editing efficiency, ADAR recruitment, and bystander risk"}
                    </p>
                  </Card>
                )}

                {results && results.candidates.length === 0 && (
                  <Card className="px-6 py-8 text-center">
                    <p className="text-[13px] text-slate-500">
                      No valid guide candidates generated for this configuration. Try different parameters.
                    </p>
                  </Card>
                )}

                {results && results.candidates.length > 0 && (
                  <>
                    <p className="text-[12.5px] text-slate-500">
                      {results.candidates.length} guide candidate{results.candidates.length !== 1 ? "s" : ""} for{" "}
                      {mechanism?.name || results.mechanismId}
                    </p>

                    <div className="space-y-3">
                      {results.candidates.map((c, i) => (
                        <GuideRnaCandidateCard key={i} candidate={c} rank={i + 1} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
