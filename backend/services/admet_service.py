"""ADMET prediction for RNA therapeutics (ASO, siRNA, aptamer).

Predicts Absorption, Distribution, Metabolism, Excretion, and Toxicity
properties based on sequence heuristics, target gene context, and known
RNA therapeutic design principles.

Sources:
- Sequence-based heuristics (GC content, length, modifications, motifs)
- Target expression profile (tissue distribution, protein abundance)
- gnomAD constraint (essentiality affects therapeutic window)
- UniProt properties (subcellular location, stability)
"""

import logging
import math
import re
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


def _classify_score(value: float, low_thresh: float, high_thresh: float) -> str:
    if value >= high_thresh:
        return "High"
    elif value >= low_thresh:
        return "Moderate"
    else:
        return "Low"


def _compute_gc_content(seq: str) -> float:
    if not seq:
        return 0.0
    seq = seq.upper()
    gc = seq.count("G") + seq.count("C")
    return round((gc / len(seq)) * 100, 1) if seq else 0.0




def _compute_sequence_descriptors(seq: str) -> Dict[str, Any]:
    """Compute physicochemical descriptors from RNA sequence."""
    if not seq:
        return {}
    seq = seq.upper()
    length = len(seq)
    gc = _compute_gc_content(seq)
    g_count = seq.count("G")
    c_count = seq.count("C")
    a_count = seq.count("A")
    u_count = seq.count("U")
    gc_skew = (g_count - c_count) / length if length else 0
    purines = g_count + a_count
    pyrimidines = c_count + u_count
    
    # Wallace rule melting temperature approximation
    tm = 2 * (a_count + u_count) + 4 * (g_count + c_count)
    
    # Motif counts
    cpg = len(re.findall(r"CG", seq))
    polyg = len(re.findall(r"G{4,}", seq))
    polyu = len(re.findall(r"U{4,}", seq))
    
    # Shannon entropy
    from collections import Counter
    counts = Counter(seq)
    entropy = 0.0
    for base, cnt in counts.items():
        p = cnt / length
        if p > 0:
            entropy -= p * math.log2(p)
    
    # Charge density (phosphates per residue, excluding 5' terminal)
    charge_density = (length - 1) / length if length > 1 else 0.0
    
    return {
        "length": length,
        "gcContent": gc,
        "gcSkew": round(gc_skew, 3),
        "atContent": round(100 * (a_count + u_count) / length, 1) if length else 0,
        "purineFraction": round(purines / length, 3) if length else 0,
        "meltingTemp": round(tm, 1),
        "cpgCount": cpg,
        "polyGCount": polyg,
        "polyUCount": polyu,
        "sequenceEntropy": round(entropy, 3),
        "chargeDensity": round(charge_density, 3),
    }


def _predict_pbpk_curve(half_life_hours: Optional[float], clearance_score: float) -> Dict[str, Any]:
    """Generate a simulated PBPK concentration-time curve.
    
    Uses a 1-compartment IV bolus model: C(t) = C0 * e^(-kel * t)
    where kel = ln(2) / t_half
    """
    if half_life_hours is None or half_life_hours <= 0:
        half_life_hours = 2.0  # fallback for unmodified RNA
    
    kel = math.log(2) / half_life_hours
    time_points = [0, 0.5, 1, 2, 4, 8, 12, 24, 48, 72]
    # Normalized concentration (C0 = 1)
    concentrations = [round(math.exp(-kel * t), 4) for t in time_points]
    
    return {
        "timePoints": time_points,
        "concentrations": concentrations,
        "halfLifeHours": round(half_life_hours, 1),
        "clearanceRate": round(clearance_score, 2),
        "model": "1-compartment IV bolus",
    }


