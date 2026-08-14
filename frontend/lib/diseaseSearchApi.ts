import { DiseaseSearchResponse, DiseaseDetailResponse } from "@/types/diseaseSearch";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function searchDiseaseGenes(query: string, organism = "human"): Promise<DiseaseSearchResponse> {
  const res = await fetch(
    `${API_BASE}/api/disease-search?query=${encodeURIComponent(query)}&organism=${encodeURIComponent(organism)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { diseaseId: null, diseaseName: null, genes: [] };
  return res.json();
}

export async function fetchDiseaseDetail(query: string, organism = "human"): Promise<DiseaseDetailResponse> {
  const res = await fetch(
    `${API_BASE}/api/disease-search/detail?query=${encodeURIComponent(query)}&organism=${encodeURIComponent(organism)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return {
      diseaseId: null,
      diseaseName: null,
      description: null,
      therapeuticAreas: [],
      genes: [],
      knownDrugs: [],
      synonyms: [],
      phenotypes: [],
      hpoPhenotypes: [],
      relatedDiseases: [],
      childDiseases: [],
      databaseRefs: {},
      literatureCount: null,
      associatedTargetCount: null,
      drugCandidateCount: null,
      ancestors: [],
    };
  }
  return res.json();
}
