import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.gene_service import build_gene_fallback_payload


def test_build_gene_fallback_payload_fills_missing_values_from_fallbacks():
    payload = build_gene_fallback_payload(
        meta={"canonicalTranscript": None, "proteinId": None, "nomenclatureId": None},
        official_symbol="DMD",
        gene_name="dystrophin",
        gene_id="NCBI:1756",
        is_human=True,
        enrichment_data={},
        protein_props={},
        protein_db={"uniprotAccession": "P11532"},
        clinical_details={},
        disease_resolved="Duchenne muscular dystrophy",
    )

    assert payload["geneFunction"] == "dystrophin"
    assert payload["hgncId"] == "HGNC:DMD"
    assert payload["canonicalTranscript"] == "NCBI:1756"
    assert payload["proteinId"] == "P11532"
    assert payload["geneType"] == "protein_coding"
    assert payload["geneName"] == "dystrophin"


def test_build_gene_fallback_payload_preserves_existing_values():
    payload = build_gene_fallback_payload(
        meta={"canonicalTranscript": "ENST00000378723.7", "proteinId": "ENSP000003", "nomenclatureId": "HGNC:DMD"},
        official_symbol="DMD",
        gene_name="dystrophin",
        gene_id="ENSG00000198947",
        is_human=True,
        enrichment_data={"geneFunction": "Muscle structural protein"},
        protein_props={},
        protein_db={},
        clinical_details={},
        disease_resolved=None,
    )

    assert payload["geneFunction"] == "Muscle structural protein"
    assert payload["hgncId"] == "HGNC:DMD"
    assert payload["canonicalTranscript"] == "ENST00000378723.7"
    assert payload["proteinId"] == "ENSP000003"
