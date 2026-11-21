"""Reference values from bctpy / netneurotools for validating R/communication.R.

Usage: python -I reference_bctpy.py <W.csv> <Dist.csv> <out_dir>
W: SC with negative weights already set to 0. Dist: Euclidean centroid distances.
"""
import sys, time
import numpy as np
import bct
from netneurotools import metrics

W = np.loadtxt(sys.argv[1], delimiter=","); Dist = np.loadtxt(sys.argv[2], delimiter=","); out = sys.argv[3]
np.fill_diagonal(W, 0)
L = W.copy(); L[W > 0] = 1 / W[W > 0]

def save(name, X):
    np.savetxt(f"{out}/{name}.csv", X, delimiter=",", fmt="%.17g")

t = time.time(); D, _ = bct.distance_wei(L); save("bct_distance_wei", D); print("distance_wei", round(time.time() - t, 1), "s")
t = time.time(); save("nnt_communicability_wei", metrics.communicability_wei(W)); print("communicability_wei", round(time.time() - t, 1), "s")
t = time.time(); save("bct_mfpt", bct.mean_first_passage_time(W)); print("mfpt", round(time.time() - t, 1), "s")
t = time.time(); _, Ed = bct.diffusion_efficiency(W); save("bct_diffusion_efficiency", Ed); print("diffusion_efficiency", round(time.time() - t, 1), "s")
def search_information_np2(adj):
    """bct.search_information(transform='inv', has_memory=False) with one fix:
    bctpy 0.6.1 crashes under NumPy 2 because retrieve_shortest_path returns a
    (k, 1) array; the path is flattened. Floyd-Warshall and path retrieval are
    bctpy's own functions."""
    N = adj.shape[0]
    T = np.linalg.solve(np.diag(np.sum(adj, axis=1)), adj)
    _, hops, Pmat = bct.distance_wei_floyd(adj, "inv")
    SI = np.zeros((N, N))
    for i in range(N):
        for j in range(N):
            if i == j:
                continue
            path = np.asarray(bct.retrieve_shortest_path(i, j, hops, Pmat)).ravel()
            if path.size == 0:
                SI[i, j] = np.inf
                continue
            SI[i, j] = -np.log2(np.prod([T[path[z], path[z + 1]] for z in range(path.size - 1)]))
    return SI

t = time.time(); SI = search_information_np2(W); save("bct_search_information", SI); print("search_information", round(time.time() - t, 1), "s")
t = time.time(); sr, PLbin, PLwei, PLdis, _ = bct.navigation_wu(L, Dist); save("bct_nav_PLwei", PLwei); save("bct_nav_PLbin", PLbin); print("navigation_wu", round(time.time() - t, 1), "s, success", sr)
