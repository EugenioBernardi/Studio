"""Nonlinear warp of the atlases from FSL MNI152 (MNI152NLin6Asym) to the
ICBM152 2009c nonlinear symmetric template of the atrophy maps.

Reviewer point 4: the Schaefer atlas (and the Tian subcortical atlas) live on
FSL MNI152; the DBM t-maps live on ICBM2009cSym. Previously the atlas was only
resampled through world coordinates. Here the FSL MNI152 1 mm brain is
registered to the ICBM2009cSym brain with ANTs SyN, and the transform is applied
to the label images with nearest-label ("genericLabel") interpolation onto the
t-map grid.

Fixed image : ICBM152 2009c sym T1 (Zenodo 10383493), skull-stripped with the
              DBM brain mask (non-zero voxels of the AD t-map; identical for all maps)
Moving image: FSL 5.0.8 MNI152_T1_1mm_brain (CBIG repository)

Atlases warped: Schaefer-100/200/400 (7 networks) and Tian S1 (3T, 1 mm).
Tian S1's 16 labels are mapped to the 14 ENIGMA subcortical structures
(anterior + posterior thalamus merged) and appended after the cortical parcels,
in ENIGMA order: Laccumb Lamyg Lcaud Lhippo Lpal Lput Lthal Raccumb ... Rthal.

Usage: python -I 07_register_atlases.py <project_dir>
"""
import os
import sys
import json

import numpy as np
import nibabel as nib
import ants

root = sys.argv[1]
os.chdir(root)
out = "data/atlas_warped"
os.makedirs(out, exist_ok=True)
SCH = "data-raw/CBIG/stable_projects/brain_parcellation/Schaefer2018_LocalGlobal/Parcellations/MNI"
FSL_T1 = "data-raw/CBIG/data/templates/volume/FSL5.0.8_MNI_templates/MNI152_T1_1mm_brain.nii.gz"
ICBM_T1 = "data-raw/zenodo/mni_icbm152_t1_tal_nlin_sym_09c.nii"
TMAP = "data-raw/zenodo/AD_vs_Control_Tstat_Map_icbm152_nlin_sym.nii"
TIAN = "data-raw/tian/Group-Parcellation/3T/Subcortex-Only/Tian_Subcortex_S1_3T_1mm.nii.gz"
TIAN_LABELS = "data-raw/tian/Group-Parcellation/3T/Subcortex-Only/Tian_Subcortex_S1_3T_label.txt"

# --- fixed: ICBM T1 masked by the DBM brain mask (same grid as all t-maps)
t1 = nib.load(ICBM_T1)
mask = np.asarray(nib.load(TMAP).dataobj) != 0
assert np.allclose(t1.affine, nib.load(TMAP).affine) and t1.shape == mask.shape
fixed_np = np.asarray(t1.dataobj, dtype=np.float32) * mask
fixed_img = nib.Nifti1Image(fixed_np, t1.affine)
nib.save(fixed_img, f"{out}/icbm2009csym_brain.nii.gz")
fixed = ants.image_read(f"{out}/icbm2009csym_brain.nii.gz")
moving = ants.image_read(FSL_T1)

reg = ants.registration(fixed=fixed, moving=moving, type_of_transform="SyN", random_seed=20261121,
                        outprefix=f"{out}/fsl2icbm_")
warped = reg["warpedmovout"]
ants.image_write(warped, f"{out}/fsl_t1_in_icbm2009csym.nii.gz")


def corr_in_mask(a, b, m):
    return float(np.corrcoef(a[m], b[m])[0, 1])


def dice(a, b):
    return float(2 * np.sum(a & b) / (np.sum(a) + np.sum(b)))


# --- validation: before (world-coordinate resampling) vs after (SyN)
identity = ants.apply_transforms(fixed=fixed, moving=moving, transformlist=[], interpolator="linear")
fx = fixed.numpy(); idn = identity.numpy(); wp = warped.numpy()
m = fx > 0
val = {
    "intensity_r_before": corr_in_mask(fx, idn, m),
    "intensity_r_after": corr_in_mask(fx, wp, m),
    "brainmask_dice_before": dice(fx > 0, idn > 0),
    "brainmask_dice_after": dice(fx > 0, wp > 0),
}

# --- warp label images
tian_names = [l.strip() for l in open(TIAN_LABELS) if l.strip()]
enigma_order = ["Laccumb", "Lamyg", "Lcaud", "Lhippo", "Lpal", "Lput", "Lthal",
                "Raccumb", "Ramyg", "Rcaud", "Rhippo", "Rpal", "Rput", "Rthal"]
code = {"NAc": "accumb", "AMY": "amyg", "CAU": "caud", "HIP": "hippo", "GP": "pal", "PUT": "put", "pTHA": "thal", "aTHA": "thal"}
tian_to_enigma = {}
for i, n in enumerate(tian_names, start=1):
    struct, hemi = n.split("-")
    tian_to_enigma[i] = enigma_order.index(("L" if hemi == "lh" else "R") + code[struct]) + 1
val["tian_to_enigma"] = {tian_names[i - 1]: enigma_order[j - 1] for i, j in tian_to_enigma.items()}


def warp_labels(path):
    lab = ants.image_read(path)
    w = ants.apply_transforms(fixed=fixed, moving=lab, transformlist=reg["fwdtransforms"], interpolator="genericLabel")
    return np.rint(w.numpy()).astype(np.int32)


def nn_world(path):
    lab = ants.image_read(path)
    w = ants.apply_transforms(fixed=fixed, moving=lab, transformlist=[], interpolator="genericLabel")
    return np.rint(w.numpy()).astype(np.int32)


tian_w = warp_labels(TIAN)
tian_e = np.zeros_like(tian_w)
for i, j in tian_to_enigma.items():
    tian_e[tian_w == i] = j
nib.save(nib.Nifti1Image(tian_e, t1.affine), f"{out}/tian_s1_enigma14_icbm2009csym.nii.gz")
val["subcortex_voxels"] = {enigma_order[j - 1]: int(np.sum(tian_e == j)) for j in range(1, 15)}

for k in (100, 200, 400):
    path = f"{SCH}/Schaefer2018_{k}Parcels_7Networks_order_FSLMNI152_1mm.nii.gz"
    sw = warp_labels(path)
    sb = nn_world(path)
    nib.save(nib.Nifti1Image(sw, t1.affine), f"{out}/schaefer{k}_icbm2009csym.nii.gz")
    comb = sw.copy()
    sub = (tian_e > 0) & (comb == 0)
    comb[sub] = tian_e[sub] + k
    nib.save(nib.Nifti1Image(comb, t1.affine), f"{out}/schaefer{k}_tian14_icbm2009csym.nii.gz")
    lab = np.arange(1, k + 1)
    val[f"schaefer{k}"] = {
        "labels_surviving": int(len(np.intersect1d(np.unique(sw), lab))),
        "voxel_agreement_warped_vs_worldNN": float(np.mean(sw[(sw > 0) | (sb > 0)] == sb[(sw > 0) | (sb > 0)])),
        "cortex_in_dbm_mask_frac": float(np.mean(mask[sw > 0])),
        "subcortex_voxels_overlapping_cortex_labels": int(np.sum((tian_e > 0) & (sw > 0))),
    }
json.dump(val, open(f"{out}/registration_validation.json", "w"), indent=2)
print(json.dumps({k: v for k, v in val.items() if k != "tian_to_enigma"}, indent=1))
