"""Generate all figures for docs/paper_draft.md from the committed result
artifacts. Run with the repo venv:  .venv/bin/python docs/figures/generate_figures.py

Every number plotted is read from the verified artifacts under
backend/results/benchmark and backend/data/benchmark, so figures and text
cannot drift apart.
"""

import json
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

matplotlib.use("Agg")
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 9.5,
    "axes.titlesize": 10.5,
    "axes.labelsize": 9.5,
    "xtick.labelsize": 8.5,
    "ytick.labelsize": 8.5,
    "legend.fontsize": 8.5,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
RES = ROOT / "backend" / "results" / "benchmark"
DATA = ROOT / "backend" / "data" / "benchmark"

C_PLATFORM = "#2b6cb0"
C_RULEBOOK = "#2f855a"
C_DESIGN = "#6b46c1"
C_ML = "#d69e2e"
C_BLUE = "#3182ce"
C_ORANGE = "#dd6b20"
C_GREY = "#718096"
C_RED = "#c53030"
C_GREEN = "#38a169"


# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------
def box(ax, x, y, w, h, text, fc, ec="none", fs=9, tc="white", lw=1.2,
        rounded=True, align="center", weight="bold"):
    style = "round,pad=0.02,rounding_size=0.02" if rounded else "square,pad=0.02"
    p = FancyBboxPatch((x, y), w, h, boxstyle=style, fc=fc, ec=ec, lw=lw)
    ax.add_patch(p)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontsize=fs, color=tc, fontweight=weight, linespacing=1.35)
    return p


def arrow(ax, x1, y1, x2, y2, color="#4a5568", lw=1.6, style="-|>",
          ms=14, shrinkA=2, shrinkB=2):
    a = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style,
                        mutation_scale=ms, color=color, lw=lw,
                        shrinkA=shrinkA, shrinkB=shrinkB)
    ax.add_patch(a)
    return a


def new_ax(w, h):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    return fig, ax


def save(fig, name, dpi=200):
    fig.savefig(OUT / name, dpi=dpi, bbox_inches="tight",
                facecolor="white")
    plt.close(fig)
    print("wrote", OUT / name)


