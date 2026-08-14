"use client";

import {
  BarChart3,
  Radar,
  Gauge,
  Award,
  Activity,
  Target,
  Dna,
  TrendingDown,
  ShieldAlert,
  Info,
  Layers,
  Weight,
} from "lucide-react";
import { AssoCandidate } from "@/types/geneSilencing";
import { Card } from "./ui";
import CandidateScoreChart from "./CandidateScoreChart";
import DuplexEnergyChart from "./DuplexEnergyChart";
import BindingLandscapeChart from "./BindingLandscapeChart";
import GcWindowChart from "./GcWindowChart";
import PurineBalanceChart from "./PurineBalanceChart";
import StabilityDistributionChart from "./StabilityDistributionChart";
import RiskFlagMatrix from "./RiskFlagMatrix";
import CandidateHeatmap from "./CandidateHeatmap";
import HeuristicComparisonChart from "./HeuristicComparisonChart";
import CandidateDeepDiveCard from "./CandidateDeepDiveCard";
import CompositeBreakdownChart from "./CompositeBreakdownChart";
import BaseCompositionChart from "./BaseCompositionChart";
import PhysicochemicalChart from "./PhysicochemicalChart";
import TargetCoverageChart from "./TargetCoverageChart";
import CandidateMetricsTable from "./CandidateMetricsTable";

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "teal",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "teal" | "amber" | "red" | "blue" | "violet" | "slate";
}) {
  const tones: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-[14px] font-bold leading-tight text-slate-800">{value}</p>
        {sub && <p className="truncate text-[9.5px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function AsoAnalysisDashboard({
  candidates,
}: {
  candidates: AssoCandidate[];
}) {
  if (!candidates.length) return null;

  const n = candidates.length;
  const sel = candidates[0];
  const topCandidates = candidates.slice(0, 3);

  const scores = candidates.map((c) => c.compositeScore);
  const meanScore = scores.reduce((a, b) => a + b, 0) / n;
  const bestScore = Math.max(...scores);

  const dgs = candidates.map((c) => c.realMetrics.targetDuplexEnergy);
  const strongestIdx = dgs.indexOf(Math.min(...dgs));
  const strongest = candidates[strongestIdx];

  const gcs = candidates.map((c) => c.realMetrics.gcContent);
  const meanGc = gcs.reduce((a, b) => a + b, 0) / n;

  const tms = candidates.map((c) => c.realMetrics.meltingTempC);
  const tmMin = Math.min(...tms);
  const tmMax = Math.max(...tms);

  const selfStructRisk = candidates.filter((c) => c.realMetrics.selfStructureMfe <= -6);
  const polyG = candidates.filter((c) => !c.realMetrics.polyGPass);
  const cpgRisk = candidates.filter((c) => c.realMetrics.cpgCount >= 3);
  const homoRisk = candidates.filter((c) => c.realMetrics.longestHomopolymer >= 4);
  const inGcWindow = candidates.filter((c) => c.realMetrics.gcContent >= 40 && c.realMetrics.gcContent <= 60);
  const flagCount = selfStructRisk.length + polyG.length + cpgRisk.length + homoRisk.length;

  const findings: { tone: "good" | "warn" | "info"; text: string }[] = [
    {
      tone: "good",
      text: `Rank 1 (${sel.targetRegion}) leads the design set with a composite score of ${sel.compositeScore}, driven by a target duplex ΔG of ${sel.realMetrics.targetDuplexEnergy} kcal/mol and ${sel.realMetrics.gcContent}% GC.`,
    },
    {
      tone: "info",
      text: `${strongest.targetRegion} shows the strongest predicted target binding (duplex ΔG = ${strongest.realMetrics.targetDuplexEnergy} kcal/mol), the dominant signal in the ranking.`,
    },
    {
      tone: "info",
      text: `Melting temperatures span ${tmMin}°C to ${tmMax}°C across the candidate set${tms.length > 1 ? ` (mean ${Math.round(tms.reduce((a, b) => a + b, 0) / n)}°C)` : ""}.`,
    },
  ];

  if (inGcWindow.length !== n) {
    findings.push({
      tone: inGcWindow.length > n / 2 ? "info" : "warn",
      text: `${inGcWindow.length} of ${n} candidates fall within the 40-60% GC design window; the remainder may benefit from sequence repositioning.`,
    });
  }
  if (selfStructRisk.length) {
    findings.push({
      tone: "warn",
      text: `${selfStructRisk.length} candidate${selfStructRisk.length > 1 ? "s" : ""} (${selfStructRisk.map((c) => `#${candidates.indexOf(c) + 1}`).join(", ")}) show${selfStructRisk.length > 1 ? "" : "s"} high self-structure risk (MFE ≤ −6 kcal/mol), which can impair target-site accessibility.`,
    });
  }
  if (polyG.length) {
    findings.push({
      tone: "warn",
      text: `${polyG.length} candidate${polyG.length > 1 ? "s" : ""} contain${polyG.length > 1 ? "" : "s"} poly-G tracts (≥3 consecutive G) — a known aggregation and non-specific protein-binding risk.`,
    });
  }
  if (cpgRisk.length) {
    findings.push({
      tone: "warn",
      text: `${cpgRisk.length} candidate${cpgRisk.length > 1 ? "s" : ""} contain${cpgRisk.length > 1 ? "" : "s"} ≥3 CpG dinucleotides, associated with TLR9-mediated immune stimulation.`,
    });
  }
  if (homoRisk.length) {
    findings.push({
      tone: "warn",
      text: `${homoRisk.length} candidate${homoRisk.length > 1 ? "s" : ""} contain${homoRisk.length > 1 ? "" : "s"} homopolymer runs ≥4 bases, which raise synthesis difficulty and self-structure risk.`,
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[13px] font-semibold text-slate-800">Candidate Analysis &amp; Visualizations</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">
          <Info className="h-3 w-3" /> Informational — does not alter ranking
        </span>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile icon={Dna} label="Candidates" value={n} tone="teal" />
        <StatTile icon={Award} label="Best composite" value={bestScore} sub="ranked #1" tone="blue" />
        <StatTile icon={Activity} label="Mean composite" value={meanScore.toFixed(1)} tone="violet" />
        <StatTile icon={TrendingDown} label="Duplex ΔG range" value={`${Math.min(...dgs)} → ${Math.max(...dgs)}`} sub="kcal/mol (strongest → weakest)" tone="slate" />
        <StatTile icon={Target} label="Mean GC" value={`${meanGc.toFixed(1)}%`} tone="amber" />
        <StatTile icon={ShieldAlert} label="Design flags" value={flagCount} sub="self-structure / poly-G / CpG / homo" tone={flagCount > 0 ? "red" : "teal"} />
      </div>

      {/* Key findings */}
      <Card className="p-5">
        <p className="mb-2.5 text-[11.5px] font-semibold text-slate-700">Key findings</p>
        <ul className="space-y-1.5">
          {findings.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-600">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  f.tone === "good" ? "bg-emerald-500" : f.tone === "warn" ? "bg-amber-500" : "bg-sky-500"
                }`}
              />
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Score comparison */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-teal-700" />
          <p className="text-[11.5px] font-semibold text-slate-700">Composite score comparison</p>
        </div>
        <CandidateScoreChart candidates={candidates} />
      </Card>

      {/* Landscape + binding strength */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-blue-700" />
            <p className="text-[11.5px] font-semibold text-slate-700">Binding landscape — Tm vs duplex ΔG</p>
          </div>
          <BindingLandscapeChart candidates={candidates} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-teal-700" />
            <p className="text-[11.5px] font-semibold text-slate-700">Binding strength ranking — duplex ΔG</p>
          </div>
          <DuplexEnergyChart candidates={candidates} />
        </Card>
      </div>

      {/* GC window + purine balance */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-emerald-700" />
            <p className="text-[11.5px] font-semibold text-slate-700">GC content vs design window</p>
          </div>
          <GcWindowChart candidates={candidates} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Dna className="h-3.5 w-3.5 text-violet-700" />
            <p className="text-[11.5px] font-semibold text-slate-700">Purine / pyrimidine balance</p>
          </div>
          <PurineBalanceChart candidates={candidates} />
        </Card>
      </div>

      {/* Stability distributions + risk flags */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-blue-700" />
            <p className="text-[11.5px] font-semibold text-slate-700">Stability &amp; self-structure distribution</p>
          </div>
          <StabilityDistributionChart candidates={candidates} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
            <p className="text-[11.5px] font-semibold text-slate-700">Risk flag matrix</p>
          </div>
          <RiskFlagMatrix candidates={candidates} />
        </Card>
      </div>

      {/* Metric favorability heatmap */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-violet-700" />
          <p className="text-[11.5px] font-semibold text-slate-700">Candidate × metric favorability heatmap</p>
        </div>
        <CandidateHeatmap candidates={candidates} />
      </Card>

      {/* Drug-like comparison */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-violet-700" />
          <p className="text-[11.5px] font-semibold text-slate-700">Drug-like estimate comparison</p>
        </div>
        <HeuristicComparisonChart candidates={candidates} />
      </Card>

      {/* Composite score decomposition */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-teal-700" />
          <p className="text-[11.5px] font-semibold text-slate-700">Composite score decomposition — duplex vs Tm fit</p>
        </div>
        <CompositeBreakdownChart candidates={candidates} />
      </Card>

      {/* Base composition + physicochemical */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Dna className="h-3.5 w-3.5 text-indigo-700" />
            <p className="text-[11.5px] font-semibold text-slate-700">Base composition by candidate</p>
          </div>
          <BaseCompositionChart candidates={candidates} />
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Weight className="h-3.5 w-3.5 text-slate-700" />
            <p className="text-[11.5px] font-semibold text-slate-700">Molecular weight &amp; extinction coefficient</p>
          </div>
          <PhysicochemicalChart candidates={candidates} />
        </Card>
      </div>

      {/* Target coverage */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-emerald-700" />
          <p className="text-[11.5px] font-semibold text-slate-700">Target region coverage across exons</p>
        </div>
        <TargetCoverageChart candidates={candidates} />
      </Card>

      {/* Full metrics matrix */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-violet-700" />
          <p className="text-[11.5px] font-semibold text-slate-700">Full metrics matrix — all candidates</p>
        </div>
        <CandidateMetricsTable candidates={candidates} />
      </Card>

      {/* Per-candidate deep-dive */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Radar className="h-3.5 w-3.5 text-teal-700" />
          <p className="text-[11.5px] font-semibold text-slate-700">Top candidate deep-dive</p>
          <span className="text-[10px] text-slate-400">per-candidate profile for the top {topCandidates.length}</span>
        </div>
    <div id="aso-analysis-dashboard" className="space-y-4">
          {topCandidates.map((c, i) => (
            <CandidateDeepDiveCard key={c.sequence} candidate={c} rank={i + 1} />
          ))}
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-400">
        All plots above are computed directly from the candidates returned by the design engine. Duplex ΔG, Tm, GC, and
        self-structure are real physics/thermodynamics computations; the radar and estimate bars are labeled heuristics.
        Nothing displayed here feeds back into candidate ranking.
      </p>
    </div>
  );
}
