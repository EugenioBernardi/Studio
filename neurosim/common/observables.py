"""Observables computed identically on simulated and empirical signals.

This module is the load-bearing part of the whole project. A hypothesis is only
testable against OpenNeuro if the number extracted from the simulation and the
number extracted from the recording are produced by *the same code path*. Every
estimator here therefore takes a plain 1-D array plus a sampling rate, and knows
nothing about whether it came from Brian2, NEST, or a BIDS `.edf`.

Deliberate constraints:

* No estimator may accept a `is_simulation` flag or branch on data provenance.
* Estimators return dataclasses, not bare floats, so that fit quality travels
  with the point estimate. A slope with r^2 = 0.2 is not evidence.
* Frequency bands are arguments, never module constants, because the band that
  is clean in a model LFP is not the band that is clean in scalp EEG.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Sequence

import numpy as np
from scipy import signal as sps


# --------------------------------------------------------------------------
# Spectra
# --------------------------------------------------------------------------


@dataclass
class Spectrum:
    freqs: np.ndarray
    psd: np.ndarray
    fs: float

    def band(self, lo: float, hi: float) -> "Spectrum":
        m = (self.freqs >= lo) & (self.freqs <= hi)
        return Spectrum(self.freqs[m], self.psd[m], self.fs)


def welch_psd(x: np.ndarray, fs: float, nperseg_s: float = 1.0,
              detrend: str = "constant") -> Spectrum:
    """Welch PSD with the window length specified in seconds, not samples.

    Specifying the window in seconds keeps frequency resolution constant when
    the same analysis is applied to a 10 kHz model LFP and a 250 Hz EEG file --
    a mismatch there silently changes every slope estimate.
    """
    x = np.asarray(x, dtype=float)
    nperseg = int(round(nperseg_s * fs))
    nperseg = max(16, min(nperseg, x.size))
    freqs, psd = sps.welch(x, fs=fs, nperseg=nperseg, noverlap=nperseg // 2,
                           detrend=detrend, scaling="density")
    return Spectrum(freqs, psd, fs)


# --------------------------------------------------------------------------
# Aperiodic (1/f) component
# --------------------------------------------------------------------------


@dataclass
class AperiodicFit:
    exponent: float          # chi in P(f) ~ 1/f^chi; positive = steeper decay
    offset: float            # log10 power at 1 Hz (extrapolated)
    r_squared: float
    fit_lo: float
    fit_hi: float
    n_points: int

    def as_dict(self) -> dict:
        return asdict(self)


def aperiodic_exponent(x: np.ndarray, fs: float, fit_lo: float = 30.0,
                       fit_hi: float = 70.0, nperseg_s: float = 1.0,
                       exclude_peaks: bool = True) -> AperiodicFit:
    """Estimate the 1/f exponent by robust log-log regression.

    This is a deliberately simple stand-in for `specparam`/FOOOF. It is adequate
    inside a fitting band chosen to be free of oscillatory peaks, which is why
    the default band is 30-70 Hz: in the models here that band carries no
    resonance, and in scalp EEG it sits above alpha/beta. For real data with
    line noise, notch first and keep the band away from 50/60 Hz -- or swap in
    `specparam`, whose knee model this function does not attempt to reproduce.

    `exclude_peaks` removes points lying far above the running fit, so a stray
    harmonic does not drag the slope.
    """
    sp = welch_psd(x, fs, nperseg_s=nperseg_s).band(fit_lo, fit_hi)
    good = (sp.freqs > 0) & (sp.psd > 0) & np.isfinite(sp.psd)
    f = sp.freqs[good]
    p = sp.psd[good]
    if f.size < 5:
        raise ValueError(
            f"only {f.size} usable spectral points in {fit_lo}-{fit_hi} Hz; "
            "lengthen the signal or widen the band"
        )

    lf, lp = np.log10(f), np.log10(p)

    slope, intercept = np.polyfit(lf, lp, 1)
    if exclude_peaks:
        resid = lp - (slope * lf + intercept)
        keep = resid < (np.median(resid) + 2.0 * np.std(resid))
        if keep.sum() >= 5:
            lf, lp = lf[keep], lp[keep]
            slope, intercept = np.polyfit(lf, lp, 1)

    pred = slope * lf + intercept
    ss_res = float(np.sum((lp - pred) ** 2))
    ss_tot = float(np.sum((lp - lp.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")

    return AperiodicFit(exponent=float(-slope), offset=float(intercept),
                        r_squared=float(r2), fit_lo=fit_lo, fit_hi=fit_hi,
                        n_points=int(lf.size))


def spectral_knee(x: np.ndarray, fs: float, lo: float = 2.0, hi: float = 200.0,
                  nperseg_s: float = 1.0) -> float:
    """Knee frequency from a Lorentzian fit: P(f) = A / (k + f^chi).

    The knee is the second, largely ignored half of the aperiodic signal. Where
    the exponent tracks the *ratio* of excitatory to inhibitory current, the
    knee tracks the *timescale* of the dominant synaptic filter. Two lesions
    that move the exponent identically can move the knee in opposite
    directions, which is what makes the pair jointly identifiable.
    Returns the knee in Hz.
    """
    from scipy.optimize import curve_fit

    sp = welch_psd(x, fs, nperseg_s=nperseg_s).band(lo, hi)
    f, p = sp.freqs, sp.psd
    m = (f > 0) & (p > 0) & np.isfinite(p)
    f, p = f[m], p[m]
    if f.size < 10:
        return float("nan")

    def lorentzian(freq, log_a, knee, chi):
        return log_a - np.log10(knee + freq ** chi)

    try:
        popt, _ = curve_fit(lorentzian, f, np.log10(p),
                            p0=[np.log10(p[0]), 1.0, 2.0], maxfev=20000)
    except (RuntimeError, ValueError):
        return float("nan")
    knee, chi = popt[1], popt[2]
    if knee <= 0 or chi <= 0:
        return float("nan")
    return float(knee ** (1.0 / chi))


# --------------------------------------------------------------------------
# Oscillatory / coupling observables
# --------------------------------------------------------------------------


def band_power(x: np.ndarray, fs: float, lo: float, hi: float,
               relative_to: tuple[float, float] | None = None) -> float:
    """Integrated power in a band, optionally normalised by a wider band.

    Relative power is what survives the amplitude ambiguity of scalp EEG:
    absolute microvolts depend on skull thickness and reference, so a model
    that predicts absolute power predicts something unmeasurable.
    """
    sp = welch_psd(x, fs)
    m = (sp.freqs >= lo) & (sp.freqs <= hi)
    num = float(np.trapezoid(sp.psd[m], sp.freqs[m]))
    if relative_to is None:
        return num
    m2 = (sp.freqs >= relative_to[0]) & (sp.freqs <= relative_to[1])
    den = float(np.trapezoid(sp.psd[m2], sp.freqs[m2]))
    return num / den if den > 0 else float("nan")


def modulation_index(x: np.ndarray, fs: float, phase_band: tuple[float, float],
                     amp_band: tuple[float, float], n_bins: int = 18) -> float:
    """Tort modulation index for phase-amplitude coupling.

    Returns a normalised KL divergence in [0, 1]; ~0 means the amplitude of the
    fast band is distributed uniformly across the phase of the slow band.
    """
    x = np.asarray(x, dtype=float)
    nyq = fs / 2.0
    if amp_band[1] >= nyq or phase_band[1] >= nyq:
        return float("nan")

    def bp(lo, hi):
        b, a = sps.butter(4, [lo / nyq, hi / nyq], btype="band")
        return sps.filtfilt(b, a, x)

    phase = np.angle(sps.hilbert(bp(*phase_band)))
    amp = np.abs(sps.hilbert(bp(*amp_band)))

    edges = np.linspace(-np.pi, np.pi, n_bins + 1)
    idx = np.digitize(phase, edges) - 1
    idx = np.clip(idx, 0, n_bins - 1)
    means = np.array([amp[idx == b].mean() if np.any(idx == b) else 0.0
                      for b in range(n_bins)])
    total = means.sum()
    if total <= 0:
        return float("nan")
    p = means / total
    p = np.where(p > 0, p, 1e-12)
    kl = np.log(n_bins) + float(np.sum(p * np.log(p)))
    return kl / np.log(n_bins)


# --------------------------------------------------------------------------
# Criticality
# --------------------------------------------------------------------------


@dataclass
class AvalancheStats:
    size_exponent: float     # tau in P(S) ~ S^-tau; ~1.5 at criticality
    n_avalanches: int
    branching_ratio: float   # ~1.0 at criticality


def avalanche_statistics(binned_activity: Sequence[float],
                         threshold: float | None = None) -> AvalancheStats:
    """Avalanche size distribution and branching ratio from binned activity.

    Works on a spike-count vector from a simulation or a thresholded-event
    vector from iEEG. The branching ratio here is the naive successive-bin
    estimator; for empirical data with subsampling, prefer the MR estimator
    (Wilting & Priesemann) -- subsampling biases this one toward 1.
    """
    a = np.asarray(binned_activity, dtype=float)
    thr = float(np.median(a)) if threshold is None else threshold
    active = a > thr

    sizes: list[float] = []
    cur = 0.0
    for i, on in enumerate(active):
        if on:
            cur += a[i] - thr
        elif cur > 0:
            sizes.append(cur)
            cur = 0.0
    if cur > 0:
        sizes.append(cur)

    sizes_arr = np.array([s for s in sizes if s > 0])
    if sizes_arr.size < 20:
        return AvalancheStats(float("nan"), int(sizes_arr.size), float("nan"))

    # MLE for a discrete-ish power law with lower cutoff at the smallest size.
    smin = sizes_arr.min()
    tau = 1.0 + sizes_arr.size / float(np.sum(np.log(sizes_arr / smin)))

    num = a[1:]
    den = a[:-1]
    ok = den > 0
    br = float(np.mean(num[ok] / den[ok])) if ok.any() else float("nan")

    return AvalancheStats(float(tau), int(sizes_arr.size), br)
