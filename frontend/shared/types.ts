// shared/types.ts

/**
 * High-level Therapeutic Goal as defined in TG.csv
 */
export interface TherapeuticGoal {
  goalId: string;        // e.g., "TG01"
  name: string;          // e.g., "Gene Silencing"
  description: string;   // Summary of the therapeutic strategy
}

/**
 * Goal to Mechanism mapping from Mapping.csv
 */
export interface GoalMechanismMap {
  therapeuticGoalId: string;
  associatedMechanismIds: string[]; // e.g., ["A1", "A2", "A12", "A15", "A21"]
}

/**
 * Scientific literature reference attached to rulebooks
 */
export interface LiteratureReference {
  refId: string;
  paperName: string;
  doiOrPmid: string;
  usedFor: string;
}

/**
 * Granular fields contained inside individual mechanism sheets (A1 - A26)
 */
export interface MechanismRulebook {
  mechanismId: string;                  // e.g., "A7"
  mechanismName: string;                // e.g., "Exon Skipping"
  platform: string;                     // e.g., "Splice modulation"
  moleculeType: string;                 // e.g., "Steric-Blocking ASO"
  mechanismCategory: string;
  therapeuticGoal: string;
  molecularDefect: string;
  diseaseMechanism: string;
  suitableVariantTypes: string[];       // Parsed from comma-separated list
  typicalDiseases: string[];
  rnaTargetRegion: string;
  transcriptRequirement: string;
  chemistry: string;
  typicalLength: string;
  designRules: string[];
  secondaryStructureRequirement: string;
  offTargetConsiderations: string;
  advantages: string;
  limitations: string;
  fdaApprovedDrugs: string[];
  clinicalTrialExamples: string[];
  evidenceLevel: 'High' | 'Moderate-High' | 'Moderate' | 'Low-Moderate' | 'Low';
  references: LiteratureReference[];
}

/**
 * Pipeline Execution Workflow State (Matching the 10-page architecture)
 */
export interface PipelineRunState {
  runId: string;
  inputProfile: {
    organism: string;
    diseaseName: string;
    geneSymbol: string;
  };
  selectedGoalId?: string;
  selectedMechanismId?: string;
  currentStep: number; // 1 to 10
  modules: {
    biologicalEligibility: 'Passed' | 'Failed' | 'Running' | 'Idle';
    transcriptAnalysis: 'Passed' | 'Failed' | 'Running' | 'Idle';
    targetSiteDiscovery: 'Passed' | 'Failed' | 'Running' | 'Idle';
    candidateDesign: 'Passed' | 'Failed' | 'Running' | 'Idle';
  };
}