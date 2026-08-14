import HelpPageShell from "@/components/HelpPageShell";
import { Card } from "@/components/ui";

const GOALS = [
  { id: "TG01", name: "Gene Silencing", desc: "Reduce expression of a pathogenic gene or transcript through transcriptional or post-transcriptional mechanisms.", status: "Live in Mechanism Selection" },
  { id: "TG04", name: "RNA Processing Modulation", desc: "Correct or redirect splicing (exon skipping/inclusion), block cryptic splice sites, or modulate polyadenylation.", status: "Live in Mechanism Selection" },
  { id: "TG02", name: "Gene Activation / Upregulation", desc: "Increase expression of an underexpressed gene, e.g. targeting antisense long non-coding RNAs.", status: "Live in Mechanism Selection" },
  { id: "TG03", name: "RNA Editing / Correction", desc: "Direct site-specific editing of RNA (e.g. ADAR-recruiting ASOs, APOBEC/RESCUE, trans-splicing) to correct a pathogenic base or replace a mutated transcript segment.", status: "Live in Mechanism Selection" },
  { id: "TG05", name: "Protein Replacement (mRNA)", desc: "Deliver an mRNA encoding a missing or defective protein.", status: "Rulebook data only" },
  { id: "TG06", name: "Isoform Engineering", desc: "Shift the balance between naturally occurring splice isoforms toward a more favorable one.", status: "Rulebook data only" },
];

export default function RnaTherapeuticsGuidePage() {
  return (
    <HelpPageShell
      title="RNA Therapeutics Guide"
      subtitle="Background on RNA-targeted therapeutic approaches and how they map to this platform's rulebook."
    >
      <Card className="p-5">
        <p className="text-[13px] leading-relaxed text-slate-600">
          RNA-targeted therapeutics act on a disease-causing gene at the RNA level rather than
          editing the genome or supplying a small-molecule drug. Antisense oligonucleotides (ASOs),
          siRNAs, and related chemistries bind a target RNA through Watson-Crick base pairing and
          either recruit a degradation enzyme (RNase H, RISC), physically block a process (translation,
          splicing), or modulate another RNA-binding event. The right mechanism depends heavily on
          the specific molecular defect — a loss-of-function mutation calls for a very different
          approach than a splicing defect or a toxic RNA gain-of-function.
        </p>
      </Card>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-slate-700">
          Therapeutic goals in this platform&apos;s rulebook
        </p>
        <div className="space-y-2">
          {GOALS.map((g) => (
            <Card key={g.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">
                    {g.id} — {g.name}
                  </p>
                  <p className="mt-1 text-[12.5px] text-slate-600">{g.desc}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                    g.status === "Live in Mechanism Selection"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {g.status}
                </span>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-slate-400">
          This lists a representative subset of the 9 therapeutic goals in the rulebook, not the
          full set of 26 individual mechanisms.
        </p>
      </div>
    </HelpPageShell>
  );
}
