"""Experiment 1 -- Can the aperiodic exponent tell *why* inhibition failed?

Motivation
----------
The aperiodic (1/f) exponent of field potentials has become the standard
non-invasive proxy for E/I balance, and it is now read clinically as if it were
a one-dimensional dial: "flatter spectrum = more excitation = worse". But two
biologically distinct lesions both reduce net inhibition:

  (A) *Fewer/weaker GABA_A synapses* -- lower peak conductance. This is the
      interneuron-loss story: PV+ cell death, reduced GAD67, synapse pruning.
  (B) *Faster GABA_A kinetics* -- shorter decay. This is the subunit-composition
      story: alpha1/alpha5 shifts, and the axis benzodiazepines act on in the
      opposite direction.

If the exponent responds to both, then a flattened spectrum in a patient is
diagnostically ambiguous, and the field's standard reading is under-determined.

Hypothesis under test (in silico)
---------------------------------
H1: conductance loss (A) and kinetic speed-up (B) are *separable* in the
    aperiodic domain, because the exponent is set mainly by the ratio of
    inhibitory to excitatory current while the knee frequency is set by the
    dominant synaptic time constant. Therefore (exponent, knee) jointly
    identify the lesion where the exponent alone does not.

If H1 holds in the model it becomes a falsifiable clinical prediction: patient
groups whose inhibitory deficit is receptor-number-driven should sit on a
different (exponent, knee) locus than groups whose deficit is kinetics-driven,
even at matched exponent. See docs/03-openneuro-mapping.md for the datasets
that can test it.

Run:
    python -m neurosim.experiments.gaba_dissociation
"""

from __future__ import annotations

import csv
import itertools
from pathlib import Path

import numpy as np

from neurosim.common.observables import aperiodic_exponent, spectral_knee, band_power
from neurosim.models.cortical_column import ColumnParams, simulate_column

RESULTS = Path(__file__).resolve().parents[2] / "results"

# Baseline is w_inh = 9.0 nS, tau_inh = 10.0 ms (healthy).
W_INH_LEVELS = [6.0, 9.0, 12.0]      # -33%, baseline, +33% conductance
TAU_INH_LEVELS = [6.0, 10.0, 15.0]   # faster, baseline, slower kinetics
SEEDS = [0, 1, 2]


def run_grid(duration: float = 4.0) -> list[dict]:
    rows: list[dict] = []
    combos = list(itertools.product(W_INH_LEVELS, TAU_INH_LEVELS, SEEDS))
    for k, (w_inh, tau_inh, seed) in enumerate(combos, start=1):
        p = ColumnParams(w_inh=w_inh, tau_inh=tau_inh, seed=seed,
                         duration=duration)
        res = simulate_column(p)

        fit = aperiodic_exponent(res.lfp, res.lfp_fs, fit_lo=30.0, fit_hi=70.0,
                                 nperseg_s=0.5)
        knee = spectral_knee(res.lfp, res.lfp_fs, lo=2.0, hi=200.0,
                             nperseg_s=0.5)
        gamma_rel = band_power(res.lfp, res.lfp_fs, 30.0, 80.0,
                               relative_to=(1.0, 100.0))

        row = {
            "w_inh_nS": w_inh,
            "tau_inh_ms": tau_inh,
            "seed": seed,
            "rate_exc_hz": round(res.rate_exc, 3),
            "rate_inh_hz": round(res.rate_inh, 3),
            "exponent": round(fit.exponent, 4),
            "fit_r2": round(fit.r_squared, 4),
            "knee_hz": round(knee, 4) if np.isfinite(knee) else "",
            "gamma_rel_power": round(gamma_rel, 5),
        }
        rows.append(row)
        print(f"[{k:2d}/{len(combos)}] w_inh={w_inh:5.1f} tau_inh={tau_inh:5.1f} "
              f"seed={seed} | rE={res.rate_exc:5.2f} Hz  chi={fit.exponent:6.3f} "
              f"(r2={fit.r_squared:.2f})  knee={knee:7.2f} Hz", flush=True)
    return rows


def summarise(rows: list[dict]) -> None:
    """Print condition means so the dissociation is readable without a plot."""
    print("\n=== condition means (across seeds) ===")
    print(f"{'w_inh':>6} {'tau_inh':>8} {'rate_E':>8} {'exponent':>10} "
          f"{'knee_Hz':>9} {'gamma_rel':>10}")
    for w_inh, tau_inh in itertools.product(W_INH_LEVELS, TAU_INH_LEVELS):
        sub = [r for r in rows
               if r["w_inh_nS"] == w_inh and r["tau_inh_ms"] == tau_inh]
        if not sub:
            continue

        def m(key):
            vals = [float(r[key]) for r in sub if r[key] != ""]
            return float(np.mean(vals)) if vals else float("nan")

        print(f"{w_inh:6.1f} {tau_inh:8.1f} {m('rate_exc_hz'):8.2f} "
              f"{m('exponent'):10.3f} {m('knee_hz'):9.2f} "
              f"{m('gamma_rel_power'):10.4f}")


def main() -> None:
    RESULTS.mkdir(exist_ok=True)
    rows = run_grid()

    out = RESULTS / "gaba_dissociation.csv"
    with out.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nwrote {out}")

    summarise(rows)


if __name__ == "__main__":
    main()
