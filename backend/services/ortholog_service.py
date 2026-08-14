"""
Map human genes onto orthologs in a target organism for the disease -> gene
reverse lookup.

Open Targets diseases are human, so the disease association is always run in
human first and this module then maps the associated genes onto the selected
organism. Three sources are used, in order:

1. Ensembl Compara homology (same endpoint pattern as enrichment_service's
   preclinical conservation) — authoritative for every Ensembl species.
2. Alliance of Genome Resources orthology API — the consortium run by MGI,
   RGD, ZFIN, FlyBase, WormBase and SGD. Returns the model-organism database
   records (MGI:..., RGD:..., ZFIN:...) for each ortholog.
3. NCBI Ortholog via the NCBI Datasets API (the successor to the retired
   HomoloGene database). The reliable catch-all: it covers every species and
   is what actually carries the mapping when Ensembl is down, which is often.

Every path is fail-open: a gene simply gets no ortholog if all sources fail,
and the whole mapping degrades gracefully instead of blocking the disease
results.
"""

from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor

import requests

ENSEMBL_REST = "https://rest.ensembl.org"
HGNC_REST = "https://rest.genenames.org"
ALLIANCE_REST = "https://www.alliancegenome.org/api"
MYGENE_REST = "https://mygene.info/v3"
NCBI_DATASETS_REST = "https://api.ncbi.nlm.nih.gov/datasets/v2alpha"

_TIMEOUT = 15
_ORTHOLOG_WORKERS = 6
_ORTHOLOG_LIMIT = 25

# Ensembl outage tracking so a downed site is not hammered per gene.
_ENSEMBL_DOWN_SINCE: float | None = None
_ENSEMBL_DOWN_LOCK = threading.Lock()
_ENSEMBL_DOWN_COOLDOWN_SECONDS = 120

# Cache ortholog lookups keyed by (human ensembl id, taxon id).
_CACHE: dict[tuple, dict | None] = {}
_CACHE_LOCK = threading.Lock()

# Frontend organism id -> (Ensembl species name, NCBI taxon id).
# Mirrors frontend/lib/organisms.ts + backend/main.py SPECIES_TAXON_IDS.
ORGANISM_IDS = {
    "human": ("homo_sapiens", 9606),
    "mouse": ("mus_musculus", 10090),
    "rat": ("rattus_norvegicus", 10116),
    "cynomolgus": ("macaca_fascicularis", 9541),
    "rhesus": ("macaca_mulatta", 9544),
    "zebrafish": ("danio_rerio", 7955),
    "fruitfly": ("drosophila_melanogaster", 7227),
    "celegans": ("caenorhabditis_elegans", 6239),
    "yeast": ("saccharomyces_cerevisiae", 4932),
    "fissionyeast": ("schizosaccharomyces_pombe", 4896),
    "dog": ("canis_lupus_familiaris", 9615),
    "cat": ("felis_catus", 9685),
    "pig": ("sus_scrofa", 9823),
    "cow": ("bos_taurus", 9913),
    "horse": ("equus_caballus", 9796),
    "sheep": ("ovis_aries", 9940),
    "goat": ("capra_hircus", 9925),
    "chicken": ("gallus_gallus", 9031),
}

# Ensembl species names covered by Alliance of Genome Resources orthology
# (the model organisms with MGI/RGD/ZFIN/... curation).
_ALLIANCE_SPECIES = {
    "mus_musculus",
    "rattus_norvegicus",
    "danio_rerio",
    "drosophila_melanogaster",
    "caenorhabditis_elegans",
    "saccharomyces_cerevisiae",
    "schizosaccharomyces_pombe",
}


def map_human_orthologs(genes: list[dict], organism_id: str) -> dict:
    """
    Map the top human genes to orthologs in the target organism.

    ``genes`` are dicts with at least ``symbol`` and ``ensemblId`` keys (the
    shape produced by disease_search_service). Only the top
    ``_ORTHOLOG_LIMIT`` genes are mapped so a large disease never turns into
    hundreds of upstream calls.

    Returns {human_symbol: ortholog_dict_or_None}. ``None`` means no ortholog
    could be resolved. Returns {} when the organism is unknown or human.
    """
    species, taxon_id = ORGANISM_IDS.get(organism_id or "", (None, None))
    if not species or species == "homo_sapiens":
        return {}

    candidates = [g for g in (genes or []) if g.get("symbol")][:_ORTHOLOG_LIMIT]
    if not candidates:
        return {}

    _probe_ensembl()
    jobs = [(g["symbol"], g.get("ensemblId"), species, taxon_id) for g in candidates]
    with ThreadPoolExecutor(max_workers=_ORTHOLOG_WORKERS) as pool:
        results = list(pool.map(lambda j: _map_one(*j), jobs))

    return {jobs[i][0]: results[i] for i in range(len(jobs))}


