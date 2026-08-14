# Experiment 1 results — H1 refuted, and a confound worth more than the hypothesis

Run: `python -m neurosim.experiments.gaba_dissociation`
Raw output: [`results/gaba_dissociation.csv`](../results/gaba_dissociation.csv)
Grid: inhibitory conductance `w_inh` ∈ {6, 9, 12} nS × GABA_A decay `tau_inh` ∈
{6, 10, 15} ms × 3 seeds = 27 runs. Baseline (healthy) is `w_inh` = 9 nS,
`tau_inh` = 10 ms. Network: 3200 E / 800 I conductance-based point neurons, 4 s
per run, first 500 ms discarded.

## What H1 predicted

That the aperiodic **exponent** would track inhibitory *conductance* while the
**knee frequency** would track *kinetics*, so the pair would jointly identify
which of two clinically distinct lesions — receptor loss vs. subunit/kinetic
change — a patient has, where the exponent alone cannot.

## What actually happened

### Condition means

| `w_inh` (nS) | `tau_inh` (ms) | rate E (Hz) | exponent χ | knee (Hz) |
|---|---|---|---|---|
| 6 | 6 | **159.9** | 0.76 | n/a |
| 6 | 10 | 18.3 | 2.86 ± 0.56 | 19.5 ± 1.3 |
| 6 | 15 | 8.7 | 2.94 ± 0.03 | 34.2 ± 0.3 |
| 9 | 6 | **77.4** | 1.62 | 157.1 |
| 9 | 10 *(baseline)* | 6.1 | 2.71 ± 0.24 | 50.3 ± 1.9 |
| 9 | 15 | 3.7 | 2.59 ± 0.11 | 49.4 ± 2.3 |
| 12 | 6 | **35.6** | 1.55 | 76.2 |
| 12 | 10 | 4.1 | 2.95 ± 0.05 | 47.6 ± 5.2 |
| 12 | 15 | 2.5 | 2.32 ± 0.14 | 47.8 ± 1.2 |

± is SD across 3 seeds. Bold rates are non-physiological (see below).

### Result 1 — the knee tracks the wrong parameter

Restricted to the physiologically plausible runs (rate < 20 Hz, n = 18):

```
corr(w_inh,   knee) =  0.747     <- conductance
corr(tau_inh, knee) =  0.206     <- kinetics
```

H1 predicted the reverse. The knee responds **3.6× more strongly to conductance
than to kinetics**, so the (exponent, knee) pair does not separate the two
lesions — it is not merely degenerate, it is loaded onto the wrong axis. **H1 is
refuted in silico, and no OpenNeuro data is needed to reject it.**

Inspecting the means shows why the correlation is not the whole story: at
`w_inh` = 6 the knee moves substantially with kinetics (19.5 → 34.2 Hz), while at
`w_inh` = 9 and 12 it is essentially flat (~47–50 Hz regardless of `tau_inh`).
The knee's sensitivity to kinetics is itself conditional on conductance. That
interaction is fatal to the clinical reading, which requires a stable mapping
from observable to mechanism across patients whose baseline conductance is
unknown.

### Result 2 — the exponent is non-monotonic and mostly inside seed noise

At fixed `tau_inh` = 10 ms, sweeping conductance 6 → 9 → 12 nS gives χ = 2.86 →
2.71 → 2.95. Not monotonic. Not even ordered.

The between-condition spread across all physiological runs (χ = 2.32 to 2.95,
range 0.63) is comparable to the within-condition seed SD, which reaches 0.56 at
`w_inh` = 6. **Most of the apparent structure in the exponent is not
distinguishable from run-to-run variability at n = 3.** Any real study would need
far more seeds; a single simulated "patient" per condition would have produced a
confident and entirely spurious result.

### Result 3 — the confound: the exponent mainly tracks firing rate

Across the full grid:

```
corr(log firing rate, exponent) = -0.792
```

This is by far the strongest relationship in the data — stronger than the
exponent's relationship to either synaptic parameter. The exponent is not
reporting the synaptic E/I parameters directly; it is largely reporting **where
the network sits in its dynamical regime**, and firing rate is what moved.

Within the physiological subset the correlation reverses sign (+0.455), which
confirms the full-grid value is dominated by the saturated runs rather than
describing a single consistent law.

### Result 4 — the kinetic lesion cannot be applied in isolation

Setting `tau_inh` = 6 ms drove firing rates to 36–160 Hz — saturation, not
cortex. Shortening the inhibitory time constant removes inhibitory charge, the
network destabilises, and rate explodes.

So the flatter exponents in that column (0.76–1.62) are **not** a synaptic-filter
effect. They are what a saturated network's spectrum looks like. The clean
manipulation the hypothesis assumed — change kinetics, hold everything else
fixed — is not available, because the parameter change moves the operating point
along with it.

## What this means clinically

The useful output of this experiment is not H1, which died. It is a specific
warning about how the aperiodic exponent is currently read:

1. **A flattened exponent is at least as consistent with a shift in firing regime
   as with a change in synaptic E/I parameters.** Anything that raises cortical
   firing rate — arousal, drowsiness, task engagement, caffeine, muscle
   artefact — moves the exponent in the same direction as the E/I lesion of
   interest. Studies reporting flatter exponents in a patient group need to rule
   out a rate/state difference before claiming a synaptic one.
2. **The knee is not a clean kinetic readout**, and its sensitivity depends on
   conductance. Proposals to use exponent-plus-knee to fingerprint receptor
   pharmacology should be treated sceptically until this is shown to fail in a
   more realistic model.
3. **The mapping is not monotonic**, so "flatter = more excitation = worse" is
   unsafe as a dose-response claim even where a group difference is real.

Point 1 is the testable residue of this experiment, and it is a better hypothesis
than H1 was, because it predicts something about existing datasets: **in OpenNeuro
resting EEG, the aperiodic exponent should covary with markers of arousal state
(eyes open/closed, alpha power, drowsiness) at an effect size comparable to
reported patient-control differences.** If it does, a substantial part of the
clinical aperiodic literature is measuring state, not pathology. That is testable
today, on the datasets in `03-openneuro-mapping.md`, without any new recording.

## Caveats on these results

- **n = 3 seeds** is too few. Result 2 is precisely the finding that says so.
  Repeating at n ≥ 20 is the first thing to do before any of this is relied upon.
- **Exponents of 2.3–2.9 are steeper than scalp EEG** (typically 0.5–2). The LFP
  proxy is not a volume-conduction forward model, so absolute values should not
  be compared to EEG — only directions of change, which is why the method doc
  restricts claims to forward-invariant observables.
- **Single homogeneous population, point neurons.** No layers, no dendrites, no
  NMDA, no neuromodulation. A laminar model could plausibly show the dissociation
  this one lacks, so H1 is refuted *for this model class*, not for all models.
  Re-running in NEST with the Potjans & Diesel microcircuit is the honest next
  step before calling H1 dead in general.
- **The rate confound may be partly an artefact of the design.** Holding rate
  fixed by re-tuning background drive at each grid point would separate
  "parameter effect" from "rate effect" — and that is exactly the control this
  experiment lacks, and the single most valuable modification to make next.

## Next steps, in order

1. Re-run with rate-matched background drive to separate the parameter effect
   from the rate effect (fixes the main design flaw above).
2. Increase to n ≥ 20 seeds.
3. Test the Result-3 hypothesis on OpenNeuro: does exponent covary with arousal
   state at patient-control effect sizes?
4. Only then move to H3 (Alzheimer's), which is the strongest remaining
   hypothesis.
