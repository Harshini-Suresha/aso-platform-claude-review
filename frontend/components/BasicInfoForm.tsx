"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Dna, Loader2 } from "lucide-react";
import { Card, SectionHeader, FieldLabel } from "./ui";
import OrganismSelect from "./OrganismSelect";
import { suggestGenes, type GeneSuggestion } from "@/lib/geneSearchApi";

interface Props {
  organism: string;
  setOrganism: (v: string) => void;
  diseaseName: string;
  setDiseaseName: (v: string) => void;
  geneSymbol: string;
  setGeneSymbol: (v: string) => void;
  onLoadGene: (symbol?: string) => void;
  loading: boolean;
  geneFieldsDisabled?: boolean;
  geneLoaded?: boolean;
}

export default function BasicInfoForm({
  organism,
  setOrganism,
  diseaseName,
  setDiseaseName,
  geneSymbol,
  setGeneSymbol,
  onLoadGene,
  loading,
  geneFieldsDisabled = false,
  geneLoaded = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<GeneSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const trimmed = geneSymbol.trim();
    if (!trimmed || geneFieldsDisabled || loading || geneLoaded) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSuggestionLoading(true);
      try {
        const results = await suggestGenes(trimmed, organism, 8);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSuggestionLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [geneSymbol, organism, geneFieldsDisabled]);

  function handleSelectSuggestion(symbol: string) {
    setGeneSymbol(symbol);
    setSuggestions([]);
    setShowSuggestions(false);
    if (!loading && !geneFieldsDisabled) {
      onLoadGene(symbol);
    }
  }

  function handleInputFocus() {
    if (suggestions.length > 0 && !geneFieldsDisabled) {
      setShowSuggestions(true);
    }
  }

  function handleInputBlur() {
    setTimeout(() => setShowSuggestions(false), 150);
  }

  return (
    <Card>
      <SectionHeader step="1" title="Basic Information" />
      <div className="grid grid-cols-1 gap-3 px-5 pb-2 md:grid-cols-3">
        {/* Organism */}
        <div>
          <FieldLabel hint="Grouped by clinical, model, veterinary, plant, viral, and bacterial species">
            Organism <span className="text-red-500">*</span>
          </FieldLabel>
          <OrganismSelect value={organism} onChange={setOrganism} />
        </div>

        {/* Disease name */}
        <div>
          <FieldLabel hint="A free-text label for your project. The Disease Association shown after loading comes from live Ensembl/Open Targets data for the gene, not from this field.">
            Disease Name
          </FieldLabel>
          <div className="relative">
            <input
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
              placeholder="e.g. Duchenne Muscular Dystrophy"
              className="w-full rounded border border-slate-300 bg-white py-2 pl-3 pr-9 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {diseaseName && (
              <button
                onClick={() => setDiseaseName("")}
                aria-label="Clear disease name"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Gene symbol */}
        <div>
          <FieldLabel hint="Any gene symbol recognized by Ensembl for the selected organism, e.g. DMD, TP53, Brca1">
            Gene Symbol <span className="text-red-500">*</span>
          </FieldLabel>
          <div className="relative">
            <input
              value={geneSymbol}
              onChange={(e) => setGeneSymbol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !geneFieldsDisabled && onLoadGene()}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={geneFieldsDisabled}
              placeholder="e.g. DMD"
              className="w-full rounded border border-slate-300 bg-white py-2 pl-3 pr-14 text-[12.5px] font-medium text-slate-700 placeholder:font-normal placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {geneSymbol && (
                <button
                  onClick={() => {
                    setGeneSymbol("");
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                  aria-label="Clear gene symbol"
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="px-5 pb-2">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((s, idx) => (
              <button
                key={`${s.symbol}-${idx}`}
                onMouseDown={() => handleSelectSuggestion(s.symbol)}
                className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-brand/5 transition-colors duration-150 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex flex-col">
                  <span className="text-[12px] font-semibold text-slate-700">{s.symbol}</span>
                  <span className="text-[10.5px] text-slate-500 truncate max-w-[320px]">{s.name}</span>
                </div>
                <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  {s.source}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end px-5 pb-3 pt-2">
        <button
          onClick={() => onLoadGene()}
          disabled={loading || !geneSymbol.trim() || geneFieldsDisabled}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[12.5px] font-medium text-white transition-all duration-200 hover:bg-brand-dark hover:shadow-md hover:shadow-brand/20 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:transform-none"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Dna className="h-3.5 w-3.5" />
          )}
          {loading ? "Loading Gene..." : "Load Gene"}
        </button>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="px-5 pb-4">
          <div className="rounded-lg border border-[#E5E7EB] bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <p className="text-[12px] font-medium text-slate-500">
                Loading gene data...
              </p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-400 animate-loading-bar" />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