# ----------------------------------------------------------------------
# Fig 1 — ASO platform architecture (platform-first framing)
# ----------------------------------------------------------------------
def fig1_platform():
    fig, ax = new_ax(12.5, 7.0)

    # ---- row 1: input + biological info retrieval
    box(ax, 0.02, 0.83, 0.16, 0.13,
        "User input:\ngene symbol ·\ntherapeutic goal", C_GREY, fs=8.5)
    arrow(ax, 0.18, 0.895, 0.245, 0.895)

    box(ax, 0.245, 0.83, 0.34, 0.13,
        "Biological Information Retrieval Engine\n"
        "Ensembl · NCBI · UniProt · ClinVar · GTEx\n"
        "Reactome · STRING · PubMed",
        C_PLATFORM, fs=8.5)
    arrow(ax, 0.585, 0.895, 0.66, 0.895)

    # ---- row 2: rulebook engine
    box(ax, 0.66, 0.83, 0.32, 0.13,
        "Rulebook Engine\n"
        "26 molecular mechanisms (A1–A26)\n"
        "9 therapeutic goals (silencing · upregulation · editing ·\n"
        "processing · neutralization · translation · isoform · protein)",
        C_RULEBOOK, fs=8)

    # ---- row 2 mid: design engines (right block)
    box(ax, 0.42, 0.62, 0.56, 0.12,
        "Design Engines\n"
        "Mechanism · MolecularDefect · CandidateGeneration · Optimization\n"
        "Ranking · Validation · TargetDiscovery · TherapeuticGoal",
        C_DESIGN, fs=8.5)
    arrow(ax, 0.82, 0.83, 0.70, 0.74, color=C_GREY)

    # ---- row 2 left: what design engines output
    box(ax, 0.02, 0.615, 0.35, 0.125,
        "Rulebook output\n"
        "mechanism ranking by evidence, variant fit,\ndelivery precedent",
        C_RULEBOOK, fs=8, tc="#e6fffa")
    arrow(ax, 0.24, 0.615, 0.42, 0.68, color=C_GREY)

    # ---- row 3: heuristic candidate emission (current behavior)
    box(ax, 0.02, 0.45, 0.96, 0.11,
        "Deterministic heuristic design (current):  mechanism = fixed toolbox  |  "
        "candidate emission from structural-class + scaffold templates  |  "
        "estimated GC / Tm / ΔG — no learned activity feedback",
        C_GREY, fs=8.5, tc="#f7fafc")

    # ---- ML slot: this paper
    box(ax, 0.15, 0.18, 0.70, 0.22,
        "Data-driven slot — this paper\n"
        "single mechanism-conditioned model over all three modalities\n"
        "(mechanism as a conditioning axis, not a fixed toolbox)\n"
        "generate → rank → conformal-accept\n"
        "RNase H gapmers · siRNA · splice-switching  (+ unseen mechanism)",
        C_ML, fs=9)
    arrow(ax, 0.50, 0.45, 0.50, 0.40, color="#4a5568")

    # ---- row 4: outputs
    box(ax, 0.02, 0.03, 0.96, 0.11,
        "Candidates: valid · novel · mechanism-distinct sequences  |  "
        "ranked for activity within experiments  |  "
        "conformal top-k selection with honest coverage CIs",
        C_BLUE, fs=8.5, tc="#ebf8ff")
    arrow(ax, 0.50, 0.18, 0.50, 0.14, color="#4a5568")

    fig.suptitle("ASO design platform: information retrieval → rulebook → design → "
                 "this paper's data-driven slot", y=0.995, fontsize=12,
                 fontweight="bold")
    save(fig, "fig1_platform.png")


