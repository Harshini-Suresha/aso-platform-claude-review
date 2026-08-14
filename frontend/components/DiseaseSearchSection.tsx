"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { getOrganism } from "@/lib/organisms";

export default function DiseaseSearchSection({
  organismId,
  active,
  onActivate,
  onDeactivate,
  onSelectGene,
}: {
  organismId: string;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onSelectGene?: (symbol: string, disease: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const organism = getOrganism(organismId);
  const organismName = organism?.commonName ?? organismId;

  function handleSearch() {
    if (!query.trim()) return;
    router.push(
      `/disease-search?query=${encodeURIComponent(query.trim())}&organism=${encodeURIComponent(organismId)}`
    );
  }

  function handleClear() {
    setQuery("");
    onDeactivate();
  }

  return (
    <div className={`rounded-xl border p-4 transition-colors ${active ? "border-emerald-500 bg-emerald-50/70" : "border-emerald-200 bg-emerald-50/40"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100">
            <Search className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2} />
          </span>
          <p className="text-[13px] font-bold text-emerald-700">Search by Disease</p>
        </div>
        {active && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
            Clear, search by gene instead
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[12px] text-emerald-800/70">
        Don&apos;t know the gene yet? Search by disease name — associations are human-based (Open Targets) and
        {organismName.toLowerCase() === "human" ? " run directly on" : ` mapped to ${organismName} orthologs for`} your selected organism.
      </p>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length > 0) onActivate();
              else onDeactivate();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Duchenne Muscular Dystrophy"
            className="w-full rounded-lg border border-emerald-200 bg-white py-2.5 pl-9 pr-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim()}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Search
        </button>
      </div>
    </div>
  );
}
