"use client";

interface RepeatMaskingMapProps {
  repeatUnit: string;
  oligoLength: number;
  tilingPattern: string;
  selectedCandidateSequence?: string;
}

export default function RepeatMaskingMap({
  repeatUnit,
  oligoLength,
  tilingPattern,
  selectedCandidateSequence,
}: RepeatMaskingMapProps) {
  const unitLen = repeatUnit.length;
  const repeatCount = Math.max(8, Math.ceil(oligoLength / unitLen) + 3);
  const expandedRepeat = Array(repeatCount).fill(repeatUnit).join("");

  const bindingStart = Math.floor((repeatCount * unitLen - oligoLength) / 2);
  const bindingEnd = bindingStart + oligoLength;

  const tilingOffsets = tilingPattern.includes("Frame-Shifted")
    ? [0, 1, 2]
    : tilingPattern.includes("Complementary")
      ? [0]
      : [0, 1];

  function getNucleotideColor(char: string): string {
    switch (char.toUpperCase()) {
      case "A": return "bg-red-400";
      case "C": return "bg-blue-400";
      case "G": return "bg-green-400";
      case "U": return "bg-amber-400";
      case "T": return "bg-amber-400";
      default: return "bg-slate-300";
    }
  }

  function isInBindingZone(pos: number, offset: number): boolean {
    const adjustedStart = bindingStart + offset;
    const adjustedEnd = adjustedStart + oligoLength;
    return pos >= adjustedStart && pos < adjustedEnd;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-red-400" />
          <span className="text-slate-500">A</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-blue-400" />
          <span className="text-slate-500">C</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-green-400" />
          <span className="text-slate-500">G</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
          <span className="text-slate-500">U</span>
        </div>
        <span className="ml-4 text-slate-400">|</span>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-indigo-200 border border-indigo-400" />
          <span className="text-slate-500">ASO binding zone</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Expanded Repeat Tract ({repeatUnit})<sub>{repeatCount}</sub>
          </p>
          <p className="text-[10px] text-slate-400">
            {repeatCount * unitLen} nt total
          </p>
        </div>

        <div className="flex flex-wrap gap-px font-mono text-[11px] leading-tight">
          {expandedRepeat.split("").map((nt, i) => {
            const inBinding = tilingOffsets.some((off) => isInBindingZone(i, off));
            return (
              <span
                key={i}
                className={`inline-flex h-5 w-4 items-center justify-center rounded-sm text-[9px] font-bold text-white ${
                  inBinding ? "ring-1 ring-indigo-400 ring-offset-1" : ""
                } ${getNucleotideColor(nt)} ${inBinding ? "opacity-100" : "opacity-50"}`}
                title={`Position ${i + 1}: ${nt}${inBinding ? " (ASO bound)" : ""}`}
              >
                {nt}
              </span>
            );
          })}
        </div>

        <div className="mt-4 space-y-1.5">
          {tilingOffsets.map((offset, idx) => (
            <div key={offset} className="flex items-center gap-2">
              <span className="w-20 text-[10px] font-semibold text-slate-500">
                {idx === 0 ? "Candidate" : `Frame +${offset}`}
              </span>
              <div className="flex-1 relative h-3 rounded-sm bg-slate-200">
                <div
                  className={`absolute top-0 h-full rounded-sm ${
                    idx === 0 ? "bg-indigo-400" : idx === 1 ? "bg-purple-400" : "bg-pink-400"
                  }`}
                  style={{
                    left: `${(bindingStart + offset) / (repeatCount * unitLen) * 100}%`,
                    width: `${oligoLength / (repeatCount * unitLen) * 100}%`,
                  }}
                />
              </div>
              <span className="w-16 text-right text-[9px] text-slate-400">
                {bindingStart + offset + 1}–{bindingStart + offset + oligoLength}
              </span>
            </div>
          ))}
        </div>
      </div>

      {selectedCandidateSequence && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
            Selected ASO Binding (5′→3′)
          </p>
          <div className="flex flex-wrap gap-px font-mono text-[11px]">
            {selectedCandidateSequence.split("").map((nt, i) => (
              <span
                key={i}
                className={`inline-flex h-5 w-4 items-center justify-center rounded-sm text-[9px] font-bold text-white ${getNucleotideColor(nt)}`}
              >
                {nt}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
