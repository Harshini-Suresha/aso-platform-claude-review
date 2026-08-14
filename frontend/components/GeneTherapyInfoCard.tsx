import {
  Dna,
  CheckCircle2,
  ExternalLink,
  Clock,
  Sparkles,
  Scissors,
  Zap,
  Activity,
  FlaskConical,
  Shield,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card } from "./ui";
import { GeneTargetObject } from "@/types/gene";

const APPROVED_GENE_THERAPIES = [
  { year: "2017", name: "Luxturna", modality: "AAV2", target: "RPE65", indication: "Inherited retinal dystrophy" },
  { year: "2017", name: "Kymriah", modality: "CAR-T (lentiviral)", target: "CD19", indication: "ALL / DLBCL" },
  { year: "2017", name: "Yescarta", modality: "CAR-T (retroviral)", target: "CD19", indication: "DLBCL" },
  { year: "2019", name: "Zolgensma", modality: "AAV9", target: "SMN1", indication: "Spinal muscular atrophy (SMA)" },
  { year: "2020", name: "Tecartus", modality: "CAR-T (retroviral)", target: "CD19", indication: "MCL / ALL" },
  { year: "2021", name: "Breyanzi", modality: "CAR-T (lentiviral)", target: "CD19", indication: "LBCL" },
  { year: "2021", name: "Abecma", modality: "CAR-T (lentiviral)", target: "BCMA", indication: "Multiple myeloma" },
  { year: "2022", name: "Carvykti", modality: "CAR-T (lentiviral)", target: "BCMA", indication: "Multiple myeloma" },
  { year: "2022", name: "Zynteglo", modality: "Lentiviral (ex vivo)", target: "HBB", indication: "Beta-thalassemia" },
  { year: "2022", name: "Adstiladrin", modality: "Adenoviral (intravesical)", target: "IFNA2", indication: "High-risk bladder cancer" },
  { year: "2022", name: "Hemgenix", modality: "AAV5", target: "F9", indication: "Hemophilia B" },
  { year: "2023", name: "Elevidys", modality: "AAVrh74", target: "DMD", indication: "Duchenne muscular dystrophy" },
  { year: "2023", name: "Vyjuvek", modality: "HSV-based (topical)", target: "COL7A1", indication: "Dystrophic epidermolysis bullosa" },
  { year: "2023", name: "Roctavian", modality: "AAV5", target: "F8", indication: "Severe hemophilia A" },
  { year: "2023", name: "Casgevy", modality: "CRISPR-Cas9 (ex vivo)", target: "BCL11A", indication: "Sickle cell disease / beta-thalassemia" },
  { year: "2023", name: "Lyfgenia", modality: "Lentiviral (ex vivo)", target: "HBB", indication: "Sickle cell disease" },
  { year: "2024", name: "Lenmeldy", modality: "Lentiviral (ex vivo)", target: "ARSA", indication: "Metachromatic leukodystrophy" },
  { year: "2024", name: "Beqvez", modality: "AAV", target: "F9", indication: "Hemophilia B" },
];

function modalityTone(modality: string | undefined): string {
  const m = (modality || "").toLowerCase();
  if (
    m.includes("gene therapy") || m.includes("aav") || m.includes("crispr") ||
    m.includes("lentiviral") || m.includes("car-t") || m.includes("cell therapy") ||
    m.includes("adenoviral") || m.includes("oncolytic")
  ) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (
    m.includes("aso") || m.includes("sirna") || m.includes("aptamer") ||
    m.includes("oligonucleotide") || m.includes("odn")
  ) {
    return "bg-blue-50 text-blue-700";
  }
  if (m.includes("research")) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-slate-100 text-slate-600";
}

function therapyLinks(
  t: { name: string; nctId?: string | null },
  symbol: string,
): { label: string; url: string }[] {
  const drug = t.name.split(" (")[0].trim();
  const links: { label: string; url: string }[] = [
    {
      label: "PubMed",
      url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`${drug} ${symbol} therapy`)}`,
    },
    {
      label: "ClinicalTrials.gov",
      url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(drug)}`,
    },
  ];
  if (t.nctId) {
    links.push({
      label: "Trial record",
      url: `https://clinicaltrials.gov/study/${t.nctId}`,
    });
  }
  return links;
}

