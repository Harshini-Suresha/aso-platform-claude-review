"use client";

import { Loader2 } from "lucide-react";
import { RnaEditingDesignOptions } from "@/types/rnaEditing";

export default function RnaEditingDesignForm({
  options,
  editType,
  guideLength,
  setGuideLength,
  mismatchPocket,
  setMismatchPocket,
  maxBystanderEdits,
  setMaxBystanderEdits,
  splicingDirection,
  setSplicingDirection,
  abdLength,
  setAbdLength,
  chemistry,
  setChemistry,
  selectedMods,
  onToggleMod,
  onGenerate,
  loading,
  disabled,
  hasResults,
}: {
  options: RnaEditingDesignOptions | null;
  editType: string;
  guideLength: number;
  setGuideLength: (n: number) => void;
  mismatchPocket: string;
  setMismatchPocket: (s: string) => void;
  maxBystanderEdits: number;
  setMaxBystanderEdits: (n: number) => void;
  splicingDirection: string;
  setSplicingDirection: (s: string) => void;
  abdLength: number;
  setAbdLength: (n: number) => void;
  chemistry: string;
  setChemistry: (id: string) => void;
  selectedMods: string[];
  onToggleMod: (id: string) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled: boolean;
  hasResults?: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Editing Modality-Specific Inputs */}
      {editType !== "trans_splicing" && (
        <>
          {/* Guide RNA Length */}
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
              Guide RNA Length: {guideLength} nt
            </label>
            <input
              type="range"
              min={options?.lengthRange.min ?? 30}
              max={options?.lengthRange.max ?? 120}
              step={options?.lengthRange.step ?? 1}
              value={guideLength}
              onChange={(e) => setGuideLength(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{options?.lengthRange.min ?? 30} nt</span>
              <span>{options?.lengthRange.max ?? 120} nt</span>
            </div>
          </div>

          {/* Target Mismatch Base (A-to-I only) */}
          {editType === "a_to_i" && (
            <div>
              <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
                Target Mismatch Base (Orphan Base)
              </label>
              <p className="mb-2 text-[11px] text-slate-400">
                Facing target A with C creates an A-C mismatch pocket that boosts ADAR deamination.
              </p>
              <select
                value={mismatchPocket}
                onChange={(e) => setMismatchPocket(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="c">C (A-C Mismatch — High Efficiency)</option>
                <option value="g">G</option>
                <option value="u">U</option>
              </select>
            </div>
          )}

          {/* Bystander Editing Window */}
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
              Bystander Window: ±{maxBystanderEdits} nt
            </label>
            <p className="mb-2 text-[11px] text-slate-400">
              Tolerance threshold for unintended A→I edits on neighboring adenosines.
            </p>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={maxBystanderEdits}
              onChange={(e) => setMaxBystanderEdits(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>0 nt</span>
              <span>50 nt</span>
            </div>
          </div>
        </>
      )}

      {/* Trans-Splicing Inputs */}
      {editType === "trans_splicing" && (
        <>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
              Trans-splicing Direction
            </label>
            <select
              value={splicingDirection}
              onChange={(e) => setSplicingDirection(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Select direction</option>
              <option value="three_prime">3' Exon Replacement</option>
              <option value="five_prime">5' Exon Replacement</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
              Antisense Binding Domain (ABD) Length: {abdLength} nt
            </label>
            <input
              type="range"
              min={80}
              max={300}
              step={10}
              value={abdLength}
              onChange={(e) => setAbdLength(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>80 nt</span>
              <span>300 nt</span>
            </div>
          </div>
        </>
      )}

      {/* Chemistry */}
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
          Guide RNA Chemistry
        </label>
        <div className="space-y-2">
          {(options?.chemistryOptions ?? []).map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border transition-colors cursor-pointer ${
                chemistry === c.id
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "border-[#E5E7EB] hover:border-slate-300"
              }`}
              onClick={() => setChemistry(c.id)}
            >
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    chemistry === c.id ? "border-brand" : "border-slate-300"
                  }`}
                >
                  {chemistry === c.id && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-slate-700">{c.label}</p>
                  {c.description && (
                    <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{c.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modifications */}
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
          Modifications
        </label>
        <div className="space-y-2">
          {(options?.modificationOptions ?? []).map((m) => (
            <div
              key={m.id}
              className={`rounded-lg border transition-colors cursor-pointer ${
                selectedMods.includes(m.id)
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "border-[#E5E7EB] hover:border-slate-300"
              }`}
              onClick={() => onToggleMod(m.id)}
            >
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selectedMods.includes(m.id)
                      ? "border-brand bg-brand text-white"
                      : "border-slate-300"
                  }`}
                >
                  {selectedMods.includes(m.id) && (
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-slate-700">{m.label}</p>
                  {m.description && (
                    <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{m.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={disabled || loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Generating guides..." : hasResults ? "Regenerate Guides" : "Generate Guide Candidates"}
      </button>
    </div>
  );
}