def _predict_charge_ph_profile(seq: str) -> Dict[str, Any]:
    """Predict net charge of RNA across physiological pH gradients.
    
    Uses Henderson-Hasselbalch for ionizable groups:
    - Backbone phosphates: pKa1 ~ 1.0
    - Base pKa values: A ~ 3.5, G ~ 3.3, C ~ 4.5, U ~ 9.5
    """
    if not seq:
        return {"phValues": [], "netCharge": []}
    seq = seq.upper()
    n = len(seq)
    
    # Phosphate groups (n-1 internal phosphates)
    num_phosphates = n - 1
    pka_phosphate = 1.0
    
    # Base pKa values (protonation states)
    base_pka = {"A": 3.5, "G": 3.3, "C": 4.5, "U": 9.5}
    base_counts = {base: seq.count(base) for base in "ACGU"}
    
    ph_values = list(range(1, 15))
    net_charge = []
    
    for ph in ph_values:
        charge = 0.0
        # Deprotonated phosphates contribute -1 each
        frac_deprot = 1.0 / (1.0 + 10 ** (pka_phosphate - ph))
        charge -= num_phosphates * frac_deprot
        
        # Protonated bases contribute +1 each
        for base, count in base_counts.items():
            if base in base_pka:
                frac_prot = 1.0 / (1.0 + 10 ** (ph - base_pka[base]))
                charge += count * frac_prot
        
        net_charge.append(round(charge, 2))
    
    return {
        "phValues": ph_values,
        "netCharge": net_charge,
        "pkaReferences": {
            "phosphate": pka_phosphate,
            "adenine": 3.5,
            "guanine": 3.3,
            "cytosine": 4.5,
            "uracil": 9.5,
        },
    }


def _predict_lipinski_violations(seq: str, descriptors: Dict[str, Any]) -> Dict[str, Any]:
    """RNA-specific rule-of-five style violation checker.
    
    Adapted for oligonucleotide properties rather than small-molecule Lipinski.
    """
    if not seq or not descriptors:
        return {"count": 0, "violations": []}
    
    violations = []
    length = descriptors.get("length", 0)
    gc = descriptors.get("gcContent", 50)
    tm = descriptors.get("meltingTemp", 50)
    cpg = descriptors.get("cpgCount", 0)
    polyg = descriptors.get("polyGCount", 0)
    polyu = descriptors.get("polyUCount", 0)
    
    if length > 25:
        violations.append("Length > 25 nt")
    if gc > 65:
        violations.append("GC content > 65%")
    if gc < 25:
        violations.append("GC content < 25%")
    if cpg > 3:
        violations.append("High CpG count (>3)")
    if polyg > 1:
        violations.append("Multiple poly-G tracts")
    if polyu > 1:
        violations.append("Multiple poly-U tracts")
    if tm > 85:
        violations.append("Very high melting temperature")
    if length < 12:
        violations.append("Length < 12 nt (suboptimal for ASO)")
    
    return {
        "count": len(violations),
        "violations": violations,
    }


def _compute_per_nt_contributions(seq: str) -> Dict[str, Any]:
    """Compute per-nucleotide contribution scores for immunogenicity and toxicity.
    
    Returns position-indexed scores based on local sequence context and motifs.
    """
    if not seq:
        return {"positions": [], "immunogenicityContribution": [], "toxicityContribution": []}
    seq = seq.upper()
    n = len(seq)
    immuno = []
    tox = []
    
    for i, base in enumerate(seq):
        # Immunogenicity: G-rich, CpG, poly-U contexts
        contrib_i = 0.0
        if base == "G":
            contrib_i += 0.15
        if base == "C" and i < n - 1 and seq[i + 1] == "G":
            contrib_i += 0.25
        if base == "U" and i < n - 1 and seq[i + 1] == "U":
            contrib_i += 0.15
        if base == "A" and i < n - 1 and seq[i + 1] == "U":
            contrib_i += 0.10
        immuno.append(round(min(contrib_i, 1.0), 2))
        
        # Toxicity: local GC richness, G-quadruplex potential, charge
        contrib_t = 0.0
        if base == "G":
            contrib_t += 0.10
        if base == "C":
            contrib_t += 0.05
        # Local 5-nt GC context
        window = seq[max(0, i - 2): i + 3]
        local_gc = window.count("G") + window.count("C")
        contrib_t += local_gc * 0.03
        tox.append(round(min(contrib_t, 1.0), 2))
    
    return {
        "positions": list(range(1, n + 1)),
        "immunogenicityContribution": immuno,
        "toxicityContribution": tox,
    }


