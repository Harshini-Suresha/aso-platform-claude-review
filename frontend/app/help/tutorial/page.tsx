import HelpPageShell from "@/components/HelpPageShell";
import { Card } from "@/components/ui";
import { Crosshair, Dna, PenSquare, UploadCloud } from "lucide-react";

const STEPS = [
  {
    icon: Crosshair,
    title: "1. Basic Information & Gene Verification",
    body: "Choose an organism from the tiered list (Tier 1 clinical species and Tier 2/3 model/veterinary organisms are live; Tier 5 viruses use a curated reference set; Tier 4 plants and Tier 6 bacteria are not yet connected). Enter a disease label for your own project notes, and a gene symbol. Hitting Load Gene calls Ensembl, UniProt, and either Open Targets (human) or Ensembl's phenotype data (other species) for a real, current record — not a cached or synthetic one.",
  },
  {
    icon: Dna,
    title: "2. Mechanism Selection",
    body: "After confirming a target, you're asked about the molecular defect type, silencing/splicing scope, and delivery context. The platform scores each candidate mechanism (from the 26-mechanism rulebook) against your answers using the mechanism's own documented variant/scope compatibility — not a generic list. Currently Gene Silencing (TG01) and RNA Processing Modulation (TG04) are wired up; the remaining therapeutic goals use the same rulebook data but aren't connected to this scoring flow yet.",
  },
  {
    icon: PenSquare,
    title: "3. Candidate Design",
     body: "Once a mechanism is selected, the platform fetches the real transcript sequence from Ensembl and generates candidate oligonucleotides using a sliding window, filtered by GC content, self-structure MFE, and poly-G tracts, then ranked by predicted target duplex energy (ΔG). This does not include genome-wide off-target screening — that requires real alignment tooling and is intentionally out of scope for now.",
  },
  {
    icon: UploadCloud,
    title: "Upload Sequence (independent tool)",
    body: "Paste or upload any DNA/RNA sequence directly, without going through gene lookup. Validates the sequence, then runs modality-specific analysis (ASO / siRNA / mRNA / sgRNA) with real position data — a sequence map, GC curve, and composition chart computed directly from your sequence — plus clearly-labeled heuristic estimates for specificity and secondary structure. Export the results as FASTA, a text report, CSV, or JSON.",
  },
];

export default function TutorialPage() {
  return (
    <HelpPageShell
      title="Platform Tutorial"
      subtitle="What each page in the workflow actually does, and where the data comes from."
    >
      {STEPS.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.title} className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                <Icon className="h-4.5 w-4.5 text-indigo-500" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-slate-800">{s.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{s.body}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </HelpPageShell>
  );
}
