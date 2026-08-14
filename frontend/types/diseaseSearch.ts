export interface GeneOrtholog {
  symbol: string;
  id: string;
  taxonId: number;
  source: "ensembl" | "alliance" | "ncbi";
  identity?: number | null;
}

export interface DiseaseGeneMatch {
  symbol: string;
  name: string | null;
  ensemblId: string | null;
  score: number | null;
  ortholog?: GeneOrtholog | null;
  biotype?: string | null;
  function?: string | null;
  evidence?: Record<string, number>;
  targetClass?: string[];
  tractability?: { modality: string; label: string }[];
  constraint?: Record<string, { exp: number | null; obs: number | null; oe: number | null }>;
  mousePhenotypes?: string[];
  pathways?: { pathway: string; pathwayId: string; topLevelTerm?: string | null }[];
  genomicLocation?: { chromosome: string | null; start: number | null; end: number | null } | null;
  hallmarks?: string[];
  chemicalProbes?: { drugId: string; isHighQuality: boolean }[];
  safetyLiabilities?: string[];
  aliases?: string[];
  uniprotId?: string | null;
  literatureCount?: number | null;
  isEssential?: boolean | null;
  associatedDiseaseCount?: number | null;
  interactionCount?: number | null;
}

export interface DiseaseSearchResponse {
  diseaseId: string | null;
  diseaseName: string | null;
  genes: DiseaseGeneMatch[];
  organism?: string;
  orthologMapped?: number;
}

export interface ClinicalReport {
  id?: string | null;
  clinicalStage?: string | null;
  trialPhase?: string | null;
  trialOverallStatus?: string | null;
  url?: string | null;
  title?: string | null;
  year?: number | null;
}

export interface KnownDrug {
  name: string;
  mechanismOfAction: string | null;
  phase: number | null;
  status: string | null;
  drugType?: string | null;
  id?: string | null;
  tradeNames?: string[];
  synonyms?: string[];
  approvedIndications?: string[];
  indicationCount?: number;
  warnings?: { warningType: string; efoTerm?: string | null; description?: string | null }[];
  mechanismsOfAction?: {
    actionTypes?: string[];
    targetTypes?: string[];
    rows?: { mechanismOfAction: string; actionType?: string | null }[];
  };
  clinicalReports?: ClinicalReport[];
}

export interface DiseaseDetailResponse {
  diseaseId: string | null;
  diseaseName: string | null;
  description: string | null;
  therapeuticAreas: string[];
  genes: DiseaseGeneMatch[];
  knownDrugs: KnownDrug[];
  organism?: string;
  orthologMapped?: number;
  synonyms: { term: string; relation: string }[];
  phenotypes: { id: string; name: string }[];
  hpoPhenotypes: { id: string; name: string }[];
  relatedDiseases: { id: string; score: number }[];
  childDiseases: { id: string; name: string }[];
  databaseRefs: Record<string, string>;
  literatureCount?: number | null;
  associatedTargetCount?: number | null;
  drugCandidateCount?: number | null;
  ancestors?: { id: string; name: string }[];
}
