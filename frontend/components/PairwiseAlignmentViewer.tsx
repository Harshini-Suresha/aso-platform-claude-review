"use client";

import { useState } from "react";

interface Feature {
  start: number;
  end: number;
  label: string;
  type: string;
  color: string;
}

function formatSeq(line: string, highlights: { offset: number; length: number; color: string }[]): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let pos = 0;

  const sorted = [...highlights].sort((a, b) => a.offset - b.offset);

  for (const hl of sorted) {
    if (hl.offset > pos) {
      result.push(<span key={`u-${pos}`}>{line.slice(pos, hl.offset)}</span>);
    }
    const start = Math.max(pos, hl.offset);
    const end = Math.min(line.length, hl.offset + hl.length);
    if (end > start) {
      result.push(
        <span
          key={`h-${hl.offset}`}
          className="rounded-sm px-px"
          style={{ backgroundColor: hl.color + "30", color: hl.color, borderBottom: `2px solid ${hl.color}` }}
        >
          {line.slice(start, end)}
        </span>
      );
    }
    pos = end;
  }

  if (pos < line.length) {
    result.push(<span key={`t-${pos}`}>{line.slice(pos)}</span>);
  }

  return result.length > 0 ? result : [<span key="full">{line}</span>];
}

export default function PairwiseAlignmentViewer({
  sequence,
  features = [],
}: {
  sequence: string;
  features?: Feature[];
}) {
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);
  const LINE_LEN = 60;
  const lines: string[] = [];
  for (let i = 0; i < sequence.length; i += LINE_LEN) {
    lines.push(sequence.slice(i, i + LINE_LEN));
  }

  const selectedFeat = selectedFeature !== null ? features[selectedFeature] : null;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-semibold text-slate-800">
          Sequence Alignment View
        </p>
        <span className="text-[10px] text-slate-400">
          {sequence.length} nt · {lines.length} lines
        </span>
      </div>

      {/* Feature legend */}
      {features.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {features.slice(0, 12).map((f, i) => (
            <button
              key={i}
              onClick={() => setSelectedFeature(selectedFeature === i ? null : i)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors border ${
                selectedFeature === i
                  ? "ring-1 ring-offset-1"
                  : "hover:opacity-80"
              }`}
              style={{
                backgroundColor: f.color + "15",
                borderColor: f.color + "40",
                color: f.color,
                ...(selectedFeature === i ? { ringColor: f.color } : {}),
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: f.color }} />
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Alignment text block */}
      <div className="rounded-lg bg-slate-900 p-4 overflow-x-auto font-mono text-[11px] leading-relaxed">
        {lines.map((line, lineIdx) => {
          const lineStart = lineIdx * LINE_LEN;
          const lineEnd = lineStart + line.length;

          // Find features that overlap this line
          const highlights: { offset: number; length: number; color: string }[] = [];
          for (const feat of features) {
            if (feat.end <= lineStart || feat.start > lineEnd) continue;
            const start = Math.max(feat.start - 1, lineStart) - lineStart;
            const end = Math.min(feat.end, lineEnd) - lineStart;
            highlights.push({ offset: start, length: end - start, color: feat.color });
          }

          return (
            <div key={lineIdx} className="flex">
              {/* Position ruler */}
              <span className="w-12 shrink-0 text-right text-slate-500 select-none pr-3">
                {String(lineStart + 1).padStart(4)}
              </span>
              {/* Sequence with highlights */}
              <span className="text-emerald-300">
                {formatSeq(line, highlights)}
              </span>
              {/* Right ruler */}
              <span className="w-12 shrink-0 text-left text-slate-500 select-none pl-3">
                {String(lineEnd).padStart(4)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Position ruler bar */}
      <div className="mt-1 flex font-mono text-[9px] text-slate-400 select-none">
        <span className="w-12 shrink-0" />
        <span className="flex-1 flex justify-between">
          {Array.from({ length: Math.ceil(sequence.length / LINE_LEN) + 1 }, (_, i) => {
            const pos = i * LINE_LEN;
            return pos <= sequence.length ? (
              <span key={i} className="w-6 text-center">{pos}</span>
            ) : null;
          })}
        </span>
      </div>

      {/* Selected feature detail */}
      {selectedFeat && (
        <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-slate-50 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: selectedFeat.color }}
            />
            <span className="text-[12px] font-semibold text-slate-700">
              {selectedFeat.label}
            </span>
            <span className="text-[10px] text-slate-400">
              {selectedFeat.type}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>
              Position: {selectedFeat.start}–{selectedFeat.end}
            </span>
            <span>Length: {selectedFeat.end - selectedFeat.start + 1} nt</span>
          </div>
          <pre className="mt-2 rounded bg-slate-800 px-3 py-2 text-[10px] text-emerald-300 font-mono overflow-x-auto">
            {sequence.slice(selectedFeat.start - 1, selectedFeat.end)}
          </pre>
        </div>
      )}

      {features.length === 0 && (
        <p className="mt-2 text-[11px] text-slate-400 text-center">
          No annotated features to highlight. Switch to Features tab for a full table.
        </p>
      )}

      <p className="mt-3 text-[10px] text-slate-400">
        Sequence displayed in 60-character lines with position rulers. Click
        feature badges above to highlight and inspect specific regions.
      </p>
    </>
  );
}