function TherapyLinksRow({
  t,
  symbol,
}: {
  t: { name: string; nctId?: string | null };
  symbol: string;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {therapyLinks(t, symbol).map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-1.5 py-0.5 text-[9.5px] font-medium text-brand transition-colors hover:border-indigo-300 hover:text-indigo-800"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          {link.label}
        </a>
      ))}
    </div>
  );
}

function targetMatches(target: string, symbol: string): boolean {
  return target
    .split("/")
    .some((t) => t.trim().toUpperCase() === symbol.toUpperCase());
}

type Strategy = {
  key: string;
  icon: LucideIcon;
  title: string;
  level: "approved" | "strong" | "potential" | "not-suited";
  reason: string;
};

const STRATEGY_FIT_TONE: Record<Strategy["level"], { badge: string; label: string }> = {
  approved: { badge: "bg-emerald-100 text-emerald-700", label: "Approved" },
  strong: { badge: "bg-green-100 text-green-700", label: "Strong fit" },
  potential: { badge: "bg-amber-100 text-amber-700", label: "Potential" },
  "not-suited": { badge: "bg-slate-100 text-slate-500", label: "Not suited" },
};

function buildStrategyFit(gene: GeneTargetObject): Strategy[] {
  const symbol = gene.geneSymbol || "gene";
  const mb = gene.mutationBreakdown;
  const cds = gene.cdsLength;
  const approved = (gene.fdaApprovedTherapies || []).filter((t) => t.approvalYear);

  const approvedText = approved
    .map((t) => `${t.name ?? ""} ${t.indication ?? ""} ${t.modality ?? ""}`)
    .join(" ")
    .toLowerCase();

  const exonSkipApproved = /exon \d+|exon skipping|exon \d+ skip/.test(approvedText);
  const spliceApproved = /splice|smn|spinal muscular/.test(approvedText);
  const silencingApproved = /aso|sirna|antisense|oligonucleotide/.test(approvedText) &&
    !/exon|splice|smn/.test(approvedText);
  const replacementApproved = /aav|gene therapy|gene replacement|micro-dystrophin|voretigene|onasemnogene/.test(approvedText);
  const editingApproved = /crispr|editing|gene editing/.test(approvedText);

  const strategies: Strategy[] = [];

  if (exonSkipApproved) {
    strategies.push({
      key: "exon-skipping",
      icon: Scissors,
      title: "Exon Skipping (ASO)",
      level: "approved",
      reason: `Already approved for ${symbol} — exon-skipping ASOs restore the reading frame at the deleted/mutated exon.`,
    });
  } else if (mb && (mb.frameshiftMutations || 0) + (mb.largeExonDeletions || 0) > 0) {
    strategies.push({
      key: "exon-skipping",
      icon: Scissors,
      title: "Exon Skipping (ASO)",
      level: "strong",
      reason: `${(mb.frameshiftMutations || 0).toLocaleString()} frameshift and ${(mb.largeExonDeletions || 0).toLocaleString()} large-exon deletions are frame-disrupting — exon-skipping ASOs can restore the reading frame.`,
    });
  } else {
    strategies.push({
      key: "exon-skipping",
      icon: Scissors,
      title: "Exon Skipping (ASO)",
      level: "not-suited",
      reason: "Few frameshift or large-exon-deletion variants reported; limited frame-restoration rationale.",
    });
  }

  if (mb && mb.nonsensePointMutations) {
    strategies.push({
      key: "readthrough",
      icon: Zap,
      title: "Nonsense Readthrough",
      level: "strong",
      reason: `${mb.nonsensePointMutations.toLocaleString()} nonsense mutations — readthrough agents can restore full-length protein from premature stop codons.`,
    });
  } else {
    strategies.push({
      key: "readthrough",
      icon: Zap,
      title: "Nonsense Readthrough",
      level: "not-suited",
      reason: "No significant nonsense-mutation burden detected.",
    });
  }

  if (spliceApproved) {
    strategies.push({
      key: "splice",
      icon: Activity,
      title: "Splice Modulation",
      level: "approved",
      reason: `Already approved for ${symbol} — splice-switching ASOs correct or redirect pre-mRNA splicing.`,
    });
  } else if (mb && mb.spliceSiteMutations) {
    strategies.push({
      key: "splice",
      icon: Activity,
      title: "Splice Modulation",
      level: "potential",
      reason: `${mb.spliceSiteMutations.toLocaleString()} splice-site variants — splice-switching ASOs could correct or redirect splicing.`,
    });
  } else {
    strategies.push({
      key: "splice",
      icon: Activity,
      title: "Splice Modulation",
      level: "not-suited",
      reason: "No significant splice-site mutation burden detected.",
    });
  }

  if (replacementApproved) {
    strategies.push({
      key: "replacement",
      icon: Dna,
      title: "Gene Replacement (AAV)",
      level: "approved",
      reason: `Already approved for ${symbol}${cds && cds > 4700 ? " via an engineered micro-gene (full CDS exceeds AAV capacity)" : ""}.`,
    });
  } else if (cds !== null && cds !== undefined) {
    if (cds <= 4700) {
      strategies.push({
        key: "replacement",
        icon: Dna,
        title: "Gene Replacement (AAV)",
        level: "strong",
        reason: `CDS (~${(cds / 1000).toFixed(1)} kb) fits within AAV ~4.7 kb packaging — single-vector replacement is structurally feasible.`,
      });
    } else {
      strategies.push({
        key: "replacement",
        icon: Dna,
        title: "Gene Replacement (AAV)",
        level: "potential",
        reason: `CDS (~${(cds / 1000).toFixed(1)} kb) exceeds AAV ~4.7 kb capacity — needs a micro-gene, dual/split vectors, or ex-vivo delivery.`,
      });
    }
  } else {
    strategies.push({
      key: "replacement",
      icon: Dna,
      title: "Gene Replacement (AAV)",
      level: "potential",
      reason: "Delivery feasibility depends on CDS length; best suited to recessive loss-of-function disorders.",
    });
  }

  if (editingApproved) {
    strategies.push({
      key: "editing",
      icon: FlaskConical,
      title: "Gene Editing (CRISPR)",
      level: "approved",
      reason: `Already approved for ${symbol} — permanent correction of the underlying DNA sequence.`,
    });
  } else if (mb && Object.values(mb).some((v) => v && v > 0)) {
    strategies.push({
      key: "editing",
      icon: FlaskConical,
      title: "Gene Editing (CRISPR)",
      level: "potential",
      reason: "Recurrent mutation hotspots could be corrected or disrupted with base/prime editors.",
    });
  } else {
    strategies.push({
      key: "editing",
      icon: FlaskConical,
      title: "Gene Editing (CRISPR)",
      level: "potential",
      reason: "Potential for monogenic correction; depends on accessible mutation hotspots.",
    });
  }

  if (silencingApproved) {
    strategies.push({
      key: "silencing",
      icon: Shield,
      title: "Silencing / Knockdown",
      level: "approved",
      reason: `Already approved for ${symbol} — ASO/siRNA reduces the pathogenic transcript.`,
    });
  } else if (gene.essentialGene && /essential/i.test(gene.essentialGene)) {
    strategies.push({
      key: "silencing",
      icon: Shield,
      title: "Silencing / Knockdown",
      level: "not-suited",
      reason: `DepMap marks ${symbol} as Essential — broad knockdown risks toxicity.`,
    });
  } else {
    strategies.push({
      key: "silencing",
      icon: Shield,
      title: "Silencing / Knockdown",
      level: "potential",
      reason: "Best for dominant gain-of-function or dosage-sensitive disorders; verify expression sensitivity.",
    });
  }

  if (gene.haploinsufficiencyScore || gene.loeufDecile || gene.intolerantToLossScore) {
    strategies.push({
      key: "upregulation",
      icon: TrendingUp,
      title: "Upregulation / Activation",
      level: "potential",
      reason: "Constraint data suggest haploinsufficiency — reactivating or upregulating the healthy allele could help.",
    });
  }

  return strategies;
}

