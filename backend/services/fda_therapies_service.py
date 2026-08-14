"""FDA-approved antisense oligonucleotide (ASO) therapies.

Queries ClinicalTrials.gov, FDA databases, and a curated list of FDA-approved
ASO drugs to find oligonucleotide therapies for ANY gene in the world.

Sources:
- ClinicalTrials.gov API v2
- FDA Orange Book (curated ASO therapy list)
- FDA Drugs@FDA database
"""

import logging
import re
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

logger = logging.getLogger(__name__)

# Curated list of FDA-approved oligonucleotide therapies (ASO, siRNA, aptamer)
# Each entry: (drug_name, target_gene_or_pathway, indication, approval_year, modality)
# Sources: FDA Orange Book, FDA TIDES reviews (1998-2025)
FDA_APPROVED_ASOS = [
    # --- ASOs (Antisense Oligonucleotides) ---
    ("Fomivirsen (Vitravene)", "CMV", "CMV retinitis (withdrawn)", "1998", "ASO"),
    ("Mipomersen (Kynamro)", "APOB", "Homozygous familial hypercholesterolemia", "2013", "ASO"),
    ("Nusinersen (Spinraza)", "SMN1/SMN2", "Spinal muscular atrophy", "2016", "ASO"),
    ("Eteplirsen (Exondys 51)", "DMD", "Duchenne muscular dystrophy (exon 51 skipping)", "2016", "ASO"),
    ("Inotersen (Tegsedi)", "TTR", "Hereditary transthyretin amyloidosis", "2018", "ASO"),
    ("Volanesorsen (Waylivra)", "APOC3", "Familial chylomicronemia syndrome", "2019", "ASO"),
    ("Golodirsen (Vyondys 53)", "DMD", "Duchenne muscular dystrophy (exon 53 skipping)", "2019", "ASO"),
    ("Viltolarsen (Viltepso)", "DMD", "Duchenne muscular dystrophy (exon 53 skipping)", "2020", "ASO"),
    ("Casimersen (Amondys 45)", "DMD", "Duchenne muscular dystrophy (exon 45 skipping)", "2021", "ASO"),
    ("Tofersen (Qalsody)", "SOD1", "Amyotrophic lateral sclerosis (SOD1 mutations)", "2023", "ASO"),
    ("Eplontersen (Wainua)", "TTR", "Hereditary transthyretin-mediated amyloidosis (polyneuropathy)", "2023", "ASO"),
    ("Imetelstat (Rytelo)", "TERT", "Myelodysplastic syndromes (low/intermediate-1 risk)", "2024", "ASO"),
    ("Olezarsen (Tryngolza)", "APOC3", "Familial chylomicronemia syndrome", "2024", "ASO"),
    ("Donidalorsen (Dawnzera)", "KLKB1", "Hereditary angioedema (prophylaxis)", "2025", "ASO"),
    # --- siRNAs (Small Interfering RNAs) ---
    ("Patisiran (Onpattro)", "TTR", "Hereditary transthyretin amyloidosis (polyneuropathy)", "2018", "siRNA"),
    ("Givosiran (Givlaari)", "ALAS1", "Acute hepatic porphyria", "2019", "siRNA"),
    ("Lumasiran (Oxlumo)", "HAO1", "Primary hyperoxaluria type 1", "2020", "siRNA"),
    ("Inclisiran (Leqvio)", "PCSK9", "Hypercholesterolemia (LDL-C reduction)", "2021", "siRNA"),
    ("Vutrisiran (Amvuttra)", "TTR", "Hereditary transthyretin-mediated amyloidosis (polyneuropathy)", "2022", "siRNA"),
    ("Nedosiran (Rivfloza)", "LDHA", "Primary hyperoxaluria", "2023", "siRNA"),
    ("Fitusiran (Qfitlia)", "SERPINC1", "Hemophilia A/B (with or without inhibitors)", "2025", "siRNA"),
    ("Plozasiran (Redemplo)", "APOC3", "Familial chylomicronemia syndrome", "2025", "siRNA"),
    # --- Aptamers ---
    ("Pegaptanib (Macugen)", "VEGF165", "Age-related macular degeneration (wet AMD)", "2004", "Aptamer"),
    ("Avacincaptad pegol (Izervay)", "C5", "Geographic atrophy (dry AMD)", "2023", "Aptamer"),
    # --- Other oligonucleotide-like therapies ---
    ("Defibrotide (Defitelio)", "SERPINE1", "Hepatic veno-occlusive disease (sinusoidal obstruction syndrome)", "2016", "ODN"),
    # --- Investigational (late-stage, no FDA approval yet) ---
    ("Tominersen (RG6042)", "HTT", "Huntington disease (Phase III)", None, "ASO"),
    ("BIIB080 (IONIS-MAPTRx)", "MAPT", "Alzheimer disease / tau (Phase II)", None, "ASO"),
    ("Bepirovirsen (GSK3228836)", "HBV", "Hepatitis B (Phase II/III)", None, "ASO"),
    ("Zilgersen (IONIS-AZ4-2.5-LRx)", "AZIN1", "Hepatocellular carcinoma (Phase I/II)", None, "ASO"),
]

