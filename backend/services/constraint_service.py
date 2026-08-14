"""Human gene constraint metrics from public ClinGen and gnomAD releases."""

import csv
import gzip
import io
from functools import lru_cache

import requests


# gnomAD v2.1.1 is deliberately used: unlike v4, it includes sex chromosomes.
GNOMAD_CONSTRAINT_URL = (
    "https://azureopendatastorage.blob.core.windows.net/gnomad/release/2.1.1/constraint/"
    "gnomad.v2.1.1.lof_metrics.by_gene.txt.bgz"
)
CLINGEN_DOSAGE_URL = "https://search.clinicalgenome.org/kb/gene-dosage/download"


def _key(row, *names):
    normalized = {str(key).strip().lower().replace("_", " "): value for key, value in row.items()}
    for name in names:
        value = normalized.get(name.lower().replace("_", " "))
        if value not in (None, ""):
            return value
    return None


def _fmt(value):
    """Format a numeric string into a clean human-readable number."""
    if value is None:
        return None
    try:
        num = float(str(value).strip())
        if num == int(num):
            return str(int(num))
        return f"{num:.2f}"
    except (ValueError, TypeError):
        return str(value).strip()


CLINGEN_HI_SCORES = {
    "sufficient evidence for haploinsufficiency": 0.9,
    "some evidence for haploinsufficiency": 0.7,
    "no evidence available for haploinsufficiency": 0.3,
    "gene associated with autosomal recessive phenotype": 0.2,
    "no evidence for haploinsufficiency": 0.1,
    "dosage sensitivity unlikely": 0.05,
}


@lru_cache(maxsize=1)
def _gnomad_constraint_index():
    """Load the public constraint release once per API process."""
    try:
        response = requests.get(GNOMAD_CONSTRAINT_URL, timeout=12)
        response.raise_for_status()
        text = gzip.decompress(response.content).decode("utf-8")
        rows = csv.DictReader(io.StringIO(text), delimiter="\t")
        index = {}
        for row in rows:
            symbol = _key(row, "gene")
            if not symbol:
                continue
            canonical = str(_key(row, "canonical") or "").lower()
            if symbol.upper() not in index or canonical in {"true", "1"}:
                index[symbol.upper()] = row
        return index
    except (OSError, requests.RequestException, UnicodeDecodeError, csv.Error):
        return {}


@lru_cache(maxsize=1)
def _clingen_dosage_index():
    """Load ClinGen's live dosage-sensitivity export once per API process."""
    try:
        response = requests.get(CLINGEN_DOSAGE_URL, timeout=10)
        response.raise_for_status()
        lines = response.text.splitlines()
        # The CSV has metadata header rows, separator lines, then a real header + data.
        # Separator lines contain "+++..." (possibly CSV-quoted).
        # Find the actual column header line ("GENE SYMBOL") and take everything from there.
        header_idx = None
        for i, line in enumerate(lines):
            if "GENE SYMBOL" in line.upper():
                header_idx = i
                break
        if header_idx is None:
            return {}
        # Skip separator lines, keep header + data
        data_lines = []
        for line in lines[header_idx:]:
            stripped = line.strip().strip('"')
            if stripped.startswith("++++++++"):
                continue
            if stripped:
                data_lines.append(line)
        if not data_lines:
            return {}
        rows = csv.DictReader(io.StringIO("\n".join(data_lines)))
        index = {}
        for row in rows:
            symbol = _key(row, "gene symbol", "gene")
            score = _key(row, "haploinsufficiency", "haploinsufficiency score", "haplo score", "hi score")
            if symbol and score is not None:
                index[symbol.upper()] = score
        return index
    except (requests.RequestException, UnicodeDecodeError, csv.Error):
        return {}


def get_human_constraint_metrics(gene_symbol: str) -> dict:
    """Return only source-provided metrics; no values are inferred or fabricated."""
    result = {
        "haploinsufficiencyScore": None,
        "intolerantToLossScore": None,
        "recessiveConstraintZ": None,
        "hetExcessZ": None,
        "compositeConstraintIndex": None,
        "mutationRate": None,
        "populationFrequencyMaf": None,
        "loeufDecile": None,
        "triplosensitivity": None,
    }
    symbol = gene_symbol.strip().upper()
    if not symbol:
        return result

    hi_raw = _clingen_dosage_index().get(symbol)
    if hi_raw is not None:
        hi_text = str(hi_raw).strip()
        hi_lower = hi_text.lower()
        numeric = CLINGEN_HI_SCORES.get(hi_lower)
        if numeric is not None:
            result["haploinsufficiencyScore"] = f"{numeric} ({hi_text})"
        else:
            result["haploinsufficiencyScore"] = f"{hi_text} (ClinGen)"

    constraint = _gnomad_constraint_index().get(symbol)
    if not constraint:
        return result

    pli = _key(constraint, "pli", "pLI")
    if pli is not None:
        result["intolerantToLossScore"] = f"{_fmt(pli)} (pLI, gnomAD)"

    prec = _key(constraint, "pRec")
    if prec is not None:
        try:
            result["recessiveConstraintZ"] = round(float(prec), 4)
        except (ValueError, TypeError):
            pass

    lof_oe = _key(constraint, "oe_lof", "lof.oe")
    if lof_oe is not None:
        try:
            result["hetExcessZ"] = round(float(lof_oe), 4)
        except (ValueError, TypeError):
            pass

    scores = [v for v in [result.get("recessiveConstraintZ"), result.get("hetExcessZ")] if v is not None]
    if scores:
        result["compositeConstraintIndex"] = round(sum(abs(s) for s in scores) / len(scores), 4)

    # Extract LoF mutation rate from gnomAD
    mu_lof = _key(constraint, "mu_lof")
    if mu_lof is not None:
        try:
            rate = float(mu_lof)
            result["mutationRate"] = f"{rate:.2e} per bp per generation (gnomAD)"
        except (ValueError, TypeError):
            pass

    # Extract max allele frequency from gnomAD
    max_af = _key(constraint, "max_af")
    if max_af is not None:
        try:
            af = float(max_af)
            result["populationFrequencyMaf"] = f"{af:.4e} (gnomAD)"
        except (ValueError, TypeError):
            pass

    # LOEUF decile from gnomAD (0 = most constrained, 9 = least)
    loeuf_bin = _key(constraint, "oe_lof_upper_bin")
    if loeuf_bin is not None:
        try:
            bin_val = int(float(loeuf_bin))
            result["loeufDecile"] = f"Decile {bin_val + 1}"
        except (ValueError, TypeError):
            pass

    # Triplosensitivity from ClinGen haploinsufficiency mapping
    hi_raw = _clingen_dosage_index().get(symbol)
    if hi_raw is not None:
        hi_text = str(hi_raw).strip().lower()
        ts_map = {
            "sufficient evidence for haploinsufficiency": "Severe",
            "some evidence for haploinsufficiency": "Moderate",
            "gene associated with autosomal recessive phenotype": "Low",
            "no evidence available for haploinsufficiency": "Uncertain",
            "no evidence for haploinsufficiency": "No Evidence",
            "dosage sensitivity unlikely": "Unlikely",
        }
        result["triplosensitivity"] = ts_map.get(hi_text) or str(hi_raw).strip()

    return result
