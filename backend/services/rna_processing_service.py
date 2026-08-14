"""
RNA Processing Modulation (TG04) backend service.

Covers A7 Exon Skipping, A8 Exon Inclusion, A9 Pseudoexon Suppression,
A10 Cryptic Splice Site Blocking, and A11 Alternative Polyadenylation (APA)
Modulation — the five mechanisms in backend/rulebooks/therapeutic-goals.json's
TG04. All five are RNase H-independent steric blockers per their own rule.json
``asoChemistry`` text (verified below via the shared
``_mechanism_rnase_h_requirement`` gate), unlike the RNase H-recruiting
mechanisms in gene_silencing_service.

Deliberately reuses gene_silencing_service's target-analysis fetch, real
exon-to-CDS mapping, and real biophysics scoring rather than duplicating them
(see PROJECT_HANDOFF.md §7, "cross-agent drift warning"). A7/A8/A9/A10 target
real genomic sequence at each selected exon's own splice-junction coordinate,
fetched from Ensembl — not estimated. A11 targets the real 3'UTR sequence
(already derived from the real cDNA in get_target_analysis), anchored on
canonical polyadenylation-signal hexamers when present.
"""

from __future__ import annotations

import logging

from services.gene_silencing_service import (
    ENSEMBL_REST,
    LENGTH_RANGE,
    MIN_GC,
    MAX_GC,
    _ensembl_get,
    _mechanism_chemistry_compatibility,
    _mechanism_note,
    _calc_gc,
    _calc_tm,
    _self_complement_mfe,
    _polyg_score,
    _cpg_count,
    _longest_homopolymer,
    _purine_content,
    _sequence_complexity,
    _gc_skew,
    _molecular_weight,
    _extinction_coefficient,
    _nuclease_resistance_score,
    _cellular_uptake_score,
    _bbb_crossing_score,
    _synthesis_difficulty,
    _off_target_risk,
    _immune_stimulation_risk,
    _duplex_stability,
    _reverse_complement,
    _target_duplex_energy,
    _composite_score,
    _tm_fit_score,
)

logger = logging.getLogger(__name__)

RNA_PROCESSING_MECHANISMS = ["A7", "A8", "A9", "A10", "A11"]

# Splice-junction mechanisms (A7/A8/A9/A10) target real Ensembl exon
# coordinates directly. A9/A10 act on cryptic/pseudoexon sites that are, by
# definition, not in Ensembl's annotated exon model — those get anchored on
# the nearest annotated exon's real junction with an explicit caveat rather
# than an invented cryptic-site coordinate.
JUNCTION_MECHANISMS = {"A7", "A8", "A9", "A10"}
APPROXIMATE_ANCHOR_MECHANISMS = {"A9", "A10"}

# Symmetric genomic window (nt each side) fetched around a splice junction.
# Symmetric-about-the-junction is what makes strand handling exact: Ensembl
# reverse-complements the minus-strand window for us, and reverse-complementing
# a window that is symmetric about `pos` leaves `pos` at the same offset from
# the start of the returned sequence on both strands (see
# _fetch_junction_flank), so no separate exonic/intronic split is needed.
JUNCTION_FLANK_NT = 40

# Canonical human polyadenylation-signal hexamers, ranked by prevalence
# (Beaudoing et al. 2000, Genome Res.; Tian & Manley 2017, Nat Rev Mol Cell
# Biol "Alternative polyadenylation of mRNA precursors"). Not exhaustive —
# covers the validated variants reported to account for the large majority of
# annotated human PAS usage.
PAS_HEXAMERS = [
    "AAUAAA", "AUUAAA", "UAUAAA", "AGUAAA", "AAGAAA", "AAUAUA",
    "AAUACA", "CAUAAA", "GAUAAA", "AAUGAA", "ACUAAA", "AAAAAG",
]


def _exon_boundary_genomic_pos(exon: dict, strand: int, boundary: str) -> int | None:
    """Genomic coordinate of an exon's acceptor or donor splice-junction.

    ``acceptor`` = the exon's transcript-5' boundary (intron->exon transition,
    3' splice site). ``donor`` = the exon's transcript-3' boundary (exon->intron
    transition, 5' splice site). Exon ``start``/``end`` are always genomic-
    ascending regardless of strand (see gene_silencing_service.
    _parse_exons_from_transcript); which one is the transcript-5'/3' boundary
    flips with strand.
    """
    start, end = exon.get("start"), exon.get("end")
    if start is None or end is None:
        return None
    if strand == -1:
        return end if boundary == "acceptor" else start
    return start if boundary == "acceptor" else end


