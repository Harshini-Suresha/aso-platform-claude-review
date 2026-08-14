import {
  GitBranch,
  Share2,
  Tags,
  Network,
  BookMarked,
  ExternalLink,
  Shield,
  BarChart3,
  Stethoscope,
  Dna,
  Pill,
  AlertTriangle,
  Building2,
  Activity,
  TrendingUp,
  CircleDot,
  Gauge,
} from "lucide-react";
import { GeneTargetObject } from "@/types/gene";
import { Card } from "./ui";



const DASH = "—";

interface StatCardProps {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  rows: { label: string; value: React.ReactNode; bar?: number }[];
  sources?: { label: string; url: string }[];
  sourcesColumns?: number;
  notConnected?: boolean;
   extra?: React.ReactNode;
   className?: string;
   maxHeight?: string;
 }

function formatValue(value: React.ReactNode): React.ReactNode {
  if (value === null || value === undefined) return DASH;
  if (typeof value === "number" && value === 0) return "0";
  return value;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^(\s*)[-*+]\s+/gm, "$1• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function StatCard({ icon: Icon, iconBg, iconColor, title, rows, sources, sourcesColumns, notConnected, extra, className, maxHeight }: StatCardProps) {
  return (
    <Card className={`flex flex-col rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${className ?? ""}`}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: iconBg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
        </span>
        <p className="text-[12.5px] font-semibold text-slate-700">{title}</p>
      </div>
      <div className={`flex-1 space-y-1.5 px-4 pb-3 overflow-y-auto ${maxHeight ?? "max-h-60"} card-scroll`}>                {notConnected ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-dashed border-slate-200 px-3 py-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <p className="text-[11px] text-slate-400">Data source not yet connected</p>
          </div>
        ) : (
          rows.map((r) => {
            const pct = typeof r.bar === "number" ? Math.min(100, Math.max(0, r.bar)) : null;
            const barColor = pct !== null ? (pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-blue-400" : pct >= 30 ? "bg-amber-400" : "bg-red-400") : undefined;
            return (
              <div key={r.label} className="flex flex-col gap-0.5 text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400 shrink-0">{r.label}</span>
                  <span className="font-medium text-slate-700 text-right break-words">{formatValue(r.value)}</span>
                </div>
                {pct !== null && (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 w-7 text-right">{pct}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        {sources && sources.length > 0 && (
          <div
            className={`mt-2 border-t border-slate-100 pt-2 ${
              (typeof (sourcesColumns ?? 1) === "number" && (sourcesColumns ?? 1) > 1) ? "grid grid-cols-2 gap-2" : "space-y-1"
            }`}
          >
            {sources.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-brand hover:underline">
                {s.label} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ))}
          </div>
        )}
        {extra}
      </div>
    </Card>
  );
}

export { StatCard };

export default function StatsRow({ gene }: { gene: GeneTargetObject }) {
  const links = gene.deepLinks ?? {};
  const organism = gene.organism ?? "homo_sapiens";
  const isHuman = organism === "homo_sapiens";
  const hasInteractions = gene.stringHighConfidenceCount !== null || gene.totalInteractors !== null;
  const hasLiterature = gene.pubmedArticleCount !== null || gene.reviewCount !== null || gene.clinicalTrialsCount !== null || gene.preprintCount !== null || gene.caseReportsCount !== null;
  const hasPathways = gene.keggCount !== null || gene.reactomeCount !== null || gene.pathwayCommonsCount !== null || gene.keggPathwayName !== null || gene.reactomePathwayName !== null || gene.keggPathwayId !== null || gene.reactomePathwayId !== null;
  const hasGoTerms = gene.goBiologicalProcess !== null || gene.goMolecularFunction !== null || gene.goCellularComponent !== null;
  const hasClinical = gene.omimId !== null || gene.phenotypes.length > 0 || gene.therapeuticOptions.length > 0 || gene.diagnosticTests.length > 0 || gene.clinicalSymptoms.length > 0;
  const hasMutations = gene.knownPathogenicVariants !== null || Object.values(gene.mutationBreakdown ?? {}).some((value) => value !== null);
  const hasFda = gene.fdaApprovedTherapies.length > 0;
  const hasOrphanet = gene.orphanetCode !== null || gene.icd11Code !== null || gene.incidence !== null || (gene.orphanetDiseaseNames?.length ?? 0) > 0;
  const clinVarGeneSearch = `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(`${gene.geneSymbol}[gene]`)}`;

  return (
    <div className="grid grid-cols-2 gap-4 py-6 md:grid-cols-4">
      {/* Row 1 */}
      {/* 1. Target Vulnerability */}
      <StatCard
        icon={Shield}
        iconBg="#FEF2F2"
        iconColor="#DC2626"
        title="Target Vulnerability"
        sourcesColumns={2}
        rows={[
          { label: "LOEUF Decile", value: isHuman ? (gene.loeufDecile ?? DASH) : "Human only" },
          { label: "pLI (gnomAD)", value: isHuman ? (gene.intolerantToLossScore ?? DASH) : "Human only" },
          { label: "Recessive Constraint (Z)", value: isHuman ? (gene.recessiveConstraintZ ?? DASH) : "Human only" },
          { label: "Composite Constraint", value: isHuman ? (gene.compositeConstraintIndex ?? DASH) : "Human only" },
          { label: "Het Excess (Z)", value: isHuman ? (gene.hetExcessZ ?? DASH) : "Human only" },
          { label: "DepMap Dependency", value: gene.depmapDependency ?? DASH },
          { label: "Essential Gene", value: gene.essentialGene ?? DASH },
        ]}
        sources={isHuman ? [
          { label: "Source: gnomAD v2.1.1", url: `https://gnomad.broadinstitute.org/gene/${gene.geneId}?dataset=gnomad_r2_1` },
          { label: "Source: FAVOR", url: "https://xionglab.org/favor/" },
        ] : []}
      />

      {/* 2. Transcript Architecture */}
      <StatCard
        icon={GitBranch}
        iconBg="#ECFDF5"
        iconColor="#059669"
        title="Transcript Architecture"
        rows={[
          { label: "Active Isoforms", value: gene.activeIsoforms ?? DASH },
          { label: "Structural Accessibility", value: gene.structuralAccessibility ?? DASH },
          { label: "Splicing Motif Density", value: gene.splicingMotifDensity ?? DASH },
          { label: "Preclinical Conservation", value: gene.preclinicalConservation ?? DASH },
          { label: "Splice Switches", value: gene.spliceSwitches ?? DASH },
          { label: "Coding Length", value: gene.mrnaLength != null ? `${gene.mrnaLength.toLocaleString()} bp` : DASH },
          { label: "Exon Count", value: gene.exonCount ?? DASH },
        ]}
        sources={[{ label: "Source: Ensembl", url: links.ensembl ?? "#" }]}
      />

      {/* 3. Oligo Design Barriers */}
      <StatCard
        icon={BarChart3}
        iconBg="#FFF7ED"
        iconColor="#EA580C"
        title="Oligo Design Barriers"
        rows={[
          { label: "Population SNPs", value: gene.dbSnpCount !== null ? gene.dbSnpCount.toLocaleString() : DASH },
          { label: "G-Quadruplexes", value: gene.gQuadruplexes ?? DASH },
          { label: "CpG Density", value: gene.cpgDensity ?? DASH },
          { label: "Self-Dimerization Risk", value: gene.selfDimerRisk ?? DASH },
          { label: "Poly-G Tracts", value: gene.polygTracts ?? DASH },
          { label: "Transcript Specificity", value: gene.transcriptSpecificity ?? DASH },
          { label: "Codon Usage Bias", value: gene.codonUsageBias ?? DASH },
        ]}
        sources={links.ncbi ? [{ label: "Source: NCBI dbSNP", url: links.ncbi }] : []}
      />

      {/* 4. Pathways */}
      <StatCard
        icon={Share2}
        iconBg="#F5F3FF"
        iconColor="#7C3AED"
        title="Pathways"
        sourcesColumns={2}
        notConnected={!hasPathways}
        rows={[
          { label: "Top pathway", value: gene.pathwayHighlight ?? DASH },
          { label: "KEGG", value: gene.keggCount != null && links.kegg ? <a href={links.kegg} target="_blank" rel="noreferrer" className="text-brand hover:underline">{gene.keggCount} <ExternalLink className="inline h-2.5 w-2.5" /></a> : (gene.keggCount ?? DASH) },
          { label: "Reactome", value: gene.reactomeCount != null && links.reactome ? <a href={links.reactome} target="_blank" rel="noreferrer" className="text-brand hover:underline">{gene.reactomeCount} <ExternalLink className="inline h-2.5 w-2.5" /></a> : (gene.reactomeCount ?? DASH) },
          { label: "Pathway Commons", value: gene.pathwayCommonsCount ?? DASH },
          { label: "Top KEGG ID", value: gene.keggPathwayId ?? DASH },
          { label: "Total", value: (gene.keggCount ?? 0) + (gene.reactomeCount ?? 0) + (gene.pathwayCommonsCount ?? 0) || DASH },
        ]}
        sources={[
          links.kegg ? { label: "KEGG", url: links.kegg } : null,
          links.reactome ? { label: "Reactome", url: links.reactome } : null,
        ].filter(Boolean) as { label: string; url: string }[]}
      />

      {/* Row 2 */}
      {/* 5. Genomic Overview */}
      <StatCard
        icon={Dna}
        iconBg="#EFF6FF"
        iconColor="#2563EB"
        title="Genomic Overview"
        rows={[
          { label: "Genomic Size", value: gene.genomicSize !== null ? `${gene.genomicSize.toLocaleString()} bp` : DASH },
          { label: "mRNA Length (CDS)", value: gene.mrnaLength !== null ? `${gene.mrnaLength.toLocaleString()} bp` : DASH },
          { label: "Protein Mass", value: gene.proteinMass ?? DASH },
          { label: "Exon Count", value: gene.exonCount ?? DASH },
          { label: "Intron Count", value: gene.intronCount ?? DASH },
          { label: "Targetable Exons", value: gene.targetableExons ?? DASH },
        ]}
        sources={[{ label: "Source: Ensembl", url: links.ensembl ?? "#" }]}
        extra={
          <div className="mt-2 space-y-3 text-[12px] leading-5">
            {gene.proteinId && (
              <div>
                <div className="text-[11px] text-slate-500">Protein entry</div>
                <div className="mt-1">
                  {links.uniprot ? (
                    <a href={links.uniprot} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                      {gene.proteinId}
                    </a>
                  ) : (
                    <span>{gene.proteinId}</span>
                  )}
                </div>
              </div>
            )}
            {gene.proteinLength !== null && (
              <div>
                <div className="text-[11px] text-slate-500">Protein length</div>
                <div className="mt-1">{`${gene.proteinLength.toLocaleString()} aa`}</div>
              </div>
            )}
          </div>
        }
      />

      {/* 6. Clinical Profile */}
      <StatCard
        icon={Stethoscope}
        iconBg="#FEF2F2"
        iconColor="#DC2626"
        title="Clinical Profile"
        rows={[
          { label: "OMIM", value: gene.omimId ?? DASH },
          { label: "Phenotypes", value: gene.phenotypes.length > 0 ? gene.phenotypes.length : DASH },
          { label: "Mechanism", value: gene.diseaseMechanism ?? DASH },
          { label: "Diagnostic tests", value: gene.diagnosticTests.length > 0 ? gene.diagnosticTests.length : DASH },
          { label: "Clinical symptoms", value: gene.clinicalSymptoms.length > 0 ? gene.clinicalSymptoms.length : DASH },
          { label: "Therapeutic options", value: gene.therapeuticOptions.length > 0 ? gene.therapeuticOptions.length : DASH },
        ]}
        sources={links.omim && gene.omimId ? [{ label: "Source: OMIM", url: links.omim }] : []}
        extra={
          <div className="mt-2 space-y-1">
            {gene.diagnosticTests.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-500">Diagnostic tests</div>
                <ul className="mt-1 text-[12px] leading-5 list-disc list-inside">
                  {gene.diagnosticTests.slice(0, 3).map((test, i) => (
                    <li key={`dt-${i}`}>
                      {test}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />

      {/* 7. GO Terms */}
      <StatCard
        icon={Tags}
        iconBg="#F5F3FF"
        iconColor="#7C3AED"
        title="GO Terms"
        notConnected={!hasGoTerms}
        rows={[
          { label: "Biological Process", value: gene.goBiologicalProcess ?? DASH },
          { label: "Top BP term", value: gene.goBiologicalProcessHighlight ?? DASH },
          { label: "Molecular Function", value: gene.goMolecularFunction ?? DASH },
          { label: "Top MF term", value: gene.goMolecularFunctionHighlight ?? DASH },
          { label: "Cellular Component", value: gene.goCellularComponent ?? DASH },
          { label: "Top CC term", value: gene.goCellularComponentHighlight ?? DASH },
        ]}
        sources={links.go ? [{ label: "Source: Gene Ontology", url: links.go }] : []}
        extra={
          <div className="mt-2 space-y-1">
            {gene.goBiologicalProcessAnnotations && gene.goBiologicalProcessAnnotations.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-500">Top BP annotations</div>
                <ul className="mt-1 text-[12px] list-disc list-inside">
                  {gene.goBiologicalProcessAnnotations.slice(0, 3).map((a, i) => (
                    <li key={`bp-${i}`} className="truncate">
                      {a.url ? (
                        <a className="text-brand hover:underline" href={a.url} target="_blank" rel="noreferrer">
                          {a.term || a.id}
                        </a>
                      ) : (
                        <span>{a.term || a.id}</span>
                      )}
                      {a.evidence ? <span className="text-slate-400"> — {a.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.goMolecularFunctionAnnotations && gene.goMolecularFunctionAnnotations.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-500">Top MF annotations</div>
                <ul className="mt-1 text-[12px] list-disc list-inside">
                  {gene.goMolecularFunctionAnnotations.slice(0, 3).map((a, i) => (
                    <li key={`mf-${i}`} className="truncate">
                      {a.url ? (
                        <a className="text-brand hover:underline" href={a.url} target="_blank" rel="noreferrer">
                          {a.term || a.id}
                        </a>
                      ) : (
                        <span>{a.term || a.id}</span>
                      )}
                      {a.evidence ? <span className="text-slate-400"> — {a.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.goCellularComponentAnnotations && gene.goCellularComponentAnnotations.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-500">Top CC annotations</div>
                <ul className="mt-1 text-[12px] list-disc list-inside">
                  {gene.goCellularComponentAnnotations.slice(0, 3).map((a, i) => (
                    <li key={`cc-${i}`} className="truncate">
                      {a.url ? (
                        <a className="text-brand hover:underline" href={a.url} target="_blank" rel="noreferrer">
                          {a.term || a.id}
                        </a>
                      ) : (
                        <span>{a.term || a.id}</span>
                      )}
                      {a.evidence ? <span className="text-slate-400"> — {a.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />

      {/* 8. Interactions */}
      <StatCard
        icon={Network}
        iconBg="#EFF6FF"
        iconColor="#2563EB"
        title="Interactions"
        notConnected={!hasInteractions}
        rows={[
          { label: "STRING (high conf.)", value: gene.stringHighConfidenceCount ?? DASH },
          { label: "STRING (med. conf.)", value: gene.mediumConfidenceCount ?? DASH },
          { label: "Total interactors", value: gene.totalInteractors ?? DASH },
          { label: "Experimental", value: gene.experimentalCount ?? DASH },
          { label: "Database-curated", value: gene.databaseCount ?? DASH },
          { label: "Network Density", value: gene.interactionNetworkDensity ?? DASH },
          ...(gene.topInteractors.length > 0
            ? gene.topInteractors.slice(0, 2).map((p) => ({
                label: p.name,
                value: p.score,
              }))
            : []),
        ]}
        sources={links.string ? [{ label: "Source: STRING", url: links.string }] : []}
      />

       {/* Row 3 */}
      {/* 9. DepMap Dependency */}
      <StatCard
        icon={BarChart3}
        iconBg="#F5F3FF"
        iconColor="#7C3AED"
        title="DepMap Dependency"
        rows={[
          { label: "Dependency Score", value: gene.depmapDependencyScore ?? DASH },
          { label: "Dependency", value: gene.depmapDependency ?? DASH },
          { label: "Essential Gene", value: gene.essentialGene ?? DASH },
          { label: "Gene Trap Essentiality", value: gene.essentialGeneGeneTrap ?? DASH },
          { label: "CRISPR Essentiality", value: gene.essentialGeneCrispr ?? DASH },
          { label: "CRISPR2 Essentiality", value: gene.essentialGeneCrispr2 ?? DASH },
          { label: "Source", value: gene.depmapSource ?? DASH },
         ]}
         sourcesColumns={2}
         sources={[
           gene.depmapSource && { label: "Dependency: " + gene.depmapSource, url: "https://depmap.org" },
           gene.essentialGeneSource && { label: "Essential Gene: " + gene.essentialGeneSource, url: "https://genohub.org" },
           gene.essentialGeneCrisprSource && { label: "CRISPR: " + gene.essentialGeneCrisprSource, url: "https://genohub.org" },
           gene.essentialGeneCrispr2Source && { label: "CRISPR2: " + gene.essentialGeneCrispr2Source, url: "https://genohub.org" },
           gene.essentialGeneGeneTrapSource && { label: "Gene Trap: " + gene.essentialGeneGeneTrapSource, url: "https://genohub.org" },
         ].filter(Boolean) as { label: string; url: string }[]}
       />

      {/* 13. RNA Stability */}
      <StatCard
        icon={Activity}
        iconBg="#EFF6FF"
        iconColor="#2563EB"
        title="RNA Stability"
        rows={[
          { label: "Half-Life", value: gene.rnaHalflife ?? DASH },
          { label: "Half-Life (hours)", value: gene.rnaHalflifeHours ?? DASH },
          { label: "Expression Stability (CV)", value: gene.expressionStabilityCV != null ? gene.expressionStabilityCV.toFixed(2) : DASH },
          { label: "Circadian Amplitude", value: gene.circadianAmplitude ?? DASH },
          { label: "Critical Phosphorylation Site", value: gene.criticalPhosphorylationSite ?? DASH },
          { label: "Triplosensitivity", value: gene.triplosensitivity ?? DASH },
        ]}
        sources={[
          gene.rnaHalflifeSource ? { label: "RNAdecayCafe (Vock et al. 2025)", url: "https://zenodo.org/records/15785218" } : null,
          gene.circadianAmplitude ? { label: "GTEx v8 (expression amplitude proxy)", url: links.gtex ?? "#" } : null,
          links.hpa ? { label: "Human Protein Atlas", url: links.hpa } : null,
          links.uniprot ? { label: "UniProt", url: links.uniprot } : null,
        ].filter(Boolean) as { label: string; url: string }[]}
      />

      {/* 14. Transcript Dynamics */}
      <StatCard
        icon={GitBranch}
        iconBg="#ECFDF5"
        iconColor="#059669"
        title="Transcript Dynamics"
        rows={[
          { label: "Dominant Isoform", value: gene.dominantIsoformId ?? DASH },
          { label: "Dominant Fraction", value: gene.dominantIsoformFraction != null ? `${(gene.dominantIsoformFraction * 100).toFixed(0)}%` : DASH },
          { label: "Intron Retention", value: gene.intronRetentionRatio != null ? gene.intronRetentionRatio.toFixed(2) : DASH },
          { label: "Nuclear Retention", value: gene.nuclearRetentionIndex != null ? gene.nuclearRetentionIndex.toFixed(2) : DASH },
          { label: "Alt. Polyadenylation", value: gene.alternativePolyadenylation ?? DASH },
          { label: "Developmental Expression", value: gene.developmentalExpression ?? DASH },
        ]}
        sources={
          gene.canonicalTranscript
            ? [
                {
                  label: `View ${gene.canonicalTranscript} in Ensembl`,
                  url: `https://www.ensembl.org/${(gene.organism ?? "Homo_sapiens").replace(" ", "_")}/Transcript/Summary?t=${gene.canonicalTranscript}`,
                },
              ]
            : links.ensembl
              ? [{ label: "Source: Ensembl", url: links.ensembl }]
              : []
        }
      />

      {/* 15. Single-Cell Context */}
      <StatCard
        icon={CircleDot}
        iconBg="#FDF2F8"
        iconColor="#DB2777"
        title="Single-Cell Context"
        rows={[
          { label: "Default Cell Type", value: gene.defaultCellType ?? DASH },
          { label: "Cell TPM", value: gene.cellTpm != null ? `${gene.cellTpm} TPM` : DASH },
          { label: "Single-Cell Prevalence", value: gene.singleCellPrevalence != null ? `${(gene.singleCellPrevalence * 100).toFixed(1)}%` : DASH },
        ]}
      />

      {/* 10. Mutation Distribution */}
      <StatCard
        icon={AlertTriangle}
        iconBg="#FEF3C7"
        iconColor="#D97706"
        title="Mutation Distribution"
        notConnected={!hasMutations && !gene.mutationBreakdown}
        rows={
          hasMutations
            ? [
                { label: "Pathogenic / likely pathogenic", value: gene.knownPathogenicVariants ?? DASH },
                { label: "Large Exon Deletions", value: gene.mutationBreakdown?.largeExonDeletions ?? DASH },
                { label: "Large Exon Duplications", value: gene.mutationBreakdown?.largeExonDuplications ?? DASH },
                { label: "Nonsense / Point", value: gene.mutationBreakdown?.nonsensePointMutations ?? DASH },
                { label: "Frameshift", value: gene.mutationBreakdown?.frameshiftMutations ?? DASH },
                { label: "Splice Site", value: gene.mutationBreakdown?.spliceSiteMutations ?? DASH },
              ]
            : isHuman
              ? [
                  { label: "Pathogenic / likely pathogenic", value: "0" },
                  { label: "Total ClinVar Variants", value: gene.totalClinvarVariants ?? "Search ClinVar" },
                  { label: "ClinVar", value: `Search ClinVar for ${gene.geneSymbol} variants` },
                  { label: "OMIM", value: `Check OMIM for ${gene.geneSymbol} phenotype data` },
                ]
              : [{ label: "Status", value: "Human gene data only" }]
        }
        sources={isHuman ? [
          { label: "NCBI ClinVar", url: links.clinvar ?? clinVarGeneSearch },
          { label: "OMIM", url: `https://omim.org/search/${encodeURIComponent(gene.geneSymbol)}` },
          { label: "UniProt Variants", url: `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(gene.geneSymbol)}+variant` },
        ] : []}
      />

      {/* 11. FDA Therapies */}
      <StatCard
        icon={Pill}
        iconBg="#ECFDF5"
        iconColor="#059669"
        title="Oligonucleotide Therapies"
        sourcesColumns={2}
        rows={
          hasFda
            ? gene.fdaApprovedTherapies.map((t) => ({
                label: t.name,
                value: [
                  t.indication,
                  t.modality ?? "Oligonucleotide",
                  t.approvalYear ? `FDA approved ${t.approvalYear}` : "Investigational",
                  t.source,
                ].join(" · "),
              }))
            : isHuman
              ? [
                  { label: "Status", value: gene.fdaMessage ?? "No approved or investigational oligonucleotide therapy found" },
                  { label: "Clinical Trials", value: `Search ClinicalTrials.gov for ${gene.geneSymbol} oligonucleotide studies` },
                  { label: "Research", value: `Check PubMed for ${gene.geneSymbol} ASO/siRNA publications` },
                ]
              : [{ label: "Status", value: "Human gene data only" }]
        }
        sources={
          hasFda
            ? [
                { label: "FDA nucleic-acid therapies", url: "https://www.fda.gov/drugs/nucleic-acid-therapies-and-gene-therapies-approved-and-regulated-fda" },
                { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(gene.geneSymbol)}+oligonucleotide` },
                { label: "PubMed Literature", url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(gene.geneSymbol)}+oligonucleotide+therapy` },
              ]
            : [
                { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(gene.geneSymbol)}+oligonucleotide` },
                { label: "PubMed Literature", url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(gene.geneSymbol)}+oligonucleotide+therapy` },
                { label: "FDA Approved Oligos", url: "https://www.fda.gov/drugs/nucleic-acid-therapies-and-gene-therapies-approved-and-regulated-fda" },
              ]
        }
      />

      {/* 12. Orphanet / Rare Disease */}
      <StatCard
        icon={Building2}
        iconBg="#F5F3FF"
        iconColor="#7C3AED"
        title="Orphanet / Rare Disease"
        rows={
          isHuman
            ? [
                { label: "Orphanet Code", value: gene.orphanetCode ?? DASH },
                { label: "ICD-11 Code", value: gene.icd11Code ?? DASH },
                { label: "Incidence", value: gene.incidence ?? DASH },
                { label: "Known Pathogenic", value: gene.knownPathogenicVariants ?? DASH },
                ...(gene.orphanetDiseaseNames?.length > 0
                  ? gene.orphanetDiseaseNames.slice(0, 2).map((name) => ({
                      label: "Associated Disease",
                      value: name,
                    }))
                  : []),
              ]
            : [{ label: "Status", value: "Human only" }]
        }
        sources={isHuman ? [
          { label: "Source: Orphanet", url: "https://www.orpha.net" },
        ] : []}
      />

      {/* 16. Literature */}
      <StatCard
        icon={BookMarked}
        iconBg="#FFF7ED"
        iconColor="#EA580C"
        title="Literature"
        sourcesColumns={2}
        notConnected={!hasLiterature}
        rows={[
          { label: "PubMed Articles", value: gene.pubmedArticleCount ?? DASH },
          { label: "Reviews", value: gene.reviewCount ?? DASH },
          { label: "Clinical Trials", value: gene.clinicalTrialsCount ?? DASH },
          { label: "Preprints", value: gene.preprintCount ?? DASH },
          { label: "Case Reports", value: gene.caseReportsCount ?? DASH },
        ]}
        sources={[
          links.pubmed ? { label: "Source: PubMed", url: links.pubmed } : null,
          links.clinicaltrials ? { label: "Source: ClinicalTrials.gov", url: links.clinicaltrials } : null,
        ].filter(Boolean) as { label: string; url: string }[]}
       />

       <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                     <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Therapeutic Window Notes</div>
                     {(gene.therapeuticWindow?.notes?.length ?? 0) > 0 ? (
                       <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                         {gene.therapeuticWindow!.notes!.map((n, i) => (
                           <li key={`tw-${i}`}>{n}</li>
                         ))}
                       </ul>
                     ) : (
                       <p className="text-[11px] leading-relaxed text-slate-600">
                         Therapeutic window: {gene.therapeuticWindow?.level ?? "Not assessed"} — de-risk with dose titration, knockdown-depth studies, and tissue-specific delivery.
                       </p>
                     )}
                      <a
                        href={`https://xionglab.org/favor/gene/${encodeURIComponent(gene.geneSymbol)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 text-[10px] text-brand hover:underline"
                      >
                        Source: FAVOR/Xiong et al. 2024
                      </a>
                    </div>

                   <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                     <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Biodistribution Notes</div>
                     {(gene.distributionNotes?.length ?? 0) > 0 ? (
                       <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                         {gene.distributionNotes!.map((n, i) => (
                           <li key={`bd-${i}`}>{n}</li>
                         ))}
                       </ul>
                     ) : (
                       <p className="text-[11px] leading-relaxed text-slate-600">
                         No significant vital-organ expression detected — favorable safety profile for systemic delivery.
                       </p>
                     )}
                     <a
                        href={`https://xionglab.org/favor/gene/${encodeURIComponent(gene.geneSymbol)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 text-[10px] text-brand hover:underline"
                      >
                        Source: FAVOR/Xiong et al. 2024
                      </a>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-slate-600" />
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Safety Risk Assessment</div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        {(gene.essentialGene || (gene.loeufDecile != null && Number(gene.loeufDecile) < 0.2) || (gene.vitalOrganTissues?.length ?? 0) > 0)
                          ? "Target is essential/constrained or highly expressed in vital organs — expect a narrow safety margin."
                          : "Target has moderate expression in vital organs — monitor on-target exposure in dose-ranging studies."}
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                        De-risk with dose titration, knockdown-depth studies, and tissue-specific delivery.
                      </p>
                      <a
                        href={`https://xionglab.org/favor/gene/${encodeURIComponent(gene.geneSymbol)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 text-[10px] text-brand hover:underline"
                      >
                        Source: FAVOR/Xiong et al. 2024
                      </a>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Activity className="h-3.5 w-3.5 text-slate-600" />
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Target Tissue Expression</div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        {(gene.vitalOrganTissues?.length ?? 0) > 0
                          ? `Predominant vital-organ expression in ${gene.vitalOrganTissues!.join(", ")} (max TPM ${gene.vitalOrganTpm ?? "—"}) — monitor tissue exposure and consider targeted delivery to limit on-target exposure.`
                          : "No significant vital-organ expression detected — favorable safety profile for systemic delivery."}
                      </p>
                      <a
                        href={`https://xionglab.org/favor/gene/${encodeURIComponent(gene.geneSymbol)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 text-[10px] text-brand hover:underline"
                      >
                        Source: FAVOR/Xiong et al. 2024
                      </a>
                    </div>

     </div>
   );
 }

