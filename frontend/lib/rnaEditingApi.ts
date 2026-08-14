import {
  RnaEditingDesignOptions,
  RnaEditingGenerateResponse,
} from "@/types/rnaEditing";
import { TargetAnalysis } from "@/types/geneSilencing";
import { ClinVarVariant } from "@/types/geneSilencing";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchRnaEditingTarget(
  ensemblGeneId: string,
  geneSymbol?: string,
  organism?: string,
): Promise<TargetAnalysis> {
  const params = new URLSearchParams();
  if (geneSymbol) params.set("gene_symbol", geneSymbol);
  if (organism) params.set("organism", organism);

  const res = await fetch(
    `${API_BASE}/api/rna-editing/target/${ensemblGeneId}?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Could not load target analysis.");
  return res.json();
}

export async function fetchRnaEditingOptions(): Promise<RnaEditingDesignOptions> {
  const res = await fetch(`${API_BASE}/api/rna-editing/options`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load design options.");
  return res.json();
}

export async function generateRnaEditingCandidates(params: {
  ensemblGeneId: string;
  mechanismId: string;
  variantHgvs: string;
  editType: string;
  guideLength?: number;
  chemistry?: string;
  modifications?: string[];
  mismatchPocket?: string;
  maxBystanderEdits?: number;
  splicingDirection?: string;
  abdLength?: number;
  deliveryContext?: string;
  geneSymbol?: string;
  organism?: string;
}): Promise<RnaEditingGenerateResponse> {
  const res = await fetch(`${API_BASE}/api/rna-editing/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ensembl_gene_id: params.ensemblGeneId,
      mechanism_id: params.mechanismId,
      variant_hgvs: params.variantHgvs,
      edit_type: params.editType,
      guide_length: params.guideLength ?? 71,
      chemistry: params.chemistry ?? "2ome_ps",
      modifications: params.modifications ?? ["phosphorothioate"],
      mismatch_pocket: params.mismatchPocket ?? "c",
      max_bystander_edits: params.maxBystanderEdits ?? 0,
      splicing_direction: params.splicingDirection ?? null,
      abd_length: params.abdLength ?? 150,
      delivery_context: params.deliveryContext ?? null,
      gene_symbol: params.geneSymbol ?? "",
      organism: params.organism ?? "homo_sapiens",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not generate guide candidates.");
  }
  return res.json();
}

export async function fetchRnaEditingClinVarVariants(
  ensemblGeneId: string,
): Promise<ClinVarVariant[]> {
  const res = await fetch(
    `${API_BASE}/api/rna-editing/variants/${ensemblGeneId}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not load ClinVar variants.");
  }
  const data = await res.json();
  return data.variants ?? [];
}
