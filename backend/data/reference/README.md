# Reference tables

Static, versioned lookup tables for the features that cannot be computed from
sequence. Specified in `docs/planning/data_sources_halted_flagged.md`.

**None of these tables is populated.** Each ships with its header row only.
The feature layer treats a header-only table exactly as it treats a missing
one: the feature stays UNRESOLVED and the mechanism it serves halts, or the
modality flag it drives is withheld. That is the intended state until a human
has populated them — it is not a bug to be routed around.

## Why they are empty

Every source below is marked **MUST VERIFY** in the data-sources document:
confirm the resource, its current version, its licence and its download URL
yourself before writing anything into these files. Do not accept a URL,
accession, version number or row of data from an AI assistant without
checking it — in an earlier session, eight of nine recalled PMIDs were wrong.

Populating these tables from recalled knowledge would put unverifiable data
behind a `provenance: annotation` label, which is the strongest tier the
feature layer has short of experimental measurement. That is a worse failure
than an empty table, because an empty table is visibly empty.

## Integration rules

- **Static files, downloaded periodically. No external API calls at request
  time.** Runtime calls introduce latency, availability risk and version
  drift into a system whose claim is reproducibility.
- **Every table carries `source` and `source_version`**, and the version
  belongs in the audit trail beside any result derived from it. A result
  produced against GTEx v8 and one produced against a later release are not
  the same result.
- **Absence is ABSENT, never zero.** A gene missing from the repeat-expansion
  catalogue is not "zero repeats", it is "not in the catalogue". A gene
  ClinGen has not curated is not "no dominant-negative allele".

## Tables

| File | Feature | Unblocks | Candidate sources (all MUST VERIFY) |
|---|---|---|---|
| `tissue_expression.tsv` | P2 | replacement flag | GTEx; Human Protein Atlas |
| `protein_localisation.tsv` | B1 | aptamer flag | UniProt subcellular location; HPA secretome |
| `clingen_dosage.tsv` | P6 | permits the flag | ClinGen Dosage Sensitivity |
| `dominant_negative_genes.tsv` | P6 | suppresses the flag | manual curation, PMID per row |
| `repeat_expansion_loci.tsv` | F12 | A14 | STRipy; ExpansionHunter variant catalog; gnomAD STR |
| `polyadenylation_sites.tsv` | F13a | A11 (partial) | PolyASite; PolyA_DB; APAatlas |
| `apa_therapeutic_benefit.tsv` | F13b | A11 (partial) | per-gene disease-specific curation |
| `rbp_repressor_sites.tsv` | F11 | A28 | curated validated sites, PMID per row |

### Two tables that must not be read in isolation

**A11 requires both `polyadenylation_sites` and `apa_therapeutic_benefit`.**
Most human genes carry an alternative polyadenylation site, so F13a alone
would fire A11 almost everywhere. Site *location* is annotatable; site usage
*shifting being therapeutic* is a per-gene judgement.

**P6 is read from two tables in opposite directions.** A row in
`dominant_negative_genes` SUPPRESSES the replacement flag and wins over
everything else. A ClinGen haploinsufficiency score of 3 PERMITS it. Any
other ClinGen code, or no row at all, leaves P6 unresolved and the flag
withheld.

`clingen_dosage.haploinsufficiency_score` is **not an ordinal 0–3 field**.
Code 30 means "autosomal recessive phenotype" and code 40 means "dosage
sensitivity unlikely". Comparing the column as an integer would read 40 as
the strongest possible evidence. Parse it as a code. See SO-DATA-02.

### F11 takes the curated route, not the atlas route

A CLIP-seq atlas answers "an RBP binds here", not "a repressor binds here and
masking it raises protein output". Binding is not repression, and most
RNA-binding proteins are context-dependent — the same protein stabilises one
transcript and destabilises another. `rbp_repressor_sites.tsv` is therefore a
short list of validated cases with a PMID each, not a genome-wide derivation.
A28 stays halted until it has rows.

Build order from the data-sources document: **P2, then B1, then P6, then
F12.** F13 (A11) and F11 (A28) come last and both mechanisms stay halted
meanwhile — each is Low–Moderate evidence with no approved drug, so neither
is worth the data work yet.

## Open sign-off items

- **SO-DATA-01 / SO-TG-09** — the P2 cut points separating ABUNDANT / LOW /
  ABSENT_IN_TISSUE. On the critical path for gene activation.
- **SO-DATA-02** — ClinGen haploinsufficiency score → P6 mapping, including
  codes 30 (autosomal recessive) and 40 (dosage sensitivity unlikely), which
  are not points on an ordinal 0–3 scale and must not be parsed as such.
- **SO-DATA-03** — F11 route: curated validated-sites list (recommended) or
  atlas-derived prediction.
- **SO-DATA-04** — licence review for redistributing derived tables inside
  this repository.
- **SO-DATA-05** — refresh cadence per table, and whether a version change
  invalidates stored results.
