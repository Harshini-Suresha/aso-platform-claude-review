import { GeneTargetObject } from "@/types/gene";

// Use the backend running beside the local Next.js app by default. A deployed
// environment can still override this with NEXT_PUBLIC_API_BASE_URL.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export async function fetchGene(
  organism: string, 
  diseaseName: string,
  geneSymbol: string
): Promise<GeneTargetObject> {
  const normalizedSymbol = geneSymbol.trim().toUpperCase();

  let data: Record<string, any> | null = null;

  try {
    const response = await fetch(`${API_BASE}/api/pipeline/initialize-target`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gene_symbol: geneSymbol.trim(),
        organism,
        disease_name: diseaseName.trim() || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Target gene "${normalizedSymbol}" could not be resolved.`
      );
    }

    data = await response.json();
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(`Target gene "${normalizedSymbol}" could not be resolved.`);
  }

  if (!data || typeof data !== "object") {
    throw new Error(`Target gene "${normalizedSymbol}" could not be resolved.`);
  }

  const finalSymbol = data.geneSymbol ?? normalizedSymbol;
  const synonymValues = Array.isArray(data.synonyms) ? data.synonyms : [];
  const seenSynonyms = new Set<string>();
  const filteredSynonyms = synonymValues.filter((syn: unknown): syn is string => {
    if (typeof syn !== "string") return false;
    const normalized = syn.trim().toLocaleUpperCase();
    if (!normalized || normalized === finalSymbol.toLocaleUpperCase() || normalized === "NONE IDENTIFIED") {
      return false;
    }
    if (seenSynonyms.has(normalized)) return false;
    seenSynonyms.add(normalized);
    return true;
  });
  
  return {
    organism: data.organism ?? null,
    diseaseName: data.diseaseName ?? null,
    geneSymbol: finalSymbol,

    geneName: data.geneName ?? null,
    geneFunction: data.geneFunction ?? null,
    geneId: data.geneId ?? null,
    entrezGeneId: data.entrezGeneId ?? null,
    hgncId: data.hgncId ?? `HGNC:${finalSymbol}`,
    chromosome: data.chromosome ?? null,
    location: data.location ?? null,
    cytoband: data.cytoband ?? null,
    genomeBuild: data.genomeBuild ?? null,
    genomicStart: data.genomicStart ?? null,
    genomicEnd: data.genomicEnd ?? null,
    strand: data.strand ?? null,
    geneType: data.geneType ?? "protein_coding",
    
    // Pass the real array values directly downstream without synthetic string wrappers
    synonyms: filteredSynonyms,
    source: data.source ?? [],
    
    // Mapped directly from backend numerical Taxon ID definitions
    taxonId: data.taxonId ?? null,

    canonicalTranscript: data.canonicalTranscript ?? null,
    canonicalTranscriptLabel: data.canonicalTranscriptLabel ?? null,
    otherTranscripts: data.otherTranscripts ?? [],
    totalTranscripts: data.totalTranscripts ?? null,

    variantExamples: Array.isArray(data.variantExamples) ? data.variantExamples : [],
    totalKnownVariantsClinvar: data.totalKnownVariantsClinvar ?? data.clinvarVariantCount ?? null,
    topVariants: Array.isArray(data.topVariants) ? data.topVariants : [],

    defaultTissue: data.defaultTissue ?? null,
    tissueExpressionLevel: data.tissueExpressionLevel ?? null,
    tissueTpm: data.tissueTpm ?? null,
    topTissues: Array.isArray(data.topTissues) ? data.topTissues : [],
    defaultCellType: data.defaultCellType ?? null,
    cellExpressionLevel: data.cellExpressionLevel ?? null,
    cellTpm: data.cellTpm ?? null,
    cellTypeAll: data.cellTypeAll ?? {},

    expressionStabilityCV: data.expressionStabilityCV ?? null,
    vitalOrganTpm: data.vitalOrganTpm ?? null,
    vitalOrganTissues: Array.isArray(data.vitalOrganTissues) ? data.vitalOrganTissues : [],
    dominantIsoformFraction: data.dominantIsoformFraction ?? null,
    dominantIsoformId: data.dominantIsoformId ?? null,
    diseaseFoldChange: data.diseaseFoldChange ?? null,
    singleCellPrevalence: data.singleCellPrevalence ?? null,
    circadianAmplitude: data.circadianAmplitude ?? null,
    intronRetentionRatio: data.intronRetentionRatio ?? null,
    developmentalExpression: data.developmentalExpression ?? null,
    alternativePolyadenylation: data.alternativePolyadenylation ?? null,
    nuclearRetentionIndex: data.nuclearRetentionIndex ?? null,

    proteinId: data.proteinId ?? null,
    proteinName: data.proteinName ?? null,
    proteinLength: data.proteinLength ?? null,
    molecularWeight: data.molecularWeight ?? null,
    isoelectricPoint: data.isoelectricPoint ?? null,
    secondaryStructureDistribution: data.secondaryStructureDistribution ?? null,
    criticalPhosphorylationSite: data.criticalPhosphorylationSite ?? null,
    ubiquitinationTarget: data.ubiquitinationTarget ?? null,
    quaternaryStructure: data.quaternaryStructure ?? null,
    stabilityScore: data.stabilityScore ?? null,
    subcellularLocation: data.subcellularLocation ?? null,
    criticalFunctionalDomains: data.criticalFunctionalDomains ?? null,
    disorderedContent: data.disorderedContent ?? null,
    proteosomalTurnover: data.proteosomalTurnover ?? null,
    alphafoldPlddt: data.alphafoldPlddt ?? null,
    gravyIndex: data.gravyIndex ?? null,
    proteinAbundance: data.proteinAbundance ?? null,
    tractability: data.tractability ?? null,
    interproId: data.interproId ?? null,
    pfamId: data.pfamId ?? null,
    pdbId: data.pdbId ?? null,
    mutationRate: data.mutationRate ?? null,
    uniprotAccession: data.uniprotAccession ?? null,

    disease: data.disease ?? null,
    diseaseAssociation: data.diseaseAssociation ?? null,
    diseaseAssociationSource: data.diseaseAssociationSource ?? [],
    phenotypes: data.phenotypes ?? [],
    associationStatus: data.associationStatus ?? null,
    omimId: data.omimId ?? null,
    diseaseMechanism: data.diseaseMechanism ?? null,
    diagnosticTests: data.diagnosticTests ?? [],
    clinicalSymptoms: data.clinicalSymptoms ?? [],
    carrierManifestations: data.carrierManifestations ?? [],
    therapeuticOptions: data.therapeuticOptions ?? [],

    exonCount: data.exonCount ?? null,
    intronCount: data.intronCount ?? null,
    cdsLength: data.cdsLength ?? null,
    geneLength: data.geneLength ?? null,

    dbSnpCount: data.dbSnpCount ?? null,
    gnomadAvailable: !!data.gnomadAvailable,
    clinvarVariantCount: data.clinvarVariantCount ?? null,

    topHgvsName: data.topHgvsName ?? null,
    topRsId: data.topRsId ?? null,
    populationFrequencyMaf: data.populationFrequencyMaf ?? null,

    gtexAvailable: Boolean(
      data.gtexAvailable ||
      data.defaultTissue ||
      data.tissueTpm ||
      (Array.isArray(data.topTissues) && data.topTissues.length > 0)
    ),
    humanProteinAtlasLevel: data.humanProteinAtlasLevel ?? null,
    gtexExpressionLevel: data.gtexExpressionLevel ?? null,

    intolerantToLossScore: data.intolerantToLossScore ?? null,
    recessiveConstraintZ: data.recessiveConstraintZ ?? null,
    hetExcessZ: data.hetExcessZ ?? null,
    compositeConstraintIndex: data.compositeConstraintIndex ?? null,
    haploinsufficiencyScore: data.haploinsufficiencyScore ?? null,

    loeufDecile: data.loeufDecile ?? null,
    triplosensitivity: data.triplosensitivity ?? null,
    activeIsoforms: data.activeIsoforms ?? null,
    spliceSwitches: data.spliceSwitches ?? null,
    structuralAccessibility: data.structuralAccessibility ?? null,
    splicingMotifDensity: data.splicingMotifDensity ?? null,
    preclinicalConservation: data.preclinicalConservation ?? null,
    gQuadruplexes: data.gQuadruplexes ?? null,
    cpgDensity: data.cpgDensity ?? null,
    selfDimerRisk: data.selfDimerRisk ?? null,
    polygTracts: data.polygTracts ?? null,
    transcriptSpecificity: data.transcriptSpecificity ?? null,
    codonUsageBias: data.codonUsageBias ?? null,

    // RNA half-life and gene dependency
    rnaHalflife: data.rnaHalflife ?? null,
    rnaHalflifeHours: data.rnaHalflifeHours ?? null,
    rnaHalflifeSource: data.rnaHalflifeSource ?? null,
    depmapDependency: data.depmapDependency ?? null,
    depmapDependencyScore: data.depmapDependencyScore ?? null,
    essentialGene: data.essentialGene ?? null,
    essentialGeneSource: data.essentialGeneSource ?? null,
    essentialGeneGeneTrap: data.essentialGeneGeneTrap ?? null,
    essentialGeneGeneTrapSource: data.essentialGeneGeneTrapSource ?? null,
    essentialGeneCrispr: data.essentialGeneCrispr ?? null,
    essentialGeneCrisprSource: data.essentialGeneCrisprSource ?? null,
    essentialGeneCrispr2: data.essentialGeneCrispr2 ?? null,
    essentialGeneCrispr2Source: data.essentialGeneCrispr2Source ?? null,
    depmapSource: data.depmapSource ?? null,

    deepLinks: data.deepLinks ?? {},

    keggCount: data.keggCount ?? null,
    reactomeCount: data.reactomeCount ?? null,
    pathwayCommonsCount: data.pathwayCommonsCount ?? null,
    keggPathwayName: data.keggPathwayName ?? null,
    reactomePathwayName: data.reactomePathwayName ?? null,
    keggPathwayId: data.keggPathwayId ?? null,
    reactomePathwayId: data.reactomePathwayId ?? null,
    pathwayHighlight: data.pathwayHighlight ?? null,

    goBiologicalProcess: data.goBiologicalProcess ?? null,
    goMolecularFunction: data.goMolecularFunction ?? null,
    goCellularComponent: data.goCellularComponent ?? null,
    goBiologicalProcessHighlight: data.goBiologicalProcessHighlight ?? null,
    goMolecularFunctionHighlight: data.goMolecularFunctionHighlight ?? null,
    goCellularComponentHighlight: data.goCellularComponentHighlight ?? null,
    // Detailed GO annotation lists from backend
    goBiologicalProcessAnnotations: Array.isArray(data.goBiologicalProcessAnnotations) ? data.goBiologicalProcessAnnotations : null,
    goMolecularFunctionAnnotations: Array.isArray(data.goMolecularFunctionAnnotations) ? data.goMolecularFunctionAnnotations : null,
    goCellularComponentAnnotations: Array.isArray(data.goCellularComponentAnnotations) ? data.goCellularComponentAnnotations : null,

    // Rich genomic and clinical payloads
    genomicOverviewDetails: data.genomicOverviewDetails ?? null,
    clinicalProfileAnnotations: Array.isArray(data.clinicalProfileAnnotations) ? data.clinicalProfileAnnotations : null,

    stringHighConfidenceCount: data.stringHighConfidenceCount ?? null,
    totalInteractors: data.totalInteractors ?? null,
    topInteractors: data.topInteractors ?? [],
    mediumConfidenceCount: data.mediumConfidenceCount ?? null,
    experimentalCount: data.experimentalCount ?? null,
    databaseCount: data.databaseCount ?? null,
    interactionNetworkDensity: data.interactionNetworkDensity ?? null,

    pubmedArticleCount: data.pubmedArticleCount ?? null,
    reviewCount: data.reviewCount ?? null,
    clinicalTrialsCount: data.clinicalTrialsCount ?? null,
    preprintCount: data.preprintCount ?? null,
    caseReportsCount: data.caseReportsCount ?? null,

    genomicSize: data.genomicSize ?? data.geneLength ?? null,
    mrnaLength: data.mrnaLength ?? data.cdsLength ?? null,
    proteinMass: data.proteinMass ?? data.molecularWeight ?? null,

    fdaApprovedTherapies: Array.isArray(data.fdaApprovedTherapies) ? data.fdaApprovedTherapies : [],
    fdaMessage: data.fdaMessage ?? null,
    targetableExons: data.targetableExons ?? null,

    incidence: data.incidence ?? null,
    orphanetCode: data.orphanetCode ?? null,
    icd11Code: data.icd11Code ?? null,
    orphanetDiseaseNames: data.orphanetDiseaseNames ?? [],

    knownPathogenicVariants: data.knownPathogenicVariants ?? null,
    totalClinvarVariants: data.totalClinvarVariants ?? null,
    mutationBreakdown: data.mutationBreakdown ?? {
      largeExonDeletions: null,
      largeExonDuplications: null,
      nonsensePointMutations: null,
      frameshiftMutations: null,
      spliceSiteMutations: null,
    },

     sequenceDescriptors: data.sequenceDescriptors ?? null,
     pbpkTimeSeries: data.pbpkTimeSeries ?? null,
     chargePhProfile: data.chargePhProfile ?? null,
     lipinskiViolations: data.lipinskiViolations ?? null,
     structuralHotspots: data.structuralHotspots ?? null,
     chemicalSpaceProjection: data.chemicalSpaceProjection ?? null,
     onTargetToxicityRisk: data.onTargetToxicityRisk ?? null,
     onTargetToxicityLevel: data.onTargetToxicityLevel ?? null,
     therapeuticWindow: data.therapeuticWindow ?? null,
     distributionNotes: Array.isArray(data.distributionNotes) ? data.distributionNotes : [],
   };
 }
