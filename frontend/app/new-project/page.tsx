"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { Card, SectionHeader, FieldLabel } from "@/components/ui";
import OrganismSelect from "@/components/OrganismSelect";
import { createProject } from "@/lib/auth";
import { THERAPEUTIC_GOALS } from "@/types/mechanism";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

const STEPS = [
  "Target Identification",
  "Clinical Goal",
  "Experimental Context",
  "Review & Launch",
];

const ORGANISM_LABELS: Record<string, string> = {
  homo_sapiens: "Human",
  mus_musculus: "Mouse",
  rattus_norvegicus: "Rat",
  danio_rerio: "Zebrafish",
  drosophila_melanogaster: "Fruit Fly",
  caenorhabditis_elegans: "C. elegans",
  saccharomyces_cerevisiae: "Yeast",
  bos_taurus: "Cow",
  sus_scrofa: "Pig",
  gallus_gallus: "Chicken",
  canis_lupus_familiaris: "Dog",
  felis_catus: "Cat",
};

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [organism, setOrganism] = useState("homo_sapiens");
  const [disease, setDisease] = useState("");
  const [geneSymbol, setGeneSymbol] = useState("");
  const [therapeuticGoal, setTherapeuticGoal] = useState("");
  const [cellLine, setCellLine] = useState("");
  const [notes, setNotes] = useState("");

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return therapeuticGoal.trim().length > 0;
    return true;
  };

  useKeyboardShortcut("arrowright", () => {
    if (step < STEPS.length - 1 && canNext()) setStep((s) => s + 1);
  }, { alt: true });
  useKeyboardShortcut("arrowleft", () => {
    if (step > 0) setStep((s) => s - 1);
  }, { alt: true });

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const project = await createProject({
        name,
        description,
        organism,
        disease,
        geneSymbol,
        therapeuticGoal,
        cellLine,
        notes,
      });
      if (project) {
        router.push(`/projects`);
      } else {
        setError("Failed to create project. Please try again.");
      }
    } catch {
      setError("Failed to create project. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
          <FolderPlus className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">New Project</h1>
          <p className="text-[12px] text-slate-500">Start a new therapeutic project</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                i === step
                  ? "bg-brand text-white"
                  : i < step
                  ? "bg-brand/10 text-brand cursor-pointer hover:bg-brand/20"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-6 ${
                  i < step ? "bg-brand/30" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-[12px] font-medium text-slate-500">
          {STEPS[step]}
        </span>
      </div>

      {/* Step 0: Target Identification */}
      {step === 0 && (
        <Card>
          <SectionHeader step="1" title="Target Identification" />
          <div className="px-5 pb-5 space-y-4">
            <div>
              <FieldLabel hint="A descriptive name for your project">
                Project Name <span className="text-red-500">*</span>
              </FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. DMD Exon 51 Skipping"
                className="w-full rounded border border-slate-300 bg-white py-2 px-3 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div>
              <FieldLabel hint="Optional description of the project scope">
                Description
              </FieldLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project goals..."
                rows={3}
                className="w-full rounded border border-slate-300 bg-white py-2 px-3 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel hint="Organism to study">
                  Organism
                </FieldLabel>
                <OrganismSelect value={organism} onChange={setOrganism} />
              </div>
              <div>
                <FieldLabel hint="Disease or condition you are targeting">
                  Disease
                </FieldLabel>
                <input
                  value={disease}
                  onChange={(e) => setDisease(e.target.value)}
                  placeholder="e.g. Duchenne Muscular Dystrophy"
                  className="w-full rounded border border-slate-300 bg-white py-2 px-3 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            <div>
              <FieldLabel hint="Target gene symbol (optional, can add later)">
                Gene Symbol
              </FieldLabel>
              <input
                value={geneSymbol}
                onChange={(e) => setGeneSymbol(e.target.value)}
                placeholder="e.g. DMD"
                className="w-full rounded border border-slate-300 bg-white py-2 px-3 text-[12.5px] font-medium text-slate-700 placeholder:font-normal placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 1: Clinical Goal */}
      {step === 1 && (
        <Card>
          <SectionHeader step="2" title="Clinical Goal" />
          <div className="px-5 pb-5">
            <FieldLabel hint="Select the primary therapeutic mechanism">
              Therapeutic Goal <span className="text-red-500">*</span>
            </FieldLabel>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {THERAPEUTIC_GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setTherapeuticGoal(g.name)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    therapeuticGoal === g.name
                      ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                      : "border-[#E5E7EB] hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-[12.5px] font-semibold text-slate-800">
                    {g.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    {g.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Experimental Context */}
      {step === 2 && (
        <Card>
          <SectionHeader step="3" title="Experimental Context" />
          <div className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel hint="Primary cell line for validation">
                  Cell Line
                </FieldLabel>
                <input
                  value={cellLine}
                  onChange={(e) => setCellLine(e.target.value)}
                  placeholder="e.g. HEK293, iPSC-derived myocytes"
                  className="w-full rounded border border-slate-300 bg-white py-2 px-3 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            <div>
              <FieldLabel hint="Additional notes, hypotheses, or references">
                Notes
              </FieldLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional context for this project..."
                rows={4}
                className="w-full rounded border border-slate-300 bg-white py-2 px-3 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Review & Launch */}
      {step === 3 && (
        <Card>
          <SectionHeader step="4" title="Review & Launch" />
          <div className="px-5 pb-5">
            <div className="rounded-lg border border-[#E5E7EB] bg-slate-50 p-4 space-y-3">
              <ReviewRow label="Project" value={name || "(unnamed)"} />
              <ReviewRow label="Description" value={description || "—"} />
              <ReviewRow
                label="Organism"
                value={ORGANISM_LABELS[organism] || organism}
              />
              <ReviewRow label="Disease" value={disease || "—"} />
              <ReviewRow label="Gene" value={geneSymbol || "—"} />
              <ReviewRow label="Therapeutic Goal" value={therapeuticGoal || "—"} />
              <ReviewRow label="Cell Line" value={cellLine || "—"} />
              {notes && (
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Notes</p>
                  <p className="text-[12.5px] text-slate-700 whitespace-pre-wrap">{notes}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-4 py-2 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex items-center gap-1.5 rounded bg-brand px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="flex items-center gap-1.5 rounded bg-brand px-5 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderPlus className="h-3.5 w-3.5" />
            )}
            {submitting ? "Creating..." : "Create Project"}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-[11px] font-medium text-slate-400 shrink-0">{label}</p>
      <p className="text-[12.5px] text-slate-700 text-right">{value}</p>
    </div>
  );
}
