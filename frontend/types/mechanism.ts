export interface MechanismOption {
  id: string;
  label: string;
}

export interface MechanismOptions {
  geneSilencing: {
    defectTypes: MechanismOption[];
    silencingScopes: MechanismOption[];
  };
  geneUpregulation: {
    defectTypes: MechanismOption[];
  };
  rnaProcessing: {
    spliceDefectTypes: MechanismOption[];
  };
  rnaEditing: {
    editTypes: MechanismOption[];
    enzymeRecruitment: MechanismOption[];
    mismatchPocket: MechanismOption[];
    splicingDirections: MechanismOption[];
    intronSites: MechanismOption[];
  };
  rnaNeutralization: {
    molecularDefects: MechanismOption[];
    neutralizationModes: MechanismOption[];
    stericChemistries: MechanismOption[];
  };
  translationalRegulation: {
    translationalGoals: MechanismOption[];
    targetElements: MechanismOption[];
    stericChemistries: MechanismOption[];
  };
  rnaEngineering: {
    structuralClasses: MechanismOption[];
    targetTypes: MechanismOption[];
    scaffolds: MechanismOption[];
    chemStabilizations: MechanismOption[];
    kdGoals: MechanismOption[];
  };
  deliveryContexts: MechanismOption[];
}

export interface MechanismReference {
  refId: string;
  paper: string;
  doi: string | null;
  usedFor: string | null;
}

export type DeliveryTier =
  | "approved"
  | "trial"
  | "unestablished"
  | "contraindicated";

export interface RankedMechanism {
  id: string;
  name: string;
  category: string | null;
  eligible: boolean;
  designable: boolean;
  score: number;
  rationale: string[];
  deliveryTier: DeliveryTier | null;
  deliveryCitation: string | null;
  keywordMatch: boolean;
  evidenceLevel: { rating: string | null; note: string | null } | null;
  fdaApprovedDrugs: string | null;
  clinicalTrialExamples: string | null;
  suitableVariantTypes: string | null;
  rnaTargetRegion: string | null;
  asoChemistry: string | null;
  designRules: string | null;
  scoring: string | null;
  advantages: string | null;
  limitations: string | null;
  offTargetConsiderations: string | null;
  references: MechanismReference[];
}

export interface MechanismRankingResponse {
  geneSymbol: string;
  therapeuticGoal: string;
  inputs: {
    defectType?: string;
    silencingScope?: string;
    spliceDefectType?: string;
    targetExon?: string | null;
    deliveryContext: string | null;
    knownVariant?: string | null;
    knownRegulatoryElement?: string | null;
    editType?: string;
    variantHgvs?: string | null;
    enzymeRecruitment?: string | null;
    guideLength?: number | null;
    mismatchPocket?: string | null;
    maxBystanderEdits?: number | null;
    splicingDirection?: string | null;
    intronSite?: string | null;
    abdLength?: number | null;
    molecularDefect?: string;
    neutralizationMode?: string;
    repeatUnit?: string | null;
    estimatedRepeatCount?: string | null;
    stericChemistry?: string | null;
    targetRbp?: string | null;
    oligoLength?: number | null;
    targetGeneType?: string | null;
    translationalGoal?: string | null;
    targetElement?: string | null;
    structuralClass?: string;
    targetType?: string;
    scaffold?: string;
    chemStabilization?: string;
    kdGoal?: string;
  };
  results: RankedMechanism[];
}

export type TherapeuticGoalId =
  | "TG01"
  | "TG02"
  | "TG03"
  | "TG04"
  | "TG05"
  | "TG06"
  | "TG07"
  | "TG08"
  | "TG09";

export interface MechanismFeature {
  available: boolean;
  reason: string;
}

export interface GeneFeatureWarning {
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
}

export interface RnaEngineeringCandidate {
  rank: number;
  constructId: string;
  mechanismId: string;
  mechanismName: string;
  structuralMotif: string;
  length: number;
  tm: number;
  deltaGFolding: number;
  kdPrediction: number | string;
  targetSpecificityScore: number;
  serumStability: string;
  structuralRigidityFlag: string;
  sequence: string;
  dotBracket: string;
  rationale: string[];
  foldingScore: number;
  tHalfScore: number;
}

export interface GeneFeaturesResponse {
  features: Record<string, MechanismFeature>;
  warnings: GeneFeatureWarning[];
  geneInfo: {
    ensemblId: string | null;
    transcriptCount: number;
    exonCount: number | null;
    hasIntrons: boolean;
    hasNmdTranscripts: boolean;
    overlappingNats: number;
    uorfCount?: number;
    verified?: boolean;
    geneType?: string | null;
  };
  source?: "live" | "backup" | "fallback";
  backupTimestamp?: number;
}

export interface TherapeuticGoal {
  id: TherapeuticGoalId;
  name: string;
  description: string;
}

export const THERAPEUTIC_GOALS: TherapeuticGoal[] = [
  {
    id: "TG01",
    name: "Gene Silencing",
    description: "Reduce expression of a pathogenic gene or transcript through transcriptional or post-transcriptional mechanisms.",
  },
  {
    id: "TG02",
    name: "Gene Activation / Upregulation",
    description: "Increase endogenous gene expression or restore production of a beneficial protein.",
  },
  {
    id: "TG03",
    name: "RNA Editing / Correction",
    description: "Repair pathogenic RNA sequences or correct disease-causing RNA alterations without modifying genomic DNA.",
  },
  {
    id: "TG04",
    name: "RNA Processing Modulation",
    description: "Modify RNA maturation, including splicing, polyadenylation, transcript processing, and RNA stability.",
  },
  {
    id: "TG05",
    name: "RNA Neutralization",
    description: "Neutralize toxic RNA molecules or block pathogenic RNA-protein interactions without necessarily degrading the RNA.",
  },
  {
    id: "TG06",
    name: "Translational Regulation",
    description: "Increase or decrease protein synthesis by regulating mRNA translation without altering RNA abundance.",
  },
  {
    id: "TG07",
    name: "Isoform Engineering",
    description: "Generate therapeutically beneficial transcript or protein isoforms by modifying RNA processing or transcript architecture.",
  },
  {
    id: "TG08",
    name: "Protein Replacement",
    description: "Restore protein function by delivering therapeutic RNA molecules that encode the missing or defective protein.",
  },
  {
    id: "TG09",
    name: "Protein Function Modulation",
    description: "Modulate protein activity directly using RNA molecules that bind and regulate protein function rather than gene expression.",
  },
];
