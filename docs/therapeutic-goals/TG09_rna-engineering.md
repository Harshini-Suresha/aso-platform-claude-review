# TG09 — Protein Function Modulation

**Therapeutic Goal ID:** TG09
**Category:** Protein Activity Modulation
**Description:** Modulate protein activity directly using RNA molecules that bind and regulate protein function rather than gene expression.

## Applicable Mechanisms

| Code | Name | Category |
|------|------|----------|
| A23 | Small Activating RNA (saRNA)-Mediated Transcriptional Activation | Transcriptional Gene Activation |
| A24 | Messenger RNA (mRNA) Replacement Therapy | Protein Replacement / Gene Augmentation |
| A25 | RNA Aptamer Therapeutics | Ligand Binding / Molecular Inhibition |
| A26 | Circular RNA (circRNA)-Mediated Protein Replacement | Protein Replacement / Sustained Protein Expression |

> **Note:** While A24 and A26 are listed under TG08 (Protein Replacement) in the rulebook, TG09's dedicated design form focuses on structural/functional RNA modalities (A23, A25, A26) that modulate protein activity through binding rather than expression changes. The platform's RNA Engineering page is dedicated to TG09.

## Mechanism Summaries

### A23 — Small Activating RNA (saRNA)-Mediated Transcriptional Activation

Increase endogenous gene expression by activating transcription of the target gene.

- **Molecular Defect:** Diseases caused by reduced gene expression, epigenetic silencing, or insufficient production of a protective protein.
- **Disease Mechanism:** Double-stranded saRNAs target promoter-associated transcripts or promoter regions, recruiting AGO proteins and transcriptional regulatory complexes to enhance transcription of the endogenous gene.
- **Suitable Variant Types:** Haploinsufficiency; epigenetic silencing; reduced transcription; promoter dysfunction without irreversible gene loss.
- **Typical Diseases:** Hepatocellular carcinoma (CEBPA activation); Liver fibrosis (experimental); Metabolic disorders (experimental); Neurological disorders with reduced gene expression (preclinical).
- **RNA Target Region:** Promoter-associated RNA (paRNA); promoter-adjacent regions; transcription start site (TSS)-associated transcripts.
- **Transcript Requirement:** Functional endogenous promoter capable of transcriptional activation.
- **ASO Chemistry:** N/A (dsRNA modality)
- **Typical Length:** Approximately 21 nucleotides (double-stranded RNA).
- **Design Rules:** Identify promoter-associated target sequences; optimize guide strand selection; experimentally confirm transcriptional activation by qPCR and protein assays; assess chromatin changes where appropriate.
- **Secondary Structure Requirement:** Accessible promoter-associated transcript or regulatory RNA region.
- **Off-Target Considerations:** Activation of unintended genes; seed-sequence-mediated effects; promoter cross-reactivity.
- **Advantages:** Activates the endogenous gene; preserves physiological regulation; avoids permanent genome modification.
- **Limitations:** Mechanism remains incompletely understood; tissue-specific responses; delivery challenges; no FDA-approved saRNA therapeutics.
- **FDA Approved Drugs:** None
- **Clinical Trial Examples:** MTL-CEBPA (clinical development for liver cancer).
- **Evidence Level:** Moderate (clinical-stage platform, no approved therapy).

### A25 — RNA Aptamer Therapeutics

Modulate disease by specifically binding and inhibiting (or occasionally activating) extracellular or intracellular target molecules without altering gene expression.

- **Molecular Defect:** Diseases driven by excessive protein activity, ligand–receptor interactions, or dysregulated signaling pathways.
- **Disease Mechanism:** RNA aptamers fold into defined three-dimensional structures that bind target proteins with high affinity and specificity, preventing ligand binding, receptor activation, or protein function.
- **Suitable Variant Types:** N/A
- **Typical Diseases:** Neovascular age-related macular degeneration (VEGF); Cancer (experimental); Coagulation disorders; Autoimmune diseases (experimental); Viral infections (preclinical).
- **RNA Target Region:** Not applicable (targets proteins rather than RNA).
- **Transcript Requirement:** None.
- **ASO Chemistry:** N/A (aptamer modality)
- **Typical Length:** Approximately 20–100 nucleotides.
- **Design Rules:** Identify target protein; generate aptamers using SELEX; optimize affinity, specificity, nuclease resistance, and pharmacokinetics.
- **Secondary Structure Requirement:** Essential. Biological activity depends on correct three-dimensional folding (stem-loops, bulges, pseudoknots, etc.).
- **Off-Target Considerations:** Non-specific protein binding; structural instability; immune responses to delivery systems.
- **Advantages:** High specificity; reversible activity; relatively low immunogenicity; can be chemically synthesized; antidotes can be developed.
- **Limitations:** Susceptible to nuclease degradation without modification; delivery challenges; limited number of approved therapeutics.
- **FDA Approved Drugs:** Pegaptanib
- **Clinical Trial Examples:** Pegaptanib (AMD); multiple oncology and coagulation-targeting aptamers in clinical development.
- **Evidence Level:** High

### A26 — Circular RNA (circRNA)-Mediated Protein Replacement

