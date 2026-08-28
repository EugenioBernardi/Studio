"""Figures for the lesion study."""

import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S
from analysis import RESULTS, STAGES, dissociation_table, load, summarise

STAGE_COLORS = {"V1": "#2c7fb8", "V2": "#7fcdbb", "V4": "#fdae61", "IT": "#d7301f"}


def fig_severity_curves(les, kind="ablation"):
    """Preservation vs lesion severity, one panel per stimulus condition."""
    k = les[les.kind == kind]
    fig, axes = plt.subplots(2, 3, figsize=(11, 6.4), sharey=True, sharex=True)
    for ax, cond in zip(axes.ravel(), S.CONDITIONS):
        for stage in STAGES:
            sub = (k[(k.stage == stage) & (k.condition == cond)]
                   .groupby("severity").preservation.agg(["mean", "std"]))
            ax.errorbar(sub.index, sub["mean"], yerr=sub["std"].fillna(0),
                        marker="o", ms=4, capsize=2, lw=1.6,
                        color=STAGE_COLORS[stage], label=stage)
        ax.set_title(cond, fontsize=10)
        ax.axhline(1.0, color="0.7", lw=0.8, ls=":")
        ax.set_ylim(-0.05, 1.15)
        ax.grid(alpha=0.25, lw=0.5)
    axes[0, 0].legend(title="lesion site", fontsize=8, title_fontsize=8)
    for ax in axes[1]:
        ax.set_xlabel("lesion severity")
    for ax in axes[:, 0]:
        ax.set_ylabel("preservation")
    fig.suptitle(f"Preservation of above-chance performance by lesion site ({kind})",
                 fontsize=12)
    fig.tight_layout()
    p = os.path.join(RESULTS, f"fig1_severity_curves_{kind}.png")
    fig.savefig(p, dpi=130)
    return p


def fig_matched_profile(tab, kind="ablation"):
    """Severity-matched deficit profile: the study's main result."""
    mean, sd = summarise(tab)
    conds = [c for c in S.CONDITIONS if c != "canonical"]
    x = np.arange(len(conds))
    w = 0.2
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(12, 4.4),
                                  gridspec_kw={"width_ratios": [2.3, 1]})
    for i, stage in enumerate(STAGES):
        if stage not in mean.index:
            continue
        ax.bar(x + (i - 1.5) * w, mean.loc[stage, conds], w,
               yerr=sd.loc[stage, conds].fillna(0), capsize=2,
               color=STAGE_COLORS[stage], label=stage)
    ax.axhline(0.75, color="k", lw=1, ls="--")
    ax.text(len(conds) - 0.45, 0.762, "canonical, matched", fontsize=8, ha="right")
    ax.set_xticks(x)
    ax.set_xticklabels(conds, rotation=18, ha="right")
    ax.set_ylabel("preservation at matched severity")
    ax.set_title("Deficit profile with lesions equated on canonical performance")
    ax.legend(title="lesion site", fontsize=8, title_fontsize=8)
    ax.grid(alpha=0.25, axis="y", lw=0.5)

    d = mean["dissociation"].reindex(STAGES)
    e = sd["dissociation"].reindex(STAGES).fillna(0)
    ax2.bar(range(len(STAGES)), d, yerr=e, capsize=3,
            color=[STAGE_COLORS[s] for s in STAGES])
    ax2.axhline(0, color="k", lw=1)
    ax2.set_xticks(range(len(STAGES)))
    ax2.set_xticklabels(STAGES)
    ax2.set_ylabel("transformation - degradation")
    ax2.set_title("Dissociation index")
    ax2.grid(alpha=0.25, axis="y", lw=0.5)
    fig.tight_layout()
    p = os.path.join(RESULTS, f"fig2_matched_profile_{kind}.png")
    fig.savefig(p, dpi=130)
    return p


if __name__ == "__main__":
    df, intact, les = load()
    for kind in ["ablation", "noise"]:
        if kind not in les.kind.unique():
            continue
        print(fig_severity_curves(les, kind))
        tab = dissociation_table(les, kind=kind)
        if not tab.empty:
            print(fig_matched_profile(tab, kind))