def _fetch_junction_flank(chromosome: str, strand: int, genomic_pos: int,
                           flank: int = JUNCTION_FLANK_NT) -> tuple[str, int]:
    """Real genomic sequence centered on a splice-junction genomic position.

    Returns (sequence, junction_offset): sequence is in transcript 5'->3'
    orientation (RNA alphabet, T->U); junction_offset is the 0-based index of
    the junction itself within that sequence (exact when the window isn't
    clamped at the start of the chromosome, which is never the case for a
    real gene's splice sites).
    """
    region_start = max(1, genomic_pos - flank)
    region_end = genomic_pos + flank
    try:
        resp = _ensembl_get(
            f"{ENSEMBL_REST}/sequence/region/homo_sapiens/{chromosome}:{region_start}..{region_end}:{strand}"
        )
        if not resp.ok:
            return "", 0
        seq = resp.json().get("seq", "").upper().replace("T", "U")
        return seq, genomic_pos - region_start
    except Exception as exc:
        logger.warning(
            "Junction flank fetch failed at %s:%d strand %d: %s",
            chromosome, genomic_pos, strand, exc,
        )
        return "", 0


def _pas_search_windows(utr3_sequence: str, aso_length: int) -> list[tuple[int, int, str]]:
    """Search windows for A11: every candidate offset in the returned range
    fully covers a real canonical PAS hexamer hit in the 3'UTR (mirrors
    gene_silencing_service's variant-centered-window construction, generalized
    from a single point to a hexamer range: an offset o keeps the whole
    hexamer inside [o, o+aso_length) iff o <= idx and o+aso_length >= idx+6).
    Falls back to scanning the whole 3'UTR when no canonical hexamer is
    present — APA can also be modulated via upstream/downstream regulatory
    elements away from the PAS itself, and the rulebook lists those as valid
    targets too.
    """
    seq = utr3_sequence.upper().replace("T", "U")
    windows: list[tuple[int, int, str]] = []
    for hexamer in PAS_HEXAMERS:
        search_from = 0
        while True:
            idx = seq.find(hexamer, search_from)
            if idx < 0:
                break
            hexamer_end = idx + len(hexamer)
            win_start = max(0, hexamer_end - aso_length)
            win_end = min(len(seq) - aso_length, idx)
            if win_end >= win_start:
                windows.append((win_start, win_end, f"PAS hexamer {hexamer} @ 3'UTR+{idx}"))
            search_from = idx + 1
    if not windows:
        windows.append((0, max(0, len(seq) - aso_length), "3'UTR (no canonical PAS hexamer found)"))
    return windows


