"""Experiment 2 -- Does the aperiodic exponent track arousal rather than pathology?

This is the testable residue of Experiment 1. In the model, the exponent
correlated -0.79 with log firing rate -- more strongly than with either synaptic
parameter it was supposed to measure (see docs/04-results.md). If the exponent
is largely reporting the network's operating point, then in real EEG it should
covary with arousal state at an effect size comparable to the patient-control
differences reported in the clinical literature.

If that holds, a meaningful part of the clinical aperiodic literature may be
measuring state rather than pathology.

The eyes-open/eyes-closed contrast is the cleanest available proxy for an
arousal/regime shift, and it is *within-subject*: same skull, same montage, same
electrodes, minutes apart. That removes exactly the confounds that make
between-group exponent comparisons hard to interpret.

    Prediction: |exponent(eyes-closed) - exponent(eyes-open)| within subject is
    of the same order as published patient-control exponent differences
    (typically ~0.1-0.3 in the aperiodic literature).

    Falsifier: if the within-subject state effect is an order of magnitude
    smaller than reported group differences, arousal is not a serious confound
    and this concern is dismissed.

--------------------------------------------------------------------------
NOT YET RUN. `openneuro.org` is blocked by this sandbox's egress proxy (403 at
the CONNECT), so this script has never been executed against real data and its
BIDS-handling paths are unverified. Run it somewhere with network access. Expect
to adjust `task` / event-code handling per dataset -- resting-state BIDS
conventions vary more than they should.
--------------------------------------------------------------------------

Setup:
    pip install mne mne-bids openneuro-py fooof

Usage:
    # fetch (metadata first, then a couple of subjects)
    python -m neurosim.experiments.arousal_confound --download --dataset ds003490

    # analyse whatever is present under data/<dataset>
    python -m neurosim.experiments.arousal_confound --dataset ds003490
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np

from neurosim.common.observables import aperiodic_exponent

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
RESULTS = ROOT / "results"

# Fit band for scalp EEG. Deliberately different from the 30-70 Hz used on the
# model LFP: real EEG has line noise at 50/60 Hz sitting inside that band, and
# muscle artefact dominates above ~40 Hz. 1-40 Hz with a knee is the safer
# choice, but it *contains* alpha and beta peaks -- which is exactly why
# specparam (which models peaks explicitly) is required here and the plain
# log-log fit in observables.py is not sufficient on its own.
FIT_LO, FIT_HI = 1.0, 40.0
LINE_FREQS = (50.0, 60.0)


def download(dataset: str, n_subjects: int = 3) -> None:
    """Fetch metadata plus a few subjects. Never pull a whole dataset blind."""
    import openneuro as on

    target = DATA / dataset
    target.mkdir(parents=True, exist_ok=True)

    print(f"[1/2] metadata for {dataset}")
    on.download(dataset=dataset, target_dir=target,
                include=["participants.tsv", "dataset_description.json"])

    subs = sorted({p.name for p in target.glob("sub-*")})
    if not subs:
        # participants.tsv lists subjects even before any imaging is fetched.
        pt = target / "participants.tsv"
        if pt.exists():
            with pt.open() as fh:
                subs = [r["participant_id"]
                        for r in csv.DictReader(fh, delimiter="\t")][:n_subjects]

    print(f"[2/2] fetching {min(len(subs), n_subjects)} subjects: {subs[:n_subjects]}")
    for sub in subs[:n_subjects]:
        on.download(dataset=dataset, target_dir=target, include=[sub])


def _exponents_specparam(psd: np.ndarray, freqs: np.ndarray) -> float | None:
    """Aperiodic exponent via specparam/FOOOF with an explicit knee.

    Returns None if specparam is unavailable, so the script degrades to the
    simple estimator rather than failing outright.
    """
    try:
        from fooof import FOOOF
    except ImportError:
        return None
    fm = FOOOF(aperiodic_mode="knee", verbose=False)
    fm.fit(freqs, psd, [FIT_LO, FIT_HI])
    return float(fm.get_params("aperiodic_params", "exponent"))


def analyse(dataset: str) -> list[dict]:
    """Per-subject, per-condition exponents.

    Both estimators are reported deliberately. docs/01-method.md requires the
    same code on both sides of the comparison, but real EEG needs specparam's
    peak model. The resolution is to run both and check they agree on the
    *direction* of the effect -- if the simple fit shows an effect specparam
    does not, that effect is a property of the fitting method, not the brain.
    """
    import mne

    root = DATA / dataset
    if not root.exists():
        raise SystemExit(f"{root} not found -- run with --download first")

    rows: list[dict] = []
    edfs = sorted(root.rglob("*_eeg.*"))
    edfs = [p for p in edfs if p.suffix.lower() in {".edf", ".bdf", ".set", ".fif", ".vhdr"}]
    if not edfs:
        raise SystemExit(f"no EEG recordings under {root}")

    for path in edfs:
        sub = next((part for part in path.parts if part.startswith("sub-")), "?")
        # Task/condition label comes from the BIDS filename entities.
        entities = dict(kv.split("-", 1) for kv in path.stem.split("_")
                        if "-" in kv)
        task = entities.get("task", "unknown")
        ses = entities.get("ses", "")

        try:
            raw = mne.io.read_raw(path, preload=True, verbose="ERROR")
        except Exception as exc:  # noqa: BLE001 - formats vary wildly
            print(f"  skip {path.name}: {exc}")
            continue

        raw.pick("eeg")
        # Notch before fitting: line harmonics inside the fit band bias the slope.
        for lf in LINE_FREQS:
            if lf < raw.info["sfreq"] / 2:
                raw.notch_filter(lf, verbose="ERROR")
        raw.set_eeg_reference("average", verbose="ERROR")

        # Posterior channels: the arousal/alpha effect is largest there.
        picks = [ch for ch in raw.ch_names
                 if any(ch.upper().startswith(p) for p in ("O", "PO", "P"))]
        if not picks:
            picks = raw.ch_names[: min(8, len(raw.ch_names))]

        data = raw.get_data(picks=picks)
        fs = float(raw.info["sfreq"])

        simple, spec = [], []
        for ch in data:
            try:
                simple.append(aperiodic_exponent(ch, fs, fit_lo=FIT_LO,
                                                 fit_hi=FIT_HI,
                                                 nperseg_s=2.0).exponent)
            except ValueError:
                continue
            psd, freqs = mne.time_frequency.psd_array_welch(
                ch, sfreq=fs, fmin=FIT_LO, fmax=FIT_HI,
                n_per_seg=int(2 * fs), verbose="ERROR")
            val = _exponents_specparam(psd, freqs)
            if val is not None:
                spec.append(val)

        if not simple:
            continue

        rows.append({
            "dataset": dataset,
            "subject": sub,
            "session": ses,
            "task": task,
            "n_channels": len(simple),
            "exponent_simple": round(float(np.mean(simple)), 4),
            "exponent_specparam": (round(float(np.mean(spec)), 4) if spec else ""),
        })
        print(f"  {sub:12s} {task:20s} chi_simple={rows[-1]['exponent_simple']:.3f} "
              f"chi_specparam={rows[-1]['exponent_specparam']}")

    return rows


def report(rows: list[dict]) -> None:
    """Within-subject state effect vs. the published group-difference scale."""
    by_sub: dict[str, dict[str, float]] = {}
    for r in rows:
        by_sub.setdefault(r["subject"], {})[r["task"]] = r["exponent_simple"]

    deltas = [max(t.values()) - min(t.values())
              for t in by_sub.values() if len(t) > 1]

    print("\n=== within-subject state effect ===")
    if not deltas:
        print("only one condition per subject -- this dataset cannot test the")
        print("within-subject contrast. Pick one with eyes-open AND eyes-closed,")
        print("or with ON/OFF sessions.")
        return

    print(f"n subjects with >1 condition: {len(deltas)}")
    print(f"mean |delta exponent| within subject: {np.mean(deltas):.3f}")
    print(f"                             range  : {min(deltas):.3f}-{max(deltas):.3f}")
    print("\nPublished patient-control exponent differences are typically "
          "~0.1-0.3.")
    print("If the within-subject state effect above is of that order or larger,")
    print("arousal is a confound of the same magnitude as the clinical signal.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="ds003490")
    ap.add_argument("--download", action="store_true")
    ap.add_argument("--n-subjects", type=int, default=3)
    args = ap.parse_args()

    if args.download:
        download(args.dataset, args.n_subjects)
        return

    rows = analyse(args.dataset)
    if not rows:
        raise SystemExit("no recordings analysed")

    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"arousal_confound_{args.dataset}.csv"
    with out.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"\nwrote {out}")

    report(rows)


if __name__ == "__main__":
    main()
