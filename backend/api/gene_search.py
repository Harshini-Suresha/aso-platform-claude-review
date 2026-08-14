from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import aiohttp
import asyncio
import time
import requests
import logging

try:
    from ..services.gene_service import get_gene_metadata
except ImportError:
    from services.gene_service import get_gene_metadata

logger = logging.getLogger(__name__)
router = APIRouter()

REST_API_BASE = "https://rest.ensembl.org"
HGNC_API_BASE = "https://rest.genenames.org"
NCBI_EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

SPECIES_TAXON_IDS = {
    "homo_sapiens": 9606,
    "mus_musculus": 10090,
    "rattus_norvegicus": 10116,
    "macaca_fascicularis": 9541,
    "macaca_mulatta": 9544,
    "danio_rerio": 7955,
    "drosophila_melanogaster": 7227,
    "caenorhabditis_elegans": 6239,
    "saccharomyces_cerevisiae": 4932,
    "schizosaccharomyces_pombe": 4896,
    "canis_lupus_familiaris": 9615,
    "felis_catus": 9685,
    "sus_scrofa": 9823,
    "bos_taurus": 9913,
    "equus_caballus": 9796,
    "ovis_aries": 9940,
    "capra_hircus": 9925,
    "gallus_gallus": 9031,
    "arabidopsis_thaliana": 3702,
    "oryza_sativa": 39947,
    "zea_mays": 4577,
    "triticum_aestivum": 4565,
    "solanum_lycopersicum": 4081,
    "escherichia_coli": 511145,
    "staphylococcus_aureus": 1280,
    "mycobacterium_tuberculosis": 83333,
    "pseudomonas_aeruginosa": 208964,
}

_ncbi_lock = asyncio.Lock()
_last_ncbi_req = 0.0

POPULAR_HUMAN_GENES = [
    "TP53", "BRCA1", "BRCA2", "EGFR", "MYC", "PTEN", "RB1", "APC", "VHL", "NF1",
    "NF2", "WT1", "CDKN2A", "CDK4", "MDM2", "PIK3CA", "AKT1", "KRAS", "NRAS", "HRAS",
    "BRAF", "ERBB2", "MET", "ALK", "ROS1", "RET", "NTRK1", "NTRK2", "NTRK3", "KIT",
    "PDGFRA", "PDGFRB", "FGFR1", "FGFR2", "FGFR3", "FLT3", "IDH1", "IDH2", "DNMT3A",
    "TET2", "ASXL1", "JAK2", "CALR", "MPL", "CBL", "SETBP1", "PTPN11", "SOS1", "RAF1",
    "MAP2K1", "MAP2K2", "CDKN1B", "CCND1", "CDK6", "CDK2", "CDK1", "CCNE1", "CCNA2",
    "MCL1", "BCL2", "BCL6", "MYCN", "LMNA", "DMD", "TTN", "LAMA2", "LAMB2", "COL1A1",
    "COL1A2", "FBN1", "TGFBR1", "TGFBR2", "SMAD4", "ACVR1", "BMPR1A", "BMPR2",
    "CFTR", "SCNN1A", "SCNN1B", "SCNN1G", "GABRA1", "GABRB2", "GABRG2", "GRIN1",
    "GRIN2A", "GRIN2B", "GRIK2", "GRIA2", "SLC2A1", "SLC2A4", "SLC16A1", "ABCA1",
    "ABCB1", "ABCC8", "ABCD1", "KCNQ1", "KCNH2", "KCNJ2", "SCN5A", "CACNA1C",
    "P2RX7", "P2RY12", "TRPV1", "TRPA1", "TRPM8", "ASIC1", "KCNA1", "KCNB1",
    "HCN1", "HCN4", "GJA1", "GJB2", "FOXP1", "FOXP2", "FOXP3", "FOXA1", "FOXA2",
    "FOXA3", "FOXO1", "FOXO3", "SOX2", "SOX9", "SOX10", "SOX17", "POU5F1", "NANOG",
    "KLF4", "MYOD1", "MYOG", "MYF5", "MYF6", "MEF2A", "MEF2C", "MEF2D", "MEF2B",
    "TWIST1", "TWIST2", "SNAI1", "SNAI2", "SNAI3", "ZEB1", "ZEB2", "CDH1", "CDH2",
    "CTNNA1", "CTNNA2", "CTNNA3", "CTNNB1", "CTNND1", "CTNND2", "JUP", "PKP1",
    "PKP2", "PKP3", "DSG1", "DSG2", "DSG3", "DSC1", "DSC2", "DSC3", "JAG1",
    "JAG2", "NOTCH1", "NOTCH2", "NOTCH3", "NOTCH4", "DLL1", "DLL3", "DLL4",
    "HES1", "HES2", "HES3", "HES4", "HES5", "HES6", "HES7", "HEY1", "HEY2",
    "HEYL", "MESP1", "MESP2", "LFNG", "MFNG", "RFNG", "RBPJ", "NCOR1", "NCOR2",
    "SIRT1", "HDAC1", "HDAC2", "HDAC3", "HDAC4", "HDAC5", "HDAC6", "HDAC7",
    "HDAC8", "HDAC9", "HDAC10", "HDAC11", "KDM1A", "KDM1B", "KDM2A", "KDM2B",
    "KDM3A", "KDM3B", "KDM4A", "KDM4B", "KDM4C", "KDM4D", "KDM5A", "KDM5B",
    "KDM5C", "KDM5D", "KDM6A", "KDM6B", "KDM7A", "KDM7B", "KDM8", "UTY",
    "JMJD6", "JMJD8", "JMJD4", "JMJD5", "JMJD7", "JMJD9", "JMJD1C", "JMJD2C",
    "JMJD2D", "JMJD2F", "JMJD3", "JHDM1D", "PHF1", "PHF2", "PHF3", "PHF5A",
    "PHF6", "PHF7", "PHF8", "PHF10", "PHF11", "PHF12", "PHF13", "PHF14", "PHF15",
    "PHF16", "PHF17", "PHF18", "PHF19", "PHF20", "PHF21A", "PHF23", "PHF24",
    "PHF25", "PHF26", "PHF27", "PHF28", "PHF29", "PHF30", "PHF31", "PHF32",
]


