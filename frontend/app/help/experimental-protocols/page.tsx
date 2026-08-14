import HelpPageShell from "@/components/HelpPageShell";
import { Card } from "@/components/ui";
import { Info } from "lucide-react";

const CATEGORIES = [
  {
    name: "Knockdown / silencing validation",
    desc: "RT-qPCR is the standard first-line method for confirming transcript-level knockdown after ASO/siRNA transfection, typically normalized against a stable housekeeping gene and compared to a scrambled-sequence control.",
  },
  {
    name: "Protein-level validation",
    desc: "Western blot or ELISA to confirm knockdown/expression change is reflected at the protein level, since mRNA reduction doesn't always translate proportionally to protein reduction.",
  },
  {
    name: "Splice-switching validation",
    desc: "RT-PCR across the targeted exon junction, run on a gel or sequenced, to directly visualize exon skipping/inclusion — the standard method for confirming a splice-switching ASO worked as intended.",
  },
  {
    name: "Off-target / toxicity screening",
    desc: "RNA-seq or a targeted panel to check for unintended transcriptome-wide changes, alongside standard cytotoxicity assays (e.g. MTT/LDH) for the delivery chemistry itself.",
  },
];

export default function ExperimentalProtocolsPage() {
  return (
    <HelpPageShell
      title="Experimental Protocols"
      subtitle="General orientation on standard validation approaches — not gene-specific or step-by-step bench protocols."
    >
      <Card className="p-5 bg-blue-50/50 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <p className="text-[12.5px] text-blue-700">
            The platform does not currently generate specific wet-lab protocols (reagent
            concentrations, timing, primer sequences) for your particular gene or candidate — that
            would require sourcing from validated, published protocols on a case-by-case basis, which
            isn&apos;t built yet. What follows is general categories of validation approach, not
            instructions to follow directly.
          </p>
        </div>
      </Card>

      {CATEGORIES.map((c) => (
        <Card key={c.name} className="p-5">
          <p className="text-[13px] font-semibold text-slate-800">{c.name}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{c.desc}</p>
        </Card>
      ))}

      <Card className="p-5">
        <p className="text-[13px] font-medium text-slate-700">Coming soon</p>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Protocol suggestions tied to your specific selected mechanism (e.g. a suggested validation
          approach for the exact chemistry chosen on the Candidate Design page) — not built yet.
        </p>
      </Card>
    </HelpPageShell>
  );
}
