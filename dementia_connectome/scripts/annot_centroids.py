"""Parcel centroids on the fsaverage5 sphere, for the parcel-level spin test.

Written for this project because connectomeR's inst/validation/annot_centroids.py
was not available (the connectomeR_0.2.0 tarball was not supplied). Method, after
Vasa et al. 2018 (centroid_extraction_sphere.m) and the ENIGMA toolbox:
  1. for each parcel, average the sphere coordinates of its vertices;
  2. take the sphere vertex nearest to that mean as the parcel centroid.
The medial-wall label (index 0) is dropped. Output rows follow the annot's own
label order, and the script checks that order against the ENIGMA matrix labels.

Usage: python -I annot_centroids.py <enigmatoolbox_dir> <n_parcels> <out_csv>
"""
import csv
import sys

import nibabel as nib
import numpy as np

base, n, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]

ref = open(f"{base}/datasets/matrices/hcp_connectivity/strucLabels_ctx_schaefer_{n}.csv").read().strip().split(",")

rows = []
for hemi in ("lh", "rh"):
    labels, _, names = nib.freesurfer.read_annot(f"{base}/permutation_testing/annot/fsa5_{hemi}_schaefer_{n}.annot")
    names = [x.decode() for x in names]
    xyz = nib.load(f"{base}/datasets/surfaces/fsa5_sphere_{hemi}.gii").darrays[0].data.astype(float)
    for k, name in enumerate(names):
        if k == 0:
            assert name.startswith("Background"), name
            continue
        idx = np.where(labels == k)[0]
        if idx.size == 0:
            raise SystemExit(f"parcel {name} has no vertices on fsa5 {hemi}")
        m = xyz[idx].mean(axis=0)
        v = idx[np.argmin(((xyz[idx] - m) ** 2).sum(axis=1))]  # nearest vertex within the parcel
        nearest_any = np.argmin(((xyz - m) ** 2).sum(axis=1))
        rows.append([name, hemi, *xyz[v], idx.size, int(v), int(nearest_any == v)])

got = [r[0] for r in rows]
if got != ref:
    bad = [i for i, (a, b) in enumerate(zip(got, ref)) if a != b]
    raise SystemExit(f"annot label order differs from ENIGMA labels at {len(bad)} positions, first: {bad[:5]}")

with open(out, "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["label", "hemi", "x", "y", "z", "n_vertices", "vertex", "nearest_vertex_in_parcel"])
    w.writerows(rows)
print(f"schaefer_{n}: {len(rows)} centroids, label order matches ENIGMA")
