"""ClinVar mutation type breakdown for a gene.

Queries ClinVar via NCBI E-utilities to classify pathogenic variants
by mutation type: large deletions, large duplications, nonsense/point,
frameshift, and splice site mutations.

Source: NCBI ClinVar (via ESearch + EFetch)
"""

import logging
import re
import time
from typing import Optional

import requests

logger = logging.getLogger(__name__)

NCBI_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def _clinvar_esearch(session: requests.Session, query: str, retmax: int = 0) -> tuple:
    """Single ESearch call returning (count, id_list). Retries with backoff on 429."""
    for attempt in range(4):
        try:
            params = {"db": "clinvar", "term": query, "retmode": "json"}
            if retmax:
                params["retmax"] = retmax
            resp = session.get(f"{NCBI_EUTILS}/esearch.fcgi", params=params, timeout=10)
            if resp.status_code == 200:
                data = resp.json().get("esearchresult") or {}
                count = int(data.get("count", 0))
                ids = data.get("idlist", [])
                return count, ids
            if resp.status_code == 429:
                wait = 2.0 * (2 ** attempt)
                logger.warning("ClinVar ESearch 429, retrying in %.1fs (attempt %d/4)", wait, attempt + 1)
                time.sleep(wait)
                continue
            logger.warning("ClinVar ESearch HTTP %d", resp.status_code)
            break
        except Exception as e:
            logger.warning("ClinVar ESearch failed: %s", e)
            break
    return 0, []


