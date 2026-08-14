"use client";

import { Copy, Check, Info } from "lucide-react";
import { useState } from "react";
import { AssoCandidate } from "@/types/geneSilencing";
import { Card } from "./ui";

function DuplexEnergyBadge({ energy }: { energy: number }) {
  const label = energy <= -25 ? "Very Stable" : energy <= -15 ? "Stable" : energy <= -10 ? "Moderate" : "Weak";
  const cls =
    energy <= -25
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : energy <= -15
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : energy <= -10
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-blue-400" : pct >= 30 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-slate-600 w-7 text-right">{value}</span>
    </div>
  );
}

function Td({ label, value, unit, warn, highlight, bar, note }: { label: string; value?: string | number | null; unit?: string; warn?: boolean; highlight?: boolean; bar?: number; note?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-4 text-[11px] text-slate-500 whitespace-nowrap">{label}</td>
      <td className="py-1.5 text-right">
        {bar !== undefined ? (
          <div className="flex items-center justify-end gap-2">
            <ScoreBar value={bar} />
          </div>
        ) : (
          <span className={`text-[11.5px] font-semibold ${highlight ? "text-brand" : warn ? "text-amber-600" : "text-slate-700"}`}>
            {value}{unit && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{unit}</span>}
          </span>
        )}
        {note && <div className="mt-0.5 text-[9.5px] text-slate-400 italic">{note}</div>}
      </td>
    </tr>
  );
}

function TableSection({ title, colSpan = 1 }: { title: string; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-slate-100/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </td>
    </tr>
  );
}

