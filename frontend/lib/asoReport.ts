import { GeneTargetObject } from "@/types/gene";
import {
  TargetAnalysis,
  GenerateResponse,
  AssoCandidate,
} from "@/types/geneSilencing";
import { RnaEditingGenerateResponse, RnaEditingCandidate } from "@/types/rnaEditing";
import { THERAPEUTIC_GOALS } from "@/types/mechanism";

export interface ReportDesignInputs {
  asoLength?: number | null;
  chemistry?: string | null;
  modifications?: string[];
  defectType?: string | null;
  silencingScope?: string | null;
  targetExons?: number[] | null;
  isTotalKnockdown?: boolean;
  knownVariant?: string | null;
  knownRegulatoryElement?: string | null;
  targetPoisonExon?: string | null;
  spliceElement?: string | null;
  editType?: string | null;
  variantHgvs?: string | null;
  guideLength?: number | null;
  mismatchPocket?: string | null;
  maxBystanderEdits?: number | null;
  splicingDirection?: string | null;
  abdLength?: number | null;
}

export type AnyGenerateResponse = GenerateResponse | RnaEditingGenerateResponse;

export interface AsoReportContext {
  gene: GeneTargetObject | null;
  mechanism: { id: string; name: string; detail?: Record<string, unknown> | null } | null;
  therapeuticGoal: string | null;
  target: TargetAnalysis | null;
  design: ReportDesignInputs;
  results: AnyGenerateResponse | null;
  reportTitle?: string;
}

const SEP = "─".repeat(54);
const RULE = "═".repeat(54);

function pad(label: string, value: unknown): string {
  const v = value == null || value === "" ? "—" : String(value);
  return `  ${label.padEnd(25)}${v}`;
}

function header(lines: string[], text: string): void {
  lines.push(`──────────────────────────────────────────────────────`);
  lines.push(`  ${text.toUpperCase()}`);
  lines.push(`──────────────────────────────────────────────────────`);
}

function confidence(score: number): string {
  return score >= 70 ? "High" : score >= 45 ? "Moderate" : "Low";
}

function selfDimerLabel(mfe: number): string {
  if (mfe === 0) return "None";
  if (mfe > -3) return "Low";
  if (mfe > -6) return "Moderate";
  return "High";
}

function nucleaseLabel(v: number): string {
  return v >= 80 ? "Excellent" : v >= 60 ? "Good" : v >= 40 ? "Moderate" : "Low";
}

function uptakeLabel(v: number): string {
  return v >= 70 ? "High" : v >= 50 ? "Moderate" : "Low";
}

function bbbLabel(v: number): string {
  return v >= 60 ? "Good" : v >= 30 ? "Limited" : "Poor";
}

function offTargetLabel(v: number): string {
  return v <= 20 ? "Low" : v <= 40 ? "Moderate" : "High";
}

function immuneLabel(v: number): string {
  return v <= 15 ? "Low" : v <= 35 ? "Moderate" : "High";
}

function synthesisLabel(v: number): string {
  return v <= 30 ? "Standard" : v <= 55 ? "Moderate" : "Complex";
}

function goalInfo(goalId: string | null): { name: string; description: string } {
  const found = THERAPEUTIC_GOALS.find((g) => g.id === goalId);
  if (found) return { name: found.name, description: found.description };
  return { name: goalId || "Unknown", description: "" };
}

function formatExons(target: TargetAnalysis | null): string {
  if (!target || !target.exons.length) return "—";
  return target.exons
    .map((e) => `Exon ${e.index ?? "?"} (${e.length ?? "?"} bp)`)
    .join(", ");
}

// asoReport is a shared formatter: gene silencing feeds nested realMetrics /
// heuristicEstimates, while upregulation/other pipelines still emit flat
// candidates. FlatOrNestedCandidate accepts both so the report is resilient
// to either shape.
export type FlatOrNestedCandidate = AssoCandidate & {
  targetDuplexEnergy?: number;
  molecularWeight?: number;
  extinctionCoefficient?: number;
  duplexStability?: string;
  gcContent?: number;
  meltingTempC?: number;
  selfStructureMfe?: number;
  polygTracts?: number;
  cpgCount?: number;
  longestHomopolymer?: number;
  purineContent?: number;
  gcSkew?: number;
  sequenceComplexity?: number;
  nucleaseResistance?: number;
  cellularUptake?: number;
  bbbCrossing?: number;
  offTargetRisk?: number;
  immuneStimulation?: number;
  synthesisDifficulty?: number;
  knownRegulatoryElement?: string;
};

