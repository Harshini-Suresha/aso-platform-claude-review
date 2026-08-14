# backend/services/gene_service.py
import json
import logging
import time
import requests
from typing import Optional

from database.db import SessionLocal
from database.models import GeneLookupCache

REST_API_BASE = "https://rest.ensembl.org"
HGNC_API_BASE = "https://rest.genenames.org"
ENSEMBL_TIMEOUT = 8
# The expand=1 gene lookup is large and slow to build cold (~300 KB, >15 s
# for big genes like DMD). Give it a generous timeout so the primary path
# succeeds instead of silently degrading to the sparse NCBI fallback.
ENSEMBL_EXPAND_TIMEOUT = 45
MAX_RETRIES = 2
RETRY_BACKOFF = 1.0

# How long a cached gene metadata entry is considered fresh.
GENE_CACHE_TTL_SECONDS = 7 * 24 * 3600

logger = logging.getLogger(__name__)


class EnsemblLookupUnavailable(RuntimeError):
    """Raised when Ensembl cannot be contacted, rather than when a gene is absent."""


def get_hgnc_metadata(gene_symbol: str) -> dict:
    """Return the approved HGNC ID and aliases for a human gene when available."""
    try:
        response = requests.get(
            f"{HGNC_API_BASE}/fetch/symbol/{gene_symbol}",
            headers={"Accept": "application/json"},
            timeout=6,
        )
        if not response.ok:
            return {}

        docs = (response.json().get("response") or {}).get("docs") or []
        return docs[0] if docs else {}
    except (requests.RequestException, ValueError):
        # HGNC enrichment is optional; Ensembl remains the source of truth for lookup.
        return {}


def clean_synonyms(values, gene_symbol: str) -> list:
    """Keep only distinct, meaningful aliases (never the approved symbol itself)."""
    clean_values = []
    seen = set()
    excluded = {gene_symbol.strip().casefold(), "none identified", "n/a", "na"}

    for value in values or []:
        if not isinstance(value, str):
            continue
        synonym = value.strip()
        key = synonym.casefold()
        if not synonym or key in excluded or key in seen:
            continue
        seen.add(key)
        clean_values.append(synonym)

    return clean_values


def build_gene_fallback_payload(
    meta: Optional[dict],
    official_symbol: str,
    gene_name: Optional[str],
    gene_id: Optional[str],
    is_human: bool,
    enrichment_data: Optional[dict] = None,
    protein_props: Optional[dict] = None,
    protein_db: Optional[dict] = None,
    clinical_details: Optional[dict] = None,
    disease_resolved: Optional[str] = None,
) -> dict:
    """Populate a gene payload with conservative defaults when upstream services fail."""
    enrichment_data = enrichment_data or {}
    protein_props = protein_props or {}
    protein_db = protein_db or {}
    clinical_details = clinical_details or {}
    meta = meta or {}

    gene_name_value = (gene_name or official_symbol or "Unknown").strip() or official_symbol or "Unknown"
    gene_function_value = enrichment_data.get("geneFunction") or gene_name_value or official_symbol
    hgnc_id = meta.get("nomenclatureId") or meta.get("hgncId")
    if not hgnc_id and is_human:
        hgnc_id = f"HGNC:{official_symbol}"

    canonical_transcript = meta.get("canonicalTranscript") or gene_id or official_symbol
    protein_id = meta.get("proteinId") or protein_db.get("proteinId") or protein_db.get("uniprotAccession")
    protein_length = meta.get("proteinLength") or protein_props.get("proteinLength")

    return {
        "geneFunction": gene_function_value,
        "geneName": gene_name_value,
        "hgncId": hgnc_id,
        "geneType": (meta.get("biotype") or meta.get("geneType") or "protein_coding") or "protein_coding",
        "source": ["Ensembl"] if str(gene_id or "").startswith("ENSG") else (["NCBI"] if str(gene_id or "").startswith("NCBI:") else ["Ensembl"]),
        "canonicalTranscript": canonical_transcript,
        "canonicalTranscriptLabel": "Canonical (MANE Select)" if is_human else "Canonical",
        "proteinId": protein_id,
        "proteinLength": protein_length,
        "diseaseMechanism": clinical_details.get("diseaseMechanism") or disease_resolved,
        "diseaseAssociation": disease_resolved or "None identified",
    }


