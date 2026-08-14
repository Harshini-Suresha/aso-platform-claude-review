"use client";

import { Dna, ExternalLink, Star } from "lucide-react";
import { Card } from "./ui";
import InfoTooltip from "./InfoTooltip";
import { GeneTargetObject, TopVariant } from "@/types/gene";

function significanceTone(sig: string): string {
  const lower = sig.toLowerCase();
  if (lower.includes("pathogenic")) return "bg-red-50 text-red-700";
  if (lower.includes("likely pathogenic")) return "bg-orange-50 text-orange-700";
  if (lower.includes("benign")) return "bg-emerald-50 text-emerald-700";
  if (lower.includes("uncertain")) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < count ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
        />
      ))}
    </span>
  );
}

export default function TopVariantsCard({ gene }: { gene: GeneTargetObject }) {
  const variants = Array.isArray(gene.topVariants) ? gene.topVariants : [];
  const symbol = gene.geneSymbol || "Gene";
  const clinvarUrl = gene.deepLinks?.clinvar || `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(symbol + "[gene]")}`;

  if (!Array.isArray(gene.topVariants) || gene.topVariants.length === 0) {
    return (
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r bg-rose-500/10 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
            <Dna className="h-5 w-5 text-rose-500" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold text-[#0F172A]">Top 10 Variants</h2>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">{symbol}</span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-500">ClinVar pathogenic / likely-pathogenic variants ranked by review status.</p>
          </div>
          <a href={clinvarUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[10.5px] font-medium text-brand transition-colors hover:border-indigo-300 hover:text-indigo-800">
            ClinVar <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <div className="px-5 py-6 text-center">
          <p className="text-[12px] text-slate-500">No ClinVar pathogenic / likely-pathogenic variants available for {symbol}.</p>
          <p className="mt-1 text-[11px] text-slate-400">Data may be unavailable for non-human genes or genes without ClinVar submissions.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r bg-rose-500/10 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
          <Dna className="h-5 w-5 text-rose-500" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-bold text-[#0F172A]">
              Top 10 Variants
            </h2>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">
              {symbol}
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-slate-500">
            ClinVar pathogenic / likely-pathogenic variants ranked by review status.
          </p>
        </div>
        <a
          href={clinvarUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[10.5px] font-medium text-brand transition-colors hover:border-indigo-300 hover:text-indigo-800"
        >
          ClinVar <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[720px] text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2 font-semibold w-8">#</th>
              <th className="px-2 py-2 font-semibold">HGVS (c.DNA)</th>
              <th className="px-2 py-2 font-semibold">HGVS (Protein)</th>
              <th className="px-2 py-2 font-semibold">rsID</th>
              <th className="px-2 py-2 font-semibold">Clinical Significance</th>
              <th className="px-2 py-2 font-semibold text-center">
                Stars
                <InfoTooltip
                  title="ClinVar Review Stars"
                  content="★☆☆☆☆ No assertion criteria | ★★☆☆☆ Single submitter | ★★★☆☆ Multiple submitters, conflicting | ★★★★☆ Multiple submitters, same interpretation | ★★★★★ Expert panel review"
                  className="ml-1"
                />
              </th>
              <th className="px-2 py-2 font-semibold text-right">
                Allele Freq
                <InfoTooltip
                  title="Allele Frequency"
                  content="Population allele frequency from gnomAD exome data. Shows — when the variant is not catalogued in gnomAD."
                  className="ml-1"
                  side="left"
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {variants.map((v: TopVariant, idx: number) => (
              <tr key={`${v.variantId}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-2 py-2.5 font-semibold text-slate-400 tabular-nums">{idx + 1}</td>
                <td className="px-2 py-2.5 font-mono text-[10.5px] text-slate-700">
                  {v.hgvsc || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-2 py-2.5 font-mono text-[10.5px] text-slate-700">
                  {v.hgvsp || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-2 py-2.5 font-mono text-[10.5px] text-slate-700">
                  {v.rsid ? (
                    <a
                      href={`https://www.ncbi.nlm.nih.gov/snp/${v.rsid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:underline"
                    >
                      {v.rsid}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${significanceTone(v.clinicalSignificance)}`}>
                    {v.clinicalSignificance || "—"}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <Stars count={v.goldStars} />
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                  {v.alleleFrequency !== null ? `${(v.alleleFrequency * 100).toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