function formatAsoCandidate(lines: string[], c: FlatOrNestedCandidate, rank: number): void {
  const rm = c.realMetrics;
  const he = c.heuristicEstimates;
  const dg = rm?.targetDuplexEnergy ?? c.targetDuplexEnergy;
  const gc = rm?.gcContent ?? c.gcContent;
  const tm = rm?.meltingTempC ?? c.meltingTempC;
  const mfe = rm?.selfStructureMfe ?? c.selfStructureMfe;
  const mw = rm?.molecularWeight ?? c.molecularWeight;
  const extCoeff = rm?.extinctionCoefficient ?? c.extinctionCoefficient;
  const duplexStab = rm?.duplexStability ?? c.duplexStability;
  const polyg = rm?.polyGPass != null ? (rm.polyGPass ? 0 : c.length) : c.polygTracts;
  const cpg = rm?.cpgCount ?? c.cpgCount;
  const homo = rm?.longestHomopolymer ?? c.longestHomopolymer;
  const purine = rm?.purineContent ?? c.purineContent;
  const gcSkew = rm?.gcSkew ?? c.gcSkew;
  const complexity = rm?.sequenceComplexity ?? c.sequenceComplexity;
  const nuc = he?.nucleaseResistance?.value ?? c.nucleaseResistance;
  const uptake = he?.cellularUptake?.value ?? c.cellularUptake;
  const bbb = he?.bbbCrossing?.value ?? c.bbbCrossing;
  const offTarget = he?.offTargetRisk?.value ?? c.offTargetRisk;
  const immune = he?.immuneStimulation?.value ?? c.immuneStimulation;
  const synthesis = he?.synthesisDifficulty?.value ?? c.synthesisDifficulty;

  lines.push(`  ── Candidate #${rank} ─────────────────────────────`);
  lines.push(`  Rank              #${rank}`);
  lines.push(`  Chemistry         ${c.chemistry}`);
  lines.push(`  Mechanism         ${c.mechanismId}`);
  lines.push(`  Length            ${c.length} nt`);
  lines.push(`  Target Region     ${c.targetRegion}`);
  if (c.exonNumber != null) lines.push(`  Target Exon       Exon ${c.exonNumber}`);
  if (c.exonLength != null) lines.push(`  Exon Length       ${c.exonLength} bp`);
  if (c.modifications.length > 0) lines.push(`  Modifications     ${c.modifications.join(", ")}`);
  if (dg != null) lines.push(`  Duplex Energy     ${dg} kcal/mol`);
  lines.push("");

  lines.push("  Antisense Sequence (5'→3'):");
  lines.push(`    ${c.sequence}`);
  lines.push("");
  lines.push(`  Molecular Weight:    ${mw?.toLocaleString() ?? "—"} Da`);
  lines.push(`  Extinction Coeff:    ${extCoeff?.toLocaleString() ?? "—"} L/mol·cm`);
  lines.push(`  Duplex Stability:    ${duplexStab ?? "—"}`);
  lines.push("");

  header(lines, "Biophysical Properties");
  if (gc != null) lines.push(pad("GC Content", `${gc}%`));
  if (tm != null) lines.push(pad("Melting Temperature", `${tm} °C`));
  if (mfe != null) lines.push(pad("Self-Structure MFE", `${mfe} kcal/mol`));
  if (dg != null) lines.push(pad("Target Duplex ΔG", `${dg} kcal/mol`));
  if (mfe != null) lines.push(pad("Self-Structure Risk", selfDimerLabel(mfe)));
  if (polyg != null) lines.push(pad("Poly-G Tracts (≥3 G)", polyg));
  if (cpg != null) lines.push(pad("CpG Dinucleotides", cpg));
  if (homo != null) lines.push(pad("Longest Homopolymer Run", `${homo} bp`));
  if (purine != null) lines.push(pad("Purine Content (A+G)", `${(purine * 100).toFixed(1)}%`));
  if (gcSkew != null) lines.push(pad("GC Skew", gcSkew.toFixed(3)));
  if (complexity != null) lines.push(pad("Sequence Complexity", complexity.toFixed(3)));
  lines.push("");

  header(lines, "Drug-like Properties");
  if (nuc != null) lines.push(pad("Nuclease Resistance", `${nuc}/100 (${nucleaseLabel(nuc)})`));
  if (uptake != null) lines.push(pad("Cellular Uptake", `${uptake}/100 (${uptakeLabel(uptake)})`));
  if (bbb != null) lines.push(pad("BBB Crossing Potential", `${bbb}/100 (${bbbLabel(bbb)})`));
  if (offTarget != null) lines.push(pad("Off-target Risk", `${offTarget}/100 (${offTargetLabel(offTarget)})`));
  if (immune != null) lines.push(pad("Immune Stimulation Risk", `${immune}/100 (${immuneLabel(immune)})`));
  if (synthesis != null) lines.push(pad("Synthesis Feasibility", `${synthesis}/100 (${synthesisLabel(synthesis)})`));
  lines.push("");

  header(lines, "Target Duplex Energy");
  if (dg != null) lines.push(pad("Duplex ΔG", `${dg} kcal/mol`));
  if (c.mechanismNotes) lines.push(pad("Mechanism Notes", c.mechanismNotes));
  lines.push("");

  if (c.knownVariant || c.alleleSpecific) {
    header(lines, "Allele-Specific Design");
    if (c.knownVariant) lines.push(pad("Known Variant", c.knownVariant));
    if (c.alleleSpecific != null) lines.push(pad("Allele-Specific Targeting", c.alleleSpecific ? "Yes" : "No"));
    if (c.alleleDiscriminationScore != null)
      lines.push(pad("Allele Discrimination", `${(c.alleleDiscriminationScore * 100).toFixed(0)}/100 (mismatch proximity to RNase H gap center)`));
    if (c.alleleDiscriminationNote) lines.push(pad("Discrimination Note", c.alleleDiscriminationNote));
    if (c.alleleNotes) lines.push(pad("Allele Notes", c.alleleNotes));
    lines.push("");
  }

  if (c.knownRegulatoryElement) {
    header(lines, "Upregulation Design");
    if (c.defectNotes) lines.push(pad("Defect Notes", c.defectNotes));
    if (c.knownRegulatoryElement) lines.push(pad("Known Regulatory Element", c.knownRegulatoryElement));
    lines.push("");
  }

  if ("spliceMaskingScore" in c && c.spliceMaskingScore !== undefined) {
    const u = c as AssoCandidate & {
      targetPoisonExon?: string;
      spliceElement?: string;
      spliceMaskingScore?: number;
      predictedNmdSuppression?: number;
      estimatedFoldRestoration?: number;
      canonicalOffSpliceHits?: number;
    };
    header(lines, "TANGO: Poison Exon Skipping");
    if (u.targetPoisonExon) lines.push(pad("Target Poison Exon", u.targetPoisonExon));
    if (u.spliceElement) lines.push(pad("Splice Element", u.spliceElement));
    if (u.spliceMaskingScore != null) lines.push(pad("Splice Masking Score", `${Math.round(u.spliceMaskingScore * 100)}/100`));
    if (u.predictedNmdSuppression != null) lines.push(pad("Predicted NMD Suppression", `${(u.predictedNmdSuppression * 100).toFixed(1)}%`));
    if (u.estimatedFoldRestoration != null) lines.push(pad("Estimated Fold Restoration", `${(u.estimatedFoldRestoration * 100).toFixed(1)}%`));
    if (u.canonicalOffSpliceHits != null) lines.push(pad("Canonical Off-splice Hits", u.canonicalOffSpliceHits));
    lines.push("");
  }

}

