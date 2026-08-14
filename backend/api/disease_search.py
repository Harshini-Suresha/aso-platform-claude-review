from fastapi import APIRouter

from services.disease_search_service import search_disease_genes, get_disease_detail
from services.ortholog_service import map_human_orthologs

router = APIRouter()

EMPTY_SEARCH = {"diseaseId": None, "diseaseName": None, "genes": []}

EMPTY_DETAIL = {
    "diseaseId": None,
    "diseaseName": None,
    "description": None,
    "therapeuticAreas": [],
    "genes": [],
    "knownDrugs": [],
    "phenotypes": [],
    "hpoPhenotypes": [],
    "synonyms": [],
    "relatedDiseases": [],
    "childDiseases": [],
    "databaseRefs": {},
    "literatureCount": None,
    "associatedTargetCount": None,
    "drugCandidateCount": None,
    "ancestors": [],
}


def _attach_orthologs(result: dict, organism: str) -> dict:
    """Attach per-gene ortholog mappings for non-human organisms (fail-open)."""
    if not result or not organism or organism == "human":
        return result
    genes = result.get("genes") or []
    if not genes:
        return result
    orthologs = map_human_orthologs(genes, organism)
    mapped = 0
    for gene in genes:
        ortholog = orthologs.get(gene.get("symbol"))
        if ortholog:
            gene["ortholog"] = ortholog
            mapped += 1
    result["organism"] = organism
    result["orthologMapped"] = mapped
    return result


@router.get("/api/disease-search")
async def disease_search(query: str, organism: str = "human"):
    if not query or not query.strip():
        return dict(EMPTY_SEARCH)
    return _attach_orthologs(search_disease_genes(query.strip()), organism)


@router.get("/api/disease-search/detail")
async def disease_search_detail(query: str, organism: str = "human"):
    if not query or not query.strip():
        return dict(EMPTY_DETAIL)
    return _attach_orthologs(get_disease_detail(query.strip()), organism)
