"""Live enrichment and interaction summaries for the target dashboard."""

import re
import time
import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)


def _as_list(value):
    if not value:
        return []
    return value if isinstance(value, list) else [value]


def _first_annotation(values):
    first = _as_list(values)
    if not first:
        return None
    value = first[0]
    return value.get("term") if isinstance(value, dict) else str(value)


def _first_pathway(values):
    first = _as_list(values)
    if not first:
        return None
    value = first[0]
    name = value.get("name") if isinstance(value, dict) else str(value)
    if name:
        name = name.replace(" - Homo sapiens (human)", "").replace(" - Homo sapiens", "").replace(" (human)", "")
    return name


def _first_pathway_id(values):
    first = _as_list(values)
    if not first:
        return None
    value = first[0]
    return value.get("id") if isinstance(value, dict) else None


def _annotation_items(values):
    """Return a normalized list of annotation dicts with id, term, evidence and a link."""
    items = []
    for v in _as_list(values):
        aid = None
        term = None
        evidence = None
        if isinstance(v, dict):
            aid = v.get("id") or v.get("GO") or v.get("accession")
            term = v.get("term") or v.get("name") or None
            evidence = v.get("evidence") or v.get("evidence_code") or None
        else:
            s = str(v)
            m = re.match(r"(GO:\d+)\s*[:;\-]?\s*(.+)", s)
            if m:
                aid = m.group(1)
                term = m.group(2).strip()
            else:
                term = s

        url = f"https://www.ebi.ac.uk/QuickGO/term/{aid}" if aid else None
        items.append({"id": aid, "term": term, "evidence": evidence, "url": url})
    return items