Produce sustained therapeutic protein expression using circular RNA molecules with enhanced intracellular stability.

- **Molecular Defect:** Diseases caused by absent or deficient protein expression where prolonged protein production is beneficial.
- **Disease Mechanism:** Synthetic circular RNAs enter the cytoplasm and are translated into therapeutic proteins through cap-independent translation (typically mediated by internal ribosome entry sites or other translation elements). The circular topology confers resistance to exonuclease degradation, resulting in prolonged protein production.
- **Suitable Variant Types:** Loss-of-function variants; nonsense mutations; frameshift mutations; gene deletions; haploinsufficiency.
- **Typical Diseases:** Vaccines (experimental); Ornithine transcarbamylase deficiency; Cystic fibrosis; Hemophilia; Rare metabolic disorders (preclinical).
- **RNA Target Region:** None. The therapeutic circRNA itself is delivered.
- **Transcript Requirement:** None.
- **ASO Chemistry:** N/A (circRNA modality)
- **Typical Length:** Approximately 1–5 kb, depending on the encoded protein.
- **Design Rules:** Optimize coding sequence, IRES/translation element, circularization strategy, untranslated regions (if applicable), and codon usage; validate sustained protein expression.
- **Secondary Structure Requirement:** Circular topology is required; local RNA structure should permit efficient ribosome recruitment and translation.
- **Off-Target Considerations:** Innate immune activation; prolonged expression; delivery-related toxicity; unintended protein expression.
- **Advantages:** Increased RNA stability; prolonged protein production; no genomic integration; potentially reduced dosing frequency compared with linear mRNA.
- **Limitations:** Delivery remains challenging; manufacturing complexity; no FDA-approved circRNA therapeutics (as of now).
- **FDA Approved Drugs:** None
- **Clinical Trial Examples:** Multiple early-stage/preclinical circRNA therapeutic programs; no approved products.
- **Evidence Level:** Moderate

## Design Parameters

### Structural Classes

| Class | Length Range | Mechanism Mapping |
|-------|-------------|-------------------|
| rna_aptamer | 28–45 nt | A23 |
| catalytic_ribozyme | 35–55 nt | A24 |
| riboswitch | 40–70 nt | A25 |
| multivalent_scaffold | 50–80 nt | A26 |

### Target Molecule Types

| Target Type | Mechanism Mapping |
|-------------|-------------------|
| protein_active_site | A23, A26 |
| cell_surface_receptor | A23 |
| small_molecule | A25 |
| target_rna | A24, A26 |

### Scaffolds

| Scaffold | Mechanism Mapping |
|----------|-------------------|
| selex_refinement | A23 |
| hammerhead | A24 |
| three_way_junction | A26 |

### Chemical Stabilizations

| Stabilization | Description |
|---------------|-------------|
| two_f_pyrimidine | 2'-fluoro pyrimidine modifications |
| two_ome_ps | 2'-O-methyl with phosphorothioate backbone |
| inverted_abasic | Inverted abasic end caps |

### Binding Threshold (Kd Goal)

| Goal | Range |
|------|-------|
| nanomolar | 1–10 nM |
| sub_nanomolar | <1 nM |

## Intersection Rules

The eligible mechanism is determined by the intersection of:
1. Structural class
2. Target molecule type
3. Scaffold architecture

Only mechanisms present in all three selections are eligible.

## Option Selection Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| structuralClass | Yes | RNA structural class (rna_aptamer, catalytic_ribozyme, riboswitch, multivalent_scaffold) |
| targetType | Yes | Target molecule type (protein_active_site, cell_surface_receptor, small_molecule, target_rna) |
| scaffold | Yes | Structural scaffold (selex_refinement, hammerhead, three_way_junction) |
| chemStabilization | Yes | Chemical base stabilization strategy |
| kdGoal | Yes | Target binding affinity threshold |
| deliveryContext | No | Optional tie-breaker: delivery precedent tier with citation, consulted only when evidence level is tied |

## Results / Metrics

### Header Summary

- Target partner & type
- Selected structural modality
- Predicted binding affinity (Kd, nM)
- Serum half-life (t½)

### Candidate Table

| Field | Description |
|-------|-------------|
| Rank | Candidate ranking |
| Construct ID | Unique identifier |
| Structural Motif | RNA structural element |
| Length | Nucleotide length |
| Tm (°C) | Melting temperature |
| ΔG folding | Folding free energy |
| Kd / kcat | Binding affinity / catalytic rate |
| Specificity Score | 0–100 target specificity |
| Serum t½ | Serum half-life estimate |

### Inspection Outputs

- **2D Secondary Structure:** Dot-bracket notation visualization
- **3D Docking:** Tertiary structure docking against target
- **Mutational Tolerance Heatmap:** Position-by-position structural sensitivity
- **Off-Target Homology Scan:** Structural homology against unintended partners
- **Design Rationale:** Explanation of design choices

## Export Formats

- FASTA sequences
- Dot-bracket notation

## References

- Tuerk & Gold (SELEX discovery)
- Ellington & Szostak (in vitro selection)
- RNA aptamer therapeutic reviews
- Pegaptanib clinical development
