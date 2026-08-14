import { AssoCandidate } from "./geneSilencing";

export type { AssoCandidate };

export interface UpregulationCandidate extends AssoCandidate {
  // TANGO-specific fields (mechanism A3 only)
  spliceMaskingScore?: number;
  predictedNmdSuppression?: number;
  estimatedFoldRestoration?: number;
  canonicalOffSpliceHits?: number;
  targetPoisonExon?: string;
  spliceElement?: string;
  // Weighted components of the composite score (duplex + Tm fit), surfaced so
  // the UI can show exactly how each candidate was ranked.
  scoreBreakdown?: {
    duplexScore: number;
    tmFitScore: number;
    duplexRaw: number;
    tmRaw: number;
  };
}

export interface UpregulationGenerateResponse {
  geneId: string;
  mechanismId: string;
  chemistry: string;
  modifications: string[];
  asoLength: number;
  totalExons: number;
  cdsLength: number | null;
  mechanismNotes: string;
  candidates: UpregulationCandidate[];
}

export interface UpregulationMechanismDesign {
  label: string;
  target_region: string;
  preferred_chemistry: string[];
  forced_length?: number;
  notes: string;
}

export interface UpregulationDesignOptions {
  chemistryOptions: { id: string; label: string; description: string; detail: string }[];
  modificationOptions: { id: string; label: string; description: string; detail: string }[];
  lengthRange: { min: number; max: number; default: number; step: number };
  mechanisms: Record<string, UpregulationMechanismDesign>;
}