def _levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        return _levenshtein(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            curr.append(
                min(
                    prev[j] + 1,
                    curr[j - 1] + 1,
                    prev[j - 1] + (0 if ca == cb else 1),
                )
            )
        prev = curr
    return prev[-1]


async def _ncbi_rate_limited_get(session: aiohttp.ClientSession, url: str, params: dict = None) -> Optional[dict]:
    global _last_ncbi_req
    async with _ncbi_lock:
        now = time.monotonic()
        since_last = now - _last_ncbi_req
        if since_last < 0.4:
            await asyncio.sleep(0.4 - since_last)
        _last_ncbi_req = time.monotonic()
        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=6)) as response:
                return await response.json() if response.status == 200 else {}
        except Exception:
            return {}


async def _hgnc_search(query: str, limit: int = 10) -> list[dict]:
    results = []
    try:
        async with aiohttp.ClientSession() as session:
            data = await _ncbi_rate_limited_get(
                session,
                f"{HGNC_API_BASE}/search/symbol/{query}",
                {"limit": limit * 2},
            )
            if not data:
                return results
            docs = (data.get("response") or {}).get("docs") or []
            for doc in docs[: limit * 2]:
                symbol = doc.get("symbol")
                name = doc.get("name")
                if symbol:
                    results.append({
                        "symbol": symbol,
                        "name": name or symbol,
                        "source": "HGNC",
                        "id": doc.get("hgnc_id"),
                    })
    except Exception as exc:
        logger.warning(f"HGNC search failed for {query}: {exc}")
    return results


async def _ncbi_search(query: str, species: str, limit: int = 10) -> list[dict]:
    results = []
    taxon_id = SPECIES_TAXON_IDS.get(species, 0)
    if not taxon_id:
        return results
    try:
        async with aiohttp.ClientSession() as session:
            term = f"{query}*[Gene Name] AND {taxon_id}[Taxonomy ID]"
            esearch_data = await _ncbi_rate_limited_get(
                session,
                f"{NCBI_EUTILS_BASE}/esearch.fcgi",
                {
                    "db": "gene",
                    "term": term,
                    "retmode": "json",
                    "retmax": limit * 2,
                },
            )
            if not esearch_data:
                return results
            id_list = (esearch_data.get("esearchresult") or {}).get("idlist") or []
            if not id_list:
                return results

            ids_str = ",".join(id_list[: limit * 2])
            esummary_data = await _ncbi_rate_limited_get(
                session,
                f"{NCBI_EUTILS_BASE}/esummary.fcgi",
                {"db": "gene", "id": ids_str, "retmode": "json"},
            )
            if not esummary_data:
                return results
            result_docs = (esummary_data.get("result") or {})
            for gene_id in id_list[: limit * 2]:
                doc = result_docs.get(gene_id) or {}
                official_symbol = doc.get("name")
                gene_name = doc.get("description", official_symbol)
                if official_symbol:
                    results.append({
                        "symbol": official_symbol,
                        "name": gene_name or official_symbol,
                        "source": "NCBI",
                        "id": f"NCBI:{gene_id}",
                    })
    except Exception as exc:
        logger.warning(f"NCBI search failed for {query} in {species}: {exc}")
    return results


