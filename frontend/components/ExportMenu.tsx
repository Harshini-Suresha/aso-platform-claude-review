"use client";

import { useState, useRef, useEffect } from "react";
import { Download } from "lucide-react";
import type { ValidateResponse, AnalyzeResponse } from "@/types/upload-types";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

type ExportFormat = "fasta" | "json" | "csv" | "report";

interface ExportMenuProps {
  sequence: string;
  validation: ValidateResponse;
  analysis: AnalyzeResponse;
  modalityName: string;
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportFasta(seq: string, filename?: string) {
  const name = filename?.replace(/\.[^.]+$/, "") || "sequence";
  return `>${name}\n${seq.match(/.{1,80}/g)?.join("\n") || seq}`;
}

function exportJson(data: Record<string, unknown>) {
  return JSON.stringify(data, null, 2);
}

function exportCsv(analysis: ExportMenuProps["analysis"], modalityName: string) {
  const rows = [
    ["Metric", "Value"],
    ["Sequence Type", analysis.sequenceType],
    ["Length (nt)", String(analysis.length)],
    ["GC Content (%)", String(analysis.gcContent)],
    ["Modality", modalityName],
    ["Off-Target Risk", analysis.offTarget.lengthBasedRiskEstimate],
    ["Est. MFE (kcal/mol)", String(analysis.secondaryStructure.estimatedMfe)],
    ["Hairpin Risk", analysis.secondaryStructure.hairpinRisk],
    ["Immune Hits", String(analysis.immuneScreen.length)],
    ["A count", String(analysis.composition.A)],
    ["C count", String(analysis.composition.C)],
    ["G count", String(analysis.composition.G)],
    ["T count", String(analysis.composition.T)],
    ["U count", String(analysis.composition.U)],
  ];
  if (analysis.modality.optimalLength) rows.push(["Optimal Length", analysis.modality.optimalLength]);
  if (analysis.modality.recommendedChemistry) rows.push(["Chemistry", analysis.modality.recommendedChemistry]);
  if (analysis.modality.casProtein) rows.push(["Cas Protein", analysis.modality.casProtein]);
  return rows.map((r) => r.join(",")).join("\n");
}

function exportReport(props: ExportMenuProps) {
  const { sequence, validation, analysis, modalityName } = props;
  const features = validation.features ?? [];
  const orfs = validation.orfs ?? [];
  const recommendations = analysis.modality.recommendations ?? [];
  const lines = [
    "═══════════════════════════════════════════",
    "  SEQUENCE ANALYSIS REPORT",
    "  RNA Therapeutics Platform",
    "═══════════════════════════════════════════",
    "",
    `  Sequence Length:  ${analysis.length} nt`,
    `  Sequence Type:    ${(analysis.sequenceType ?? "unknown").toUpperCase()}`,
    `  GC Content:       ${analysis.gcContent}%`,
    `  Modality:         ${modalityName}`,
    "",
    "───────────────────────────────────────────",
    "  VALIDATION",
    "───────────────────────────────────────────",
    `  Valid: ${features.length === 0 ? "Yes (no flags)" : "Flags detected"}`,
    ...features.map((f: string) => `    • ${f}`),
    "",
    "───────────────────────────────────────────",
    "  MODALITY RECOMMENDATIONS",
    "───────────────────────────────────────────",
    ...recommendations.map((r: string) => `  • ${r}`),
  ];
  if (analysis.modality.optimalLength) lines.push(`\n  Optimal Length:     ${analysis.modality.optimalLength}`);
  if (analysis.modality.recommendedChemistry) lines.push(`  Chemistry:          ${analysis.modality.recommendedChemistry}`);
  if (analysis.modality.casProtein) lines.push(`  Cas Protein:        ${analysis.modality.casProtein}`);

  lines.push(
    "",
    "───────────────────────────────────────────",
    "  SPECIFICITY HEURISTIC",
    "───────────────────────────────────────────",
    `  Risk:     ${analysis.offTarget.lengthBasedRiskEstimate}`,
    `  Note:     ${analysis.offTarget.note}`,
    "",
    "───────────────────────────────────────────",
    "  SECONDARY STRUCTURE (Estimate)",
    "───────────────────────────────────────────",
    `  Est. MFE:    ${analysis.secondaryStructure.estimatedMfe} kcal/mol`,
    `  Hairpin Risk: ${analysis.secondaryStructure.hairpinRisk}`,
    "",
    "───────────────────────────────────────────",
    "  NUCLEOTIDE COMPOSITION",
    "───────────────────────────────────────────",
    `  A: ${analysis.composition.A}  C: ${analysis.composition.C}  G: ${analysis.composition.G}  T: ${analysis.composition.T}  U: ${analysis.composition.U}`,
    ""
  );

  if (analysis.immuneScreen.length > 0) {
    lines.push(
      "───────────────────────────────────────────",
      "  IMMUNE SENSITIVITY HITS",
      "───────────────────────────────────────────"
    );
    analysis.immuneScreen.forEach((m) => {
      lines.push(`  ${m.motif}  @  ${m.start}–${m.end}  (${m.label})`);
    });
    lines.push("");
  }

  if (orfs.length > 0) {
    lines.push(
      "───────────────────────────────────────────",
      "  OPEN READING FRAMES",
      "───────────────────────────────────────────"
    );
    orfs.forEach((orf: { strand: string; frame: number; start: number; end: number; proteinLength: number }) => {
      lines.push(`  ${orf.strand} strand  frame ${orf.frame}: ${orf.start}–${orf.end}  (${orf.proteinLength} aa)`);
    });
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════");
  return lines.join("\n");
}

export default function ExportMenu(props: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useKeyboardShortcut("escape", () => setOpen(false), { enabled: open });

  const seq = props.sequence.toUpperCase().replace(/[^A-Z]/g, "");

  function handleExport(fmt: ExportFormat) {
    const fname = (props.validation.features ?? []).length > 0 ? "sequence" : "analysis";
    switch (fmt) {
      case "fasta":
        triggerDownload(exportFasta(seq, (props.validation.features ?? []).length > 0 ? undefined : fname), `${fname}.fasta`, "text/plain");
        break;
      case "json":
        triggerDownload(exportJson(props.analysis as unknown as Record<string, unknown>), `${fname}.json`, "application/json");
        break;
      case "csv":
        triggerDownload(exportCsv(props.analysis, props.modalityName), `${fname}.csv`, "text/csv");
        break;
      case "report":
        triggerDownload(exportReport(props), `${fname}-report.txt`, "text/plain");
        break;
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
          {(["fasta", "json", "csv", "report"] as ExportFormat[]).map((fmt) => {
            const labels: Record<ExportFormat, string> = {
              fasta: "FASTA file",
              json: "Raw JSON",
              csv: "CSV summary",
              report: "Text report",
            };
            return (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                className="w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50"
              >
                {labels[fmt]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