function formatRnaEditingCandidate(lines: string[], c: RnaEditingCandidate, rank: number): void {
  lines.push(`  ── Candidate #${rank} ─────────────────────────────`);
  lines.push(`  Rank              #${rank}`);
  lines.push(`  Chemistry         ${c.chemistry}`);
  lines.push(`  Mechanism         ${c.mechanismId}`);
  lines.push(`  Guide Length      ${c.guideLength} nt`);
  lines.push(`  Edit Type         ${c.editType}`);
  lines.push(`  Target Base Pair  ${c.targetBasePair}`);
  if (c.variantHgvs) lines.push(`  Variant           ${c.variantHgvs}`);
  lines.push(`  Target Region     ${c.targetRegion}`);
  if (c.modifications.length > 0) lines.push(`  Modifications     ${c.modifications.join(", ")}`);
  lines.push(`  Confidence        ${confidence(c.qualityScore)} (${c.qualityScore}/100)`);
  lines.push("");

  lines.push("  Guide Sequence (5'→3'):");
  lines.push(`    ${c.sequence}`);
  lines.push("");
  lines.push(`  Molecular Weight:    ${c.molecularWeight?.toLocaleString() ?? "—"} Da`);
  lines.push(`  Extinction Coeff:    ${c.extinctionCoefficient?.toLocaleString() ?? "—"} L/mol·cm`);
  lines.push("");

  header(lines, "Biophysical Properties");
  lines.push(pad("Melting Temperature", `${c.meltingTempC} °C`));
  lines.push(pad("Adjusted Tm (recruitment)", `${c.adjustedTmC} °C`));
  lines.push(pad("Binding Affinity Adjustment", c.bindingAffinityAdjustment));
  lines.push(pad("GC Content", `${c.gcContent}%`));
  lines.push(pad("Self-Structure MFE", `${c.selfStructureMfe} kcal/mol`));
  lines.push(pad("Target Duplex ΔG", `${c.targetDuplexEnergy} kcal/mol`));
  lines.push(pad("Poly-G Tracts (≥3 G)", c.polygTracts));
  lines.push(pad("CpG Dinucleotides", c.cpgCount));
  lines.push(pad("Longest Homopolymer Run", `${c.longestHomopolymer} bp`));
  lines.push(pad("Purine Content (A+G)", `${(c.purineContent * 100).toFixed(1)}%`));
  lines.push(pad("GC Skew", c.gcSkew.toFixed(3)));
  lines.push(pad("Sequence Complexity", c.sequenceComplexity.toFixed(3)));
  lines.push("");

  header(lines, "Editing Efficiency");
  if (c.onTargetEditScore != null) lines.push(pad("On-target Edit Score", `${c.onTargetEditScore}/100`));
  lines.push(pad("Bystander Risk Count", c.bystanderRiskCount));
  if (c.bystanderRiskDetails.length > 0) {
    c.bystanderRiskDetails.forEach((b) => {
      lines.push(pad(`  pos ${b.position} (${b.risk})`, b.context));
    });
  }
  if (c.adarRecruitmentScore != null) lines.push(pad("ADAR Recruitment Score", `${c.adarRecruitmentScore}/100`));
  if (c.splicingEfficiencyScore != null) lines.push(pad("Splicing Efficiency", `${c.splicingEfficiencyScore}/100`));
  if (c.spliceosomeRecruitmentScore != null) lines.push(pad("Spliceosome Recruitment", `${c.spliceosomeRecruitmentScore}/100`));
  lines.push("");

  if (c.spliceSiteScore != null) {
    header(lines, "SMaRT Trans-Splicing");
    if (c.spliceSiteScore != null) lines.push(pad("Splice Site Score", `${c.spliceSiteScore}/100`));
    if (c.bindingDomainScore != null) lines.push(pad("Binding Domain Score", `${c.bindingDomainScore}/100`));
    if (c.spliceCompatibilityScore != null) lines.push(pad("Splice Compatibility", `${c.spliceCompatibilityScore}/100`));
    if (c.chemistryModificationScore != null) lines.push(pad("Chemistry/Mod Score", `${c.chemistryModificationScore}/100`));
    if (c.splicingDirection) lines.push(pad("Splicing Direction", c.splicingDirection));
    if (c.abdLength != null) lines.push(pad("Binding Domain Length", `${c.abdLength} nt`));
    if (c.spliceJunctionPosition != null) lines.push(pad("Splice Junction Position", c.spliceJunctionPosition));
    if (c.junctionOffset != null) lines.push(pad("Junction Offset", c.junctionOffset));
    if (c.spliceJunctionLabel) lines.push(pad("Splice Junction", c.spliceJunctionLabel));
    lines.push("");
  }

  header(lines, "Composite Quality Score");
  lines.push(pad("FINAL SCORE", `${c.qualityScore}/100`));
  lines.push(pad("GC Content Score (×0.30)", c.gcScore));
  lines.push(pad("Melting Temp Score (×0.40)", c.tmScore));
  lines.push(pad("MFE Penalty", `-${c.mfePenalty}`));
  if (c.mechanismNotes) lines.push(pad("Mechanism Notes", c.mechanismNotes));
  lines.push("");
}

