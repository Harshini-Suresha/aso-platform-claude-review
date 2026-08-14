// Curated reference gene data for common RNA-therapeutic viral targets.
//
// Viral genomes are not covered by Ensembl, so this is a small hand-curated
// dataset rather than a live connector — enough to demo the workflow end to
// end for the 6 viruses in Tier 5. A real deployment would replace this with
// a proper connector (e.g. NCBI Virus / RefSeq viral genome parsing), mirroring
// backend/connectors/{ncbi,ensembl}/* in the main scaffold.

export interface CuratedViralGene {
  symbol: string;
  product: string;
  approxLengthAa: number | null;
  function: string;
  referenceGenome: string; // RefSeq accession for the reference genome
}

export const VIRUS_GENES: Record<string, CuratedViralGene[]> = {
  "sars-cov-2": [
    { symbol: "ORF1AB", product: "Replicase polyprotein 1ab", approxLengthAa: 7096, function: "Encodes the viral RNA-dependent RNA polymerase and other non-structural proteins required for replication.", referenceGenome: "NC_045512.2" },
    { symbol: "S", product: "Spike glycoprotein", approxLengthAa: 1273, function: "Mediates receptor binding (ACE2) and membrane fusion for cell entry; primary vaccine and neutralizing-antibody target.", referenceGenome: "NC_045512.2" },
    { symbol: "E", product: "Envelope protein", approxLengthAa: 75, function: "Involved in virus assembly and release; forms ion channels.", referenceGenome: "NC_045512.2" },
    { symbol: "M", product: "Membrane glycoprotein", approxLengthAa: 222, function: "Central organizer of coronavirus assembly.", referenceGenome: "NC_045512.2" },
    { symbol: "N", product: "Nucleocapsid phosphoprotein", approxLengthAa: 419, function: "Packages the viral genome; common diagnostic and ASO target.", referenceGenome: "NC_045512.2" },
    { symbol: "ORF3A", product: "ORF3a protein", approxLengthAa: 275, function: "Viroporin implicated in inflammasome activation.", referenceGenome: "NC_045512.2" },
  ],
  "influenza-a": [
    { symbol: "PB2", product: "Polymerase basic protein 2", approxLengthAa: 759, function: "Subunit of the viral RNA polymerase; cap-snatching.", referenceGenome: "NC_007366.1" },
    { symbol: "PB1", product: "Polymerase basic protein 1", approxLengthAa: 757, function: "Catalytic subunit of the viral RNA-dependent RNA polymerase.", referenceGenome: "NC_007367.1" },
    { symbol: "HA", product: "Hemagglutinin", approxLengthAa: 566, function: "Mediates receptor binding and membrane fusion; major antigenic determinant.", referenceGenome: "NC_007362.1" },
    { symbol: "NP", product: "Nucleoprotein", approxLengthAa: 498, function: "Encapsidates viral RNA; part of the ribonucleoprotein complex.", referenceGenome: "NC_007373.1" },
    { symbol: "NA", product: "Neuraminidase", approxLengthAa: 454, function: "Cleaves sialic acid to release progeny virions; target of oseltamivir.", referenceGenome: "NC_007359.1" },
    { symbol: "M1", product: "Matrix protein 1", approxLengthAa: 252, function: "Structural protein underlying the viral envelope.", referenceGenome: "NC_007368.1" },
    { symbol: "NS1", product: "Non-structural protein 1", approxLengthAa: 230, function: "Antagonizes host interferon response.", referenceGenome: "NC_007369.1" },
  ],
  "hiv-1": [
    { symbol: "GAG", product: "Gag polyprotein", approxLengthAa: 500, function: "Structural proteins (matrix, capsid, nucleocapsid) required for virion assembly.", referenceGenome: "NC_001802.1" },
    { symbol: "POL", product: "Pol polyprotein", approxLengthAa: 1003, function: "Encodes reverse transcriptase, integrase, and protease enzymes.", referenceGenome: "NC_001802.1" },
    { symbol: "ENV", product: "Envelope glycoprotein (gp160)", approxLengthAa: 856, function: "Cleaved into gp120/gp41; mediates CD4 receptor binding and fusion.", referenceGenome: "NC_001802.1" },
    { symbol: "TAT", product: "Trans-activator of transcription", approxLengthAa: 101, function: "Transactivates the viral LTR promoter; a key ASO/RNAi target for latency reversal or silencing.", referenceGenome: "NC_001802.1" },
    { symbol: "REV", product: "Regulator of virion expression", approxLengthAa: 116, function: "Exports unspliced/partially spliced viral RNA from the nucleus.", referenceGenome: "NC_001802.1" },
    { symbol: "NEF", product: "Negative regulatory factor", approxLengthAa: 206, function: "Downregulates CD4/MHC-I; enhances viral infectivity.", referenceGenome: "NC_001802.1" },
  ],
  hbv: [
    { symbol: "C", product: "Core protein (HBcAg)", approxLengthAa: 183, function: "Forms the nucleocapsid; encapsidates pregenomic RNA.", referenceGenome: "NC_003977.2" },
    { symbol: "P", product: "Polymerase", approxLengthAa: 832, function: "Reverse transcriptase/RNase H; replicates the viral genome via an RNA intermediate — major ASO/siRNA target.", referenceGenome: "NC_003977.2" },
    { symbol: "S", product: "Surface antigen (HBsAg)", approxLengthAa: 226, function: "Major envelope protein; diagnostic marker and vaccine antigen.", referenceGenome: "NC_003977.2" },
    { symbol: "X", product: "HBx protein", approxLengthAa: 154, function: "Transcriptional transactivator implicated in hepatocarcinogenesis.", referenceGenome: "NC_003977.2" },
  ],
  hcv: [
    { symbol: "CORE", product: "Core protein", approxLengthAa: 191, function: "Nucleocapsid protein; also modulates host lipid metabolism.", referenceGenome: "NC_004102.1" },
    { symbol: "E1", product: "Envelope glycoprotein 1", approxLengthAa: 192, function: "Forms the E1/E2 heterodimer required for cell entry.", referenceGenome: "NC_004102.1" },
    { symbol: "E2", product: "Envelope glycoprotein 2", approxLengthAa: 363, function: "Binds host receptor CD81; major target of neutralizing antibodies.", referenceGenome: "NC_004102.1" },
    { symbol: "NS3", product: "Non-structural protein 3", approxLengthAa: 631, function: "Serine protease / RNA helicase; direct-acting antiviral target.", referenceGenome: "NC_004102.1" },
    { symbol: "NS5A", product: "Non-structural protein 5A", approxLengthAa: 447, function: "RNA replication complex component; DAA target.", referenceGenome: "NC_004102.1" },
    { symbol: "NS5B", product: "Non-structural protein 5B", approxLengthAa: 591, function: "RNA-dependent RNA polymerase; target of sofosbuvir and related drugs.", referenceGenome: "NC_004102.1" },
  ],
  rsv: [
    { symbol: "NS1", product: "Non-structural protein 1", approxLengthAa: 139, function: "Antagonizes host type-I interferon response.", referenceGenome: "NC_001803.1" },
    { symbol: "N", product: "Nucleoprotein", approxLengthAa: 391, function: "Encapsidates genomic RNA.", referenceGenome: "NC_001803.1" },
    { symbol: "P", product: "Phosphoprotein", approxLengthAa: 241, function: "Polymerase cofactor.", referenceGenome: "NC_001803.1" },
    { symbol: "M", product: "Matrix protein", approxLengthAa: 256, function: "Drives virion assembly and budding.", referenceGenome: "NC_001803.1" },
    { symbol: "G", product: "Attachment glycoprotein", approxLengthAa: 298, function: "Mediates attachment to host respiratory epithelium.", referenceGenome: "NC_001803.1" },
    { symbol: "F", product: "Fusion glycoprotein", approxLengthAa: 574, function: "Mediates membrane fusion; target of palivizumab/nirsevimab.", referenceGenome: "NC_001803.1" },
    { symbol: "L", product: "RNA-dependent RNA polymerase (Large protein)", approxLengthAa: 2165, function: "Catalytic subunit of the viral polymerase complex.", referenceGenome: "NC_001803.1" },
  ],
};

export function findViralGene(
  virusId: string,
  symbol: string
): CuratedViralGene | null {
  const genes = VIRUS_GENES[virusId];
  if (!genes) return null;
  const upper = symbol.trim().toUpperCase();
  return genes.find((g) => g.symbol === upper) ?? null;
}
