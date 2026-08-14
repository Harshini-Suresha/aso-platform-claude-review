"""
Disease -> gene reverse lookup via the Open Targets Platform.

Human only — Open Targets doesn't cover other species, same boundary
already applied everywhere else disease association appears in this
platform (see main.py's fetch_disease_associations).

This mirrors the query shape of that existing, working gene->disease
lookup (same GraphQL endpoint, same page:{index,size} pagination style)
run in the opposite direction, rather than inventing a new query pattern.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import requests

OPEN_TARGETS_URL = "https://api.platform.opentargets.org/api/v4/graphql"
HPO_BASE_URL = "https://ontology.jax.org/api/hp"
_TIMEOUT = 120
TARGET_PAGE_SIZE = 500
_TARGET_FETCH_WORKERS = 4


def get_disease_detail(query: str) -> dict:
    """
    Fuller disease lookup for the dedicated results page: resolves the
    free-text query to a disease (same as search_disease_genes), then
    fetches description, therapeutic areas, the full ranked gene list
    (paginated until every associated target is returned), and known
    drugs where Open Targets has them.

    Some of these fields (description, therapeuticAreas, knownDrugs) are
    less exhaustively tested against the live schema than the core
    search->targets query — every field is read defensively, so a schema
    mismatch on any one of them degrades to null/empty rather than
    breaking the whole response.
    """
    result: dict = {
        "diseaseId": None,
        "diseaseName": None,
        "description": None,
        "therapeuticAreas": [],
        "genes": [],
        "knownDrugs": [],
        "synonyms": [],
        "phenotypes": [],
        "hpoPhenotypes": [],
        "relatedDiseases": [],
        "childDiseases": [],
        "databaseRefs": {},
        "literatureCount": None,
        "associatedTargetCount": None,
        "drugCandidateCount": None,
        "ancestors": [],
    }
    query = (query or "").strip()
    if not query:
        return result

    try:
        search_query = """
        query diseaseSearch($q: String!) {
          search(queryString: $q, entityNames: ["disease"], page: {index: 0, size: 1}) {
            hits { id name entity }
          }
        }
        """
        resp = requests.post(
            OPEN_TARGETS_URL,
            json={"query": search_query, "variables": {"q": query}},
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return result
        data = resp.json().get("data") or {}
        hits = (data.get("search") or {}).get("hits") or []
        if not hits:
            return result

        disease_id = hits[0]["id"]
        disease_name = hits[0]["name"]
        result["diseaseId"] = disease_id
        result["diseaseName"] = disease_name

        detail_query = """
        query diseaseDetail($efoId: String!) {
          disease(efoId: $efoId) {
            id
            name
            description
            literatureOcurrences { count }
            ancestors
            therapeuticAreas { id name }
            synonyms { relation terms }
            phenotypes { count rows { phenotypeHPO { id name } } }
            children { id name }
            dbXRefs
            similarEntities { category id score }
            associatedTargets { count }
            drugAndClinicalCandidates {
              count
              rows {
                drug {
                  id
                  name
                  drugType
                  synonyms { label }
                  tradeNames { label }
                  indications { rows { maxClinicalStage disease { name } } }
                  drugWarnings { warningType efoTerm description }
                  mechanismsOfAction {
                    uniqueActionTypes
                    uniqueTargetTypes
                    rows { mechanismOfAction actionType }
                  }
                }
                maxClinicalStage
                clinicalReports {
                  id
                  clinicalStage
                  trialPhase
                  trialOverallStatus
                  url
                  title
                  year
                }
              }
            }
          }
        }
        """
        resp2 = requests.post(
            OPEN_TARGETS_URL,
            json={"query": detail_query, "variables": {"efoId": disease_id}},
            timeout=_TIMEOUT,
        )
        if resp2.status_code != 200:
            return result

        resp2_data = resp2.json()
        if resp2_data.get("errors"):
            return result

        disease_data = (resp2_data.get("data") or {}).get("disease") or {}

        # Fetch every associated target (not just the top page) via pagination.
        target_total = (disease_data.get("associatedTargets") or {}).get("count")
        target_rows, target_count = _fetch_all_targets(disease_id, target_total)
        if target_rows is None:
            return result
        result["associatedTargetCount"] = target_count

        result["description"] = disease_data.get("description")
        result["literatureCount"] = (disease_data.get("literatureOcurrences") or {}).get("count")

        # Resolve ancestor (disease hierarchy) names in a single aliased query.
        ancestor_ids = [
            a for a in (disease_data.get("ancestors") or [])
            if isinstance(a, str) and (a.startswith("MONDO_") or a.startswith("EFO_"))
        ]
        # De-duplicate while preserving order
        seen_ids = set()
        unique_ancestors = []
        for a in ancestor_ids:
            if a not in seen_ids:
                seen_ids.add(a)
                unique_ancestors.append(a)
        if unique_ancestors:
            result["ancestors"] = _resolve_ancestor_names(unique_ancestors[:8])

        result["therapeuticAreas"] = [
            ta.get("name") for ta in (disease_data.get("therapeuticAreas") or []) if ta.get("name")
        ]

        # Parse synonyms
        synonyms = []
        for syn_group in (disease_data.get("synonyms") or []):
            relation = syn_group.get("relation", "")
            terms = syn_group.get("terms") or []
            for term in terms:
                if term and term.lower() != (result["diseaseName"] or "").lower():
                    synonyms.append({"term": term, "relation": relation})
        result["synonyms"] = synonyms[:15]  # Limit to 15 synonyms

        # Parse phenotypes
        phenotypes = []
        pheno_data = disease_data.get("phenotypes") or {}
        for row in (pheno_data.get("rows") or []):
            hpo = row.get("phenotypeHPO") or {}
            if hpo.get("name"):
                phenotypes.append({"id": hpo.get("id", ""), "name": hpo["name"]})
        result["phenotypes"] = phenotypes[:20]  # Limit to 20 phenotypes

        # Fallback: when Open Targets has no curated HPO phenotypes for this
        # disease (common for complex / multifactorial diseases like
        # atherosclerosis, diabetes, etc.), query the HPO ontology API
        # directly to surface disease-relevant clinical features.
        if not phenotypes:
            result["hpoPhenotypes"] = _fetch_hpo_phenotypes(disease_name)

        # Parse child diseases (subtypes)
        child_diseases = []
        for child in (disease_data.get("children") or []):
            if child.get("name"):
                child_diseases.append({"id": child.get("id", ""), "name": child["name"]})
        result["childDiseases"] = child_diseases[:10]

        # Parse database cross-references
        db_refs = {}
        for ref in (disease_data.get("dbXRefs") or []):
            if ":" in ref:
                db, acc = ref.split(":", 1)
                if db not in db_refs:
                    db_refs[db] = acc
        result["databaseRefs"] = db_refs

        # Parse similar diseases (not drugs)
        similar_diseases = []
        for sim in (disease_data.get("similarEntities") or []):
            if sim.get("category") == "disease" and sim.get("id") != result["diseaseId"]:
                similar_diseases.append({"id": sim.get("id", ""), "score": sim.get("score", 0)})
        result["relatedDiseases"] = similar_diseases[:10]

        rows = target_rows
        genes = []
        for row in rows:
            target = row.get("target") or {}
            symbol = target.get("approvedSymbol")
            if not symbol:
                continue
            score = row.get("score")
            genes.append({
                "symbol": symbol,
                "name": target.get("approvedName"),
                "ensemblId": target.get("id"),
                "biotype": target.get("biotype"),
                "score": round(score, 3) if isinstance(score, (int, float)) else None,
                "function": _first_nonempty(target.get("functionDescriptions")),
                "evidence": _parse_evidence(row.get("datatypeScores") or []),
                "targetClass": [tc.get("label") for tc in (target.get("targetClass") or []) if tc.get("label")],
                "tractability": _parse_tractability(target.get("tractability") or []),
                "constraint": _parse_constraint(target.get("geneticConstraint") or []),
                "mousePhenotypes": [
                    mp.get("modelPhenotypeLabel") for mp in (target.get("mousePhenotypes") or [])
                    if mp.get("modelPhenotypeLabel")
                ],
                "pathways": _parse_pathways(target.get("pathways") or []),
                "genomicLocation": _parse_genomic_location(target.get("genomicLocation")),
                "hallmarks": _parse_hallmarks(target.get("hallmarks")),
                "chemicalProbes": _parse_chemical_probes(target.get("chemicalProbes") or []),
                "safetyLiabilities": _parse_safety_liabilities(target.get("safetyLiabilities") or []),
                "aliases": _parse_aliases(target),
                "uniprotId": _parse_uniprot(target.get("proteinIds") or []),
                "literatureCount": (target.get("literatureOcurrences") or {}).get("count"),
                "isEssential": target.get("isEssential"),
                "associatedDiseaseCount": (target.get("associatedDiseases") or {}).get("count"),
                "interactionCount": (target.get("interactions") or {}).get("count"),
            })
        result["genes"] = genes

        drug_rows = (disease_data.get("drugAndClinicalCandidates") or {}).get("rows") or []
        result["drugCandidateCount"] = (disease_data.get("drugAndClinicalCandidates") or {}).get("count")
        seen_drugs = set()
        drugs = []
        for row in drug_rows:
            drug = row.get("drug") or {}
            name = drug.get("name")
            if not name or name.lower() in seen_drugs:
                continue
            seen_drugs.add(name.lower())
            stage = row.get("maxClinicalStage") or ""
            drug_extras = _parse_drug_extras(drug)
            drugs.append({
                "name": name,
                "id": drug.get("id"),
                "mechanismOfAction": None,
                "phase": None,
                "status": stage.replace("_", " ").title() if stage else None,
                "drugType": drug.get("drugType"),
                "tradeNames": drug_extras["tradeNames"],
                "synonyms": drug_extras["synonyms"],
                "approvedIndications": drug_extras["approvedIndications"],
                "indicationCount": drug_extras["indicationCount"],
                "warnings": _parse_drug_warnings(drug.get("drugWarnings") or []),
                "mechanismsOfAction": _parse_moa(drug.get("mechanismsOfAction") or {}),
                "clinicalReports": _parse_clinical_reports(row.get("clinicalReports") or []),
            })
        result["knownDrugs"] = drugs

        return result

    except requests.RequestException:
        return result


def _fetch_all_targets(disease_id: str, total: int):
    """
    Fetch every associated target for a disease so the results page is
    never truncated to a fixed-size first page.

    Open Targets' associatedTargets paginates by 0-based page index and
    rejects a single request whose response would be too large, so the
    full field set is pulled page-by-page (size TARGET_PAGE_SIZE) with a
    small worker pool. Returns (rows, total_count); both are None if any
    page fails.
    """
    if not total:
        return [], 0
    page_count = (int(total) + TARGET_PAGE_SIZE - 1) // TARGET_PAGE_SIZE
    query = """
    query diseaseAllTargets($efoId: String!, $index: Int!, $size: Int!) {
      disease(efoId: $efoId) {
        associatedTargets(page: {index: $index, size: $size}) {
          count
          rows {
            score
            datatypeScores { id score }
            target {
              id
              approvedSymbol
              approvedName
              biotype
              functionDescriptions
              tractability { label modality value }
              geneticConstraint { constraintType exp obs oe }
              targetClass { label }
              mousePhenotypes { modelPhenotypeLabel }
              pathways { pathway pathwayId topLevelTerm }
              genomicLocation { chromosome start end }
              hallmarks { attributes { name } }
              chemicalProbes { drugId isHighQuality }
              safetyLiabilities { event }
              literatureOcurrences { count }
              isEssential
              nameSynonyms { label }
              symbolSynonyms { label }
              proteinIds { id source }
              associatedDiseases { count }
              interactions { count }
            }
          }
        }
      }
    }
    """

    def fetch_page(page_index: int):
        resp = requests.post(
            OPEN_TARGETS_URL,
            json={
                "query": query,
                "variables": {"efoId": disease_id, "index": page_index, "size": TARGET_PAGE_SIZE},
            },
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("errors"):
            return None
        return ((data.get("data") or {}).get("disease") or {}).get("associatedTargets") or {}

    all_rows = []
    first = fetch_page(0)
    if first is None:
        return None, None
    all_rows.extend(first.get("rows") or [])
    total = first.get("count") or total
    page_count = (int(total) + TARGET_PAGE_SIZE - 1) // TARGET_PAGE_SIZE
    with ThreadPoolExecutor(max_workers=_TARGET_FETCH_WORKERS) as pool:
        pages = list(pool.map(fetch_page, range(1, page_count)))
    for page in pages:
        if page is None:
            return None, None
        all_rows.extend(page.get("rows") or [])
    return all_rows, total


def _fetch_hpo_phenotypes(disease_name: str) -> list:
    """Fallback clinical-feature source for diseases with no curated HPO
    annotations in Open Targets.

    Complex / common diseases (e.g. atherosclerosis, type-2 diabetes) are
    rarely in the HPO Annotation (HPOA) file, so Open Targets returns zero
    phenotypes.  However, the HPO *ontology* itself often contains a disease
    phenotype term (e.g. "Atherosclerosis" → HP:0002621).  Its descendant
    terms represent the clinical features / morphologic manifestations of
    that disease (e.g. "Atherosclerotic lesion", "Foam cells").

    Strategy:
      1. Search the HPO ontology API for a term whose name matches the
         disease name.
      2. If found, fetch its descendant terms — these are the clinical
         features.
      3. Return them as [{"id", "name"}, …], limited to 20.
    """
    try:
        search_url = f"{HPO_BASE_URL}/search?q={disease_name}"
        resp = requests.get(search_url, timeout=_TIMEOUT)
        if resp.status_code != 200:
            return []
        search_data = resp.json()
        terms = (search_data.get("terms") or []) if isinstance(search_data, dict) else []
        if not terms:
            return []

        # Prefer an exact (case-insensitive) name match; otherwise take
        # the top result.
        best = None
        for t in terms:
            if isinstance(t, dict) and (t.get("name") or "").lower() == disease_name.lower():
                best = t
                break
        if best is None:
            best = terms[0]

        term_id = best.get("id") if isinstance(best, dict) else None
        if not term_id:
            return []

        desc_url = f"{HPO_BASE_URL}/terms/{term_id}/descendants"
        resp2 = requests.get(desc_url, timeout=_TIMEOUT)
        if resp2.status_code != 200:
            return []
        desc_data = resp2.json()
        desc_list = desc_data if isinstance(desc_data, list) else []

        phenotypes = []
        for d in desc_list:
            if isinstance(d, dict) and d.get("name"):
                phenotypes.append({"id": d.get("id", ""), "name": d["name"]})
        return phenotypes[:20]

    except requests.RequestException:
        return []


def _resolve_ancestor_names(ancestor_ids):
    """Resolve MONDO/EFO ancestor ids to display names in one aliased query."""
    if not ancestor_ids:
        return []
    aliases = " ".join(
        f'a{i}: search(queryString: "{a}", entityNames: ["disease"], page: {{index: 0, size: 1}}) {{ hits {{ id name }} }}'
        for i, a in enumerate(ancestor_ids)
    )
    query = "query {" + aliases + "}"
    try:
        resp = requests.post(OPEN_TARGETS_URL, json={"query": query}, timeout=_TIMEOUT)
        if resp.status_code != 200:
            return [{"id": a, "name": a} for a in ancestor_ids]
        data = resp.json().get("data") or {}
        out = []
        for key in sorted(data.keys(), key=lambda k: int(k[1:])):
            hits = (data.get(key) or {}).get("hits") or []
            if hits and hits[0].get("name"):
                out.append({"id": hits[0].get("id") or ancestor_ids[int(key[1:])], "name": hits[0]["name"]})
            else:
                out.append({"id": ancestor_ids[int(key[1:])], "name": ancestor_ids[int(key[1:])]})
        return out
    except requests.RequestException:
        return [{"id": a, "name": a} for a in ancestor_ids]


def _first_nonempty(values):
    if isinstance(values, str):
        values = [values]
    for v in values or []:
        if v and isinstance(v, str):
            return v
    return None


def _parse_evidence(datatype_scores):
    """Map Open Targets datatype scores into an ordered, friendly dict."""
    evidence = {}
    for ds in datatype_scores or []:
        if not ds:
            continue
        key = ds.get("id")
        value = ds.get("score")
        if key and isinstance(value, (int, float)):
            evidence[key] = round(value, 3)
    return evidence


def _parse_tractability(tractability):
    out = []
    for t in tractability or []:
        if not t:
            continue
        modality = t.get("modality")
        label = t.get("label")
        value = t.get("value")
        if modality and label and value:
            out.append({"modality": modality, "label": label})
    return out


def _parse_constraint(constraints):
    out = {}
    for c in constraints or []:
        ctype = c.get("constraintType")
        if not ctype:
            continue
        out[ctype] = {
            "exp": round(c["exp"], 3) if isinstance(c.get("exp"), (int, float)) else c.get("exp"),
            "obs": c.get("obs"),
            "oe": round(c["oe"], 3) if isinstance(c.get("oe"), (int, float)) else c.get("oe"),
        }
    return out


def _parse_pathways(pathways):
    out = []
    for p in pathways or []:
        if not p:
            continue
        name = p.get("pathway")
        pid = p.get("pathwayId")
        if name and pid:
            out.append({
                "pathway": name,
                "pathwayId": pid,
                "topLevelTerm": p.get("topLevelTerm"),
            })
    return out


def _parse_genomic_location(location):
    if not location:
        return None
    return {
        "chromosome": location.get("chromosome"),
        "start": location.get("start"),
        "end": location.get("end"),
    }


def _parse_hallmarks(hallmarks):
    out = []
    for h in (hallmarks or {}).get("attributes") or []:
        if h and h.get("name"):
            out.append(h["name"])
    return out


def _parse_chemical_probes(probes):
    out = []
    for p in probes or []:
        if not p or not p.get("drugId"):
            continue
        out.append({
            "drugId": p["drugId"],
            "isHighQuality": bool(p.get("isHighQuality")),
        })
    return out


def _parse_safety_liabilities(liabilities):
    out = []
    for l in liabilities or []:
        if l and l.get("event"):
            out.append(l["event"])
    return out


def _parse_aliases(target):
    aliases = []
    for s in (target.get("symbolSynonyms") or []) + (target.get("nameSynonyms") or []):
        label = s.get("label") if isinstance(s, dict) else s
        if not label:
            continue
        if label.lower() != (target.get("approvedSymbol") or "").lower() and label not in aliases:
            aliases.append(label)
        if len(aliases) >= 10:
            break
    return aliases


def _parse_uniprot(protein_ids):
    for p in protein_ids or []:
        if p and p.get("source") == "uniprot_swissprot" and p.get("id"):
            return p["id"]
    return None


def _parse_drug_warnings(warnings):
    out = []
    for w in warnings or []:
        if w and w.get("warningType"):
            out.append({
                "warningType": w.get("warningType"),
                "efoTerm": w.get("efoTerm"),
                "description": w.get("description"),
            })
        if len(out) >= 8:
            break
    return out


def _parse_drug_extras(drug):
    trade_names = [t.get("label") for t in (drug.get("tradeNames") or []) if t.get("label")]
    synonyms = [s.get("label") for s in (drug.get("synonyms") or []) if s.get("label")]
    indications = []
    for ind in (drug.get("indications") or {}).get("rows") or []:
        disease = (ind.get("disease") or {}).get("name")
        if disease:
            indications.append({"disease": disease, "stage": ind.get("maxClinicalStage")})
    approved = [
        i["disease"] for i in indications if i.get("stage") == "APPROVAL"
    ]
    return {
        "tradeNames": trade_names[:5],
        "synonyms": synonyms[:5],
        "approvedIndications": approved[:5],
        "indicationCount": len(indications),
    }


def _parse_moa(moa):
    out = {
        "actionTypes": moa.get("uniqueActionTypes") or [],
        "targetTypes": moa.get("uniqueTargetTypes") or [],
        "rows": [],
    }
    for r in (moa.get("rows") or []):
        if r and r.get("mechanismOfAction"):
            out["rows"].append({
                "mechanismOfAction": r.get("mechanismOfAction"),
                "actionType": r.get("actionType"),
            })
    return out


def _parse_clinical_reports(reports):
    out = []
    for r in reports or []:
        if not r:
            continue
        out.append({
            "id": r.get("id"),
            "clinicalStage": r.get("clinicalStage"),
            "trialPhase": r.get("trialPhase"),
            "trialOverallStatus": r.get("trialOverallStatus"),
            "url": r.get("url"),
            "title": r.get("title"),
            "year": r.get("year"),
        })
    return out


def search_disease_genes(query: str, limit: int = 12) -> dict:
    """
    Free-text disease name -> best-matching disease + its top associated
    genes, ranked by Open Targets' real evidence-based association score.

    Returns empty fields (never a fabricated match) if nothing is found
    or the API is unreachable.
    """
    result: dict = {"diseaseId": None, "diseaseName": None, "genes": []}
    query = (query or "").strip()
    if not query:
        return result

    try:
        search_query = """
        query diseaseSearch($q: String!) {
          search(queryString: $q, entityNames: ["disease"], page: {index: 0, size: 1}) {
            hits { id name entity }
          }
        }
        """
        resp = requests.post(
            OPEN_TARGETS_URL,
            json={"query": search_query, "variables": {"q": query}},
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return result

        resp_data = resp.json()
        if resp_data.get("errors"):
            return result

        hits = ((resp_data.get("data") or {}).get("search") or {}).get("hits") or []
        if not hits:
            return result

        disease_id = hits[0]["id"]
        disease_name = hits[0]["name"]
        result["diseaseId"] = disease_id
        result["diseaseName"] = disease_name

        targets_query = """
        query diseaseTargets($efoId: String!, $size: Int!) {
          disease(efoId: $efoId) {
            id
            name
            associatedTargets(page: {index: 0, size: $size}) {
              rows {
                score
                target { id approvedSymbol approvedName }
              }
            }
          }
        }
        """
        resp2 = requests.post(
            OPEN_TARGETS_URL,
            json={"query": targets_query, "variables": {"efoId": disease_id, "size": limit}},
            timeout=_TIMEOUT,
        )
        if resp2.status_code != 200:
            return result

        resp2_data = resp2.json()
        if resp2_data.get("errors"):
            return result

        disease_data = (resp2_data.get("data") or {}).get("disease") or {}
        rows = (disease_data.get("associatedTargets") or {}).get("rows") or []

        genes = []
        for row in rows:
            target = row.get("target") or {}
            symbol = target.get("approvedSymbol")
            if not symbol:
                continue
            score = row.get("score")
            genes.append({
                "symbol": symbol,
                "name": target.get("approvedName"),
                "ensemblId": target.get("id"),
                "score": round(score, 3) if isinstance(score, (int, float)) else None,
            })

        result["genes"] = genes
        return result

    except requests.RequestException:
        return result