def generate_rna_processing_candidates(
    target_exon_indices: list[int] | None,
    aso_length: int,
    chemistry: str,
    modifications: list[str],
    exons: list[dict],
    canonical_transcript: dict | None,
    mechanism_id: str,
    utr3_sequence: str | None = None,
    delivery_context: str | None = None,
) -> list[dict]:
    """Generate steric-blocking ASO candidates for a TG04 mechanism (A7-A11).

    A9 (pseudoexon suppression) and A10 (cryptic splice site blocking) act on
    sites this pipeline cannot localize automatically — a pseudoexon or
    cryptic splice site is by definition absent from Ensembl's annotated exon
    model. Candidates for these two are generated at the *flanking annotated
    exon's* real splice junction as the closest available real coordinate;
    every such candidate carries an explicit ``exonMappingSource`` /
    ``mechanismNotes`` caveat that the exact cryptic/pseudoexon position must
    be confirmed against the causative variant before synthesis, rather than
    presenting an approximate anchor as if it were the real target.
    """
    if mechanism_id not in RNA_PROCESSING_MECHANISMS:
        raise ValueError(f"Unsupported RNA-processing mechanism: {mechanism_id}")

    aso_length = max(LENGTH_RANGE["min"], min(LENGTH_RANGE["max"], aso_length))

    _mechanism_chemistry_compatibility(mechanism_id, chemistry)
    mechanism_note = _mechanism_note(mechanism_id, chemistry)
    if mechanism_id in APPROXIMATE_ANCHOR_MECHANISMS:
        mechanism_note += (
            " This mechanism targets a cryptic/pseudoexon splice site that Ensembl's "
            "annotated exon model does not contain by definition — candidates below are "
            "anchored on the nearest annotated exon's real splice junction as the closest "
            "available real coordinate. Confirm the exact cryptic/pseudoexon position "
            "against the causative variant before synthesis."
        )

    # (search_start, search_end, region_label, source_seq, exon_num) per window
    search_windows: list[tuple[int, int, str, str, int | None]] = []

    if mechanism_id == "A11":
        if not utr3_sequence:
            return []
        seq_source = utr3_sequence.upper().replace("T", "U")
        for win_start, win_end, label in _pas_search_windows(seq_source, aso_length):
            search_windows.append((win_start, win_end, label, seq_source, None))
    else:
        if not target_exon_indices:
            raise ValueError(
                f"{mechanism_id} requires at least one target exon — splice-junction "
                "mechanisms cannot target 'the whole transcript'."
            )
        if not canonical_transcript or not canonical_transcript.get("chromosome"):
            return []
        chromosome = str(canonical_transcript["chromosome"])
        strand = canonical_transcript.get("strand", 1)
        exon_count = len(exons)

        for exon_index in sorted(set(target_exon_indices)):
            if not (0 < exon_index <= exon_count):
                continue
            exon = exons[exon_index - 1]
            for boundary, boundary_label in (("acceptor", "acceptor"), ("donor", "donor")):
                pos = _exon_boundary_genomic_pos(exon, strand, boundary)
                if pos is None:
                    continue
                flank_seq, _junction_offset = _fetch_junction_flank(chromosome, strand, pos)
                if not flank_seq:
                    continue
                win_end = max(0, len(flank_seq) - aso_length)
                label = f"Exon {exon_index} splice {boundary_label}"
                search_windows.append((0, win_end, label, flank_seq, exon_index))

    exon_mapping_source = "ensembl_genomic_flank" if mechanism_id != "A11" else "ensembl_cdna_utr3"

    candidates = []
    seen = set()
    step = max(1, aso_length // 3)
    for search_start, search_end, region_label, seq_source, exon_num in search_windows:
        if search_end < search_start:
            continue
        for offset in range(search_start, search_end + 1, step):
            candidate_seq = seq_source[offset: offset + aso_length]
            if len(candidate_seq) < aso_length or candidate_seq in seen:
                continue
            seen.add(candidate_seq)

            gc = _calc_gc(candidate_seq)
            if gc < MIN_GC or gc > MAX_GC:
                continue

            tm = _calc_tm(candidate_seq)
            self_mfe = _self_complement_mfe(candidate_seq)
            pg = _polyg_score(candidate_seq)
            cpg = _cpg_count(candidate_seq)

            aso_seq = _reverse_complement(candidate_seq)
            duplex_energy = _target_duplex_energy(aso_seq, candidate_seq)
            tm_fit = _tm_fit_score(tm, chemistry, modifications, mechanism_id)
            composite_score = _composite_score(duplex_energy, tm_fit)

            nuclease_score = _nuclease_resistance_score(chemistry, modifications)
            uptake_score = _cellular_uptake_score(chemistry, aso_length)
            bbb_score = _bbb_crossing_score(chemistry, aso_length, modifications)
            synthesis_score = _synthesis_difficulty(candidate_seq, chemistry, modifications)
            complexity_val = _sequence_complexity(candidate_seq)
            off_target = _off_target_risk(candidate_seq, complexity_val)
            immune_risk = _immune_stimulation_risk(candidate_seq, chemistry)
            stability = _duplex_stability(gc, tm, aso_length)
            mw = _molecular_weight(candidate_seq)
            ext_coeff = _extinction_coefficient(candidate_seq)

            candidates.append({
                "sequence": aso_seq,
                "length": aso_length,
                "compositeScore": composite_score,
                "learnedEfficacy": {
                    "available": False,
                    "value": None,
                    "modelInfo": "Not yet trained",
                    "scopeCaveat": None,
                },
                "realMetrics": {
                    "targetDuplexEnergy": duplex_energy,
                    "meltingTempC": tm,
                    "selfStructureMfe": self_mfe,
                    "gcContent": round(gc * 100, 1),
                    "cpgCount": cpg,
                    "longestHomopolymer": _longest_homopolymer(candidate_seq),
                    "purineContent": _purine_content(candidate_seq),
                    "gcSkew": _gc_skew(candidate_seq),
                    "sequenceComplexity": complexity_val,
                    "polyGPass": pg == 0,
                    "molecularWeight": mw,
                    "extinctionCoefficient": ext_coeff,
                    "duplexStability": stability,
                },
                "heuristicEstimates": {
                    "nucleaseResistance": {
                        "value": nuclease_score,
                        "note": "Chemistry-class rule of thumb, not measured.",
                    },
                    "cellularUptake": {
                        "value": uptake_score,
                        "note": "Length/chemistry rule of thumb, not measured.",
                    },
                    "bbbCrossing": {
                        "value": bbb_score,
                        "note": "Length/chemistry rule of thumb, not measured.",
                    },
                    "synthesisDifficulty": {
                        "value": synthesis_score,
                        "note": "Sequence/chemistry rule of thumb, not measured.",
                    },
                    "offTargetRisk": {
                        "value": off_target,
                        "note": "Length/repetitiveness heuristic — not a genome alignment check.",
                    },
                    "immuneStimulation": {
                        "value": immune_risk,
                        "note": "CpG-count heuristic, not an immunogenicity assay.",
                    },
                },
                "targetRegion": region_label,
                "mechanismId": mechanism_id,
                "chemistry": chemistry,
                "modifications": modifications,
                "exonNumber": exon_num,
                "exonLength": None,
                "exonMappingSource": exon_mapping_source,
                "deliveryContext": delivery_context or "",
                "defectType": "",
                "silencingScope": "",
                "defectNotes": "",
                "mechanismNotes": mechanism_note,
                "knownVariant": "",
                "alleleSpecific": False,
                "alleleNotes": "",
                "alleleDiscriminationScore": None,
                "alleleDiscriminationNote": None,
            })

    candidates.sort(key=lambda c: c["compositeScore"], reverse=True)
    return candidates