def get_cytoband(species: str, chromosome: str, start: int, end: int) -> Optional[str]:
    """Resolve the cytogenetic band(s) spanning a gene from Ensembl."""
    if not all([chromosome, start, end]):
        return None
    try:
        url = f"{REST_API_BASE}/overlap/region/{species}/{chromosome}:{start}-{end}?feature=band"
        response = _ensembl_get(url)
        bands = response.json() if response.ok else []
        labels = [f"{chromosome}{band.get('id')}" for band in sorted(bands, key=lambda item: item.get("start", 0)) if band.get("id")]
        return "–".join(labels) if labels else None
    except (EnsemblLookupUnavailable, ValueError):
        return None

def ensembl_gene_url(*args):
    """
    Generates a web link to the Ensembl browser page for a given gene ID.
    Intelligently handles calling signatures like (gene_id) or (gene_id, species).
    Accepts both common names (mouse, human) and Ensembl species names (mus_musculus).
    """
    gene_id = ""
    organism = "human"
    
    for arg in args:
        arg_str = str(arg).strip()
        # Match common names
        if any(sp in arg_str.lower() for sp in ["human", "mouse", "sapiens", "musculus", "rat", "norvegicus", "macaque", "zebrafish"]):
            organism = arg_str
        # Also match Ensembl species names directly (e.g. mus_musculus, danio_rerio)
        elif "_" in arg_str and any(part in arg_str.lower() for part in ["sapiens", "musculus", "norvegicus", "fascicularis", "mulatta", "rerio", "melanogaster", "elegans", "cerevisiae", "pombe", "familiaris", "catus", "scrofa", "taurus", "caballus", "aries", "hircus", "gallus", "thaliana", "sativa", "mays", "aestivum", "lycopersicum", "coli", "aureus", "tuberculosis", "aeruginosa"]):
            organism = arg_str
        elif arg_str:
            gene_id = arg_str
            
    org_lower = organism.lower()
    # Direct Ensembl species name (e.g. mus_musculus) — capitalize for URL
    if "_" in org_lower and not any(cn in org_lower for cn in ["human", "mouse", "rat", "zebrafish"]):
        parts = org_lower.split("_")
        species = "_".join(p.capitalize() for p in parts if p)
    elif "sapiens" in org_lower or "human" in org_lower:
        species = "Homo_sapiens"
    elif "musculus" in org_lower or "mouse" in org_lower:
        species = "Mus_musculus"
    elif "norvegicus" in org_lower or "rat" in org_lower:
        species = "Rattus_norvegicus"
    elif "fascicularis" in org_lower:
        species = "Macaca_fascicularis"
    elif "mulatta" in org_lower:
        species = "Macaca_mulatta"
    elif "rerio" in org_lower or "zebrafish" in org_lower:
        species = "Danio_rerio"
    else:
        parts = org_lower.replace(" ", "_").split("_")
        species = "_".join(p.capitalize() for p in parts if p)
        if not species:
            species = "Homo_sapiens"
            
    return f"https://www.ensembl.org/{species}/Gene/Summary?g={gene_id}"

def _ensembl_get(url: str, retries: int = MAX_RETRIES, timeout: int = ENSEMBL_TIMEOUT) -> requests.Response:
    """GET with retries and exponential backoff for transient Ensembl failures."""
    last_exc: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(
                url,
                headers={"Accept": "application/json"},
                timeout=timeout,
            )
            if response.status_code == 404:
                return response
            if response.ok:
                return response
            if response.status_code >= 500:
                last_exc = RuntimeError(f"HTTP {response.status_code}")
                wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                logger.warning("Ensembl returned %d (attempt %d/%d), retrying in %.1fs",
                               response.status_code, attempt, retries, wait)
                time.sleep(wait)
                continue
            return response
        except requests.RequestException as exc:
            last_exc = exc
            if attempt < retries:
                wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                logger.warning("Ensembl request failed (attempt %d/%d), retrying in %.1fs: %s",
                               attempt, retries, wait, exc)
                time.sleep(wait)
    raise EnsemblLookupUnavailable("Ensembl could not be reached after multiple attempts. Please try again shortly.") from last_exc


