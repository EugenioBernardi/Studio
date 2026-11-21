"""Brain figures for the revised manuscript (warped atlas, PD dropped).

Cortical values on fsaverage5 (inflated, sulcal background) via the ENIGMA
Schaefer-400 annotations; subcortical values as a compact glyph panel (14
structures, left/right). Inputs: output/maps_v2/node_maps_sub414.csv.
Usage: python -I 14_brain_figures_v2.py <project_dir>
"""
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import nibabel as nib
from matplotlib.colors import LinearSegmentedColormap
from nilearn import datasets, plotting

os.chdir(sys.argv[1])
os.makedirs("figures/v2", exist_ok=True)
fs = datasets.fetch_surf_fsaverage("fsaverage5")
ENIGMA = "data-raw/ENIGMA/enigmatoolbox"
K = 400
maps = pd.read_csv("output/maps_v2/node_maps_sub414.csv")
DIV = LinearSegmentedColormap.from_list("div", ["#184f95", "#3987e5", "#9ec5f4", "#f0efec", "#f4a3a2", "#e34948", "#a32424"])
SEEDC = LinearSegmentedColormap.from_list("seed", ["#f0efec", "#eb6834"])
SUB = ["accumb", "amyg", "caud", "hippo", "pal", "put", "thal"]
SUBNAME = {"accumb": "Accumbens", "amyg": "Amygdala", "caud": "Caudate*", "hippo": "Hippocampus", "pal": "Pallidum", "put": "Putamen", "thal": "Thalamus"}
INK, MUTED, BG = "#0b0b0b", "#52514e", "#fcfcfb"

