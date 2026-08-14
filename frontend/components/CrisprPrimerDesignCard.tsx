"use client";

import { Copy, Check, Download } from "lucide-react";
import { useState } from "react";
import { GrnaCandidate } from "@/types/upload";
import { Card } from "@/components/ui";

interface PrimerDesignProps {
  candidates: GrnaCandidate[];
  sequence: string;
}

function tmSimple(seq: string): number {
  const upper = seq.toUpperCase();
  const len = upper.length;
  if (len === 0) return 0;
  const gc = (upper.match(/[GC]/g) || []).length;
  const at = len - gc;
  return Math.round((64.9 + 41 * (gc - 16.4) / len) * 10) / 10;
}

function revComp(seq: string): string {
  const comp: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
  return seq.split("").reverse().map((b) => comp[b] ?? "N").join("");
}

function designPcrPrimers(seq: string, pamPos: number): { fwd: string; rev: string; fwdTm: number; revTm: number; productSize: number } {
  const winSize = 18;
  const fwdStart = Math.max(0, pamPos - winSize);
  const fwd = seq.slice(fwdStart, pamPos).toUpperCase();
  const revStart = pamPos + 23;
  const revRaw = seq.slice(revStart, revStart + winSize).toUpperCase();
  const rev = revRaw.length > 0 ? revComp(revRaw) : "";
  return {
    fwd,
    rev,
    fwdTm: tmSimple(fwd),
    revTm: tmSimple(rev),
    productSize: fwd.length + 23 + rev.length,
  };
}

function designExpressionPrimers(spacer: string, pam: string): {
  forward: string;
  reverse: string;
  forwardTm: number;
  reverseTm: number;
} {
  const gRNA5 = "G" + spacer;
  const gRNA3 = pam;
  const reverse = revComp(gRNA5);
  return {
    forward: gRNA5,
    reverse,
    forwardTm: tmSimple(gRNA5),
    reverseTm: tmSimple(reverse),
  };
}

export default function CrisprPrimerDesignCard({ candidates, sequence }: PrimerDesignProps) {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  if (!candidates.length) return null;

  const c = candidates[selected];
  const pcr = designPcrPrimers(sequence, c.position - 1);
  const expr = designExpressionPrimers(c.sequence, c.pam);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[14px] font-semibold text-slate-800 flex items-center gap-1.5">
          gRNA Cloning &amp; PCR Primers
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {candidates.length} candidates
          </span>
        </p>
        <select
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        >
          {candidates.map((cand, i) => (
            <option key={cand.id} value={i}>
              #{i + 1} · pos {cand.position} · {cand.sequence.substring(0, 8)}…
            </option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-[12px] text-slate-500">
        Selected guide: <strong className="font-mono text-slate-700">{c.sequence}</strong> + <strong className="font-mono text-slate-500">{c.pam}</strong> at position {c.position} ({c.strand} strand)
      </p>

      {/* Expression / Cloning Primers */}
      <div className="mb-4">
        <p className="mb-2 text-[12px] font-medium text-slate-600">Expression / Cloning Primers (U6 promoter)</p>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase text-slate-400">Forward (5′→3′)</p>
            <p className="mt-0.5 font-mono text-slate-800 break-all">{expr.forward}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Tm: {expr.forwardTm}°C</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase text-slate-400">Reverse (5′→3′)</p>
            <p className="mt-0.5 font-mono text-slate-800 break-all">{expr.reverse}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Tm: {expr.reverseTm}°C</p>
          </div>
        </div>
      </div>

      {/* PCR Primers */}
      <div className="mb-4">
        <p className="mb-2 text-[12px] font-medium text-slate-600">PCR Primers (on-target amplification)</p>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase text-slate-400">Forward (5′→3′)</p>
            <p className="mt-0.5 font-mono text-slate-800 break-all">{pcr.fwd || "—"}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Tm: {pcr.fwdTm}°C</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase text-slate-400">Reverse (5′→3′)</p>
            <p className="mt-0.5 font-mono text-slate-800 break-all">{pcr.rev || "—"}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Tm: {pcr.revTm}°C</p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Product size: ~{pcr.productSize} bp</p>
      </div>

      {/* Copy buttons */}
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => copyText(`${expr.forward}\n${expr.reverse}`)}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[10.5px] text-slate-600 hover:bg-white"
        >
          {copied === `${expr.forward}\n${expr.reverse}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          Copy Expression Primers
        </button>
        <button
          onClick={() => copyText(`${pcr.fwd}\n${pcr.rev}`)}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[10.5px] text-slate-600 hover:bg-white"
        >
          {copied === `${pcr.fwd}\n${pcr.rev}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          Copy PCR Primers
        </button>
        <button
          onClick={() => {
            const csv = [
              `guide_id,guide_sequence,pam,position,strand,forward_primer,reverse_primer,forward_tm,reverse_tm,product_size`,
              `${c.id},${c.sequence},${c.pam},${c.position},${c.strand},${expr.forward},${expr.reverse},${expr.forwardTm},${expr.reverseTm},N/A`,
              `${c.id},${c.sequence},${c.pam},${c.position},${c.strand},${pcr.fwd},${pcr.rev},${pcr.fwdTm},${pcr.revTm},${pcr.productSize}`,
            ].join("\n");
            copyText(csv);
          }}
          className="ml-auto flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[10.5px] text-slate-600 hover:bg-white"
        >
          <Download className="h-3 w-3" />
          Download CSV
        </button>
      </div>
    </Card>
  );
}
