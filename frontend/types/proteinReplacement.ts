export interface ProteinReplacementInputs {
  targetSymbol: string;
  rnaModality: string;
  codonStrategy: string;
  utrPair: string;
  iresSelection: string;
  nucleotideModification: string;
}

export interface ConstructOverview {
  targetGene: string;
  refSeq: string;
  nativeLength: string;
  vectorTopology: string;
  cai: number;
  uContent: number;
  primaryMechanism: string;
  feasibilityScore: number;
  predictedHalfLife: string;
}

export interface RnaCandidate {
  rank: number;
  constructId: string;
  modality: string;
  vectorTopology: string;
  cai: number;
  uContent: number;
  mfe: number;
  initiationEfficiency: number;
  predictedProteinYield: string;
  tlrRisk: string;
  signalPeptideStatus: string;
  secondaryStructureFlag: string;
  sequence: string;
  features: ConstructFeature[];
  diagnostics: ConstructDiagnostics;
  fivePrimeUtrLength?: number;
  orfLength?: number;
  threePrimeUtrLength?: number;
  polyATailLength?: number;
  gcContent?: number;
  proteinLength?: string;
  molecularWeight?: string;
}

export interface ConstructFeature {
  name: string;
  start: number;
  end: number;
  type: "cap" | "utr" | "kozak" | "orf" | "signal" | "utr3" | "polyA" | "ires" | "scarsplice";
}

export interface ConstructDiagnostics {
  aminoAcidIdentity: number;
  tlr3Score: number;
  tlr7Score: number;
  tlr8Score: number;
  mfePlot: string;
  fiveUtrHairpin: boolean;
}

export interface ProteinReplacementResponse {
  overview: ConstructOverview;
  candidates: RnaCandidate[];
}

export interface DesignOptions {
  rnaModalities: { id: string; label: string; description: string }[];
  codonStrategies: { id: string; label: string }[];
  utrPairs: { id: string; label: string }[];
  iresSelections: { id: string; label: string }[];
  nucleotideModifications: { id: string; label: string }[];
}
