# TG01 — Gene Silencing

**Therapeutic Goal ID:** TG01
**Category:** Gene Expression Reduction
**Description:** Reduce expression of a pathogenic gene or transcript through transcriptional or post-transcriptional mechanisms.

## Applicable Mechanisms

| Code | Name | Category |
|------|------|----------|
| A1 | RNase H-mediated Gapmer Knockdown | RNA degradation (Knockdown) |
| A2 | Steric-Blocking Translation Inhibition | Translation inhibition (RNase H-independent) |
| A12 | microRNA Inhibition (Anti-miR / AntagomiR) | microRNA modulation |
| A15 | Transcriptional Gene Silencing (Promoter-Targeting ASOs) | Transcriptional regulation / Epigenetic modulation |
| A21 | RNA Interference (siRNA-mediated Gene Silencing) | Post-transcriptional Gene Silencing |

## Mechanism Summaries

### A1 — RNase H-mediated Gapmer Knockdown

Selective degradation of target RNA through endogenous RNase H1 cleavage, thereby reducing expression of the encoded protein.

- **Molecular Defect:** Disorders in which reducing the abundance of a pathogenic RNA transcript is therapeutically beneficial, including toxic gain-of-function and pathogenic overexpression.
- **Disease Mechanism:** Disease is driven by expression of a pathogenic transcript or protein; reducing transcript abundance is expected to reduce disease pathology.
- **Suitable Variant Types:** Gain-of-function variants; dominant pathogenic variants; pathogenic overexpression. Repeat-expansion transcripts may be suitable in specific diseases but should be considered disease-specific rather than a general rule.
- **Typical Diseases:** Hereditary transthyretin amyloidosis (TTR); Homozygous familial hypercholesterolemia (ApoB); SOD1-associated ALS; Familial chylomicronemia syndrome (APOC3); Huntington disease (investigational).
- **RNA Target Region:** Mature mRNA, including coding sequence, exons and untranslated regions depending on target accessibility and biology. RNase H1 can act on nuclear and cytoplasmic RNA.
- **Transcript Requirement:** Disease-relevant transcript (canonical or pathogenic isoform). Allele-specific transcript where selective silencing is intended.
- **ASO Chemistry:** DNA gap flanked by chemically modified nucleotides (commonly 2′-MOE, LNA or cEt) with a phosphorothioate (PS) backbone.
- **Typical Length:** Approximately 13–20 nt for many therapeutic gapmers; exact length depends on chemistry and target.
- **Design Rules:** Literature synthesis: target accessible RNA regions; optimize affinity; minimize off-target complementarity; choose chemistry compatible with RNase H1 activation. Sequence heuristics (GC%, homopolymers, etc.) should come from design studies rather than mechanism reviews.
- **Scoring:** Candidates are ranked by predicted target duplex free energy (ΔG, kcal/mol) computed using ViennaRNA duplexfold — more negative values indicate stronger predicted ASO-target binding. Biophysical metrics reported: GC content, nearest-neighbor Tm (primer3), self-structure MFE (ViennaRNA fold), poly-G tracts, CpG count, homopolymer runs, purine content, GC skew, sequence complexity, molecular weight, extinction coefficient. Drug-like estimates: nuclease resistance, cellular uptake, BBB crossing, off-target risk, immune stimulation, synthesis difficulty.
- **Secondary Structure Requirement:** Accessible target regions generally improve activity; RNA accessibility is an important consideration during target-site selection.
- **Off-Target Considerations:** Partial complementarity, unintended hybridization, chemistry-dependent toxicity, and RNase H1-mediated cleavage of unintended transcripts should be evaluated.
- **Advantages:** Catalytic RNA degradation; clinically validated mechanism; applicable to coding and non-coding RNAs; effective in nucleus and cytoplasm.
- **Limitations:** Sequence-dependent off-target effects; potential hepatotoxicity for some high-affinity gapmers; requires RNase H1; not appropriate when transcript preservation is desired.
- **FDA Approved Drugs:** Mipomersen (Kynamro); Inotersen (Tegsedi); Eplontersen (Wainua); Olezarsen (Tryngolza); Tofersen (Qalsody).
- **Clinical Trial Examples:** Tominersen (HTT); Pelacarsen (LPA); BIIB078 (C9orf72 ALS); additional investigational gapmer ASOs.
- **Evidence Level:** High — Multiple reviews + FDA-approved therapeutics.

### A2 — Steric-Blocking Translation Inhibition

Reduce protein synthesis by sterically blocking ribosome initiation or progression without degrading the target RNA.