def _map_one(human_symbol: str, human_ensembl_id, target_species: str, taxon_id: int) -> dict | None:
    """Resolve one human gene -> target organism ortholog.

    Tier order: Ensembl Compara homology, then Alliance (MGI/RGD/ZFIN) for
    model organisms, then NCBI Ortholog (Datasets API) — the catch-all that
    also covers species absent from Alliance. Ensembl is down often enough
    that the last tier is the workhorse for non-model organisms.
    """
    if human_ensembl_id:
        cache_key = (human_ensembl_id, taxon_id)
        cached = _cache_get(cache_key)
        if cached is not _MISSING:
            return cached

        ortholog = _ensembl_ortholog(human_ensembl_id, target_species, taxon_id)
        if ortholog is None:
            if target_species in _ALLIANCE_SPECIES:
                ortholog = _alliance_ortholog(human_ensembl_id, human_symbol, taxon_id)
            if ortholog is None:
                ortholog = _ncbi_ortholog(human_ensembl_id, human_symbol, taxon_id)
            if ortholog is None and human_symbol:
                ortholog = _alliance_ortholog_by_symbol(human_symbol, taxon_id)
        elif not ortholog.get("symbol") or ortholog["symbol"] == ortholog["id"]:
            # Ensembl homology resolved but its symbol lookup failed — borrow a
            # readable symbol from Alliance, then NCBI.
            alt = _alliance_ortholog(human_ensembl_id, human_symbol, taxon_id)
            if alt is None or not alt.get("symbol"):
                alt = _ncbi_ortholog(human_ensembl_id, human_symbol, taxon_id)
            if alt and alt.get("symbol"):
                ortholog["symbol"] = alt["symbol"]

        _cache_set(cache_key, ortholog)
        return ortholog

    # No ensembl id to anchor on — symbol-based lookups only.
    if target_species in _ALLIANCE_SPECIES:
        ortholog = _alliance_ortholog_by_symbol(human_symbol, taxon_id)
        if ortholog:
            return ortholog
    return _ncbi_ortholog(None, human_symbol, taxon_id)

def _probe_ensembl() -> None:
    """Cheap up-front availability probe so an outage is never paid per-gene."""
    if _ensembl_down():
        return
    try:
        resp = requests.get(
            f"{ENSEMBL_REST}/info/ping",
            headers={"Content-Type": "application/json"},
            timeout=4,
        )
        if resp.status_code >= 500:
            _mark_ensembl_down()
    except requests.RequestException:
        _mark_ensembl_down()


def _ensembl_ortholog(human_ensembl_id: str, target_species: str, taxon_id: int) -> dict | None:
    """Ensembl Compara homology: human gene -> ortholog in target species."""
    if _ensembl_down():
        return None
    try:
        resp = requests.get(
            f"{ENSEMBL_REST}/homology/id/homo_sapiens/{human_ensembl_id}"
            f"?type=orthologues;target_taxon={taxon_id}",
            headers={"Content-Type": "application/json"},
            timeout=_TIMEOUT,
        )
        if resp.status_code >= 500:
            _mark_ensembl_down()
            return None
        if resp.status_code != 200:
            return None
        homologies = (resp.json().get("data") or [])
        best = None
        for group in homologies:
            for hom in group.get("homologies") or []:
                target = hom.get("target") or {}
                if target.get("species") != target_species:
                    continue
                identity = float(target.get("perc_id") or 0)
                if best is None or identity > best["identity"]:
                    best = {"id": target.get("id"), "identity": identity}
        if not best or not best["id"]:
            return None
        symbol = _ensembl_lookup_symbol(best["id"])
        return {
            "symbol": symbol or best["id"],
            "id": best["id"],
            "taxonId": taxon_id,
            "source": "ensembl",
            "identity": round(best["identity"], 1),
        }
    except requests.RequestException:
        _mark_ensembl_down()
        return None


def _ensembl_lookup_symbol(ensembl_gene_id: str) -> str | None:
    """Resolve an Ensembl gene id to its display symbol."""
    if _ensembl_down():
        return None
    try:
        resp = requests.get(
            f"{ENSEMBL_REST}/lookup/id/{ensembl_gene_id}",
            headers={"Content-Type": "application/json"},
            timeout=_TIMEOUT,
        )
        if resp.status_code >= 500:
            _mark_ensembl_down()
            return None
        if resp.status_code != 200:
            return None
        return (resp.json() or {}).get("display_name")
    except requests.RequestException:
        _mark_ensembl_down()
        return None


def _alliance_ortholog(human_ensembl_id: str, human_symbol: str, taxon_id: int) -> dict | None:
    """Alliance orthology via human ensembl id (resolved to an HGNC curie first)."""
    hgnc_id = _hgnc_id_from_ensembl(human_ensembl_id)
    if hgnc_id:
        ortholog = _alliance_ortholog_from_hgnc(hgnc_id, taxon_id)
        if ortholog:
            return ortholog
    return _alliance_ortholog_by_symbol(human_symbol, taxon_id)


def _alliance_ortholog_by_symbol(human_symbol: str, taxon_id: int) -> dict | None:
    """Alliance orthology anchored on a human symbol (no ensembl id needed)."""
    hgnc_id = _hgnc_id_from_symbol(human_symbol)
    if not hgnc_id:
        return None
    return _alliance_ortholog_from_hgnc(hgnc_id, taxon_id)


