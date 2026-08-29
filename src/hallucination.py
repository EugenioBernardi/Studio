"""One recurrent mechanism, two syndromes, opposite signs.

Posterior cortical atrophy and the visual symptoms of Lewy body disease are
computational opposites. PCA is a failure to see: evidence is impoverished and
perception is under-determined. Lewy body hallucination and misidentification
are the reverse -- evidence is over-ridden by learned structure, producing
confident percepts of things that are not present. Recurrence is the machinery
that reconciles incoming evidence against learned structure across a visual
hierarchy, so both should be reachable by moving one signed quantity.

A single knob, the gain applied to the block state on refinement timesteps:

    g < 1   refinement attenuated   -> predicted apperceptive failure (PCA)
    g = 1   intact
    g > 1   refinement amplified    -> predicted false percepts (Lewy body)

Two read-outs. On signal-present trials, accuracy per stimulus condition, to
test whether attenuation is degradation-selective. On signal-absent trials --
noise fields and blob textures containing no letter at all, the analogue of the
noise pareidolia tests used clinically -- the confidence with which the model
reports a letter that is not there.
"""

import argparse, os, sys, time
import numpy as np, torch
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from scipy.ndimage import gaussian_filter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S
from cornet_s import CORblock_S
from model import STAGES, load_cornet_s, pool, stage_inputs

HERE = os.path.dirname(os.path.abspath(__file__))
WEIGHTS = os.path.join(HERE, "..", "data", "cornet_s.pth")
RESULTS = os.path.join(HERE, "..", "results")
BLOCKS = ["V2", "V4", "IT"]


def patched_forward(self, inp):
    """CORblock_S.forward with a gain applied to the state on refinement steps."""
    x = self.conv_input(inp)
    for t in range(self.times):
        if t == 0:
            skip = self.norm_skip(self.skip(x)); self.conv2.stride = (2, 2)
        else:
            skip = x; self.conv2.stride = (1, 1)
        x = self.conv1(x); x = getattr(self, f'norm1_{t}')(x); x = self.nonlin1(x)
        x = self.conv2(x); x = getattr(self, f'norm2_{t}')(x); x = self.nonlin2(x)
        x = self.conv3(x); x = getattr(self, f'norm3_{t}')(x)
        x += skip
        x = self.nonlin3(x)
        g = getattr(self, "_rgain", 1.0)
        if t > 0 and g != 1.0:
            x = x * g                                    # <-- the only change
        output = self.output(x)
    return output


CORblock_S.forward = patched_forward


def signal_absent(n, seed=7):
    """Stimuli containing no letter: noise fields and smoothed blob textures.

    Matched in luminance and rough spatial scale to the letter stimuli, so that
    a report of a letter reflects the model imposing structure rather than
    responding to a gross low-level difference.
    """
    rng = np.random.default_rng(seed)
    out, kind = [], []
    for i in range(n):
        which = i % 3
        if which == 0:                                   # white noise
            a = np.clip(rng.normal(0.75, 0.35, (S.IMG_SIZE,) * 2), 0, 1)
        elif which == 1:                                 # low-contrast noise
            a = np.clip(0.5 + rng.normal(0, 0.08, (S.IMG_SIZE,) * 2), 0, 1)
        else:                                            # blob texture
            f = gaussian_filter(rng.normal(0, 1, (S.IMG_SIZE,) * 2), sigma=9)
            f = (f - f.min()) / (np.ptp(f) + 1e-9)
            a = (f > 0.62).astype(np.float32)
            a = 1.0 - gaussian_filter(a, sigma=1.5) * 0.9
        out.append(a.astype(np.float32))
        kind.append(["white_noise", "low_contrast_noise", "blob_texture"][which])
    return np.stack(out), np.array(kind)


def main(a):
    torch.set_num_threads(4)
    t0 = time.time()
    tr_img, tr_y, _ = S.build_dataset(a.n_train, seed=1)
    te_img, te_y, te_c = S.build_dataset(a.n_test, seed=2)
    ab_img, ab_kind = signal_absent(a.n_absent)
    model = load_cornet_s(WEIGHTS)
    print(f"train {tr_img.shape} test {te_img.shape} absent {ab_img.shape}", flush=True)

    def feats(imgs, chunk=40):
        out = []
        for i in range(0, len(imgs), chunk):
            x = torch.from_numpy(S.to_model_input(imgs[i:i + chunk]))
            _, it = stage_inputs(model, x)
            out.append(pool(it))
        return np.concatenate(out)

    ftr = feats(tr_img)
    sc = StandardScaler().fit(ftr)
    probe = LogisticRegression(max_iter=3000, C=0.05).fit(sc.transform(ftr), tr_y)
    print(f"probe fitted [{time.time()-t0:.0f}s]", flush=True)

    fh = open(os.path.join(RESULTS, "hallucination.csv"), "w")
    fh.write("gain,scope,measure,group,value,n\n")

    for gain in a.gains:
        for scope in a.scopes:
            targets = BLOCKS if scope == "global" else [scope]
            for b in BLOCKS:
                getattr(model, b)._rgain = gain if b in targets else 1.0

            # signal present: accuracy by condition
            pred = probe.predict(sc.transform(feats(te_img)))
            for cond in S.CONDITIONS:
                m = te_c == cond
                fh.write(f"{gain},{scope},accuracy,{cond},"
                         f"{(pred[m]==te_y[m]).mean():.6f},{m.sum()}\n")

            # signal absent: confidence in a letter that is not there
            p = probe.predict_proba(sc.transform(feats(ab_img)))
            conf, ent = p.max(1), -(p * np.log(p + 1e-12)).sum(1)
            for k in np.unique(ab_kind):
                m = ab_kind == k
                fh.write(f"{gain},{scope},confidence,{k},{conf[m].mean():.6f},{m.sum()}\n")
                fh.write(f"{gain},{scope},entropy,{k},{ent[m].mean():.6f},{m.sum()}\n")
            fh.write(f"{gain},{scope},confidence,all_absent,{conf.mean():.6f},{len(conf)}\n")
            fh.flush()
            print(f"  gain={gain} scope={scope} acc={(pred==te_y).mean():.3f} "
                  f"absent_conf={conf.mean():.3f} [{time.time()-t0:.0f}s]", flush=True)

    for b in BLOCKS:
        getattr(model, b)._rgain = 1.0
    fh.close()
    print("done -> hallucination.csv", flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--n-train", type=int, default=30)
    p.add_argument("--n-test", type=int, default=10)
    p.add_argument("--n-absent", type=int, default=300)
    p.add_argument("--gains", type=float, nargs="+",
                   default=[0.55, 0.7, 0.85, 1.0, 1.15, 1.3, 1.5, 1.8])
    p.add_argument("--scopes", nargs="+", default=["global"])
    main(p.parse_args())
