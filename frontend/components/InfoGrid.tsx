"use client";

import { useState } from "react";
import {
  ListTree,
  Shuffle,
  Layers,
  CircleDot,
  Link2,
  HeartPulse,
  ExternalLink,
} from "lucide-react";
import { GeneTargetObject } from "@/types/gene";
import { Card, MiniCardHeader, Pill, DataRow } from "./ui";
import TissueBarChart from "./TissueBarChart";

const DASH = "—";

function UnavailableNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-400">{children}</p>
  );
}

function inferVariantType(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("ter") || lower.includes("stop") || lower.includes("*")) return "Nonsense";
  if (lower.includes("fs")) return "Frameshift";
  if (lower.includes("del") || lower.includes("ins") || lower.includes("dup")) return "Indel";
  if (lower.includes(">")) return "Missense SNV";
  if (lower.startsWith("rs")) return "dbSNP variant";
  return "Variant";
}

export default function InfoGrid({ gene }: { gene: GeneTargetObject }) {
  const [selectedTranscript, setSelectedTranscript] = useState(gene.canonicalTranscript);
  const isViral = gene.geneType === "viral_gene";
  const organism = gene.organism ?? "homo_sapiens";
  const isHuman = organism === "homo_sapiens";
  const links = gene.deepLinks ?? {};
  const variantExamples = Array.isArray(gene.variantExamples) ? gene.variantExamples : [];
  const expressionTissues = Array.isArray(gene.topTissues) ? gene.topTissues : [];
  const hasExpressionContext = Boolean(
    gene.gtexAvailable ||
    gene.defaultTissue ||
    gene.tissueTpm !== null ||
    expressionTissues.length > 0 ||
    gene.defaultCellType ||
    gene.cellTpm !== null
  );
  const hasTissueExpression = Boolean(
    expressionTissues.length > 0 || gene.defaultTissue || gene.tissueTpm !== null
  );

  const rawSynonyms = Array.isArray(gene.synonyms)
    ? gene.synonyms
    : typeof gene.synonyms === "string"
    ? (gene.synonyms as string).split(",")
    : [];

  const cleanSynonyms = rawSynonyms
    .map((s) => String(s).trim())
    .filter(
      (s) =>
        s &&
        s.toUpperCase() !== gene.geneSymbol.toUpperCase() &&
        s.toLowerCase() !== "none identified"
    );

  const variantCount = gene.clinvarVariantCount ?? gene.totalKnownVariantsClinvar ?? 0;

  return (
    <div className="space-y-5">
       {/* Row 1: Transcripts, Variant Registry, Tissue Expression */}
       <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-3">
         {/* Transcripts */}
         <Card className="flex h-[330px] flex-col overflow-hidden transition-shadow duration-300 hover:shadow-md">
           <MiniCardHeader icon={ListTree} iconBg="#EFF6FF" iconColor="#2563EB" title="Transcripts" />
          <div className="card-scroll flex-1 overflow-y-auto px-4 py-3">
            {gene.canonicalTranscript ? (
              <>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                    {gene.canonicalTranscriptLabel ?? "Canonical"} Transcript
                  </p>
                  <label className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2">
                    <input
                      type="radio"
                      checked={selectedTranscript === gene.canonicalTranscript}
                      onChange={() => setSelectedTranscript(gene.canonicalTranscript)}
                      className="accent-brand"
                    />
                    <span className="text-[13px] font-medium text-slate-800 break-all">
                      {gene.canonicalTranscript}
                    </span>
                  </label>
                </div>

                {gene.otherTranscripts.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                      Other Isoforms (Ensembl)
                    </p>
                    <div className="space-y-1.5">
                      {gene.otherTranscripts.map((t) => (
                        <label key={t} className="flex items-center gap-2 px-1">
                          <input
                            type="radio"
                            checked={selectedTranscript === t}
                            onChange={() => setSelectedTranscript(t)}
                            className="accent-brand"
                          />
                          <span className="text-[12.5px] text-slate-600 break-all">{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <UnavailableNote>
                {isViral
                  ? "Viral genes are not organized into transcripts in this dataset."
                  : "No transcript data returned for this gene."}
              </UnavailableNote>
            )}
          </div>
          {gene.totalTranscripts !== null && (
            <p className="mt-auto border-t border-slate-100 px-4 py-1.5 text-[12px] text-slate-500 flex items-center gap-1">
              {gene.totalTranscripts} transcript{gene.totalTranscripts === 1 ? "" : "s"} total
              {links.ensembl && (
                <a href={links.ensembl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline ml-0.5 inline-flex items-center gap-0.5">
                  Ensembl <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          )}
        </Card>

         {/* Variant Registry */}
         <Card className="flex min-w-0 h-[330px] flex-col overflow-hidden transition-shadow duration-300 hover:shadow-md">
           <MiniCardHeader icon={Shuffle} iconBg="#FFF7ED" iconColor="#EA580C" title="Variant Registry" />
          <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
            <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
              <p className="text-[32px] font-bold text-[#F97316] leading-none">
                {variantCount.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                {isHuman ? "Known variants in ClinVar" : "Known variants"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">dbSNP variants</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.dbSnpCount !== null ? gene.dbSnpCount.toLocaleString() : DASH}</p>
              </div>
              {isHuman && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">ACMG Classification</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{DASH}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">HGVS Names</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800 break-all">{gene.topHgvsName ?? DASH}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">rsID (dbSNP)</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.topRsId ?? DASH}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Population Frequency (MAF)</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.populationFrequencyMaf ?? DASH}</p>
              </div>
              {isHuman && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">pLI (LoF Intolerance)</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.intolerantToLossScore ?? DASH}</p>
                </div>
              )}
            </div>
          </div>
          {links.clinvar && (
            <a
              href={links.clinvar}
              target="_blank"
              rel="noreferrer"
              className="mt-auto flex items-center gap-1 border-t border-slate-100 px-4 py-1.5 text-[12px] font-medium text-brand hover:underline"
            >
              Open ClinVar Workspace
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>

         {/* Tissue Expression */}
         <Card className="flex min-w-0 h-[330px] flex-col overflow-hidden transition-shadow duration-300 hover:shadow-md">
           <MiniCardHeader icon={Layers} iconBg="#ECFDF5" iconColor="#059669" title="Tissue Expression" />
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {hasTissueExpression ? (
              <>
                <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">Highest expression</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-800">
                    {gene.defaultTissue ?? expressionTissues[0]?.name ?? DASH}
                  </p>
                  {gene.tissueTpm !== null && (
                    <p className="mt-0.5 text-[11px] text-slate-500">{gene.tissueTpm} TPM</p>
                  )}
                </div>
                {expressionTissues.length > 0 && (
                  <TissueBarChart tissues={expressionTissues} maxBars={10} />
                )}
              </>
            ) : (
              <UnavailableNote>
                {isViral
                  ? "Not applicable to viral genes."
                  : "No tissue expression data returned."}
              </UnavailableNote>
            )}
          </div>
          {links.gtex && hasTissueExpression && (
            <a
              href={links.gtex}
              target="_blank"
              rel="noreferrer"
              className="mt-auto flex items-center gap-1 border-t border-slate-100 px-4 py-1.5 text-[12px] font-medium text-brand hover:underline"
            >
              View in GTEx
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>
      </div>

      {/* Row 2: Expression Context, Protein & Genetics, Disease Association */}
      <div className="grid min-w-0 grid-cols-1 gap-5 md:auto-rows-[520px] md:grid-cols-3">
         {/* Expression Context */}
         <Card className="flex flex-col overflow-hidden md:h-full transition-shadow duration-300 hover:shadow-md">
           <MiniCardHeader icon={CircleDot} iconBg="#FDF2F8" iconColor="#DB2777" title="Expression Context" />
          <div className="card-scroll flex-1 overflow-y-auto px-4 py-2 pb-3">
            {hasExpressionContext ? (
              <div className="space-y-2.5">
                <DataRow label="Expression level" value={gene.tissueExpressionLevel ?? DASH} />
                <DataRow label="Tissues profiled" value={gene.topTissues.length || DASH} />
                <DataRow label="Expression Breadth" value={gene.topTissues.length > 0 ? `${gene.topTissues.length} tissues` : DASH} />
                <DataRow label="Top Tissue TPM" value={gene.tissueTpm !== null ? `${gene.tissueTpm} TPM` : DASH} />
                <DataRow label="Expression Level" value={gene.tissueExpressionLevel ?? DASH} />
                <DataRow label="Measurement" value="GTEx v8 RNA-seq" />
                <DataRow label="Single-cell" value={gene.defaultCellType ?? DASH} />
                <DataRow label="Cell concentration" value={gene.cellTpm !== null ? `${gene.cellTpm} TPM` : DASH} />

                {(() => {
                  const vitalOrgan = gene.vitalOrganTpm !== null;
                  const exprCV = gene.expressionStabilityCV !== null;
                  const domIso = gene.dominantIsoformFraction !== null;
                  const diseaseFC = gene.diseaseFoldChange !== null;
                  const scPrev = gene.singleCellPrevalence !== null;
                  const circ = gene.circadianAmplitude !== null;
                  const intron = gene.intronRetentionRatio !== null;
                  const devExpr = gene.developmentalExpression !== null;
                  const altPolyA = gene.alternativePolyadenylation !== null;
                  const nucIndex = gene.nuclearRetentionIndex !== null;
                  const hasAny = vitalOrgan || exprCV || domIso || diseaseFC || scPrev || circ || intron || devExpr || altPolyA || nucIndex;
                  if (!hasAny) return null;
                  return (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">ASO Expression Analytics</p>
                      {vitalOrgan && <div className="mb-2"><DataRow label="Cardiac / Renal Baseline" value={`${gene.vitalOrganTpm} TPM (${gene.vitalOrganTpm! < 5 ? "Low Risk" : gene.vitalOrganTpm! < 20 ? "Moderate Risk" : "High Risk"})`} /></div>}
                      {exprCV && <div className="mb-2"><DataRow label="Expression Stability (CV)" value={`${gene.expressionStabilityCV!.toFixed(2)} (${gene.expressionStabilityCV! < 0.5 ? "Stable" : gene.expressionStabilityCV! < 1.0 ? "Moderate Variation" : "Highly Variable"})`} /></div>}
                      {domIso && <div className="mb-2"><DataRow label="Dominant Isoform Fraction" value={`${(gene.dominantIsoformFraction! * 100).toFixed(0)}% (${gene.dominantIsoformId ?? ""})`} /></div>}
                      {diseaseFC && <div className="mb-2"><DataRow label="Disease Upregulation (log₂FC)" value={`${gene.diseaseFoldChange! >= 0 ? "+" : ""}${gene.diseaseFoldChange!.toFixed(2)}x (Diseased vs Normal)`} /></div>}
                      {scPrev && <div className="mb-2"><DataRow label="Single-Cell Positive Fraction" value={`${(gene.singleCellPrevalence! * 100).toFixed(1)}% of ${gene.defaultCellType ?? "cells"}`} /></div>}
                      {circ && <div className="mb-2"><DataRow label="Temporal / Circadian Variation" value={gene.circadianAmplitude!} /></div>}
                      {intron && <div className="mb-2"><DataRow label="Nuclear Pre-mRNA Ratio" value={`${gene.intronRetentionRatio!.toFixed(2)} (${gene.intronRetentionRatio! > 0.3 ? "High Nuclear Pool" : "Low Nuclear Pool"})`} /></div>}
                      {devExpr && <div className="mb-2"><DataRow label="Developmental / Age Expression" value={gene.developmentalExpression!} /></div>}
                      {altPolyA && <div className="mb-2"><DataRow label="Alternative Polyadenylation (3' UTR)" value={gene.alternativePolyadenylation!} /></div>}
                      {nucIndex && <div className="mb-2"><DataRow label="Cytoplasmic vs Nuclear Index" value={`${gene.nuclearRetentionIndex!.toFixed(2)} (${gene.nuclearRetentionIndex! > 0.5 ? "Nuclear Retained" : "Cytoplasmic Dominant"})`} /></div>}
                    </div>
                  );
                })()}

                {links.gtex && (
                  <a href={links.gtex} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline pt-1">
                    View full expression data on GTEx <ExternalLink className="h-3 w-3" />
                  </a>
                )}

              </div>
            ) : (
              <p className="py-4 text-center text-[12px] text-slate-400">
                {isViral
                  ? "Not applicable to viral payloads."
                  : isHuman
                  ? "No tissue expression record returned."
                  : "Tissue expression data available for human genes via GTEx."}
              </p>
            )}
          </div>
        </Card>

         {/* Protein & Genetics */}
         <Card className="flex min-w-0 flex-col overflow-hidden md:h-full transition-shadow duration-300 hover:shadow-md">
           <MiniCardHeader icon={Link2} iconBg="#F5F3FF" iconColor="#7C3AED" title="Protein & Genetics" />
          <div className="card-scroll flex-1 overflow-y-auto px-4 py-2 pb-3 space-y-1.5">
            <DataRow label="Isoelectric Point (pI)" value={gene.isoelectricPoint ?? DASH} />
            <DataRow label="Secondary Structure" value={gene.secondaryStructureDistribution ?? DASH} />
            <DataRow label="Degradation / Ubiquitination" value={gene.ubiquitinationTarget ?? DASH} />
            <DataRow label="Quaternary Structure" value={gene.quaternaryStructure ?? DASH} />
            <DataRow label="Stability Score" value={gene.stabilityScore ?? DASH} />
            <DataRow label="Subcellular Location" value={gene.subcellularLocation ?? DASH} />
            <DataRow label="Functional Domains" value={gene.criticalFunctionalDomains ?? DASH} />
            <DataRow label="Disordered Content" value={gene.disorderedContent ?? DASH} />
            <DataRow label="Proteosomal Turnover" value={gene.proteosomalTurnover ?? DASH} />
            <DataRow label="AlphaFold pLDDT" value={gene.alphafoldPlddt ?? DASH} />
            <DataRow label="GRAVY Index" value={gene.gravyIndex ?? DASH} />
            <DataRow label="Protein Abundance" value={gene.proteinAbundance ?? DASH} />
            <DataRow label="ASO Therapeutic Tractability" value={gene.tractability ?? DASH} highlight={gene.tractability?.includes("Undruggable") ?? false} />
            <div>
              <p className="text-[11px] font-medium text-slate-400">Synonyms</p>
              <p className="mt-0.5 text-[13px] font-medium text-slate-700 break-words leading-relaxed">
                {cleanSynonyms.length > 0 ? cleanSynonyms.join(", ") : DASH}
              </p>
            </div>
            {!gene.proteinId && (
              <UnavailableNote>No matching UniProt entry found via Ensembl cross-references.</UnavailableNote>
            )}
          </div>
          {links.uniprot && (
            <a
              href={links.uniprot}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 border-t border-slate-100 px-4 py-1.5 text-[12px] font-medium text-brand hover:underline"
            >
              Search in UniProt
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>

         {/* Disease Association */}
         <Card className="flex min-w-0 flex-col overflow-hidden transition-shadow duration-300 hover:shadow-md">
           <MiniCardHeader icon={HeartPulse} iconBg="#FEF2F2" iconColor="#DC2626" title="Disease Association" />
          <div className="card-scroll flex-1 overflow-y-auto px-4 py-2 pb-3 space-y-1.5">
            {gene.diseaseName && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Project Disease Label</p>
                <p className="mt-0.5 text-[13px] text-slate-800">{gene.diseaseName}</p>
              </div>
            )}
            {gene.diseaseAssociation && gene.diseaseAssociation !== "None identified" && (
              <div className="rounded-lg border border-red-100 bg-red-50/50 p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-red-400">Reported Disease Association</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-700">
                  {gene.diseaseAssociation}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {gene.associationStatus && <Pill tone="green">{gene.associationStatus}</Pill>}
                  {gene.diseaseAssociationSource.map((source) => (
                    <Pill key={source} tone="slate">{source}</Pill>
                  ))}
                </div>
              </div>
            )}
            {gene.omimId && (
              <DataRow label="Mendelian Inheritance ID (OMIM)" value={gene.omimId} />
            )}
            {gene.phenotypes.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">
                  Phenotypic Association ({gene.phenotypes.length})
                </p>
                <ul className="mt-1 space-y-1">
                  {gene.phenotypes.map((p, i) => (
                    <li key={i} className="text-[12px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span className="min-w-0 break-words">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.diseaseMechanism && (
              <div className="rounded-lg border border-red-100 bg-red-50/50 p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-red-400">Disease Mechanism</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{gene.diseaseMechanism}</p>
              </div>
            )}
            {gene.diagnosticTests.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Diagnostic Biomarkers</p>
                <ul className="mt-1 space-y-1">
                  {gene.diagnosticTests.map((t, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span className="min-w-0 break-words">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.clinicalSymptoms.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Clinical Symptoms</p>
                <ul className="mt-1 space-y-1">
                  {gene.clinicalSymptoms.map((s, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span className="min-w-0 break-words">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.carrierManifestations.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Carrier Manifestations</p>
                <ul className="mt-1 space-y-1">
                  {gene.carrierManifestations.map((c, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span className="min-w-0 break-words">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.therapeuticOptions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Therapeutic Options</p>
                <ul className="mt-1 space-y-1">
                  {gene.therapeuticOptions.map((t, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span className="min-w-0 break-words">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!gene.diseaseMechanism && gene.diagnosticTests.length === 0 && gene.clinicalSymptoms.length === 0 && gene.therapeuticOptions.length === 0 && gene.phenotypes.length === 0 && (
              <UnavailableNote>
                {isViral
                  ? "Curated viral target — see project disease label above."
                  : "No disease/phenotype associations found."}
              </UnavailableNote>
            )}
          </div>
          {links.omim && gene.omimId && (
            <a
              href={links.omim}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 border-t border-slate-100 px-4 py-1.5 text-[12px] font-medium text-brand hover:underline"
            >
              View in OMIM
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>
      </div>
    </div>
  );
}
