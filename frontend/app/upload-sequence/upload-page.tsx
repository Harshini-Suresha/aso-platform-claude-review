"use client";

import { useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader, Pill } from "@/components/ui";
import GcContentChart from "@/components/GcContentChart";
import NucleotideCompositionChart from "@/components/NucleotideCompositionChart";
import SequenceTrackViewer from "@/components/SequenceTrackViewer";
import ExportMenu from "@/components/ExportMenu";
import { validateSequence, analyzeSequence } from "@/lib/uploadApi";
import type { ValidateResponse, AnalyzeResponse, Modality } from "@/types/upload-types";

const MODALITIES: { id: Modality; label: string }[] = [
  { id: "aso", label: "ASO (antisense oligonucleotide)" },
  { id: "sirna", label: "siRNA" },
  { id: "mrna", label: "mRNA" },
  { id: "sgrna", label: "sgRNA / CRISPR" },
];

function riskTone(risk: string): "green" | "amber" | "blue" {
  if (risk === "High") return "amber";
  if (risk === "Low") return "green";
  return "blue";
}

export default function UploadSequencePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawInput, setRawInput] = useState("");
  const [filename, setFilename] = useState<string | null>(null);

  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);

  const [modality, setModality] = useState<Modality>("aso");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawInput(text);
    setFilename(file.name);
    setValidation(null);
    setAnalysis(null);
  }

  async function handleValidate() {
    if (!rawInput.trim()) return;
    setValidating(true);
    setValidateError(null);
    setValidation(null);
    setAnalysis(null);
    try {
      const result = await validateSequence(rawInput, filename);
      setValidation(result);
      if (!result.valid) {
        setValidateError(result.error ?? "Sequence contains invalid characters.");
      }
    } catch (err) {
      setValidateError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  }

  async function handleAnalyze() {
    if (!validation?.valid || !validation.sequence) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    try {
      const result = await analyzeSequence(validation.sequence, modality);
      setAnalysis(result);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleClear() {
    setRawInput("");
    setFilename(null);
    setValidation(null);
    setValidateError(null);
    setAnalysis(null);
    setAnalyzeError(null);
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-5 px-6 py-6">
          {/* Input */}
          <Card>
            <SectionHeader step="1" title="Upload or Paste a Sequence" />
            <div className="space-y-3 px-6 pb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload FASTA / text file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".fasta,.fa,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {filename && (
                  <span className="flex items-center gap-1 text-[12.5px] text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                    {filename}
                  </span>
                )}
                <span className="text-[12.5px] text-slate-400">or paste below</span>
              </div>

              <textarea
                value={rawInput}
                onChange={(e) => {
                  setRawInput(e.target.value);
                  setValidation(null);
                  setAnalysis(null);
                }}
                placeholder=">my_sequence&#10;ATGCGTACGTTAGC..."
                rows={6}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />

              <div className="flex items-center justify-between">
                <button
                  onClick={handleClear}
                  className="text-[12.5px] font-medium text-slate-500 hover:text-slate-700"
                >
                  Clear
                </button>
                <button
                  onClick={handleValidate}
                  disabled={!rawInput.trim() || validating}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {validating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {validating ? "Validating..." : "Validate Sequence"}
                </button>
              </div>
            </div>
          </Card>

          {validateError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <XCircle className="h-4 w-4 shrink-0" />
              {validateError}
            </div>
          )}

          {/* Validation results */}
          {validation?.valid && (
            <Card>
              <SectionHeader
                step="2"
                title="Validation Results"
                right={
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Valid
                  </span>
                }
              />
              <div className="grid grid-cols-2 gap-4 px-6 pb-5 md:grid-cols-4">
                <Stat label="Sequence Type" value={validation.sequenceType?.toUpperCase() ?? "—"} />
                <Stat label="Length" value={`${validation.length ?? "—"} nt`} />
                <Stat label="GC Content" value={`${validation.gcContent ?? "—"}%`} />
                <Stat
                  label="Flags"
                  value={
                    [
                      validation.hasPolyA && "Poly-A",
                      validation.hasPolyG && "Poly-G",
                    ]
                      .filter(Boolean)
                      .join(", ") || "None"
                  }
                />
              </div>

              {validation.features && validation.features.length > 0 && (
                <div className="border-t border-slate-100 px-6 py-3">
                  <p className="mb-1.5 text-[11px] font-medium text-slate-400">Features</p>
                  <ul className="space-y-1">
                    {validation.features.map((f, i) => (
                      <li key={i} className="text-[12.5px] text-slate-600">
                        • {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.orfs && validation.orfs.length > 0 && (
                <div className="border-t border-slate-100 px-6 py-3">
                  <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                    Open Reading Frames ({validation.orfs.length} found, both strands)
                  </p>
                  <div className="space-y-1">
                    {validation.orfs.map((orf, i) => (
                      <div key={i} className="flex items-center gap-3 text-[12px] text-slate-600">
                        <Pill tone="blue">{orf.strand} strand</Pill>
                        <span>Frame {orf.frame}</span>
                        <span>
                          {orf.start}–{orf.end}
                        </span>
                        <span>{orf.proteinLength} aa</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modality selection + analyze */}
              <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-slate-500">
                    Analyze as therapeutic modality
                  </p>
                  <select
                    value={modality}
                    onChange={(e) => setModality(e.target.value as Modality)}
                    className="rounded-lg border border-slate-300 bg-white py-2 px-3 text-[13px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {MODALITIES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {analyzing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {analyzing ? "Analyzing..." : "Run Analysis"}
                </button>
              </div>
            </Card>
          )}

          {analyzeError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <XCircle className="h-4 w-4 shrink-0" />
              {analyzeError}
            </div>
          )}

          {/* Analysis results */}
          {analysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-slate-500">
                  Analysis for {analysis.length} nt sequence, analyzed as{" "}
                  {MODALITIES.find((m) => m.id === modality)?.label}.
                </p>
                {validation && validation.sequence && (
                  <ExportMenu
                    sequence={validation.sequence}
                    validation={validation}
                    analysis={analysis}
                    modalityName={MODALITIES.find((m) => m.id === modality)?.label ?? modality}
                  />
                )}
              </div>

              {/* Sequence track — real positions, not just counts */}
              <Card className="p-5">
                <p className="text-[13px] font-semibold text-slate-800">Sequence Map</p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Hover any marker for details. Positions are exact, computed from the real sequence.
                </p>
                <div className="mt-4">
                  <SequenceTrackViewer
                    seqLength={analysis.length}
                    orfs={analysis.orfs}
                    immuneHits={analysis.immuneScreen}
                    palindromePositions={analysis.secondaryStructure.palindromePositions}
                    restrictionSites={analysis.restrictionSites}
                    mirnaTargets={analysis.mirnaTargets}
                    grnaCandidates={analysis.grnaCandidates ?? []}
                  />
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* GC content curve */}
                <Card className="p-5">
                  <p className="text-[13px] font-semibold text-slate-800">GC Content Along Sequence</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    10 nt sliding window · shaded band = typical optimal range (30–70%)
                  </p>
                  <div className="mt-3">
                    <GcContentChart data={analysis.gcCurve} seqLength={analysis.length} />
                  </div>
                </Card>

                {/* Nucleotide composition */}
                {analysis.sequenceType !== "protein" && (
                  <Card className="p-5">
                    <p className="text-[13px] font-semibold text-slate-800">Nucleotide Composition</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">Real base counts from the sequence</p>
                    <div className="mt-4">
                      <NucleotideCompositionChart composition={analysis.composition} />
                    </div>
                  </Card>
                )}
              </div>

              {/* Modality-specific recommendations */}
              <Card className="p-5">
                <p className="text-[13px] font-semibold text-slate-800">
                  {MODALITIES.find((m) => m.id === modality)?.label} Design Recommendations
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  {analysis.modality.recommendedChemistry && (
                    <Stat label="Recommended Chemistry" value={analysis.modality.recommendedChemistry} />
                  )}
                  {analysis.modality.optimalLength && (
                    <Stat label="Optimal Length" value={analysis.modality.optimalLength} />
                  )}
                  {analysis.modality.casProtein && (
                    <Stat label="Cas Protein" value={analysis.modality.casProtein} />
                  )}
                  {analysis.modality.strand && (
                    <Stat label="Strand" value={analysis.modality.strand} />
                  )}
                </div>
                {analysis.modality.recommendations && analysis.modality.recommendations.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                    {analysis.modality.recommendations.map((r, i) => (
                      <li key={i} className="text-[12.5px] text-slate-600">
                        • {r}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Specificity heuristic — clearly not a real off-target screen */}
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-slate-800">Specificity Heuristic</p>
                    <Pill tone={riskTone(analysis.offTarget.lengthBasedRiskEstimate)}>
                      {analysis.offTarget.lengthBasedRiskEstimate}
                    </Pill>
                  </div>
                  <p className="mt-1.5 text-[12px] text-slate-500">{analysis.offTarget.note}</p>
                  <p className="mt-2 text-[12px] text-slate-500">
                    Internal repetitiveness: {analysis.offTarget.internalRepetitiveness}
                  </p>
                  <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {analysis.offTarget.disclaimer}
                  </div>
                </Card>

                {/* Secondary structure estimate */}
                <Card className="p-5">
                  <p className="text-[13px] font-semibold text-slate-800">Secondary Structure (Estimated)</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Stat label="Est. MFE" value={`${analysis.secondaryStructure.estimatedMfe} kcal/mol`} />
                    <Stat label="Hairpin Risk" value={analysis.secondaryStructure.hairpinRisk} />
                    <Stat label="Palindromic Regions" value={String(analysis.secondaryStructure.palindromicRegions)} />
                    <Stat label="GC Content" value={`${analysis.secondaryStructure.gcContent}%`} />
                  </div>
                  <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Simplified GC/AU-composition estimate, not a real folding prediction (e.g. RNAfold). Treat as a rough proxy only.
                  </div>
                </Card>
              </div>

              {/* Immune motif screen */}
              <Card className="p-5">
                <p className="text-[13px] font-semibold text-slate-800">Innate-Immune Sensing Pattern Check</p>
                {analysis.immuneScreen.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {analysis.immuneScreen.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 text-[12.5px] text-slate-600">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">{m.motif}</span>
                        <span className="text-slate-400">
                          ({m.start}-{m.end})
                        </span>
                        {m.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[12.5px] text-slate-500">No flagged patterns found.</p>
                )}
                <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Pattern-matching against a short literature-informed list, not a validated immunogenicity assay. A negative result here doesn&apos;t rule out immune activation, and a hit doesn&apos;t confirm it.
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-slate-800">{value}</p>
    </div>
  );
}