def get_gene_enrichment(ensembl_gene_id: str, taxon_id: int, gene_symbol: Optional[str] = None) -> dict:
    """Fetch GO, pathway and STRING counts without fabricating unavailable data."""
    result = {
        "keggCount": None,
        "reactomeCount": None,
        "keggPathwayName": None,
        "reactomePathwayName": None,
        "keggPathwayId": None,
        "reactomePathwayId": None,
        "pathwayCommonsCount": None,
        "goBiologicalProcess": None,
        "goMolecularFunction": None,
        "goCellularComponent": None,
        "geneFunction": None,
        "entrezGeneId": None,
        "pathwayHighlight": None,
        "goBiologicalProcessHighlight": None,
        "goMolecularFunctionHighlight": None,
        "goCellularComponentHighlight": None,
        "stringHighConfidenceCount": None,
        "mediumConfidenceCount": None,
        "totalInteractors": None,
        "experimentalCount": None,
        "databaseCount": None,
        "interactionNetworkDensity": None,
    }

    try:
        response = requests.get(
            "https://mygene.info/v3/query",
            params={
                "q": f"ensembl.gene:{ensembl_gene_id}",
                "fields": "summary,go,pathway.kegg,pathway.reactome",
                "species": taxon_id,
                "size": 1,
            },
            timeout=5,
        )
        hits = (response.json() if response.ok else {}).get("hits") or []
        hit = hits[0] if hits else {}
        go = hit.get("go") or {}
        pathway = hit.get("pathway") or {}
        result["geneFunction"] = hit.get("summary") or None
        result["entrezGeneId"] = str(hit.get("entrezgene") or hit.get("_id")) if hit else None

        result["keggCount"] = len(_as_list(pathway.get("kegg")))
        result["reactomeCount"] = len(_as_list(pathway.get("reactome")))
        result["keggPathwayName"] = _first_pathway(pathway.get("kegg"))
        result["reactomePathwayName"] = _first_pathway(pathway.get("reactome"))
        result["keggPathwayId"] = _first_pathway_id(pathway.get("kegg"))
        result["reactomePathwayId"] = _first_pathway_id(pathway.get("reactome"))
        result["goBiologicalProcess"] = len(_as_list(go.get("BP")))
        result["goMolecularFunction"] = len(_as_list(go.get("MF")))
        result["goCellularComponent"] = len(_as_list(go.get("CC")))
        result["pathwayHighlight"] = result["keggPathwayName"] or result["reactomePathwayName"]
        result["goBiologicalProcessHighlight"] = _first_annotation(go.get("BP"))
        result["goMolecularFunctionHighlight"] = _first_annotation(go.get("MF"))
        result["goCellularComponentHighlight"] = _first_annotation(go.get("CC"))
        # Provide richer GO annotation lists for frontend display
        result["goBiologicalProcessAnnotations"] = _annotation_items(go.get("BP"))
        result["goMolecularFunctionAnnotations"] = _annotation_items(go.get("MF"))
        result["goCellularComponentAnnotations"] = _annotation_items(go.get("CC"))
    except (requests.RequestException, ValueError):
        pass

    # Pathway Commons (via gene symbol)
    if gene_symbol:
        try:
            pc_response = requests.get(
                "https://www.pathwaycommons.org/pc2/search",
                params={"q": gene_symbol, "format": "json", "type": "pathway"},
                timeout=2,
            )
            if pc_response.ok:
                pc_data = pc_response.json()
                hits = pc_data.get("searchHit", [])
                unique_pathways = set()
                for hit in hits:
                    pw = hit.get("pathway")
                    if isinstance(pw, dict):
                        uri = pw.get("uri") or pw.get("name")
                        if uri:
                            unique_pathways.add(uri)
                result["pathwayCommonsCount"] = len(unique_pathways) if unique_pathways else len(hits)
        except (requests.RequestException, ValueError):
            pass

    try:
        response = requests.get(
            "https://string-db.org/api/json/network",
            params={"identifiers": ensembl_gene_id, "species": taxon_id, "required_score": 0},
            timeout=8,
        )
        interactions = response.json() if response.ok else []
        if isinstance(interactions, list):
            partners = set()
            high_confidence = 0
            medium_confidence = 0
            experimental_count = 0
            database_count = 0
            edge_count = 0
            scored_partners = []
            
            for interaction in interactions:
                score = float(interaction.get("score") or 0)
                if score > 0:
                    edge_count += 1
                
                # Count by confidence level
                if score >= 0.7:
                    high_confidence += 1
                elif score >= 0.4:
                    medium_confidence += 1
                
                # Count by evidence type
                if interaction.get("experiments") and int(interaction.get("experiments", 0)) > 0:
                    experimental_count += 1
                if interaction.get("database") and int(interaction.get("database", 0)) > 0:
                    database_count += 1
                
                # Track unique partners
                for name_key in ("preferredName_A", "preferredName_B"):
                    name = interaction.get(name_key)
                    if name and name.upper() != ensembl_gene_id.upper():
                        partners.add(name)
                        scored_partners.append((name, score))
            
            result["stringHighConfidenceCount"] = high_confidence
            result["mediumConfidenceCount"] = medium_confidence
            result["totalInteractors"] = len(partners)
            result["experimentalCount"] = experimental_count
            result["databaseCount"] = database_count
            
            n_nodes = len(partners) + 1
            if n_nodes > 1 and edge_count > 0:
                density = (2 * edge_count) / (n_nodes * (n_nodes - 1))
                if density > 0.5:
                    result["interactionNetworkDensity"] = f"{density:.2f} (Dense)"
                elif density > 0.1:
                    result["interactionNetworkDensity"] = f"{density:.2f} (Moderate)"
                else:
                    result["interactionNetworkDensity"] = f"{density:.2f} (Sparse)"
            
            # Top 5 interactors by score
            scored_partners.sort(key=lambda x: x[1], reverse=True)
            seen = set()
            top_partners = []
            for name, score in scored_partners:
                if name not in seen:
                    seen.add(name)
                    top_partners.append({"name": name, "score": round(score, 2)})
                if len(top_partners) >= 5:
                    break
            result["topInteractors"] = top_partners
    except (requests.RequestException, ValueError, TypeError):
        pass

    return result


ENSEMBL_REST = "https://rest.ensembl.org"


