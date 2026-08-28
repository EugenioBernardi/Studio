"""Strengthened lesion experiment.

Three changes from the first run, each addressing a specific weakness rather
than a hoped-for result:

1. Three lesion models instead of one. Channel ablation (unit loss), synaptic
   weight deletion (the model used by the existing in-silico neurodegeneration
   literature) and channel gain dysregulation (surviving but disordered tissue).
   If deficit shape is invariant to lesion site under all three, that is a much
   stronger negative than under one; if it is not, the first run's negative was
   an artefact of channel ablation.
2. Two transformation conditions (rotated, sheared) rather than one, so the
   family that carries half the central contrast does not rest on a single
   manipulation.
3. Six to eight lesion seeds per cell rather than three, enough to put an
   interval on the dissociation index.

All stage inputs are computed once and held in memory, so the lesion grid is an
outer loop and results are written incrementally.
"""

import argparse
import os
import sys
import time

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S
from model import (STAGES, DecayLesion, GainLesion, Lesion, forward_from,
                   infer_channels, load_cornet_s, pool, stage_inputs)

HERE = os.path.dirname(os.path.abspath(__file__))
WEIGHTS = os.path.join(HERE, "..", "data", "cornet_s.pth")
RESULTS = os.path.join(HERE, "..", "results")


def build_cache(model, images, chunk=40):
    """Stage inputs for every stimulus, computed once and reused by all lesions."""
    parts = {s: [] for s in STAGES}
    intact = []
    for i in range(0, len(images), chunk):
        x = torch.from_numpy(S.to_model_input(images[i:i + chunk]))
        cache, it = stage_inputs(model, x)
        for s in STAGES:
            parts[s].append(cache[s])
        intact.append(pool(it))
    return {s: torch.cat(v) for s, v in parts.items()}, np.concatenate(intact)


def make_lesion(model, kind, stage, sev, seed, n_chan):
    if kind == "ablation":
        return Lesion(stage, "ablation", sev, n_chan[stage], seed=seed)
    if kind == "gain":
        return GainLesion(stage, sev, n_chan[stage], seed=seed)
    if kind == "decay":
        return DecayLesion(model, stage, sev, seed=seed)
    raise ValueError(kind)


def run(args):
    os.makedirs(RESULTS, exist_ok=True)
    torch.set_num_threads(args.threads)
    t0 = time.time()

    tr_img, tr_y, _ = S.build_dataset(args.n_train, seed=1)
    te_img, te_y, te_c = S.build_dataset(args.n_test, seed=2)
    print(f"train {tr_img.shape} test {te_img.shape}", flush=True)

    model = load_cornet_s(WEIGHTS)
    n_chan = {s: infer_channels(model, s) for s in STAGES}

    _, tr_feat = build_cache(model, tr_img)
    scaler = StandardScaler().fit(tr_feat)
    probe = LogisticRegression(max_iter=3000, C=0.05).fit(scaler.transform(tr_feat), tr_y)
    print(f"probe train acc {probe.score(scaler.transform(tr_feat), tr_y):.3f} "
          f"[{time.time()-t0:.0f}s]", flush=True)

    cache, intact_feat = build_cache(model, te_img)
    print(f"cached stage inputs [{time.time()-t0:.0f}s]", flush=True)

    out_path = os.path.join(RESULTS, args.out)
    fh = open(out_path, "w")
    fh.write("kind,stage,severity,seed,condition,accuracy,n\n")

    def record(kind, stage, sev, seed, feats):
        pred = probe.predict(scaler.transform(feats))
        for cond in S.CONDITIONS:
            m = te_c == cond
            fh.write(f"{kind},{stage},{sev},{seed},{cond},"
                     f"{(pred[m] == te_y[m]).mean():.6f},{m.sum()}\n")
        fh.flush()
        return (pred == te_y).mean()

    record("intact", "none", 0.0, 0, intact_feat)

    grid = []
    for kind in args.kinds:
        for sev in args.severities[kind]:
            for seed in range(args.seeds[kind]):
                grid.append((kind, sev, seed))

    total = len(grid) * len(STAGES)
    done = 0
    for (kind, sev, seed) in grid:
        for stage in STAGES:
            les = make_lesion(model, kind, stage, sev, seed, n_chan)
            if isinstance(les, DecayLesion):
                les.apply_weights()
            feats = []
            for i in range(0, len(te_img), args.chunk):
                feats.append(pool(forward_from(
                    model, stage, cache[stage][i:i + args.chunk],
                    None if isinstance(les, DecayLesion) else les)))
            if isinstance(les, DecayLesion):
                les.restore()
            acc = record(kind, stage, sev, seed, np.concatenate(feats))
            done += 1
            if done % 4 == 0 or done == total:
                el = time.time() - t0
                print(f"  {done}/{total} {kind} {stage} sev={sev} seed={seed} "
                      f"acc={acc:.3f} [{el:.0f}s, eta {el/done*(total-done)/60:.0f}m]",
                      flush=True)
    fh.close()
    print(f"done in {time.time()-t0:.0f}s -> {out_path}", flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--n-train", type=int, default=30)
    p.add_argument("--n-test", type=int, default=8)
    p.add_argument("--chunk", type=int, default=40)
    p.add_argument("--threads", type=int, default=4)
    p.add_argument("--out", default="lesion_results_v2.csv")
    p.add_argument("--calibrate", action="store_true")
    a = p.parse_args()

    a.kinds = ["ablation", "decay", "gain"]
    if a.calibrate:
        a.n_train, a.n_test = 10, 3
        a.severities = {"ablation": [0.1, 0.2, 0.35, 0.5, 0.7],
                        "decay": [0.1, 0.25, 0.45, 0.65, 0.85],
                        "gain": [0.25, 0.5, 1.0, 1.6, 2.4]}
        a.seeds = {"ablation": 1, "decay": 1, "gain": 1}
        a.out = "calibration.csv"
    else:
        a.severities = {"ablation": [0.08, 0.16, 0.26, 0.40, 0.55],
                        "decay": [0.1, 0.25, 0.45, 0.65, 0.85],
                        "gain": [0.25, 0.5, 1.0, 1.6, 2.4]}
        a.seeds = {"ablation": 6, "decay": 6, "gain": 5}
    run(a)