export default function GeneTherapyInfoCard({ gene }: { gene: GeneTargetObject }) {
  const symbol = gene.geneSymbol || "Gene";
  const diseaseLabel =
    gene.diseaseName || gene.disease || gene.diseaseAssociation || null;
  const therapies = gene.fdaApprovedTherapies || [];
  const approved = therapies.filter((t) => t.approvalYear);
  const investigational = therapies.filter((t) => !t.approvalYear);
  const hasTherapies = therapies.length > 0;
  const isHuman = (gene.organism ?? "homo_sapiens") === "homo_sapiens";
  const matchedGeneTherapies = APPROVED_GENE_THERAPIES.filter((t) =>
    targetMatches(t.target, symbol),
  );

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r bg-brand/10 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
          <Dna className="h-5 w-5 text-brand" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-bold text-[#0F172A]">
              Gene Therapies &amp; Therapeutic Landscape
            </h2>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10.5px] font-bold text-brand-dark">
              {symbol}
            </span>
            {diseaseLabel && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                {diseaseLabel}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11.5px] text-slate-500">
            Approved and investigational therapies relevant to {symbol}.
          </p>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">

        {/* Gene-specific stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: String(approved.length), label: `FDA-approved therapies relevant to ${symbol}` },
            { value: String(investigational.length), label: `Investigational therapies in clinical trials` },
            gene.clinicalTrialsCount !== null && gene.clinicalTrialsCount !== undefined
              ? { value: gene.clinicalTrialsCount.toLocaleString(), label: `Clinical trials for ${symbol} (ClinicalTrials.gov)` }
              : { value: "6,700+", label: "Clinical trials active or completed (gene/cell/RNA)" },
            gene.cdsLength !== null && gene.cdsLength !== undefined
              ? { value: `~${(gene.cdsLength / 1000).toFixed(1)} kb`, label: `${symbol} CDS length vs ~4.7 kb AAV packaging cap` }
              : { value: "1x", label: "Single-dose correction goal of in vivo therapies" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col justify-center rounded-lg border border-teal-100 bg-teal-50/50 p-3">
              <p className="text-[20px] font-bold text-[#0F172A]">{stat.value}</p>
              <p className="mt-1 text-[10.5px] leading-snug text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Gene-specific approved / investigational therapies */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Approved &amp; Investigational Therapies for {symbol}
            </p>
            {hasTherapies && (
              <p className="text-[10.5px] font-medium text-slate-400">
                {approved.length} approved · {investigational.length} investigational
              </p>
            )}
          </div>

          {hasTherapies ? (
            <div className="space-y-2">
              {approved.map((t) => (
                <div
                  key={`${t.name}-${t.approvalYear}`}
                  className="flex flex-col gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[12px] font-semibold text-slate-800">{t.name}</p>
                      {t.modality && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${modalityTone(t.modality)}`}>
                          {t.modality}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-700">
                        FDA {t.approvalYear}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{t.indication}</p>
                    <TherapyLinksRow t={t} symbol={symbol} />
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">{t.source}</span>
                </div>
              ))}

              {investigational.map((t) => (
                <div
                  key={`${t.name}-investigational`}
                  className="flex flex-col gap-1.5 rounded-xl border border-amber-100 bg-amber-50/30 p-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                    <Clock className="h-4 w-4 text-amber-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[12px] font-semibold text-slate-800">{t.name}</p>
                      {t.modality && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${modalityTone(t.modality)}`}>
                          {t.modality}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-700">
                        Investigational
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{t.indication}</p>
                    <TherapyLinksRow t={t} symbol={symbol} />
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">{t.source}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-[12px] font-medium text-slate-600">
                No FDA-approved or investigational gene/oligonucleotide therapies found for {symbol}
                {isHuman ? "." : " (human gene data only)."}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {gene.fdaMessage || "Check ClinicalTrials.gov for the latest studies on this gene."}
              </p>
            </div>
          )}
        </section>

        {/* Approved therapies table (gene-specific) */}
        {matchedGeneTherapies.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                FDA-Approved Gene &amp; Cell Therapies for {symbol}
              </p>
              <a
                href="https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/approved-cellular-and-gene-therapy-products"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10.5px] font-medium text-brand hover:underline"
              >
                FDA list <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
              <table className="w-full min-w-[640px] text-left text-[11px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Year</th>
                    <th className="px-3 py-2 font-semibold">Therapy</th>
                    <th className="px-3 py-2 font-semibold">Modality / Vector</th>
                    <th className="px-3 py-2 font-semibold">Target</th>
                    <th className="px-3 py-2 font-semibold">Indication</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {matchedGeneTherapies.map((t) => (
                    <tr
                      key={t.name}
                      className={t.target.toLowerCase() === symbol.toLowerCase() ? "bg-teal-50/60" : ""}
                    >
                      <td className="px-3 py-2 font-medium tabular-nums text-slate-400">{t.year}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {t.name}
                        {targetMatches(t.target, symbol) && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-dark">
                            <Sparkles className="h-2.5 w-2.5" /> MATCH
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{t.modality}</td>
                      <td className="px-3 py-2 font-mono text-[10.5px]">{t.target}</td>
                      <td className="px-3 py-2 text-slate-500">{t.indication}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}