def _ensembl_get(url, timeout=10, retries=3):
    headers = {"Content-Type": "application/json"}
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, headers=headers, timeout=timeout)
            if response.status_code == 404:
                return response
            if response.ok:
                return response
            if response.status_code >= 500:
                last_exc = RuntimeError(f"HTTP {response.status_code}")
                wait = 1.5 * (2 ** (attempt - 1))
                logger.info("Ensembl %d (attempt %d/%d), retrying in %.1fs", response.status_code, attempt, retries, wait)
                time.sleep(wait)
                continue
            return response
        except requests.RequestException as exc:
            last_exc = exc
            if attempt < retries:
                wait = 1.5 * (2 ** (attempt - 1))
                logger.info("Ensembl request failed (attempt %d/%d), retrying in %.1fs: %s", attempt, retries, wait, exc)
                time.sleep(wait)
    raise last_exc or RuntimeError("Ensembl unavailable")


def _compute_codon_usage_bias(cds_seq: str) -> Optional[str]:
    if not cds_seq:
        return None
    seq = cds_seq.upper().replace("T", "U")
    gc3 = 0
    total = 0
    for i in range(0, len(seq) - 2, 3):
        codon = seq[i : i + 3]
        if len(codon) == 3:
            total += 1
            if codon[2] in ("G", "C"):
                gc3 += 1
    if total == 0:
        return None
    gc3_pct = round((gc3 / total) * 100, 1)
    if gc3_pct > 65:
        return f"GC3={gc3_pct}% (High, GC-rich)"
    elif gc3_pct > 35:
        return f"GC3={gc3_pct}% (Balanced)"
    else:
        return f"GC3={gc3_pct}% (Low, AT-rich)"


def _compute_aso_metrics_from_sequence(seq: str, result: dict) -> None:
    if not seq:
        return
    seq = seq.upper()
    seq_len = len(seq)

    result["codonUsageBias"] = _compute_codon_usage_bias(seq)

    gc_count = seq.count("G") + seq.count("C")
    gc_content = (gc_count / seq_len) * 100 if seq_len > 0 else 50
    accessibility = max(0, min(100, 100 - gc_content + 20))
    if accessibility >= 60:
        result["structuralAccessibility"] = f"{accessibility:.0f}% (Favorable)"
    elif accessibility >= 45:
        result["structuralAccessibility"] = f"{accessibility:.0f}% (Moderate)"
    else:
        result["structuralAccessibility"] = f"{accessibility:.0f}% (Challenging)"

    ese_patterns = re.compile(r"(CUG|GAA|GAC|UGC|AGG)")
    ess_patterns = re.compile(r"(UCUU|CUAG|UUAG|CUCU|UGCA)")
    ese_count = len(ese_patterns.findall(seq))
    ess_count = len(ess_patterns.findall(seq))
    total_motifs = ese_count + ess_count
    motif_density = (total_motifs / seq_len) * 1000 if seq_len > 0 else 0
    if motif_density > 50:
        result["splicingMotifDensity"] = f"{motif_density:.1f}/kb (High)"
    elif motif_density > 25:
        result["splicingMotifDensity"] = f"{motif_density:.1f}/kb (Moderate)"
    else:
        result["splicingMotifDensity"] = f"{motif_density:.1f}/kb (Low)"

    g4_pattern = re.compile(r"(G{3}[\w]{1,7}){3}G{3}")
    g4_matches = g4_pattern.findall(seq)
    g4_count = len(g4_matches)
    if g4_count == 0:
        result["gQuadruplexes"] = "0 Blocks Found"
    elif g4_count <= 2:
        result["gQuadruplexes"] = f"{g4_count} Block{'s' if g4_count > 1 else ''} Found"
    else:
        result["gQuadruplexes"] = f"{g4_count} Blocks Found"

    cpg_count = seq.count("CG")
    cpg_density = (cpg_count / seq_len) * 1000
    if cpg_density > 25:
        result["cpgDensity"] = "High Risk"
    elif cpg_density > 10:
        result["cpgDensity"] = "Medium Risk"
    else:
        result["cpgDensity"] = "Low Risk"

    comp_map = {"A": "T", "T": "A", "G": "C", "C": "G"}
    palindrome_count = 0
    for k in [4, 5, 6]:
        for i in range(seq_len - k + 1):
            sub = seq[i : i + k]
            rc = "".join(comp_map.get(b, "N") for b in reversed(sub))
            if sub == rc:
                palindrome_count += 1
    palindrome_density = palindrome_count / seq_len * 1000 if seq_len > 0 else 0
    if palindrome_density > 15:
        result["selfDimerRisk"] = f"{palindrome_density:.0f}/kb (High)"
    elif palindrome_density > 8:
        result["selfDimerRisk"] = f"{palindrome_density:.0f}/kb (Moderate)"
    else:
        result["selfDimerRisk"] = f"{palindrome_density:.0f}/kb (Low)"

    polyg_pattern = re.compile(r"G{4,}")
    polyg_count = len(polyg_pattern.findall(seq))
    if polyg_count == 0:
        result["polygTracts"] = "0 (Rare)"
    elif polyg_count <= 3:
        result["polygTracts"] = f"{polyg_count} (Moderate)"
    else:
        result["polygTracts"] = f"{polyg_count} (High Risk)"