def _project_to_2d(descriptors: Dict[str, Any]) -> Dict[str, Any]:
    """Project sequence descriptors to 2D using interpretable linear combinations.
    
    This is NOT t-SNE or PCA (which require multiple samples). Instead, it maps
    the sequence onto two axes derived from real physicochemical properties:
    - Axis 1: size/thermodynamic stability (length, GC%, Tm)
    - Axis 2: motif/complexity content (CpG, entropy, poly-motifs)
    """
    if not descriptors:
        return {"x": 0, "y": 0, "method": "descriptor-projection"}
    
    pc1 = (
        0.40 * (descriptors.get("length", 20) / 30.0) +
        0.30 * (descriptors.get("gcContent", 50) / 100.0) +
        0.20 * (descriptors.get("meltingTemp", 50) / 100.0) +
        0.10 * (descriptors.get("chargeDensity", 0.95) / 1.0)
    )
    pc2 = (
        0.35 * (descriptors.get("cpgCount", 0) / 5.0) +
        0.30 * (descriptors.get("sequenceEntropy", 1.5) / 2.0) +
        0.20 * (descriptors.get("polyGCount", 0) / 3.0) +
        0.15 * (descriptors.get("polyUCount", 0) / 3.0)
    )
    x = round((pc1 - 0.5) * 2.5, 3)
    y = round((pc2 - 0.5) * 2.5, 3)
    return {
        "x": max(-2.5, min(2.5, x)),
        "y": max(-2.5, min(2.5, y)),
        "method": "descriptor-projection",
        "varianceExplained": {"axis1": 0.60, "axis2": 0.25},
    }

def _compute_immunogenicity_risk(seq: str) -> Dict[str, Any]:
    """Assess innate immune activation risk from RNA sequence motifs."""
    if not seq:
        return {"score": 0.0, "level": "Unknown", "motifs": []}

    seq = seq.upper()
    motifs = []
    risk_score = 0.0

    # TLR9 activating CpG motifs ( unmethylated CpG in specific contexts )
    cpg_density = (seq.count("CG") / len(seq)) * 100 if seq else 0
    if cpg_density > 2.0:
        motifs.append(f"High CpG density ({cpg_density:.1f}/100 nt) — TLR9 activation risk")
        risk_score += 0.4
    elif cpg_density > 0.5:
        motifs.append(f"Moderate CpG density ({cpg_density:.1f}/100 nt)")
        risk_score += 0.15

    # Poly-G tracts: G-quadruplex formation, aggregation
    polyg = re.findall(r"G{4,}", seq)
    if len(polyg) > 2:
        motifs.append(f"Multiple poly-G tracts ({len(polyg)}) — aggregation risk")
        risk_score += 0.3
    elif len(polyg) > 0:
        motifs.append(f"Poly-G tracts present ({len(polyg)})")
        risk_score += 0.1

    # Poly-U: TLR7/8 activation
    polyu = re.findall(r"U{4,}", seq)
    if len(polyu) > 1:
        motifs.append(f"Multiple poly-U tracts ({len(polyu)}) — TLR7/8 risk")
        risk_score += 0.25
    elif len(polyu) > 0:
        motifs.append(f"Poly-U tracts present ({len(polyu)})")
        risk_score += 0.1

    # 5' triphosphate: RIG-I/MDA5 activation (if unmodified RNA)
    if seq.startswith("PPP") or seq.startswith("ppp"):
        motifs.append("5' triphosphate — RIG-I/MDA5 activation risk")
        risk_score += 0.3

    # dsRNA regions (>6 consecutive Watson-Crick pairs potential)
    if re.search(r"(GC){3,}", seq) or re.search(r"(CG){3,}", seq):
        motifs.append("Extended GC repeats — dsRNA mimicry risk")
        risk_score += 0.2

    risk_score = min(risk_score, 1.0)
    level = _classify_score(1.0 - risk_score, 0.4, 0.7)
    return {
        "score": round(risk_score, 2),
        "level": level,
        "motifs": motifs,
    }


def _predict_nuclease_sensitivity(seq: str) -> Dict[str, Any]:
    """Predict RNA nuclease degradation rate based on sequence composition."""
    if not seq:
        return {"score": 0.5, "level": "Unknown", "halfLifeHours": None}

    seq = seq.upper()
    gc = _compute_gc_content(seq)
    length = len(seq)

    # Higher GC content increases stability against nucleases
    gc_stability = min(gc / 60.0, 1.0)

    # Shorter oligos degrade faster
    length_factor = min(length / 20.0, 1.0)

    # 2' modifications dramatically increase stability (heuristic: assume standard ASO)
    modification_factor = 0.7  # 2'-O-methyl, 2'-F, LNA etc.

    # Avoid AU-rich regions which are nuclease-sensitive
    au_runs = len(re.findall(r"(AU){2,}|(UA){2,}", seq))
    au_penalty = min(au_runs * 0.05, 0.2)

    stability = (0.35 * gc_stability + 0.2 * length_factor + 0.35 * modification_factor) - au_penalty
    stability = max(0.0, min(1.0, stability))

    # Estimate half-life (standard unmodified RNA: ~minutes; modified: hours-days)
    base_half_life = 0.5  # hours for unmodified 20mer
    predicted_half_life = base_half_life + (stability * 47.5)  # up to ~48 hours for highly stable

    level = _classify_score(stability, 0.35, 0.65)
    return {
        "score": round(stability, 2),
        "level": level,
        "halfLifeHours": round(predicted_half_life, 1),
    }


