"""Geodesic (along-cortex) distances between Schaefer parcels on fsaverage5.

Reviewer point 1: Euclidean distance cuts across sulci and fissures. Here the
distance between two parcels is the shortest path along the cortical
midthickness surface ((pial + white) / 2, nilearn's bundled fsaverage5, same
mesh as the ENIGMA annotations) between the parcels' centroid vertices
(data/sphere_centroids_schaefer{k}.csv), computed with the heat method
(Crane et al. 2013; potpourri3d). Plain Dijkstra along mesh edges was rejected:
on the fsaverage5 sphere it gave 664 mm for the pole-to-pole distance (exact
314 mm), whereas the heat method gave 312 mm. The medial wall is removed from
the mesh, so paths cannot cut across it. Pairs in different hemispheres have no
cortical path and are set to Inf. The matrix is symmetrised ((G + G^T) / 2).

Usage: python -I 10_geodesic_distance.py <project_dir>
Writes data/v2/geodesic_schaefer{k}.csv (k x k, mm; Inf across hemispheres)
"""
import os
import sys

import numpy as np
import nibabel as nib
import pandas as pd
import potpourri3d as pp3d
from nilearn import datasets, surface

os.chdir(sys.argv[1])
fs = datasets.fetch_surf_fsaverage("fsaverage5")
ENIGMA = "data-raw/ENIGMA/enigmatoolbox"

for k in (100, 200, 400):
    cen = pd.read_csv(f"data/sphere_centroids_schaefer{k}.csv")
    G = np.full((k, k), np.inf)
    offset = 0
    for h, side in (("lh", "left"), ("rh", "right")):
        pial, faces = surface.load_surf_mesh(fs[f"pial_{side}"])
        white, faces_w = surface.load_surf_mesh(fs[f"white_{side}"])
        assert np.array_equal(faces, faces_w)
        mid = (np.asarray(pial) + np.asarray(white)) / 2
        lab, _, _ = nib.freesurfer.read_annot(f"{ENIGMA}/permutation_testing/annot/fsa5_{h}_schaefer_{k}.annot")
        keep = lab > 0                                    # drop medial wall
        f = np.asarray(faces)
        f = f[np.all(keep[f], axis=1)]
        remap = -np.ones(len(keep), int); remap[keep] = np.arange(keep.sum())
        V, F = mid[keep], remap[f]
        solver = pp3d.MeshHeatMethodDistanceSolver(V, F)
        rows = cen[cen.hemi == h]
        src = rows.vertex.values.astype(int)
        assert keep[src].all(), "centroid vertex on medial wall"
        s_sub = remap[src]
        D = np.vstack([solver.compute_distance(int(v))[s_sub] for v in s_sub])
        D = (D + D.T) / 2
        idx = np.arange(offset, offset + len(src))
        G[np.ix_(idx, idx)] = D
        offset += len(src)
    assert np.isfinite(G[:k // 2, :k // 2]).all() and np.isfinite(G[k // 2:, k // 2:]).all(), "disconnected parcels"
    np.savetxt(f"data/v2/geodesic_schaefer{k}.csv", G, delimiter=",", fmt="%.4f")
    within = G[np.isfinite(G) & (G > 0)]
    print(f"schaefer {k}: geodesic within-hemisphere median {np.median(within):.1f} mm, max {within.max():.1f} mm")