def _fetch_ncbi_cds_sequence(ncbi_gene_id: str, taxon_id: int):
    # Try 1: search for RefSeq mRNA and fetch CDS (eukaryotes with separate mRNA records)
    try:
        search_url = (
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            f"?db=nuccore"
            f"&term={ncbi_gene_id}[gene]+AND+txid{taxon_id}[Organism:noexp]+AND+srcdb_refseq[PROP]+AND+biomol_mrna[PROP]"
            f"&retmax=3&retmode=json"
        )
        resp = requests.get(search_url, timeout=10)
        if resp.ok:
            data = resp.json()
            ids = data.get("esearchresult", {}).get("idlist", [])
            if ids:
                fetch_url = (
                    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                    f"?db=nuccore&id={ids[0]}&rettype=fasta_cds_na&retmode=text"
                )
                fasta_resp = requests.get(fetch_url, timeout=15)
                if fasta_resp.ok:
                    fasta_text = fasta_resp.text.strip()
                    if fasta_text:
                        lines = fasta_text.split("\n")
                        seq = "".join(line.strip() for line in lines if not line.startswith(">"))
                        if seq:
                            return seq
    except requests.RequestException:
        pass

    # Try 2: fetch genomic region as CDS proxy (for bacteria/archaea without introns)
    try:
        esummary_url = (
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
            f"?db=gene&id={ncbi_gene_id}&retmode=json"
        )
        resp = requests.get(esummary_url, timeout=10)
        if resp.ok:
            data = resp.json()
            result = data.get("result", {}).get(ncbi_gene_id, {})
            genomic_info = result.get("genomicinfo", [])
            if genomic_info:
                gi = genomic_info[0]
                chraccver = gi.get("chraccver", "")
                chrstart = gi.get("chrstart")
                chrstop = gi.get("chrstop")
                if chraccver and chrstart is not None and chrstop is not None:
                    seq_start = min(chrstart, chrstop)
                    seq_stop = max(chrstart, chrstop)
                    strand = 1 if chrstart <= chrstop else 2
                    seq_url = (
                        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                        f"?db=nuccore&id={chraccver}"
                        f"&seq_start={seq_start}&seq_stop={seq_stop}"
                        f"&strand={strand}&rettype=fasta_na&retmode=text"
                    )
                    seq_resp = requests.get(seq_url, timeout=15)
                    if seq_resp.ok:
                        fasta_text = seq_resp.text.strip()
                        if fasta_text:
                            lines = fasta_text.split("\n")
                            seq = "".join(line.strip() for line in lines if not line.startswith(">"))
                            if seq:
                                return seq
    except requests.RequestException:
        pass

    return None