- **Molecular Defect:** Diseases where reducing protein production is beneficial while preserving the target transcript.
- **Disease Mechanism:** Pathogenic protein production is inhibited by preventing ribosome access or movement on the mRNA rather than inducing RNA degradation.
- **Suitable Variant Types:** Gain-of-function variants; dominant pathogenic variants; selected viral RNAs and experimental therapeutic targets.
- **Typical Diseases:** Primarily preclinical applications in viral infections, cancer, and experimental dominant genetic disorders. No widely established disease indication exists for this mechanism alone.
- **RNA Target Region:** 5′ UTR; translation initiation codon (AUG); ribosome-binding region; early coding sequence.
- **Transcript Requirement:** Disease-relevant transcript containing an accessible translation initiation region.
- **ASO Chemistry:** Fully modified RNase H-inactive ASOs including PMO, PNA, 2′-OMe, 2′-MOE and some LNA-based steric-blocking designs.
- **Typical Length:** Approximately 15–25 nucleotides, depending on chemistry and target.
- **Design Rules:** Literature synthesis: target accessible initiation regions; maintain high binding affinity; use RNase H-inactive chemistries; minimize off-target complementarity.
- **Scoring:** Candidates are ranked by predicted target duplex free energy (ΔG, kcal/mol) computed using ViennaRNA duplexfold — more negative values indicate stronger predicted ASO-target binding. Biophysical metrics reported: GC content, nearest-neighbor Tm (primer3), self-structure MFE (ViennaRNA fold), poly-G tracts, CpG count, homopolymer runs, purine content, GC skew, sequence complexity, molecular weight, extinction coefficient. Drug-like estimates: nuclease resistance, cellular uptake, BBB crossing, off-target risk, immune stimulation, synthesis difficulty.
- **Secondary Structure Requirement:** Target accessible, unstructured regions surrounding the translation initiation site whenever possible.
- **Off-Target Considerations:** Unintended binding to homologous transcripts may inhibit translation of non-target genes; evaluate transcriptome-wide complementarity.
- **Advantages:** Preserves RNA integrity; reversible mechanism; suitable when transcript degradation is undesirable.
- **Limitations:** Generally less potent than catalytic RNase H-mediated ASOs because inhibition depends on sustained occupancy of the target site; highly dependent on RNA accessibility.
- **FDA Approved Drugs:** None identified whose primary approved mechanism is direct translation inhibition.
- **Clinical Trial Examples:** No advanced clinical programs identified where the primary therapeutic mechanism is direct translation blockade alone. Most clinical steric-blocking ASOs act through splice modulation.
- **Evidence Level:** Moderate — Literature exists, but clinical evidence is limited.

### A12 — microRNA Inhibition (Anti-miR / AntagomiR)

Inhibit a pathogenic microRNA to restore expression of its downstream target genes.

- **Molecular Defect:** Diseases caused by overexpression or aberrant activity of a pathogenic microRNA.
- **Disease Mechanism:** A pathogenic miRNA suppresses translation and/or promotes degradation of multiple target mRNAs. Anti-miRs bind directly to the mature miRNA, preventing interaction with all of its target transcripts.
- **Suitable Variant Types:** Regulatory disorders involving miRNA dysregulation rather than DNA sequence variants; diseases driven by pathogenic miRNA overexpression.
- **Typical Diseases:** Hepatitis C (miR-122); cardiovascular diseases; liver fibrosis; cancer; metabolic disorders; kidney disease.
- **RNA Target Region:** Mature microRNA sequence (typically seed region and adjacent nucleotides).
- **Transcript Requirement:** Experimentally validated disease-associated miRNA regulating the phenotype.
- **ASO Chemistry:** Fully modified RNase H-independent oligonucleotides including LNA, 2′-O-Me, 2′-MOE and phosphorothioate chemistries.
- **Typical Length:** Approximately 15–23 nucleotides, complementary to the mature miRNA.
- **Design Rules:** Literature synthesis: target mature miRNA sequence; optimize affinity for seed-region binding; avoid RNase H activation; experimentally validate derepression of downstream targets.
- **Scoring:** Candidates are ranked by predicted target duplex free energy (ΔG, kcal/mol) computed using ViennaRNA duplexfold — more negative values indicate stronger predicted ASO-target binding. Biophysical metrics reported: GC content, nearest-neighbor Tm (primer3), self-structure MFE (ViennaRNA fold), poly-G tracts, CpG count, homopolymer runs, purine content, GC skew, sequence complexity, molecular weight, extinction coefficient. Drug-like estimates: nuclease resistance, cellular uptake, BBB crossing, off-target risk, immune stimulation, synthesis difficulty.
- **Secondary Structure Requirement:** Minimal concern because mature miRNAs are short single-stranded RNAs within the RISC complex; accessibility of the miRNA-RISC complex remains an experimental consideration.
- **Off-Target Considerations:** Because one miRNA regulates many transcripts, inhibition may affect multiple biological pathways; evaluate transcriptome-wide downstream effects.
- **Advantages:** Can simultaneously restore multiple disease-relevant genes regulated by a single pathogenic miRNA.
- **Limitations:** Broad downstream effects due to multiple miRNA targets; potential unintended pathway perturbation; repeated administration generally required.
- **FDA Approved Drugs:** None
- **Clinical Trial Examples:** Miravirsen (anti-miR-122 for Hepatitis C); Cobomarsen (anti-miR-155, investigational oncology).
- **Evidence Level:** Moderate — Strong preclinical evidence and human clinical trials, but no FDA-approved therapy.

