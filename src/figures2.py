"""Figures for the strengthened lesion experiment."""

import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S
from analysis2 import RESULTS, STAGES, ci, dissociation_table, load

STAGE_COLORS = {"V1": "#2c7fb8", "V2": "#7fcdbb", "V4": "#fdae61", "IT": "#d7301f"}
KINDS = ["ablation", "decay", "gain"]
KIND_LABEL = {"ablation": "channel ablation", "decay": "synaptic deletion",
              "gain": "gain dysregulation"}


def fig_robustness(les, path):
    """Mean preservation vs severity per lesion model: the vulnerability ordering."""
    kinds = [k for k in KINDS if k in les.kind.unique()]
    fig, axes = plt.subplots(1, len(kinds), figsize=(4.1 * len(kinds), 3.6))
    axes = np.atleast_1d(axes)
    for ax, kind in zip(axes, kinds):
        k = les[les.kind == kind]
        for stage in STAGES:
            g = (k[k.stage == stage].groupby("severity").preservation
                 .agg(["mean", "std"]))
            ax.errorbar(g.index, g["mean"], yerr=g["std"].fillna(0), marker="o",
                        ms=4, capsize=2, lw=1.6, color=STAGE_COLORS[stage], label=stage)
        ax.set_title(KIND_LABEL[kind], fontsize=10)
        ax.set_xlabel("lesion severity")
        ax.set_ylim(-0.05, 1.1)
        ax.grid(alpha=0.25, lw=0.5)
    axes[0].set_ylabel("mean preservation")
    axes[0].legend(title="lesion site", fontsize=8, title_fontsize=8)
    fig.suptitle("Stage vulnerability by lesion model", fontsize=12)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    return path


def fig_profiles(les, path):
    """Severity-matched deficit profile per lesion model."""
    kinds = [k for k in KINDS if k in les.kind.unique()]
    conds = [c for c in S.CONDITIONS if c != "canonical"]
    fig, axes = plt.subplots(len(kinds), 1, figsize=(9.5, 3.3 * len(kinds)),
                             sharex=True)
    axes = np.atleast_1d(axes)
    x, w = np.arange(len(conds)), 0.2
    for ax, kind in zip(axes, kinds):
        tab, _ = dissociation_table(les, kind)
        if tab.empty:
            continue
        m = tab.groupby("stage")[conds].mean().reindex(STAGES)
        e = tab.groupby("stage")[conds].std().reindex(STAGES).fillna(0)
        for i, stage in enumerate(STAGES):
            if stage not in m.index or m.loc[stage].isna().all():
                continue
            ax.bar(x + (i - 1.5) * w, m.loc[stage], w, yerr=e.loc[stage],
                   capsize=2, color=STAGE_COLORS[stage], label=stage)
        ax.axhline(0.75, color="k", lw=1, ls="--")
        ax.set_ylabel("preservation")
        ax.set_title(KIND_LABEL[kind], fontsize=10)
        ax.grid(alpha=0.25, axis="y", lw=0.5)
    axes[0].legend(title="lesion site", fontsize=8, title_fontsize=8, ncol=4)
    axes[-1].set_xticks(x)
    axes[-1].set_xticklabels(conds, rotation=18, ha="right")
    fig.suptitle("Deficit profile with lesions equated on canonical performance",
                 fontsize=12)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    return path


def fig_dissociation(les, path):
    """Dissociation index with bootstrap intervals, all lesion models."""
    kinds = [k for k in KINDS if k in les.kind.unique()]
    fig, ax = plt.subplots(figsize=(7.6, 3.8))
    width = 0.8 / len(STAGES)
    for j, kind in enumerate(kinds):
        tab, _ = dissociation_table(les, kind)
        if tab.empty:
            continue
        for i, stage in enumerate(STAGES):
            v = tab[tab.stage == stage].dissociation.values
            if len(v) == 0:
                continue
            lo, hi = ci(v) if len(v) > 1 else (np.nan, np.nan)
            pos = j + (i - 1.5) * width
            ax.bar(pos, v.mean(), width, color=STAGE_COLORS[stage],
                   label=stage if j == 0 else None)
            if not np.isnan(lo):
                ax.plot([pos, pos], [lo, hi], color="k", lw=1.2)
    ax.axhline(0, color="k", lw=1)
    ax.set_xticks(range(len(kinds)))
    ax.set_xticklabels([KIND_LABEL[k] for k in kinds])
    ax.set_ylabel("transformation - degradation")
    ax.set_title("Dissociation index (positive = degraded stimuli suffer more)")
    ax.legend(title="lesion site", fontsize=8, title_fontsize=8, ncol=4)
    ax.grid(alpha=0.25, axis="y", lw=0.5)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    return path


if __name__ == "__main__":
    fname = sys.argv[1] if len(sys.argv) > 1 else "lesion_results_v2.csv"
    _, _, les = load(fname)
    print(fig_robustness(les, os.path.join(RESULTS, "fig1_robustness.png")))
    print(fig_profiles(les, os.path.join(RESULTS, "fig2_profiles.png")))
    print(fig_dissociation(les, os.path.join(RESULTS, "fig3_dissociation.png")))