def get_aso_analysis(ensembl_gene_id: str, taxon_id: int) -> dict:
    """Compute ASO-relevant metrics: active isoforms, splice switches, accessibility, motifs, conservation."""
    result = {
        "activeIsoforms": None,
        "spliceSwitches": None,
        "structuralAccessibility": None,
        "splicingMotifDensity": None,
        "preclinicalConservation": None,
        "gQuadruplexes": None,
        "cpgDensity": None,
        "selfDimerRisk": None,
        "polygTracts": None,
        "transcriptSpecificity": None,
        "codonUsageBias": None,
        "cdsSequence": None,
    }

    cds_seq = None

    # Fetch transcript data from Ensembl (expand=1 required to get Transcript list)
    try:
        resp = _ensembl_get(f"{ENSEMBL_REST}/lookup/id/{ensembl_gene_id}?expand=1", timeout=10)
        if resp.ok:
            data = resp.json()
            transcripts = data.get("Transcript", [])

            coding = [t for t in transcripts if t.get("biotype") == "protein_coding"]
            result["activeIsoforms"] = len(coding) if coding else (len(transcripts) or None)

            if len(transcripts) > 1:
                exon_sets = set()
                for t in transcripts:
                    exons = t.get("Exon", [])
                    exon_sets.add(len(exons))
                result["spliceSwitches"] = max(0, len(exon_sets) - 1)

            n_coding = len(coding) if coding else 0
            if n_coding > 0:
                if n_coding <= 2:
                    result["transcriptSpecificity"] = f"{n_coding} isoforms (High)"
                elif n_coding <= 5:
                    result["transcriptSpecificity"] = f"{n_coding} isoforms (Moderate)"
                else:
                    result["transcriptSpecificity"] = f"{n_coding} isoforms (Low)"
    except Exception:
        pass

    # Fetch CDS sequence from Ensembl
    try:
        resp = _ensembl_get(f"{ENSEMBL_REST}/lookup/id/{ensembl_gene_id}")
        if resp.ok:
            gene_data = resp.json()
            transcript_id = gene_data.get("canonical_transcript", "")
            if transcript_id:
                tid = transcript_id.strip('.')
                parts = tid.rsplit('.', 1)
                transcript_base = parts[0] if len(parts) > 1 and parts[1].isdigit() else tid
                seq_resp = _ensembl_get(f"{ENSEMBL_REST}/sequence/id/{transcript_base}?type=cds")
                if seq_resp.ok:
                    seq_data = seq_resp.json()
                    cds_seq = seq_data.get("seq", "").upper()
    except Exception:
        pass

    # Fallback: try NCBI for genes originating from NCBI Gene API (rat, plants, bacteria)
    if not cds_seq and str(ensembl_gene_id).startswith("NCBI:"):
        ncbi_id = ensembl_gene_id.split(":")[1]
        cds_seq = _fetch_ncbi_cds_sequence(ncbi_id, taxon_id)
        if cds_seq:
            if result["activeIsoforms"] is None:
                result["activeIsoforms"] = 1
            if result["transcriptSpecificity"] is None:
                result["transcriptSpecificity"] = "1 isoform (High)"

    if cds_seq:
        result["cdsSequence"] = cds_seq
        _compute_aso_metrics_from_sequence(cds_seq, result)

    # Preclinical Conservation: check orthologs in model organisms (human gene only).
    # Uses homo_sapiens as source, so only valid for human genes.
    if taxon_id == 9606:
        try:
            comp_resp = _ensembl_get(
                f"{ENSEMBL_REST}/homology/id/homo_sapiens/{ensembl_gene_id}"
                f"?type=orthologues;target_taxon=10090;target_taxon=10116;target_taxon=9541"
            )
            if comp_resp.ok:
                comp_data = comp_resp.json()
                homologies = comp_data.get("data", [])
                if homologies:
                    target_species = {"mus_musculus", "rattus_norvegicus", "macaca_fascicularis"}
                    conserved_species = set()
                    for homology_group in homologies:
                        for homolog in homology_group.get("homologies", []):
                            species = homolog.get("target", {}).get("species", "")
                            if species in target_species:
                                identity = float(homolog.get("target", {}).get("perc_id", 0))
                                if identity >= 80:
                                    conserved_species.add(species)
                    total_target = len(target_species)
                    conserved_count = len(conserved_species)
                    if conserved_count == total_target:
                        result["preclinicalConservation"] = f"{conserved_count}/{total_target} (Excellent)"
                    elif conserved_count >= 2:
                        result["preclinicalConservation"] = f"{conserved_count}/{total_target} (Good)"
                    elif conserved_count == 1:
                        result["preclinicalConservation"] = f"{conserved_count}/{total_target} (Limited)"
                    else:
                        result["preclinicalConservation"] = f"0/{total_target} (Poor)"
        except Exception:
            pass

    return result
