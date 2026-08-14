const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface GeneSuggestion {
  symbol: string;
  name: string;
  source: string;
  id?: string;
}

export interface ValidateGeneResponse {
  valid: boolean;
  officialSymbol?: string;
  geneId?: string;
  synonyms?: string[];
  suggestions?: GeneSuggestion[];
}

export async function suggestGenes(
  query: string,
  species: string = "homo_sapiens",
  limit: number = 8,
): Promise<GeneSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    q: trimmed,
    species,
    limit: String(limit),
  });

  const response = await fetch(`${API_BASE}/api/gene-search/suggest?${params.toString()}`);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

export async function validateGeneSymbol(
  symbol: string,
  species: string = "homo_sapiens",
): Promise<ValidateGeneResponse> {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return { valid: false, suggestions: [] };
  }

  const response = await fetch(`${API_BASE}/api/gene-search/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: trimmed, species }),
  });

  if (!response.ok) {
    return { valid: false, suggestions: [] };
  }

  return await response.json();
}
