"use client";

import { useMemo } from "react";
import { ExternalLink, Star, AlertCircle, Check } from "lucide-react";
import { ClinVarVariant } from "@/types/geneSilencing";
import { Card, FieldLabel } from "./ui";

/**
 * Filter ClinVar variants by editing modality compatibility.
 *
 * A-to-I editing: requires G>A transitions (adenine-to-inosine reads as A→G)
 * C-to-U editing: requires T>C transitions (cytidine-to-uridine)
 * Trans-splicing: no base restriction — show all variants
 */
function filterByModality(variants: ClinVarVariant[], editType: string): ClinVarVariant[] {
  if (!editType || editType === "trans_splicing") return variants;

  return variants.filter((v) => {
    const hgvs = (v.hgvsc || "").toUpperCase();
    if (editType === "a_to_i") {
      return hgvs.includes("G>A");
    }
    if (editType === "c_to_u") {
      return hgvs.includes("T>C");
    }
    return true;
  });
}

/**
 * Validate custom HGVS format.
 * Accepts: c.XXXX>X, g.XXXX>X, n.XXXX>X (simple substitutions only)
 */
function validateHgvsFormat(hgvs: string): { valid: boolean; error?: string } {
  const trimmed = hgvs.trim();
  if (!trimmed) return { valid: false, error: "Enter a variant in HGVS notation" };

  // Match patterns like: c.82G>A, g.12345C>T, n.100A>G, NC_000023.11:g.33038228C>T
  const pattern = /^(NC_\d+\.\d+[:_])?[cgn]\.\d+[A-Z]>[A-Z]$/i;
  if (!pattern.test(trimmed)) {
    return {
      valid: false,
      error: "Format: c.XXX>X or g.XXX>X (e.g., c.82G>A, g.12345C>T)",
    };
  }

  return { valid: true };
}

/**
 * Check if a custom variant is compatible with the selected editing modality.
 */
function checkModalityCompat(hgvs: string, editType: string): { compatible: boolean; note?: string } {
  if (!editType || editType === "trans_splicing") {
    return { compatible: true, note: "Trans-splicing accepts any variant" };
  }

  const upper = hgvs.toUpperCase();
  if (editType === "a_to_i") {
    if (upper.includes("G>A")) {
      return { compatible: true, note: "Compatible with A-to-I editing (G>A transition)" };
    }
    return {
      compatible: false,
      note: "A-to-I editing requires a G>A transition (adenine at edit position)",
    };
  }
  if (editType === "c_to_u") {
    if (upper.includes("T>C")) {
      return { compatible: true, note: "Compatible with C-to-U editing (T>C transition)" };
    }
    return {
      compatible: false,
      note: "C-to-U editing requires a T>C transition (cytidine at edit position)",
    };
  }

  return { compatible: true };
}