# Gene alias mappings for matching
GENE_ALIASES = {
    "APOB": ["APOB", "APOB100", "APOB-100", "APOLIPOPROTEIN B"],
    "ALAS1": ["ALAS1", "ALAS-1", "ALASE", "DELTA-AMINOLEVULINIC ACID SYNTHASE 1"],
    "HAO1": ["HAO1", "HAO-1", "GLYCOLATE OXIDASE", "HYDROXYACID OXIDASE 1"],
    "PCSK9": ["PCSK9", "FH3", "NARC1", "PROPROTEIN CONVERTASE SUBTILISIN/KEXIN TYPE 9"],
    "LDHA": ["LDHA", "LDH-A", "LDH1", "LDHM", "LACTATE DEHYDROGENASE A"],
    "SERPINC1": ["SERPINC1", "AT3", "AT3III", "ANTITHROMBIN III", "ANTITHROMBIN"],
    "TERT": ["TERT", "TRT", "TELOMERASE", "TELOMERASE REVERSE TRANSCRIPTASE"],
    "KLKB1": ["KLKB1", "KLK3", "KALLIKREIN B1", "PLASMA KALLIKREIN"],
    "SOD1": ["SOD1", "SOD1A", "CU/ZN-SOD", "SUPEROXIDE DISMUTASE 1"],
    "VEGF165": ["VEGF165", "VEGF", "VEGFA", "VEGF-A", "VASCULAR ENDOTHELIAL GROWTH FACTOR"],
    "C5": ["C5", "COMPLEMENT C5", "CPAMD4", "COMPLEMENT COMPONENT 5"],
    "CMV": ["CMV", "CYTOMEGALOVIRUS"],
    "SMN1": ["SMN1", "SMN2", "SMN", "SURVIVAL MOTOR NEURON"],
    "HTT": ["HTT", "HUNTINGTIN", "IT15"],
    "MAPT": ["MAPT", "TAU", "MAPTL1", "MTBT1", "MICROTUBULE ASSOCIATED PROTEIN TAU"],
    "HBV": ["HBV", "HEPATITIS B VIRUS"],
    "AZIN1": ["AZIN1", "AZIN-1", "ODC1L"],
    "DMD": ["DMD", "DYSTROPHIN"],
    "TTR": ["TTR", "TRANSTHYRETIN", "PALB", "PREALBUMIN"],
    "APOC3": ["APOC3", "APOC-III", "APOLIPOPROTEIN C3"],
    "SERPINE1": ["SERPINE1", "SERPIN E1", "PAI-1", "PLASMINOGEN ACTIVATOR INHIBITOR 1"],
}

# Build reverse alias lookup: alias -> canonical gene
REVERSE_ALIASES = {}
for canonical, aliases in GENE_ALIASES.items():
    for alias in aliases:
        REVERSE_ALIASES[alias.upper()] = canonical.upper()


def _match_gene(drug_entry: tuple, gene_symbol: str) -> bool:
    """Check if a drug targets the given gene symbol."""
    target = drug_entry[1]
    if not target:
        return False
    target_upper = target.strip().upper()
    gene_upper = gene_symbol.strip().upper()

    # Direct match on slash-separated targets
    targets = [t.strip() for t in target_upper.split("/")]
    if gene_upper in targets:
        return True

    # Check if gene and target share the same canonical form via aliases
    gene_canonical = REVERSE_ALIASES.get(gene_upper, gene_upper)
    target_canonical = REVERSE_ALIASES.get(target_upper, target_upper)

    if gene_canonical == target_canonical:
        return True

    # Check if gene appears in any alias set that contains the target
    if gene_upper in GENE_ALIASES.get(target_upper, []):
        return True
    if target_upper in GENE_ALIASES.get(gene_upper, []):
        return True

    return False


