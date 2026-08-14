// frontend/types/pipeline.ts

export interface BindingSite {
  id: number;
  sequence: string;
  coordinates: string;
  score: number;
  accessibility: 'High' | 'Medium' | 'Low';
}

export interface TargetData {
  transcript: string;
  totalExons: number;
  targetExon: number;
  bindingSites: BindingSite[];
}