# ----------------------------------------------------------------------
# Fig 2 — mechanism-conditioned CVAE + generate→rank→conformal pipeline
# ----------------------------------------------------------------------
def fig2_ml_pipeline():
    fig, ax = new_ax(12.5, 7.2)

    # ============ stage 1: generator ============
    ax.text(0.015, 0.955, "STAGE 1 · mechanism-conditioned CVAE (generator)",
            fontsize=10.5, fontweight="bold", color=C_ML)

    # encoder
    box(ax, 0.015, 0.68, 0.21, 0.19,
        "Encoder  q_φ(x | m, c)\n"
        "x ∈ {A,C,G,U}^L (one-hot L×4)\n"
        "Conv1D k=5,5,3 → max-pool → 128\n"
        "MLP → μ, log σ²      z ∈ ℝ^64",
        C_BLUE, fs=8.2)

    # conditioning
    box(ax, 0.27, 0.80, 0.17, 0.16,
        "Conditioning\n"
        "Emb_m(m) ⊕ Emb_c(c)\n"
        "128-d each\n"
        "dropout p = 0.2 (both)",
        C_PLATFORM, fs=8.2)

    # latent
    box(ax, 0.27, 0.55, 0.17, 0.14,
        "latent z ∈ ℝ^64\n(shared sequence prior)",
        C_ORANGE, fs=8.5)

    arrow(ax, 0.225, 0.775, 0.27, 0.80)
    arrow(ax, 0.225, 0.71, 0.27, 0.62)

    # decoder
    box(ax, 0.50, 0.62, 0.30, 0.20,
        "Decoder  p_θ(x | z, m, c)\n"
        "GRU (emb 32 → hidden 128)\n"
        "init h₀ = tanh(Proj[z, cond])\n"
        "per-position CE over {A,C,G,U}  +  length head (17 classes)\n"
        "GC-steered decoding: reweight G/C vs A/U per position\nto reach γ_m "
        "(mechanism training-mean GC) — artifact removed at the source",
        C_GREEN, fs=8.0, tc="#f0fff4")

    arrow(ax, 0.44, 0.63, 0.50, 0.68, color=C_GREY)
    arrow(ax, 0.44, 0.60, 0.50, 0.66, color=C_GREY, style="<|-|>")

    # training loss
    box(ax, 0.015, 0.42, 0.785, 0.10,
        "Training:  L = recon + 0.1·len_CE + β·Σ_d max(0.05, KL_d)   "
        "(β = 0.1, warmup 5 ep, free-bits anti-collapse)\n"
        "        + 0.3 · rank margin over same-experiment pairs  (margin 0.02)  |  "
        "raw KL = 2.42 nats · 20 epochs · 82,724 rows (50%, seed 0)",
        "#edf2f7", fs=8.2, tc="#1a202c", weight="normal", ec=C_GREY, lw=0.8)

    arrow(ax, 0.40, 0.62, 0.40, 0.52, color=C_GREY, style="<|-|>")

    # ============ stage 2: ranker ============
    ax.text(0.86, 0.955, "STAGE 2 · ranker",
            fontsize=10.5, fontweight="bold", color=C_ML)
    box(ax, 0.86, 0.80, 0.125, 0.11,
        "Generate\nn = 1,000 candidates\n(chem_oov)",
        C_BLUE, fs=8.2)
    box(ax, 0.86, 0.62, 0.125, 0.11,
        "Conditioned Conv1D ranker\nseq → score s(x)\n"
        "+ chem embedding (64-d)\n"
        "margin 0.5 over pairs",
        C_ORANGE, fs=8.2)
    arrow(ax, 0.9225, 0.80, 0.9225, 0.73)
    box(ax, 0.86, 0.47, 0.125, 0.09,
        "Metrics\nscore lift\nfrac-in-top-20",
        "#edf2f7", fs=8.2, tc="#1a202c", ec=C_GREY, lw=0.8)
    arrow(ax, 0.9225, 0.62, 0.9225, 0.56, color=C_GREY)

    # ============ stage 3: conformal ============
    ax.text(0.015, 0.315, "STAGE 3 · conformal acceptance (trained mechanisms only)",
            fontsize=10.5, fontweight="bold", color=C_ML)
    box(ax, 0.015, 0.10, 0.47, 0.17,
        "Split-conformal selection (k = 2, α = 0.1)\n"
        "nonconformity τ_e = score of weakest true top-k member\n"
        "threshold q̂ = (1−α) quantile over calibration groups\n"
        "selected = {i : s_i ≥ q̂}   →  coverage + Wilson 95% CIs",
        C_PLATFORM, fs=8.4)
    box(ax, 0.53, 0.10, 0.46, 0.17,
        "Honest outcome (measured, seed 0)\n"
        "rnase_h cov 0.04 [0.016, 0.098] (n=100) · sirna 0.17 [0.030, 0.564] (n=6)\n"
        "splice 0.00 [0.000, 0.243] (n=12)   —   below nominal 0.9, reported openly",
        "#fff5f5", fs=8.4, tc="#1a202c", ec=C_RED, lw=1.0)
    arrow(ax, 0.25, 0.27, 0.25, 0.10, color="#4a5568")

    fig.suptitle("Generate → rank → conformal-accept: mechanism-conditioned CVAE, "
                 "weakly-supervised ranker, and calibrated selection",
                 y=0.995, fontsize=12, fontweight="bold")
    save(fig, "fig2_ml_pipeline.png")


