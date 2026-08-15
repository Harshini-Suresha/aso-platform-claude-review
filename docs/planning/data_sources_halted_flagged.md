# Data sources for halted and flagged mechanisms

Companion to `therapeutic_goal_scope_plan_v3.md`.

Covers the features that do not exist yet: **F11, F12, F13** (which halt A28,
A14, A11) and **P2, P6, B1** (which drive the modality flags for A24, A25,
A26). Also states why **A21 needs no new data at all**.

## Provenance rules

Anything marked **MUST VERIFY** means: confirm the resource, its current
version, its licence and its download URL yourself before writing it into
code. Do not accept a URL, accession or version number from any AI assistant,
including me, without checking it. Standing project rule — in Session 5, eight
of nine recalled PMIDs were wrong.

Where I have verified a resource in this session I say so and give the
citation. Everything else is a starting point for your own search.

---

# 0. A21 — no data work required

A21 (RNA interference) is **already fully scored** using existing Family T
features: F9 (allele-distinguishing variant) and F10a (accessible site
density). Nothing is missing. Its `design_available = false` flag is a
property of the *designer*, not of the evidence.

Five approved siRNA drugs — patisiran, givosiran, lumasiran, inclisiran,
vutrisiran — are recorded in its rulebook, so it is also fully validatable
against the mechanism-recovery benchmark.

**Action: none.** Do not build a data pipeline for A21. This section exists so
nobody looks for one.

---

# 1. F12 — repeat expansion (unblocks A14)

**Build this first. It is the easiest of the three and the only one that is a
bounded catalogue rather than a genome-wide prediction.**

### What the feature must answer
Does this gene contain a known pathogenic repeat expansion locus? If so, what
is the repeat unit and where is it?

A14 (RNA toxicity neutralisation / foci disruption) applies specifically to
expanded repeat transcripts that sequester RNA-binding proteins into nuclear
foci. Without F12, A14 cannot fire and `rank_rna_neutralization_mechanisms`
relies on user-typed free text for repeat unit and count.

### Why this is tractable
The set is small and closed. <cite index="39-1">Tandem repeat expansions at specific loci have been linked to around 60 human diseases to date.</cite> This is a lookup table with roughly sixty rows, not a predictor.

### Sources — verified in this session

