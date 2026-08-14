"use client";

import { CheckCircle2, XCircle, Ban, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { RankedMechanism } from "@/types/mechanism";
import { Card, Pill } from "./ui";

const EVIDENCE_TONE: Record<string, "green" | "blue" | "amber" | "slate"> = {
  "Very High": "green",
  High: "green",
  Moderate: "blue",
  "Low–Moderate": "amber",
  Low: "amber",
};

function deliveryFitCopy(mechanism: RankedMechanism): string | null {
  if (mechanism.deliveryTier == null) return null;
  switch (mechanism.deliveryTier) {
    case "approved":
      return `Delivery fit: Approved precedent — ${mechanism.deliveryCitation ?? ""}`;
    case "trial":
      return `Delivery fit: Clinical trial precedent — ${mechanism.deliveryCitation ?? ""}`;
    case "contraindicated":
      return `Delivery fit: Documented barrier against this route — ${mechanism.deliveryCitation ?? ""}`;
    default:
      return "Delivery fit: No established precedent for this combination";
  }
}

export default function MechanismCard({
  mechanism,
  selected,
  onSelect,
}: {
  mechanism: RankedMechanism;
  selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [scoreHelpOpen, setScoreHelpOpen] = useState(false);
  const [evidenceHelpOpen, setEvidenceHelpOpen] = useState(false);
  const rating = mechanism.evidenceLevel?.rating ?? null;
  const tone = rating ? EVIDENCE_TONE[rating] ?? "slate" : "slate";

  return (
    <Card className={selected ? "ring-2 ring-brand" : ""}>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">{mechanism.id}</span>
              {!mechanism.designable ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                  <Ban className="h-3 w-3" />
                  Not designable in this pipeline
                </span>
              ) : mechanism.eligible ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Eligible
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <XCircle className="h-3 w-3" />
                  Poor fit
                </span>
              )}
              <span className="relative inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                Contextual fit: {mechanism.score}
                <button
                  type="button"
                  onClick={() => setScoreHelpOpen((open) => !open)}
                  onBlur={() => setScoreHelpOpen(false)}
                  aria-label="Explain contextual fit score"
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 text-[9px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
                >
                  ?
                </button>
                {scoreHelpOpen && (
                  <span role="tooltip" className="absolute left-0 top-5 z-20 w-64 rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-slate-600 shadow-md">
                    A rule-based fit score for the options selected here, such as therapeutic goal, defect type, scope, and chemistry. It is not a percentage, probability, or evidence rating, and it does not drive ranking — mechanisms are ordered first by real evidence level, then delivery precedent.
                  </span>
                )}
              </span>
              {rating && (
                <span className="relative inline-flex items-center gap-1">
                  <Pill tone={tone}>{rating} evidence</Pill>
                  <button
                    type="button"
                    onClick={() => setEvidenceHelpOpen((open) => !open)}
                    onBlur={() => setEvidenceHelpOpen(false)}
                    aria-label="Explain evidence rating"
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 text-[9px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
                  >
                    ?
                  </button>
                  {evidenceHelpOpen && (
                    <span role="tooltip" className="absolute left-0 top-5 z-20 w-64 rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-600 shadow-md">
                      Evidence reflects the strength of published and clinical support for this mechanism in general. It is independent of the contextual fit score.
                    </span>
                  )}
                </span>
              )}
            </div>
            <h3 className="mt-1 text-[15px] font-semibold text-slate-800">{mechanism.name}</h3>
            {mechanism.category && (
              <p className="text-[12.5px] text-slate-500">{mechanism.category}</p>
            )}
          </div>
          <button
            onClick={onSelect}
            disabled={!mechanism.designable}
            title={!mechanism.designable ? "This mechanism requires a double-stranded siRNA duplex and cannot be generated by the single-stranded ASO designer." : undefined}
            className={`shrink-0 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
              selected
                ? "bg-brand text-white"
                : !mechanism.designable
                  ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {selected ? "Selected" : !mechanism.designable ? "Not designable" : "Select"}
          </button>
        </div>

        <ul className="space-y-1">
          {mechanism.rationale
            .filter((r) => !r.startsWith("Delivery fit:"))
            .map((r, i) => (
              <li key={i} className="text-[12.5px] text-slate-600 leading-snug">
                • {r}
              </li>
            ))}
        </ul>

        {deliveryFitCopy(mechanism) && (
          <div
            className={`rounded-lg border px-3 py-2 ${
              mechanism.deliveryTier === "unestablished"
                ? "border-slate-200 bg-slate-50"
                : mechanism.deliveryTier === "contraindicated"
                  ? "border-red-200 bg-red-50"
                  : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <p
              className={`text-[12px] leading-snug ${
                mechanism.deliveryTier === "unestablished"
                  ? "text-slate-500"
                  : mechanism.deliveryTier === "contraindicated"
                    ? "text-red-600"
                    : "text-emerald-700"
              }`}
            >
              {deliveryFitCopy(mechanism)}
            </p>
          </div>
        )}

        {formatFdaDrugs(mechanism.fdaApprovedDrugs) && (
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-400">FDA-approved precedent</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {formatFdaDrugs(mechanism.fdaApprovedDrugs)!.map((drug) => (
                <span
                  key={drug}
                  className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                >
                  {drug}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-[12.5px] font-medium text-brand"
        >
          {expanded ? "Hide details" : "Show design details"}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {expanded && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <Detail label="Suitable variant types" value={mechanism.suitableVariantTypes} />
            <Detail label="RNA target region" value={mechanism.rnaTargetRegion} />
            <Detail label="ASO chemistry" value={mechanism.asoChemistry} />
            <Detail label="Design rules" value={mechanism.designRules} />
            <Detail label="Scoring" value={mechanism.scoring} />
            <Detail label="Advantages" value={mechanism.advantages} />
            <Detail label="Limitations" value={mechanism.limitations} />
            <Detail label="Off-target considerations" value={mechanism.offTargetConsiderations} />
            {mechanism.references.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400 mb-1">References</p>
                <ul className="space-y-1">
                  {mechanism.references.map((ref) => (
                    <li key={ref.refId} className="text-[11.5px] text-slate-500">
                      {ref.paper}
                      {ref.doi && (
                        <a
                          href={`https://doi.org/${ref.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1 text-brand hover:underline"
                        >
                          DOI
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-[12.5px] text-slate-700 leading-snug">{value}</p>
    </div>
  );
}

// Parse FDA-approved drugs from the raw string, filtering out non-drug values
function formatFdaDrugs(raw: string | null): string[] | null {
  if (!raw) return null;

  // Filter out "None" variants
  const cleaned = raw.trim().replace(/\.$/, "");
  const nonePatterns = [
    /^none$/i,
    /^none\s+\(/i,
    /^none identified/i,
    /^not applicable/i,
    /^n\/a$/i,
  ];
  if (nonePatterns.some((p) => p.test(cleaned))) return null;

  // Split semicolon-separated drug names
  const drugs = raw
    .split(/;/)
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  if (drugs.length === 0) return null;
  return drugs;
}
