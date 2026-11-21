"""Geometric (Laplace-Beltrami) eigenmodes of the cortical surface, parcellated.

Following Pang et al. 2023 (Nature): eigenmodes of the LBO on the cortical
mesh with the medial wall removed, solved as the generalized eigenproblem
K phi = lambda M phi (cotangent stiffness K, lumped mass M), per hemisphere.
Modes are then averaged within Schaefer parcels.

Usage: python -I geometric_eigenmodes.py <enigmatoolbox_dir> <out_dir> [n_modes]
Writes <out_dir>/geometric_modes_schaefer{100,200,400}.csv
(rows = parcels in ENIGMA/Schaefer order; columns = hemisphere-specific modes,
with eigenvalues in <out_dir>/geometric_eigenvalues.csv), and a sphere check.
"""
import sys
import numpy as np
import nibabel as nib
import scipy.sparse as sp
from scipy.sparse.linalg import eigsh

base, out = sys.argv[1], sys.argv[2]
n_modes = int(sys.argv[3]) if len(sys.argv) > 3 else 200


def lbo(verts, faces):
    """Cotangent stiffness matrix and lumped (barycentric) mass matrix."""
    n = verts.shape[0]
    I, J, V = [], [], []
    area = np.zeros(n)
    for k in range(3):
        i, j, l = faces[:, k], faces[:, (k + 1) % 3], faces[:, (k + 2) % 3]
        e1, e2 = verts[i] - verts[l], verts[j] - verts[l]
        cross = np.linalg.norm(np.cross(e1, e2), axis=1)
        cot = np.einsum("ij,ij->i", e1, e2) / np.maximum(cross, 1e-12)
        I += [i, j]; J += [j, i]; V += [0.5 * cot, 0.5 * cot]
    tri_area = 0.5 * np.linalg.norm(np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]]), axis=1)
    for k in range(3):
        np.add.at(area, faces[:, k], tri_area / 3)
    W = sp.coo_matrix((np.concatenate(V), (np.concatenate(I), np.concatenate(J))), shape=(n, n)).tocsr()
    K = sp.diags(np.asarray(W.sum(axis=1)).ravel()) - W
    return K, sp.diags(area)


def modes(verts, faces, k):
    K, M = lbo(verts, faces)
    vals, vecs = eigsh(K, k=k, M=M, sigma=-1e-6, which="LM")
    o = np.argsort(vals)
    return vals[o], vecs[:, o]


def submesh(verts, faces, keep):
    idx = -np.ones(len(verts), int); idx[keep] = np.arange(keep.sum())
    f = faces[np.all(keep[faces], axis=1)]
    return verts[keep], idx[f]


# ---- check on the fsaverage5 sphere (radius 100): lambda_l = l(l+1)/100^2
g = nib.load(f"{base}/datasets/surfaces/fsa5_sphere_lh.gii")
v, f = g.darrays[0].data.astype(float), g.darrays[1].data.astype(int)
vals, _ = modes(v, f, 16)
expected = np.repeat([l * (l + 1) for l in range(4)], [1, 3, 5, 7]) / 100.0 ** 2
np.savetxt(f"{out}/sphere_check.csv", np.c_[vals, expected], delimiter=",", header="lambda,expected", comments="")
print("sphere check max rel. error (modes 2-16):", np.max(np.abs(vals[1:] - expected[1:]) / expected[1:]))

# ---- cortex modes per hemisphere (medial wall removed using the Schaefer-400 annot)
hemi_modes, hemi_vals, keep_masks = {}, {}, {}
for h in ("lh", "rh"):
    g = nib.load(f"{base}/datasets/surfaces/fsa5_{h}.gii")
    v, f = g.darrays[0].data.astype(float), g.darrays[1].data.astype(int)
    lab400, _, _ = nib.freesurfer.read_annot(f"{base}/permutation_testing/annot/fsa5_{h}_schaefer_400.annot")
    keep = lab400 > 0
    sv, sf = submesh(v, f, keep)
    vals, vecs = modes(sv, sf, n_modes)
    full = np.full((len(v), n_modes), np.nan); full[keep] = vecs
    hemi_modes[h], hemi_vals[h], keep_masks[h] = full, vals, keep
    print(h, "vertices kept", keep.sum(), "first eigenvalues", np.round(vals[:4], 6))

np.savetxt(f"{out}/geometric_eigenvalues.csv", np.c_[hemi_vals["lh"], hemi_vals["rh"]], delimiter=",", header="lh,rh", comments="")

for k in (100, 200, 400):
    cols = []
    rows_all = []
    for h in ("lh", "rh"):
        lab, _, names = nib.freesurfer.read_annot(f"{base}/permutation_testing/annot/fsa5_{h}_schaefer_{k}.annot")
        P = np.zeros((len(names) - 1, n_modes))
        for p in range(1, len(names)):
            sel = (lab == p) & keep_masks[h]
            P[p - 1] = np.nanmean(hemi_modes[h][sel], axis=0)
        rows_all.append(P)
    # block structure: LH modes are 0 on RH parcels and vice versa
    nl, nr = rows_all[0].shape[0], rows_all[1].shape[0]
    B = np.zeros((nl + nr, 2 * n_modes))
    B[:nl, :n_modes] = rows_all[0]
    B[nl:, n_modes:] = rows_all[1]
    hdr = ",".join([f"lh_{i+1}" for i in range(n_modes)] + [f"rh_{i+1}" for i in range(n_modes)])
    np.savetxt(f"{out}/geometric_modes_schaefer{k}.csv", B, delimiter=",", header=hdr, comments="")
    print(f"schaefer {k}: basis {B.shape}")
