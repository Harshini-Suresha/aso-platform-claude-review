import {
  ProteinReplacementInputs,
  ProteinReplacementResponse,
  DesignOptions,
  RnaCandidate,
} from "@/types/proteinReplacement";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchDesignOptions(): Promise<DesignOptions> {
  const res = await fetch(`${API_BASE}/api/protein-replacement/options`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load design options.");
  return res.json();
}

export async function generateConstructs(
  params: ProteinReplacementInputs
): Promise<ProteinReplacementResponse> {
  const res = await fetch(`${API_BASE}/api/protein-replacement/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_symbol: params.targetSymbol,
      rna_modality: params.rnaModality,
      codon_strategy: params.codonStrategy,
      utr_pair: params.utrPair,
      ires_selection: params.iresSelection || null,
      nucleotide_modification: params.nucleotideModification,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not generate constructs.");
  }
  return res.json();
}
