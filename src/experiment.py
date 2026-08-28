"""Stage-wise lesioning of a ventral-stream model on a clinical-analogue battery.

Logic of the design. A linear readout is trained on IT activations of the intact
model across the whole battery, so the healthy model can perform every test --
the analogue of a patient whose visual system was competent before disease
onset. The readout is then frozen and damage is introduced at one stage at a
time. Any change in performance is therefore caused by the lesion, not by
re-learning around it.

The outcome of interest is not overall accuracy but the *profile* of accuracy
across stimulus conditions, because that is what distinguishes apperceptive from
associative deficits clinically.
"""

import argparse
import itertools
import os
import sys
import time

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S
from model import (STAGES, Lesion, forward_from, infer_channels, load_cornet_s,
                   pool, stage_inputs)

WEIGHTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "cornet_s.pth")
RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")


def extract_intact(model, images, chunk=50):
    feats = []
    for i in range(0, len(images), chunk):
        x = torch.from_numpy(S.to_model_input(images[i:i + chunk]))
        _, it = stage_inputs(model, x)
        feats.append(pool(it))
    return np.concatenate(feats)


def run(args):
    os.makedirs(RESULTS, exist_ok=True)
    torch.set_num_threads(args.threads)
    t0 = time.time()

    print("generating stimuli", flush=True)
    tr_img, tr_y, tr_c = S.build_dataset(args.n_train, seed=1)
    te_img, te_y, te_c = S.build_dataset(args.n_test, seed=2)
    print(f"  train {tr_img.shape} test {te_img.shape}", flush=True)

    model = load_cornet_s(WEIGHTS)
    n_chan = {s: infer_channels(model, s) for s in STAGES}

    print("extracting intact training features", flush=True)
    tr_feat = extract_intact(model, tr_img)
    scaler = StandardScaler().fit(tr_feat)
    probe = LogisticRegression(max_iter=3000, C=0.05)
    probe.fit(scaler.transform(tr_feat), tr_y)
    print(f"  probe train acc {probe.score(scaler.transform(tr_feat), tr_y):.3f} "
          f"[{time.time()-t0:.0f}s]", flush=True)

    out_path = os.path.join(RESULTS, "lesion_results.csv")
    fh = open(out_path, "w")
    fh.write("kind,stage,severity,seed,condition,accuracy,n\n")

    def record(kind, stage, sev, seed, pred):
        for cond in S.CONDITIONS:
            m = te_c == cond
            fh.write(f"{kind},{stage},{sev},{seed},{cond},"
                     f"{(pred[m] == te_y[m]).mean():.6f},{m.sum()}\n")
        fh.flush()

    # Lesion grid, evaluated chunk-wise so that upstream activations are
    # computed once per chunk and reused by every grid point.
    grid = [("ablation", sev, seed)
            for sev in args.severities for seed in range(args.ablation_seeds)]
    grid += [("noise", sev, seed)
             for sev in args.severities for seed in range(args.noise_seeds)]

    keys = [(k, st, sv, sd) for (k, sv, sd) in grid for st in STAGES]
    logits = {k: [] for k in keys}
    intact_feats = []

    n_chunks = int(np.ceil(len(te_img) / args.chunk))
    for ci in range(n_chunks):
        sl = slice(ci * args.chunk, (ci + 1) * args.chunk)
        x = torch.from_numpy(S.to_model_input(te_img[sl]))
        cache, it_intact = stage_inputs(model, x)
        intact_feats.append(pool(it_intact))
        for (kind, stage, sev, seed) in keys:
            les = Lesion(stage, kind, sev, n_chan[stage], seed=seed)
            logits[(kind, stage, sev, seed)].append(
                pool(forward_from(model, stage, cache[stage], les)))
        print(f"  chunk {ci+1}/{n_chunks} [{time.time()-t0:.0f}s]", flush=True)

    intact_feats = np.concatenate(intact_feats)
    intact_pred = probe.predict(scaler.transform(intact_feats))
    record("intact", "none", 0.0, 0, intact_pred)
    print(f"intact overall acc {(intact_pred == te_y).mean():.3f}", flush=True)

    for key, parts in logits.items():
        kind, stage, sev, seed = key
        pred = probe.predict(scaler.transform(np.concatenate(parts)))
        record(kind, stage, sev, seed, pred)

    fh.close()
    np.save(os.path.join(RESULTS, "test_labels.npy"), te_y)
    np.save(os.path.join(RESULTS, "test_conditions.npy"), te_c)
    print(f"done in {time.time()-t0:.0f}s -> {out_path}", flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--n-train", type=int, default=30)
    p.add_argument("--n-test", type=int, default=10)
    p.add_argument("--chunk", type=int, default=50)
    p.add_argument("--threads", type=int, default=4)
    p.add_argument("--ablation-seeds", type=int, default=3)
    p.add_argument("--noise-seeds", type=int, default=2)
    p.add_argument("--severities", type=float, nargs="+",
                   default=[0.1, 0.2, 0.3, 0.45, 0.6])
    run(p.parse_args())