**STRipy** (https://stripy.org) — MUST VERIFY licence and download format.
<cite index="34-1">STRipy provides a curated database of all discovered disease-causing short tandem repeats, with supporting genomic and pathogenic information, increasing the number of defined loci from 29 to 55.</cite> <cite index="37-1">Each locus carries a research-paper summary and the database supports predefined groups such as neurological disease, childhood or adult onset, and repeats in coding regions, UTRs or introns.</cite>

That last point matters: **repeat location (coding / UTR / intron) is a design
input**, not just metadata, because it determines whether the transcript is
targetable and where.

**ExpansionHunter variant catalog** — MUST VERIFY current version.
<cite index="33-1">The default catalog expanded from 30 to 60 pathogenic short tandem repeat loci, including 30 from gnomAD.</cite> Distributed as JSON with genomic locations and repeat structure per locus. <cite index="38-1">The broadinstitute/str-analysis repository provides converters between BED files and ExpansionHunter variant catalog JSON format.</cite>

**gnomAD short tandem repeat data** — MUST VERIFY. Gives population-level
allele length distributions, which is what separates a normal-range repeat
from a pathogenic expansion.

### Integration

Static table, shipped in the repo. No API call at runtime.

```
backend/data/reference/repeat_expansion_loci.tsv
  gene_symbol, locus_id, chrom, start, end, repeat_unit,
  transcript_region (5UTR|CDS|intron|3UTR), normal_max_repeats,
  pathogenic_min_repeats, source, source_version, pmid
```

Feature returns:
- `present: true/false`
- `repeat_unit`, `transcript_region`
- provenance **CONFIRMED** when the gene is in the catalogue
- provenance **ABSENT** when it is not — and A14 stays halted, because
  "not in a sixty-row catalogue of known expansions" is a real answer, not
  a missing one

**Effort: days.** Download, parse, ship. No model.

---

# 2. F11 — repressor RBP site (unblocks A28)

**Hardest of the three. Expect the feature to be low-tier.**

### What the feature must answer
Does this transcript carry a binding site for an RNA-binding protein that
*represses* translation, positioned where a steric-blocking oligonucleotide
could mask it?

### Why it is hard
Three separate problems, and only the first is a data problem:

1. **Where does the RBP bind?** CLIP-seq atlases answer this, cell-type
   specifically.
2. **Is that RBP repressive here?** Most RNA-binding proteins are context-
   dependent — the same protein can stabilise one transcript and destabilise
   another. Binding is not repression.
3. **Would masking the site increase protein output?** This requires a
   functional experiment, not an annotation.

An atlas answers (1). Nothing available answers (2) or (3) at scale.

### Sources — MUST VERIFY all of these
Search for, and confirm before use:

- **ENCODE eCLIP** — crosslinking-immunoprecipitation data across many RNA-
  binding proteins in a small number of cell lines. Confirm which proteins,
  which cell lines, and whether your target tissue is represented.
- **POSTAR / ATtRACT / RBPmap** — RBP binding site and motif resources.
  Confirm which are current and maintained; some resources in this space are
  no longer updated.
- **Literature curation** for the specific repressive interactions you care
  about.

### Integration — and the honest recommendation

Even with a good atlas, F11 answers "an RBP binds here," not "a repressor
binds here and masking it helps." Under the project's own evidence rules that
supports at most a **PREDICTED, research-stage tier with a low confidence
cap** — and only where the target tissue is actually represented in the
underlying data.

**Recommendation: keep A28 halted for now.** Implement F11 as a
literature-curated list of *validated* repressive RBP sites — small, high
confidence, CONFIRMED tier — rather than as an atlas-derived prediction. A
short list of real cases is worth more here than genome-wide coverage of a
quantity you cannot interpret.

**Effort: weeks for the atlas route, days for the curated-list route.**
Take the curated list.

---

# 3. F13 — polyadenylation site usage (unblocks A11)

### What the feature must answer
Which polyadenylation site does this transcript use in the relevant tissue,
is an alternative site available, and would shifting between them be
therapeutically useful?

### Sources — MUST VERIFY
Search for and confirm: **PolyASite**, **PolyA_DB**, and **APAatlas**. All
three are polyadenylation-site resources; verify which are current,
maintained, and cover human tissues you care about. 3′-end sequencing derived
atlases are the underlying data type.

### The harder half
Site *location* is annotatable. Site *usage shift being therapeutic* is not.
A11's own rulebook rates it Low–Moderate with no FDA-approved drug, so the
mechanism is research-stage regardless of the data quality.

### Integration
Two sub-features:
- **F13a — alternative polyadenylation site present.** Annotation lookup,
  CONFIRMED tier. This is achievable.
- **F13b — shifting usage is therapeutically beneficial.** Requires
  disease-specific evidence. Curated per gene, or ABSENT.

**A11 fires only when both are present.** F13a alone is not sufficient — most
human genes have alternative polyadenylation sites, so F13a alone would fire
A11 almost everywhere.

**Effort: days for F13a, indefinite for F13b.** Deprioritise A11 accordingly.

---

# 4. P2 — boostable endogenous transcript (modality flag)

**This is the feature that fixes the TG02 correctness bug. Build it in Tier A,
not later.**

### What it must answer
Is there enough endogenous transcript in the target tissue for an
upregulation approach to have something to work with?

### Sources — MUST VERIFY current versions
- **GTEx** — bulk tissue expression across human tissues. The standard
  reference for "is this gene expressed here."
- **Human Protein Atlas** — tissue-level RNA and protein expression, with a
  consensus tissue dataset.

Both are well established and stable. Confirm licence terms for redistribution
if you plan to ship a derived table rather than query at runtime.

### Integration
Ship a derived static table rather than calling an API per request:

```
backend/data/reference/tissue_expression.tsv
  gene_symbol, tissue, median_tpm, source, source_version
```

Feature returns a three-way call, not a number:
- **ABUNDANT** — upregulation has substrate; replacement flag suppressed
- **LOW** — replacement flag may fire
- **ABSENT_IN_TISSUE** — replacement flag fires strongly

**The thresholds separating these three are de-novo parameters** and need
calibration register entries. This is sign-off item **SO-TG-09**, and it is on
the critical path for TG02.

**Effort: days.**

---

# 5. P6 — dominant-negative allele (modality flag suppressor)

**The one that cannot be a clean lookup. Say so rather than pretending.**

### What it must answer
Does the patient's variant act by poisoning the wild-type protein? If so,
supplying more wild-type protein does not help, and the replacement flag must
be suppressed.

### Why no database answers this directly
ClinVar records clinical significance, not molecular mechanism. There is no
`dominant_negative: true` field anywhere. Mechanism assignment is a literature
judgement made per gene, sometimes per variant.

### The workable proxy — verified in this session

**ClinGen Dosage Sensitivity** curations
(https://dosage.clinicalgenome.org, downloads also via ClinGen's file
download pages) — MUST VERIFY current file format and URL.

<cite index="44-1">The ClinGen Dosage Sensitivity curation process collects evidence supporting or refuting the haploinsufficiency and triplosensitivity of genes and genomic regions, and the entire dataset is downloadable.</cite> <cite index="46-1">A haploinsufficiency score of 3 indicates sufficient evidence to support a dosage sensitivity mechanism for the gene.</cite>

The logic to use:

- **HI score 3** → loss of function through *dosage* is the established
  mechanism → dominant-negative is unlikely → **replacement flag permitted**
- **HI score 0, 1 or 2** → dosage insufficiency is not established → the
  disease mechanism may be something else, including dominant-negative →
  **replacement flag suppressed pending curation**
- **Not curated** → **ABSENT** → flag suppressed

Note the scoring scale is not a simple 0–3: <cite index="43-1">a score of 30 denotes "gene associated with autosomal recessive phenotype"</cite>, and <cite index="46-1">a score of 40 denotes "dosage sensitivity unlikely"</cite>. Parse the codes properly; do not treat the field as an ordinal integer.

### Plus a curated exclusion list
Maintain a short, explicitly curated list of genes where dominant-negative
mechanisms are well documented, each row carrying a PMID. This is manual work
and should be labelled as such rather than dressed up as a database query.

```
backend/data/reference/dominant_negative_genes.tsv
  gene_symbol, evidence_summary, pmid, curator, date
```

### The safe default
Where P6 cannot be resolved, **suppress the replacement flag.** A missing
suggestion costs the user a prompt; a wrong suggestion to replace a protein in
a dominant-negative disease is a substantively harmful recommendation.

**Effort: days for the ClinGen proxy, ongoing for the curated list.**

---

# 6. B1 — extracellular or cell-surface target (aptamer flag)

**Cleanest of all six. Nearly free.**

### What it must answer
Is the protein product accessible to an aptamer — secreted, extracellular, or
cell-surface?

Pegaptanib, the approved aptamer, is delivered intravitreally against a
secreted growth factor. Intracellular targets are largely out of reach.

### Sources — MUST VERIFY current release
- **UniProt** — subcellular location annotation and signal peptide
  annotation. A signal peptide plus an extracellular or secreted location
  annotation is close to decisive.
- **Human Protein Atlas** secretome classification — a useful cross-check.

### Integration
```
backend/data/reference/protein_localisation.tsv
  gene_symbol, uniprot_id, has_signal_peptide,
  localisation_class (secreted|membrane|intracellular|unknown),
  source, source_version
```

Feature returns `secreted | membrane | intracellular | unknown`. The aptamer
flag fires only on `secreted` or `membrane`.

**Effort: 1–2 days.**

---

# 7. Priority and effort

| Feature | Unblocks | Effort | Priority | Note |
|---|---|---|---|---|
| **P2** | replacement flag | days | **1 — Tier A** | Fixes a TG02 correctness bug |
| **B1** | aptamer flag | 1–2 days | **2** | Cheapest of all six |
| **P6** | flag suppression | days + curation | **3** | Safety-relevant; safe default is suppress |
| **F12** | A14 | days | **4** | Bounded ~60-row catalogue |
| **F13a** | A11 (partial) | days | 5 | Insufficient alone; needs F13b |
| **F11** | A28 | weeks / days | 6 | Take the curated-list route, keep A28 halted |

**Items 1–4 total roughly two weeks** and unblock the modality flags plus A14.
Items 5 and 6 should stay halted until the mechanisms they serve are worth the
effort — both are Low–Moderate evidence with no approved drug.

# 8. Cross-cutting integration rules

**Ship static reference tables; do not call external APIs at request time.**
Every source above is a periodic download. Runtime API calls introduce
latency, availability risk and version drift into a system whose whole claim
is reproducibility.

**Every table carries `source` and `source_version` columns**, and the version
goes into the audit trail alongside the result. A result produced against
GTEx v8 and one produced against a later release are not the same result.

**Absence is ABSENT, never zero.** A gene missing from the repeat-expansion
catalogue is not "zero repeats"; it is "not in the catalogue." A gene not
curated by ClinGen is not "no dominant-negative allele." This is the same rule
that governs the rest of the platform and it applies unchanged here.

**Register every threshold.** The P2 abundant/low/absent cut points, the
ClinGen score mapping, and the F13a-plus-F13b conjunction are all de-novo
parameters requiring calibration register entries and sign-off.

# 9. New sign-off items

- **SO-DATA-01** P2 expression thresholds separating ABUNDANT / LOW /
  ABSENT_IN_TISSUE. On the critical path for TG02. (Same as SO-TG-09.)
- **SO-DATA-02** ClinGen haploinsufficiency score → P6 mapping, including the
  handling of codes 30 and 40.
- **SO-DATA-03** F11 route: curated validated-sites list (recommended) versus
  atlas-derived prediction.
- **SO-DATA-04** Licence review for redistributing derived tables from GTEx,
  Human Protein Atlas, UniProt, ClinGen and STRipy inside the repository.
- **SO-DATA-05** Refresh cadence for each reference table, and whether a
  version change invalidates prior stored results.