def _load_cached_gene_metadata(
    gene_symbol: str, species: str, fresh_only: bool = True
) -> Optional[dict]:
    """Return cached gene metadata for a gene, or None.

    ``fresh_only`` skips entries older than the TTL. When fresh_only is False
    a stale entry is still returned so an Ensembl outage does not degrade the
    gene page for genes seen before.
    """
    try:
        db = SessionLocal()
        try:
            row = (
                db.query(GeneLookupCache)
                .filter(
                    GeneLookupCache.organism == species,
                    GeneLookupCache.gene_symbol == gene_symbol,
                )
                .one_or_none()
            )
            if row is None:
                return None
            if fresh_only and (time.time() - row.updated_at) > GENE_CACHE_TTL_SECONDS:
                return None
            payload = json.loads(row.payload or "{}")
            if not isinstance(payload, dict) or not payload.get("id"):
                return None
            logger.warning("Serving cached gene metadata for %s (%s)", gene_symbol, species)
            return payload
        finally:
            db.close()
    except Exception as exc:  # never let a cache read break the lookup
        logger.warning("Failed to load cached gene metadata for %s: %s", gene_symbol, exc)
        return None


def _save_cached_gene_metadata(gene_symbol: str, species: str, meta: dict) -> None:
    """Persist gene metadata so repeat lookups skip the slow Ensembl expand call."""
    try:
        db = SessionLocal()
        try:
            row = (
                db.query(GeneLookupCache)
                .filter(
                    GeneLookupCache.organism == species,
                    GeneLookupCache.gene_symbol == gene_symbol,
                )
                .one_or_none()
            )
            now = time.time()
            if row is None:
                row = GeneLookupCache(
                    organism=species,
                    gene_symbol=gene_symbol,
                    payload=json.dumps(meta),
                    created_at=now,
                    updated_at=now,
                )
                db.add(row)
            else:
                row.payload = json.dumps(meta)
                row.updated_at = now
            db.commit()
        finally:
            db.close()
    except Exception as exc:  # never let a cache write break the lookup
        logger.warning("Failed to cache gene metadata for %s: %s", gene_symbol, exc)


def get_gene_metadata(gene_symbol: str, organism: str):
    """Resolve gene metadata for a gene symbol.

    Serves a fresh cached entry when available; otherwise fetches live from
    Ensembl. If Ensembl is unreachable, replays the last known-good entry so
    previously seen genes never degrade to the sparse NCBI fallback.
    """
    species = organism.lower().strip().replace(" ", "_")

    cached = _load_cached_gene_metadata(gene_symbol, species, fresh_only=True)
    if cached is not None:
        return cached

    try:
        return _fetch_gene_metadata_live(gene_symbol, species)
    except EnsemblLookupUnavailable:
        stale = _load_cached_gene_metadata(gene_symbol, species, fresh_only=False)
        if stale is not None:
            return stale
        raise


