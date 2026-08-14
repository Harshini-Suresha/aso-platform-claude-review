export interface IsoformEngineeringInputs {
  targetSymbol: string;
  isoformGoal: string;
  targetExonLocus: string;
  spliceElementTarget: string;
  stericChemistry: string;
  enforceInFrame: boolean;
}

export interface IsoformOverview {
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

export interface IsoformCandidate {
  rank: number;
  constructId: string;
  modality: string;
  vectorTopology: string;
  cai: number;
  uContent: number;
  mfe: number;
  initiationEfficiency: number;
  predictedIsoformYield: string;
  tlrRisk: string;
  spliceEfficiency: number;
  inFrameStatus: string;
  secondaryStructureFlag: string;
  sequence: string;
  features: ConstructFeature[];
  diagnostics: ConstructDiagnostics;
}

export interface ConstructFeature {
  name: string;
  start: number;
  end: number;
  type: "utr" | "kozak" | "orf" | "splice" | "utr3" | "polyA" | "exon" | "intron" | "scarsplice";
}

export interface ConstructDiagnostics {
  aminoAcidIdentity: number;
  tlr3Score: number;
  tlr7Score: number;
  tlr8Score: number;
  mfePlot: string;
  fiveUtrHairpin: boolean;
  spliceSiteScore: number;
}

export interface IsoformEngineeringResponse {
  overview: IsoformOverview;
  candidates: IsoformCandidate[];
}

export interface DesignOptions {
  isoformGoals: { id: string; label: string; description: string }[];
  targetExonLoci: { id: string; label: string }[];
  spliceElementTargets: { id: string; label: string }[];
  stericChemistries: { id: string; label: string }[];
}