export default function AssoCandidateCard({
  candidate,
  rank,
}: {
  candidate: AssoCandidate;
  rank: number;
}) {
  const [copied, setCopied] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  function copySequence() {
    navigator.clipboard.writeText(candidate.sequence).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const rm = candidate.realMetrics;
  const he = candidate.heuristicEstimates;

  const selfDimerLabel =
    rm.selfStructureMfe === 0
      ? "None"
      : rm.selfStructureMfe > -3
        ? "Low"
        : rm.selfStructureMfe > -6
          ? "Moderate"
          : "High";

  const nucleaseLabel = he.nucleaseResistance.value >= 80 ? "Excellent" : he.nucleaseResistance.value >= 60 ? "Good" : he.nucleaseResistance.value >= 40 ? "Moderate" : "Low";
  const uptakeLabel = he.cellularUptake.value >= 70 ? "High" : he.cellularUptake.value >= 50 ? "Moderate" : "Low";
  const bbbLabel = he.bbbCrossing.value >= 60 ? "Good" : he.bbbCrossing.value >= 30 ? "Limited" : "Poor";
  const offTargetLabel = he.offTargetRisk.value <= 20 ? "Low" : he.offTargetRisk.value <= 40 ? "Moderate" : "High";
  const immuneLabel = he.immuneStimulation.value <= 15 ? "Low" : he.immuneStimulation.value <= 35 ? "Moderate" : "High";
  const synthesisLabel = he.synthesisDifficulty.value <= 30 ? "Standard" : he.synthesisDifficulty.value <= 55 ? "Moderate" : "Complex";

  const composition = { A: 0, C: 0, G: 0, T: 0, U: 0 };
  for (const b of candidate.sequence.toUpperCase()) {
    if (b in composition) composition[b as keyof typeof composition] += 1;
  }
  const seqLen = candidate.sequence.length || 1;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-800">{candidate.chemistry.toUpperCase()}</span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="text-[11px] text-slate-500">{candidate.length} nt</span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">{candidate.mechanismId}</span>
                <DuplexEnergyBadge energy={rm.targetDuplexEnergy} />
                {candidate.compositeScore != null && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Score {candidate.compositeScore}
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-0.5">{candidate.targetRegion}</p>
            </div>
          </div>
          <button
            onClick={copySequence}
            className="flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-white transition-colors"
          >
            {copied ? <><Check className="h-3 w-3 text-emerald-500" /> Copied</> : <><Copy className="h-3 w-3" /> Copy seq</>}
          </button>
        </div>

        {/* Sequence */}
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Antisense Sequence (5'→3')</p>
          <div className="rounded-lg bg-slate-900 px-4 py-2.5 font-mono text-[13px] text-emerald-400 break-all leading-relaxed tracking-widest select-all">
            {candidate.sequence}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-400">
            <span>Molecular Weight: <strong className="text-slate-600">{rm.molecularWeight?.toLocaleString()} Da</strong></span>
            <span>Extinction Coefficient: <strong className="text-slate-600">{rm.extinctionCoefficient?.toLocaleString()} L/mol·cm</strong></span>
            <span>Duplex Stability: <strong className="text-slate-600">{rm.duplexStability}</strong></span>
          </div>

          {/* Mini visualizations */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Base composition stacked bar */}
            <div>
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">Base composition</p>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                {Object.entries(composition).filter(([, v]) => v > 0).map(([base, count]) => {
                  const pct = (count / seqLen) * 100;
                  const colors: Record<string, string> = { A: "#f59e0b", C: "#3b82f6", G: "#10b981", T: "#ef4444", U: "#8b5cf6" };
                  return <div key={base} style={{ width: `${pct}%`, backgroundColor: colors[base] || "#94a3b8" }} title={`${base}: ${pct.toFixed(1)}%`} />;
                })}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9.5px] text-slate-500">
                {Object.entries(composition).filter(([, v]) => v > 0).map(([base, count]) => (
                  <span key={base}><strong className="text-slate-700">{base}</strong> {((count / seqLen) * 100).toFixed(1)}%</span>
                ))}
              </div>
            </div>

            {/* GC content with ideal window */}
            <div>
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">GC content (ideal 40–60%)</p>
              <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="absolute inset-y-0 left-[40%] right-[40%] bg-emerald-100/60" />
                <div className={`h-full rounded-full ${rm.gcContent >= 40 && rm.gcContent <= 60 ? "bg-emerald-500" : rm.gcContent >= 35 && rm.gcContent <= 65 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${Math.min(100, rm.gcContent)}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[9.5px] text-slate-500">
                <span>0%</span>
                <span className={`font-semibold ${rm.gcContent >= 40 && rm.gcContent <= 60 ? "text-emerald-600" : "text-amber-600"}`}>{rm.gcContent}% GC</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Large table */}
        <div className="px-5 py-3">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-[#E5E7EB]">
                <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Property</th>
                <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Value</th>
              </tr>
            </thead>
            <tbody>
              {/* IDENTIFICATION */}
              <TableSection title="Identification" />
              <Td label="Rank" value={`#${rank}`} highlight />
              <Td label="Chemistry" value={candidate.chemistry} />
              {candidate.compositeScore != null && (
                <>
                  <Td label="Composite Design Score" bar={candidate.compositeScore} />
                  <Td label="Ranking Basis" value="Real metrics (duplex ΔG + Tm fit)" note="Heuristic drug-like estimates are shown below but do not affect ranking." />
                </>
              )}
              <Td label="Oligo Length" value={candidate.length} unit="nt" />
              <Td label="Target Region" value={candidate.targetRegion} />
              {candidate.exonNumber != null && <Td label="Target Exon" value={`Exon ${candidate.exonNumber}`} highlight />}
              {candidate.exonLength != null && <Td label="Exon Length" value={candidate.exonLength} unit="bp" />}
              {candidate.modifications.length > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 pr-4 text-[11px] text-slate-500">Modifications</td>
                  <td className="py-1.5 text-right">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {candidate.modifications.map((m) => (
                        <span key={m} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9.5px] font-medium text-indigo-600">{m}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}

              {/* REAL BIOPHYSICAL */}
              <TableSection title="Predicted Binding (Real Metrics)" />
              <Td label="Target Duplex ΔG" value={rm.targetDuplexEnergy} unit="kcal/mol" />
              <Td label="GC Content" value={`${rm.gcContent}%`} warn={rm.gcContent < 40 || rm.gcContent > 60} />
              <Td label="Melting Temperature (Tm)" value={rm.meltingTempC} unit="°C" />
              <Td label="Self-Structure MFE" value={rm.selfStructureMfe} unit="kcal/mol" />
              <Td label="Self-Structure Risk" value={selfDimerLabel} warn={selfDimerLabel === "High" || selfDimerLabel === "Moderate"} />
              <Td label="Poly-G Tracts (≥3 G)" value={rm.polyGPass ? "None" : "Detected"} warn={!rm.polyGPass} />

              {/* SEQUENCE COMPOSITION */}
              <TableSection title="Sequence Composition" />
              <Td label="CpG Dinucleotides" value={rm.cpgCount} warn={rm.cpgCount >= 3} />
              <Td label="CpG Immune Risk" value={rm.cpgCount >= 3 ? "Elevated" : "Normal"} warn={rm.cpgCount >= 3} />
              <Td label="Longest Homopolymer Run" value={rm.longestHomopolymer} unit="bp" warn={rm.longestHomopolymer >= 4} />
              <Td label="Purine Content (A+G)" value={`${(rm.purineContent * 100).toFixed(1)}%`} />
              <Td label="Pyrimidine Content (C+T)" value={`${((1 - rm.purineContent) * 100).toFixed(1)}%`} />
              <Td label="GC Skew" value={rm.gcSkew.toFixed(3)} />
              <Td label="Sequence Complexity" value={rm.sequenceComplexity.toFixed(3)} warn={rm.sequenceComplexity < 0.7} />
              <Td label="Repetitive Elements" value={rm.longestHomopolymer >= 4 ? "Detected" : "None"} warn={rm.longestHomopolymer >= 4} />

              {/* THERMODYNAMICS */}
              <TableSection title="Thermodynamic Profile" />
              <Td label="Duplex Stability" value={rm.duplexStability} />
              <Td label="MW" value={rm.molecularWeight?.toLocaleString()} unit="Da" />
              <Td label="Extinction Coeff (ε₂₆₀)" value={rm.extinctionCoefficient?.toLocaleString()} unit="L/mol·cm" />

              {/* HEURISTIC ESTIMATES */}
              <TableSection title="Drug-like Estimates (not used for ranking)" />
              <Td label="Nuclease Resistance" bar={he.nucleaseResistance.value} />
              <Td label="Nuclease Rating" value={nucleaseLabel} note={he.nucleaseResistance.note} />
              <Td label="Cellular Uptake" bar={he.cellularUptake.value} />
              <Td label="Uptake Rating" value={uptakeLabel} note={he.cellularUptake.note} />
              <Td label="BBB Crossing Potential" bar={he.bbbCrossing.value} />
              <Td label="BBB Rating" value={bbbLabel} note={he.bbbCrossing.note} />

              {/* RISK ASSESSMENT */}
              <TableSection title="Risk Estimates (not used for ranking)" />
              <Td label="Off-target Risk" bar={100 - he.offTargetRisk.value} />
              <Td label="Off-target Rating" value={offTargetLabel} warn={offTargetLabel === "High"} note={he.offTargetRisk.note} />
              <Td label="Immune Stimulation Risk" bar={100 - he.immuneStimulation.value} />
              <Td label="Immune Rating" value={immuneLabel} warn={immuneLabel === "High"} note={he.immuneStimulation.note} />
              <Td label="Synthesis Feasibility" bar={100 - he.synthesisDifficulty.value} />
              <Td label="Synthesis Rating" value={synthesisLabel} warn={synthesisLabel === "Complex"} note={he.synthesisDifficulty.note} />
              <Td label="Toxicity Flags" value={rm.cpgCount >= 3 ? "CpG-mediated" : !rm.polyGPass ? "Poly-G aggregation" : "None flagged"} warn={rm.cpgCount >= 3 || !rm.polyGPass} />

              {/* MIRNA SEED-SITE VERIFICATION (A6 upregulation) */}
              {candidate.seedSiteNote && (
                <>
                  <TableSection title="miRNA Seed Site Verification" colSpan={2} />
                  <tr className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-4 text-[11px] text-slate-500 whitespace-nowrap">Status</td>
                    <td className="py-1.5 text-right">
                      <span className="text-[11.5px] font-semibold text-amber-600">
                        {candidate.seedSiteStatus === "unverified" ? "Unverified — not a validated binding site" : candidate.seedSiteStatus}
                      </span>
                      <div className="mt-0.5 text-[9.5px] text-slate-400 italic">{candidate.seedSiteNote}</div>
                    </td>
                  </tr>
                </>
              )}

              {/* ALLELE-SPECIFIC */}
              {candidate.knownVariant && (                <>
                  <TableSection title="Allele-Specific Design" />
                  <Td label="Known Variant" value={candidate.knownVariant} highlight />
                  <Td label="Allele-Specific Targeting" value={candidate.alleleSpecific ? "Yes" : "No"} highlight={candidate.alleleSpecific} />
                  {candidate.alleleDiscriminationScore != null && (
                    <>
                      <Td label="Allele Discrimination" bar={candidate.alleleDiscriminationScore * 100} note="Mismatch proximity to the RNase H gap center (100 = at center, where discrimination is strongest)." />
                      {candidate.alleleDiscriminationNote && (
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 pr-4 text-[11px] text-slate-500">Discrimination Note</td>
                          <td className="py-1.5 text-right text-[10.5px] text-slate-500 italic max-w-[250px]">{candidate.alleleDiscriminationNote}</td>
                        </tr>
                      )}
                    </>
                  )}

                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 text-[11px] text-slate-500">Allele Notes</td>
                    <td className="py-1.5 text-right text-[10.5px] text-slate-500 italic max-w-[250px]">{candidate.alleleNotes}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Formula explanation */}
        <div className="border-t border-slate-100 px-5 py-2">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600"
          >
            <Info className="h-3 w-3" />
            {showBreakdown ? "Hide formulas & scoring details" : "Show scoring formulas & methodology"}
          </button>
          {showBreakdown && (
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-5 py-4 text-[10.5px] text-slate-500 leading-relaxed space-y-4">
              <div>
                <p className="font-bold text-slate-700 mb-1">Composite Design Score</p>
                <code className="block rounded bg-slate-100 px-3 py-2 text-[10px] font-mono text-slate-600">
                  Score = 0.65×Duplex(ΔG) + 0.35×TmFit
                </code>
                <p className="mt-1 text-[10px]">
                  <strong>Duplex:</strong> normalized target duplex ΔG (antisense ASO vs target window) — the primary binding signal.
                  <strong> TmFit:</strong> how well the chemistry-adjusted Tm fits the mechanism's optimal affinity window.
                  Chemistry and modification choices shift TmFit (LNA/2'-OMe boost effective Tm), so different options re-rank candidates.
                  All other drug-like estimates are excluded from the score by design.
                </p>
              </div>
              <div>
                <p className="font-bold text-slate-700 mb-1">Drug-like Estimates (informational only)</p>
                <ul className="space-y-0.5 text-[10px]">
                  <li><strong>Nuclease Resistance:</strong> Base 20 + chemistry score + modification scores (PS +25, LNA +20, PNA +35).</li>
                  <li><strong>Cellular Uptake:</strong> Chemistry factor + length factor (shorter = better).</li>
                  <li><strong>BBB Crossing:</strong> Base 10 + PMO+CPP +15, PNA +15, short length +10.</li>
                  <li><strong>Off-target:</strong> Base 20 + low complexity +30, poly-G ×10, short length +15.</li>
                  <li><strong>Immune Stimulation:</strong> Base 5 + CpG ×15 + gapmer chemistry +10.</li>
                  <li><strong>Synthesis:</strong> Base 10 + homopolymer ×5 + high GC +15 + LNA/PNA modifiers.</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-slate-700 mb-1">Thermodynamic Calculations</p>
                <ul className="space-y-0.5 text-[10px]">
                  <li><strong>Tm:</strong> Nearest-neighbor thermodynamics (SantaLucia 1998) via primer3.</li>
                  <li><strong>Self-Structure MFE:</strong> ViennaRNA fold algorithm for minimum free energy.</li>
                  <li><strong>Target Duplex ΔG:</strong> ViennaRNA duplexfold for ASO-target binding energy.</li>
                  <li><strong>MW:</strong> Sum of nucleotide MWs (A=331.2, T=322.2, G=347.2, C=307.2) minus water for phosphodiester bonds.</li>
                  <li><strong>ε₂₆₀:</strong> Nearest-neighbor method for UV absorbance at 260nm.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
