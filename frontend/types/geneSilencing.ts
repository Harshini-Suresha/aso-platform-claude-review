export interface ExonInfo {
  id: string | null;
  index: number | null;
  start: number | null;
  end: number | null;
  length: number | null;
}

export interface TargetAnalysis {
  geneId: string;
  canonicalTranscript: { id: string; biotype: string } | null;
  totalCodingTranscripts: number;
  exons: ExonInfo[];
  cdsLength: number | null;
  mrnaSequence: string | null;
}

export interface DesignOption {
  id: string;
  label: string;
  description?: string;
  detail?: string;
}

export interface DesignOptions {
  chemistryOptions: DesignOption[];
  modificationOptions: DesignOption[];
  lengthRange: { min: number; max: number; default: number; step: number };
}

export interface RealMetrics {
  targetDuplexEnergy: number;
  meltingTempC: number;
  selfStructureMfe: number;
  gcContent: number;
  cpgCount: number;
  longestHomopolymer: number;
  purineContent: number;
  gcSkew: number;
  sequenceComplexity: number;
  polyGPass: boolean;
  molecularWeight: number;
  extinctionCoefficient: number;
  duplexStability: string;
}

export interface HeuristicEstimate {
  value: number;
  note: string;
}

export interface VariantParseResult {
  parsed: boolean;
  type?: string;
  cdsStart?: number;
  cdsEnd?: number;
  length?: number;
  reason?: string;
}

export interface HeuristicEstimates {
  nucleaseResistance: HeuristicEstimate;
  cellularUptake: HeuristicEstimate;
  bbbCrossing: HeuristicEstimate;
  synthesisDifficulty: HeuristicEstimate;
  offTargetRisk: HeuristicEstimate;
  immuneStimulation: HeuristicEstimate;
}

export interface AssoCandidate {
  sequence: string;
  length: number;
  compositeScore: number;
  learnedEfficacy: {
    available: boolean;
    value: number | null;
    modelInfo: string;
    scopeCaveat: string | null;
  };
  realMetrics: RealMetrics;
  heuristicEstimates: HeuristicEstimates;
  targetRegion: string;
  mechanismId: string;
  chemistry: string;
  modifications: string[];
  exonNumber: number | null;
  exonLength: number | null;
  deliveryContext: string;
  defectType: string;
  defectNotes: string;
  mechanismNotes?: string;
  silencingScope?: string;
  knownVariant?: string;
  seedSiteStatus?: string | null;
  seedSiteNote?: string | null;
  alleleSpecific?: boolean;
  alleleNotes?: string;
  alleleDiscriminationScore?: number | null;
  alleleDiscriminationNote?: string | null;
}

export interface GenerateResponse {
  geneId: string;
  mechanismId: string;
  targetExons: number[] | null;
  chemistry: string;
  modifications: string[];
  asoLength: number;
  totalExons: number;
  cdsLength: number | null;
  mechanismNotes: string;
  isAlleleSpecific?: boolean;
  variantParse?: VariantParseResult | null;
  candidates: AssoCandidate[];
}

export interface ClinVarVariant {
  variantId: string;
  clinicalSignificance: string;
  hgvsp: string;
  hgvsc: string;
  goldStars: number;
  rsid: string | null;
  alleleFrequency: number | null;
}
