"use client";

import { Activity, BarChart3, Dna, Gauge, Layers, Radar, ShieldAlert, Target, TrendingDown, Weight } from "lucide-react";
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
import CompositeBreakdownChart from "./CompositeBreakdownChart";
import BaseCompositionChart from "./BaseCompositionChart";
import PhysicochemicalChart from "./PhysicochemicalChart";
import TargetCoverageChart from "./TargetCoverageChart";
import CandidateMetricsTable from "./CandidateMetricsTable";

function SuiteSection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-100 p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-teal-700" />
        <p className="text-[11.5px] font-semibold text-slate-700">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function AsoVisualizationSuite({ candidates }: { candidates: AssoCandidate[] }) {
  if (!candidates.length) return null;

  return (
    <Card className="p-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <SuiteSection icon={BarChart3} title="Composite score comparison">
          <CandidateScoreChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Layers} title="Composite score decomposition — duplex vs Tm fit">
          <CompositeBreakdownChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Radar} title="Binding landscape — Tm vs duplex ΔG">
          <BindingLandscapeChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={TrendingDown} title="Binding strength ranking — duplex ΔG">
          <DuplexEnergyChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Target} title="GC content vs design window">
          <GcWindowChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Dna} title="Purine / pyrimidine balance">
          <PurineBalanceChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Gauge} title="Base composition by candidate">
          <BaseCompositionChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Weight} title="Molecular weight & extinction coefficient">
          <PhysicochemicalChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Activity} title="Stability & self-structure distribution">
          <StabilityDistributionChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={ShieldAlert} title="Risk flag matrix">
          <RiskFlagMatrix candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={BarChart3} title="Drug-like estimate comparison" className="md:col-span-2">
          <HeuristicComparisonChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Target} title="Target region coverage across exons" className="md:col-span-2">
          <TargetCoverageChart candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Gauge} title="Candidate × metric favorability heatmap" className="md:col-span-2">
          <CandidateHeatmap candidates={candidates} />
        </SuiteSection>
        <SuiteSection icon={Layers} title="Full metrics matrix — all candidates" className="md:col-span-2">
          <CandidateMetricsTable candidates={candidates} />
        </SuiteSection>
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
        All 13 visualizations are rendered for a single-screen overview. Everything is computed
        directly from the candidates returned by the design engine.
      </p>
    </Card>
  );
}
