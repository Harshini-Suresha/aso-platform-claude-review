import {
  MechanismOptions,
  MechanismRankingResponse,
  GeneFeaturesResponse,
  TherapeuticGoalId,
} from "@/types/mechanism";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchMechanismOptions(): Promise<MechanismOptions> {
  const res = await fetch(`${API_BASE}/api/mechanisms/options`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load mechanism selection options.");
  return res.json();
}

export async function fetchGeneFeatures(params: {
  geneSymbol: string;
  organism?: string;
  ensemblId?: string | null;
  tissueTpm?: number | null;
  exonCount?: number | null;
  totalTranscripts?: number | null;
  geneType?: string | null;
}): Promise<GeneFeaturesResponse> {
  const query = new URLSearchParams({ gene_symbol: params.geneSymbol });
  if (params.organism) query.set("organism", params.organism);
  if (params.ensemblId) query.set("ensembl_id", params.ensemblId);
  if (params.tissueTpm != null) query.set("tissue_tpm", String(params.tissueTpm));
  if (params.exonCount != null) query.set("exon_count", String(params.exonCount));
  if (params.totalTranscripts != null) query.set("total_transcripts", String(params.totalTranscripts));
  if (params.geneType) query.set("gene_type", params.geneType);

  const res = await fetch(`${API_BASE}/api/mechanisms/gene-features?${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not analyze gene features.");
  return res.json();
}

export async function rankGeneSilencingMechanisms(params: {
  geneSymbol: string;
  defectType: string;
  silencingScope: string;
  deliveryContext?: string | null;
  knownVariant?: string | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/gene-silencing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      defect_type: params.defectType,
      silencing_scope: params.silencingScope,
      delivery_context: params.deliveryContext || null,
      known_variant: params.knownVariant || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank mechanisms.");
  }
  return res.json();
}

export async function rankGeneUpregulationMechanisms(params: {
  geneSymbol: string;
  defectType: string;
  deliveryContext?: string | null;
  knownRegulatoryElement?: string | null;
  geneFeatures?: Record<string, unknown> | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/gene-upregulation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      defect_type: params.defectType,
      delivery_context: params.deliveryContext || null,
      known_regulatory_element: params.knownRegulatoryElement || null,
      gene_features: params.geneFeatures || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank mechanisms.");
  }
  return res.json();
}

export async function rankRnaProcessingMechanisms(params: {
  geneSymbol: string;
  spliceDefectType: string;
  targetExon?: string | null;
  deliveryContext?: string | null;
  knownVariant?: string | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/rna-processing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      splice_defect_type: params.spliceDefectType,
      target_exon: params.targetExon || null,
      delivery_context: params.deliveryContext || null,
      known_variant: params.knownVariant || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank mechanisms.");
  }
  return res.json();
}

export async function rankRnaEditingMechanisms(params: {
  geneSymbol: string;
  editType: string;
  variantHgvs?: string | null;
  enzymeRecruitment?: string | null;
  deliveryContext?: string | null;
  guideLength?: number | null;
  mismatchPocket?: string | null;
  maxBystanderEdits?: number | null;
  splicingDirection?: string | null;
  intronSite?: string | null;
  abdLength?: number | null;
  exonCount?: number | null;
  intronCount?: number | null;
  totalTranscripts?: number | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/rna-editing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      edit_type: params.editType,
      variant_hgvs: params.variantHgvs || null,
      enzyme_recruitment: params.enzymeRecruitment || null,
      delivery_context: params.deliveryContext || null,
      guide_length: params.guideLength ?? null,
      mismatch_pocket: params.mismatchPocket || null,
      max_bystander_edits: params.maxBystanderEdits ?? null,
      splicing_direction: params.splicingDirection || null,
      intron_site: params.intronSite || null,
      abd_length: params.abdLength ?? null,
      exon_count: params.exonCount ?? null,
      intron_count: params.intronCount ?? null,
      total_transcripts: params.totalTranscripts ?? null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank mechanisms.");
  }
  return res.json();
}

export async function rankRnaNeutralizationMechanisms(params: {
  geneSymbol: string;
  molecularDefect: string;
  neutralizationMode: string;
  repeatUnit?: string | null;
  estimatedRepeatCount?: string | null;
  stericChemistry?: string | null;
  targetRbp?: string | null;
  oligoLength?: number | null;
  deliveryContext?: string | null;
  targetGeneType?: string | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/rna-neutralization`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      molecular_defect: params.molecularDefect,
      neutralization_mode: params.neutralizationMode,
      repeat_unit: params.repeatUnit || null,
      estimated_repeat_count: params.estimatedRepeatCount || null,
      steric_chemistry: params.stericChemistry || null,
      target_rbp: params.targetRbp || null,
      oligo_length: params.oligoLength ?? null,
      delivery_context: params.deliveryContext || null,
      target_gene_type: params.targetGeneType || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank mechanisms.");
  }
  return res.json();
}

export async function rankTranslationalRegulationMechanisms(params: {
  geneSymbol: string;
  translationalGoal?: string | null;
  targetElement?: string | null;
  stericChemistry?: string | null;
  targetRbp?: string | null;
  oligoLength?: number | null;
  deliveryContext?: string | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/translational-regulation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      translational_goal: params.translationalGoal || null,
      target_element: params.targetElement || null,
      steric_chemistry: params.stericChemistry || null,
      target_rbp: params.targetRbp || null,
      oligo_length: params.oligoLength ?? null,
      delivery_context: params.deliveryContext || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank mechanisms.");
  }
  return res.json();
}

export async function rankRnaEngineeringMechanisms(params: {
  geneSymbol: string;
  structuralClass: string;
  targetType: string;
  scaffold: string;
  chemStabilization: string;
  kdGoal: string;
  deliveryContext?: string | null;
}): Promise<MechanismRankingResponse & { candidates: any[] }> {
  const res = await fetch(`${API_BASE}/api/mechanisms/rna-engineering`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      structural_class: params.structuralClass,
      target_type: params.targetType,
      scaffold: params.scaffold,
      chem_stabilization: params.chemStabilization,
      kd_goal: params.kdGoal,
      delivery_context: params.deliveryContext || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank RNA engineering mechanisms.");
  }
  return res.json();
}

export async function rankIsoformEngineeringMechanisms(params: {
  geneSymbol: string;
  isoformGoal: string;
  targetExonLocus?: string | null;
  spliceElementTarget?: string | null;
  stericChemistry?: string | null;
  deliveryContext?: string | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/isoform-engineering`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      isoform_goal: params.isoformGoal,
      target_exon_locus: params.targetExonLocus || null,
      splice_element_target: params.spliceElementTarget || null,
      steric_chemistry: params.stericChemistry || null,
      delivery_context: params.deliveryContext || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank isoform engineering mechanisms.");
  }
  return res.json();
}

export function getGoalLabel(goalId: TherapeuticGoalId): string {
  const labels: Record<TherapeuticGoalId, string> = {
    TG01: "Gene Silencing",
    TG02: "Gene Activation / Upregulation",
    TG03: "RNA Editing / Correction",
    TG04: "RNA Processing Modulation",
    TG05: "RNA Neutralization",
    TG06: "Translational Regulation",
    TG07: "Isoform Engineering",
    TG08: "Protein Replacement",
    TG09: "Protein Function Modulation",
  };
  return labels[goalId] ?? goalId;
}