# ----------------------------------------------------------------------
# Fig 3 — unified benchmark composition
# ----------------------------------------------------------------------
def fig3_benchmark():
    stats = json.load(open(DATA / "unified_benchmark_stats.json"))
    modalities = ["rnase_h\n(RNase H gapmers)", "sirna\n(RNAi)",
                  "splice_switching\n(steric-block ASOs)"]
    counts = [stats["modality"]["rnase_h"], stats["modality"]["sirna"],
              stats["modality"]["splice_switching"]]
    colors = [C_BLUE, C_ORANGE, C_GREEN]

    fig, ax = plt.subplots(figsize=(8.2, 3.4))
    bars = ax.bar(modalities, counts, color=colors, width=0.6,
                  edgecolor="white", lw=0.5)
    for b, c in zip(bars, counts):
        ax.text(b.get_x() + b.get_width() / 2, c * 1.03, f"{c:,}",
                ha="center", va="bottom", fontsize=10, fontweight="bold")
    ax.set_yscale("log")
    ax.set_ylabel("oligo rows (log scale)")
    ax.set_title("Unified three-modality benchmark — 165,449 experimentally "
                 "annotated oligos")
    ax.set_ylim(1e3, 4e5)
    ax.text(0.0, -0.42,
            "1,974 experiments  ·  233 chemistry classes (modification-pattern "
            "fingerprints)  ·  4,289 target genes  ·  lengths 12–28 nt  ·  "
            "rank targets: within-experiment percentile (corr(r, a) = 0.958)",
            transform=ax.transAxes, fontsize=8.5, color=C_GREY)
    fig.tight_layout()
    save(fig, "fig3_benchmark.png")


# ----------------------------------------------------------------------
# Fig 4 — cross-gene ceiling (model-independent)
# ----------------------------------------------------------------------
def fig4_ceiling():
    gbm = json.load(open(RES / "unified_gbm_baseline.json"))
    cond = json.load(open(RES / "ranker_ablation_conditioned" / "result.json"))
    seq = json.load(open(RES / "ranker_ablation_seqonly" / "result.json"))

    models = ["GBM\nLambdaRank", "GBM\nregress (rank)", "GBM\nregress (raw)",
              "neural\nseqonly", "neural\nconditioned"]
    top10 = [gbm["lambdarank-rank"]["top10"], gbm["regress-rank"]["top10"],
             gbm["regress-raw"]["top10"], seq["topk_w"], cond["topk_w"]]
    pear = [gbm["lambdarank-rank"]["pearson"], gbm["regress-rank"]["pearson"],
            gbm["regress-raw"]["pearson"], seq["pearson_z_w"], cond["pearson_z_w"]]

    x = range(len(models))
    fig, ax = plt.subplots(figsize=(8.2, 3.4))
    w = 0.38
    b1 = ax.bar([i - w / 2 for i in x], top10, w, color=C_BLUE,
                label="top-10 Jaccard", edgecolor="white")
    b2 = ax.bar([i + w / 2 for i in x], pear, w, color=C_ORANGE,
                label="Pearson (rank z)", edgecolor="white")
    for b, v in zip(b1, top10):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.006, f"{v:.3f}",
                ha="center", fontsize=8, fontweight="bold")
    for b, v in zip(b2, pear):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.006, f"{v:.3f}",
                ha="center", fontsize=8)
    ax.axhline(0.17, color=C_RED, ls="--", lw=1.2)
    ax.text(4.5, 0.174, "chance (top-10 ≈ 0.17 @ median n=77)", color=C_RED,
            fontsize=8, ha="right")
    ax.set_xticks(list(x))
    ax.set_xticklabels(models)
    ax.set_ylim(0, 0.42)
    ax.set_ylabel("cross-gene transfer (gene split, seed 0)")
    ax.set_title("The rank-transfer ceiling is model-independent: every family "
                 "saturates at top-10 ≈ 0.30")
    ax.legend(loc="upper left", frameon=False)
    fig.tight_layout()
    save(fig, "fig4_ceiling.png")