def _hgnc_id_from_ensembl(ensembl_gene_id: str) -> str | None:
    try:
        resp = requests.get(
            f"{HGNC_REST}/fetch/ensembl_gene_id/{ensembl_gene_id}",
            headers={"Accept": "application/json"},
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        docs = (resp.json().get("response") or {}).get("docs") or []
        return docs[0].get("hgnc_id") if docs else None
    except requests.RequestException:
        return None


def _hgnc_id_from_symbol(symbol: str) -> str | None:
    try:
        resp = requests.get(
            f"{HGNC_REST}/fetch/symbol/{symbol}",
            headers={"Accept": "application/json"},
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        docs = (resp.json().get("response") or {}).get("docs") or []
        return docs[0].get("hgnc_id") if docs else None
    except requests.RequestException:
        return None


def _alliance_ortholog_from_hgnc(hgnc_id: str, taxon_id: int) -> dict | None:
    try:
        resp = requests.get(
            f"{ALLIANCE_REST}/gene/{hgnc_id}/orthologs",
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        wanted_curie = f"NCBITaxon:{taxon_id}"
        best_score = None
        first_match = None
        for item in data.get("results") or []:
            obj = ((item.get("geneToGeneOrthologyGenerated") or {}).get("objectGene")) or {}
            if ((obj.get("taxon") or {}).get("curie")) != wanted_curie:
                continue
            entry = {
                "symbol": ((obj.get("geneSymbol") or {}).get("displayText")) or obj.get("primaryExternalId"),
                "id": obj.get("primaryExternalId"),
                "taxonId": taxon_id,
                "source": "alliance",
            }
            if first_match is None:
                first_match = entry
            is_best = ((item.get("geneToGeneOrthologyGenerated") or {}).get("isBestScore") or {}).get("name")
            if is_best == "Yes":
                best_score = entry
        return best_score or first_match
    except requests.RequestException:
        return None


def _ncbi_ortholog(human_ensembl_id: str, human_symbol: str, taxon_id: int) -> dict | None:
    """NCBI Ortholog via the Datasets API: human gene -> target taxon ortholog."""
    ncbi_gene_id = _ncbi_gene_id(human_ensembl_id, human_symbol)
    if not ncbi_gene_id:
        return None
    try:
        resp = requests.get(
            f"{NCBI_DATASETS_REST}/gene/id/{ncbi_gene_id}/orthologs",
            params={"taxon_filter": str(taxon_id)},
            headers={"Accept": "application/json"},
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        reports = resp.json().get("reports") or []
        for report in reports:
            gene = report.get("gene") or {}
            if str(gene.get("tax_id")) != str(taxon_id):
                continue
            symbol = gene.get("symbol")
            if not symbol:
                continue
            authority = (gene.get("nomenclature_authority") or {}).get("identifier")
            ensembl_ids = gene.get("ensembl_gene_ids") or []
            ortholog_id = (
                authority
                or (ensembl_ids[0] if ensembl_ids else None)
                or str(gene.get("gene_id"))
            )
            return {
                "symbol": symbol,
                "id": ortholog_id,
                "taxonId": taxon_id,
                "source": "ncbi",
            }
        return None
    except requests.RequestException:
        return None


def _ncbi_gene_id(human_ensembl_id: str, human_symbol: str) -> str | None:
    """Resolve a human gene to its NCBI Gene id (via MyGene.info)."""
    if human_ensembl_id:
        try:
            resp = requests.get(
                f"{MYGENE_REST}/gene/{human_ensembl_id}",
                params={"fields": "entrezgene"},
                timeout=_TIMEOUT,
            )
            if resp.status_code == 200:
                value = (resp.json() or {}).get("entrezgene")
                if value:
                    return str(value)
        except requests.RequestException:
            pass
    if human_symbol:
        try:
            resp = requests.get(
                f"{MYGENE_REST}/query",
                params={"q": f"symbol:{human_symbol}", "species": "human", "fields": "entrezgene"},
                timeout=_TIMEOUT,
            )
            if resp.status_code == 200:
                for hit in (resp.json().get("hits") or []):
                    value = hit.get("entrezgene")
                    if value:
                        return str(value)
        except requests.RequestException:
            pass
    return None


def _ensembl_down() -> bool:
    with _ENSEMBL_DOWN_LOCK:
        down_since = _ENSEMBL_DOWN_SINCE
    if down_since is None:
        return False
    return (time.time() - down_since) < _ENSEMBL_DOWN_COOLDOWN_SECONDS


def _mark_ensembl_down() -> None:
    global _ENSEMBL_DOWN_SINCE
    with _ENSEMBL_DOWN_LOCK:
        if _ENSEMBL_DOWN_SINCE is None:
            _ENSEMBL_DOWN_SINCE = time.time()


_MISSING = object()


def _cache_get(key):
    with _CACHE_LOCK:
        return _CACHE.get(key, _MISSING)


def _cache_set(key, value):
    with _CACHE_LOCK:
        if len(_CACHE) > 2000:
            _CACHE.clear()
        _CACHE[key] = value