def _clinvar_fetch_types(session: requests.Session, ids: list) -> list:
    """Fetch ClinVar variant type annotations via ESummary for given IDs."""
    if not ids:
        return []
    types = []
    batch_size = 100
    for i in range(0, len(ids), batch_size):
        batch = ids[i:i + batch_size]
        data = None
        for attempt in range(3):
            try:
                resp = session.get(
                    f"{NCBI_EUTILS}/esummary.fcgi",
                    params={"db": "clinvar", "id": ",".join(batch), "retmode": "json"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json().get("result", {})
                    break
                time.sleep(1.0 * (2 ** attempt) + 0.5)
            except Exception:
                time.sleep(1.0 * (2 ** attempt) + 0.5)
        if data is None:
            continue
        for uid in batch:
            record = data.get(uid, {})
            if not isinstance(record, dict):
                continue
            title = record.get("title", "")
            variant_type = record.get("variation_type", "")
            types.append({
                "title": title,
                "type": variant_type,
            })
    return types


def _classify_variant(title: str, variant_type: str) -> Optional[str]:
    """Classify a ClinVar record into a mutation category.

    ClinVar titles follow HGVS-like patterns:
    - NM_004006.3(DMD):c.9038del (p.Asn3013fs)          → frameshift
    - NM_004006.3(DMD):c.5695A>T (p.Lys1899Ter)          → nonsense (stop gained)
    - NM_004006.3(DMD):c.4344+1G>A                       → splice site
    - NC_000023.10:g.(32383317_32398626)_(...).del        → large deletion
    - GRCh38/hg38 Xp21.1-11.3(chrX:...)x1                → large deletion (copy number)
    """
    combined = f"{title} {variant_type}".lower()
    title_upper = title.upper()

    # Large deletion — genomic coordinate deletion or cytoband-level
    if re.search(r"nc_\d+\.\d+:g\.", combined) and "del" in combined:
        return "large_deletion"
    if re.search(r"grch\d+/hg\d+\s+\w+\(chr", combined):
        # Copy number variant at chromosomal level
        if "x0" in combined or "x1" in combined and "del" in combined:
            return "large_deletion"
        if "x3" in combined or "x4" in combined:
            return "large_duplication"
        return "large_deletion"
    if any(kw in combined for kw in [
        "whole gene deletion", "exon deletion", "multi-exon deletion",
        "gene deletion", "whole-gene deletion",
    ]):
        return "large_deletion"

    # Large duplication — genomic coordinate or known duplication patterns
    if re.search(r"nc_\d+\.\d+:g\.", combined) and "dup" in combined:
        return "large_duplication"
    if any(kw in combined for kw in [
        "whole gene duplication", "exon duplication", "multi-exon duplication",
        "gene duplication", "whole-gene duplication",
    ]):
        return "large_duplication"

    # Splice site — c.XXX+ or c.XXX- with a nucleotide change
    if re.search(r"c\.\d+[+-]\d+[a-z]>[a-z]", combined):
        return "splice_site"
    if any(kw in combined for kw in ["splice", "splicing", "intronic"]):
        return "splice_site"

    # Frameshift — protein change ends with "fs" (e.g. p.Asn3013fs)
    if re.search(r"p\.\w+fs\b", combined) or "frameshift" in combined:
        return "frameshift"

    # Nonsense — protein change contains "Ter" or "ext" or "stop"
    if re.search(r"p\.\w+Ter\b", combined) or re.search(r"p\.\w+ext\d", combined):
        return "nonsense_point"
    if any(kw in combined for kw in ["nonsense", "stop gained", "stop lost"]):
        return "nonsense_point"

    # Missense / single nucleotide — c.XXXA>T style with protein change
    if re.search(r"c\.\d+[a-z]?>[a-z]", combined) and re.search(r"p\.", combined):
        return "nonsense_point"

    # Single nucleotide substitution without protein annotation
    if re.search(r"c\.\d+[a-z]?>[a-z]$", combined.strip()):
        return "nonsense_point"

    return None


def get_mutation_breakdown(gene_symbol: str) -> dict:
    """Classify ClinVar variants by mutation type for a gene.

    Returns:
        dict with keys:
            - knownPathogenicVariants: int | None (pathogenic + likely pathogenic count)
            - totalClinvarVariants: int | None (total variants in ClinVar)
            - mutationBreakdown: dict with:
                - largeExonDeletions: int | None
                - largeExonDuplications: int | None
                - nonsensePointMutations: int | None
                - frameshiftMutations: int | None
                - spliceSiteMutations: int | None
    """
    result = {
        "knownPathogenicVariants": None,
        "totalClinvarVariants": None,
        "mutationBreakdown": {
            "largeExonDeletions": None,
            "largeExonDuplications": None,
            "nonsensePointMutations": None,
            "frameshiftMutations": None,
            "spliceSiteMutations": None,
        },
    }

    if not gene_symbol:
        return result

    symbol = gene_symbol.strip()
    
    # First, get total ClinVar variants for this gene
    total_query = f"{symbol}[gene]"
    total_count, _ = _clinvar_esearch(requests.Session(), total_query, retmax=0)
    result["totalClinvarVariants"] = total_count if total_count > 0 else None
    
    # Then get pathogenic variants
    base_query = f"{symbol}[gene] AND (pathogenic[clinsig] OR likely pathogenic[clinsig])"

    with requests.Session() as session:
        # Single ESearch for count + IDs (avoids double-call rate limiting)
        sample = min(300, 10000)  # cap at 300 samples
        total, ids = _clinvar_esearch(session, base_query, retmax=sample)
        result["knownPathogenicVariants"] = total if total > 0 else None

        if total == 0 or not ids:
            return result

        # Fetch variant type annotations via ESummary
        records = _clinvar_fetch_types(session, ids)

        if not records:
            return result

        counts = {
            "large_deletion": 0,
            "large_duplication": 0,
            "nonsense_point": 0,
            "frameshift": 0,
            "splice_site": 0,
        }

        for rec in records:
            category = _classify_variant(rec.get("title", ""), rec.get("type", ""))
            if category:
                counts[category] += 1

        # Scale up if we only sampled a subset
        scale = total / len(records) if len(records) < total else 1.0

        result["mutationBreakdown"] = {
            "largeExonDeletions": max(round(counts["large_deletion"] * scale), 0) if counts["large_deletion"] else None,
            "largeExonDuplications": max(round(counts["large_duplication"] * scale), 0) if counts["large_duplication"] else None,
            "nonsensePointMutations": max(round(counts["nonsense_point"] * scale), 0) if counts["nonsense_point"] else None,
            "frameshiftMutations": max(round(counts["frameshift"] * scale), 0) if counts["frameshift"] else None,
            "spliceSiteMutations": max(round(counts["splice_site"] * scale), 0) if counts["splice_site"] else None,
        }

    return result
