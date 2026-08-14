"""Protein database IDs from UniProt REST API and NCBI Gene."""

import requests
from typing import Dict, Optional


def get_protein_db_ids(uniprot_id: Optional[str] = None, gene_symbol: Optional[str] = None, entrez_id: Optional[str] = None, taxon_id: Optional[int] = None) -> Dict:
    """Fetch InterPro, Pfam, PDB, and UniProt accession from public APIs."""
    result = {
        "interproId": None,
        "pfamId": None,
        "pdbId": None,
        "uniprotAccession": None,
    }

    # Always search by gene symbol to get a proper UniProt accession
    if gene_symbol and taxon_id:
        try:
            resp = requests.get(
                "https://rest.uniprot.org/uniprotkb/search",
                params={
                    "query": f"gene:{gene_symbol} AND organism_id:{taxon_id} AND reviewed:true",
                    "format": "json",
                    "size": 1,
                },
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    result["uniprotAccession"] = results[0].get("primaryAccession")
        except Exception:
            pass

    # Use provided UniProt ID if search didn't find one
    if not result["uniprotAccession"] and uniprot_id:
        if uniprot_id and not uniprot_id.startswith("ENSP"):
            result["uniprotAccession"] = uniprot_id

    accession = result["uniprotAccession"]
    if accession:
        try:
            resp = requests.get(
                f"https://rest.uniprot.org/uniprotkb/{accession}.json",
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                for ref in data.get("uniProtKBCrossReferences", []):
                    db = ref.get("database", "")
                    if db == "InterPro" and not result["interproId"]:
                        result["interproId"] = ref.get("id")
                    elif db == "Pfam" and not result["pfamId"]:
                        result["pfamId"] = ref.get("id")
                    elif db == "PDB" and not result["pdbId"]:
                        result["pdbId"] = ref.get("id")
        except Exception:
            pass

    return result
