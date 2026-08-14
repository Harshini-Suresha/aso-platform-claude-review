import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.gene_silencing_service import _map_exons_to_cds


def test_map_exons_to_cds_handles_long_3prime_utr_exactly():
    """Exon-to-CDS mapping must not spread UTR evenly across exons.

    Models a gene shaped like TTR/SOD1: a short 5'UTR exon, two pure-CDS
    internal exons, and a final exon whose 3'UTR (520 nt) dwarfs its CDS
    contribution (20 nt). A proportional-by-genomic-length estimate would
    badly over-allocate CDS to that last exon and shift every internal
    boundary; the real cDNA-based mapping must hit the boundary exactly.
    """
    exon_lens = [210, 100, 150, 520]
    cds_len_per_exon = [10, 100, 150, 20]
    cds_seq = "A" * sum(cds_len_per_exon)
    utr5 = "C" * 200
    utr3 = "G" * 500
    cdna = utr5 + cds_seq + utr3
    cds_at = len(utr5)

    exons = [{"index": i + 1, "length": l} for i, l in enumerate(exon_lens)]
    _map_exons_to_cds(exons, cdna, cds_seq, cds_at)

    cursor = 0
    expected = []
    for l in cds_len_per_exon:
        expected.append((cursor, cursor + l))
        cursor += l

    actual = [(e["cdsStart"], e["cdsEnd"]) for e in exons]
    assert actual == expected


def test_map_exons_to_cds_gives_zero_width_range_for_pure_utr_exon():
    """An exon entirely inside the 5'UTR has no CDS presence at all."""
    exon_lens = [50, 300]  # exon 1 is entirely 5'UTR
    cds_seq = "A" * 100
    utr5 = "C" * 50
    cdna = utr5 + cds_seq
    cds_at = len(utr5)

    exons = [{"index": i + 1, "length": l} for i, l in enumerate(exon_lens)]
    _map_exons_to_cds(exons, cdna, cds_seq, cds_at)

    assert exons[0]["cdsStart"] == exons[0]["cdsEnd"] == 0
    assert exons[1]["cdsStart"] == 0
    assert exons[1]["cdsEnd"] == 100
