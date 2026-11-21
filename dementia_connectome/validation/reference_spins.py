"""1000 Hungarian spin permutations from neuromaps, for validating R/nulls.R.
Usage: python -I reference_spins.py <sphere_centroids.csv> <out.csv>"""
import sys, csv
import numpy as np
from neuromaps.nulls.spins import gen_spinsamples
rows = list(csv.DictReader(open(sys.argv[1])))
xyz = np.array([[float(r["x"]), float(r["y"]), float(r["z"])] for r in rows])
hemi = np.array([0 if r["hemi"] == "lh" else 1 for r in rows])
spins = gen_spinsamples(xyz, hemi, n_rotate=1000, method="hungarian", seed=1234)
np.savetxt(sys.argv[2], spins, delimiter=",", fmt="%d")
print(spins.shape)
