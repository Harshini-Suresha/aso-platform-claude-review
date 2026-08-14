"use client";

import { useState } from "react";

interface Feature {
  start: number;
  end: number;
  label: string;
  type: string;
  color: string;
}

const TYPE_COLORS: Record<string, string> = {
  restriction: "#ec4899",
  mirna: "#8b5cf6",
  immune: "#f59e0b",
  orfs: "#3b82f6",
  complexity: "#ef4444",
  structure: "#10b981",
  pam: "#f97316",
};

const BASE_COLORS: Record<string, string> = {
  A: "#f59e0b",
  C: "#3b82f6",
  G: "#10b981",
  T: "#ef4444",
  U: "#8b5cf6",
};

export default function AnnotatedSequenceViewer({
  sequence,
  features = [],
  maxVisible = 300,
}: {
  sequence: string;
  features?: Feature[];
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const displaySeq = expanded ? sequence : sequence.slice(0, maxVisible);
  const LINE_LEN = 60;

  // Build feature map: position -> list of features covering it
  const posFeatures: Map<number, Feature[]> = new Map();
  for (const feat of features) {
    for (let pos = feat.start; pos <= Math.min(feat.end, displaySeq.length); pos++) {
      if (!posFeatures.has(pos)) posFeatures.set(pos, []);
      posFeatures.get(pos)!.push(feat);
    }
  }

  // Group features by type for the track
  const featureTypes = [...new Set(features.map((f) => f.type))];

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          Annotated Sequence
        </p>
        <span className="text-[10px] text-slate-400">
          {sequence.length} nt · {features.length} annotations
        </span>
      </div>

      {/* Feature track legend */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {featureTypes.map((type) => {
          const color = TYPE_COLORS[type] ?? "#64748b";
          const count = features.filter((f) => f.type === type).length;
          return (
            <span
              key={type}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
              style={{ backgroundColor: color + "15", color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {type} ({count})
            </span>
          );
        })}
      </div>

      {/* Feature track bar */}
      <div className="relative h-5 rounded bg-slate-100 mb-2 overflow-hidden">
        {features.map((feat, i) => {
          const left = ((feat.start - 1) / sequence.length) * 100;
          const width = Math.max(((feat.end - feat.start + 1) / sequence.length) * 100, 0.5);
          return (
            <div
              key={i}
              className="absolute top-0 h-full rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: feat.color,
                opacity: 0.7,
              }}
              onMouseEnter={(e) =>
                setTooltip({
                  x: e.clientX,
                  y: e.clientY,
                  text: `${feat.label} @ ${feat.start}–${feat.end}`,
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
        {/* Position markers */}
        {Array.from({ length: 7 }, (_, i) => Math.round((sequence.length * i) / 6)).map(
          (pos) => (
            <div
              key={pos}
              className="absolute top-0 h-full border-l border-slate-300"
              style={{ left: `${(pos / sequence.length) * 100}%` }}
            />
          )
        )}
      </div>
      <div className="flex justify-between text-[8px] text-slate-400 mb-3 select-none">
        <span>1</span>
        <span>{Math.round(sequence.length / 2)}</span>
        <span>{sequence.length}</span>
      </div>

      {/* Annotated sequence text */}
      <div
        className="rounded-lg bg-slate-900 p-4 overflow-x-auto font-mono text-[11px] leading-relaxed select-all"
        onMouseLeave={() => setSelectedPos(null)}
      >
        {Array.from({ length: Math.ceil(displaySeq.length / LINE_LEN) }, (_, lineIdx) => {
          const lineStart = lineIdx * LINE_LEN;
          const lineEnd = Math.min(lineStart + LINE_LEN, displaySeq.length);
          const line = displaySeq.slice(lineStart, lineEnd);

          return (
            <div key={lineIdx} className="flex">
              {/* Position */}
              <span className="w-10 shrink-0 text-right text-slate-500 select-none pr-2">
                {String(lineStart + 1).padStart(4)}
              </span>
              {/* Bases */}
              <span className="flex-1">
                {line.split("").map((base, i) => {
                  const pos = lineStart + i + 1;
                  const feats = posFeatures.get(pos) ?? [];
                  const baseColor = BASE_COLORS[base] ?? "#94a3b8";
                  const isHighlighted = feats.length > 0;
                  const isSelected = selectedPos === pos;

                  return (
                    <span
                      key={i}
                      className={`cursor-pointer transition-all ${
                        isSelected ? "bg-white/30 rounded-sm" : ""
                      }`}
                      style={{
                        color: isHighlighted ? "#ffffff" : baseColor,
                        textShadow: isHighlighted
                          ? `0 0 6px ${feats[0]?.color ?? "#fff"}`
                          : undefined,
                        borderBottom: isHighlighted
                          ? `2px solid ${feats[0]?.color ?? "#fff"}`
                          : undefined,
                      }}
                      onMouseEnter={() => setSelectedPos(pos)}
                    >
                      {base}
                    </span>
                  );
                })}
              </span>
              {/* Right position */}
              <span className="w-10 shrink-0 text-left text-slate-500 select-none pl-2">
                {String(lineEnd).padStart(4)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Selected position info */}
      {selectedPos && selectedPos <= displaySeq.length && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-[10px]">
          <span className="text-slate-400">Position</span>
          <span className="font-mono font-semibold text-white">{selectedPos}</span>
          <span className="text-slate-400">Base</span>
          <span
            className="font-mono font-bold"
            style={{ color: BASE_COLORS[displaySeq[selectedPos - 1]] ?? "#94a3b8" }}
          >
            {displaySeq[selectedPos - 1]}
          </span>
          {(posFeatures.get(selectedPos) ?? []).map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium"
              style={{ backgroundColor: f.color + "25", color: f.color }}
            >
              {f.label}
            </span>
          ))}
        </div>
      )}

      {/* Expand/collapse */}
      {!expanded && sequence.length > maxVisible && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-[11px] font-medium text-brand hover:underline"
        >
          Show full sequence ({sequence.length} nt)
        </button>
      )}
      {expanded && sequence.length > maxVisible && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-2 text-[11px] font-medium text-brand hover:underline"
        >
          Collapse to first {maxVisible} nt
        </button>
      )}

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-white shadow-lg"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}
