"""Is the false-percept effect a percept, or just inflated activations?

Amplifying the recurrent state multiplies the magnitude of the IT feature
vector. A linear readout on inflated features produces inflated logits and a
saturated softmax, so confidence would rise towards one whatever the image
contained. That would look exactly like a hallucination while being nothing of
the kind.

Two diagnostics separate the accounts:
  1. Confidence on signal-PRESENT trials. Under inflation, confidence saturates
     there too, even as accuracy falls. A genuine false percept should not make
     the model equally certain about stimuli it is getting wrong.
  2. L2-normalising the IT feature vector before the readout removes magnitude
     while preserving the pattern. If the effect is scaling, it disappears.
"""
import sys, numpy as np, torch
sys.path.insert(0, '.')
import stimuli as S
from hallucination import patched_forward, signal_absent, BLOCKS, WEIGHTS
from model import load_cornet_s, pool, stage_inputs
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

torch.set_num_threads(4)
m = load_cornet_s(WEIGHTS)
tr, try_, _ = S.build_dataset(20, seed=1)
te, tey, tec = S.build_dataset(6, seed=2)
ab, _ = signal_absent(150)

def feats(imgs, chunk=40):
    out = []
    for i in range(0, len(imgs), chunk):
        x = torch.from_numpy(S.to_model_input(imgs[i:i+chunk]))
        _, it = stage_inputs(m, x); out.append(pool(it))
    return np.concatenate(out)

def l2(x): return x / (np.linalg.norm(x, axis=1, keepdims=True) + 1e-9)

ftr = feats(tr)
sc_r = StandardScaler().fit(ftr);      p_r = LogisticRegression(max_iter=3000, C=0.05).fit(sc_r.transform(ftr), try_)
sc_n = StandardScaler().fit(l2(ftr));  p_n = LogisticRegression(max_iter=3000, C=0.05).fit(sc_n.transform(l2(ftr)), try_)

print(f"{'gain':>5} | {'RAW: acc':>8} {'conf+':>6} {'conf-':>6} | {'L2: acc':>8} {'conf+':>6} {'conf-':>6} | {'|IT|':>7}")
print("-"*76)
for g in [0.85, 1.0, 1.15, 1.30, 1.50]:
    for b in BLOCKS: getattr(m, b)._rgain = g
    Fp, Fa = feats(te), feats(ab)
    norm = np.linalg.norm(Fp, axis=1).mean()
    row = [g]
    for sc, p, tf in ((sc_r, p_r, lambda z: z), (sc_n, p_n, l2)):
        pr = p.predict_proba(sc.transform(tf(Fp))); pa = p.predict_proba(sc.transform(tf(Fa)))
        row += [(pr.argmax(1) == tey).mean(), pr.max(1).mean(), pa.max(1).mean()]
    print(f"{row[0]:5.2f} | {row[1]:8.3f} {row[2]:6.3f} {row[3]:6.3f} | "
          f"{row[4]:8.3f} {row[5]:6.3f} {row[6]:6.3f} | {norm:7.1f}")
for b in BLOCKS: getattr(m, b)._rgain = 1.0
