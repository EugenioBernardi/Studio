"""Severity-matched analysis of the lesion profiles.

The problem this solves. A lesion at V1 and a lesion at IT of nominally the same
severity are not comparable: the same proportion of silenced channels does not
mean the same amount of functional damage at different levels of the hierarchy.
Comparing raw deficit profiles across stages therefore confounds *where* the
damage is with *how bad* it is.

The fix is to equate lesions on a reference condition before comparing them on
the rest. Canonical stimuli play the role of the clinician's basic screening
test: for each stage we find the severity at which canonical performance has
fallen to a fixed fraction of intact, and only then ask what has happened to the
harder conditions. Any residual difference between stages is then a difference
in the *shape* of the deficit, not its magnitude.
"""

import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stimuli as S

RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")
STAGES = ["V1", "V2", "V4", "IT"]


def load():
    df = pd.read_csv(os.path.join(RESULTS, "lesion_results.csv"))
    intact = (df[df.kind == "intact"].set_index("condition").accuracy)
    les = df[df.kind != "intact"].copy()
    les["intact_acc"] = les.condition.map(intact)
    # Preservation: fraction of the intact model's competence that survives.
    # Expressed relative to chance so that a stimulus condition the intact model
    # already finds hard is not automatically scored as more impaired.
    chance = 1.0 / len(S.LETTERS)
    les["preservation"] = ((les.accuracy - chance) /
                           (les.intact_acc - chance).clip(lower=1e-6)).clip(0, 1.5)
    return df, intact, les


def matched_severity(sub, target, ref="canonical"):
    """Severity at which the reference condition's preservation hits `target`.

    Linear interpolation on the monotone-decreasing part of the curve; returns
    NaN when the curve never reaches the target within the tested range.
    """
    r = sub[sub.condition == ref].sort_values("severity")
    sev, pres = r.severity.values, r.preservation.values
    below = np.where(pres <= target)[0]
    if len(below) == 0:
        return np.nan
    i = below[0]
    if i == 0:
        return sev[0]
    x0, x1, y0, y1 = sev[i - 1], sev[i], pres[i - 1], pres[i]
    if y0 == y1:
        return x1
    return x0 + (y0 - target) * (x1 - x0) / (y0 - y1)


def profile_at(sub, sev_star):
    """Interpolate every condition's preservation at a given severity."""
    out = {}
    for cond in S.CONDITIONS:
        r = sub[sub.condition == cond].sort_values("severity")
        out[cond] = float(np.interp(sev_star, r.severity.values, r.preservation.values))
    return out


def dissociation_table(les, kind="ablation", target=0.75):
    """Severity-matched preservation profile per stage, averaged over seeds."""
    rows = []
    k = les[les.kind == kind]
    for stage in STAGES:
        for seed in sorted(k.seed.unique()):
            sub = k[(k.stage == stage) & (k.seed == seed)]
            if sub.empty:
                continue
            sev_star = matched_severity(sub, target)
            if np.isnan(sev_star):
                continue
            prof = profile_at(sub, sev_star)
            deg = np.mean([prof[c] for c in S.DEGRADATION])
            tra = np.mean([prof[c] for c in S.TRANSFORMATION])
            rows.append(dict(stage=stage, seed=seed, matched_severity=sev_star,
                             **prof, degradation=deg, transformation=tra,
                             dissociation=tra - deg))
    return pd.DataFrame(rows)


def summarise(tab):
    g = tab.groupby("stage", sort=False)
    cols = S.CONDITIONS + ["degradation", "transformation", "dissociation", "matched_severity"]
    mean = g[cols].mean().reindex(STAGES)
    sd = g[cols].std().reindex(STAGES)
    return mean, sd


if __name__ == "__main__":
    df, intact, les = load()
    print("=== intact accuracy by condition ===")
    print(intact.round(3).to_string())

    for kind in ["ablation", "noise"]:
        if kind not in les.kind.unique():
            continue
        print(f"\n=== {kind}: raw preservation by stage x severity (canonical) ===")
        piv = (les[(les.kind == kind) & (les.condition == "canonical")]
               .pivot_table(index="stage", columns="severity", values="preservation")
               .reindex(STAGES))
        print(piv.round(3).to_string())

        tab = dissociation_table(les, kind=kind)
        if tab.empty:
            print(f"  [{kind}] no stage reached the matching target")
            continue
        mean, sd = summarise(tab)
        print(f"\n=== {kind}: severity-matched preservation profile (75% canonical) ===")
        print(mean.round(3).to_string())
        print("\n(sd across lesion seeds)")
        print(sd.round(3).to_string())
        tab.to_csv(os.path.join(RESULTS, f"dissociation_{kind}.csv"), index=False)
