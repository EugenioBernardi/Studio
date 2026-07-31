# Pre-build check — corrupted-spindle hypothesis

*Applying `PRE-BUILD-PROTOCOL.md`. Written before any code exists. The previous attempt reached a
draft before its central prediction was checked; this table is that check, done first.*

---

## The tension worth targeting

Two findings that cannot both be simply true:

- **Gelinas et al. (Nat Med 2016)** — hippocampal IEDs mechanistically hijack ripple–spindle
  coupling and impair consolidation. doi:10.1038/nm.4084
- **Bender et al. (Neurology 2023, n=81 TLE vs 28 controls)** — spindle density reduced ~30%,
  spindle–SO coupling reduced, and **no significant association between any spindle measure and
  hippocampal IED rate**. doi:10.1212/WNL.0000000000207942

If discharges cause the disruption, why is there no rate association? The candidate answer is that
**rate is the wrong variable** — but that answer must survive the table below, not be assumed.

## The measured fact that reshapes the mechanism

**Sákovics et al. (Epilepsia 2022, n=21, foramen ovale electrodes, whole night)**
doi:10.1111/epi.17337 — separated scalp spindles into three classes by their relation to hIEDs:

| spindle class | measured properties |
|---|---|
| **co-occurring** with hIED | altered in *all* properties: **+126 ± 48 ms** duration, **+3.4 ± 3.2 µV** amplitude, frequency shifted up within 13–15 Hz |
| **induced** by hIED | **identical** to spindles with no hIED relationship |
| no hIED relationship | reference |

**This kills the previous model's mechanism outright.** That model assumed IED-*induced* spindles
were the pathological, content-free events. Measured: induced spindles are normal. The pathology
lives in **coincidence** — an IED landing on an *ongoing* spindle and deforming it.

Sákovics propose this "could mark a potential mechanism whereby IEDs disrupt memory processes" and
**did not test memory**. That is the gap.

---

## Predicted directions, checked before building

| # | observable | model would say | literature says | source | verdict |
|---|---|---|---|---|---|
| 1 | spindle density, TLE vs control | **reduced** | reduced ~30% | Bender 2023, n=81 | **CONFIRMED** |
| 2 | spindle–SO coupling strength, TLE | **reduced** | reduced | Bender 2023, n=81 | **CONFIRMED** |
| 3 | coupled spindle–SW rate, TLE | **~0.5 of control** | 0.51 | Schiller 2025, n=20 | **CONFIRMED** |
| 4 | IED-coincident spindle morphology | **altered** (longer, larger) | +126 ms, +3.4 µV, freq↑ | Sákovics 2022, n=21 | **CONFIRMED** |
| 5 | IED-*induced* spindle morphology | **normal** | identical to unrelated spindles | Sákovics 2022, n=21 | **CONFIRMED** |
| 6 | spindle measures vs IED **rate** | **null or weak** | no significant association | Bender 2023, n=81 | **CONFIRMED** |
| 7 | **coincidence fraction vs retention** | **negative, and stronger than rate** | *nothing found* | — | **UNTESTED** |
| 8 | corrupted spindle vs *absent* spindle | **corrupted is worse** | *nothing found* | — | **UNTESTED** |

Searches run broad-first per protocol: `epileptiform discharge spindle coupling memory` (5),
`spindle interictal coincidence memory consolidation epilepsy` (1),
`spindle duration amplitude epilepsy memory performance` (2), plus the density and coupled-rate
queries from the previous round. No result links coincidence fraction or spindle morphology to a
memory outcome.

## What the model must be built to do

Six confirmed rows are **constraints**, not results. A model that fails to reproduce reduced density,
reduced coupling strength, a ~0.5 coupled-rate ratio, altered coincident morphology, normal induced
morphology, and a null rate association is wrong before it is interesting. The previous model
satisfied two of these and contradicted two.

Rows 7 and 8 are the paper. Row 8 is the sharp one: **a corrupted spindle should be worse than no
spindle at all**, because it consumes a slow-oscillation up-state without delivering replay. That
distinguishes corruption from the rate-reduction rival, which predicts a monotone
fewer-spindles-less-memory relation and cannot make a present spindle harmful.

## Kill criteria, fixed now

- If the model cannot reproduce rows 1–3 and 6 simultaneously, it is abandoned. These are not
  negotiable and two of them already killed one design.
- If row 8 comes out with corrupted ≈ absent, the hypothesis collapses into the rate-reduction
  account and adds nothing. That is the outcome to watch for, and it must be registered as a
  failure rather than reinterpreted.
- If a mechanism is needed to make longer, larger spindles *harmful*, that mechanism must be stated
  in advance and be independently motivated — not fitted. Stated in advance: a spindle defines a
  time-limited plasticity window that must align with ripple arrival; prolonging and shifting it
  mis-times the window relative to its content.
