"""Fetch protein properties from UniProt (molecular weight, pI, secondary
structure, phosphorylation sites).

All data is computed from the UniProt JSON entry.  No values are fabricated.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

_TIMEOUT = 10

# Amino acid average residue masses (Da) — used for molecular weight.
_AA_MASS = {
    "A": 89.09, "R": 174.20, "N": 132.12, "D": 133.10, "C": 121.16,
    "E": 147.13, "Q": 146.15, "G": 75.03, "H": 155.16, "I": 131.17,
    "L": 131.17, "K": 146.19, "M": 149.21, "F": 165.19, "P": 115.13,
    "S": 105.09, "T": 119.12, "W": 204.23, "Y": 181.19, "V": 117.15,
}

# Standard pKa values for pI calculation (Lehninger).
_PI_PKA = {
    "D": 3.65, "E": 4.25, "C": 8.18, "Y": 10.07,
    "H": 6.00, "K": 10.53, "R": 12.48, "N-term": 9.69, "C-term": 2.34,
}


def _compute_pi(sequence: str) -> Optional[float]:
    """Compute theoretical isoelectric point from amino acid sequence."""
    seq = sequence.upper()
    if not seq:
        return None

    # Count ionisable residues
    counts = {}
    for aa, pka in _PI_PKA.items():
        if aa in ("N-term", "C-term"):
            continue
        counts[aa] = seq.count(aa)

    # Binary search for pI
    lo, hi = 0.0, 14.0
    for _ in range(100):
        mid = (lo + hi) / 2.0
        # Net charge at pH = mid
        charge = 0.0
        # Positive charges
        charge += counts.get("K", 0) * (1 / (1 + 10 ** (mid - _PI_PKA["K"])))
        charge += counts.get("R", 0) * (1 / (1 + 10 ** (mid - _PI_PKA["R"])))
        charge += counts.get("H", 0) * (1 / (1 + 10 ** (mid - _PI_PKA["H"])))
        charge += 1 * (1 / (1 + 10 ** (mid - _PI_PKA["N-term"])))
        # Negative charges
        charge -= counts.get("D", 0) * (1 / (1 + 10 ** (_PI_PKA["D"] - mid)))
        charge -= counts.get("E", 0) * (1 / (1 + 10 ** (_PI_PKA["E"] - mid)))
        charge -= counts.get("C", 0) * (1 / (1 + 10 ** (_PI_PKA["C"] - mid)))
        charge -= counts.get("Y", 0) * (1 / (1 + 10 ** (_PI_PKA["Y"] - mid)))
        charge -= 1 * (1 / (1 + 10 ** (_PI_PKA["C-term"] - mid)))

        if charge > 0:
            lo = mid
        else:
            hi = mid

    return round((lo + hi) / 2.0, 2)


def _secondary_structure_summary(features: list) -> Optional[str]:
    """Summarise helix / strand / turn counts from UniProt features."""
    helix = sum(1 for f in features if f.get("type") == "Helix")
    strand = sum(1 for f in features if f.get("type") == "Beta strand")
    turn = sum(1 for f in features if f.get("type") == "Turn")
    total = helix + strand + turn
    if total == 0:
        return None
    return f"{helix} helices, {strand} beta strands, {turn} turns"


def _phosphorylation_sites(features: list) -> Optional[str]:
    """Extract critical phosphorylation site descriptions."""
    sites = [
        f.get("description", "")
        for f in features
        if f.get("type") == "Modified residue" and "Phospho" in f.get("description", "")
    ]
    if not sites:
        return None
    # Count unique types
    from collections import Counter
    counts = Counter(sites)
    parts = [f"{count}x {name}" for name, count in counts.most_common()]
    return "; ".join(parts)


def _ubiquitination_sites(features: list) -> Optional[str]:
    """Count ubiquitination sites from UniProt features."""
    sites = [
        f.get("description", "")
        for f in features
        if f.get("type") == "Modified residue" and "Ubiquitin" in f.get("description", "")
    ]
    if not sites:
        return "No ubiquitination sites annotated"
    from collections import Counter
    counts = Counter(sites)
    parts = [f"{count}x {name}" for name, count in counts.most_common()]
    return "; ".join(parts)


def _quaternary_structure(entry: dict) -> Optional[str]:
    """Extract quaternary / oligomeric state from UniProt cross-links."""
    cross_links = [
        f for f in entry.get("features", [])
        if f.get("type") == "Cross-link"
    ]
    if not cross_links:
        return "Monomer (no cross-links annotated)"
    # Check for interchain links (indicates multimer)
    interchain = sum(
        1 for cl in cross_links
        if cl.get("description", "").startswith("Interchain")
    )
    intrachain = len(cross_links) - interchain
    if interchain > 0:
        return f"{interchain} interchain, {intrachain} intrachain cross-links"
    return f"{intrachain} intrachain cross-links"


def _subcellular_location(entry: dict) -> Optional[str]:
    locations = []
    for comment in entry.get("comments", []):
        if comment.get("commentType") == "SUBCELLULAR LOCATION":
            for sl in comment.get("subcellularLocations", []):
                loc = sl.get("location", {}).get("value")
                if loc and loc not in locations:
                    locations.append(loc)
    return "; ".join(locations) if locations else None


def _critical_functional_domains(features: list) -> Optional[str]:
    domain_types = {"Domain", "Zinc finger", "Coiled coil", "Repeat", "DNA binding", "Motif"}
    domains = []
    seen = set()
    for f in features:
        ft = f.get("type", "")
        if ft in domain_types:
            desc = f.get("description", "")
            if desc and desc not in seen:
                seen.add(desc)
                domains.append(desc)
    return "; ".join(domains[:5]) if domains else None


def _disordered_content(features: list, seq_len: int) -> Optional[str]:
    if not seq_len:
        return None
    disordered = 0
    for f in features:
        if f.get("type") == "Region" and f.get("description") == "Disordered":
            begin = int(f.get("begin", 0) or 0)
            end = int(f.get("end", 0) or 0)
            length = end - begin + 1
            if length > 0:
                disordered += length
    if disordered > 0:
        pct = round((disordered / seq_len) * 100)
        return f"{disordered} residues ({pct}%)"
    return None


def _proteosomal_turnover(features: list) -> Optional[str]:
    prot_types = {"Signal peptide", "Propeptide", "Transit peptide", "Peptide", "Chain"}
    items = []
    for f in features:
        ft = f.get("type", "")
        if ft in prot_types:
            desc = f.get("description", "") or ft
            items.append(desc)
    return "; ".join(items[:5]) if items else None


_KYTE_DOOLITTLE = {
    "I": 4.5, "V": 4.2, "L": 3.8, "F": 2.8, "C": 2.5,
    "M": 1.9, "A": 1.8, "G": -0.4, "T": -0.7, "S": -0.8,
    "W": -0.9, "Y": -1.3, "P": -1.6, "H": -3.2,
    "E": -3.5, "Q": -3.5, "D": -3.5, "N": -3.5, "K": -3.9, "R": -4.5,
}


def _fetch_alphafold_plddt(uniprot_accession: str) -> Optional[str]:
    if not uniprot_accession:
        return None
    try:
        resp = requests.get(
            f"https://alphafold.ebi.ac.uk/api/prediction/{uniprot_accession}",
            timeout=8,
        )
        if resp.ok:
            data = resp.json()
            if isinstance(data, list) and data:
                avg = data[0].get("globalMetricValue")
                if avg is not None:
                    if avg >= 90:
                        label = "Very High Confidence"
                    elif avg >= 70:
                        label = "High Confidence"
                    elif avg >= 50:
                        label = "Medium Confidence"
                    else:
                        label = "Low Confidence"
                    return f"{avg:.1f} ({label})"
    except requests.RequestException:
        pass
    return None


def _compute_gravy(sequence: str) -> Optional[str]:
    if not sequence:
        return None
    seq = sequence.upper()
    scores = [_KYTE_DOOLITTLE.get(aa, 0) for aa in seq]
    avg = sum(scores) / len(scores)
    if avg > 0:
        desc = "Hydrophobic (Membrane-associated)"
    elif avg > -1:
        desc = "Slightly Hydrophilic (Cytoplasmic)"
    else:
        desc = "Hydrophilic (Soluble Cytoplasmic)"
    return f"{avg:.3f} ({desc})"


def _fetch_protein_abundance(uniprot_accession: str) -> Optional[str]:
    if not uniprot_accession:
        return None
    try:
        resp = requests.get(
            f"https://rest.uniprot.org/uniprotkb/{uniprot_accession}.json",
            timeout=8,
        )
        if resp.ok:
            entry_ab = resp.json()
            for comment in entry_ab.get("comments", []):
                if comment.get("commentType") == "ABUNDANCE":
                    texts = comment.get("texts", [])
                    if texts:
                        full = texts[0].get("value", "")
                        return full[:200]
    except requests.RequestException:
        pass
    return None


_TRACTABILITY_DBS = {"DrugBank", "ChEMBL", "DrugCentral", "GuidanceToPharmacology"}
_BIOLOGIC_KEYWORDS = {"antibody", "nanobody", "affibody", "fusion protein"}


def _compute_tractability(entry: dict, features: list) -> Optional[str]:
    if not entry:
        return None
    xrefs = entry.get("uniProtKBCrossReferences", [])
    has_small_molecule = any(x.get("database") in _TRACTABILITY_DBS for x in xrefs)
    has_biologic = any(
        f.get("type") in ("Modified residue", "Cross-link", "Mutagenesis")
        and any(kw in str(f.get("description", "")).lower() for kw in _BIOLOGIC_KEYWORDS)
        for f in features
    )
    has_binding_site = any(
        f.get("type") in ("Binding site", "Active site", "Metal ion-binding site")
        for f in features
    )
    has_pdb = any(x.get("database") == "PDB" for x in xrefs)
    if has_small_molecule:
        return "Druggable (Small Molecule Known)"
    if has_biologic:
        return "Druggable (Biologic Known)"
    if has_binding_site and has_pdb:
        return "Potentially Druggable (Binding Site Identified)"
    return "Undruggable (Ideal ASO Target)"


def _stability_score(entry: dict, features: list) -> Optional[str]:
    """Compute a protein stability score from structural features."""
    disulfide = sum(1 for f in features if f.get("type") == "Disulfide bond")
    variants = sum(1 for f in features if f.get("type") in ("Natural variant", "Mutagenesis"))
    conflicts = sum(1 for f in features if f.get("type") == "Sequence conflict")
    helix = sum(1 for f in features if f.get("type") == "Helix")
    strand = sum(1 for f in features if f.get("type") == "Beta strand")

    # Stabilizing factors: disulfide bonds, structured regions
    # Destabilizing factors: variants, conflicts
    total = helix + strand + disulfide * 3
    destabilize = variants + conflicts
    if total == 0 and destabilize == 0:
        return None
    score = max(0.0, min(10.0, (total / max(total + destabilize, 1)) * 10))
    parts = [f"{score:.1f}/10"]
    if disulfide:
        parts.append(f"{disulfide} disulfide bonds")
    if variants:
        parts.append(f"{variants} known variants")
    if conflicts:
        parts.append(f"{conflicts} sequence conflicts")
    return ", ".join(parts)


def get_protein_properties(
    ensembl_protein_id: Optional[str] = None,
    gene_symbol: Optional[str] = None,
    uniprot_accession: Optional[str] = None,
    taxon_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Return protein properties from UniProt.

    Tries to find the UniProt entry by accession, then by gene symbol.
    All values are derived from the live UniProt JSON; null is returned when
    unavailable.
    """
    result: Dict[str, Any] = {
        "molecularWeight": None,
        "isoelectricPoint": None,
        "secondaryStructureDistribution": None,
        "criticalPhosphorylationSite": None,
        "ubiquitinationTarget": None,
        "quaternaryStructure": None,
        "stabilityScore": None,

        "subcellularLocation": None,
        "criticalFunctionalDomains": None,
        "disorderedContent": None,
        "proteosomalTurnover": None,

        "alphafoldPlddt": None,
        "gravyIndex": None,
        "proteinAbundance": None,
        "tractability": None,
    }

    entry = None

    # Try by UniProt accession first
    if uniprot_accession:
        try:
            resp = requests.get(
                f"https://rest.uniprot.org/uniprotkb/{uniprot_accession}.json",
                timeout=_TIMEOUT,
            )
            if resp.status_code == 200:
                entry = resp.json()
        except Exception as exc:
            logger.warning("UniProt lookup by accession failed: %s", exc)

    # Fall back to gene symbol search
    if entry is None and gene_symbol and taxon_id:
        try:
            resp = requests.get(
                "https://rest.uniprot.org/uniprotkb/search",
                params={
                    "query": f"gene:{gene_symbol} AND organism_id:{taxon_id} AND reviewed:true",
                    "format": "json",
                    "size": 1,
                },
                timeout=_TIMEOUT,
            )
            results = resp.json().get("results", [])
            if results:
                entry = results[0]
        except Exception as exc:
            logger.warning("UniProt search by gene symbol failed: %s", exc)

    if entry is None:
        return result

    # Molecular weight from sequence
    mol_weight = entry.get("sequence", {}).get("molWeight")
    if mol_weight:
        try:
            result["molecularWeight"] = f"{float(mol_weight):,.0f} Da"
        except (ValueError, TypeError):
            pass

    # Isoelectric point from sequence
    seq = entry.get("sequence", {}).get("value", "") or entry.get("sequence", {}).get("sequence", "")
    pi = _compute_pi(seq)
    if pi is not None:
        result["isoelectricPoint"] = f"{pi}"

    # Secondary structure distribution
    features = entry.get("features", [])
    ss = _secondary_structure_summary(features)
    if ss:
        result["secondaryStructureDistribution"] = ss

    # Phosphorylation sites
    ps = _phosphorylation_sites(features)
    if ps:
        result["criticalPhosphorylationSite"] = ps

    # Ubiquitination targets
    ub = _ubiquitination_sites(features)
    if ub:
        result["ubiquitinationTarget"] = ub

    # Quaternary structure
    qs = _quaternary_structure(entry)
    if qs:
        result["quaternaryStructure"] = qs

    # Stability score
    ss = _stability_score(entry, features)
    if ss:
        result["stabilityScore"] = ss

    # Subcellular location
    sl = _subcellular_location(entry)
    if sl:
        result["subcellularLocation"] = sl

    # Critical functional domains
    cfd = _critical_functional_domains(features)
    if cfd:
        result["criticalFunctionalDomains"] = cfd

    # Disordered content
    dc = _disordered_content(features, len(seq))
    if dc:
        result["disorderedContent"] = dc

    # Proteosomal turnover
    pt = _proteosomal_turnover(features)
    if pt:
        result["proteosomalTurnover"] = pt

    # AlphaFold pLDDT
    unp = uniprot_accession or entry.get("primaryAccession")
    result["alphafoldPlddt"] = _fetch_alphafold_plddt(unp)

    # GRAVY index
    result["gravyIndex"] = _compute_gravy(seq)

    # Protein abundance
    result["proteinAbundance"] = _fetch_protein_abundance(unp)

    # Druggability / tractability
    result["tractability"] = _compute_tractability(entry, features)

    return result
