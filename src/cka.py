"""Layer-wise representational similarity under whole-network damage.

The existing literature's claim that later layers degrade more than early ones
[Moo25] is made with centred kernel alignment between the healthy and damaged
model, under damage applied to the whole network at once. Our behavioural
results are not comparable to it: they measure task accuracy under damage
confined to a single stage. This script reproduces the comparison on its own
terms -- whole-network damage, CKA as the measure -- so that the two literatures
can be related, and asks whether the CKA finding is itself lesion-model
dependent.
"""

import argparse
import os
import sys
import time

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S
from model import (STAGES, DecayLesion, GainLesion, Lesion, infer_channels,
                   load_cornet_s, pool)

HERE = os.path.dirname(os.path.abspath(__file__))
WEIGHTS = os.path.join(HERE, "..", "data", "cornet_s.pth")
RESULTS = os.path.join(HERE, "..", "results")


def linear_cka(X, Y):
    """Linear CKA between two n x p representation matrices."""
    X = X - X.mean(0, keepdims=True)
    Y = Y - Y.mean(0, keepdims=True)
    xy = np.linalg.norm(X.T @ Y, "fro") ** 2
    xx = np.linalg.norm(X.T @ X, "fro")
    yy = np.linalg.norm(Y.T @ Y, "fro")
    return float(xy / (xx * yy)) if xx > 0 and yy > 0 else np.nan


@torch.no_grad()
def all_stages(model, images, lesions=None, chunk=40):
    """Run the network with damage applied at every stage simultaneously."""
    out = {s: [] for s in STAGES}
    for i in range(0, len(images), chunk):
        a = torch.from_numpy(S.to_model_input(images[i:i + chunk]))
        for s in STAGES:
            a = getattr(model, s)(a)
            if lesions is not None and lesions.get(s) is not None:
                a = lesions[s].apply(a)
            out[s].append(pool(a))
    return {s: np.concatenate(v) for s, v in out.items()}


def run(args):
    torch.set_num_threads(4)
    t0 = time.time()
    img, _, _ = S.build_dataset(args.n, seed=2)
    model = load_cornet_s(WEIGHTS)
    n_chan = {s: infer_channels(model, s) for s in STAGES}
    intact = all_stages(model, img)
    print(f"intact reference computed [{time.time()-t0:.0f}s]", flush=True)

    path = os.path.join(RESULTS, "cka_whole_network.csv")
    fh = open(path, "w")
    fh.write("kind,severity,seed,stage,cka\n")

    grid = [(k, sv, sd) for k in args.kinds
            for sv in args.severities[k] for sd in range(args.seeds)]
    for n, (kind, sev, seed) in enumerate(grid, 1):
        decays = None
        if kind == "decay":
            decays = [DecayLesion(model, s, sev, seed=seed) for s in STAGES]
            for d in decays:
                d.apply_weights()
            les = None
        elif kind == "ablation":
            les = {s: Lesion(s, "ablation", sev, n_chan[s], seed=seed) for s in STAGES}
        else:
            les = {s: GainLesion(s, sev, n_chan[s], seed=seed) for s in STAGES}
        dmg = all_stages(model, img, les)
        if decays:
            for d in decays:
                d.restore()
        for s in STAGES:
            fh.write(f"{kind},{sev},{seed},{s},{linear_cka(intact[s], dmg[s]):.6f}\n")
        fh.flush()
        print(f"  {n}/{len(grid)} {kind} sev={sev} seed={seed} "
              f"[{time.time()-t0:.0f}s]", flush=True)
    fh.close()
    print(f"done -> {path}", flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--n", type=int, default=6)
    p.add_argument("--seeds", type=int, default=3)
    a = p.parse_args()
    a.kinds = ["ablation", "decay", "gain"]
    a.severities = {"ablation": [0.05, 0.10, 0.20, 0.35, 0.50],
                    "decay": [0.01, 0.03, 0.06, 0.10, 0.16],
                    "gain": [0.10, 0.20, 0.35, 0.50, 0.70]}
    run(a)
