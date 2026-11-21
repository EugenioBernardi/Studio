"""Brain renderings of the Schaefer-400 results on fsaverage5.

Parcel values are painted onto vertices with the ENIGMA fsaverage5 Schaefer
annotations (same mesh and vertex order as nilearn's bundled fsaverage5) and
shown on the inflated surface with sulcal depth as background.

Usage: python -I 05_brain_figures.py <project_dir>
Inputs : output/maps/parcel_maps_k400.csv, parcel_map_stats_k400.csv (scripts/04_export_maps.R)
Outputs: figures/brain_*.png
"""
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import nibabel as nib
from matplotlib.colors import LinearSegmentedColormap, ListedColormap
from nilearn import datasets, plotting, surface, image

root = sys.argv[1]
os.chdir(root)
os.makedirs("figures", exist_ok=True)
fs = datasets.fetch_surf_fsaverage("fsaverage5")
ENIGMA = "data-raw/ENIGMA/enigmatoolbox"
SCH = "data-raw/CBIG/stable_projects/brain_parcellation/Schaefer2018_LocalGlobal/Parcellations/MNI"
K = 400

maps = pd.read_csv("output/maps/parcel_maps_k400.csv")
stats = pd.read_csv("output/maps/parcel_map_stats_k400.csv")
info = pd.read_csv("output/maps/parcel_info_k400.csv")

