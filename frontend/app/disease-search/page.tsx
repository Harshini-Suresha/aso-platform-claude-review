"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientSearchParams } from "@/utils/useClientSearchParams"
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  Tag,
  Heart,
  Activity,
  Dna,
  Pill,
  ChevronDown,
  ChevronRight,
  FileText,
  FlaskConical,
  MousePointer2,
  Route,
  Gauge,
  Layers,
  BarChart3,
  Network,
  Sparkles,
  AlertTriangle,
  PieChart,
  Filter,
  Cloud,
  ThermometerSun,
  Shield,
  Target,
  Database,
  TrendingUp,
  Hash,
  Zap,
  Scale,
  BadgePercent,
  GitCommit,
  Award,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card } from "@/components/ui";
import { fetchDiseaseDetail } from "@/lib/diseaseSearchApi";
import { getOrganism } from "@/lib/organisms";
import { DiseaseDetailResponse, DiseaseGeneMatch, KnownDrug, GeneOrtholog } from "@/types/diseaseSearch";
import DiseaseVisualizations from "@/components/DiseaseVisualizations";

const PREFILL_KEY = "aso:prefillGeneSearch";

const DB_LABELS: Record<string, string> = {
  OMIM: "OMIM",
  Orphanet: "Orphanet",
  ICD10CM: "ICD-10",
  ICD10WHO: "ICD-10 WHO",
  ICD9: "ICD-9",
  MESH: "MeSH",
  DOID: "Disease Ontology",
  NCIT: "NCI Thesaurus",
  UMLS: "UMLS",
  MedDRA: "MedDRA",
  NORD: "NORD",
  GARD: "GARD",
  SCTID: "SNOMED CT",
};

const DB_ORDER = ["OMIM", "Orphanet", "MESH", "DOID", "NCIT", "UMLS", "SCTID", "ICD10CM", "ICD10WHO", "ICD9", "MedDRA", "NORD", "GARD"];

const DB_LINKS: Record<string, (acc: string) => string> = {
  OMIM: (a) => `https://omim.org/entry/${a}`,
  Orphanet: (a) => `https://www.orpha.net/en/disease/detail/${a}`,
  MESH: (a) => `https://meshb.nlm.nih.gov/record/ui?ui=${a}`,
  DOID: (a) => `https://disease-ontology.org/?id=DOID:${a}`,
  NCIT: (a) => `https://ncithesaurus.nci.nih.gov/ncitbrowser/ConceptReport.jsp?dictionary=NCI_Thesaurus&ns=ncit&code=${a}`,
  UMLS: (a) => `https://uts.nlm.nih.gov/uts/umls/concept/${a}`,
  ICD10CM: (a) => `https://icd.who.int/browse10/2019/en#/${a}`,
  ICD10WHO: (a) => `https://icd.who.int/browse10/2019/en#/${a}`,
  ICD9: (a) => `https://icd.codes/icd9/${a}`,
};

const EVIDENCE_LABELS: { key: string; label: string }[] = [
  { key: "genetic_association", label: "Genetic assoc." },
  { key: "genetic_literature", label: "Genetic literature" },
  { key: "somatic_mutation", label: "Somatic mutation" },
  { key: "clinical", label: "Clinical" },
  { key: "affected_pathway", label: "Affected pathway" },
  { key: "pathway", label: "Pathways" },
  { key: "drug", label: "Drugs" },
  { key: "text_mining", label: "Text mining" },
  { key: "animal_model", label: "Animal model" },
  { key: "rna_expression", label: "RNA expression" },
];

const TRACTABILITY_MODALITY: Record<string, string> = {
  SM: "Small molecule",
  AB: "Antibody",
  PR: "PROTAC",
  PROTAC: "PROTAC",
  TR: "Traceable",
  OTHER: "Other",
};

function Td({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-4 text-[11.5px] font-semibold text-slate-700 whitespace-nowrap w-[180px]">{label}</td>
      <td className="py-2 text-[12px] text-slate-700">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
            {value} <ExternalLink className="h-3 w-3" />
          </a>
        ) : value}
      </td>
    </tr>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <tr>
      <td colSpan={2} className="pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        </div>
      </td>
    </tr>
  );
}

function SnapshotStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
      <p className="text-[15px] font-semibold tabular-nums text-slate-800">{value}</p>
      <p className="text-[10.5px] leading-tight text-slate-500">{label}</p>
    </div>
  );
}

