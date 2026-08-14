import type { AnalyzeResponse, ValidateResponse } from "@/types/upload-types";

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportFasta(sequence: string, filename = "sequence") {
  const header = `>${filename}`;
  const wrapped = sequence.match(/.{1,60}/g)?.join("\n") ?? sequence;
  download(`${filename}.fasta`, `${header}\n${wrapped}\n`, "text/plain");
}

export function exportJson(
  validation: ValidateResponse | null,
  analysis: AnalyzeResponse | null,
  filename = "aso-analysis"
) {
  const payload = {
    exportedAt: new Date().toISOString(),
    validation,
    analysis,
  };
  download(`${filename}.json`, JSON.stringify(payload, null, 2), "application/json");
}

export function exportCsv(analysis: AnalyzeResponse, filename = "aso-analysis") {
  const rows: string[][] = [
    ["Section", "Field", "Value"],
    ["Summary", "Sequence Type", analysis.sequenceType],
    ["Summary", "Length (nt)", String(analysis.length)],
    ["Summary", "GC Content (%)", String(analysis.gcContent)],
    ["Specificity Heuristic", "Length-based Risk Estimate", analysis.offTarget.lengthBasedRiskEstimate],
    ["Specificity Heuristic", "Internal Repetitiveness", String(analysis.offTarget.internalRepetitiveness)],
    ["Specificity Heuristic", "Recommended Min Length", String(analysis.offTarget.recommendedMinLength)],
    ["Secondary Structure", "Estimated MFE (kcal/mol)", String(analysis.secondaryStructure.estimatedMfe)],
    ["Secondary Structure", "Hairpin Risk", analysis.secondaryStructure.hairpinRisk],
    ["Secondary Structure", "Palindromic Regions", String(analysis.secondaryStructure.palindromicRegions)],
    ["Composition", "A", String(analysis.composition.A)],
    ["Composition", "C", String(analysis.composition.C)],
    ["Composition", "G", String(analysis.composition.G)],
    ["Composition", "T", String(analysis.composition.T)],
    ["Composition", "U", String(analysis.composition.U)],
  ];

  analysis.orfs.forEach((orf, i) => {
    rows.push([
      "ORF",
      `#${i + 1} (${orf.strand} strand, frame ${orf.frame})`,
      `${orf.start}-${orf.end}, ${orf.proteinLength} aa`,
    ]);
  });

  analysis.immuneScreen.forEach((hit, i) => {
    rows.push(["Immune Motif Hit", `#${i + 1} ${hit.motif} (${hit.start}-${hit.end})`, hit.label]);
  });

  (analysis.modality.recommendations ?? []).forEach((rec, i) => {
    rows.push(["Modality Recommendation", `#${i + 1}`, rec]);
  });

  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(`${filename}.csv`, csv, "text/csv");
}

export function exportTextReport(
  validation: ValidateResponse,
  analysis: AnalyzeResponse,
  modalityLabel: string,
  filename = "aso-analysis-report"
) {
  const lines: string[] = [];
  lines.push("ASO PLATFORM — SEQUENCE ANALYSIS REPORT");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("SEQUENCE SUMMARY");
  lines.push(`Type: ${analysis.sequenceType.toUpperCase()}`);
  lines.push(`Length: ${analysis.length} nt`);
  lines.push(`GC Content: ${analysis.gcContent}%`);
  lines.push(`Analyzed as: ${modalityLabel}`);
  lines.push("");

  lines.push("MODALITY RECOMMENDATIONS");
  if (analysis.modality.recommendedChemistry) {
    lines.push(`Recommended chemistry: ${analysis.modality.recommendedChemistry}`);
  }
  if (analysis.modality.optimalLength) {
    lines.push(`Optimal length: ${analysis.modality.optimalLength}`);
  }
  (analysis.modality.recommendations ?? []).forEach((r) => lines.push(`- ${r}`));
  lines.push("");

  lines.push("SPECIFICITY HEURISTIC (not a real off-target screen)");
  lines.push(`Risk estimate: ${analysis.offTarget.lengthBasedRiskEstimate}`);
  lines.push(`Note: ${analysis.offTarget.note}`);
  lines.push(`Disclaimer: ${analysis.offTarget.disclaimer}`);
  lines.push("");

  lines.push("SECONDARY STRUCTURE (composition-based estimate, not a real fold)");
  lines.push(`Estimated MFE: ${analysis.secondaryStructure.estimatedMfe} kcal/mol`);
  lines.push(`Hairpin risk: ${analysis.secondaryStructure.hairpinRisk}`);
  lines.push(`Palindromic regions found: ${analysis.secondaryStructure.palindromicRegions}`);
  lines.push("");

  lines.push(`OPEN READING FRAMES (${analysis.orfs.length} found, both strands)`);
  analysis.orfs.forEach((o, i) => {
    lines.push(`  ${i + 1}. ${o.strand} strand, frame ${o.frame}: ${o.start}-${o.end} (${o.proteinLength} aa)`);
  });
  lines.push("");

  lines.push(`INNATE-IMMUNE SENSING PATTERN HITS (${analysis.immuneScreen.length} found)`);
  lines.push("Pattern-matching against a short literature-informed list, not a validated assay.");
  analysis.immuneScreen.forEach((m, i) => {
    lines.push(`  ${i + 1}. "${m.motif}" at ${m.start}-${m.end}: ${m.label}`);
  });
  lines.push("");

  lines.push("SEQUENCE");
  lines.push(analysis.sequence.match(/.{1,60}/g)?.join("\n") ?? analysis.sequence);

  download(`${filename}.txt`, lines.join("\n"), "text/plain");
}