# vertex -> parcel index (0 = medial wall), checked against the ENIGMA label order
labels, names = {}, {}
offset = {"left": 0, "right": K // 2}
for h, side in (("lh", "left"), ("rh", "right")):
    lab, _, nm = nib.freesurfer.read_annot(f"{ENIGMA}/permutation_testing/annot/fsa5_{h}_schaefer_{K}.annot")
    nm = [x.decode() for x in nm]
    assert nm[1:] == list(info.label[offset[side]:offset[side] + K // 2]), "annot order != parcel order"
    labels[side] = np.where(lab > 0, lab + offset[side], 0)

# blue <-> red diverging map with a light neutral midpoint (red = more atrophy)
DIV = LinearSegmentedColormap.from_list("div", ["#184f95", "#3987e5", "#9ec5f4", "#f0efec", "#f4a3a2", "#e34948", "#a32424"])
SEQ = LinearSegmentedColormap.from_list("seq", ["#f0efec", "#f6c9a6", "#eb6834", "#a8401c", "#5c1f0b"])
VIEWS = [("left", "lateral"), ("left", "medial"), ("right", "lateral"), ("right", "medial")]
VIEW_TITLES = ["Left lateral", "Left medial", "Right lateral", "Right medial"]


def to_vertices(values, side):
    """Parcel vector (length K, parcel order) -> vertex array; medial wall NaN."""
    v = np.full(labels[side].shape, np.nan)
    m = labels[side] > 0
    v[m] = np.asarray(values)[labels[side][m] - 1]
    return v


def draw(ax, values, side, view, cmap, vmin, vmax):
    plotting.plot_surf(fs[f"infl_{side}"], to_vertices(values, side), hemi=side, view=view,
                       bg_map=fs[f"sulc_{side}"], bg_on_data=True, cmap=cmap,
                       vmin=vmin, vmax=vmax, axes=ax, colorbar=False)
    ax.set_box_aspect(None, zoom=1.35) if hasattr(ax, "set_box_aspect") else None


def get(syn, mp):
    return maps[(maps.syndrome == syn) & (maps["map"] == mp)].sort_values("parcel").value.values


def grid(rows, title, fname, cmap=DIV, symmetric=True, row_scale=True, cbar_label="z", note=None):
    """rows: list of (row label, parcel values)."""
    n = len(rows)
    fig = plt.figure(figsize=(13.5, 2.55 * n + 1.2))
    allv = np.concatenate([np.asarray(v) for _, v in rows])
    for i, (lab, vals) in enumerate(rows):
        vals = np.asarray(vals, float)
        src = vals if row_scale else allv
        if symmetric:
            vmax = np.nanpercentile(np.abs(src), 99); vmin = -vmax
        else:
            vmin, vmax = np.nanmin(src), np.nanpercentile(src, 99)
        for j, (side, view) in enumerate(VIEWS):
            ax = fig.add_subplot(n, 5, i * 5 + j + 1, projection="3d")
            draw(ax, vals, side, view, cmap, vmin, vmax)
            if i == 0:
                ax.set_title(VIEW_TITLES[j], fontsize=10, color="#52514e")
        cax = fig.add_subplot(n, 5, i * 5 + 5)
        cax.axis("off")
        cax.text(0.0, 0.78, lab, fontsize=10.5, fontweight="bold", color="#0b0b0b", va="top", wrap=True)
        sm = plt.cm.ScalarMappable(cmap=cmap, norm=plt.Normalize(vmin, vmax))
        cb = fig.colorbar(sm, ax=cax, orientation="horizontal", fraction=0.18, pad=0.02, aspect=12)
        cb.ax.tick_params(labelsize=8, colors="#52514e"); cb.outline.set_visible(False)
        cb.set_label(cbar_label, fontsize=8, color="#52514e")
    H = 2.55 * n + 1.2
    fig.suptitle(title, fontsize=13, x=0.02, y=1 - 0.12 / H, ha="left", va="top", color="#0b0b0b")
    if note:
        fig.text(0.02, 0.005, note, fontsize=8.5, color="#52514e", ha="left", va="bottom")
    fig.subplots_adjust(left=0.0, right=0.99, top=1 - 0.85 / H, bottom=0.35 / H, wspace=-0.05, hspace=0.0)
    fig.savefig(f"figures/{fname}", dpi=130, facecolor="#fcfcfb")
    plt.close(fig)
    print("wrote", fname)


# ---------------------------------------------------------------- 1. atlas
lut = pd.read_csv(f"{SCH}/freeview_lut/Schaefer2018_{K}Parcels_7Networks_order.txt", sep=r"\s+", header=None)
rgb = lut.iloc[:, 2:5].values / 255.0
assert list(lut.iloc[:, 1]) == list(info.label)
net_cmap = ListedColormap(rgb)
fig = plt.figure(figsize=(13.5, 3.4))
for j, (side, view) in enumerate(VIEWS):
    ax = fig.add_subplot(1, 4, j + 1, projection="3d")
    plotting.plot_surf(fs[f"infl_{side}"], to_vertices(np.arange(1, K + 1), side), hemi=side, view=view,
                       bg_map=fs[f"sulc_{side}"], bg_on_data=True, cmap=net_cmap, vmin=0.5, vmax=K + 0.5,
                       axes=ax, colorbar=False)
    ax.set_title(VIEW_TITLES[j], fontsize=10, color="#52514e")
nets = ["Vis", "SomMot", "DorsAttn", "SalVentAttn", "Limbic", "Cont", "Default"]
handles = [plt.Line2D([0], [0], marker="s", ls="", ms=9, color=rgb[info.index[info.network == n][0]]) for n in nets]
fig.legend(handles, ["Visual", "Somatomotor", "Dorsal attention", "Salience / ventral attention", "Limbic", "Control", "Default"],
           loc="lower center", ncol=7, frameon=False, fontsize=9)
fig.suptitle("Schaefer-400, 7 networks (CBIG colours) on fsaverage5, as used for all analyses", fontsize=12, x=0.02, ha="left")
fig.subplots_adjust(left=0, right=1, top=0.86, bottom=0.12, wspace=-0.05)
fig.savefig("figures/brain_atlas_schaefer400.png", dpi=130, facecolor="#fcfcfb"); plt.close(fig)
print("wrote brain_atlas_schaefer400.png")

# volumetric atlas on the analysis grid (nearest-neighbour, as in the parcellation)
tpl = image.load_img("data-raw/zenodo/mni_icbm152_t1_tal_nlin_sym_09c.nii")
atl = image.resample_to_img(f"{SCH}/Schaefer2018_{K}Parcels_7Networks_order_FSLMNI152_1mm.nii.gz", tpl, interpolation="nearest",
                            force_resample=True, copy_header=True)
vol_cmap = ListedColormap(np.vstack([[0, 0, 0], rgb]))
fig = plt.figure(figsize=(13.5, 3.2))
d = plotting.plot_roi(atl, bg_img=tpl, display_mode="z", cut_coords=[-24, -10, 4, 18, 32, 46, 60], cmap=vol_cmap,
                      vmin=0, vmax=K, alpha=0.75, figure=fig, black_bg=False, annotate=True, draw_cross=False, colorbar=False)
fig.suptitle("Schaefer-400 resampled (nearest neighbour) to the ICBM152 2009c grid of the atrophy maps", fontsize=12, x=0.02, ha="left")
fig.savefig("figures/brain_atlas_volume.png", dpi=130, facecolor="#fcfcfb"); plt.close(fig)
print("wrote brain_atlas_volume.png")

# ---------------------------------------------------------------- 2. atrophy, all syndromes
order = ["AD", "MCI", "PD", "FTD", "bvFTD", "svPPA", "nfvPPA"]
grid([(s, get(s, "atrophy")) for s in order], "Parcel atrophy (−t), Schaefer-400; red = more atrophy",
     "brain_atrophy_all.png", cbar_label="atrophy (−t)",
     note="Colour scale set per syndrome (99th percentile of |value|): the FTD-variant maps are on a ~10× smaller scale than the others.")

# volumetric projection for two syndromes
tmap_grid = image.load_img("data-raw/zenodo/AD_vs_Control_Tstat_Map_icbm152_nlin_sym.nii")
atl_t = image.resample_to_img(f"{SCH}/Schaefer2018_{K}Parcels_7Networks_order_FSLMNI152_1mm.nii.gz", tmap_grid, interpolation="nearest",
                              force_resample=True, copy_header=True)
L = np.asarray(atl_t.get_fdata()).astype(int)
fig = plt.figure(figsize=(13.5, 6.0))
for i, s in enumerate(["AD", "bvFTD"]):
    vals = get(s, "atrophy")
    vol = np.zeros(L.shape); vol[L > 0] = vals[L[L > 0] - 1]
    img = nib.Nifti1Image(vol, atl_t.affine)
    vmax = float(np.percentile(np.abs(vals), 99))
    ax = fig.add_axes([0, 0.5 - i * 0.48, 1, 0.44])
    plotting.plot_stat_map(img, bg_img=tpl, display_mode="z", cut_coords=[-28, -16, -4, 8, 20, 32, 44], cmap=DIV, vmax=vmax,
                           symmetric_cbar=True, threshold=1e-6, axes=ax, black_bg=False, draw_cross=False, title=f"{s}: parcel atrophy painted into the atlas volume")
fig.savefig("figures/brain_atrophy_volume.png", dpi=130, facecolor="#fcfcfb"); plt.close(fig)
print("wrote brain_atrophy_volume.png")

# ---------------------------------------------------------------- 3. epicentres
primary = ["AD", "bvFTD", "svPPA", "nfvPPA"]
rows = []
for s in primary:
    rows.append((f"{s}\nepicentre score", get(s, "epicentre_score")))
grid(rows, "Epicentre score = mean rank of atrophy and SC-neighbour atrophy ; darkest = strongest epicentre candidates",
     "brain_epicentres.png", cmap=SEQ, symmetric=False, cbar_label="score (mean rank / 400; 1 = top)",
     note="Top-10 epicentres (see report tables): AD medial/anterior temporal; bvFTD orbitofrontal + anterior insula; svPPA left temporal pole; nfvPPA left frontal operculum, FEF/SMA.")

# top-10 epicentres only, highlighted on grey
fig = plt.figure(figsize=(13.5, 2.55 * 4 + 0.9))
for i, s in enumerate(primary):
    top = get(s, "epicentre_top10")
    vals = np.where(top > 0, 1.0, np.nan)
    for j, (side, view) in enumerate(VIEWS):
        ax = fig.add_subplot(4, 5, i * 5 + j + 1, projection="3d")
        v = to_vertices(np.nan_to_num(vals, nan=0.0), side); v[v == 0] = np.nan
        plotting.plot_surf(fs[f"infl_{side}"], v, hemi=side, view=view, bg_map=fs[f"sulc_{side}"], bg_on_data=True,
                           cmap=ListedColormap(["#e34948"]), vmin=0, vmax=1, axes=ax, colorbar=False)
        if i == 0: ax.set_title(VIEW_TITLES[j], fontsize=10, color="#52514e")
    ax = fig.add_subplot(4, 5, i * 5 + 5); ax.axis("off")
    ep = maps[(maps.syndrome == s) & (maps["map"] == "epicentre_score")].sort_values("value", ascending=False).head(10)
    names_top = [info.label[p - 1].replace("7Networks_", "") for p in ep.parcel]
    ax.text(0, 0.95, s + " top-10", fontweight="bold", fontsize=10.5, va="top")
    ax.text(0, 0.78, "\n".join(names_top), fontsize=7.2, va="top", color="#52514e", family="monospace")
fig.suptitle("Top-10 epicentres (red) per syndrome, Schaefer-400", fontsize=13, x=0.02, y=0.995, ha="left", va="top")
fig.subplots_adjust(left=0, right=0.99, top=0.92, bottom=0.01, wspace=-0.05, hspace=0.0)
fig.savefig("figures/brain_epicentres_top10.png", dpi=130, facecolor="#fcfcfb"); plt.close(fig)
print("wrote brain_epicentres_top10.png")

# ---------------------------------------------------------------- 4. model reconstructions
def r_of(s, m):
    return float(stats[(stats.syndrome == s) & (stats["map"] == m)].r.iloc[0])

for s in primary:
    rows = [(f"{s} observed\n(z-scored)", get(s, "atrophy_z")),
            (f"SC-neighbour prediction\nr = {r_of(s, 'pred_SC'):.2f}", get(s, "pred_SC")),
            (f"FC-neighbour prediction\nr = {r_of(s, 'pred_FC'):.2f}", get(s, "pred_FC")),
            (f"Distance-only prediction\nr = {r_of(s, 'pred_distance'):.2f}", get(s, "pred_distance")),
            ("Residual after distance", get(s, "resid_distance")),
            ("Residual after distance + FC", get(s, "resid_distance_FC"))]
    grid(rows, f"{s}: observed atrophy and its reconstruction from other regions' atrophy (Schaefer-400)",
         f"brain_models_{s}.png", note="Each prediction: P_i = weighted mean of other parcels' atrophy (weights = SC, FC, or exp(−d/λ) with fitted λ). All maps z-scored; residuals from linear regression.")

# ---------------------------------------------------------------- 5. eigenmode reconstructions
rows = []
for s in primary:
    rows += [(f"{s} observed", get(s, "atrophy_z")),
             (f"geometric modes, K=20\nr = {r_of(s, 'recon_geometric_K20'):.2f}", get(s, "recon_geometric_K20")),
             (f"SC harmonics, K=20\nr = {r_of(s, 'recon_SC_K20'):.2f}", get(s, "recon_SC_K20")),
             (f"FC harmonics, K=20\nr = {r_of(s, 'recon_FC_K20'):.2f}", get(s, "recon_FC_K20"))]
for part, sl in (("AD_bvFTD", slice(0, 8)), ("svPPA_nfvPPA", slice(8, 16))):
    grid(rows[sl], "Atrophy reconstructed from the first 20 eigenmodes of each basis (least squares)",
         f"brain_eigen_recon_{part}.png", note="Geometric = Laplace–Beltrami modes of the cortical surface (fsaverage5, medial wall removed), averaged within parcels; SC/FC harmonics = eigenvectors of the normalised graph Laplacian.")

# ---------------------------------------------------------------- 5b. homotopic asymmetry
asym_syn = ["AD", "MCI", "bvFTD", "svPPA", "nfvPPA"]
fig = plt.figure(figsize=(9.5, 2.5 * len(asym_syn) + 1.2))
vmax = max(np.nanpercentile(np.abs(get(s, "asym_LminusR")), 99) for s in asym_syn)
for i, s in enumerate(asym_syn):
    vals = get(s, "asym_LminusR")
    for j, view in enumerate(["lateral", "medial"]):
        ax = fig.add_subplot(len(asym_syn), 3, i * 3 + j + 1, projection="3d")
        draw(ax, vals, "left", view, DIV, -vmax, vmax)
        if i == 0: ax.set_title(f"Left hemisphere, {view}", fontsize=10, color="#52514e")
    ax = fig.add_subplot(len(asym_syn), 3, i * 3 + 3); ax.axis("off")
    ax.text(0, 0.6, s, fontsize=11, fontweight="bold", va="center")
cax = fig.add_axes([0.66, 0.062, 0.28, 0.013])
cb = fig.colorbar(plt.cm.ScalarMappable(cmap=DIV, norm=plt.Normalize(-vmax, vmax)), cax=cax, orientation="horizontal")
cb.set_label("left − right atrophy at the mirror location (SD units)", fontsize=8); cb.ax.tick_params(labelsize=8); cb.outline.set_visible(False)
fig.suptitle("Homotopic asymmetry: red = left more atrophic than the mirror-image right location", fontsize=12, x=0.02, y=0.995, ha="left", va="top")
fig.text(0.02, 0.005, "Each left parcel is compared with the identical region mirrored to the right (symmetric template), so atlas non-homotopy cannot create asymmetry.", fontsize=8, color="#52514e")
fig.subplots_adjust(left=0, right=0.99, top=0.95, bottom=0.07, wspace=-0.05, hspace=0.0)
fig.savefig("figures/brain_asymmetry.png", dpi=130, facecolor="#fcfcfb"); plt.close(fig)
print("wrote brain_asymmetry.png")

# ---------------------------------------------------------------- 6. the bases themselves
G = pd.read_csv("data/eigenmodes/geometric_modes_schaefer400.csv")
ev = pd.read_csv("data/eigenmodes/geometric_eigenvalues.csv")
order_cols = np.argsort(np.r_[ev.lh.values, ev.rh.values], kind="stable")
Gm = G.values[:, order_cols]
rows = [(f"geometric mode {i}", Gm[:, i]) for i in (2, 3, 4, 5)]
grid(rows, "First non-constant geometric eigenmodes (parcel averages)", "brain_geometric_modes.png",
     cbar_label="mode amplitude", note="Modes are computed per hemisphere and ordered by eigenvalue across hemispheres.")
from PIL import Image
os.makedirs("figures/web", exist_ok=True)
for f in sorted(os.listdir("figures")):
    if f.endswith(".png"):
        im = Image.open(f"figures/{f}").convert("RGB")
        if im.width > 1500:
            im = im.resize((1500, round(im.height * 1500 / im.width)), Image.LANCZOS)
        im.save(f"figures/web/{f[:-4]}.jpg", quality=85, optimize=True)
print("done")
