import { TargetAnalysis, DesignOption } from "./geneSilencing";

export interface BystanderAdenosine {
  position: number;
  risk: "low" | "medium" | "high";
  context: string;
}

export interface RnaEditingCandidate {
  sequence: string;
  guideLength: number;
  targetBasePair: string;
  meltingTempC: number;
  adjustedTmC: number;
  bindingAffinityAdjustment: number;
  gcContent: number;
  gcScore: number;
  tmScore: number;
  selfStructureMfe: number;
  mfePenalty: number;
  targetDuplexEnergy: number;
  nucleaseResistance: number;
  onTargetEditScore: number | null;
  bystanderRiskCount: number;
  bystanderRiskDetails: BystanderAdenosine[];
  adarRecruitmentScore: number | null;
  splicingEfficiencyScore: number | null;
  spliceosomeRecruitmentScore: number | null;
  polygTracts: number;
  cpgCount: number;
  longestHomopolymer: number;
  purineContent: number;
  sequenceComplexity: number;
  gcSkew: number;
  molecularWeight: number;
  extinctionCoefficient: number;
  qualityScore: number;
  targetRegion: string;
  mechanismId: string;
  chemistry: string;
  modifications: string[];
  editType: string;
  variantHgvs: string;
  mechanismNotes: string;
  // SMaRT trans-splicing specific fields
  spliceSiteScore: number | null;
  bindingDomainScore: number | null;
  spliceCompatibilityScore: number | null;
  chemistryModificationScore: number | null;
  splicingDirection: string | null;
  abdLength: number | null;
  spliceJunctionPosition: number | null;
  junctionOffset: number | null;
  spliceJunctionLabel: string | null;
}

export interface RnaEditingDesignOptions {
  chemistryOptions: DesignOption[];
  modificationOptions: DesignOption[];
  lengthRange: { min: number; max: number; default: number; step: number };
}

export interface RnaEditingGenerateResponse {
  geneId: string;
  mechanismId: string;
  variantHgvs: string;
  editType: string;
  chemistry: string;
  modifications: string[];
  guideLength: number;
  totalExons: number;
  cdsLength: number | null;
  mechanismNotes: string;
  splicingDirection: string | null;
  abdLength: number | null;
  candidates: RnaEditingCandidate[];
}