def _predict_cell_uptake(seq: str, gc: float, length: int) -> Dict[str, Any]:
    """Predict cellular uptake efficiency."""
    if not seq:
        return {"score": 0.5, "level": "Unknown", "notes": []}

    seq = seq.upper()
    notes = []

    # Optimal ASO length: 15-22 nt
    if 15 <= length <= 22:
        length_score = 0.8
        notes.append(f"Optimal length ({length} nt)")
    elif 12 <= length <= 25:
        length_score = 0.6
        notes.append(f"Acceptable length ({length} nt)")
    else:
        length_score = 0.3
        notes.append(f"Suboptimal length ({length} nt)")

    # Moderate GC preferred for uptake
    if 30 <= gc <= 55:
        gc_score = 0.8
        notes.append(f"Favorable GC content ({gc}%)")
    elif 20 <= gc <= 65:
        gc_score = 0.5
        notes.append(f"Moderate GC content ({gc}%)")
    else:
        gc_score = 0.3
        notes.append(f"Extreme GC content ({gc}%)")

    # Charge-neutralizing modifications improve uptake
    mod_score = 0.7  # Assumes standard modified ASO

    # Lipid conjugate or GalNAc conjugation (assumed for ASOs targeting liver)
    conjugate_score = 0.75

    uptake = 0.3 * length_score + 0.25 * gc_score + 0.25 * mod_score + 0.2 * conjugate_score
    level = _classify_score(uptake, 0.35, 0.6)
    return {"score": round(uptake, 2), "level": level, "notes": notes}


def _predict_protein_binding(seq: str) -> Dict[str, Any]:
    """Predict non-specific protein binding (reduces free concentration)."""
    if not seq:
        return {"score": 0.5, "level": "Unknown"}

    seq = seq.upper()
    gc = _compute_gc_content(seq)

    # High GC increases protein binding
    if gc > 65:
        score = 0.8
        level = "High"
    elif gc > 45:
        score = 0.5
        level = "Moderate"
    else:
        score = 0.2
        level = "Low"

    return {"score": score, "level": level}


def _predict_renal_clearance(length: int, gc: float) -> Dict[str, Any]:
    """Predict renal clearance based on size and charge."""
    # Oligos < 30 nt are cleared renally; larger ones are not
    if length < 20:
        clearance = 0.9
        level = "High"
    elif length < 30:
        clearance = 0.6
        level = "Moderate"
    else:
        clearance = 0.2
        level = "Low"

    return {
        "score": clearance,
        "level": level,
        "mechanism": "Glomerular filtration" if length < 30 else "Reticuloendothelial",
    }


def _predict_off_target_risk(seq: str, transcript_count: int = 5) -> Dict[str, Any]:
    """Predict off-target hybridization risk."""
    if not seq:
        return {"score": 0.5, "level": "Unknown"}

    seq = seq.upper()
    length = len(seq)

    # Longer sequences have more potential off-targets
    length_factor = min(length / 22.0, 1.0)

    # More transcripts = more potential off-targets
    transcript_factor = min(transcript_count / 10.0, 1.0)

    # GC content affects specificity
    gc = _compute_gc_content(seq)
    gc_factor = 1.0 if 40 <= gc <= 60 else 0.7

    # Seed region match potential
    seed = seq[2:8] if len(seq) >= 8 else seq
    seed_gc = _compute_gc_content(seed)
    seed_factor = 0.8 if 30 <= seed_gc <= 60 else 0.5

    risk = 0.25 * length_factor + 0.25 * transcript_factor + 0.25 * (1 - gc_factor) + 0.25 * (1 - seed_factor)
    risk = max(0.0, min(1.0, risk))

    level = _classify_score(1.0 - risk, 0.4, 0.7)
    return {"score": round(risk, 2), "level": level}


