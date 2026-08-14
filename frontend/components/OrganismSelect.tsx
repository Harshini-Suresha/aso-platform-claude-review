"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Dna } from "lucide-react";
import { ORGANISMS, Organism, getOrganism } from "@/lib/organisms";

interface Props {
  value: string;
  onChange: (organismId: string) => void;
}

// Distinct background color per tier for quick visual scanning
const TIER_COLORS: Record<number, string> = {
  1: "bg-blue-50",
  2: "bg-emerald-50",
  3: "bg-amber-50",
  4: "bg-rose-50",
  5: "bg-purple-50",
  6: "bg-indigo-50",
};

export default function OrganismSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = getOrganism(value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query.trim()
    ? ORGANISMS.filter(
        (o) =>
          o.commonName.toLowerCase().includes(query.toLowerCase()) ||
          o.scientificName.toLowerCase().includes(query.toLowerCase())
      )
    : ORGANISMS;

  const tiers = [1, 2, 3, 4, 5, 6] as const;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-left text-[12.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        <span className="relative flex-1 truncate">
          <Dna className="pointer-events-none absolute -left-[26px] top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          {selected ? (
            <>
              {selected.commonName}{" "}
              <span className="text-slate-400 italic">({selected.scientificName})</span>
            </>
          ) : (
            "Select organism"
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[340px] border border-[#E5E7EB] bg-white shadow-lg overflow-hidden">
          <div className="border-b border-slate-100 bg-white p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search organisms..."
                className="w-full rounded border border-[#E5E7EB] bg-slate-50 py-1.5 pl-8 pr-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {tiers.map((tier) => {
              const items = filtered.filter((o) => o.tier === tier);
              if (items.length === 0) return null;

              return (
                <div key={tier} className={`${TIER_COLORS[tier]}`}>
                  <div className="sticky top-0 z-10 px-4 py-1.5 font-bold uppercase tracking-widest text-[9px] text-slate-600 bg-black/5">
                    Tier {tier}
                  </div>
                  <div className="p-1">
                    {items.map((o) => (
                      <OrganismRow
                        key={o.id}
                        organism={o}
                        selected={o.id === value}
                        onSelect={() => {
                          onChange(o.id);
                          setOpen(false);
                          setQuery("");
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-[13px] text-slate-400">
                No organisms match &ldquo;{query}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OrganismRow({
  organism,
  selected,
  onSelect,
}: {
  organism: Organism;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[13px] transition-colors ${
        selected
          ? "bg-black/10 font-medium text-slate-900"
          : "text-slate-700 hover:bg-black/5"
      }`}
    >
      <span className="truncate">
        {organism.commonName}{" "}
        <span className="italic text-slate-500/70 ml-1">({organism.scientificName})</span>
      </span>
      {organism.status === "curated" ? (
        <span className="ml-2 shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-700">
          Curated
        </span>
      ) : null}
    </button>
  );
}
