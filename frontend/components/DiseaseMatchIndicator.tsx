"use client";

import { CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { GeneTargetObject } from "@/types/gene";

interface Props {
  enteredDisease: string;
  gene: GeneTargetObject;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function diseaseMatches(entered: string, candidate: string): boolean {
  if (!entered || !candidate) return false;
  const a = normalize(entered);
  const b = normalize(candidate);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export default function DiseaseMatchIndicator({ enteredDisease, gene }: Props) {
  const entered = enteredDisease.trim();
  if (!entered) return null;

  const geneDiseases: string[] = [];

  if (gene.diseaseAssociation) geneDiseases.push(gene.diseaseAssociation);
  if (gene.phenotypes) geneDiseases.push(...gene.phenotypes);
  if (gene.clinicalProfileAnnotations) {
    for (const ann of gene.clinicalProfileAnnotations) {
      if (ann.description) geneDiseases.push(ann.description);
    }
  }
  if (gene.orphanetDiseaseNames) geneDiseases.push(...gene.orphanetDiseaseNames);

  const uniqueDiseases = [...new Set(geneDiseases.filter(Boolean))];

  if (uniqueDiseases.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-1.5 text-[11px] text-slate-400">
        <MinusCircle className="h-3 w-3 shrink-0" />
        No disease association data available for this gene to cross-check against.
      </div>
    );
  }

  const matched = uniqueDiseases.some((d) => diseaseMatches(entered, d));

  if (matched) {
    const matchedName = uniqueDiseases.find((d) => diseaseMatches(entered, d));
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-[11px] text-green-700">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        <span>
          &ldquo;{entered}&rdquo; matches fetched association &ldquo;{matchedName}&rdquo;
        </span>
      </div>
    );
  }

  const sources = gene.diseaseAssociationSource?.join(", ") || "fetched data";

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>
          &ldquo;{entered}&rdquo; was not found among this gene&apos;s fetched associations ({sources}).
        </span>
      </div>
      <p className="mt-1 text-[10px] text-amber-500">
        Found: {uniqueDiseases.slice(0, 5).join(", ")}
        {uniqueDiseases.length > 5 && ` (+${uniqueDiseases.length - 5} more)`}
      </p>
    </div>
  );
}
