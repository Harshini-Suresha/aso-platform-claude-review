"use client";

import React, { useMemo } from "react";
import { Card } from "@/components/ui";
import { DiseaseDetailResponse } from "@/types/diseaseSearch";
import {
  BarChart3, Cloud, Filter, PieChart, Target,
  ThermometerSun, Shield, Database, Network, TrendingUp,
  Award, GitCommit,
} from "lucide-react";

const EVIDENCE_LABELS: { key: string; label: string }[] = [
  { key: "genetic_association", label: "Genetic Assoc." },
  { key: "genetic_literature", label: "Genetic Lit." },
  { key: "somatic_mutation", label: "Somatic Mutation" },
  { key: "clinical", label: "Clinical" },
  { key: "affected_pathway", label: "Affected Pathway" },
  { key: "pathway", label: "Pathway" },
  { key: "drug", label: "Drugs" },
  { key: "text_mining", label: "Text Mining" },
  { key: "animal_model", label: "Animal Model" },
  { key: "rna_expression", label: "RNA Expression" },
];

const TRACTABILITY_MODALITY: Record<string, string> = {
  SM: "Small molecule", AB: "Antibody", PR: "PROTAC",
  PROTAC: "PROTAC", TR: "Traceable", OTHER: "Other",
};

interface Props { detail: DiseaseDetailResponse; }
export default function DiseaseVisualizations({ detail }: Props) {
  const totalGenes = detail.genes.length;

  const scoreDistribution = useMemo(() => {
    const bins = [0, 0, 0, 0, 0];
    for (const g of detail.genes) {
      if (g.score != null) { const b = Math.min(4, Math.floor(g.score * 5)); bins[b]++; }
    }
    const max = Math.max(...bins, 1);
    return bins.map((count, i) => ({ label: (i*0.2).toFixed(1)+"–"+((i+1)*0.2).toFixed(1), count, pct: (count/max)*100 }));
  }, [detail]);

  const therapeuticAreaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ta of detail.therapeuticAreas) counts[ta] = (counts[ta] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  const drugStageCounts = useMemo(() => {
    const st = ["Pre-clinical", "Phase 1", "Phase 2", "Phase 3", "Approved"];
    const counts: Record<string, number> = { "Pre-clinical": 0, "Phase 1": 0, "Phase 2": 0, "Phase 3": 0, "Approved": 0 };
    for (const d of detail.knownDrugs) {
      if (d.phase === 4 || d.status?.toLowerCase().includes("approved")) counts["Approved"]++;
      else if (d.phase === 3) counts["Phase 3"]++;
      else if (d.phase === 2) counts["Phase 2"]++;
      else if (d.phase === 1) counts["Phase 1"]++;
      else counts["Pre-clinical"]++;
    }
    return st.map((s) => ({ stage: s, count: counts[s] }));
  }, [detail]);

  const biotypeDonut = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail.genes) counts[g.biotype || "unknown"] = (counts[g.biotype || "unknown"] ?? 0) + 1;
    const total = detail.genes.length;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const colors = ["bg-indigo-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-slate-400"];
    return sorted.map(([bt, count], i) => ({ label: bt, count, pct: total > 0 ? (count/total)*100 : 0, color: colors[i % colors.length] }));
  }, [detail]);

  const evidenceHeatmapGenes = useMemo(() => {
    return detail.genes.slice(0, 8).map((g) => ({
      symbol: g.symbol,
      evidence: {
        genetic_association: g.evidence?.genetic_association ?? 0,
        genetic_literature: g.evidence?.genetic_literature ?? 0,
        somatic_mutation: g.evidence?.somatic_mutation ?? 0,
        clinical: g.evidence?.clinical ?? 0,
        affected_pathway: g.evidence?.affected_pathway ?? 0,
        pathway: g.evidence?.pathway ?? 0,
        drug: g.evidence?.drug ?? 0,
        text_mining: g.evidence?.text_mining ?? 0,
        animal_model: g.evidence?.animal_model ?? 0,
        rna_expression: g.evidence?.rna_expression ?? 0,
      },
    }));
  }, [detail]);

  const tractabilityData = useMemo(() => {
    const tracts: Record<string, number> = {};
    for (const g of detail.genes) for (const t of g.tractability ?? []) {
      const modality = TRACTABILITY_MODALITY[t.modality] ?? t.modality;
      const key = t.label + " (" + modality + ")";
      tracts[key] = (tracts[key] ?? 0) + 1;
    }
    const vals = Object.values(tracts);
    const max = vals.length ? Math.max(...vals) : 1;
    return Object.entries(tracts).map(([label, count]) => ({ label, count, pct: (count/max)*100 }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
  }, [detail]);

  const safetyBubbleData = useMemo(() => {
    const bubbles: { symbol: string; liabilityCount: number; score: number | null }[] = [];
    for (const g of detail.genes) {
      const liabs = g.safetyLiabilities ?? [];
      if (liabs.length > 0) bubbles.push({ symbol: g.symbol, liabilityCount: liabs.length, score: g.score });
    }
    const maxLiab = Math.max(...bubbles.map((b) => b.liabilityCount), 1);
    const maxScore = Math.max(...detail.genes.map((g) => g.score ?? 0), 0.01);
    return bubbles.map((b) => ({ ...b, size: 20 + (b.liabilityCount/maxLiab)*60, opacity: Math.max(0.4, (b.score ?? 0)/maxScore) })).slice(0, 12);
  }, [detail]);

  const chemicalProbeData = useMemo(() => {
    const withProbes = detail.genes.filter((g) => (g.chemicalProbes?.length ?? 0) > 0).length;
    const withHQ = detail.genes.filter((g) => g.chemicalProbes?.some((p) => p.isHighQuality)).length;
    const total = totalGenes;
    return { total, withProbes, withHQ, pct: total > 0 ? (withProbes/total)*100 : 0 };
  }, [detail, totalGenes]);

  const pathwayBarData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail.genes) for (const p of g.pathways ?? []) counts[p.pathway] = (counts[p.pathway] ?? 0) + 1;
    return Object.entries(counts).map(([pathway, count]) => ({ pathway, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [detail]);

  const evidenceSummary = useMemo(() => {
    const acc = EVIDENCE_LABELS.map((e) => ({ ...e, genes: 0, total: 0 }));
    for (const g of detail.genes) for (const item of acc) {
      const v = g.evidence?.[item.key] ?? 0;
      if (v > 0) { item.genes += 1; item.total += v; }
    }
    return acc.filter((c) => c.genes > 0).sort((a, b) => b.total - a.total);
  }, [detail]);

  const constraintSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail.genes) for (const type of Object.keys(g.constraint ?? {})) counts[type] = (counts[type] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [detail]);

  const mousePhenotypeSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail.genes) for (const mp of g.mousePhenotypes ?? []) counts[mp] = (counts[mp] ?? 0) + 1;
    return Object.entries(counts).map(([ph, count]) => ({ ph, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [detail]);

  const targetClassSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of detail.genes) for (const tc of g.targetClass ?? []) counts[tc] = (counts[tc] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [detail]);

  const literatureScatterData = useMemo(() => {
    const genes = detail.genes.slice(0, 12);
    const maxLit = Math.max(...genes.map((g) => g.literatureCount ?? 0), 1);
    const maxScore = Math.max(...genes.map((g) => g.score ?? 0), 0.01);
    return genes.map((g) => ({ symbol: g.symbol, lit: g.literatureCount ?? 0, score: g.score ?? 0,
      xPct: ((g.literatureCount ?? 0) / maxLit) * 100, yPct: ((g.score ?? 0) / maxScore) * 100 }));
  }, [detail]);

  if (totalGenes === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Data Visualizations</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-4">

          {/* 1. Gene Score Distribution */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-blue-50 to-cyan-50">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                <p className="text-[16px] font-extrabold text-slate-800">1. Gene Score Distribution</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Association score spread (0–1 scale)</p>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-end justify-between h-44 gap-2">
                {scoreDistribution.map((bin, i) => (
                  <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
                    <span className="text-[13px] font-extrabold text-slate-700 mb-1">{bin.count}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-blue-400 to-cyan-300 min-h-[3px] hover:brightness-110 transition-all"
                      style={{ height: Math.max(4, bin.pct) + "%" }}
                      title={bin.label + ": " + bin.count + " genes"}
                    />
                    <span className="mt-1 text-[9px] font-bold text-slate-500">{bin.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[9px] text-slate-400">X-axis: score bins | Y-axis: gene count</div>
            </div>
          </Card>

          {/* 2. Therapeutic Areas Cloud */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-purple-50 to-fuchsia-50">
              <div className="flex items-center gap-3">
                <Cloud className="h-6 w-6 text-purple-600" />
                <p className="text-[16px] font-extrabold text-slate-800">2. Therapeutic Areas</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Disease classification domains</p>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-2 items-center">
                {therapeuticAreaCounts.length > 0 ? (
                  therapeuticAreaCounts.map(([ta, count]) => (
                    <span
                      key={ta}
                      className="rounded-full bg-gradient-to-r from-purple-200 to-fuchsia-200 px-3 py-1.5 font-bold text-purple-800 border border-purple-300 hover:scale-105 transition-transform"
                      style={{ fontSize: Math.max(10, 11 + (count - 1) * 1.5) + "px" }}
                      title={ta + ": " + count}
                    >
                      {ta} ({count})
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] font-medium text-slate-400">No therapeutic areas mapped.</span>
                )}
              </div>
              <div className="mt-2 text-[9px] text-slate-400">Larger text = more gene associations</div>
            </div>
          </Card>

          {/* 3. Drug Pipeline Funnel */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-amber-50 to-yellow-50">
              <div className="flex items-center gap-3">
                <Filter className="h-6 w-6 text-amber-600" />
                <p className="text-[16px] font-extrabold text-slate-800">3. Drug Pipeline</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Clinical candidate stages</p>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-col gap-3">
                {drugStageCounts.map((s) => {
                  const maxCount = Math.max(...drugStageCounts.map((d) => d.count), 1);
                  const widthPct = (s.count / maxCount) * 100;
                  const stageColors: Record<string, string> = {
                    "Pre-clinical": "bg-slate-400", "Phase 1": "bg-blue-500",
                    "Phase 2": "bg-indigo-500", "Phase 3": "bg-purple-500", "Approved": "bg-emerald-500",
                  };
                  return (
                    <div key={s.stage} className="flex items-center gap-3">
                      <span className="w-24 text-[12px] font-bold text-slate-700">{s.stage}</span>
                      <div className="flex-1 h-8 bg-slate-100 rounded overflow-hidden">
                        <div
                          className={`h-full ${stageColors[s.stage]} rounded flex items-center justify-end transition-all`}
                          style={{ width: widthPct + "%" }}
                        >
                          <span className="text-[11px] font-bold text-white px-2">{s.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[9px] text-slate-400">Funnel shape = candidate attrition per stage</div>
            </div>
          </Card>

          {/* 4. Biotype Composition Donut */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-rose-50 to-pink-50">
              <div className="flex items-center gap-3">
                <PieChart className="h-6 w-6 text-rose-600" />
                <p className="text-[16px] font-extrabold text-slate-800">4. Biotype Composition</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Gene protein-coding breakdown</p>
            </div>
            <div className="px-5 py-3 flex items-center gap-5">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 36 36" className="h-full w-full">
                  {biotypeDonut.length > 0 ? (() => {
                    let offset = 0;
                    const radius = 15;
                    const circ = 2 * Math.PI * radius;
                    const colorMap: Record<string, string> = {
                      "bg-indigo-500": "#6366f1", "bg-blue-500": "#3b82f6",
                      "bg-emerald-500": "#10b981", "bg-amber-500": "#f59e0b",
                      "bg-rose-500": "#f43f5e", "bg-slate-400": "#94a3b8",
                    };
                    return biotypeDonut.map((b, i) => {
                      const dash = (b.pct / 100) * circ;
                      const color = colorMap[b.color] ?? "#94a3b8";
                      const largeArc = dash > circ / 2 ? 1 : 0;
                      const x1 = 18 + radius * Math.cos((offset - 90) * Math.PI / 180);
                      const y1 = 18 + radius * Math.sin((offset - 90) * Math.PI / 180);
                      const x2 = 18 + radius * Math.cos((offset + dash - 90) * Math.PI / 180);
                      const y2 = 18 + radius * Math.sin((offset + dash - 90) * Math.PI / 180);
                      const path = <path key={i} d={"M " + x1 + "," + y1 + " A " + radius + "," + radius + " 0 " + largeArc + " 1 " + x2 + "," + y2 + " Z"} fill={color} stroke="white" strokeWidth="1" />;
                      offset += dash;
                      return path;
                    });
                  })() : <text x="18" y="22" textAnchor="middle" className="text-[10px] fill-slate-400 font-bold">No data</text>}
                  {biotypeDonut.length > 0 && <text x="18" y="22" textAnchor="middle" className="text-[11px] font-bold fill-slate-700">{totalGenes} genes</text>}
                </svg>
              </div>
              <div className="flex flex-col gap-2">
                {biotypeDonut.slice(0, 5).map((b) => (
                  <div key={b.label} className="flex items-center gap-2">
                    <div className={"h-3 w-3 rounded-sm " + b.color} />
                    <span className="text-[11px] font-bold text-slate-700">{b.label}: {b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 5. Evidence Heatmap */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-indigo-50 to-blue-50">
              <div className="flex items-center gap-3">
                <Target className="h-6 w-6 text-indigo-600" />
                <p className="text-[16px] font-extrabold text-slate-800">5. Evidence Heatmap</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Evidence types × top genes (darker = stronger)</p>
            </div>
            <div className="px-5 py-3 overflow-x-auto">
              <div className="grid" style={{ gridTemplateColumns: "80px repeat(10, 1fr)" }}>
                <div className="font-bold text-[9px] text-slate-400 uppercase">Gene</div>
                {Object.keys(evidenceHeatmapGenes[0]?.evidence ?? {}).map((k) => (
                  <div key={k} className="text-center text-[7px] font-bold text-slate-500">
                    {EVIDENCE_LABELS.find((e) => e.key === k)?.label ?? k}
                  </div>
                ))}
                {evidenceHeatmapGenes.map((g) => (
                  <React.Fragment key={g.symbol}>
                    <div className="text-[11px] font-bold text-slate-700 self-center">{g.symbol}</div>
                    {Object.entries(g.evidence).map(([k, v]) => {
                      const intensity = Math.max(20, Math.min(90, v * 100));
                      return <div key={k} className="h-6 rounded hover:ring-1 hover:ring-brand" style={{ backgroundColor: "rgba(79,70,229," + (intensity/100) + ")" }} title={k + ": " + v.toFixed(3)} />;
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-2 text-[9px] text-slate-400">Hover over cells for exact values</div>
            </div>
          </Card>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">

          {/* 6. Tractability Progress Bars */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-cyan-50 to-teal-50">
              <div className="flex items-center gap-3">
                <ThermometerSun className="h-6 w-6 text-cyan-600" />
                <p className="text-[16px] font-extrabold text-slate-800">6. Tractability Landscape</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Drug modalities per gene target</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {tractabilityData.length > 0 ? (
                tractabilityData.map((t) => (
                  <div key={t.label} className="flex items-center gap-3">
                    <span className="w-40 text-[12px] font-bold text-slate-700 truncate" title={t.label}>
                      {t.label}
                    </span>
                    <div className="flex-1 h-7 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-500 rounded flex items-center justify-end transition-all">
                        <span className="text-[11px] font-bold text-white px-2">{t.count}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[12px] font-medium text-slate-400">No tractability data available.</p>
              )}
              <div className="mt-1 text-[9px] text-slate-400">Longer bars = more genes with that modality</div>
            </div>
          </Card>

          {/* 7. Safety Liability Bubbles */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-rose-50 to-red-50">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-red-600" />
                <p className="text-[16px] font-extrabold text-slate-800">7. Safety Liability Bubbles</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Size = liability count | Color = association score</p>
            </div>
            <div className="px-5 py-3">
              {safetyBubbleData.length > 0 ? (
                <div className="relative h-48 w-full border border-slate-200 rounded-lg bg-slate-50/50">
                  {safetyBubbleData.map((b, idx) => {
                    const positions = [[15,40],[85,25],[30,70],[70,65],[50,15],[20,55],[80,50],[45,35],[65,80],[35,20],[55,60],[25,30]];
                    const [lx, ly] = positions[idx % positions.length];
                    return (
                      <div
                        key={b.symbol}
                        className="absolute rounded-full bg-gradient-to-br from-rose-400 to-red-600 flex items-center justify-center font-bold text-white border-2 border-red-300 shadow-lg hover:scale-110 transition-transform"
                        style={{
                          width: b.size + "px", height: b.size + "px",
                          left: lx + "%", top: ly + "%",
                          opacity: Math.max(0.5, b.opacity),
                          fontSize: "9px",
                        }}
                        title={b.symbol + ": " + b.liabilityCount + " liabilities"}
                      >
                        {b.symbol}
                      </div>
                    );
                  })}
                  <div className="absolute bottom-2 left-2 text-[9px] font-medium text-slate-500">
                    {safetyBubbleData.length} genes with safety data
                  </div>
                </div>
              ) : (
                <p className="text-[12px] font-medium text-slate-400">No safety liability data for these genes.</p>
              )}
            </div>
          </Card>

          {/* 8. Chemical Probe Coverage */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-emerald-600" />
                <p className="text-[16px] font-extrabold text-slate-800">8. Chemical Probe Coverage</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Genes with available chemical probes</p>
            </div>
            <div className="px-5 py-3 flex items-center gap-6">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 36 36" className="h-full w-full">
                  <path d="M18 2.5a15.5 15.5 0 0 1 0 31 15.5 15.5 0 0 1 0-31z" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <path d="M18 2.5a15.5 15.5 0 0 1 0 31 15.5 15.5 0 0 1 0-31z" fill="none" stroke="url(#probeGrad)" strokeWidth="3" strokeDasharray={chemicalProbeData.pct + ", 100"} transform="rotate(-90 18 18)" />
                  <defs>
                    <linearGradient id="probeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#0d9488" />
                    </linearGradient>
                  </defs>
                  <text x="18" y="22" textAnchor="middle" className="text-[13px] font-extrabold fill-slate-700">{Math.round(chemicalProbeData.pct)}%</text>
                </svg>
              </div>
              <div className="flex flex-col gap-2">
                <div>
                  <span className="text-[15px] font-extrabold text-slate-800 tabular-nums">{chemicalProbeData.withProbes}</span>
                  <span className="text-[11px] text-slate-500 block">of {chemicalProbeData.total} genes have probes</span>
                </div>
                <div>
                  <span className="text-[15px] font-extrabold text-slate-800 tabular-nums">{chemicalProbeData.withHQ}</span>
                  <span className="text-[11px] text-slate-500 block">high-quality probes</span>
                </div>
                <div className="text-[9px] text-slate-400 mt-1">{Math.round(chemicalProbeData.pct)}% coverage</div>
              </div>
            </div>
          </Card>

          {/* 9. Pathway Enrichment Bars */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50">
              <div className="flex items-center gap-3">
                <Network className="h-6 w-6 text-violet-600" />
                <p className="text-[16px] font-extrabold text-slate-800">9. Pathway Enrichment</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Top Reactome pathways by gene overlap</p>
            </div>
            <div className="px-5 py-3">
              {pathwayBarData.length > 0 ? (
                <div className="space-y-2">
                  {pathwayBarData.map((p) => {
                    const maxCount = Math.max(...pathwayBarData.map((pp) => pp.count), 1);
                    return (
                      <div key={p.pathway} className="flex items-center gap-3">
                        <span className="w-36 text-[11px] font-bold text-slate-700 truncate" title={p.pathway}>
                          {p.pathway}
                        </span>
                        <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded transition-all flex items-center justify-end">
                            <span className="text-[10px] font-bold text-white px-1">{p.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] font-medium text-slate-400">No pathway data available.</p>
              )}
              <div className="mt-2 text-[9px] text-slate-400">Longer bars = more genes in that pathway</div>
            </div>
          </Card>

          {/* 10. Literature Impact Scatter */}
          <Card className="p-0 overflow-hidden border-2 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-orange-50 to-amber-50">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-orange-600" />
                <p className="text-[16px] font-extrabold text-slate-800">10. Literature Impact</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Publication count vs. association score</p>
            </div>
            <div className="px-5 py-3">
              {literatureScatterData.length > 0 ? (
                <div className="relative h-40 w-full border border-slate-200 rounded-lg bg-white">
                  <div className="absolute bottom-0 left-0 w-full h-px bg-slate-300" />
                  <div className="absolute top-0 left-0 w-px h-full bg-slate-300" />
                  <div className="absolute bottom-[-8px] left-2 text-[8px] font-bold text-slate-400">Low pubs</div>
                  <div className="absolute bottom-[-8px] right-2 text-[8px] font-bold text-slate-400">High pubs</div>
                  <div className="absolute top-[-12px] left-2 text-[8px] font-bold text-slate-400">Low score</div>
                  <div className="absolute top-[-12px] right-2 text-[8px] font-bold text-slate-400">High score</div>
                  {literatureScatterData.map((g) => (
                    <div
                      key={g.symbol}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                      style={{ left: (12 + g.xPct * 0.7) + "%", bottom: (12 + g.yPct * 0.6) + "%" }}
                      title={g.symbol + ": score=" + (g.score ?? 0).toFixed(3) + ", pubs=" + g.lit}
                    >
                      <div className="h-4 w-4 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 shadow border-2 border-white group-hover:scale-150 transition-transform" />
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[8px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 bg-white px-1 rounded border whitespace-nowrap">
                        {g.symbol} ({g.lit} pubs)
                      </div>
                    </div>
                  ))}
                  <div className="absolute bottom-1 right-1 text-[8px] text-slate-400">
                    {literatureScatterData.length} genes plotted
                  </div>
                </div>
              ) : (
                <p className="text-[12px] font-medium text-slate-400">No literature data available.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