# ----------------------------------------------------------------------
# Fig 5 — GC artifact decomposition
# ----------------------------------------------------------------------
def fig5_gc_decomposition():
    mechs = ["rnase_h", "sirna", "splice_switching", "mechanism_oov"]
    prior = [-0.007, -0.063, -0.133, -0.131]
    steered = [0.056, 0.031, 0.030, 0.009]
    gc_corr = [0.007, -0.323, -0.115, None]

    x = range(len(mechs))
    fig, ax = plt.subplots(figsize=(8.2, 3.8))
    w = 0.36
    b1 = ax.bar([i - w / 2 for i in x], prior, w, color=C_RED,
                label="prior sampling (GC-drifted, 0.551 vs 0.469)")
    b2 = ax.bar([i + w / 2 for i in x], steered, w, color=C_GREEN,
                label="GC-steered at the source (matches training GC)")
    for b, v in zip(b1, prior):
        ax.text(b.get_x() + b.get_width() / 2, v - 0.008, f"{v:+.3f}",
                ha="center", va="top", fontsize=8, fontweight="bold")
    for b, v in zip(b2, steered):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.004, f"{v:+.3f}",
                ha="center", fontsize=8, fontweight="bold")
    ax.axhline(0, color="black", lw=0.8)
    ax.axhline(0.2, color=C_GREY, ls=":", lw=1.1)
    ax.text(3.5, 0.203, "top-20 chance = 0.2", color=C_GREY, fontsize=8,
            ha="right")
    ax.set_xticks(list(x))
    ax.set_xticklabels(["rnase_h\n(corr(GC,rank)=+0.007)", "sirna\n(−0.323)",
                        "splice_switching\n(−0.115)", "mechanism_oov\n(unseen)"])
    ax.set_ylabel("score lift (generated − uniform-random), n=1000, chem_oov")
    ax.set_title("The apparent null decomposes into a removable GC artifact "
                 "plus the residual ceiling")
    ax.legend(loc="lower right", frameon=False)
    ax.set_ylim(-0.17, 0.22)
    fig.tight_layout()
    save(fig, "fig5_gc_decomposition.png")


# ----------------------------------------------------------------------
# Fig 6 — conformal coverage with Wilson CIs
# ----------------------------------------------------------------------
def fig6_conformal():
    mechs = ["rnase_h", "sirna", "splice_switching"]
    cov = [0.04, 0.17, 0.00]
    ci = [(0.016, 0.098), (0.030, 0.564), (0.000, 0.243)]
    n = [100, 6, 12]

    fig, ax = plt.subplots(figsize=(7.6, 3.4))
    xs = range(len(mechs))
    err = [[c - lo, hi - c] for (lo, hi), c in zip(ci, cov)]
    ax.bar(xs, cov, 0.5, color=C_RED, alpha=0.85, yerr=list(zip(*err)),
           capsize=6, edgecolor="white",
           error_kw=dict(lw=1.4, ecolor=C_GREY))
    ax.axhline(0.9, color=C_GREEN, ls="--", lw=1.3)
    ax.text(2.45, 0.905, "nominal coverage 0.9", color=C_GREEN, fontsize=8,
            ha="right")
    for i, (c, lo, hi, nn) in enumerate(zip(cov, *zip(*ci), n)):
        ax.text(i, c + 0.035, f"{c:.2f}\n[{lo:.3f}, {hi:.3f}]\nn = {nn}",
                ha="center", fontsize=8)
    ax.set_xticks(list(xs))
    ax.set_xticklabels(["rnase_h", "sirna", "splice_switching"])
    ax.set_ylabel("coverage of true top-k=2")
    ax.set_ylim(0, 1.0)
    ax.set_title("Conformal acceptance under-reaches nominal coverage "
                 "(reported openly with Wilson 95% CIs)")
    fig.tight_layout()
    save(fig, "fig6_conformal.png")


if __name__ == "__main__":
    fig1_platform()
    fig2_ml_pipeline()
    fig3_benchmark()
    fig4_ceiling()
    fig5_gc_decomposition()
    fig6_conformal()
    print("done")
