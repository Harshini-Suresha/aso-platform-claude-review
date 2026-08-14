export interface TranslationalCandidate {
  rank: number;
  sequence: string;
  targetRegion: string;
  targetElement: string;
  chemistry: string;
  tm: number;
  stericBindingDeltaG: number;
  translationalChangeScore: number;
  offTargetRisk: "low" | "medium" | "high";
  gcContent: number;
  offTargetTranscriptCount: number;
  selfDimerMfe: number;
  hairpinEnergy: number;
  rnaseHSafetyFlag: "PASSED" | "FLAGGED";
  hasCentralDnaGap: boolean;
  centralGapSizeNt: number;
  oligoLength: number;
  repeatUnit: string;
  targetRbp: string;
}

export interface TranslationalResult {
  geneSymbol: string;
  mechanismId: string;
  mechanismName: string;
  mechanismCategory: string;
  translationalGoal: string;
  targetElement: string;
  stericChemistry: string;
  targetRbp: string;
  oligoLength: number;
  deliveryContext: string;
  overallFeasibilityScore: number;
  rbpDisplacementPotential: number;
  geneSymbolEnsembl: string;
  pathogenicRepeatMotif: string;
  estimatedRepeatLength: string;
  primaryMechanism: string;
  candidates: TranslationalCandidate[];
}

export interface DesignPipelineState {
  step: number;
  selectedCandidate: TranslationalCandidate | null;
  chemicalModifications: string[];
  deliveryConjugation: string;
  secondaryStructurePassed: boolean;
  selfDimerPassed: boolean;
}
