import HelpPageShell from "@/components/HelpPageShell";
import { Card } from "@/components/ui";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";

const DATABASES = [
  { name: "Ensembl REST API", use: "Gene/transcript lookup, exon structure, sequences, cross-species phenotype annotations", status: "live" },
  { name: "UniProt REST API", use: "Protein accession, name, length, structural/functional features", status: "live" },
  { name: "Open Targets Platform", use: "Human disease-gene associations (human only — not available for other species)", status: "live" },
  { name: "gnomAD (v2.1.1 constraint release)", use: "Gene constraint metrics: pLI, LOEUF, mutation rate, population frequency", status: "live" },
  { name: "gnomAD GraphQL API", use: "rsID lookup for ClinVar pathogenic variants present in gnomAD", status: "live" },
  { name: "ClinGen Dosage Sensitivity", use: "Haploinsufficiency / triplosensitivity classification", status: "live" },
  { name: "ClinVar (via NCBI E-utilities)", use: "Top pathogenic variant HGVS name lookup", status: "live" },
  { name: "Human Protein Atlas (HPA)", use: "Single-cell expression data (human only)", status: "live" },
  { name: "STRING", use: "Protein-protein interaction counts", status: "live" },
  { name: "PubMed (NCBI E-utilities)", use: "Article and review counts for a gene symbol", status: "live" },
  { name: "RNAdecayCafe (Zenodo dataset)", use: "RNA half-life estimates, averaged across 12 human cell lines", status: "live" },
  { name: "FAVOR gene annotation API", use: "Gene dependency/essentiality score", status: "unverified" },
  { name: "Curated viral reference set", use: "Gene data for the 6 supported viruses (Tier 5) — hand-compiled, not a live connector", status: "curated" },
  { name: "KEGG REST API", use: "Pathway lookup, disease associations, drug targets", status: "live" },
  { name: "Reactome Content Service", use: "Pathway and reaction annotations, cross-references", status: "live" },
  { name: "Pathway Commons API", use: "Pathway search across multiple databases (WikiPathways, Reactome, KEGG, etc.)", status: "live" },
  { name: "Gene Ontology (QuickGO / EBI)", use: "Biological process, molecular function, cellular component annotations", status: "live" },
  { name: "GTEx Portal API v2", use: "Tissue-level TPM expression across 54 human tissues", status: "live" },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        Live
      </span>
    );
  }
  if (status === "curated") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
        Curated
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      <HelpCircle className="h-3 w-3" />
      Unverified
    </span>
  );
}

export default function SupportedDatabasesPage() {
  return (
    <HelpPageShell
      title="Supported Databases"
      subtitle="Every external data source actually wired into the backend right now, with its real status."
    >
      <Card className="p-5">
        <div className="space-y-3">
          {DATABASES.map((d) => (
            <div key={d.name} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-[13px] font-medium text-slate-800">{d.name}</p>
                <p className="mt-0.5 text-[12.5px] text-slate-500">{d.use}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 bg-amber-50/50 border-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-amber-800">FAVOR API — unverified</p>
            <p className="mt-1 text-[12.5px] text-amber-700">
              This endpoint hasn&apos;t been independently confirmed to be a live, working public API. It
              fails safely to a null result rather than fabricating a value, but treat any gene
              dependency score you see as unconfirmed until this is verified.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-[13px] font-semibold text-slate-800">Analysis Modules</p>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Computed insights and predictions built on top of connected data sources:
        </p>
        <ul className="mt-2 space-y-1">
          <li className="text-[12.5px] text-slate-600">• <strong>Pathway Enrichment</strong> — KEGG, Reactome, Pathway Commons via mygene.info</li>
          <li className="text-[12.5px] text-slate-600">• <strong>GO Term Analysis</strong> — Biological Process, Molecular Function, Cellular Component (EBI QuickGO)</li>
          <li className="text-[12.5px] text-slate-600">• <strong>Tissue Expression</strong> — GTEx v8, Human Protein Atlas, UniProt fallback chain</li>
          <li className="text-[12.5px] text-slate-600">• <strong>Interaction Network</strong> — STRING high/medium confidence PPI with density scoring</li>
          <li className="text-[12.5px] text-slate-600">• <strong>Constraint Analysis</strong> — gnomAD pLI, LOEUF, ClinGen haploinsufficiency</li>
        </ul>
      </Card>
    </HelpPageShell>
  );
}
