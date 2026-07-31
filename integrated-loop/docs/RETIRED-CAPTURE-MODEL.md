# Retired: the spindle-capture model of accelerated long-term forgetting

Status: **withdrawn**. Superseded by `src/spindlecorrupt.js`.
Code kept at `src/alf.js`; tests kept at `test/stage43_alf.js`, `stage44_disease.js`,
`stage45_ad_components.js`, `stage46_alternatives.js`, `stage47_sensitivity.js`.
All five npm scripts removed so nothing runs it by accident.

---

## What it claimed

Accelerated long-term forgetting (ALF) in temporal-lobe epilepsy arises because
interictal epileptiform discharges (IEDs) **capture** the spindle refractory slot.
A discharge occurring in the seconds before a physiological spindle would have
fired triggers a spindle-like event of its own; that event occupies the slot, has
poor slow-oscillation coupling (`cIED 0.82` vs `cPhys 0.55` phase dispersion), and
therefore delivers less replay to cortex. Hippocampal recall at 30 min is normal
because the hippocampal route is intact; recall at one week collapses because the
cortical store was never written.

The identifying prediction, and the reason the model was worth building: capture
**adds** events. IED-triggered spindles are still spindles, so **spindle density
should be preserved or increased** in patients with high discharge rates, while
slow-oscillation coupling falls. Density up, coupling down — a dissociation no
competing account predicts.

## What killed it

**Bender et al., Neurology 2023 (n = 81).** In children with epilepsy, sleep
spindle **density is reduced by roughly 30 %**, coupling is reduced, and neither
measure shows an association with hippocampal IED rate. Every clause is the
opposite of the prediction: density down not up, and no rate association at all.
There is no parameter setting of a capture model that produces fewer spindles —
capture is additive by construction.

**Sákovics et al., 2022** independently removed the mechanism. IED-induced
spindles are **morphologically normal** — duration and amplitude within the
distribution of spontaneous spindles. The capture model needs the induced event
to be a degraded substitute. It is not; it is a spindle.

Both papers were published before the model was built and both are returned by an
ordinary PubMed query. They were not found because the pre-build literature search
asked *has this been published* (novelty) and never asked *has this been falsified*
(direction). That gap is now closed by `docs/PRE-BUILD-PROTOCOL.md`, which requires
every predicted direction to be enumerated and searched — both ways — before code.

## Why it survived as long as it did

Because everything internal was sound. The model passed 20+ headless checks, was
robust to ±40 % sweeps on both load-bearing parameters (24/24), and matched an
external dataset it was never fitted to (Schiller: model 0.50 vs measured 0.51).
Internal consistency and external fit to *one* measure are not protection against
a wrong mechanism. The suite tested whether the model did what it said; no test
asked whether what it said was true of patients.

Five real bugs were found and fixed along the way (shared RNG stream, step-function
retrieval read-out, drive↔trace-lifetime coupling, a calibration cache that
restored one of two learning-rate fields, profiles clobbering calibrated values).
That work was not wasted — the guards live on in the replacement.

## What was salvaged

- **The calibration architecture.** Anchor to human behaviour (0.85 one-week list
  retention, 0.95 early recall) with a specificity constraint, verify the anchor,
  cache on a key covering every determining input, and throw if the anchor is
  missed. Carried over unchanged.
- **Independent RNG streams** per stochastic process. The false P2 result came from
  one shared stream; three streams is now the default.
- **Logistic read-out** rather than a threshold, so a 2.5 % weight change cannot
  move recall by 0.24.
- **The paired same-seed/same-episode design** for measuring an event-level effect,
  which is what exposed the inspection-paradox artefact (+700–850 ms of pure
  length-biased sampling, tell: insensitivity to pulse amplitude).
- **Relative disease profiles** (`tauHscale`, not absolute `tauHdays`) so a profile
  can never overwrite a calibrated value.

## What replaced it

`src/spindlecorrupt.js`. Discharges **corrupt** the spindles they coincide with
rather than adding new ones: coincident spindles are lost from the density count
and deliver nothing. Induced spindles still occur, are counted with normal
morphology (Sákovics), and deliver nothing and consume nothing. This reproduces
reduced density (Bender) instead of contradicting it. The pre-build check for it
is `docs/PREBUILD-CHECK-02.md`: rows 1–6 are constraints already confirmed in the
literature and must be reproduced; rows 7–8 are the untested predictions that would
be the paper. Kill criteria were fixed in writing before any code was written.
