"""Fetch single-cell expression data from the Human Protein Atlas JSON API.

Returns the top expressing cell type and nCPM value for a given gene.
"""

import logging
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

_TIMEOUT = 15


def get_single_cell_expression(
    ensembl_id: Optional[str] = None,
    gene_symbol: Optional[str] = None,
) -> Dict[str, Any]:
    """Return single-cell expression data from HPA.

    Returns dict with:
      - cellType: top expressing cell type name
      - cellTpm: nCPM value for that cell type
      - cellTypeAll: dict of all cell type nCPM values
    """
    result: Dict[str, Any] = {
        "cellType": None,
        "cellTpm": None,
        "cellTypeAll": {},
    }

    if not ensembl_id:
        return result

    try:
        resp = requests.get(
            f"https://www.proteinatlas.org/{ensembl_id}.json",
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            logger.warning("HPA JSON returned %s for %s", resp.status_code, ensembl_id)
            return result

        data = resp.json()

        # Try single cell type nCPM first
        ncpm = data.get("RNA single cell type specific nCPM") or {}
        if ncpm:
            # Convert values to float and sort by expression descending
            sorted_cells = sorted(
                [(k, float(v) if v else 0) for k, v in ncpm.items()],
                key=lambda x: x[1],
                reverse=True,
            )
            if sorted_cells:
                top_cell, top_val = sorted_cells[0]
                result["cellType"] = top_cell
                result["cellTpm"] = round(top_val, 1) if top_val else None
                result["cellTypeAll"] = {k: round(v, 1) if v else None for k, v in sorted_cells}
            return result

        # Fall back to single cell type group nCPM
        group_ncpm = data.get("RNA single cell type group specific nCPM") or {}
        if group_ncpm:
            sorted_groups = sorted(
                [(k, float(v) if v else 0) for k, v in group_ncpm.items()],
                key=lambda x: x[1],
                reverse=True,
            )
            if sorted_groups:
                top_group, top_val = sorted_groups[0]
                result["cellType"] = top_group
                result["cellTpm"] = round(top_val, 1) if top_val else None
                result["cellTypeAll"] = {k: round(v, 1) if v else None for k, v in sorted_groups}

    except Exception as exc:
        logger.warning("HPA single-cell lookup failed for %s: %s", ensembl_id, exc)

    return result
