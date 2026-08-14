"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { RnaEditingCandidate } from "@/types/rnaEditing";
import { Card, SectionHeader } from "./ui";

function ScoreBar({ value, max = 100, color = "brand" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors: Record<string, string> = {
    brand: "bg-brand",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-400",
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div
        className={`h-1.5 rounded-full ${colors[color] ?? colors.brand}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Td({
  label,
  value,
  unit,
  bar,
  warn,
  highlight,
  color,
}: {
  label: string;
  value?: React.ReactNode;
  unit?: string;
  bar?: number;
  warn?: boolean;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <tr className="border-b border-slate-50">
      <td className="py-1.5 pr-4 text-[11px] text-slate-500">{label}</td>
      <td className="py-1.5 text-right">
        {bar !== undefined && <ScoreBar value={bar} color={color} />}
        {value !== undefined && (
          <span className={`text-[12px] font-medium ${highlight ? "text-brand" : warn ? "text-amber-600" : "text-slate-700"}`}>
            {value}{unit ? ` ${unit}` : ""}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function GuideRnaCandidateCard({
  candidate,
  rank,
}: {
  candidate: RnaEditingCandidate;
  rank: number;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function copySequence() {
    navigator.clipboard.writeText(candidate.sequence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isTransSplicing = candidate.editType === "trans_splicing";

  const editLabel =
    (candidate.onTargetEditScore ?? 0) >= 80 ? "Excellent"
    : (candidate.onTargetEditScore ?? 0) >= 60 ? "Good"
      : (candidate.onTargetEditScore ?? 0) >= 40 ? "Moderate"
        : "Poor";

  const adarLabel =
    (candidate.adarRecruitmentScore ?? 0) >= 80 ? "Strong"
    : (candidate.adarRecruitmentScore ?? 0) >= 60 ? "Moderate"
      : (candidate.adarRecruitmentScore ?? 0) >= 40 ? "Weak"
        : "Poor";

  const splicingLabel =
    (candidate.splicingEfficiencyScore ?? 0) >= 80 ? "High"
    : (candidate.splicingEfficiencyScore ?? 0) >= 60 ? "Good"
      : (candidate.splicingEfficiencyScore ?? 0) >= 40 ? "Moderate"
        : "Low";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-slate-800">
                  {candidate.guideLength} nt Guide
                </span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                  {candidate.mechanismId}
                </span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="text-[11px] text-slate-500">
                  {candidate.chemistry.replace(/_/g, " ").toUpperCase()}
                </span>
                {isTransSplicing && (
                  <>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                      {candidate.splicingDirection === "five_prime"
                        ? "5' Replacement"
                        : "3' Replacement"}
                    </span>
                  </>
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-0.5">{candidate.targetRegion}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copySequence}
              className="flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-white transition-colors"
            >
              {copied ? <><Check className="h-3 w-3 text-emerald-500" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-white transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Less" : "More"}
            </button>
          </div>
        </div>

        {/* Sequence */}
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Guide RNA Sequence (5'→3')
          </p>
          <div className="rounded-lg bg-slate-900 px-4 py-2.5 font-mono text-[13px] text-emerald-400 break-all leading-relaxed tracking-widest select-all">
            {candidate.sequence}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-400">
            <span>Target: <strong className="text-slate-600">{candidate.targetBasePair}</strong></span>
            <span>GC: <strong className="text-slate-600">{candidate.gcContent}%</strong></span>
            <span>MW: <strong className="text-slate-600">{candidate.molecularWeight?.toLocaleString()} Da</strong></span>
            <span>Adj. Tm: <strong className="text-slate-600">{candidate.adjustedTmC}°C</strong></span>
            <span>(+{candidate.bindingAffinityAdjustment}°C)</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="px-5 py-3">
          <table className="w-full text-left">
            <tbody>
              {isTransSplicing ? (
                <>
                  <Td label="Splice Site Strength" bar={candidate.spliceSiteScore ?? 0} highlight />
                  <Td label="Splicing Efficiency" value={splicingLabel} warn={splicingLabel === "Low"} />
                  <Td label="Binding Domain Quality" bar={candidate.bindingDomainScore ?? 0} highlight />
                  <Td label="Splice Compatibility" bar={candidate.spliceCompatibilityScore ?? 0} />
                  <Td label="Spliceosome Recruitment" bar={candidate.spliceosomeRecruitmentScore ?? 0} />
                  <Td label="Chemistry/Mod Score" bar={candidate.chemistryModificationScore ?? 0} />
                  <Td label="Direction" value={candidate.splicingDirection === "five_prime" ? "5' Exon Replacement" : "3' Exon Replacement"} />
                  <Td label="ABD Length" value={candidate.abdLength} unit="nt" />
                  <Td label="Junction Offset" value={candidate.junctionOffset} unit="nt" warn={Math.abs(candidate.junctionOffset ?? 0) > 30} />
                  <Td label="Splice Junction Pos" value={candidate.spliceJunctionPosition} unit="nt" />
                </>
              ) : (
                <>
                  <Td label="On-Target Edit Score" bar={candidate.onTargetEditScore ?? 0} highlight />
                  <Td label="Edit Efficiency" value={editLabel} warn={editLabel === "Poor"} />
                  <Td label="ADAR Recruitment" bar={candidate.adarRecruitmentScore ?? 0} />
                  <Td label="Recruitment Potential" value={adarLabel} warn={adarLabel === "Poor"} />
                  <Td label="Bystander Risk" value={candidate.bystanderRiskCount} unit="A's" warn={candidate.bystanderRiskCount > 2} />
                </>
              )}
              <Td label="Melting Temp (Tm)" value={candidate.meltingTempC} unit="°C" />
              <Td label="Adjusted Tm" value={candidate.adjustedTmC} unit="°C" />
              <Td label="GC Content" value={candidate.gcContent} unit="%" bar={candidate.gcScore} />
              <Td label="Tm Score" bar={candidate.tmScore} />
              <Td label="Self-Structure MFE" value={candidate.selfStructureMfe} unit="kcal/mol" />
              <Td label="Target Duplex ΔG" value={candidate.targetDuplexEnergy} unit="kcal/mol" />
              <Td label="Nuclease Resistance" bar={candidate.nucleaseResistance} color="emerald" />
              <Td label="Guide Length" value={candidate.guideLength} unit="nt" />
              <Td label="Quality Score" value={candidate.qualityScore} highlight />
            </tbody>
          </table>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t border-slate-100 px-5 py-3">
            <table className="w-full text-left">
              <tbody>
                {isTransSplicing ? (
                  <>
                    <Td label="Splice Site Score" bar={candidate.spliceSiteScore ?? 0} />
                    <Td label="Binding Domain Score" bar={candidate.bindingDomainScore ?? 0} />
                    <Td label="Splice Compatibility" bar={candidate.spliceCompatibilityScore ?? 0} />
                    <Td label="Chemistry/Mod Score" bar={candidate.chemistryModificationScore ?? 0} />
                    <Td label="Splicing Efficiency" bar={candidate.splicingEfficiencyScore ?? 0} color="amber" />
                    <Td label="Spliceosome Recruitment" bar={candidate.spliceosomeRecruitmentScore ?? 0} color="amber" />
                    <Td label="Junction Offset" value={candidate.junctionOffset} unit="nt" />
                    <Td label="Splice Junction Position" value={candidate.spliceJunctionPosition} unit="nt" />
                  </>
                ) : (
                  <>
                    <Td label="On-Target Edit Score" value={candidate.onTargetEditScore} />
                    <Td label="ADAR Recruitment Score" value={candidate.adarRecruitmentScore} />
                    <Td label="Bystander Risk Count" value={candidate.bystanderRiskCount} unit="A's" warn={candidate.bystanderRiskCount > 2} />
                  </>
                )}
                <Td label="Poly-G Tracts" value={candidate.polygTracts} warn={candidate.polygTracts > 0} />
                <Td label="CpG Count" value={candidate.cpgCount} warn={candidate.cpgCount > 2} />
                <Td label="Longest Homopolymer" value={candidate.longestHomopolymer} />
                <Td label="Purine Content" value={`${(candidate.purineContent * 100).toFixed(1)}%`} />
                <Td label="GC Skew" value={candidate.gcSkew.toFixed(3)} />
                <Td label="Sequence Complexity" value={candidate.sequenceComplexity.toFixed(3)} />
                <Td label="Extinction Coeff (ε₂₆₀)" value={candidate.extinctionCoefficient?.toLocaleString()} unit="L/mol·cm" />
                <Td label="Adjusted Tm" value={candidate.adjustedTmC} unit="°C" />
                <Td label="Tm Adjustment" value={candidate.bindingAffinityAdjustment} unit="°C" />
                <Td label="Nuclease Resistance" value={candidate.nucleaseResistance} unit="/100" />
                <Td label="MFE Penalty" value={candidate.mfePenalty} />
                <Td label="Chemistry" value={candidate.chemistry.replace(/_/g, " ").toUpperCase()} />
                <Td label="Modifications" value={candidate.modifications.map(m => m.replace(/_/g, " ")).join(", ")} />
                {candidate.mechanismNotes && <Td label="Mechanism Notes" value={candidate.mechanismNotes} />}
              </tbody>
            </table>

            {!isTransSplicing && candidate.bystanderRiskDetails && candidate.bystanderRiskDetails.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-medium text-slate-600 mb-1">Bystander Adenosines</p>
                <div className="flex flex-wrap gap-1">
                  {candidate.bystanderRiskDetails.map((b, i) => (
                    <span
                      key={i}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        b.risk === "high" ? "bg-red-50 text-red-600"
                        : b.risk === "medium" ? "bg-amber-50 text-amber-600"
                          : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      Pos {b.position}: {b.context}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
