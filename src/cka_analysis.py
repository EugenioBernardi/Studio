"""Is the 'later layers degrade more' result itself lesion-model dependent?

[Moo25] reports that later layers lose representational similarity to the
healthy model faster than early ones, under whole-network synaptic decay,
measured by CKA. This asks the same question of the same measure under three
damage mechanisms, to see whether that ordering is a fact about the hierarchy
or about the damage model used to probe it.
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analysis2 import RESULTS, STAGES, RNG

def perm_trend(df, n=20000):
    """Is CKA lower at later stages? Spearman of CKA against stage depth."""
    depth = {s: i for i, s in enumerate(STAGES)}
    d = df.stage.map(depth).values.astype(float)
    c = df.cka.values
    obs = np.corrcoef(np.argsort(np.argsort(d)), np.argsort(np.argsort(c)))[0, 1]
    null = np.array([np.corrcoef(np.argsort(np.argsort(d)),
                                 np.argsort(np.argsort(RNG.permutation(c))))[0, 1]
                     for _ in range(n)])
    return obs, (np.abs(null) >= abs(obs)).mean()

def main():
    df = pd.read_csv(os.path.join(RESULTS, "cka_whole_network.csv"))
    for kind in ["ablation", "decay", "gain"]:
        k = df[df.kind == kind]
        if k.empty:
            continue
        print(f"\n=== {kind}: CKA(healthy, damaged) by stage x severity ===")
        print(k.pivot_table(index="stage", columns="severity", values="cka")
              .reindex(STAGES).round(3).to_string())
        mean = k.groupby("stage").cka.mean().reindex(STAGES)
        print("\nmean CKA by stage:", "  ".join(f"{s}={mean[s]:.3f}" for s in STAGES))
        r, p = perm_trend(k)
        direction = ("later layers degrade MORE" if r < 0 else
                     "EARLY layers degrade more" if r > 0 else "flat")
        print(f"rank correlation of CKA with depth: {r:+.3f} (p={p:.4f}) -> {direction}")

if __name__ == "__main__":
    main()