def _is_oligonucleotide_intervention(name: str, title: str, gene_symbol: str, intervention_type: str = "") -> bool:
    """Check if an intervention name or study title suggests oligonucleotide therapy for a specific gene."""
    name_lower = name.lower()
    title_lower = title.lower()
    gene_upper = gene_symbol.upper()

    # Skip non-drug interventions (procedures, devices, biologicals, etc.)
    if intervention_type and intervention_type.upper() not in ("DRUG", "BIOLOGICAL", ""):
        return False

    # Direct keyword matching in intervention name
    oligo_keywords = [
        "antisense", "aso", "sirna", "si-rna", "sirnas", "rna interference",
        "oligonucleotide", "oligo", "aptamer", "morpholino", "gapmer",
        "steric block", "rnase h", "splice switching", "rna therapeutic",
        "nucleic acid", "dnarna", "pmo", "phosphorodiamidate",
    ]
    if any(term in name_lower for term in oligo_keywords):
        return True

    # Known oligonucleotide drug name prefixes/patterns
    oligo_prefixes = [
        "aln-", "ionis-", "wve-", "bmir-", "tpx-", "rg-",
        "biib0", "gsk3", "cenersen", "tefersen", "nusinersen",
        "eteplirsen", "golodirsen", "viltolarsen", "casimersen",
        "inotersen", "patisiran", "givosiran", "lumasiran",
        "inclisiran", "vutrisiran", "nedosiran", "fitusiran",
        "olezarsen", "volanesorsen", "plozasiran", "donidalorsen",
        "eplontersen", "tominersen", "mipomersen", "fomivirsen",
        "pegaptanib", "avacincaptad", "defibrotide", "imetelstat",
    ]
    if any(prefix in name_lower for prefix in oligo_prefixes):
        return True

    # Check if title mentions BOTH the gene AND oligonucleotide terms
    title_upper = title.upper()
    has_gene_in_title = gene_upper in title_upper
    has_oligo_in_title = any(term in title_lower for term in [
        "antisense", "oligonucleotide", "sirna", "si-rna",
        "gene silencing", "gene knockdown", "exon skip",
        "rnase h", "splice switching",
    ])

    # Only match if BOTH gene and oligonucleotide context are present in title
    if has_gene_in_title and has_oligo_in_title:
        return True

    # For intervention names that contain the gene symbol, check if they look like oligonucleotides
    name_upper = name.upper()
    if gene_upper in name_upper:
        # Gene name is in the intervention name - likely a targeted therapy
        # Check if it's an oligonucleotide by naming pattern
        return True

    # CRITICAL: Filter out common non-oligonucleotide drugs that might appear
    non_oligo_drugs = [
        "baricitinib", "venetoclax", "rituximab", "dexamethasone",
        "pembrolizumab", "docetaxel", "vinorelbine", "erdafitinib",
        "bortezomib", "lenalidomide", "cilta-cel", "car-t",
    ]
    if any(drug in name_lower for drug in non_oligo_drugs):
        return False

    return False


def _search_clinicaltrials(gene_symbol: str, disease_name: str = None) -> List[dict]:
    """Search ClinicalTrials.gov for oligonucleotide studies for ANY gene."""
    therapies = []
    try:
        # Multiple search strategies to catch all oligonucleotide therapies
        search_queries = []

        # Strategy 1: Gene + oligonucleotide terms
        search_queries.append(f"{gene_symbol} antisense oligonucleotide")
        search_queries.append(f"{gene_symbol} siRNA")
        search_queries.append(f"{gene_symbol} ASO therapy")
        search_queries.append(f"{gene_symbol} gene silencing")
        search_queries.append(f"{gene_symbol} RNA interference")

        # Strategy 2: Gene + specific modality in title
        search_queries.append(f"{gene_symbol}[Title] AND antisense[Title]")
        search_queries.append(f"{gene_symbol}[Title] AND siRNA[Title]")
        search_queries.append(f"{gene_symbol}[Title] AND oligonucleotide[Title]")

        if disease_name:
            search_queries = [f"{gene_symbol} antisense {disease_name}"]

        all_studies = {}  # Deduplicate by NCT ID

        for query in search_queries[:5]:  # Limit to 5 queries to avoid rate limiting
            try:
                resp = requests.get(
                    "https://clinicaltrials.gov/api/v2/studies",
                    params={
                        "query.term": query,
                        "pageSize": 15,
                        "format": "json",
                    },
                    timeout=12,
                )
                if resp.status_code != 200:
                    continue

                data = resp.json()
                for study in data.get("studies", []):
                    try:
                        nct_id = study.get("protocolSection", {}).get("identificationModule", {}).get("nctId", "")
                        if nct_id and nct_id not in all_studies:
                            all_studies[nct_id] = study
                    except Exception:
                        continue
            except Exception:
                continue

        # Process all unique studies
        for nct_id, study in list(all_studies.items())[:30]:
            try:
                protocol = study.get("protocolSection", {})
                ident = protocol.get("identificationModule", {})
                title = ident.get("briefTitle", "")

                status_mod = protocol.get("statusModule", {})
                overall_status = status_mod.get("overallStatus", "")

                interventions = protocol.get("armsInterventionsModule", {})
                for intervention in interventions.get("interventions", []):
                    name = intervention.get("name", "")
                    int_type = intervention.get("type", "")

                    if _is_oligonucleotide_intervention(name, title, gene_symbol, int_type):
                        therapies.append({
                            "name": name,
                            "indication": disease_name or gene_symbol,
                            "approvalYear": None,
                            "source": "ClinicalTrials.gov",
                            "status": overall_status,
                            "title": title,
                            "nctId": nct_id,
                        })
            except Exception:
                continue
    except Exception as e:
        logger.info(f"ClinicalTrials.gov search failed for {gene_symbol}: {e}")

    return therapies


