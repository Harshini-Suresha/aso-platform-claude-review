"""Orphanet disease data: Orphanet code, ICD-11 code, and incidence.

Uses the Open Targets Platform GraphQL API and Orphadata API to extract
Orphanet codes, ICD-11 codes, disease classification, and incidence data.

Sources:
- Open Targets Platform (https://api.platform.opentargets.org)
- Orphadata API (https://api.orphadata.com)
- NCBI Gene (https://www.ncbi.nlm.nih.gov/gene)
"""

import logging
import re
from typing import Optional, List

import requests

logger = logging.getLogger(__name__)

OT_GRAPHQL = "https://api.platform.opentargets.org/api/v4/graphql"
NCBI_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def _get_disease_xrefs(ensembl_id: str) -> list:
    """Fetch cross-references for the top disease associated with a gene via Open Targets."""
    query = """
    query targetDiseaseXrefs($ensemblId: String!) {
      target(ensemblId: $ensemblId) {
        associatedDiseases(page: {index: 0, size: 5}) {
          rows {
            disease {
              name
              dbXRefs
            }
          }
        }
      }
    }
    """
    try:
        resp = requests.post(
            OT_GRAPHQL,
            json={"query": query, "variables": {"ensemblId": ensembl_id}},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            rows = (data.get("data") or {}).get("target", {}).get("associatedDiseases", {}).get("rows", [])
            return rows
    except Exception as e:
        logger.info(f"Open Targets xref fetch failed for {ensembl_id}: {e}")
    return []


def _extract_orphanet_code(xrefs: list) -> Optional[str]:
    """Extract Orphanet code from Open Targets disease cross-references."""
    for row in xrefs:
        disease = row.get("disease") or {}
        for xref in disease.get("dbXRefs", []) or []:
            if isinstance(xref, str) and xref.lower().startswith("orphanet:"):
                code = xref.split(":", 1)[1].strip()
                if code:
                    return f"ORPHA:{code}"
    return None


def _extract_icd11_code(xrefs: list) -> Optional[str]:
    """Extract ICD-11 code from Open Targets disease cross-references."""
    for row in xrefs:
        disease = row.get("disease") or {}
        for xref in disease.get("dbXRefs", []) or []:
            if isinstance(xref, str) and xref.lower().startswith("icd11"):
                # Format: "icd11.foundation:1479561744" or "icd11:8A95"
                code = xref.split(":", 1)[1].strip()
                if code:
                    return code
    return None


def _extract_disease_names(xrefs: list) -> List[str]:
    """Extract disease names from Open Targets cross-references."""
    names = []
    for row in xrefs:
        disease = row.get("disease") or {}
        name = disease.get("name")
        if name and isinstance(name, str) and len(name) > 2:
            names.append(name)
    return names[:5]


def _get_orphanet_incidence(orpha_code: str) -> Optional[str]:
    """Fetch incidence/prevalence data from the Orphadata API."""
    try:
        resp = requests.get(
            f"https://api.orphadata.com/rd-epidemiology/orphacodes/{orpha_code}",
            params={"lang": "en"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            results = (data.get("data") or {}).get("results") or {}
            prevalence_list = results.get("Prevalence") or []
            if not prevalence_list:
                return None

            # Prefer "Prevalence at birth" with worldwide scope, then point prevalence
            worldwide_birth = None
            any_birth = None
            worldwide_point = None
            first_valid = None
            for entry in prevalence_list:
                ptype = (entry.get("PrevalenceType") or "").lower()
                geo = (entry.get("PrevalenceGeographic") or "").lower()
                pclass = entry.get("PrevalenceClass") or ""
                val = entry.get("ValMoy")
                validated = (entry.get("PrevalenceValidationStatus") or "").lower()

                if validated == "validated" or not first_valid:
                    candidate = f"{pclass} (birth)" if "birth" in ptype else pclass
                    if val:
                        candidate = f"{val} per 100,000 ({ptype}, {entry.get('PrevalenceGeographic', '')})"
                    if "birth" in ptype and "worldwide" in geo and not worldwide_birth:
                        worldwide_birth = candidate
                    if "birth" in ptype and not any_birth:
                        any_birth = candidate
                    if "point" in ptype and "worldwide" in geo and not worldwide_point:
                        worldwide_point = candidate
                    if not first_valid:
                        first_valid = candidate

            result = worldwide_birth or any_birth or worldwide_point or first_valid
            if result:
                return result[:200]
    except Exception as e:
        logger.info(f"Orphadata API fetch failed for ORPHA:{orpha_code}: {e}")
    return None


def _get_orphanet_by_gene_name(gene_symbol: str) -> Optional[str]:
    """Search Orphadata API by gene symbol to find associated Orphanet diseases.

    The Orphadata API requires lowercase gene symbols.
    """
    try:
        resp = requests.get(
            f"https://api.orphadata.com/rd-associated-genes/genes/symbols/{gene_symbol.lower()}",
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            results = (data.get("data") or {}).get("results") or []
            if isinstance(results, list):
                for item in results:
                    code = item.get("ORPHAcode")
                    if code:
                        return f"ORPHA:{code}"
    except Exception as e:
        logger.info(f"Orphadata gene search failed for {gene_symbol}: {e}")
    return None


def _get_omim_orphanet_via_ncbi(gene_symbol: str) -> dict:
    """Fetch disease names and OMIM IDs from NCBI Gene database.

    Used as a fallback when Open Targets doesn't have disease associations.
    """
    result = {"orphanetCode": None, "icd11Code": None, "diseaseNames": []}
    try:
        # Search NCBI Gene for the gene
        resp = requests.get(
            f"{NCBI_EUTILS}/esearch.fcgi",
            params={
                "db": "gene",
                "term": f"{gene_symbol}[Symbol] AND human[Organism]",
                "retmax": 3,
                "retmode": "json",
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return result

        gene_ids = resp.json().get("esearchresult", {}).get("idlist", [])
        if not gene_ids:
            return result

        # Fetch gene summary
        resp = requests.get(
            f"{NCBI_EUTILS}/esummary.fcgi",
            params={"db": "gene", "id": gene_ids[0], "retmode": "json"},
            timeout=10,
        )
        if resp.status_code != 200:
            return result

        data = resp.json().get("result", {}).get(gene_ids[0], {})
        if not data:
            return result

        # Extract OMIM IDs
        mim = data.get("mim")
        if mim:
            if isinstance(mim, list) and mim:
                result["omimId"] = str(mim[0])
            elif isinstance(mim, str) and mim.isdigit():
                result["omimId"] = mim

        # Extract disease names from description/summary
        desc = data.get("description") or data.get("summary") or ""
        if desc:
            disease_kw = ["disease", "disorder", "syndrome", "deficiency", "dystrophy",
                         "myopathy", "cancer", "tumor", "carcinoma", "leukemia",
                         "cardiomyopathy", "neuropathy", "ataxia", "blindness",
                         "deafness", "epilepsy", "anemia", "thalassemia"]
            sentences = re.split(r'(?<=[.!?])\s+', desc)
            for sent in sentences:
                if any(kw in sent.lower() for kw in disease_kw):
                    cleaned = sent.strip(".,;: ")
                    if len(cleaned) > 10:
                        result["diseaseNames"].append(cleaned[:200])
                        break

    except Exception as e:
        logger.info(f"NCBI Gene fetch failed for {gene_symbol}: {e}")

    return result


def get_orphanet_data(
    gene_symbol: str,
    ensembl_id: str = None,
    disease_name: str = None,
    phenotypes: list = None,
) -> dict:
    """Fetch Orphanet classification, ICD-11 code, and incidence data.

    Uses multiple sources to find Orphanet and ICD-11 codes:
    1. Open Targets cross-references (already queried in the main pipeline)
    2. NCBI Gene database cross-references
    3. Orphanet API direct gene search
    4. Best-effort incidence from Orphanet public pages

    Returns:
        dict with keys:
            - orphanetCode: str | None (e.g. "ORPHA:98896")
            - icd11Code: str | None (e.g. "1479561744")
            - incidence: str | None (prevalence/incidence description)
            - diseaseNames: list of associated disease names
    """
    result = {
        "orphanetCode": None,
        "icd11Code": None,
        "incidence": None,
        "diseaseNames": [],
    }

    # Strategy 1: Open Targets cross-references
    if ensembl_id:
        xrefs = _get_disease_xrefs(ensembl_id)
        if xrefs:
            result["orphanetCode"] = _extract_orphanet_code(xrefs)
            result["icd11Code"] = _extract_icd11_code(xrefs)
            result["diseaseNames"] = _extract_disease_names(xrefs)

    # Strategy 2: NCBI Gene cross-references (fallback)
    if not result["orphanetCode"] and not result["icd11Code"]:
        ncbi_data = _get_omim_orphanet_via_ncbi(gene_symbol)
        if ncbi_data.get("diseaseNames"):
            result["diseaseNames"] = ncbi_data["diseaseNames"]

    # Strategy 3: Orphanet API direct search (fallback)
    if not result["orphanetCode"]:
        orpha_code = _get_orphanet_by_gene_name(gene_symbol)
        if orpha_code:
            result["orphanetCode"] = orpha_code

    # Best-effort incidence from Orphanet
    if result["orphanetCode"]:
        orpha_num = result["orphanetCode"].replace("ORPHA:", "")
        result["incidence"] = _get_orphanet_incidence(orpha_num)

    # Deduplicate disease names
    result["diseaseNames"] = list(dict.fromkeys(result["diseaseNames"]))[:5]

    return result
