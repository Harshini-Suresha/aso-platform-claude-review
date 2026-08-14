export interface RnaNeutralizationCandidate {
  rank: number;
  sequence: string;
  tilingPattern: string;
  chemistry: string;
  tm: number;
  stericBindingDeltaG: number;
  rbpDisplacementScore: number;
  repeatUnit: string;
  oligoLength: number;
  offTargetRepeatCount: number;
  rbpBindingDeltaG: number;
  asoDuplexDeltaG: number;
  hasCentralDnaGap: boolean;
  centralGapSizeNt: number;
  selfDimerMfe: number;
  hairpinRisk: string;
  gcContent: number;
  deliveryContext: string;
  recommendedConjugation: string;
  modificationPattern: string;
}

export interface RnaNeutralizationResult {
  geneSymbol: string;
  mechanismId: string;
  mechanismName: string;
  molecularDefect: string;
  neutralizationMode: string;
  repeatUnit: string;
  estimatedRepeatCount: string;
  stericChemistry: string;
  targetRbp: string;
  oligoLength: number;
  deliveryContext: string;
  candidates: RnaNeutralizationCandidate[];
}

export interface DesignPipelineState {
  step: number;
  selectedCandidate: RnaNeutralizationCandidate | null;
  chemicalModifications: string[];
  deliveryConjugation: string;
  secondaryStructurePassed: boolean;
  selfDimerPassed: boolean;
}