function EvidenceBars({ evidence }: { evidence?: Record<string, number> }) {
  const rows = EVIDENCE_LABELS.filter((e) => (evidence?.[e.key] ?? 0) > 0);
  if (rows.length === 0) return <p className="text-[11px] text-slate-400">No evidence breakdown available.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
      {rows.map(({ key, label }) => {
        const value = evidence![key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[11px] text-slate-500">{label}</span>
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, value * 100)}%` }} />
            </div>
            <span className="w-9 text-right text-[10.5px] tabular-nums text-slate-500">{value.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ConstraintChips({ constraint }: { constraint?: DiseaseGeneMatch["constraint"] }) {
  if (!constraint || Object.keys(constraint).length === 0) return null;
  const colors: Record<string, string> = {
    lof: "bg-rose-50 text-rose-700 border-rose-100",
    mis: "bg-amber-50 text-amber-700 border-amber-100",
    syn: "bg-blue-50 text-blue-700 border-blue-100",
  };
  const labels: Record<string, string> = { lof: "LoF", mis: "Missense", syn: "Synonymous" };
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(constraint).map(([type, c]) => (
        <span key={type} className={`rounded-lg border px-2 py-1 text-[10.5px] ${colors[type] ?? "bg-slate-50 text-slate-600 border-slate-100"}`}>
          {labels[type] ?? type}: obs {c.obs ?? "—"} / exp {c.exp ?? "—"} · OE {c.oe ?? "—"}
        </span>
      ))}
    </div>
  );
}

function orthologSourceLabel(ortholog: GeneOrtholog): string {
  if (ortholog.source === "alliance") return ortholog.id.split(":")[0];
  if (ortholog.source === "ncbi") return "NCBI";
  return "Ensembl";
}

function OrthologLink({ ortholog }: { ortholog: GeneOrtholog }) {
  let href: string | null = null;
  if (ortholog.id.startsWith("MGI:")) href = `https://www.informatics.jax.org/marker/${ortholog.id.replace("MGI:", "MGI:")}`;
  else if (ortholog.id.startsWith("RGD:")) href = `https://rgd.mcw.edu/rgdweb/report/gene/main.html?id=${ortholog.id.replace("RGD:", "")}`;
  else if (ortholog.id.startsWith("ZFIN:")) href = `https://zfin.org/${ortholog.id}`;
  else if (ortholog.id.startsWith("FB:")) href = `https://flybase.org/reports/${ortholog.id}`;
  else if (ortholog.id.startsWith("WB:")) href = `https://www.wormbase.org/species/all/gene/${ortholog.id}`;
  else if (ortholog.id.startsWith("VGNC:")) href = `https://vertebrates.genenames.org/data/gene-symbol-report/#!/vgnc_id/${ortholog.id}`;
  else if (ortholog.id.startsWith("ENS")) href = `https://www.ensembl.org/Gene/Summary?g=${ortholog.id}`;
  else if (/^\d+$/.test(ortholog.id)) href = `https://www.ncbi.nlm.nih.gov/gene/${ortholog.id}`;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono hover:text-brand transition-colors">
      {ortholog.id} <ExternalLink className="h-2.5 w-2.5" />
    </a>
  ) : (
    <span className="font-mono">{ortholog.id}</span>
  );
}

function GeneRow({ gene, index, expanded, onToggle, onUseGene, organismId, organismName }: {
  gene: DiseaseGeneMatch;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onUseGene: () => void;
  organismId: string;
  organismName: string;
}) {
  const scorePct = gene.score !== null ? Math.round(gene.score * 100) : 0;
  const scoreColor = scorePct >= 70 ? "bg-emerald-500" : scorePct >= 50 ? "bg-blue-500" : scorePct >= 30 ? "bg-amber-500" : "bg-slate-300";
  const topEvidence = EVIDENCE_LABELS.filter((e) => (gene.evidence?.[e.key] ?? 0) > 0).slice(0, 3);
  const usable = organismId === "human" || Boolean(gene.ortholog);
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 cursor-pointer"
      >
        <td className="py-2.5 pl-5 pr-2 text-[11.5px] tabular-nums text-slate-400">
          <span className="inline-flex items-center gap-1">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            {index + 1}
          </span>
        </td>
        <td className="py-2.5 pr-4">
          <p className="text-[12.5px] font-semibold text-slate-800">{gene.symbol}</p>
          {gene.ortholog && (
            <p className="mt-0.5 inline-flex items-center gap-1 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
              → {gene.ortholog.symbol}
              <span className="font-mono font-normal text-brand/70">{orthologSourceLabel(gene.ortholog)}</span>
            </p>
          )}
          {organismId !== "human" && !gene.ortholog && (
            <p className="mt-0.5 text-[10px] text-slate-400" title="No ortholog found for this organism">
              No {organismName} ortholog
            </p>
          )}
        </td>
        <td className="py-2.5 pr-4 text-[11.5px] text-slate-500 max-w-[200px] truncate" title={gene.name || ""}>
          {gene.name || "—"}
        </td>
        <td className="py-2.5 pr-4">
          {gene.targetClass && gene.targetClass.length > 0 ? (
            <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
              {gene.targetClass[0]}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
        <td className="py-2.5 pr-4">
          {topEvidence.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {topEvidence.map((e) => (
                <span key={e.key} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600" title={e.label}>
                  {e.label} {gene.evidence![e.key].toFixed(2)}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
        <td className="py-2.5 pr-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${scorePct}%` }} />
            </div>
            <span className="text-[11.5px] font-medium text-slate-600 tabular-nums w-10 text-right">
              {gene.score !== null ? gene.score.toFixed(2) : "—"}
            </span>
          </div>
        </td>
        <td className="py-2.5 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onUseGene}
            disabled={!usable}
            title={usable ? undefined : `No ${organismName} ortholog to add to the project`}
            className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-brand hover:text-brand transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use this gene
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={7} className="px-5 py-4">
            <div className="space-y-4">
              {gene.function && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <FileText className="h-3 w-3" /> Function
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-slate-600">{gene.function}</p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <FlaskConical className="h-3 w-3" /> Evidence breakdown (score 0–1)
                  </p>
                  <EvidenceBars evidence={gene.evidence} />
                </div>
                <div className="space-y-3">
                  {gene.tractability && gene.tractability.length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                        <Layers className="h-3 w-3" /> Tractability
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {gene.tractability.map((t, i) => (
                          <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">
                            {t.label} · {TRACTABILITY_MODALITY[t.modality] ?? t.modality}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gene.mousePhenotypes && gene.mousePhenotypes.length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                        <MousePointer2 className="h-3 w-3" /> Mouse models
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {gene.mousePhenotypes.slice(0, 8).map((mp, i) => (
                          <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">
                            {mp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gene.constraint && Object.keys(gene.constraint).length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                        <Gauge className="h-3 w-3" /> Genetic constraint (gnomAD)
                      </p>
                      <ConstraintChips constraint={gene.constraint} />
                    </div>
                  )}
                </div>
              </div>
              {gene.pathways && gene.pathways.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <Route className="h-3 w-3" /> Pathways ({gene.pathways.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {gene.pathways.slice(0, 10).map((p, i) => (
                      <span key={i} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] text-violet-700" title={p.topLevelTerm ?? ""}>
                        {p.pathway}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {gene.hallmarks && gene.hallmarks.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <Sparkles className="h-3 w-3" /> Hallmarks ({gene.hallmarks.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {gene.hallmarks.slice(0, 8).map((h, i) => (
                      <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] text-amber-700">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {gene.chemicalProbes && gene.chemicalProbes.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <FlaskConical className="h-3 w-3" /> Chemical probes ({gene.chemicalProbes.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {gene.chemicalProbes.slice(0, 12).map((p, i) => (
                      <a
                        key={i}
                        href={`https://www.ebi.ac.uk/chembl/g/#/molecule/${p.drugId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2 py-0.5 font-mono text-[10.5px] text-cyan-700 hover:bg-cyan-100 transition-colors"
                      >
                        {p.drugId}
                        {p.isHighQuality && (
                          <span className="rounded-full bg-cyan-100 px-1 py-px text-[9px] font-semibold uppercase">HQ</span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {gene.safetyLiabilities && gene.safetyLiabilities.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <AlertTriangle className="h-3 w-3" /> Safety liabilities ({gene.safetyLiabilities.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {gene.safetyLiabilities.slice(0, 10).map((s, i) => (
                      <span key={i} className="rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] text-red-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-slate-400">
                {gene.ensemblId && (
                  <a
                    href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensemblId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono hover:text-brand transition-colors"
                  >
                    {gene.ensemblId} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {gene.ortholog && <OrthologLink ortholog={gene.ortholog} />}
                {gene.genomicLocation?.chromosome && (
                  <span className="font-mono">
                    Chr {gene.genomicLocation.chromosome}:{gene.genomicLocation.start?.toLocaleString() ?? "?"}–
                    {gene.genomicLocation.end?.toLocaleString() ?? "?"}
                  </span>
                )}
                {gene.biotype && <span>Biotype: {gene.biotype}</span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DrugRow({ drug, index, expanded, onToggle }: {
  drug: KnownDrug;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const moa = drug.mechanismsOfAction;
  return (
    <>
      <tr onClick={onToggle} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 cursor-pointer">
        <td className="py-2 pl-5 pr-2 text-[11.5px] tabular-nums text-slate-400">
          <span className="inline-flex items-center gap-1">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            {index + 1}
          </span>
        </td>
        <td className="py-2 pr-4">
          <p className="text-[12px] font-medium text-slate-700">{drug.name}</p>
          {drug.tradeNames && drug.tradeNames.length > 0 && (
            <p className="mt-0.5 text-[10.5px] text-slate-400">{drug.tradeNames.join(", ")}</p>
          )}
        </td>
        <td className="py-2 pr-4">
          {drug.drugType ? (
            <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">{drug.drugType}</span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
        <td className="py-2 pr-4 text-[11.5px] text-slate-500 max-w-[220px]">
          {moa?.actionTypes && moa.actionTypes.length > 0 ? (
            <span className="line-clamp-2">
              {(moa.rows?.[0]?.mechanismOfAction || moa.actionTypes.join(", "))}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
        <td className="py-2 pr-4 text-right text-[11.5px] tabular-nums text-slate-500">
          {drug.clinicalReports?.length ?? 0}
        </td>
        <td className="py-2 pr-5 text-right">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
            drug.phase === 4 || drug.status?.toLowerCase().includes("approved")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}>
            {drug.phase !== null && drug.phase >= 4 ? "Approved" : drug.phase !== null ? `Phase ${drug.phase}` : drug.status || "—"}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={6} className="px-5 py-4">
            <div className="space-y-3">
              {moa && (moa.actionTypes?.length || moa.targetTypes?.length) && (
                <div className="flex flex-wrap gap-1.5">
                  {moa.actionTypes?.map((a, i) => (
                    <span key={`a${i}`} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-medium text-blue-700">{a}</span>
                  ))}
                  {moa.targetTypes?.map((t, i) => (
                    <span key={`t${i}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">{t}</span>
                  ))}
                </div>
              )}
              {moa?.rows && moa.rows.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5">
                  {moa.rows.slice(0, 6).map((r, i) => (
                    <li key={i} className="text-[11.5px] text-slate-600">
                      {r.mechanismOfAction}
                      {r.actionType ? <span className="text-slate-400"> ({r.actionType})</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {drug.approvedIndications && drug.approvedIndications.length > 0 && (
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-600">
                    Approved indications ({drug.approvedIndications.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {drug.approvedIndications.map((ind, i) => (
                      <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">{ind}</span>
                    ))}
                  </div>
                </div>
              )}
              {(drug.tradeNames && drug.tradeNames.length > 0) || (drug.synonyms && drug.synonyms.length > 0) ? (
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Names & synonyms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {drug.tradeNames?.map((tn, i) => (
                      <span key={`tn${i}`} className="rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-medium text-sky-700">{tn}</span>
                    ))}
                    {drug.synonyms?.map((s, i) => (
                      <span key={`s${i}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">{s}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {drug.clinicalReports && drug.clinicalReports.length > 0 && (
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Clinical reports ({drug.clinicalReports.length})</p>
                  <div className="space-y-1.5">
                    {drug.clinicalReports.slice(0, 8).map((cr, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11.5px]">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          cr.clinicalStage === "Approved" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {cr.clinicalStage || cr.trialPhase || "—"}
                        </span>
                        {cr.trialOverallStatus && <span className="text-slate-500">{cr.trialOverallStatus}</span>}
                        {cr.year && <span className="tabular-nums text-slate-400">{cr.year}</span>}
                        {cr.title ? (
                          <a
                            href={cr.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-slate-600 hover:text-brand transition-colors"
                            title={cr.title}
                          >
                            {cr.title}
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DiseaseSearchResultsPage() {
  const router = useRouter();
  const searchParams = useClientSearchParams();
  const query = searchParams?.get("query") ?? "";
  const organism = searchParams?.get("organism") ?? "human";
  const organismName = getOrganism(organism)?.commonName ?? organism;
  const isHuman = organism === "human";

  const [detail, setDetail] = useState<DiseaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGenes, setExpandedGenes] = useState<Set<string>>(new Set());
  const [expandedDrugs, setExpandedDrugs] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!query) {
      setError("No disease name provided.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchDiseaseDetail(query, organism)
      .then((res) => {
        if (!res.diseaseId) {
          setError(`No matching disease found for "${query}".`);
        }
        setDetail(res);
      })
      .catch(() => setError("Could not reach the disease search service."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, organism]);

  function handleUseGene(symbol: string, ortholog?: GeneOrtholog | null) {
    const targetSymbol = ortholog?.symbol ?? symbol;
    sessionStorage.setItem(
      PREFILL_KEY,
      JSON.stringify({ organism, geneSymbol: targetSymbol, diseaseName: detail?.diseaseName ?? query })
    );
    router.push("/");
  }

  const formatCount = (n?: number | null) => (n != null ? n.toLocaleString() : "—");

  const evidenceSummary = useMemo(() => {
    const acc = EVIDENCE_LABELS.map((e) => ({ ...e, genes: 0, total: 0 }));
    for (const g of detail?.genes ?? []) {
      for (const item of acc) {
        const v = g.evidence?.[item.key] ?? 0;
        if (v > 0) {
          item.genes += 1;
          item.total += v;
        }
      }
    }
    return acc.filter((c) => c.genes > 0).sort((a, b) => b.total - a.total);
  }, [detail]);

  const pathwaySummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail?.genes ?? []) {
      for (const p of g.pathways ?? []) {
        counts[p.pathway] = (counts[p.pathway] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([pathway, count]) => ({ pathway, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [detail]);

  const stageSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of detail?.knownDrugs ?? []) {
      const key =
        d.phase === 4 || d.status?.toLowerCase().includes("approved")
          ? "Approved"
          : d.phase !== null
            ? `Phase ${d.phase}`
            : d.status || "Other";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  const biotypeSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail?.genes ?? []) {
      counts[g.biotype || "unknown"] = (counts[g.biotype || "unknown"] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  const targetClassSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail?.genes ?? []) {
      for (const tc of g.targetClass ?? []) {
        counts[tc] = (counts[tc] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [detail]);

  const tractabilitySummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail?.genes ?? []) {
      for (const t of g.tractability ?? []) {
        const modality = TRACTABILITY_MODALITY[t.modality] ?? t.modality;
        counts[modality] = (counts[modality] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  const mousePhenotypeSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail?.genes ?? []) {
      for (const mp of g.mousePhenotypes ?? []) {
        counts[mp] = (counts[mp] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([phenotype, count]) => ({ phenotype, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [detail]);

  const constraintSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail?.genes ?? []) {
      for (const type of Object.keys(g.constraint ?? {})) {
        counts[type] = (counts[type] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  const totalGenes = detail?.genes.length ?? 0;

  const scoreDistribution = useMemo(() => {
    const bins = [0, 0, 0, 0, 0];
    for (const g of detail?.genes ?? []) {
      if (g.score !== null && g.score !== undefined) {
        const b = Math.min(4, Math.floor(g.score * 5));
        bins[b]++;
      }
    }
    const max = Math.max(...bins, 1);
    return bins.map((count, i) => ({
      label: `${(i * 0.2).toFixed(1)}–${((i + 1) * 0.2).toFixed(1)}`,
      count,
      pct: (count / max) * 100,
    }));
  }, [detail]);

  const therapeuticAreaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ta of detail?.therapeuticAreas ?? []) {
      counts[ta] = (counts[ta] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  const drugStageCounts = useMemo(() => {
    const stages = ["Pre-clinical", "Phase 1", "Phase 2", "Phase 3", "Approved"];
    const counts = { "Pre-clinical": 0, "Phase 1": 0, "Phase 2": 0, "Phase 3": 0, "Approved": 0 };
    for (const d of detail?.knownDrugs ?? []) {
      const phase = d.phase;
      if (phase === 4 || d.status?.toLowerCase().includes("approved")) counts["Approved"]++;
      else if (phase === 3) counts["Phase 3"]++;
      else if (phase === 2) counts["Phase 2"]++;
      else if (phase === 1) counts["Phase 1"]++;
      else counts["Pre-clinical"]++;
    }
    return stages.map((s) => ({ stage: s, count: counts[s as keyof typeof counts] }));
  }, [detail]);

  const biotypeDonut = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail?.genes ?? []) {
      counts[g.biotype || "unknown"] = (counts[g.biotype || "unknown"] ?? 0) + 1;
    }
    const total = detail?.genes.length ?? 0;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const colors = ["bg-indigo-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-slate-400"];
    return sorted.map(([biotype, count], i) => ({
      label: biotype,
      count,
      pct: (count / total) * 100,
      color: colors[i % colors.length],
    }));
  }, [detail, totalGenes]);

  const evidenceHeatmapGenes = useMemo(() => {
    const topGenes = (detail?.genes ?? []).slice(0, 8);
    return topGenes.map((g) => ({
      symbol: g.symbol,
      evidence: {
        genetic: g.evidence?.genetic_association ?? 0,
        geneticLit: g.evidence?.genetic_literature ?? 0,
        somatic: g.evidence?.somatic_mutation ?? 0,
        clinical: g.evidence?.clinical ?? 0,
        pathway: g.evidence?.pathway ?? 0,
        drug: g.evidence?.drug ?? 0,
        textMining: g.evidence?.text_mining ?? 0,
        animalModel: g.evidence?.animal_model ?? 0,
        rnaExpr: g.evidence?.rna_expression ?? 0,
      },
    }));
  }, [detail]);

  const tractabilityData = useMemo(() => {
    const tracts: Record<string, number> = {};
    for (const g of detail?.genes ?? []) {
      for (const t of g.tractability ?? []) {
        const modality = TRACTABILITY_MODALITY[t.modality] ?? t.modality;
        const key = `${t.label} (${modality})`;
        tracts[key] = (tracts[key] ?? 0) + 1;
      }
    }
    const max = Math.max(...Object.values(tracts), 1);
    return Object.entries(tracts)
      .map(([label, count]) => ({ label, count, pct: (count / max) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [detail]);

  const safetyBubbleData = useMemo(() => {
    const bubbles: { symbol: string; liabilityCount: number; score: number | null }[] = [];
    for (const g of detail?.genes ?? []) {
      const liabs = g.safetyLiabilities ?? [];
      if (liabs.length > 0) {
        bubbles.push({ symbol: g.symbol, liabilityCount: liabs.length, score: g.score });
      }
    }
    const maxLiab = Math.max(...bubbles.map((b) => b.liabilityCount), 1);
    const maxScore = Math.max(...(detail?.genes ?? []).map((g) => g.score ?? 0), 0.01);
    return bubbles.map((b) => ({
      ...b,
      size: 20 + (b.liabilityCount / maxLiab) * 60,
      opacity: (b.score ?? 0) / maxScore,
    })).slice(0, 12);
  }, [detail]);

  const chemicalProbeData = useMemo(() => {
    const withProbes = (detail?.genes ?? []).filter((g) => (g.chemicalProbes?.length ?? 0) > 0).length;
    const total = totalGenes;
    const withHQ = (detail?.genes ?? []).filter((g) => g.chemicalProbes?.some((p) => p.isHighQuality)).length;
    const pct = total > 0 ? (withProbes / total) * 100 : 0;
    const pctHQ = total > 0 ? (withHQ / total) * 100 : 0;
    return { total, withProbes, withHQ, pct, pctHQ };
  }, [detail, totalGenes]);

  const pathwayBarData = useMemo(() => {
    return pathwaySummary.slice(0, 8);
  }, [pathwaySummary]);

  const literatureScatterData = useMemo(() => {
    const genes = detail?.genes ?? [];
    const maxLit = Math.max(...genes.map((g) => g.literatureCount ?? 0), 1);
    const maxScore = Math.max(...genes.map((g) => g.score ?? 0), 0.01);
    return genes.slice(0, 12).map((g) => ({
      symbol: g.symbol,
      lit: g.literatureCount ?? 0,
      score: g.score ?? 0,
      xPct: ((g.literatureCount ?? 0) / maxLit) * 100,
      yPct: ((g.score ?? 0) / maxScore) * 100,
    }));
  }, [detail]);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-6xl space-y-5">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to search
            </button>

            {loading && (
              <Card className="flex items-center justify-center gap-2 p-10 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Searching Open Targets for &ldquo;{query}&rdquo;
              </Card>
            )}

            {!loading && error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!loading && detail && detail.diseaseId && !isHuman && (() => {
              const mapped = detail.orthologMapped ?? 0;
              return (
                <div className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-[12.5px] text-slate-600">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-brand" />
                  {mapped === 0 ? (
                    <p>
                      Disease associations are human-based (Open Targets), and ortholog mapping is currently unavailable — so the
                      genes below are <span className="font-medium text-slate-700">human</span> genes. Use them to identify your target,
                      but the {organismName} symbols will only appear once mapping recovers.
                    </p>
                  ) : (
                    <p>
                      Disease associations are human-based (Open Targets). Genes shown are mapped to their{" "}
                      <span className="font-medium text-slate-700">{organismName}</span> orthologs via Ensembl, the Alliance of Genome
                      Resources, or NCBI — {mapped} gene{mapped === 1 ? "" : "s"} have a mapped {organismName} ortholog. Use the{" "}
                      <span className="font-medium text-slate-700">{organismName}</span> symbol when adding a gene to your project.
                    </p>
                  )}
                </div>
              );
            })()}

            {!loading && detail && detail.diseaseId && (
              <>
                {/* Main info card */}
                <Card className="p-0 overflow-hidden">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{detail.diseaseId}</p>
                    <h1 className="mt-0.5 text-[20px] font-semibold text-slate-800">{detail.diseaseName}</h1>
                    {detail.therapeuticAreas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {detail.therapeuticAreas.map((ta) => (
                          <span key={ta} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">{ta}</span>
                        ))}
                      </div>
                    )}
                    {detail.ancestors && detail.ancestors.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[10.5px] text-slate-400">
                        {[...detail.ancestors].reverse().map((a, i, arr) => (
                          <span key={a.id} className="inline-flex items-center gap-1">
                            <span className="hover:text-slate-600 transition-colors">{a.name}</span>
                            {i < arr.length - 1 && <span className="text-slate-300">›</span>}
                          </span>
                        ))}
                        <span className="text-slate-300">›</span>
                        <span className="font-medium text-slate-600">{detail.diseaseName}</span>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <BookOpen className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatCount(detail.literatureCount)}</p>
                          <p className="text-[10.5px] text-slate-500">Publications</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <Dna className="h-4 w-4 text-indigo-400" />
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatCount(detail.associatedTargetCount)}</p>
                          <p className="text-[10.5px] text-slate-500">Associated targets</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <Pill className="h-4 w-4 text-emerald-500" />
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatCount(detail.drugCandidateCount)}</p>
                          <p className="text-[10.5px] text-slate-500">Drug candidates</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-2">
                    <table className="w-full">
                      <tbody>
                        <SectionHeader icon={BookOpen} title="Disease Information" />
                        <Td label="Description" value={detail.description} />
                        {DB_ORDER.map((db) => {
                          const acc = detail.databaseRefs?.[db];
                          if (!acc) return null;
                          const link = DB_LINKS[db] ? DB_LINKS[db](acc) : undefined;
                          return <Td key={db} label={DB_LABELS[db] ?? db} value={acc} link={link} />;
                        })}

                        {detail.synonyms.length > 0 && (
                          <>
                            <SectionHeader icon={Tag} title="Alternative Names" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.synonyms.map((syn, i) => (
                                    <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                                      {syn.term}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}

{detail.phenotypes.length > 0 && (
                          <>
                            <SectionHeader icon={Heart} title="Clinical Features (HPO)" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.phenotypes.map((p, i) => (
                                    <a
                                      key={i}
                                      href={`https://hpo.jax.org/browse/term/${p.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-100 transition-colors"
                                    >
                                      {p.name}
                                    </a>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}

                        {detail.hpoPhenotypes && detail.hpoPhenotypes.length > 0 && (
                          <>
                            <SectionHeader icon={Heart} title="Clinical Features (HPO Ontology)" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.hpoPhenotypes.map((p, i) => (
                                    <a
                                      key={i}
                                      href={`https://hpo.jax.org/browse/term/${p.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-100 transition-colors"
                                      >
                                        {p.name}
                                      </a>
                                    ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}

                        {detail.childDiseases.length > 0 && (
                          <>
                            <SectionHeader icon={Activity} title="Subtypes / Child Diseases" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.childDiseases.map((c, i) => (
                                    <span key={i} className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] text-violet-700">
                                      {c.name}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}

                        {detail.relatedDiseases.length > 0 && (
                          <>
                            <SectionHeader icon={Activity} title="Related Diseases" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.relatedDiseases.map((r, i) => (
                                    <span key={i} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
                                      {r.id} <span className="text-amber-500">({(r.score * 100).toFixed(0)}%)</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* At-a-glance snapshot */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <SnapshotStat
                    label="Clinical features"
                    value={detail.phenotypes.length > 0
                      ? detail.phenotypes.length
                      : (detail.hpoPhenotypes?.length ?? 0)}
                  />
                  <SnapshotStat label="Alternative names" value={detail.synonyms.length} />
                  <SnapshotStat label="Subtypes" value={detail.childDiseases.length} />
                  <SnapshotStat label="Related diseases" value={detail.relatedDiseases.length} />
                  <SnapshotStat label="Genes w/ evidence" value={evidenceSummary.length > 0 ? evidenceSummary.reduce((s, e) => Math.max(s, e.genes), 0) : 0} />
                  <SnapshotStat
                    label="Avg. gene score"
                    value={
                      totalGenes > 0
                        ? (detail.genes.reduce((s, g) => s + (g.score ?? 0), 0) / totalGenes).toFixed(2)
                        : "—"
                    }
                  />
                </div>

                {/* Gene-level summary cards */}
                {(targetClassSummary.length > 0 ||
                  tractabilitySummary.length > 0 ||
                  mousePhenotypeSummary.length > 0 ||
                  constraintSummary.length > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {targetClassSummary.length > 0 && (
                      <Card className="p-0 overflow-hidden">
                        <div className="border-b border-slate-100 px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-indigo-500" />
                            <p className="text-[13px] font-semibold text-slate-800">Target Classes</p>
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-slate-400">
                            Protein class distribution across {totalGenes} associated genes.
                          </p>
                        </div>
                        <div className="px-5 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {targetClassSummary.map(([tc, count]) => (
                              <span key={tc} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700">
                                {tc}
                                <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}

                    {tractabilitySummary.length > 0 && (
                      <Card className="p-0 overflow-hidden">
                        <div className="border-b border-slate-100 px-5 py-3">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-emerald-500" />
                            <p className="text-[13px] font-semibold text-slate-800">Tractability</p>
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-slate-400">
                            Drug modalities available for the associated genes.
                          </p>
                        </div>
                        <div className="px-5 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {tractabilitySummary.map(([modality, count]) => (
                              <span key={modality} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">
                                {modality}
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}

                    {mousePhenotypeSummary.length > 0 && (
                      <Card className="p-0 overflow-hidden">
                        <div className="border-b border-slate-100 px-5 py-3">
                          <div className="flex items-center gap-2">
                            <MousePointer2 className="h-4 w-4 text-slate-500" />
                            <p className="text-[13px] font-semibold text-slate-800">Top Mouse Phenotypes</p>
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-slate-400">
                            Most frequent phenotypes across mouse models of the associated genes.
                          </p>
                        </div>
                        <div className="px-5 py-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                            {mousePhenotypeSummary.map((p) => (
                              <div key={p.phenotype} className="flex items-center gap-2">
                                <span className="flex-1 truncate text-[11px] text-slate-600" title={p.phenotype}>
                                  {p.phenotype}
                                </span>
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600">
                                  {p.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}

                    {constraintSummary.length > 0 && (
                      <Card className="p-0 overflow-hidden">
                        <div className="border-b border-slate-100 px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-rose-500" />
                            <p className="text-[13px] font-semibold text-slate-800">Genetic Constraint</p>
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-slate-400">
                            Genes with gnomAD constraint evidence by type (LoF, missense, synonymous).
                          </p>
                        </div>
                        <div className="px-5 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {constraintSummary.map(([type, count]) => (
                              <span key={type} className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700">
                                {type === "lof" ? "LoF" : type === "mis" ? "Missense" : type === "syn" ? "Synonymous" : type}
                                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* Evidence landscape */}
                {evidenceSummary.length > 0 && (
                  <Card className="p-0 overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                        <p className="text-[13px] font-semibold text-slate-800">Evidence Landscape</p>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-slate-400">
                        Across {totalGenes} associated genes — share of genes with each type of supporting evidence.
                      </p>
                    </div>
                    <div className="px-5 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2">
                        {evidenceSummary.map((e) => (
                          <div key={e.key} className="flex items-center gap-2">
                            <span className="w-32 shrink-0 text-[11px] text-slate-500">{e.label}</span>
                            <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${(e.genes / totalGenes) * 100}%` }} />
                            </div>
                            <span className="w-14 text-right text-[10.5px] tabular-nums text-slate-500">{e.genes}/{totalGenes}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Top pathways */}
                {pathwaySummary.length > 0 && (
                  <Card className="p-0 overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-violet-500" />
                        <p className="text-[13px] font-semibold text-slate-800">Top Pathways</p>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-slate-400">Reactome pathways most frequent across the associated genes.</p>
                    </div>
                    <div className="px-5 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {pathwaySummary.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                            <span className="flex-1 text-[11px] font-medium text-slate-700">{p.pathway}</span>
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] font-medium text-violet-700">{p.count} gene{p.count > 1 ? "s" : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Known drugs table */}
                {detail.knownDrugs.length > 0 && (
                  <Card className="p-0 overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-emerald-600" />
                        <p className="text-[13px] font-semibold text-slate-800">Known Drugs / Clinical Candidates ({detail.knownDrugs.length})</p>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-slate-400">Click a row to see mechanism of action, approved indications and clinical reports.</p>
                      {stageSummary.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {stageSummary.map(([stage, count]) => (
                            <span key={stage} className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${
                              stage === "Approved" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {stage} · {count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-2">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-[11px] font-medium text-slate-500">
                            <th className="w-10 py-2 pr-2 text-left">#</th>
                            <th className="py-2 pr-4 text-left">Drug Name</th>
                            <th className="py-2 pr-4 text-left">Type</th>
                            <th className="py-2 pr-4 text-left">Mechanism</th>
                            <th className="py-2 pr-4 text-right">Reports</th>
                            <th className="py-2 pr-5 text-right">Stage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.knownDrugs.map((d, i) => (
                            <DrugRow
                              key={d.name}
                              drug={d}
                              index={i}
                              expanded={expandedDrugs.has(i)}
                              onToggle={() =>
                                setExpandedDrugs((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                })
                              }
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* === 10 Data Visualizations === */}
                <DiseaseVisualizations detail={detail} />

                {/* Associated genes table */}
                <Card className="p-0 overflow-hidden">
                  <div className="border-b border-slate-100 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Dna className="h-4 w-4 text-indigo-500" />
                      <p className="text-[13px] font-semibold text-slate-800">Associated Genes ({detail.genes.length})</p>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-slate-400">
                      Ranked by evidence-based association score (0–1). Click a row to expand function, evidence breakdown, pathways, mouse models, genetic constraint, genomic location, chemical probes and safety liabilities. Higher score = stronger evidence linking the gene to this disease.
                      {!isHuman && ` For ${organismName}, the mapped ortholog symbol is shown under each gene.`}
                    </p>
                    {biotypeSummary.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {biotypeSummary.map(([biotype, count]) => (
                          <span key={biotype} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-600">
                            {biotype} · {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] text-[11px] font-medium text-slate-500">
                          <th className="w-12 py-2.5 pl-5 pr-2 text-left">#</th>
                          <th className="py-2.5 pr-4 text-left">Symbol</th>
                          <th className="py-2.5 pr-4 text-left">Name</th>
                          <th className="py-2.5 pr-4 text-left">Target class</th>
                          <th className="py-2.5 pr-4 text-left">Evidence</th>
                          <th className="py-2.5 pr-4 text-right min-w-[140px]">Association Score</th>
                          <th className="py-2.5 pr-5 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.genes.map((g, gi) => (
                          <GeneRow
                            key={g.symbol}
                            gene={g}
                            index={gi}
                            organismId={organism}
                            organismName={organismName}
                            expanded={expandedGenes.has(g.symbol)}
                            onToggle={() =>
                              setExpandedGenes((prev) => {
                                const next = new Set(prev);
                                if (next.has(g.symbol)) next.delete(g.symbol);
                                else next.add(g.symbol);
                                return next;
                              })
                            }
                            onUseGene={() => handleUseGene(g.symbol, g.ortholog)}
                          />
                        ))}
                        {detail.genes.length === 0 && (
                          <tr><td colSpan={7} className="py-4 text-center text-[12px] text-slate-400">No associated genes found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <p className="text-[10.5px] text-center text-slate-400 py-2">Source: Open Targets Platform • HPO • OMIM • Orphanet</p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
