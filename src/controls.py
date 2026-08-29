"""Controls establishing that the model is doing the work the paper claims.

Three questions a reviewer will ask, and should ask:
  1. Do the trained ventral-stream representations matter, or would raw pixels
     do as well? Letters are out of distribution for an ImageNet-trained model.
  2. Does the *training* matter, or would a randomly initialised network with the
     same architecture give the same competence? If random features suffice, the
     paper is not about the ventral stream.
  3. Does the hierarchy behave like a hierarchy -- does tolerance to identity-
     preserving transformation increase from V1 to IT, as it does in cortex?
"""

import os
import sys

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S
from cornet_s import CORnet_S
from model import STAGES, load_cornet_s, pool, stage_inputs

WEIGHTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "cornet_s.pth")


def all_stage_feats(model, images, chunk=40):
    out = {s: [] for s in STAGES}
    for i in range(0, len(images), chunk):
        x = torch.from_numpy(S.to_model_input(images[i:i + chunk]))
        with torch.no_grad():
            a = x
            for s in STAGES:
                a = getattr(model, s)(a)
                out[s].append(pool(a))
    return {s: np.concatenate(v) for s, v in out.items()}


def probe_acc(ftr, tr_y, fte, te_y, te_c):
    sc = StandardScaler().fit(ftr)
    p = LogisticRegression(max_iter=3000, C=0.05).fit(sc.transform(ftr), tr_y)
    pred = p.predict(sc.transform(fte))
    per = {c: float((pred[te_c == c] == te_y[te_c == c]).mean()) for c in S.CONDITIONS}
    return float((pred == te_y).mean()), per


def main():
    torch.set_num_threads(4)
    tr_img, tr_y, _ = S.build_dataset(20, seed=1)
    te_img, te_y, te_c = S.build_dataset(10, seed=2)
    print(f"train {tr_img.shape} test {te_img.shape}\n", flush=True)

    rows = {}

    # 1. Raw pixels, downsampled so the dimensionality is comparable.
    def px(imgs):
        t = torch.from_numpy(imgs)[:, None]
        return torch.nn.functional.avg_pool2d(t, 8).flatten(1).numpy()
    rows["pixels (28x28)"] = probe_acc(px(tr_img), tr_y, px(te_img), te_y, te_c)

    # 2. Randomly initialised CORnet-S, same architecture, no training.
    torch.manual_seed(0)
    untrained = CORnet_S()
    for m in untrained.modules():
        if isinstance(m, torch.nn.Conv2d):
            torch.nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
    untrained.eval()
    for p_ in untrained.parameters():
        p_.requires_grad_(False)
    u_tr, u_te = all_stage_feats(untrained, tr_img), all_stage_feats(untrained, te_img)
    for s in STAGES:
        rows[f"untrained {s}"] = probe_acc(u_tr[s], tr_y, u_te[s], te_y, te_c)

    # 3. Trained CORnet-S, every stage.
    model = load_cornet_s(WEIGHTS)
    t_tr, t_te = all_stage_feats(model, tr_img), all_stage_feats(model, te_img)
    for s in STAGES:
        rows[f"trained {s}"] = probe_acc(t_tr[s], tr_y, t_te[s], te_y, te_c)

    hdr = f"{'representation':>18s} {'overall':>8s} " + " ".join(f"{c[:9]:>9s}" for c in S.CONDITIONS)
    print(hdr)
    print("-" * len(hdr))
    for k, (ov, per) in rows.items():
        print(f"{k:>18s} {ov:8.3f} " + " ".join(f"{per[c]:9.3f}" for c in S.CONDITIONS), flush=True)

    print("\n=== hierarchy check: transformation tolerance relative to canonical ===")
    print("(transformation mean / canonical; should RISE V1->IT if invariance is built up)")
    for tag in ["untrained", "trained"]:
        vals = []
        for s in STAGES:
            _, per = rows[f"{tag} {s}"]
            tra = np.mean([per[c] for c in S.TRANSFORMATION])
            vals.append(tra / max(per["canonical"], 1e-6))
        print(f"  {tag:>9s}: " + "  ".join(f"{s}={v:.3f}" for s, v in zip(STAGES, vals)))


if __name__ == "__main__":
    main()