def _predict_hemolysis_risk(seq: str) -> Dict[str, Any]:
    """Predict hemolysis risk from sequence."""
    if not seq:
        return {"score": 0.5, "level": "Unknown"}

    seq = seq.upper()

    # Positively charged sequences interact with RBC membranes
    gc = _compute_gc_content(seq)
    length = len(seq)

    # High GC, long sequences with G-rich motifs are more hemolytic
    g_count = seq.count("G")
    g_ratio = g_count / length if length else 0

    score = 0.3 * (gc / 100.0) + 0.3 * g_ratio + 0.2 * (min(length / 25.0, 1.0))
    score = max(0.0, min(1.0, score))

    level = _classify_score(1.0 - score, 0.4, 0.7)
    return {"score": round(score, 2), "level": level}


def _parse_loeuf_decile(value: Any) -> Optional[int]:
    """Extract numeric LOEUF decile (1-10) from a gnomAD decile string."""
    if value is None:
        return None
    m = re.match(r"Decile\s*(\d+)", str(value).strip())
    if not m:
        return None
    decile = int(m.group(1))
    return decile if 1 <= decile <= 10 else None


def _assess_gene_context_safety(gene_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Derive target-gene-driven safety metrics.

    These metrics describe the consequences of silencing the target gene itself
    (on-target pharmacology), not the chemistry of the molecule:

      - onTargetToxicityRisk: risk of dose-limiting on-target toxicity, driven by
        gene essentiality, gnomAD constraint (LOEUF decile) and expression in
        vital organs. Haploinsufficient/essential targets with high vital-organ
        expression leave little room between efficacy and toxicity.
      - therapeuticWindow: relative margin between effective and toxic dose,
        inferred from the same gene-level signals.
      - distributionNotes: tissue-exposure notes for biodistribution monitoring.
    """
    empty = {
        "onTargetToxicityRisk": 0.0,
        "onTargetToxicityLevel": None,
        "therapeuticWindow": {"level": None, "notes": []},
        "distributionNotes": [],
        "onTargetWarning": None,
        "onTargetStrength": None,
    }
    if not gene_context:
        return empty

    essential_raw = gene_context.get("essentialGene")
    if essential_raw is None:
        essential = None
    else:
        essential_str = str(essential_raw).strip().lower()
        if essential_str in ("essential", "yes", "true", "1"):
            essential = True
        elif essential_str in ("non-essential", "nonessential", "no", "false", "0"):
            essential = False
        else:
            essential = None

    loeuf = _parse_loeuf_decile(gene_context.get("loeufDecile"))

    vital_tpm = gene_context.get("vitalOrganTpm")
    if vital_tpm is not None:
        try:
            vital_tpm = float(vital_tpm)
        except (TypeError, ValueError):
            vital_tpm = None
    vital_tissues = gene_context.get("vitalOrganTissues") or []

    components = []
    labels = []

    if loeuf is not None:
        # Decile 1 = most constrained (haploinsufficiency-like) -> highest risk
        constraint_risk = round(max(0.15, 1.0 - (loeuf - 1) * 0.1), 2)
        components.append(constraint_risk)
        constrained = "most" if loeuf <= 3 else "moderately" if loeuf <= 6 else "least"
        labels.append(f"LOEUF decile {loeuf} ({constrained} constrained)")

    if essential is not None:
        components.append(0.85 if essential else 0.25)
        labels.append(f"{'essential' if essential else 'non-essential'} in dependency screens")

    if vital_tpm is not None and vital_tpm >= 0:
        if vital_tpm >= 50:
            expr_risk = 0.9
        elif vital_tpm >= 20:
            expr_risk = 0.6
        elif vital_tpm >= 5:
            expr_risk = 0.35
        else:
            expr_risk = 0.15
        components.append(expr_risk)
        labels.append(f"vital-organ expression TPM {vital_tpm:g}")

    if not components:
        return empty

    on_target = round(sum(components) / len(components), 2)
    if on_target >= 0.6:
        level = "High"
    elif on_target >= 0.35:
        level = "Moderate"
    else:
        level = "Low"

    notes = [f"On-target risk inferred from {', '.join(labels)}."]
    if on_target >= 0.35:
        notes.append(
            "Elevated on-target risk implies a narrow therapeutic window — partial knockdown or "
            "cell-type-restricted delivery may be needed to separate efficacy from toxicity."
        )

    if on_target >= 0.6:
        tw = "Narrow"
        tw_notes = [
            "Target is essential/constrained or highly expressed in vital organs — expect a narrow safety margin.",
            "De-risk with dose titration, knockdown-depth studies, and tissue-specific delivery.",
        ]
    elif on_target >= 0.35:
        tw = "Moderate"
        tw_notes = [
            "Moderate therapeutic window — balance knockdown depth against on-target effects.",
        ]
    else:
        tw = "Wide"
        tw_notes = [
            "Low predicted on-target toxicity — a wide therapeutic window is expected for silencing this target.",
        ]

    dist_notes = []
    if vital_tissues and vital_tpm is not None and vital_tpm > 0:
        organs = ", ".join(str(t) for t in vital_tissues[:4])
        dist_notes.append(
            f"Predominant vital-organ expression in {organs} (max TPM {vital_tpm:g}) — "
            "monitor tissue exposure and consider targeted delivery to limit on-target exposure."
        )

    if on_target >= 0.6:
        on_target_warning = (
            "High on-target toxicity risk — essential/constrained target with high "
            "vital-organ expression leaves a narrow therapeutic window"
        )
    elif on_target >= 0.35:
        on_target_warning = (
            "Moderate on-target toxicity risk — balance knockdown depth against "
            "target essentiality and vital-organ expression"
        )
    else:
        on_target_warning = None
    on_target_strength = (
        "Low on-target toxicity risk — wide therapeutic window for silencing this target"
        if 0 < on_target < 0.35
        else None
    )

    return {
        "onTargetToxicityRisk": on_target,
        "onTargetToxicityLevel": level,
        "therapeuticWindow": {"level": tw, "notes": tw_notes},
        "distributionNotes": dist_notes,
        "onTargetWarning": on_target_warning,
        "onTargetStrength": on_target_strength,
    }


def _generate_admet_analysis(
    admet: Dict[str, Any],
    gene_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Generate human-readable ADMET analysis text."""
    lines = []

    lines.append("### Absorption & Uptake")
    uptake = admet.get("cellUptake", {})
    lines.append(f"**Cellular uptake:** {uptake.get('level', 'Unknown')} (score {uptake.get('score', 'N/A')})")
    if uptake.get("notes"):
        for note in uptake["notes"]:
            lines.append(f"- {note}")

    lines.append("\n### Distribution")
    prot_bind = admet.get("proteinBinding", {})
    renal = admet.get("renalClearance", {})
    lines.append(f"**Protein binding:** {prot_bind.get('level', 'Unknown')} — reduces free plasma concentration")
    lines.append(f"**Renal clearance:** {renal.get('level', 'Unknown')} ({renal.get('mechanism', 'N/A')})")

    lines.append("\n### Metabolism")
    nuclease = admet.get("nucleaseSensitivity", {})
    lines.append(f"**Nuclease stability:** {nuclease.get('level', 'Unknown')} (score {nuclease.get('score', 'N/A')})")
    if nuclease.get("halfLifeHours"):
        lines.append(f"- Predicted plasma half-life: ~{nuclease['halfLifeHours']} h")

    lines.append("\n### Excretion")
    lines.append(f"**Clearance route:** {renal.get('mechanism', 'N/A')}")

    lines.append("\n### Toxicity & Safety")
    immuno = admet.get("immunogenicity", {})
    off_target = admet.get("offTargetRisk", {})
    hemolysis = admet.get("hemolysisRisk", {})

    lines.append(f"**Immunogenicity:** {immuno.get('level', 'Unknown')} (score {immuno.get('score', 'N/A')})")
    if immuno.get("motifs"):
        for motif in immuno["motifs"]:
            lines.append(f"- {motif}")

    lines.append(f"**Off-target hybridization:** {off_target.get('level', 'Unknown')} (score {off_target.get('score', 'N/A')})")
    lines.append(f"**Hemolysis risk:** {hemolysis.get('level', 'Unknown')} (score {hemolysis.get('score', 'N/A')})")

    # Gene-driven on-target pharmacology
    on_target = admet.get("onTargetToxicityRisk")
    if on_target is not None and on_target > 0:
        lines.append("\n### On-target Toxicity & Therapeutic Window (target gene)")
        lines.append(f"**On-target toxicity risk:** {admet.get('onTargetToxicityLevel', 'Unknown')} (score {on_target})")
        tw = admet.get("therapeuticWindow")
        if isinstance(tw, dict):
            lines.append(f"**Therapeutic window:** {tw.get('level', 'Unknown')}")
            for note in tw.get("notes", []):
                lines.append(f"- {note}")
    for note in admet.get("distributionNotes", []) or []:
        lines.append(f"- {note}")

    return "\n".join(lines)


def get_admet_prediction(
    aso_sequence: Optional[str] = None,
    gene_context: Optional[Dict[str, Any]] = None,
    transcript_count: int = 5,
) -> Dict[str, Any]:
    """Compute ADMET predictions for an RNA therapeutic candidate.

    Args:
        aso_sequence: The ASO/siRNA/aptamer RNA sequence
        gene_context: Dict with target gene expression/constraint data
        transcript_count: Number of transcripts for off-target risk estimation

    Returns:
        Dict with ADMET scores, levels, and analysis text
    """
    result = {
        "admetAvailable": False,
        "gcContent": None,
        "absorptionScore": None,
        "absorptionLevel": None,
        "distributionScore": None,
        "distributionLevel": None,
        "metabolismScore": None,
        "metabolismLevel": None,
        "excretionScore": None,
        "excretionLevel": None,
        "toxicityScore": None,
        "toxicityLevel": None,
        "cellUptake": None,
        "proteinBinding": None,
        "nucleaseSensitivity": None,
        "renalClearance": None,
        "immunogenicity": None,
        "offTargetRisk": None,
        "hemolysisRisk": None,
        "admetAnalysis": None,
        "admetWarnings": [],
        "admetStrengths": [],
        "sequenceDescriptors": None,
        "pbpkTimeSeries": None,
        "chargePhProfile": None,
        "lipinskiViolations": None,
        "structuralHotspots": None,
        "chemicalSpaceProjection": None,
        "onTargetToxicityRisk": None,
        "onTargetToxicityLevel": None,
        "therapeuticWindow": None,
        "distributionNotes": [],
    }

    if not aso_sequence or len(aso_sequence) < 8:
        # Gene-only path: no candidate sequence yet, but the target-gene context
        # can still drive an on-target safety assessment (toxicity, therapeutic
        # window, tissue exposure). Sequence-dependent fields stay unavailable.
        gene_safety = _assess_gene_context_safety(gene_context)
        if gene_safety["onTargetToxicityRisk"] > 0:
            result["onTargetToxicityRisk"] = gene_safety["onTargetToxicityRisk"]
            result["onTargetToxicityLevel"] = gene_safety["onTargetToxicityLevel"]
            result["therapeuticWindow"] = gene_safety["therapeuticWindow"]
            result["distributionNotes"] = gene_safety["distributionNotes"]
            if gene_safety["onTargetWarning"]:
                result["admetWarnings"].append(gene_safety["onTargetWarning"])
            if gene_safety["onTargetStrength"]:
                result["admetStrengths"].append(gene_safety["onTargetStrength"])
            result["admetAvailable"] = True
            tw = gene_safety["therapeuticWindow"]
            parts = [
                "### On-target Toxicity & Therapeutic Window (target gene)",
                f"**On-target toxicity risk:** {gene_safety['onTargetToxicityLevel']} (score {gene_safety['onTargetToxicityRisk']})",
                f"**Therapeutic window:** {tw['level']}",
            ]
            parts += [f"- {note}" for note in tw["notes"]]
            parts += [f"- {note}" for note in gene_safety["distributionNotes"]]
            parts.append("")
            parts.append(
                "Sequence-dependent ADMET (PK, immunogenicity, hemolysis, PBPK) requires an ASO candidate sequence — "
                "design candidates in the RNA-silencing workspace for a full profile."
            )
            result["admetAnalysis"] = "\n".join(parts)
            return result
        result["admetAvailable"] = False
        result["admetAnalysis"] = "Provide an ASO sequence for ADMET prediction."
        return result

    seq = aso_sequence.upper().replace("T", "U")
    gc = _compute_gc_content(seq)
    result["gcContent"] = gc
    length = len(seq)

    # Absoption
    uptake = _predict_cell_uptake(seq, gc, length)
    result["cellUptake"] = uptake
    result["absorptionScore"] = uptake["score"]
    result["absorptionLevel"] = uptake["level"]

    # Distribution
    prot_bind = _predict_protein_binding(seq)
    renal = _predict_renal_clearance(length, gc)
    dist_score = 0.5 * (1 - prot_bind["score"]) + 0.5 * (1 - renal["score"])
    result["proteinBinding"] = prot_bind
    result["renalClearance"] = renal
    result["distributionScore"] = round(dist_score, 2)
    result["distributionLevel"] = _classify_score(dist_score, 0.35, 0.65)

    # Metabolism
    nuclease = _predict_nuclease_sensitivity(seq)
    result["nucleaseSensitivity"] = nuclease
    result["metabolismScore"] = nuclease["score"]
    result["metabolismLevel"] = nuclease["level"]

    # Excretion
    result["excretionScore"] = round(1 - renal["score"], 2)
    result["excretionLevel"] = _classify_score(1 - renal["score"], 0.35, 0.65)

    # Toxicity
    immuno = _compute_immunogenicity_risk(seq)
    off_target = _predict_off_target_risk(seq, transcript_count)
    hemolysis = _predict_hemolysis_risk(seq)

    # Gene-aware on-target pharmacology (target essentiality / constraint / vital-organ expression)
    gene_safety = _assess_gene_context_safety(gene_context)
    result["onTargetToxicityRisk"] = gene_safety["onTargetToxicityRisk"]
    result["onTargetToxicityLevel"] = gene_safety["onTargetToxicityLevel"]
    result["therapeuticWindow"] = gene_safety["therapeuticWindow"]
    result["distributionNotes"] = gene_safety["distributionNotes"]

    tox_score = 0.35 * immuno["score"] + 0.35 * off_target["score"] + 0.3 * hemolysis["score"]
    if gene_safety["onTargetToxicityRisk"] > 0:
        # Blend molecule-derived toxicity with target-gene on-target risk
        tox_score = (
            0.3 * immuno["score"]
            + 0.3 * off_target["score"]
            + 0.2 * hemolysis["score"]
            + 0.2 * gene_safety["onTargetToxicityRisk"]
        )
    tox_score = max(0.0, min(1.0, tox_score))

    result["immunogenicity"] = immuno
    result["offTargetRisk"] = off_target
    result["hemolysisRisk"] = hemolysis
    result["toxicityScore"] = round(tox_score, 2)
    result["toxicityLevel"] = _classify_score(1.0 - tox_score, 0.4, 0.7)

    # New computed properties
    descriptors = _compute_sequence_descriptors(seq)
    result["sequenceDescriptors"] = descriptors
    result["chemicalSpaceProjection"] = _project_to_2d(descriptors)
    result["chargePhProfile"] = _predict_charge_ph_profile(seq)
    result["lipinskiViolations"] = _predict_lipinski_violations(seq, descriptors)
    result["structuralHotspots"] = _compute_per_nt_contributions(seq)
    
    # PBPK uses half-life and renal clearance
    result["pbpkTimeSeries"] = _predict_pbpk_curve(
        half_life_hours=nuclease.get("halfLifeHours"),
        clearance_score=renal["score"],
    )

    result["admetAvailable"] = True

    # Generate analysis
    generated_analysis = _generate_admet_analysis(result, gene_context)
    result["admetAnalysis"] = generated_analysis

    # Warnings and strengths
    if immuno["score"] > 0.3:
        result["admetWarnings"].append("Immunogenicity risk detected — consider 2'-O-methyl or 2'-F modifications to reduce TLR activation")
    if off_target["score"] > 0.4:
        result["admetWarnings"].append("Elevated off-target risk — validate specificity with RNA-seq off-target mapping")
    if hemolysis["score"] > 0.4:
        result["admetWarnings"].append("Hemolysis potential — assess RBC compatibility in preclinical species")
    if uptake["score"] < 0.4:
        result["admetWarnings"].append("Low predicted uptake — consider GalNAc conjugation or lipid nanoparticle delivery")
    if nuclease["halfLifeHours"] and nuclease["halfLifeHours"] < 4:
        result["admetWarnings"].append("Short predicted half-life — increase modification density or use phosphorothioate backbone")

    if gene_safety["onTargetWarning"]:
        result["admetWarnings"].append(gene_safety["onTargetWarning"])
    if gene_safety["onTargetStrength"]:
        result["admetStrengths"].append(gene_safety["onTargetStrength"])

    if uptake["score"] >= 0.6:
        result["admetStrengths"].append("Strong cellular uptake predicted")
    if nuclease["score"] >= 0.6:
        result["admetStrengths"].append("Good nuclease stability predicted")
    if immuno["score"] < 0.2:
        result["admetStrengths"].append("Low immunogenicity risk")
    if off_target["score"] < 0.3:
        result["admetStrengths"].append("High specificity predicted")

    return result
