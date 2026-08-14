"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientSearchParams } from "@/utils/useClientSearchParams"
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card } from "@/components/ui";
import { fetchGene } from "@/lib/api";
import { listProjects, ProjectSummary } from "@/lib/auth";
import { GeneTargetObject } from "@/types/gene";

export default function SearchPage() {
  const searchParams = useClientSearchParams();
  const router = useRouter();
  const query = searchParams?.get("q") ?? "";
  const [searchText, setSearchText] = useState(query);
  const [geneResult, setGeneResult] = useState<GeneTargetObject | null>(null);
  const [projectResults, setProjectResults] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query !== searchText) {
      setSearchText(query);
    }
  }, [query, searchText]);

  useEffect(() => {
    if (!query) {
      setGeneResult(null);
      setProjectResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setGeneResult(null);

    fetchGene("homo_sapiens", "", query)
      .then((result) => {
        setGeneResult(result);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to resolve gene.");
      })
      .finally(() => {
        setLoading(false);
      });

    listProjects(query).then((results) => {
      setProjectResults(results);
    });
  }, [query]);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-4">
          <Card className="space-y-4 p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Search results
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Search results for “{query}”</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={() => router.push(`/?q=${encodeURIComponent(query)}`)}
                className="rounded-xl border border-[#E5E7EB] bg-slate-50 p-4 text-left transition hover:border-slate-300"
              >
                <p className="text-[12px] font-semibold text-slate-700">Genes</p>
                <p className="mt-2 text-[11px] text-slate-500">Search across gene names, symbols, and identifiers.</p>
              </button>
              <button
                type="button"
                onClick={() => router.push(`/targets?search=${encodeURIComponent(query)}`)}
                className="rounded-xl border border-[#E5E7EB] bg-slate-50 p-4 text-left transition hover:border-slate-300"
              >
                <p className="text-[12px] font-semibold text-slate-700">Targets</p>
                <p className="mt-2 text-[11px] text-slate-500">Browse target discovery content for the search term.</p>
              </button>
              <button
                type="button"
                onClick={() => router.push(`/projects?search=${encodeURIComponent(query)}`)}
                className="rounded-xl border border-[#E5E7EB] bg-slate-50 p-4 text-left transition hover:border-slate-300"
              >
                <p className="text-[12px] font-semibold text-slate-700">Projects</p>
                <p className="mt-2 text-[11px] text-slate-500">Locate projects by name, disease, or owner.</p>
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <p className="text-[12px] font-semibold text-slate-700">Gene match</p>
                {loading ? (
                  <p className="mt-2 text-[11px] text-slate-500">Resolving gene...</p>
                ) : error ? (
                  <p className="mt-2 text-[11px] text-red-600">{error}</p>
                ) : geneResult ? (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-500">Resolved gene</p>
                    <p className="text-[13px] font-semibold text-slate-800">{geneResult.geneSymbol} — {geneResult.geneName ?? "No name available"}</p>
                    <div className="grid gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
                      <div>Ensembl: {geneResult.geneId ?? "N/A"}</div>
                      <div>Entrez: {geneResult.entrezGeneId ?? "N/A"}</div>
                      <div>Type: {geneResult.geneType ?? "N/A"}</div>
                      <div>Chromosome: {geneResult.chromosome ?? "N/A"}</div>
                    </div>
                    <p className="text-[11px] text-slate-500">{geneResult.geneFunction ?? "No function summary available."}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10.5px] text-slate-700">Tissue: {geneResult.defaultTissue ?? "N/A"}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10.5px] text-slate-700">TPM: {geneResult.tissueTpm ?? "N/A"}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10.5px] text-slate-700">GO BP: {geneResult.goBiologicalProcessHighlight ?? "N/A"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/?q=${encodeURIComponent(query)}`)}
                      className="inline-flex rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-dark"
                    >
                      Open on dashboard
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500">Enter a gene query to lookup the live backend.</p>
                )}
              </div>
              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <p className="text-[12px] font-semibold text-slate-700">Project match</p>
                {projectResults.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {projectResults.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="rounded-lg border border-[#E5E7EB] bg-white p-3 hover:border-brand/30 transition-colors"
                      >
                        <p className="text-[12px] font-semibold text-slate-800">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10.5px] text-slate-400">
                          {p.geneSymbol && <span>{p.geneSymbol}</span>}
                          {p.disease && <span>{p.disease}</span>}
                          <span className="ml-auto">{p.status}</span>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => router.push(`/projects?search=${encodeURIComponent(query)}`)}
                      className="mt-2 inline-flex rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View all {projectResults.length} project{projectResults.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="mt-2 text-[11px] text-slate-500">No matching projects found.</p>
                    <button
                      type="button"
                      onClick={() => router.push(`/projects?search=${encodeURIComponent(query)}`)}
                      className="mt-3 inline-flex rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Browse all projects
                    </button>
                  </div>
                )}
              </div>
            </div>

            {geneResult && (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Gene details</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Clinical association</p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-800">{geneResult.diseaseAssociation ?? "None identified"}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Source: {geneResult.diseaseAssociationSource?.join(" · ") || "N/A"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Pathway highlight</p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-800">{geneResult.pathwayHighlight ?? "N/A"}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Go BP: {geneResult.goBiologicalProcessHighlight ?? "N/A"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Clinical evidence</p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-800">OMIM: {geneResult.omimId ?? "N/A"}</p>
                    <p className="mt-1 text-[11px] text-slate-500">ClinVar top variant: {geneResult.topHgvsName ?? geneResult.topRsId ?? "N/A"}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-[#E5E7EB] bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next steps</p>
              <ul className="mt-3 space-y-2 text-[11px] text-slate-600 list-disc list-inside">
                <li>Gene searches resolve via the live backend and can be opened in the dashboard.</li>
                <li>Target discovery results land on the existing target page.</li>
                <li>Project search queries the backend and shows matching projects inline.</li>
              </ul>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
