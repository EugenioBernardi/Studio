"""Is the apperceptive profile about WHERE damage is, or about losing recurrence?

Every analysis so far treated lesion site as the variable of interest, and site
turned out to carry little information about the shape of the deficit. This
tests a different variable. Recognising fragmented, occluded and low-SNR forms
depends on recurrent computation rather than a single feedforward sweep [Tan17],
and degraded-form perception is exactly what fails in posterior cortical atrophy
while V1 is relatively spared -- awkward to explain anatomically, natural to
explain if what is lost is iterative refinement rather than a region.

CORnet's blocks reuse one set of convolutions across timesteps, so recurrence
cannot be lesioned by picking out separate weights. Instead damage is applied to
the block's state either on the first pass only (feedforward) or on the
refinement steps only (recurrent), at matched severity. The prediction is that
recurrent damage produces a degradation-selective deficit -- degraded stimuli
suffering disproportionately relative to transformed ones -- and feedforward
damage of equal overall magnitude does not.
"""

import argparse, os, sys, time
import numpy as np, torch
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S
from cornet_s import CORblock_S
from model import STAGES, Lesion, infer_channels, load_cornet_s, pool, stage_inputs

HERE = os.path.dirname(os.path.abspath(__file__))
WEIGHTS = os.path.join(HERE, "..", "data", "cornet_s.pth")
RESULTS = os.path.join(HERE, "..", "results")
BLOCKS = ["V2", "V4", "IT"]          # V1 is not recurrent in CORnet-S


def patched_forward(self, inp):
    """CORblock_S.forward, with damage applied on selected timesteps only.

    Identical to the original except for the two marked lines. `_les` is the
    lesion and `_mode` selects which timesteps it acts on: 'ff' the initial
    pass, 'rec' every refinement step after it.
    """
    x = self.conv_input(inp)
    for t in range(self.times):
        if t == 0:
            skip = self.norm_skip(self.skip(x))
            self.conv2.stride = (2, 2)
        else:
            skip = x
            self.conv2.stride = (1, 1)
        x = self.conv1(x)
        x = getattr(self, f'norm1_{t}')(x)
        x = self.nonlin1(x)
        x = self.conv2(x)
        x = getattr(self, f'norm2_{t}')(x)
        x = self.nonlin2(x)
        x = self.conv3(x)
        x = getattr(self, f'norm3_{t}')(x)
        x += skip
        x = self.nonlin3(x)
        les, mode = getattr(self, "_les", None), getattr(self, "_mode", None)
        if les is not None and ((mode == "ff" and t == 0) or (mode == "rec" and t > 0)):
            x = les.apply(x)                                   # <-- damage here
        output = self.output(x)
    return output


CORblock_S.forward = patched_forward


@torch.no_grad()
def run_from(model, stage, act_in, chunkwise):
    a = getattr(model, stage)(act_in)
    for s in STAGES[STAGES.index(stage) + 1:]:
        a = getattr(model, s)(a)
    return pool(a)


def main(a):
    torch.set_num_threads(4)
    t0 = time.time()
    tr_img, tr_y, _ = S.build_dataset(a.n_train, seed=1)
    te_img, te_y, te_c = S.build_dataset(a.n_test, seed=2)
    model = load_cornet_s(WEIGHTS)
    n_chan = {s: infer_channels(model, s) for s in STAGES}
    print(f"train {tr_img.shape} test {te_img.shape}", flush=True)

    def feats(imgs, chunk=40):
        out = []
        for i in range(0, len(imgs), chunk):
            x = torch.from_numpy(S.to_model_input(imgs[i:i + chunk]))
            _, it = stage_inputs(model, x)
            out.append(pool(it))
        return np.concatenate(out)

    sc = StandardScaler().fit(feats(tr_img))
    probe = LogisticRegression(max_iter=3000, C=0.05).fit(sc.transform(feats(tr_img)), tr_y)
    print(f"probe fitted [{time.time()-t0:.0f}s]", flush=True)

    def cache_stage(stage):
        """Inputs to one stage only. Caching all four at once exhausted memory."""
        parts = []
        for i in range(0, len(te_img), a.chunk):
            x = torch.from_numpy(S.to_model_input(te_img[i:i + a.chunk]))
            c, _ = stage_inputs(model, x)
            parts.append(c[stage])
        return torch.cat(parts)

    intact = feats(te_img)

    fh = open(os.path.join(RESULTS, "recurrence.csv"), "w")
    fh.write("kind,stage,severity,seed,condition,accuracy,n\n")

    def record(kind, stage, sev, seed, feat):
        pred = probe.predict(sc.transform(feat))
        for cond in S.CONDITIONS:
            m = te_c == cond
            fh.write(f"{kind},{stage},{sev},{seed},{cond},"
                     f"{(pred[m]==te_y[m]).mean():.6f},{m.sum()}\n")
        fh.flush()
        return (pred == te_y).mean()

    record("intact", "none", 0.0, 0, intact)

    grid = [(mode, st, sv, sd) for st in BLOCKS for mode in ["ff", "rec"]
            for sv in a.severities for sd in range(a.seeds)]
    cur_stage, cur_cache = None, None
    for n, (mode, st, sv, sd) in enumerate(grid, 1):
        if st != cur_stage:
            cur_cache = None
            cur_cache, cur_stage = cache_stage(st), st
        blk = getattr(model, st)
        blk._les = Lesion(st, "ablation", sv, n_chan[st], seed=sd)
        blk._mode = mode
        out = [run_from(model, st, cur_cache[i:i + a.chunk], None)
               for i in range(0, len(te_img), a.chunk)]
        blk._les = blk._mode = None
        acc = record(mode, st, sv, sd, np.concatenate(out))
        if n % 6 == 0 or n == len(grid):
            el = time.time() - t0
            print(f"  {n}/{len(grid)} {mode} {st} sev={sv} acc={acc:.3f} "
                  f"[{el:.0f}s, eta {el/n*(len(grid)-n)/60:.0f}m]", flush=True)
    fh.close()
    print("done -> recurrence.csv", flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--n-train", type=int, default=30)
    p.add_argument("--n-test", type=int, default=10)
    p.add_argument("--chunk", type=int, default=40)
    p.add_argument("--seeds", type=int, default=3)
    p.add_argument("--severities", type=float, nargs="+",
                   default=[0.08, 0.18, 0.30, 0.45, 0.62])
    main(p.parse_args())
