"use client";

import { Loader2, ExternalLink, Star } from "lucide-react";
import { ClinVarVariant } from "@/types/geneSilencing";
import { Card, SectionHeader } from "./ui";

export default function AlleleSelector({
  variants,
  selectedVariant,
  onSelectVariant,
}: {
  variants: ClinVarVariant[];
  selectedVariant: ClinVarVariant | null;
  onSelectVariant: (v: ClinVarVariant | null) => void;
}) {
  const hasVariants = variants.length > 0;

  return (
    <Card>
      <SectionHeader step="1b" title="Allele-Specific Targeting (Optional)" />
      <div className="px-6 pb-5 space-y-3">
        <p className="text-[12px] text-slate-500 leading-relaxed">
          For allele-specific silencing, select a pathogenic variant below. The ASO will be
          designed to selectively target the mutant allele while sparing the wild-type transcript.
          This is optional — you can skip it and proceed with exon-based targeting.
        </p>

        {!hasVariants && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <p className="text-[12px] text-slate-400">
              No ClinVar pathogenic variants found for this gene yet, or the lookup is still loading.
            </p>
          </div>
        )}

        {hasVariants && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-medium text-slate-600">
                Pathogenic variants ({variants.length})
              </p>
              {selectedVariant && (
                <button
                  onClick={() => onSelectVariant(null)}
                  className="text-[11.5px] font-medium text-brand hover:text-brand-dark transition-colors"
                >
                  Clear selection
                </button>
              )}
            </div>

            <div className="max-h-[320px] overflow-y-auto rounded-lg border border-[#E5E7EB] card-scroll">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Variant</th>
                    <th className="px-3 py-2">HGVS (Protein)</th>
                    <th className="px-3 py-2">HGVS (Coding)</th>
                    <th className="px-3 py-2 text-center">Stars</th>
                    <th className="px-3 py-2">rsID</th>
                    <th className="px-3 py-2 text-right">Freq</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {variants.map((v) => {
                    const isSelected = selectedVariant?.variantId === v.variantId;
                    return (
                      <tr
                        key={v.variantId}
                        onClick={() => onSelectVariant(isSelected ? null : v)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-brand/5"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium ${
                            isSelected ? "text-brand" : "text-slate-700"
                          }`}>
                            {isSelected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                            )}
                            {v.variantId}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-slate-600">
                          {v.hgvsp || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-slate-600">
                          {v.hgvsc || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {v.goldStars > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {v.goldStars}
                            </span>
                          )}
                          {v.goldStars === 0 && (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-slate-500">
                          {v.rsid ? (
                            <a
                              href={`https://www.ncbi.nlm.nih.gov/snp/${v.rsid}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 hover:text-brand hover:underline"
                            >
                              {v.rsid}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[11.5px] text-slate-500">
                          {v.alleleFrequency != null
                            ? v.alleleFrequency < 0.001
                              ? v.alleleFrequency.toExponential(1)
                              : v.alleleFrequency.toFixed(4)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedVariant && (
              <div className="rounded-lg border border-brand/20 bg-brand/5 px-4 py-3">
                <p className="text-[12px] font-medium text-brand">
                  Selected: {selectedVariant.hgvsp || selectedVariant.variantId}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedVariant.hgvsc && `${selectedVariant.hgvsc} · `}
                  {selectedVariant.rsid && `${selectedVariant.rsid} · `}
                  {selectedVariant.clinicalSignificance}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