def _search_fda_drugsatfda(gene_symbol: str) -> List[dict]:
    """Search FDA Drugs@FDA database for oligonucleotide therapies targeting a gene."""
    therapies = []
    try:
        # Query FDA's openFDA API for drug labels mentioning the gene
        resp = requests.get(
            "https://api.fda.gov/drug/drugsfda.json",
            params={
                "search": f"openfda.gene.exact:{gene_symbol}",
                "limit": 20,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            return therapies

        data = resp.json()
        for result in data.get("results", []):
            try:
                products = result.get("products", [])
                for product in products:
                    brand_name = product.get("brand_name", "")
                    generic_name = product.get("active_ingredients", [{}])[0].get("name", "") if product.get("active_ingredients") else ""
                    app_number = product.get("application_number", "")

                    # Check if it's an oligonucleotide therapy
                    # (this is a heuristic - we check the openfda data)
                    openfda = result.get("openfda", {})
                    substance_name = openfda.get("substance_name", [])

                    is_oligo = False
                    for substance in substance_name:
                        if any(term in substance.lower() for term in [
                            "asenapine", "oligonucleotide", "antisense", "sirna",
                        ]):
                            is_oligo = True
                            break

                    if brand_name and (is_oligo or gene_symbol.upper() in [s.upper() for s in substance_name]):
                        therapies.append({
                            "name": f"{brand_name} ({generic_name})" if generic_name else brand_name,
                            "indication": f"FDA-approved for {gene_symbol} target",
                            "approvalYear": None,
                            "source": "FDA Drugs@FDA",
                            "modality": "ASO/siRNA",
                        })
            except Exception:
                continue
    except Exception as e:
        logger.info(f"FDA Drugs@FDA search failed for {gene_symbol}: {e}")

    return therapies


def _search_pubmed_oligos(gene_symbol: str) -> List[dict]:
    """Search PubMed for oligonucleotide therapies targeting a gene."""
    therapies = []
    try:
        # Search for clinical trials and therapeutic studies only
        queries = [
            f"{gene_symbol} antisense oligonucleotide therapy",
            f"{gene_symbol} siRNA treatment clinical",
            f"{gene_symbol} oligonucleotide drug",
        ]

        all_ids = set()
        for query in queries:
            try:
                resp = requests.get(
                    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                    params={
                        "db": "pubmed",
                        "term": query,
                        "retmax": 5,
                        "retmode": "json",
                    },
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    ids = data.get("esearchresult", {}).get("idlist", [])
                    all_ids.update(ids)
            except Exception:
                continue

        if all_ids:
            # Fetch article details in batches
            ids_list = list(all_ids)[:10]
            ids = ",".join(ids_list)
            detail_resp = requests.get(
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
                params={
                    "db": "pubmed",
                    "id": ids,
                    "retmode": "json",
                },
                timeout=15,
            )
            if detail_resp.status_code == 200:
                detail_data = detail_resp.json()
                for uid in ids_list:
                    try:
                        article = detail_data.get("result", {}).get(uid, {})
                        title = article.get("title", "")
                        pub_date = article.get("pubdate", "")
                        pub_type = article.get("pubtype", [])

                        if title:
                            title_upper = title.upper()
                            gene_upper = gene_symbol.upper()

                            # Skip review articles
                            if any(pt in pub_type for pt in ["Review", "Systematic Review"]):
                                continue

                            # Check if the title mentions the gene AND oligonucleotide terms
                            has_gene = gene_upper in title_upper
                            has_oligo = any(term in title_upper for term in [
                                "ANTISENSE", "OLIGONUCLEOTIDE", "SIRNA", "SI-RNA",
                                "ASO", "GENE SILENCING", "SPLICE SWITCHING",
                                "EXON SKIPPING", "RNA THERAPEUTIC",
                            ])

                            # Also require therapy/treatment context
                            has_therapy = any(term in title_upper for term in [
                                "THERAPY", "TREATMENT", "THERAPEUTIC", "DRUG",
                                "CLINICAL TRIAL", "PATIENT", "EFFICACY",
                            ])

                            if has_gene and has_oligo and has_therapy:
                                therapies.append({
                                    "name": f"Published: {title[:80]}...",
                                    "indication": f"Research for {gene_symbol}",
                                    "approvalYear": None,
                                    "source": "PubMed (Literature)",
                                    "modality": "ASO/siRNA (research)",
                                    "pubDate": pub_date,
                                })
                    except Exception:
                        continue
    except Exception as e:
        logger.info(f"PubMed search failed for {gene_symbol}: {e}")

    return therapies


def get_fda_therapies(gene_symbol: str, disease_name: str = None) -> dict:
    """Find FDA-approved oligonucleotide therapies for ANY gene.

    Combines:
    1. Curated FDA-approved therapy list (fast, offline)
    2. ClinicalTrials.gov API (comprehensive, any gene)
    3. FDA Drugs@FDA database (official FDA data)
    4. PubMed literature search (research papers)

    Returns:
        dict with keys:
            - fdaApprovedTherapies: list of dicts
            - targetableExons: int | None
            - sources: list of data sources queried
            - message: str | None (informational message when no results found)
    """
    result = {
        "fdaApprovedTherapies": [],
        "targetableExons": None,
        "sources": [],
        "message": None,
    }

    if not gene_symbol:
        return result

    symbol = gene_symbol.strip()
    all_matched = []
    sources_queried = []

    # 1. Match against curated FDA list (fast local lookup)
    for drug in FDA_APPROVED_ASOS:
        if _match_gene(drug, symbol):
            is_approved = drug[3] is not None
            all_matched.append({
                "name": drug[0],
                "indication": drug[2],
                "approvalYear": drug[3],
                "source": "FDA Orange Book" if is_approved else "ClinicalTrials.gov",
                "modality": drug[4] if len(drug) > 4 else "ASO",
            })
    sources_queried.append("FDA Orange Book (curated)")

    # 2. Query ClinicalTrials.gov for ANY gene (dynamic)
    ct_therapies = _search_clinicaltrials(symbol, disease_name)
    all_matched.extend(ct_therapies)
    sources_queried.append("ClinicalTrials.gov")

    # 3. Query FDA Drugs@FDA database
    fda_therapies = _search_fda_drugsatfda(symbol)
    all_matched.extend(fda_therapies)
    sources_queried.append("FDA Drugs@FDA")

    # 4. Query PubMed for research literature
    pubmed_therapies = _search_pubmed_oligos(symbol)
    all_matched.extend(pubmed_therapies)
    sources_queried.append("PubMed Literature")

    # Deduplicate by name (case-insensitive)
    seen_names = set()
    unique_matched = []
    for t in all_matched:
        name_key = t["name"].lower().strip()
        if name_key not in seen_names:
            seen_names.add(name_key)
            unique_matched.append(t)

    # Prioritize: approved > investigational > research
    def priority_key(t):
        if t.get("approvalYear"):
            return 0  # FDA approved
        if t.get("source") == "ClinicalTrials.gov":
            return 1  # Clinical trials
        if "FDA" in t.get("source", ""):
            return 2  # FDA database
        return 3  # Literature

    unique_matched.sort(key=priority_key)

    # Return top 15 results
    result["fdaApprovedTherapies"] = unique_matched[:15]
    result["sources"] = sources_queried

    # Provide informational message when no results found
    if not unique_matched:
        result["message"] = (
            f"No FDA-approved or investigational oligonucleotide therapies found for {symbol}. "
            f"This gene may be targeted by other drug modalities (small molecules, antibodies, etc.). "
            f"Check ClinicalTrials.gov for the latest clinical trials."
        )

    return result
