// Biological Information Retrieval Engine
// Orchestrates all connectors to build a full Target Object for a gene.
//
// Flow:
// retrieveGene() -> NCBI -> Ensembl -> UniProt -> ClinVar -> GTEx -> Reactome -> STRING -> PubMed -> Target Object

import { getGeneSummary } from "../connectors/ncbi/gene";
import { getTranscripts } from "../connectors/ensembl/transcript";
import { getSequence } from "../connectors/ensembl/sequence";
import { getExons } from "../connectors/ensembl/exon";
import { getProtein } from "../connectors/uniprot/protein";
import { getClinicalSignificance } from "../connectors/clinvar/variant";
import { getExpression } from "../connectors/gtex/expression";
import { getPathways } from "../connectors/reactome/pathway";
import { getInteractions } from "../connectors/string/interaction";
import { searchPubmed } from "../connectors/ncbi/pubmed";

export interface TargetObject {
  geneSymbol: string;
  geneName?: string;
  transcript?: string;
  protein?: string;
  transcriptFasta?: string;
  proteinFasta?: string;
  exonCount?: number;
  chromosome?: string;
}

// Milestone 1: only Ensembl (gene -> transcript -> sequence -> display)
export async function retrieveGeneBasic(geneSymbol: string): Promise<TargetObject> {
  const transcripts = await getTranscripts(geneSymbol);
  // TODO: pick canonical transcript, fetch sequence + exons, assemble TargetObject
  throw new Error("Not implemented - wire up Ensembl connector first");
}

// Full pipeline (build incrementally: NCBI -> UniProt -> ClinVar -> GTEx -> Reactome -> STRING -> PubMed)
export async function retrieveGene(geneSymbol: string): Promise<TargetObject> {
  // TODO: implement full orchestration once each connector is proven individually
  throw new Error("Not implemented");
}
