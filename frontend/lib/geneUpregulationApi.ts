import {
  UpregulationDesignOptions,
  UpregulationGenerateResponse,
} from "@/types/geneUpregulation";
import { TargetAnalysis } from "@/types/geneSilencing";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchUpregulationTargetAnalysis(
  ensemblGeneId: string,
  geneSymbol?: string,
  organism?: string
): Promise<TargetAnalysis> {
  const params = new URLSearchParams();
  if (geneSymbol) params.set("gene_symbol", geneSymbol);
  if (organism) params.set("organism", organism);
  const qs = params.toString();
  const url = `${API_BASE}/api/gene-upregulation/target/${ensemblGeneId}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not fetch target analysis.");
  }
  return res.json();
}

export async function fetchUpregulationDesignOptions(): Promise<UpregulationDesignOptions> {
  const res = await fetch(`${API_BASE}/api/gene-upregulation/options`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load design options.");
  return res.json();
}

export async function generateUpregulationCandidates(params: {
  ensemblGeneId: string;
  mechanismId: string;
  asoLength: number;
  chemistry: string;
  modifications: string[];
  defectType?: string;
  knownRegulatoryElement?: string;
  geneSymbol?: string;
  organism?: string;
  targetPoisonExon?: string;
  spliceElement?: string;
}): Promise<UpregulationGenerateResponse> {
  const res = await fetch(`${API_BASE}/api/gene-upregulation/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ensembl_gene_id: params.ensemblGeneId,
      mechanism_id: params.mechanismId,
      aso_length: params.asoLength,
      chemistry: params.chemistry,
      modifications: params.modifications,
      defect_type: params.defectType || null,
      known_regulatory_element: params.knownRegulatoryElement || null,
      gene_symbol: params.geneSymbol || "",
      organism: params.organism || "homo_sapiens",
      target_poison_exon: params.targetPoisonExon || null,
      splice_element: params.spliceElement || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not generate candidates.");
  }
  return res.json();
}
