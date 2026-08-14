import {
  TargetAnalysis,
  DesignOptions,
  GenerateResponse,
  ClinVarVariant,
} from "@/types/geneSilencing";
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchTargetAnalysis(
  ensemblGeneId: string,
  geneSymbol?: string,
  organism?: string
): Promise<TargetAnalysis> {
  const params = new URLSearchParams();
  if (geneSymbol) params.set("gene_symbol", geneSymbol);
  if (organism) params.set("organism", organism);
  const qs = params.toString();
  const url = `${API_BASE}/api/gene-silencing/target/${ensemblGeneId}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not fetch target analysis.");
  }
  return res.json();
}

export async function fetchDesignOptions(): Promise<DesignOptions> {
  const res = await fetch(`${API_BASE}/api/gene-silencing/options`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load design options.");
  return res.json();
}

export async function generateCandidates(params: {
  ensemblGeneId: string;
  mechanismId: string;
  targetExonIndices?: number[] | null;
  asoLength: number;
  chemistry: string;
  modifications: string[];
  deliveryContext?: string;
  defectType?: string;
  silencingScope?: string;
  knownVariant?: string;
}): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/api/gene-silencing/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ensembl_gene_id: params.ensemblGeneId,
      mechanism_id: params.mechanismId,
      target_exon_indices: params.targetExonIndices ?? null,
      aso_length: params.asoLength,
      chemistry: params.chemistry,
      modifications: params.modifications,
      delivery_context: params.deliveryContext || null,
      defect_type: params.defectType || null,
      silencing_scope: params.silencingScope || null,
      known_variant: params.knownVariant || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not generate candidates.");
  }
  return res.json();
}

export async function emailAsoReport(reportContent: string, filename: string): Promise<{ message: string }> {
  const token = getToken();
  if (!token) throw new Error("Sign in to email a report to your registered address.");
  const res = await fetch(`${API_BASE}/api/gene-silencing/email-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ report_content: reportContent, filename }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Could not email the report.");
  return body;
}

export async function fetchClinVarVariants(
  ensemblGeneId: string
): Promise<ClinVarVariant[]> {
  const res = await fetch(
    `${API_BASE}/api/gene-silencing/variants/${ensemblGeneId}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.variants ?? [];
}
