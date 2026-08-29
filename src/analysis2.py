"""Severity-matched analysis with inference.

The first run reported means and standard deviations over three lesion seeds,
which is not enough to say whether a dissociation index differs from zero or
between stages. Here every effect gets an interval and a test.

The primary contrast is pre-specified: early (V1, V2) minus late (V4, IT)
dissociation index. H1 and H2 jointly predict this to be positive. It is tested
by permuting stage labels across the (stage, seed) observations, which is valid
under the null that stage carries no information about deficit shape.
"""

import os
import sys

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, "..", "results")
STAGES = ["V1", "V2", "V4", "IT"]
EARLY, LATE = ["V1", "V2"], ["V4", "IT"]
RNG = np.random.default_rng(0)


def load(fname):
    df = pd.read_csv(os.path.join(RESULTS, fname))
    intact = df[df.kind == "intact"].set_index("condition").accuracy
    les = df[df.kind != "intact"].copy()
    les["intact_acc"] = les.condition.map(intact)
    chance = 1.0 / len(S.LETTERS)
    les["preservation"] = ((les.accuracy - chance) /
                           (les.intact_acc - chance).clip(lower=1e-6)).clip(0, 1.5)
    return df, intact, les


def monotone(sev, pres):
    """Isotonic (non-increasing) fit of a preservation curve.

    Damage cannot help, so preservation is non-increasing in severity by
    construction. Fitting that constraint before locating a crossing keeps
    sampling noise in a single point from displacing the matched severity, which
    raw first-crossing search is highly sensitive to.
    """
    if len(sev) < 2:
        return pres
    return IsotonicRegression(increasing=False, out_of_bounds="clip").fit(
        sev, pres).predict(sev)


def matched_severity(sub, target=0.75, ref="canonical"):
    r = sub[sub.condition == ref].sort_values("severity")
    sev, pres = r.severity.values, monotone(r.severity.values, r.preservation.values)
    below = np.where(pres <= target)[0]
    if len(below) == 0:
        return np.nan
    i = below[0]
    if i == 0:
        return sev[0]
    x0, x1, y0, y1 = sev[i - 1], sev[i], pres[i - 1], pres[i]
    return x1 if y0 == y1 else x0 + (y0 - target) * (x1 - x0) / (y0 - y1)


def dissociation_table(les, kind, target=0.75):
    rows, dropped = [], 0
    k = les[les.kind == kind]
    for stage in STAGES:
        for seed in sorted(k.seed.unique()):
            sub = k[(k.stage == stage) & (k.seed == seed)]
            if sub.empty:
                continue
            sev = matched_severity(sub, target)
            if np.isnan(sev):
                dropped += 1
                continue
            prof = {}
            for c in S.CONDITIONS:
                rc = sub[sub.condition == c].sort_values("severity")
                prof[c] = float(np.interp(
                    sev, rc.severity.values,
                    monotone(rc.severity.values, rc.preservation.values)))
            deg = np.mean([prof[c] for c in S.DEGRADATION])
            tra = np.mean([prof[c] for c in S.TRANSFORMATION])
            rows.append(dict(stage=stage, seed=seed, matched_severity=sev, **prof,
                             degradation=deg, transformation=tra,
                             dissociation=tra - deg))
    return pd.DataFrame(rows), dropped


def ci(x, n_boot=10000):
    x = np.asarray(x, dtype=float)
    if len(x) < 2:
        return (np.nan, np.nan)
    b = RNG.choice(x, size=(n_boot, len(x)), replace=True).mean(axis=1)
    return tuple(np.percentile(b, [2.5, 97.5]))


def perm_contrast(tab, n_perm=20000):
    """Early-minus-late dissociation, with stage labels permuted under the null."""
    d = tab.dissociation.values
    stages = tab.stage.values
    obs = d[np.isin(stages, EARLY)].mean() - d[np.isin(stages, LATE)].mean()
    n_early = np.isin(stages, EARLY).sum()
    null = np.empty(n_perm)
    for i in range(n_perm):
        p = RNG.permutation(len(d))
        null[i] = d[p[:n_early]].mean() - d[p[n_early:]].mean()
    return obs, (np.abs(null) >= abs(obs)).mean()


def sign_test(x, n_perm=20000):
    """Two-sided permutation test that the mean of x is zero, by sign flips."""
    x = np.asarray(x, dtype=float)
    obs = x.mean()
    flips = RNG.choice([-1, 1], size=(n_perm, len(x)))
    null = (flips * x).mean(axis=1)
    return obs, (np.abs(null) >= abs(obs)).mean()


def report(fname="lesion_results_v2.csv"):
    df, intact, les = load(fname)
    print("=== intact accuracy ===")
    print(intact.round(3).to_string())

    for kind in ["ablation", "decay", "gain"]:
        if kind not in les.kind.unique():
            continue
        print(f"\n{'='*66}\n{kind.upper()}")
        piv = (les[(les.kind == kind) & (les.condition == "canonical")]
               .pivot_table(index="stage", columns="severity", values="preservation")
               .reindex(STAGES))
        print("\ncanonical preservation by stage x severity:")
        print(piv.round(3).to_string())

        overall = (les[les.kind == kind].groupby("stage").preservation.mean()
                   .reindex(STAGES))
        print("\nmean preservation across all conditions (robustness ordering):")
        print(overall.round(3).sort_values(ascending=False).to_string())

        tab, dropped = dissociation_table(les, kind)
        if tab.empty:
            print(f"  no cell reached the matching target ({dropped} dropped)")
            continue
        if dropped:
            print(f"  [{dropped} stage-seed cells never reached the target and were dropped]")

        print("\nseverity-matched profile (mean over seeds):")
        cols = S.CONDITIONS + ["degradation", "transformation", "dissociation",
                               "matched_severity"]
        print(tab.groupby("stage")[cols].mean().reindex(STAGES).round(3).to_string())

        print("\ndissociation index by stage [95% bootstrap CI], p vs 0:")
        for stage in STAGES:
            x = tab[tab.stage == stage].dissociation.values
            if len(x) < 2:
                continue
            lo, hi = ci(x)
            m, p = sign_test(x)
            print(f"  {stage}: {m:+.3f} [{lo:+.3f}, {hi:+.3f}]  n={len(x)}  p={p:.3f}")

        if tab.stage.nunique() == len(STAGES):
            obs, p = perm_contrast(tab)
            print(f"\nPRIMARY CONTRAST early(V1,V2) - late(V4,IT) dissociation: "
                  f"{obs:+.3f}, permutation p={p:.4f}")
        tab.to_csv(os.path.join(RESULTS, f"dissociation2_{kind}.csv"), index=False)


if __name__ == "__main__":
    report(sys.argv[1] if len(sys.argv) > 1 else "lesion_results_v2.csv")