def _fetch_gene_metadata_live(gene_symbol: str, species: str):
    """Live Ensembl lookup split into a light step + a heavy expand step.

    The old single `?expand=1` symbol call returned a ~300 KB payload that
    can take >15 s to build cold and blew the request timeout, silently
    degrading every gene to the NCBI fallback (blank transcripts/exons/
    strand/protein/function). Now:
      1. a small symbol lookup (expand=0) resolves the Ensembl ID and the
         canonical transcript ID fast;
      2. the heavy expand=1 call (which also carries the cached warm
         response) fills in transcripts, exons and translations — with a
         generous timeout, and is skipped gracefully if it still fails.
    """
    # Step 1 — light symbol lookup (small, fast)
    url = f"{REST_API_BASE}/lookup/symbol/{species}/{gene_symbol}?expand=0&synonyms=1"

    response = _ensembl_get(url)

    if response.status_code == 404:
        return None
    # 400 = species/symbol not on this Ensembl instance (e.g. plants, bacteria).
    # Return None so the NCBI fallback in main.py can try.
    if response.status_code == 400:
        return None
    if not response.ok:
        raise EnsemblLookupUnavailable(
            f"Ensembl lookup is unavailable (HTTP {response.status_code}). Please try again shortly."
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise EnsemblLookupUnavailable("Ensembl returned an invalid lookup response. Please try again shortly.") from exc

    gene_id = data.get("id")

    # Step 2 — transcripts via heavy expand lookup (graceful on failure)
    transcripts = []
    try:
        tx_url = f"{REST_API_BASE}/lookup/id/{gene_id}?expand=1"
        tx_response = _ensembl_get(tx_url, timeout=ENSEMBL_EXPAND_TIMEOUT)
        if tx_response.ok:
            transcripts = (tx_response.json().get("Transcript") or [])
    except (EnsemblLookupUnavailable, ValueError) as exc:
        logger.warning("Expanded transcript lookup failed for %s (%s): %s", gene_symbol, species, exc)
        transcripts = []

    # Prefer the canonical_transcript id from the light lookup; fall back to
    # the is_canonical flag or first transcript from the expanded payload.
    canonical_id = data.get("canonical_transcript")
    canonical = None
    if canonical_id:
        canonical = next((t for t in transcripts if t.get("id") == canonical_id), None)
    if canonical is None and transcripts:
        canonical = next((t for t in transcripts if t.get("is_canonical")), transcripts[0])
    canonical_id = canonical.get("id") if canonical else (canonical_id or "N/A")

    # Extract transcripts data needed by main.py
    other_transcripts = [t.get("id") for t in transcripts if t.get("id") and t.get("id") != canonical_id]

    hgnc_data = get_hgnc_metadata(gene_symbol) if species == "homo_sapiens" else {}
    aliases = clean_synonyms(
        [*(data.get("synonyms") or []), *(hgnc_data.get("alias_symbol") or []), *(hgnc_data.get("prev_symbol") or [])],
        gene_symbol,
    )

    # Ensembl appends provenance in square brackets; keep the actual gene name only.
    gene_name = (data.get("description") or "Unknown").split(" [Source:", 1)[0].strip()
    chromosome, start, end = data.get("seq_region_name"), data.get("start"), data.get("end")

    if species == "homo_sapiens":
        # HGNC's `location` field (e.g. "Xp21.2-p21.1") is a fast, reliable
        # cytoband source; Ensembl's /overlap/region?feature=band query is
        # unusably slow for large genes (DMD takes >90 s and times out).
        cytoband = hgnc_data.get("location")
    else:
        try:
            cytoband = get_cytoband(species, chromosome, start, end)
        except EnsemblLookupUnavailable:
            cytoband = None

    meta = {
        "geneName": gene_name,
        "officialSymbol": data.get("display_name"),
        "id": gene_id,
        "seq_region_name": chromosome,
        "start": start,
        "end": end,
        "cytoband": cytoband,
        "genomeBuild": data.get("assembly_name"),
        "strand": data.get("strand"),
        "biotype": data.get("biotype"),
        "synonyms": aliases,
        "nomenclatureId": hgnc_data.get("hgnc_id"),
        "canonicalTranscript": canonical_id or "N/A",
        "otherTranscripts": other_transcripts,
        "totalTranscripts": len(transcripts),
        "exonCount": len(canonical.get("Exon", [])) if canonical else 0,
        "proteinLength": canonical.get("Translation", {}).get("length", 0) if canonical and canonical.get("Translation") else 0,
        "proteinId": canonical.get("Translation", {}).get("id", "N/A") if canonical and canonical.get("Translation") else "N/A",
    }
    _save_cached_gene_metadata(gene_symbol, species, meta)
    return meta

def get_gene_phenotypes(gene_symbol: str, organism: str):
    """Fetch phenotype associations from Ensembl.

    Uses the /phenotype/gene/{species}/{symbol} endpoint which returns
    cross-species phenotype data (MGI, ZFIN, RGD, etc.).
    Phenotype responses can be large; use a longer timeout than typical lookups.
    """
    species = organism.lower().strip().replace(" ", "_")
    url = f"{REST_API_BASE}/phenotype/gene/{species}/{gene_symbol}"
    try:
        response = requests.get(
            url,
            headers={"Accept": "application/json"},
            timeout=8,
        )
        if not response.ok:
            return []
        return response.json()
    except Exception:
        return []
