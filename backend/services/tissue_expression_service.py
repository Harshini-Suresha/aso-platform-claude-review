"""Tissue expression data from multiple sources.

Queries GTEx, Human Protein Atlas (HPA), and other databases to provide
tissue expression data for ANY gene in the world.

Sources:
- GTEx Portal API v2 (primary)
- Human Protein Atlas (HPA) (fallback)
- UniProt (fallback)
"""

import logging
from typing import Dict, Any, Optional, List
import asyncio

import aiohttp

logger = logging.getLogger(__name__)

# Vital organ tissues for safety assessment
VITAL_ORGAN_KEYWORDS = ["Heart", "Kidney", "Lung", "Brain", "Liver"]


def _calculate_expression_cv(tpm_values: List[float]) -> Optional[float]:
    """Calculate coefficient of variation across tissue expression values."""
    if len(tpm_values) < 2:
        return None
    mean_tpm = sum(tpm_values) / len(tpm_values)
    if mean_tpm == 0:
        return None
    variance = sum((x - mean_tpm) ** 2 for x in tpm_values) / len(tpm_values)
    std_dev = variance ** 0.5
    return round(std_dev / mean_tpm, 3)


def _calculate_circadian_amplitude(tpm_values: List[float]) -> Optional[str]:
    """Approximate circadian-like expression amplitude from GTEx tissue variation.
    
    Uses peak-to-trough ratio (max/min TPM) across tissues as a proxy for
    expression amplitude. Genes with high circadian variation often show
    high expression variation across tissues/conditions.
    
    Returns: "High", "Moderate", "Low", or None
    """
    if not tpm_values or len(tpm_values) < 2:
        return None
    
    positive_tpms = [t for t in tpm_values if t and t > 0]
    if len(positive_tpms) < 2:
        return None
    
    max_tpm = max(positive_tpms)
    min_tpm = min(positive_tpms)
    
    if min_tpm == 0:
        return "High" if max_tpm > 10 else "Moderate"
    
    ratio = max_tpm / min_tpm
    
    if ratio >= 10:
        return "High"
    elif ratio >= 3:
        return "Moderate"
    else:
        return "Low"


def _get_tissue_level(tpm: float) -> str:
    """Classify expression level based on TPM value."""
    if tpm > 25:
        return "High"
    elif tpm > 5:
        return "Medium"
    else:
        return "Low"