### A15 — Transcriptional Gene Silencing (Promoter-Targeting ASOs)

Reduce gene expression by inhibiting transcription through targeting promoter-associated RNAs or promoter regions.

- **Molecular Defect:** Diseases driven by pathogenic gene overexpression where transcriptional repression is desirable.
- **Disease Mechanism:** ASOs bind promoter-associated RNAs, recruiting chromatin-modifying complexes and altering transcription initiation, resulting in decreased transcription of the target gene.
- **Suitable Variant Types:** Gene overexpression; oncogene activation; transcriptional dysregulation.
- **Typical Diseases:** Cancer (MYC, progesterone receptor studies); experimental models of transcriptional dysregulation.
- **RNA Target Region:** Promoter-associated RNA (paRNA); promoter-overlapping transcripts; transcription start site-associated RNAs.
- **Transcript Requirement:** Presence of a functional promoter-associated RNA involved in regulating transcription.
- **ASO Chemistry:** RNase H-compatible phosphorothioate gapmers and other modified ASOs, depending on the experimental platform.
- **Typical Length:** ~18–20 nt in most published studies.
- **Design Rules:** Literature synthesis: identify functional promoter-associated RNAs; design ASOs complementary to regulatory promoter transcripts; experimentally verify transcriptional repression by qPCR and chromatin assays.
- **Scoring:** Candidates are ranked by predicted target duplex free energy (ΔG, kcal/mol) computed using ViennaRNA duplexfold — more negative values indicate stronger predicted ASO-target binding. Biophysical metrics reported: GC content, nearest-neighbor Tm (primer3), self-structure MFE (ViennaRNA fold), poly-G tracts, CpG count, homopolymer runs, purine content, GC skew, sequence complexity, molecular weight, extinction coefficient. Drug-like estimates: nuclease resistance, cellular uptake, BBB crossing, off-target risk, immune stimulation, synthesis difficulty.
- **Secondary Structure Requirement:** Accessible promoter-associated RNA regions are preferred.
- **Off-Target Considerations:** Potential epigenetic effects on unintended loci; evaluate transcriptome-wide and chromatin-wide specificity.
- **Advantages:** Regulates gene expression at the transcriptional level; may provide durable suppression compared with post-transcriptional approaches.
- **Limitations:** Mechanism is incompletely understood; highly context-dependent; limited clinical validation.
- **FDA Approved Drugs:** None
- **Clinical Trial Examples:** None identified. Primarily preclinical.
- **Evidence Level:** Low–Moderate

### A21 — RNA Interference (siRNA-mediated Gene Silencing)

Reduce target gene expression by sequence-specific degradation of mRNA through the RNA-induced silencing complex (RISC).

- **Molecular Defect:** Diseases driven by pathogenic gene overexpression, gain-of-function variants, or toxic transcript accumulation.
- **Disease Mechanism:** Double-stranded siRNA is loaded into the RISC complex. The guide strand directs Argonaute-2 (AGO2) to complementary mRNA, which is cleaved and degraded.
- **Suitable Variant Types:** Gain-of-function variants; dominant pathogenic variants; overexpressed genes; viral RNAs; toxic transcripts.
- **Typical Diseases:** Hereditary transthyretin amyloidosis (ATTR); Acute hepatic porphyria (ALAS1); Primary hyperoxaluria type 1 (HAO1); Hypercholesterolemia (PCSK9); Hepatitis B (investigational).
- **RNA Target Region:** Mature mRNA (typically coding sequence or untranslated regions with accessible sequence).
- **Transcript Requirement:** Cytoplasmic target mRNA with high sequence complementarity to the guide strand.
- **ASO Chemistry:** N/A (siRNA modality)
- **Typical Length:** ~21–23 bp duplex.
- **Design Rules:** Select unique target sequence; optimize guide/passenger strand asymmetry; minimize seed-region off-targets; validate AGO2-mediated cleavage.
- **Scoring:** Candidates are ranked by predicted target duplex free energy (ΔG, kcal/mol) computed using ViennaRNA duplexfold — more negative values indicate stronger predicted ASO-target binding. Biophysical metrics reported: GC content, nearest-neighbor Tm (primer3), self-structure MFE (ViennaRNA fold), poly-G tracts, CpG count, homopolymer runs, purine content, GC skew, sequence complexity, molecular weight, extinction coefficient. Drug-like estimates: nuclease resistance, cellular uptake, BBB crossing, off-target risk, immune stimulation, synthesis difficulty.
- **Secondary Structure Requirement:** Accessible target region improves silencing efficiency.
- **Off-Target Considerations:** Seed-mediated off-target effects; saturation of endogenous RNAi pathways; immune stimulation.
- **Advantages:** Highly potent; catalytic mechanism; several FDA-approved therapeutics; efficient liver delivery using GalNAc conjugation.
- **Limitations:** Primarily effective in tissues with established delivery methods; off-target effects; requires intracellular delivery.
- **FDA Approved Drugs:** Patisiran; Givosiran; Lumasiran; Inclisiran; Vutrisiran
- **Clinical Trial Examples:** Multiple Phase I–III RNAi therapeutics across liver, cardiovascular, infectious, and rare diseases.
- **Evidence Level:** Very High

