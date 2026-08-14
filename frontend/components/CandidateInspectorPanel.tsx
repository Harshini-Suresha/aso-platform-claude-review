"use client";

import { useState, useEffect } from "react";
import { RnaNeutralizationCandidate } from "@/types/rnaNeutralization";
import { CheckCircle, XCircle, AlertTriangle, TrendingDown } from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

interface CandidateInspectorPanelProps {
  candidate: RnaNeutralizationCandidate;
  onClose: () => void;
  onProceedToDesign: (candidate: RnaNeutralizationCandidate) => void;
}

export default function CandidateInspectorPanel({
  candidate,
  onClose,
  onProceedToDesign,
}: CandidateInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<"binding" | "safety">("binding");

  useKeyboardShortcut("escape", onClose);

  const displacementColor =
    candidate.rbpDisplacementScore >= 90
      ? "text-emerald-600"
      : candidate.rbpDisplacementScore >= 70
        ? "text-blue-600"
        : candidate.rbpDisplacementScore >= 50
          ? "text-amber-600"
          : "text-red-600";

  const displacementBg =
    candidate.rbpDisplacementScore >= 90
      ? "bg-emerald-50 border-emerald-200"
      : candidate.rbpDisplacementScore >= 70
        ? "bg-blue-50 border-blue-200"
        : candidate.rbpDisplacementScore >= 50
          ? "bg-amber-50 border-amber-200"
          : "bg-red-50 border-red-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-800">
              Candidate #{candidate.rank} — Inspector Panel
            </h3>
            <p className="text-[12px] text-slate-500">
              {candidate.tilingPattern} · {candidate.chemistry} · {candidate.oligoLength} nt
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setActiveTab("binding")}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeTab === "binding"
                  ? "bg-brand text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Competitive Inhibition
            </button>
            <button
              onClick={() => setActiveTab("safety")}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeTab === "safety"
                  ? "bg-brand text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Non-Cleaving Safety Check
            </button>
          </div>

          {activeTab === "binding" && (
            <div className="space-y-5">
              <div className={`rounded-xl border p-4 ${displacementBg}`}>
                <div className="flex items-center gap-3">
                  <TrendingDown className={`h-6 w-6 ${displacementColor}`} />
                  <div>
                    <p className={`text-[22px] font-bold ${displacementColor}`}>
                      {candidate.rbpDisplacementScore}/100
                    </p>
                    <p className="text-[11px] text-slate-500">RBP Displacement Score</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-[12px] font-semibold text-slate-700">
                  Binding Energy Comparison (ΔG)
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">ASO–RNA Duplex</span>
                      <span className="font-semibold text-indigo-600">
                        {candidate.asoDuplexDeltaG.toFixed(1)} kcal/mol
                      </span>
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-400"
                        style={{ width: `${Math.min(100, Math.abs(candidate.asoDuplexDeltaG) * 3)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">RBP–RNA (target)</span>
                      <span className="font-semibold text-rose-600">
                        {candidate.rbpBindingDeltaG.toFixed(1)} kcal/mol
                      </span>
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-rose-400"
                        style={{ width: `${Math.min(100, Math.abs(candidate.rbpBindingDeltaG) * 3)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 leading-relaxed">
                  <strong className="text-slate-700">Competitive Advantage:</strong>{" "}
                  The ASO duplex is {Math.abs(candidate.asoDuplexDeltaG - Math.abs(candidate.rbpBindingDeltaG)).toFixed(1)} kcal/mol{" "}
                  {Math.abs(candidate.asoDuplexDeltaG) > Math.abs(candidate.rbpBindingDeltaG)
                    ? "stronger than the RBP–RNA interaction, indicating favorable displacement."
                    : "weaker than the RBP–RNA interaction; consider chemistry optimization to improve binding."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Melting Temp</p>
                  <p className="mt-1 text-[18px] font-bold text-slate-700">{candidate.tm.toFixed(1)}°C</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Off-target Repeats</p>
                  <p className={`mt-1 text-[18px] font-bold ${candidate.offTargetRepeatCount <= 5 ? "text-emerald-600" : candidate.offTargetRepeatCount <= 15 ? "text-amber-600" : "text-red-600"}`}>
                    {candidate.offTargetRepeatCount}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "safety" && (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 ${candidate.hasCentralDnaGap ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex items-center gap-3">
                  {candidate.hasCentralDnaGap ? (
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                  )}
                  <div>
                    <p className={`text-[14px] font-semibold ${candidate.hasCentralDnaGap ? "text-red-700" : "text-emerald-700"}`}>
                      {candidate.hasCentralDnaGap
                        ? "Central DNA Gap Detected — RNase H1 May Be Recruited"
                        : "No Central DNA Gap — Confirmed Non-Cleaving Steric Blockade"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {candidate.hasCentralDnaGap
                        ? `Gap size: ${candidate.centralGapSizeNt} nt (≥5 nt threshold)`
                        : `Maximum continuous DNA span: ${candidate.centralGapSizeNt} nt (<5 nt safe threshold)`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-2 text-[12px] font-semibold text-slate-700">Steric Blockade Validation</p>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-slate-600">
                      Full-length {candidate.chemistry} modification — no RNase H1 substrate
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-slate-600">
                      Uniform {candidate.oligoLength}-nt occupancy across repeat tract
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {candidate.selfDimerMfe > -3 ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className="text-slate-600">
                      Self-dimer MFE: {candidate.selfDimerMfe.toFixed(1)} kcal/mol
                      {candidate.selfDimerMfe > -3 ? " — low aggregation risk" : " — monitor at high concentration"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-[11px] text-indigo-700 leading-relaxed">
                <strong>Design Principle:</strong> Unlike RNase H-dependent gapmers (TG01), steric-blocking ASOs
                act by physically occupying the repeat RNA to prevent RBP sequestration. No transcript degradation occurs.
                The toxic RNA remains present but functionally neutralized.
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onProceedToDesign(candidate)}
            className="rounded-lg bg-brand px-5 py-2 text-[12px] font-medium text-white shadow-sm hover:bg-brand-dark transition-colors"
          >
            Proceed to ASO Design
          </button>
        </div>
      </div>
    </div>
  );
}