async def _fetch_gtex_expression(
    session: aiohttp.ClientSession,
    symbol: str,
    ensembl_gene_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch tissue expression from GTEx API."""
    result = {
        "source": "GTEx",
        "available": False,
        "top_tissue": None,
        "tpm": None,
        "top_tissues": [],
        "expression_cv": None,
        "vital_organ_tpm": None,
        "vital_organ_tissues": [],
        "dominant_isoform_fraction": None,
        "dominant_isoform_id": None,
    }

    try:
        # Search by gene symbol first
        async with session.get(
            "https://gtexportal.org/api/v2/reference/geneSearch",
            params={
                "geneId": symbol,
                "gencodeVersion": "v26",
                "genomeBuild": "GRCh38/hg38",
            },
            timeout=aiohttp.ClientTimeout(total=8),
        ) as response:
            if response.status == 200:
                search_data = await response.json()
            else:
                search_data = {}

        matches = search_data.get("data", [])
        gene_record = next(
            (record for record in matches if record.get("geneSymbol", "").upper() == symbol.upper()),
            None,
        )

        # If no exact match by symbol, retry with Ensembl ID (handles aliases like OCT4 -> POU5F1)
        if not gene_record and ensembl_gene_id:
            ensembl_base = ensembl_gene_id.split(".")[0]
            async with session.get(
                "https://gtexportal.org/api/v2/reference/geneSearch",
                params={
                    "geneId": ensembl_base,
                    "gencodeVersion": "v26",
                    "genomeBuild": "GRCh38/hg38",
                },
                timeout=aiohttp.ClientTimeout(total=8),
            ) as response:
                if response.status == 200:
                    ensembl_search = await response.json()
                    ensembl_matches = ensembl_search.get("data", [])
                    if ensembl_matches:
                        gene_record = ensembl_matches[0]

        # Last resort: use first result from symbol search (fuzzy match)
        if not gene_record and matches:
            gene_record = matches[0]

        gencode_id = gene_record.get("gencodeId") if gene_record else None
        if not gencode_id:
            return result

        # Fetch median gene expression
        async with session.get(
            "https://gtexportal.org/api/v2/expression/medianGeneExpression",
            params={"gencodeId": gencode_id, "datasetId": "gtex_v8"},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as response:
            if response.status != 200:
                return result
            data = await response.json()

        records = data.get("data", [])
        if not records:
            return result

        # Sort by expression level
        sorted_records = sorted(records, key=lambda x: x.get("median", 0.0), reverse=True)
        top_record = sorted_records[0]
        tissue = top_record.get("tissueSiteDetailId", "Tissue").replace("_", " ")
        tpm = round(top_record.get("median", 0.0), 1)

        result["available"] = True
        result["top_tissue"] = tissue.title()
        result["tpm"] = tpm
        result["top_tissues"] = [
            {
                "name": record.get("tissueSiteDetailId", "Tissue").replace("_", " ").title(),
                "tpm": round(record.get("median", 0.0), 1),
            }
            for record in sorted_records[:15]
        ]

        # Calculate expression stability (CV)
        tpm_vals = [t["tpm"] for t in result["top_tissues"]]
        result["expression_cv"] = _calculate_expression_cv(tpm_vals)

        # Vital organ expression
        vital_matches = [
            t for t in result["top_tissues"]
            if any(kw in t["name"] for kw in VITAL_ORGAN_KEYWORDS)
        ]
        result["vital_organ_tpm"] = max((t["tpm"] for t in vital_matches), default=None)
        result["vital_organ_tissues"] = [t["name"] for t in vital_matches]

        # Dominant isoform fraction
        try:
            async with session.get(
                "https://gtexportal.org/api/v2/expression/medianTranscriptExpression",
                params={"gencodeId": gencode_id, "datasetId": "gtex_v8"},
                timeout=aiohttp.ClientTimeout(total=8),
            ) as tresp:
                if tresp.status == 200:
                    tdata = await tresp.json()
                    trecords = tdata.get("data", [])
                    if trecords:
                        transcript_totals = {}
                        for r in trecords:
                            tid = r.get("transcriptId", "")
                            median = r.get("median", 0) or 0
                            transcript_totals[tid] = transcript_totals.get(tid, 0) + median
                        if transcript_totals:
                            sorted_t = sorted(transcript_totals.items(), key=lambda x: x[1], reverse=True)
                            top_tid, top_total = sorted_t[0]
                            grand_total = sum(transcript_totals.values())
                            result["dominant_isoform_fraction"] = round(top_total / grand_total, 3) if grand_total > 0 else None
                            result["dominant_isoform_id"] = top_tid
        except Exception:
            pass

    except Exception as e:
        logger.info(f"GTEx lookup failed for {symbol}: {e}")

    return result


async def _fetch_hpa_tissue_expression(
    session: aiohttp.ClientSession,
    ensembl_id: Optional[str] = None,
    gene_symbol: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch tissue expression from Human Protein Atlas."""
    result = {
        "source": "Human Protein Atlas",
        "available": False,
        "top_tissue": None,
        "tpm": None,
        "top_tissues": [],
        "expression_cv": None,
        "vital_organ_tpm": None,
        "vital_organ_tissues": [],
    }

    if not ensembl_id:
        return result

    try:
        async with session.get(
            f"https://www.proteinatlas.org/{ensembl_id}.json",
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status != 200:
                return result

            data = await resp.json()

        # HPA v2 API: "RNA tissue specific nTPM" is a dict of enriched tissues only
        rna_nTPM = data.get("RNA tissue specific nTPM") or {}
        # Legacy key fallback
        if not rna_nTPM:
            rna_nTPM = data.get("RNA tissue expression, nTPM") or {}

        if isinstance(rna_nTPM, dict) and rna_nTPM:
            tissues = []
            for tissue_name, ntpm_val in rna_nTPM.items():
                try:
                    ntpm = float(ntpm_val) if ntpm_val else 0
                    tissues.append({
                        "name": tissue_name.title(),
                        "tpm": round(ntpm, 1),
                    })
                except (ValueError, TypeError):
                    continue

            if tissues:
                tissues.sort(key=lambda x: x["tpm"], reverse=True)
                result["available"] = True
                result["top_tissue"] = tissues[0]["name"]
                result["tpm"] = tissues[0]["tpm"]
                result["top_tissues"] = tissues[:15]

                tpm_vals = [t["tpm"] for t in result["top_tissues"]]
                result["expression_cv"] = _calculate_expression_cv(tpm_vals)

                vital_matches = [
                    t for t in result["top_tissues"]
                    if any(kw in t["name"] for kw in VITAL_ORGAN_KEYWORDS)
                ]
                result["vital_organ_tpm"] = max((t["tpm"] for t in vital_matches), default=None)
                result["vital_organ_tissues"] = [t["name"] for t in vital_matches]

        # Fallback: use RNA tissue specificity string + tissue cell type enrichment
        if not result["available"]:
            specificity = data.get("RNA tissue specificity") or ""
            cell_type_enrichment = data.get("RNA tissue cell type enrichment") or []
            tissue_cluster = data.get("Tissue expression cluster") or ""

            if specificity and specificity not in ("Not detected", "Low tissue specificity"):
                # Map specificity to approximate TPM
                category_map = {
                    "Tissue enhanced": 50,
                    "Group enriched": 30,
                    "Tissue enriched": 50,
                    "Tissue enhanced (single)": 50,
                }
                approx_tpm = category_map.get(specificity)
                if approx_tpm:
                    # Use cell type enrichment as tissue proxy
                    tissues_found = []
                    for item in (cell_type_enrichment if isinstance(cell_type_enrichment, list) else []):
                        tissue_name = item.split(" - ")[0].strip() if " - " in str(item) else str(item)
                        if tissue_name and tissue_name not in [t["name"] for t in tissues_found]:
                            tissues_found.append({"name": tissue_name.title(), "tpm": approx_tpm})

                    if not tissues_found and tissue_cluster:
                        cluster_name = tissue_cluster.split(":")[-1].strip().split(" - ")[0].strip()
                        if cluster_name:
                            tissues_found.append({"name": cluster_name.title(), "tpm": approx_tpm})

                    if tissues_found:
                        result["available"] = True
                        result["top_tissue"] = tissues_found[0]["name"]
                        result["tpm"] = tissues_found[0]["tpm"]
                        result["top_tissues"] = tissues_found[:15]

    except Exception as e:
        logger.info(f"HPA tissue lookup failed for {ensembl_id}: {e}")

    return result


async def _fetch_uniprot_expression(
    session: aiohttp.ClientSession,
    gene_symbol: str,
) -> Dict[str, Any]:
    """Fetch basic tissue expression from UniProt."""
    result = {
        "source": "UniProt",
        "available": False,
        "top_tissue": None,
        "tpm": None,
        "top_tissues": [],
    }

    try:
        async with session.get(
            "https://rest.uniprot.org/uniprotkb/search",
            params={
                "query": f"gene:{gene_symbol} AND organism_id:9606",
                "format": "json",
                "size": 1,
            },
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status != 200:
                return result

            data = await resp.json()
            results = data.get("results", [])
            if not results:
                return result

            entry = results[0]

            # Check for tissue expression in comments
            comments = entry.get("comments", [])
            for comment in comments:
                if comment.get("commentType") == "TISSUE SPECIFICITY":
                    tissue_text = comment.get("texts", [{}])[0].get("value", "")
                    if tissue_text:
                        # Parse tissue names from UniProt text like "Expressed in brain, heart, ..."
                        tissues = []
                        for part in tissue_text.split(","):
                            part = part.strip().rstrip(".")
                            if part and len(part) < 60:
                                tissues.append({"name": part.title(), "tpm": None})
                        result["available"] = True
                        result["top_tissue"] = tissues[0]["name"] if tissues else tissue_text[:80]
                        result["top_tissues"] = tissues[:10] if tissues else [{"name": tissue_text[:80], "tpm": None}]
                        break

    except Exception as e:
        logger.info(f"UniProt expression lookup failed for {gene_symbol}: {e}")

    return result


async def get_tissue_expression(
    symbol: str,
    ensembl_id: Optional[str] = None,
    species: str = "homo_sapiens",
) -> Dict[str, Any]:
    """Get tissue expression data for ANY gene using multiple sources.

    Tries sources in order:
    1. GTEx (best data, TPM values)
    2. Human Protein Atlas (fallback)
    3. UniProt (last resort)

    Returns:
        dict with tissue expression data
    """
    result = {
        "available": False,
        "top_tissue": None,
        "tpm": None,
        "tissueExpressionLevel": None,
        "topTissues": [],
        "expressionStabilityCV": None,
        "circadianAmplitude": None,
        "vitalOrganTissues": [],
        "dominantIsoformFraction": None,
        "dominantIsoformId": None,
        "source": None,
    }

    if species != "homo_sapiens":
        return result

    # Try GTEx first (best data)
    async with aiohttp.ClientSession() as session:
        gtex_data = await _fetch_gtex_expression(session, symbol, ensembl_id)

        if gtex_data["available"]:
            result["available"] = True
            result["top_tissue"] = gtex_data["top_tissue"]
            result["tpm"] = gtex_data["tpm"]
            result["tissueExpressionLevel"] = _get_tissue_level(gtex_data["tpm"]) if gtex_data["tpm"] else None
            result["topTissues"] = gtex_data["top_tissues"]
            result["expressionStabilityCV"] = gtex_data["expression_cv"]
            tpm_vals = [t["tpm"] for t in gtex_data["top_tissues"] if t.get("tpm") is not None]
            result["circadianAmplitude"] = _calculate_circadian_amplitude(tpm_vals)
            result["vitalOrganTissues"] = gtex_data["vital_organ_tissues"]
            result["dominantIsoformFraction"] = gtex_data["dominant_isoform_fraction"]
            result["dominantIsoformId"] = gtex_data["dominant_isoform_id"]
            result["source"] = "GTEx"
            return result

        # Fallback to Human Protein Atlas
        hpa_data = await _fetch_hpa_tissue_expression(session, ensembl_id, symbol)
        if hpa_data["available"]:
            result["available"] = True
            result["top_tissue"] = hpa_data["top_tissue"]
            result["tpm"] = hpa_data["tpm"]
            result["tissueExpressionLevel"] = _get_tissue_level(hpa_data["tpm"]) if hpa_data["tpm"] else None
            result["topTissues"] = hpa_data["top_tissues"]
            result["expressionStabilityCV"] = hpa_data["expression_cv"]
            tpm_vals = [t["tpm"] for t in hpa_data["top_tissues"] if t.get("tpm") is not None]
            result["circadianAmplitude"] = _calculate_circadian_amplitude(tpm_vals)
            result["vitalOrganTissues"] = hpa_data["vital_organ_tissues"]
            result["source"] = "Human Protein Atlas"
            return result

        # Fallback to UniProt
        uniprot_data = await _fetch_uniprot_expression(session, symbol)
        if uniprot_data["available"]:
            result["available"] = True
            result["top_tissue"] = uniprot_data["top_tissue"]
            result["topTissues"] = uniprot_data["top_tissues"]
            result["source"] = "UniProt"
            return result

    return result
