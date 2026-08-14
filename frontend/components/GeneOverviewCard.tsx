"use client";

import { CheckCircle2, RefreshCw, Dna } from "lucide-react";
import { GeneTargetObject } from "@/types/gene";
import { Card, SectionHeader, InfoField, Pill } from "./ui";

const DASH = "—";

interface GeneOverviewCardProps {
  gene: GeneTargetObject;
  onRefresh: () => void;
}

export default function GeneOverviewCard({ gene, onRefresh }: GeneOverviewCardProps) {
  const deepLinks = gene.deepLinks ?? {};
  const isViral = gene.geneType === "viral_gene";

  return (
    <Card className="transition-shadow duration-300 hover:shadow-md">
      <SectionHeader
        step="2"
        title="Gene Information Verification"
        right={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Gene Found
            </span>
            {isViral && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-600">
                Curated reference
              </span>
            )}
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Data
            </button>
          </div>
        }
      />

      <div className="flex min-w-0 flex-col gap-6 px-6 pb-6 md:flex-row">
        {/* Gene glyph */}
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50">
          <Dna className="h-10 w-10 text-indigo-500" strokeWidth={1.75} />
        </div>

        <div className="grid min-w-0 flex-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          {/* Compact identity and structure fields */}
          <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoField label="Gene Symbol" value={gene.geneSymbol} />
            <InfoField label="Organism" value={gene.organism ?? DASH} />
            <InfoField label="Gene ID" value={gene.geneId ?? DASH} />
            <InfoField label="Gene Name" value={gene.geneName ?? DASH} />
            <InfoField label="Chromosome" value={gene.chromosome ?? DASH} />
            <InfoField label="Location" value={gene.location ?? DASH} />
            <InfoField label="Entrez Gene ID" value={gene.entrezGeneId ?? DASH} />
            <InfoField label="Nomenclature ID" value={gene.hgncId ?? DASH} />
            <InfoField label="Gene Type" value={gene.geneType?.replace(/_/g, " ") ?? DASH} />
            <InfoField label="Source" value={gene.source?.length ? gene.source.join(", ") : DASH} valueClassName="break-all text-[12px]" />
            <InfoField label="Transcript Count" value={gene.totalTranscripts ?? DASH} />
            <InfoField label="Canonical Transcript" value={gene.canonicalTranscript ?? DASH} valueClassName="break-all text-[12px]" />
            <InfoField label="Canonical Label" value={gene.canonicalTranscriptLabel ?? DASH} />
            <InfoField label="Protein ID" value={gene.proteinId ?? DASH} />
            <InfoField label="Protein Length" value={gene.proteinLength ? `${gene.proteinLength.toLocaleString()} aa` : DASH} />
            <InfoField label="Molecular Weight" value={gene.molecularWeight ?? DASH} />
            <InfoField label="Exon Count" value={gene.exonCount ?? DASH} />
            <InfoField label="Intron Count" value={gene.intronCount ?? DASH} />
            <InfoField label="CDS Length" value={gene.cdsLength ? `${gene.cdsLength.toLocaleString()} bp` : DASH} />
            <InfoField label="Strand" value={gene.strand ?? DASH} />
            <InfoField label="Taxonomy ID" value={gene.taxonId ?? DASH} />
            <InfoField label="Gene Length" value={gene.geneLength ? `${gene.geneLength.toLocaleString()} bp` : DASH} />
          </div>

          {/* Gene function has its own space so it never stretches the identifier grid. */}
          <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-slate-50/70 p-4">
            <p className="text-[12px] font-medium uppercase tracking-wider text-slate-400">Gene Function</p>
            <p className="mt-2 text-[13px] font-medium leading-6 text-slate-700">
              {gene.geneFunction ?? "Function summary is not available for this gene."}
            </p>

            <div className="mt-4 grid gap-3 border-t border-[#E5E7EB] pt-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Verification Sources</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {deepLinks.ensembl && (
                    <a href={deepLinks.ensembl} target="_blank" rel="noopener noreferrer"><Pill tone="blue">Ensembl ↗</Pill></a>
                  )}
                  {deepLinks.ncbi && (
                    <a href={deepLinks.ncbi} target="_blank" rel="noopener noreferrer"><Pill tone="green">NCBI Gene ↗</Pill></a>
                  )}
                  {!deepLinks.ensembl && !deepLinks.ncbi && <span className="text-[12px] text-slate-400">{DASH}</span>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Expression Sources</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {deepLinks.gtex && gene.gtexAvailable && (
                    <a href={deepLinks.gtex} target="_blank" rel="noopener noreferrer"><Pill tone="indigo">GTEx v8: {gene.defaultTissue} ({gene.tissueTpm} TPM) ↗</Pill></a>
                  )}
                  {deepLinks.hpa && gene.humanProteinAtlasLevel && (
                    <a href={deepLinks.hpa} target="_blank" rel="noopener noreferrer"><Pill tone="blue">HPA: {gene.humanProteinAtlasLevel} ↗</Pill></a>
                  )}
                  {!gene.gtexAvailable && !gene.humanProteinAtlasLevel && (
                    <span className="text-[12px] text-slate-400">
                      {isViral ? "Not applicable to viral genes" : "No expression source available"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-[#E5E7EB] pt-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Genomic Reference</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-2">
                  <p className="text-[10px] text-slate-500">Cytoband</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.cytoband ?? DASH}</p>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2">
                  <p className="text-[10px] text-slate-500">Genome Assembly</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.genomeBuild ?? DASH}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2">
                  <p className="text-[10px] text-slate-500">Start Position</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.genomicStart?.toLocaleString() ?? DASH}</p>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-2">
                  <p className="text-[10px] text-slate-500">End Position</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.genomicEnd?.toLocaleString() ?? DASH}</p>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-2">
                  <p className="text-[10px] text-slate-500">pRec (LoF recessive)</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.recessiveConstraintZ ?? DASH}</p>
                </div>
                <div className="rounded-lg border border-cyan-100 bg-cyan-50/50 p-2">
                  <p className="text-[10px] text-slate-500">pHe (Het. exp.)</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.hetExcessZ ?? DASH}</p>
                </div>
                <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/50 p-2">
                  <p className="text-[10px] text-slate-500">Constraint Index</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.compositeConstraintIndex ?? DASH}</p>
                </div>
                <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-2">
                  <p className="text-[10px] text-slate-500">Mutation Rate</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.mutationRate ?? DASH}</p>
                </div>
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-2">
                  <p className="text-[10px] text-slate-500">InterPro ID</p>
                  {gene.interproId ? (
                    <a href={`https://www.ebi.ac.uk/interpro/entry/InterPro/${gene.interproId}`} target="_blank" rel="noreferrer" className="mt-0.5 text-[12px] font-semibold text-brand hover:underline">{gene.interproId}</a>
                  ) : (
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{DASH}</p>
                  )}
                </div>
                <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-2">
                  <p className="text-[10px] text-slate-500">Pfam ID</p>
                  {gene.pfamId ? (
                    <a href={`https://www.ebi.ac.uk/interpro/entry/pfam/${gene.pfamId}`} target="_blank" rel="noreferrer" className="mt-0.5 text-[12px] font-semibold text-brand hover:underline">{gene.pfamId}</a>
                  ) : (
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{DASH}</p>
                  )}
                </div>
                <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-2">
                  <p className="text-[10px] text-slate-500">UniProt ID</p>
                  {gene.uniprotAccession ? (
                    <a href={`https://www.uniprot.org/uniprotkb/${gene.uniprotAccession}`} target="_blank" rel="noreferrer" className="mt-0.5 text-[12px] font-semibold text-brand hover:underline">{gene.uniprotAccession}</a>
                  ) : (
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{DASH}</p>
                  )}
                </div>
                <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-2">
                  <p className="text-[10px] text-slate-500">PDB ID</p>
                  {gene.pdbId ? (
                    <a href={`https://www.rcsb.org/structure/${gene.pdbId}`} target="_blank" rel="noreferrer" className="mt-0.5 text-[12px] font-semibold text-brand hover:underline">{gene.pdbId}</a>
                  ) : (
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{DASH}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