async def _ensembl_exact_lookup(symbol: str, species: str) -> Optional[dict]:
    try:
        meta = get_gene_metadata(symbol, species)
        if meta and meta.get("id"):
            return {
                "symbol": meta.get("officialSymbol", symbol),
                "name": meta.get("geneName", symbol),
                "source": "Ensembl",
                "id": meta.get("id"),
            }
    except Exception:
        pass
    return None


async def _ensembl_search(query: str, species: str, limit: int = 10) -> list[dict]:
    results = []
    try:
        url = f"{REST_API_BASE}/lookup/symbol/{species}/{query}?expand=0&synonyms=1"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers={"Accept": "application/json"}, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    gene_id = data.get("id")
                    if gene_id:
                        return [{
                            "symbol": data.get("display_name", query),
                            "name": (data.get("description") or query).split(" [Source:", 1)[0].strip(),
                            "source": "Ensembl",
                            "id": gene_id,
                        }]
    except Exception:
        pass
    return results


def _typo_suggestions(query: str, limit: int = 8) -> list[dict]:
    q = query.strip().upper()
    if len(q) < 2:
        return []

    scored = []
    for sym in POPULAR_HUMAN_GENES:
        dist = _levenshtein(q, sym)
        if dist <= max(2, len(q) // 3):
            scored.append((dist, sym))

    scored.sort(key=lambda x: (x[0], x[1]))
    seen = set()
    results = []
    for dist, sym in scored[: limit * 2]:
        if sym not in seen:
            seen.add(sym)
            results.append({
                "symbol": sym,
                "name": sym,
                "source": "Similar symbol",
                "id": None,
            })
    return results[:limit]


class ValidateRequest(BaseModel):
    symbol: str
    species: str = "homo_sapiens"


@router.get("/api/gene-search/suggest")
async def suggest_genes(
    q: str = Query(..., min_length=1),
    species: str = Query("homo_sapiens"),
    limit: int = Query(8, ge=1, le=20),
):
    query = q.strip()
    if not query:
        return {"suggestions": []}

    suggestions = []
    seen = set()

    def add_unique(items: list[dict]):
        for item in items:
            key = item["symbol"].upper()
            if key not in seen:
                seen.add(key)
                suggestions.append(item)

    if species == "homo_sapiens":
        hgnc_results = await _hgnc_search(query, limit)
        add_unique(hgnc_results)

    ncbi_results = await _ncbi_search(query, species, limit)
    add_unique(ncbi_results)

    ensembl_exact = await _ensembl_exact_lookup(query, species)
    if ensembl_exact:
        add_unique([ensembl_exact])

    if len(suggestions) < limit:
        typo_results = _typo_suggestions(query, limit - len(suggestions))
        add_unique(typo_results)

    return {"suggestions": suggestions[:limit]}


@router.post("/api/gene-search/validate")
async def validate_gene(payload: ValidateRequest):
    symbol = payload.symbol.strip()
    species = payload.species or "homo_sapiens"

    if not symbol:
        return {"valid": False, "suggestions": []}

    meta = get_gene_metadata(symbol, species)
    if meta and meta.get("id"):
        return {
            "valid": True,
            "officialSymbol": meta.get("officialSymbol", symbol),
            "geneId": meta.get("id"),
            "synonyms": meta.get("synonyms", [])[:10],
        }

    suggestions = []
    seen = set()

    def add_unique(items: list[dict]):
        for item in items:
            key = item["symbol"].upper()
            if key not in seen and key != symbol.upper():
                seen.add(key)
                suggestions.append(item)

    if species == "homo_sapiens":
        add_unique(await _hgnc_search(symbol, 8))

    add_unique(await _ncbi_search(symbol, species, 8))
    add_unique(await _ensembl_search(symbol, species, 8))

    if len(suggestions) < 8:
        add_unique(_typo_suggestions(symbol, 8 - len(suggestions)))

    return {
        "valid": False,
        "suggestions": suggestions[:8],
    }
