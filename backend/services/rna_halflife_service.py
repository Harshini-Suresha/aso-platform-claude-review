"""RNA half-life data from RNAdecayCafe (Zenodo DOI: 10.5281/zenodo.15785218).

Provides gene-level RNA half-life estimates averaged across 12 human cell lines.
Data source: https://zenodo.org/records/15785218
"""

import csv
import io
from functools import lru_cache

import requests

# Zenodo direct download URL for the averaged half-life dataset
RNADECAYCAFE_URL = (
    "https://zenodo.org/api/records/15785218/files/AvgKdegs_genes_v1.csv/content"
)


@lru_cache(maxsize=1)
def _load_halflife_index():
    """Download and parse the RNAdecayCafe dataset once per API process.
    
    Returns a dict mapping gene symbol (uppercase) to average half-life in hours.
    Half-life is computed as the average of avg_halflife across all cell lines
    where the gene was measured.
    """
    try:
        response = requests.get(RNADECAYCAFE_URL, timeout=12)
        response.raise_for_status()
        text = response.content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        
        # Accumulate half-lives per gene across cell lines
        gene_halflives = {}
        for row in reader:
            gene_symbol = row.get("feature_ID", "").strip().upper()
            if not gene_symbol:
                continue
            try:
                halflife = float(row.get("avg_halflife", ""))
                if halflife > 0:  # Only include valid positive values
                    if gene_symbol not in gene_halflives:
                        gene_halflives[gene_symbol] = []
                    gene_halflives[gene_symbol].append(halflife)
            except (ValueError, TypeError):
                continue
        
        # Compute average half-life per gene
        index = {}
        for gene, values in gene_halflives.items():
            avg = sum(values) / len(values)
            index[gene] = round(avg, 2)
        
        return index
    except (requests.RequestException, UnicodeDecodeError, csv.Error, OSError) as e:
        import logging
        logging.warning(f"Failed to load RNAdecayCafe dataset: {e}")
        return {}


def get_rna_halflife(gene_symbol: str) -> dict:
    """Return RNA half-life data for a gene.
    
    Returns:
        dict with keys:
            - rnaHalflife: str | None - Formatted half-life (e.g., "5.2 h")
            - rnaHalflifeHours: float | None - Raw half-life in hours
            - rnaHalflifeSource: str - Data source citation
    """
    result = {
        "rnaHalflife": None,
        "rnaHalflifeHours": None,
        "rnaHalflifeSource": "RNAdecayCafe (Vock et al. 2025, Zenodo)",
    }
    
    if not gene_symbol:
        return result
    
    symbol = gene_symbol.strip().upper()
    index = _load_halflife_index()
    halflife_hours = index.get(symbol)
    
    if halflife_hours is not None:
        result["rnaHalflifeHours"] = halflife_hours
        if halflife_hours < 1:
            result["rnaHalflife"] = f"{halflife_hours * 60:.0f} min"
        elif halflife_hours < 24:
            result["rnaHalflife"] = f"{halflife_hours:.1f} h"
        else:
            result["rnaHalflife"] = f"{halflife_hours / 24:.1f} d"
    
    return result