export default function RnaEditingVariantSelector({
  variants,
  editType,
  selectedVariant,
  customVariant,
  useCustom,
  onSelectVariant,
  onCustomVariantChange,
  onToggleCustom,
}: {
  variants: ClinVarVariant[];
  editType: string;
  selectedVariant: ClinVarVariant | null;
  customVariant: string;
  useCustom: boolean;
  onSelectVariant: (v: ClinVarVariant | null) => void;
  onCustomVariantChange: (v: string) => void;
  onToggleCustom: (useCustom: boolean) => void;
}) {
  const filteredVariants = useMemo(
    () => filterByModality(variants, editType),
    [variants, editType],
  );

  const hgvsValidation = useMemo(
    () => (useCustom ? validateHgvsFormat(customVariant) : { valid: true }),
    [useCustom, customVariant],
  );

  const modalityCompat = useMemo(
    () => (useCustom && hgvsValidation.valid ? checkModalityCompat(customVariant, editType) : null),
    [useCustom, customVariant, editType, hgvsValidation.valid],
  );

  const hasVariants = filteredVariants.length > 0;
  const isModalityFiltered = editType && editType !== "trans_splicing" && variants.length !== filteredVariants.length;

  return (
    <div className="space-y-3">
      {/* Toggle: ClinVar vs Custom */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="variantSource"
            checked={!useCustom}
            onChange={() => onToggleCustom(false)}
            className="h-3.5 w-3.5 text-brand border-slate-300 focus:ring-brand/20"
          />
          <span className="text-[12.5px] text-slate-600">Select from ClinVar</span>
          {variants.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {filteredVariants.length}/{variants.length}
            </span>
          )}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="variantSource"
            checked={useCustom}
            onChange={() => onToggleCustom(true)}
            className="h-3.5 w-3.5 text-brand border-slate-300 focus:ring-brand/20"
          />
          <span className="text-[12.5px] text-slate-600">Enter custom variant</span>
        </label>
      </div>

      {/* Modality filter note */}
      {isModalityFiltered && !useCustom && (
        <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-brand shrink-0" />
          <p className="text-[11.5px] text-brand-dark">
             Showing {filteredVariants.length} of {variants.length} variants compatible with{" "}
             {editType === "a_to_i" ? "A-to-I" : "C-to-U"} editing
             {editType === "a_to_i" ? " (G>A transitions)" : " (T>C transitions)"}
          </p>
        </div>
      )}

      {/* ClinVar variant table */}
      {!useCustom && (
        <div className="space-y-2">
          {!hasVariants && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-[12px] text-slate-400">
                {variants.length === 0
                  ? "No ClinVar pathogenic variants found for this gene yet."
                  : `No variants compatible with ${editType === "a_to_i" ? "A-to-I" : "C-to-U"} editing found.`}
              </p>
            </div>
          )}

          {hasVariants && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-slate-600">
                  Pathogenic variants ({filteredVariants.length})
                </p>
                {selectedVariant && (
                  <button
                    onClick={() => onSelectVariant(null)}
                    className="text-[11px] font-medium text-brand hover:text-brand-dark transition-colors"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <div className="max-h-[280px] overflow-y-auto rounded-lg border border-[#E5E7EB] card-scroll">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Variant</th>
                      <th className="px-3 py-2">HGVS (Coding)</th>
                      <th className="px-3 py-2 text-center">Stars</th>
                      <th className="px-3 py-2">rsID</th>
                      <th className="px-3 py-2 text-right">Freq</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVariants.map((v) => {
                      const isSelected = selectedVariant?.variantId === v.variantId;
                      return (
                        <tr
                          key={v.variantId}
                          onClick={() => onSelectVariant(isSelected ? null : v)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-brand/5" : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              isSelected ? "text-brand" : "text-slate-700"
                            }`}>
                              {isSelected && (
                                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                              )}
                              {v.variantId}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-600">
                            {v.hgvsc || "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {v.goldStars > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {v.goldStars}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-500">
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
                          <td className="px-3 py-2 text-right text-[11px] text-slate-500">
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
                <div className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2">
                  <p className="text-[11.5px] font-medium text-brand">
                    Selected: {selectedVariant.hgvsc || selectedVariant.variantId}
                  </p>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">
                    {selectedVariant.hgvsp && `${selectedVariant.hgvsp} · `}
                    {selectedVariant.rsid && `${selectedVariant.rsid} · `}
                    {selectedVariant.clinicalSignificance}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Custom variant input */}
      {useCustom && (
        <div className="space-y-2">
          <input
            value={customVariant}
            onChange={(e) => onCustomVariantChange(e.target.value)}
            placeholder="e.g. c.82G>A"
            className={`w-full rounded-lg border bg-white py-2.5 px-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 ${
              customVariant && !hgvsValidation.valid
                ? "border-red-300 focus:border-red-400"
                : customVariant && hgvsValidation.valid
                  ? "border-emerald-300 focus:border-emerald-400"
                  : "border-slate-300 focus:border-brand"
            }`}
          />

          {/* Validation feedback */}
          {customVariant && !hgvsValidation.valid && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-600">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {hgvsValidation.error}
            </div>
          )}

          {customVariant && hgvsValidation.valid && modalityCompat && (
            <div className={`flex items-center gap-1.5 text-[11px] ${
              modalityCompat.compatible ? "text-emerald-600" : "text-amber-600"
            }`}>
              {modalityCompat.compatible ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <AlertCircle className="h-3 w-3 shrink-0" />
              )}
              {modalityCompat.note}
            </div>
          )}

          <p className="text-[10.5px] text-slate-400">
            Format: c.XXX{">"}X or g.XXX{">"}X (substitutions only). Example: c.82G{">"}A, g.12345C{">"}T
          </p>
        </div>
      )}
    </div>
  );
}