function mechanismDetail(ctx: AsoReportContext, key: string): string | null {
  const v = ctx.mechanism?.detail?.[key];
  if (v == null || v === "") return null;
  return String(v);
}

export function buildAsoReport(ctx: AsoReportContext): string {
  const { gene, mechanism, therapeuticGoal, target, design, results, reportTitle } = ctx;
  const goal = goalInfo(therapeuticGoal);
  const date = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const lines: string[] = [];
  lines.push(RULE);
  lines.push("  ASO DESIGN REPORT");
  lines.push("  RNA Therapeutics Platform");
  lines.push(`  ${reportTitle ?? "Candidate Design & Mechanism Report"}`);
  lines.push(RULE);
  lines.push(`  Generated: ${date}`);
  lines.push("");

  // 1. Project & gene
  header(lines, "1. Project & Gene");
  if (gene) {
    lines.push(pad("Gene Symbol", gene.geneSymbol));
    if (gene.geneName) lines.push(pad("Gene Name", gene.geneName));
    if (gene.organism) lines.push(pad("Organism", gene.organism));
    if (gene.disease || gene.diseaseName) lines.push(pad("Disease", gene.disease || gene.diseaseName));
    if (gene.geneId) lines.push(pad("Ensembl ID", gene.geneId));
    if (gene.canonicalTranscript) lines.push(pad("Canonical Transcript", gene.canonicalTranscript));
    if (gene.totalTranscripts != null) lines.push(pad("Total Transcripts", gene.totalTranscripts));
    if (gene.chromosome) lines.push(pad("Chromosome", gene.chromosome));
    if (gene.geneFunction) lines.push(pad("Function", gene.geneFunction));
  } else {
    lines.push("  No confirmed gene in session.");
  }
  lines.push("");

  // 2. Therapeutic goal
  header(lines, "2. Therapeutic Goal");
  lines.push(pad("Goal ID", therapeuticGoal || "—"));
  lines.push(pad("Goal", goal.name));
  if (goal.description) lines.push(pad("Description", goal.description));
  lines.push("");

  // 3. Mechanism
  header(lines, "3. Mechanism");
  if (mechanism) {
    lines.push(pad("Mechanism ID", mechanism.id));
    lines.push(pad("Mechanism", mechanism.name));
    const designRules = mechanismDetail(ctx, "designRules");
    const scoring = mechanismDetail(ctx, "scoring");
    const rnaTarget = mechanismDetail(ctx, "rnaTargetRegion");
    const asoChem = mechanismDetail(ctx, "asoChemistry");
    const evidence = mechanismDetail(ctx, "evidenceLevel");
    const fda = mechanismDetail(ctx, "fdaApprovedDrugs");
    const clinical = mechanismDetail(ctx, "clinicalTrialExamples");
    const adv = mechanismDetail(ctx, "advantages");
    const lim = mechanismDetail(ctx, "limitations");
    const offTarget = mechanismDetail(ctx, "offTargetConsiderations");
    if (rnaTarget) lines.push(pad("RNA Target Region", rnaTarget));
    if (asoChem) lines.push(pad("ASO Chemistry", asoChem));
    if (designRules) lines.push(pad("Design Rules", designRules));
    if (scoring) lines.push(pad("Scoring", scoring));
    if (evidence) lines.push(pad("Evidence Level", evidence));
    if (fda) lines.push(pad("FDA-Approved Drugs", fda));
    if (clinical) lines.push(pad("Clinical Trials", clinical));
    if (adv) lines.push(pad("Advantages", adv));
    if (lim) lines.push(pad("Limitations", lim));
    if (offTarget) lines.push(pad("Off-target Considerations", offTarget));
    if (results?.mechanismNotes) lines.push(pad("Mechanism Notes", results.mechanismNotes));
  } else {
    lines.push("  No mechanism selected.");
  }
  lines.push("");

  // 4. Design inputs
  header(lines, "4. Design Inputs");
  if (design.chemistry) lines.push(pad("Chemistry", design.chemistry));
  if (design.asoLength != null) lines.push(pad("Oligo Length", `${design.asoLength} nt`));
  if (design.guideLength != null) lines.push(pad("Guide Length", `${design.guideLength} nt`));
  if (design.modifications && design.modifications.length > 0) {
    lines.push(pad("Modifications", design.modifications.join(", ")));
  }
  if (design.defectType) lines.push(pad("Defect Type", design.defectType));
  if (design.silencingScope) lines.push(pad("Silencing Scope", design.silencingScope));
  if (design.isTotalKnockdown || (design.targetExons == null && design.silencingScope === "total_knockdown")) {
    lines.push(pad("Target Exons", "All exons (total knockdown)"));
  } else if (design.targetExons && design.targetExons.length > 0) {
    lines.push(pad("Target Exons", design.targetExons.join(", ")));
  }
  if (design.knownVariant) lines.push(pad("Known Variant", design.knownVariant));
  if (design.knownRegulatoryElement) lines.push(pad("Known Regulatory Element", design.knownRegulatoryElement));
  if (design.targetPoisonExon) lines.push(pad("Target Poison Exon", design.targetPoisonExon));
  if (design.spliceElement) lines.push(pad("Splice Element", design.spliceElement));
  if (design.editType) lines.push(pad("Edit Type", design.editType));
  if (design.variantHgvs) lines.push(pad("Target Variant", design.variantHgvs));
  if (design.mismatchPocket) lines.push(pad("Mismatch Pocket", design.mismatchPocket));
  if (design.maxBystanderEdits != null) lines.push(pad("Max Bystander Edits", design.maxBystanderEdits));
  if (design.splicingDirection) lines.push(pad("Splicing Direction", design.splicingDirection));
  if (design.abdLength != null) lines.push(pad("Binding Domain Length", `${design.abdLength} nt`));
  lines.push("");

  // 5. Target analysis
  header(lines, "5. Target Analysis");
  if (target) {
    if (target.canonicalTranscript?.id) {
      lines.push(pad("Canonical Transcript", target.canonicalTranscript.id));
      if (target.canonicalTranscript.biotype) lines.push(pad("Transcript Biotype", target.canonicalTranscript.biotype));
    }
    lines.push(pad("Coding Transcripts", target.totalCodingTranscripts));
    if (target.cdsLength != null) lines.push(pad("CDS Length", `${target.cdsLength} bp`));
    lines.push(pad("Exons", formatExons(target)));
    if (target.mrnaSequence) lines.push(pad("mRNA Length", `${target.mrnaSequence.length} bp`));
  } else {
    lines.push("  No target analysis loaded.");
  }
  lines.push("");

  // 6. Candidates
  const candidates = results?.candidates ?? [];
  header(lines, `6. Generated Candidates (${candidates.length})`);
  if (candidates.length === 0) {
    lines.push("  No candidates generated.");
  }
  const isAsso = (results as GenerateResponse)?.asoLength !== undefined || candidates.some((c: any) => ("duplexStability" in c || "realMetrics" in c) && !("editType" in c));
  candidates.forEach((c: any, i: number) => {
    if (isAsso) {
      formatAsoCandidate(lines, c as AssoCandidate, i + 1);
    } else {
      formatRnaEditingCandidate(lines, c as RnaEditingCandidate, i + 1);
    }
  });

  lines.push(SEP);
  lines.push("  REPORT END");
  lines.push(SEP);
  return lines.join("\n");
}

export function reportFilename(geneSymbol: string | null | undefined, kind = "aso-design"): string {
  const sym = (geneSymbol || "gene").replace(/[^A-Za-z0-9_-]/g, "");
  return `${sym}-${kind}-report.txt`;
}

export function triggerDownload(content: string, filename: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
