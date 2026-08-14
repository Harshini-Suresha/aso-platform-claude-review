"use client";

import { useEffect, useState } from "react";
import { FileText, Trash2, ChevronDown, ChevronRight, Beaker, Dna, TestTube, Search, ExternalLink } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { listReports, deleteReport, type ReportSummary } from "@/lib/auth";

const STEP_ICONS: Record<string, typeof FileText> = {
  gene_lookup: Search,
  mechanism: Beaker,
  aso_design: Dna,
  sequence_analysis: TestTube,
  upload: TestTube,
};

const STEP_LABELS: Record<string, string> = {
  gene_lookup: "Gene Lookup",
  mechanism: "Mechanism Analysis",
  aso_design: "ASO Design",
  sequence_analysis: "Sequence Analysis",
  upload: "Sequence Upload",
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    listReports().then((data) => {
      setReports(data);
      setLoading(false);
    });
  }, [user]);

  const handleDelete = async (id: number) => {
    await deleteReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><FileText className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Reports</p><p className="text-[11px] text-slate-500">{reports.length} saved report{reports.length !== 1 ? "s" : ""}</p></div>
          </Card>

          <Card>
            <SectionHeader title="Pipeline Reports" />
            <div className="px-5 pb-5">
              {loading ? (
                <p className="text-[12px] text-slate-400 py-4 text-center">Loading reports...</p>
              ) : reports.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-4 text-center">No reports yet. Run a pipeline analysis to generate your first report.</p>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => {
                    const Icon = STEP_ICONS[report.step] || FileText;
                    const isExpanded = expandedId === report.id;
                    return (
                      <div key={report.id} className="rounded-lg border border-[#E5E7EB] bg-white">
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                          onClick={() => setExpandedId(isExpanded ? null : report.id)}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100">
                            <Icon className="h-3.5 w-3.5 text-slate-500" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-800 truncate">{report.title}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{STEP_LABELS[report.step] || report.step}</span>
                              {report.geneSymbol && <span className="font-medium text-slate-500">{report.geneSymbol}</span>}
                              {report.disease && <span className="truncate">• {report.disease}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatDate(report.createdAt)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                            className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                        </div>
                        {isExpanded && (
                          <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                            {report.summary && (
                              <p className="text-[11px] text-slate-600 mb-2">{report.summary}</p>
                            )}
                            <p className="text-[10px] text-slate-400">Report ID: {report.id} • Saved {formatDate(report.createdAt)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
