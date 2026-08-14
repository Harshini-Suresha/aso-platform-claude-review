export interface DiseaseGeneMatch {
  symbol: string;
  name: string | null;
  ensemblId: string | null;
  score: number | null;
}

export interface DiseaseSearchResponse {
  diseaseId: string | null;
  diseaseName: string | null;
  genes: DiseaseGeneMatch[];
}

export interface KnownDrug {
  name: string;
  mechanismOfAction: string | null;
  phase: number | null;
  status: string | null;
}

export interface DiseaseDetailResponse {
  diseaseId: string | null;
  diseaseName: string | null;
  description: string | null;
  therapeuticAreas: string[];
  genes: DiseaseGeneMatch[];
  knownDrugs: KnownDrug[];
}