labels = {}
for h, side, off in (("lh", "left", 0), ("rh", "right", K // 2)):
    lab, _, _ = nib.freesurfer.read_annot(f"{ENIGMA}/permutation_testing/annot/fsa5_{h}_schaefer_{K}.annot")
    labels[side] = np.where(lab > 0, lab + off, 0)


def vert(vals, side):
    v = np.full(labels[side].shape, np.nan); m = labels[side] > 0
    v[m] = np.asarray(vals)[labels[side][m] - 1]
    return v


def get(s, m):
    x = maps[(maps.syndrome == s) & (maps["map"] == m)].sort_values("node")
    return x.value.values


def brain(ax, vals, side, view, cmap, vmin, vmax):
    plotting.plot_surf(fs[f"infl_{side}"], vert(vals[:K], side), hemi=side, view=view, bg_map=fs[f"sulc_{side}"],
                       bg_on_data=True, cmap=cmap, vmin=vmin, vmax=vmax, axes=ax, colorbar=False)


def subcortex(ax, vals, cmap, vmin, vmax, first_row):
    """14 structures: rows = structures, columns = L/R; boxes coloured on the cortical
    scale (clipped) and labelled with their value, so saturation hides nothing."""
    sv = np.asarray(vals[K:K + 14])
    ax.set_xlim(-2.5, 1.55); ax.set_ylim(-1.0, 6.6); ax.invert_yaxis(); ax.axis("off")
    norm = plt.Normalize(vmin, vmax, clip=True)
    for i, s in enumerate(SUB):
        for j in range(2):
            v = sv[j * 7 + i]
            c = cmap(norm(v)) if np.isfinite(v) else (0.87, 0.87, 0.87, 1)
            ax.add_patch(plt.Rectangle((j - 0.45, i - 0.42), 0.9, 0.84, color=c, ec=BG, lw=1))
            lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
            ax.text(j, i, f"{v:.2g}", ha="center", va="center", fontsize=5.8, color="white" if lum < 0.5 else INK)
        ax.text(-0.6, i, SUBNAME[s], ha="right", va="center", fontsize=7, color=MUTED)
    if first_row:
        ax.text(0, -0.9, "L", ha="center", va="center", fontsize=7.5, color=MUTED)
        ax.text(1, -0.9, "R", ha="center", va="center", fontsize=7.5, color=MUTED)


VIEWS = [("left", "lateral"), ("left", "medial"), ("right", "lateral"), ("right", "medial")]
VT = ["Left lateral", "Left medial", "Right lateral", "Right medial"]


def figure_rows(rows, title, fname, cmap=DIV, symmetric=True, note=None, cb_label="", show_sub=True, scale_note=None):
    n = len(rows)
    H = 2.15 * n + 1.1
    fig = plt.figure(figsize=(11.5, H), facecolor=BG)
    gs = fig.add_gridspec(n, 7, width_ratios=[0.8, 1, 1, 1, 1, 1.15, 0.38], left=0.01, right=0.99, top=1 - 0.75 / H, bottom=0.45 / H, wspace=0.03, hspace=0.05)
    for i, (lab, vals) in enumerate(rows):
        vals = np.asarray(vals, float)
        fin = vals[:K][np.isfinite(vals[:K])]          # colour scale from cortex only
        if symmetric:
            vmax = np.percentile(np.abs(fin), 99); vmin = -vmax
        else:
            vmin, vmax = 0, max(fin.max(), 1e-9)
        ax = fig.add_subplot(gs[i, 0]); ax.axis("off")
        ax.text(0.02, 0.5, lab, fontsize=10, fontweight="bold", color=INK, va="center", ha="left", wrap=True)
        for j, (side, view) in enumerate(VIEWS):
            a = fig.add_subplot(gs[i, j + 1], projection="3d")
            brain(a, vals, side, view, cmap, vmin, vmax)
            if i == 0:
                a.set_title(VT[j], fontsize=8.5, color=MUTED, pad=-4)
        if show_sub and len(vals) > K:
            a = fig.add_subplot(gs[i, 5]); subcortex(a, vals, cmap, vmin, vmax, i == 0)
            if i == 0:
                a.set_title("Subcortex (value printed)", fontsize=8.5, color=MUTED, pad=9)
        cax = fig.add_subplot(gs[i, 6]); cax.axis("off")
        ins = cax.inset_axes([0.15, 0.2, 0.18, 0.6])
        cb = fig.colorbar(plt.cm.ScalarMappable(cmap=cmap, norm=plt.Normalize(vmin, vmax)), cax=ins)
        cb.ax.tick_params(labelsize=7, colors=MUTED); cb.outline.set_visible(False)
        if cb_label:
            cb.set_label(cb_label, fontsize=7, color=MUTED)
    fig.text(0.01, 1 - 0.25 / H, title, fontsize=12.5, color=INK, ha="left", va="top")
    if note:
        fig.text(0.01, 0.06 / H, note, fontsize=7.5, color=MUTED, ha="left", va="bottom")
    fig.savefig(f"figures/v2/{fname}", dpi=150, facecolor=BG)
    plt.close(fig)
    print("wrote", fname)


order = ["AD", "MCI", "bvFTD", "svPPA", "nfvPPA", "FTD"]
figure_rows([(s, get(s, "atrophy")) for s in order], "Figure 1. Atrophy topography (−t), cortex and subcortex",
            "fig1_atrophy.png", cb_label="atrophy (−t)",
            note="Colour scale per syndrome, set from the cortex (99th percentile of |value|); subcortical boxes use the same scale, clipped, with values printed.\n"
                 "Subcortical values from the structure core (≥ 3 mm from CSF). *Caudate is dominated by DBM ventricular expansion.")
figure_rows([(s, get(s, "asym_LminusR")) for s in ["AD", "MCI", "bvFTD", "svPPA", "nfvPPA"]],
            "Homotopic asymmetry: left minus mirrored-right atrophy (SD units), shown on the left hemisphere",
            "fig_asymmetry.png", cb_label="L − R (SD)", show_sub=False)

# seeds of the best generative models (bilateral or unilateral)
rows = []
for s in ["AD", "bvFTD", "svPPA", "nfvPPA"]:
    for m, lab in (("seed_NDM_SC", "network diffusion (SC)"), ("seed_spread_euclid", "spatial spread")):
        rows.append((f"{s}\n{lab}", get(s, m)))
figure_rows(rows, "Best seeds of the generative models (orange = seed)", "fig_seeds.png", cmap=SEEDC, symmetric=False)

# individual web copies
from PIL import Image
os.makedirs("figures/v2/web", exist_ok=True)
for f in sorted(os.listdir("figures/v2")):
    if f.endswith(".png"):
        im = Image.open(f"figures/v2/{f}").convert("RGB")
        if im.width > 1500:
            im = im.resize((1500, round(im.height * 1500 / im.width)), Image.LANCZOS)
        im.save(f"figures/v2/web/{f[:-4]}.jpg", quality=86, optimize=True)
print("done")
