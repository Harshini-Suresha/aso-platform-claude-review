import HelpPageShell from "@/components/HelpPageShell";
import { Card } from "@/components/ui";

const RULES = [
  { rule: "GC content", value: "30–70%", why: "Below 30% risks weak binding affinity; above 70% risks G-quadruplex formation and reduced specificity." },
  { rule: "Length", value: "18–22 nt (12–30 nt range supported)", why: "Short enough for good uptake and synthesis cost, long enough for target specificity." },
  { rule: "Poly-G tracts", value: "No runs of 4+ consecutive G's", why: "Long G-runs can form G-quadruplex secondary structures that interfere with target binding." },
  { rule: "Self-complementarity", value: "Minimize palindromic 4-mers", why: "Reduces hairpin/self-dimer formation that would compete with target hybridization." },
];

const CHEMISTRIES = [
  { id: "Gapmer (2-10-2)", desc: "Central DNA gap flanked by 2'-modified wings; recruits RNase H1 to cleave the target. Most clinically validated (nusinersen, eteplirsen-class precedent)." },
  { id: "PMO (Phosphorodiamidate Morpholino)", desc: "Non-ionic backbone; steric blocker, no RNase H recruitment. Used for splice-switching and translational arrest." },
  { id: "LNA-enhanced gapmer", desc: "Locked Nucleic Acid wings raise binding affinity (Tm) substantially per substitution; also raises off-target risk with potency." },
  { id: "2'-O-Methoxyethyl (2'-OMe)", desc: "Steric blocker with good nuclease resistance and low toxicity; commonly used for splicing modulation and miRNA inhibition." },
];

export default function AsoDesignGuidelinesPage() {
  return (
    <HelpPageShell
      title="ASO Design Guidelines"
      subtitle="The exact sequence rules and chemistry options used by the platform's candidate generator and sequence analyzer — not a separate reference."
    >
      <Card className="p-5">
        <p className="text-[13px] font-semibold text-slate-800">Sequence filtering rules</p>
        <div className="mt-3 space-y-3">
          {RULES.map((r) => (
            <div key={r.rule} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">{r.rule}</p>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11.5px] font-medium text-blue-600">
                  {r.value}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-slate-500">{r.why}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-[13px] font-semibold text-slate-800">Chemistry options</p>
        <div className="mt-3 space-y-3">
          {CHEMISTRIES.map((c) => (
            <div key={c.id}>
              <p className="text-[13px] font-medium text-slate-700">{c.id}</p>
              <p className="mt-0.5 text-[12.5px] text-slate-500">{c.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 bg-amber-50/50 border-amber-200">
        <p className="text-[13px] font-medium text-amber-800">What this doesn&apos;t cover</p>
        <p className="mt-1 text-[12.5px] text-amber-700">
          These rules filter candidates by sequence composition only. They do not include
          genome-wide off-target alignment, real RNA secondary-structure folding (e.g. RNAfold),
          or validated immunogenicity screening — those are explicitly disclaimed as heuristics
          wherever they appear in the platform.
        </p>
      </Card>
    </HelpPageShell>
  );
}
