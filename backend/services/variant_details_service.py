"""Fetch top variant details (HGVS, rsID) for a gene.

- HGVS name: from ClinVar (top pathogenic variant, best gold-star review)
- rsID: from ClinVar pathogenic variants looked up in gnomAD v4 (the first
  variant with a gold-star review that also has an rsID in gnomAD)

All data comes from public APIs.  No values are fabricated.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

_TIMEOUT = 12
GNOMAD_API = "https://gnomad.broadinstitute.org/api"
NCBI_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


# ---------------------------------------------------------------------------
# ClinVar — HGVS name (via NCBI E-utilities)
# ---------------------------------------------------------------------------

def _clinvar_top_hgvs(gene_symbol: str) -> Optional[str]:
    """Return the HGVS name of the highest-rated pathogenic ClinVar variant."""
    try:
        resp = requests.get(
            f"{NCBI_EUTILS}/esearch.fcgi",
            params={
                "db": "clinvar",
                "term": (
                    f"({gene_symbol}[Gene]) AND "
                    "(pathogenic[Clinical Significance] OR likely pathogenic[Clinical Significance])"
                ),
                "retmax": 10,
                "sort": "relevance",
                "retmode": "json",
            },
            timeout=_TIMEOUT,
        )
        ids: List[str] = resp.json().get("esearchresult", {}).get("idlist", [])
        if not ids:
            return None

        resp2 = requests.get(
            f"{NCBI_EUTILS}/esummary.fcgi",
            params={"db": "clinvar", "id": ",".join(ids), "retmode": "json"},
            timeout=_TIMEOUT,
        )
        result = resp2.json().get("result", {})
        for uid in result.get("uids", []):
            entry = result[uid]
            for vs in entry.get("variation_set", []):
                name = vs.get("variation_name", "")
                if "c." in name or "p." in name:
                    return name
        return None
    except Exception as exc:
        logger.warning("ClinVar HGVS lookup failed for %s: %s", gene_symbol, exc)
        return None


# ---------------------------------------------------------------------------
# gnomAD — rsID (via ClinVar pathogenic variants in gnomAD)
# ---------------------------------------------------------------------------

_PATHOGENIC_TERMS = ("Pathogenic", "Likely pathogenic")

_GNOMAD_CLINVAR_Q = """
query GnomadClinvar($geneId: String!) {
  gene(gene_id: $geneId, reference_genome: GRCh38) {
    clinvar_variants {
      variant_id
      clinical_significance
      hgvsp
      hgvsc
      gold_stars
      in_gnomad
    }
  }
}
"""

_GNOMAD_VARIANT_Q = """
query GnomadVariant($variantId: String!) {
  variant(variantId: $variantId, dataset: gnomad_r4) {
    variantId
    rsid
    exome { af }
  }
}
"""


def _gnomad_rsid_for_gene(ensembl_gene_id: str) -> Optional[str]:
    """Find an rsID from a ClinVar pathogenic variant that exists in gnomAD."""
    ensembl_base = ensembl_gene_id.split(".")[0]
    try:
        resp = requests.post(
            GNOMAD_API,
            json={
                "query": _GNOMAD_CLINVAR_Q,
                "variables": {"geneId": ensembl_base},
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        clinvar_variants = (
            resp.json()
            .get("data", {})
            .get("gene", {})
            .get("clinvar_variants", [])
        )
        if not clinvar_variants:
            return None

        # Filter to pathogenic, in gnomad, with gold stars — sort best first
        candidates = [
            v
            for v in clinvar_variants
            if v.get("clinical_significance") in _PATHOGENIC_TERMS
            and v.get("in_gnomad")
            and (v.get("gold_stars") or 0) > 0
        ]
        candidates.sort(key=lambda v: -(v.get("gold_stars") or 0))

        # Look up rsIDs one by one (max 5) until we find one
        for v in candidates[:5]:
            try:
                vresp = requests.post(
                    GNOMAD_API,
                    json={
                        "query": _GNOMAD_VARIANT_Q,
                        "variables": {"variantId": v["variant_id"]},
                    },
                    timeout=10,
                )
                vdata = vresp.json().get("data", {}).get("variant")
                rsid = (vdata or {}).get("rsid")
                if rsid:
                    return rsid
            except Exception:
                continue

        return None
    except Exception as exc:
        logger.warning("gnomAD rsID lookup failed for %s: %s", ensembl_gene_id, exc)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_variant_details(
    gene_symbol: str,
    ensembl_gene_id: Optional[str] = None,
    entrez_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Return top ClinVar HGVS name and a representative rsID for the gene."""
    hgvs = _clinvar_top_hgvs(gene_symbol)
    rsid = _gnomad_rsid_for_gene(ensembl_gene_id) if ensembl_gene_id else None
    return {"topHgvsName": hgvs, "topRsId": rsid}


def get_clinvar_variants(ensembl_gene_id: str) -> List[Dict[str, Any]]:
    """Return pathogenic ClinVar variants for a gene (via gnomAD GraphQL).

    Each variant dict contains:
      - variant_id: gnomAD variant ID
      - clinical_significance: e.g. "Pathogenic"
      - hgvsp: protein HGVS (e.g. p.Arg2905Ter)
      - hgvsc: coding HGVS (e.g. c.8713C>T)
      - gold_stars: ClinVar review stars
      - rsid: rsID if available in gnomAD
      - allele_frequency: exome allele frequency if available
    """
    ensembl_base = ensembl_gene_id.split(".")[0]
    try:
        resp = requests.post(
            GNOMAD_API,
            json={
                "query": _GNOMAD_CLINVAR_Q,
                "variables": {"geneId": ensembl_base},
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        clinvar_variants = (
            resp.json()
            .get("data", {})
            .get("gene", {})
            .get("clinvar_variants", [])
        )
        if not clinvar_variants:
            return []

        # Filter to pathogenic / likely-pathogenic
        pathogenic = [
            v for v in clinvar_variants
            if v.get("clinical_significance") in _PATHOGENIC_TERMS
        ]

        # Enrich with rsID and allele frequency (top 5 only to keep latency low)
        enriched: List[Dict[str, Any]] = []
        for v in pathogenic[:5]:
            entry: Dict[str, Any] = {
                "variantId": v.get("variant_id", ""),
                "clinicalSignificance": v.get("clinical_significance", ""),
                "hgvsp": v.get("hgvsp", ""),
                "hgvsc": v.get("hgvsc", ""),
                "goldStars": v.get("gold_stars", 0),
                "rsid": None,
                "alleleFrequency": None,
            }
            if v.get("in_gnomad"):
                try:
                    vresp = requests.post(
                        GNOMAD_API,
                        json={
                            "query": _GNOMAD_VARIANT_Q,
                            "variables": {"variantId": v["variant_id"]},
                        },
                        timeout=10,
                    )
                    vdata = vresp.json().get("data", {}).get("variant")
                    if vdata:
                        entry["rsid"] = vdata.get("rsid")
                        exome = vdata.get("exome") or {}
                        af = exome.get("af")
                        if af is not None:
                            entry["alleleFrequency"] = float(af)
                except Exception:
                    pass
            enriched.append(entry)

        # Sort by gold stars (best first), then by whether they have an HGVS
        enriched.sort(key=lambda x: (-x["goldStars"], x["hgvsp"] == ""))

        return enriched
    except Exception as exc:
        logger.warning("ClinVar variants lookup failed for %s: %s", ensembl_gene_id, exc)
        return []