## Design Parameters

### Defect Types

| Defect Type | Compatible Mechanisms |
|-------------|----------------------|
| gain_of_function | A1, A2, A21 |
| overexpression | A15, A21 |
| mirna_dysregulation | A12 |
| viral_toxic_rna | A1, A2, A21 |

### Silencing Scope

| Scope | Compatible Mechanisms |
|-------|----------------------|
| total_knockdown | A1, A2, A12, A15, A21 |
| allele_specific | A1, A21 |

> **Note:** The scope table reflects *biological* compatibility. A21 (RNAi) genuinely supports allele-specific silencing via SNP-based discrimination, but the platform's ASO designer only emits single-stranded candidates and cannot produce a double-stranded siRNA duplex — so A21 is **excluded** from the mechanism ranking entirely and does not appear as a selectable option (see Mechanism Constraints below).

### Mechanism Constraints

- **A2:** Targets 5′ translation-initiation region only
- **A21:** Forces 21-nt siRNA duplex (not supported by single-stranded ASO designer)
- **A12 / A15:** Cannot design from CDS alone

### Allele-Specific Scoring

- Variant overlap candidate binding window

### Tissue-Specific Scoring

| Tissue | Uptake | BBB | Immune | Notes |
|--------|--------|-----|--------|-------|
| Liver | +15 | 0 | -5 | Gapmer +5 bonus |
| CNS / Brain | -10 | +20 | -10 | PMO/LNA +8; standard gapmer -3; ASO >20nt -5 |
| Muscle | +5 | 0 | 0 | DMD validated |
| Eye / Retina | +12 | 0 | +15 | PMO +5 bonus |
| Spinal Cord | -5 | +15 | -5 | ASO >20nt -5 |

## Option Selection Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| defectType | Yes | Molecular defect type (gain_of_function, overexpression, mirna_dysregulation, viral_toxic_rna) |
| silencingScope | Yes | total_knockdown or allele_specific |
| deliveryContext | No | Optional tie-breaker: delivery precedent tier (approved drug / clinical trial / unestablished) with citation, consulted only when evidence level is tied |
| knownVariant | No | Optional variant identifier |
| asoLength | No | 12–30 nt, default 18 |
| chemistry | No | gapmer, pmo, lna_gapmer, 2ome, sirna |
| selectedMods | No | phosphorothioate, lna_wings, 2omemod, pmo_core, pna_clamp |
| targetExonIndices | No | Array or null for total knockdown |

## Results / Metrics

Candidates are ranked by a composite score built from real metrics:
- **Primary metric:** Target duplex free energy (ΔG, kcal/mol) from ViennaRNA duplexfold
- **Secondary metric:** Chemistry-adjusted Tm fit from primer3

### Per-Candidate Metrics

- Sequence, length, GC%, Tm, self-structure MFE
- Duplex energy, target region, chemistry, modifications
- Exon number, CpG count, purine content, complexity
- Molecular weight, extinction coefficient

### Drug-Like Estimates (0–100)

- Nuclease resistance
- Cellular uptake
- BBB crossing
- Synthesis difficulty
- Off-target risk
- Immune stimulation

### Mechanism Notes

Per-candidate mechanism notes explain how the ASO is expected to function based on its chemistry and target region.

### Summary Statistics

- Candidate count
- Target exons
- Mechanism ID
- Chemistry
- ASO length

## Export Formats

- CSV summary
- TSV spreadsheet
- Raw JSON
- FASTA sequences
- Detailed text report
- HTML report

## References

- Shen X, Corey DR. Nucleic Acids Research (2018)
- Crooke ST. Nucleic Acid Therapeutics (2017)
- Crooke ST. Journal of Biological Chemistry (2021)
- Burel SA et al. Nucleic Acids Research (2016)
- Hagedorn PH et al. Nucleic Acids Research (2017)
- Liang XH et al. Molecular Therapy (2017)
- FDA labels (Kynamro, Tegsedi, Wainua, Tryngolza, Qalsody)
