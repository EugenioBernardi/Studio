# Stage 48 — the corrupted-spindle model against its eight registered rows

**Verdict: 5 passed, 3 failed.** The model reproduces four of the six measured constraints it was
built to satisfy, contradicts two of them, and carries one of its two predictions. It is not
publishable in this state and the failures are not close ones.

Rows and criteria were registered in `docs/PREBUILD-CHECK-02.md` before any code was written, with
kill criteria fixed in advance. Numbers below are from the run of the model as registered.

| row | claim | status | number |
|-----|-------|--------|--------|
| C1 | spindle density −30 % in TLE (Bender 2023, n=81) | PASS | ratio 0.69 vs 0.70 — **fitted** |
| C2 | spindle–SO coupling strength reduced (Bender) | PASS | 0.55 → 0.47 — **fitted** |
| **C3** | **coupled rate 0.51 of control (Schiller 2025, n=20)** | **FAIL** | **model 0.25** |
| C4 | IED-coincident spindles +126 ms, +3.4 µV (Sákovics 2022) | PASS | +71 ms, +1.9 µV on the population mean |
| C5 | IED-induced spindles morphologically normal (Sákovics) | PASS | duration and amplitude unchanged |
| **C6** | **no spindle/discharge-rate association (Bender)** | **FAIL** | **ρ = +0.87** |
| **C7** | **coincidence fraction outpredicts discharge rate** | **FAIL** | **0.29 vs 0.64** |
| C8 | a corrupted spindle is worse than an absent one | PASS | −0.29 at a limiting ripple budget |

C1 and C2 are fitted and claim nothing. C3 was registered as the one genuine external check in the
EEG phenotype — `spindleLoss` is fitted to Bender's density and nothing is tuned to Schiller's
coupled rate. It missed by a factor of two.

## The three failures have one root, and repairing it did not help

C3, C6 and C7 all trace to the induction term: `pInduce` added detector-visible spindles freely, in
proportion to discharge rate. That inflates density (forcing a larger fitted generation loss, which
crushes C3's delivering ratio), creates the density/rate correlation that kills C6, and dilutes the
denominator of the coincidence fraction that C7 depends on.

**C6 failing in the positive direction is the serious one.** Density rising with discharge rate is
precisely the signature that falsified the previous model in this project. It reappeared here
through a different term.

Three independent sources say free additive induction is wrong:

- **Ngo et al., J Neurosci 2015** — driving with repeated SO-locked clicks does *not* keep producing
  spindles; phase-locked spindle activity fades rapidly within a train, and spindle refractoriness
  is named as the protective mechanism. <https://doi.org/10.1523/JNEUROSCI.3133-14.2015>
- **Stoyell et al., BMC Neurol 2021** — spindle rate anticorrelated with spike rate within a patient
  followed longitudinally, "consistent with a competitively shared underlying thalamocortical
  circuitry". <https://doi.org/10.1186/s12883-021-02376-5>
- **Pan et al., Int J Neural Syst 2025** — in a thalamocortical network model, abundant spike
  discharges inhibit spindle occurrence outright. <https://doi.org/10.1142/S0129065725500182>

So the generator was rebuilt as a shared depletable resource: a discharge fires the same generator
and spends it, displacing the physiological spindle that would have carried replay.

**It did not rescue the rows** (`test/probe_generator.js`, sweeping `resTau` 4–20 s × `pInduce`
0.02–0.20):

- density still rises with discharge rate at every setting, ratio(80/min ÷ 5/min) = 1.06 → 1.90. It
  approaches null only at `pInduce` 0.02, where induction is too rare to matter — the null then comes
  from "induction barely happens", not from competition.
- fitting density to 0.70 still gives a delivering ratio of 0.30, not 0.51.

The reason competition fails to cancel is itself the finding: discharges at 30–80/min get far more
attempts at the generator than physiological spindle drive does, so they *harvest* the resource
rather than trading evenly against it. **Bender's null therefore bounds the per-discharge induction
probability at ≲0.02. It is not explained by the model**, and it is not presented as if it were.

The depletable generator is kept anyway — it is the more correct circuit whether or not it helps.
`spindleP` re-anchored 0.10 → 0.18 to hold healthy density at 5.2/min.

### Confirmatory re-run with the depletable generator

Every failing row moved toward its target, none crossed, nothing regressed:

| row | as registered | with shared generator | target |
|---|---|---|---|
| C3 delivering ratio | 0.25 | 0.32 | 0.51 ± 0.12 (needs ≥ 0.39) |
| C6 ρ(density, discharge rate) | +0.87 | +0.70 | ~0 |
| C7 coincidence vs rate | 0.29 vs 0.64 | 0.50 vs 0.78 | coincidence must win |

C1/C2 still pass (fitted `spindleLoss` 0.60 → 0.55, density ratio 0.69); C4/C5 unchanged at +75 ms and
+2.0 µV. A consistent ~25–30 % of the way to target, from one mechanism change, with no row going
backwards. That is a right-in-kind, too-weak-in-magnitude signature, not a wrong mechanism.

**The re-run did not complete.** The process died after C8's budget-0.7 row without writing the 0.5
row or the summary line; the task captured no exit status and disk was not the cause. C8's post-fix
status is therefore unknown — at budget 0.7 the difference had already gone non-negative (+0.04,
against −0.09 pre-fix), so the effect had shifted to requiring a scarcer pool, but whether it
survives at 0.5 was not measured and is not assumed here.

## C7 is false in the model, and it was the clinical hook

C7 predicted that coincidence fraction would outpredict discharge rate for one-week recall. It
predicts *worse* (|ρ| 0.29 vs 0.64). The reason is structural: coincidence fraction is a normalised
measure that partly cancels `spindleLoss`, and `spindleLoss` varies independently across the cohort
and strongly drives recall. Normalising away a real cause makes a worse predictor.

This is reported as a failed prediction, not re-specified into a passing one. "Measure coincidence,
not spike counts" was the translational claim, and it does not survive.

## C8 passes, conditionally, and the condition now has measured support

| ripple budget | absence 1 wk | corruption 1 wk | difference |
|---|---|---|---|
| ∞ | 0.47 | 0.52 | +0.05 |
| 1.5 | 0.47 | 0.52 | +0.05 |
| 1.0 | 0.47 | 0.52 | +0.05 |
| 0.7 | 0.47 | 0.37 | −0.09 |
| 0.5 | 0.46 | 0.17 | **−0.29** |

With replay abundant, corruption and absence are indistinguishable and the hypothesis reduces
exactly to rate-reduction. With replay limiting, corruption is much worse. Note the comparison is
imperfectly matched *against* the hypothesis — the corruption arm delivers 3.08 spindles/min to the
absence arm's 2.82, i.e. 9 % more, and still ends up 0.29 lower at the limiting budget.

The budget was introduced as a swept parameter rather than an assumption, precisely because the row
lives or dies on it. It now has direct measured support that was not in the pre-build check:

- **Gelinas et al., Nat Med 2016** — hippocampal IEDs are precisely coordinated with prefrontal
  spindles, "this coordination surpasses the normal physiological ripple-spindle coupling and **is
  accompanied by decreased ripple occurrence**". <https://doi.org/10.1038/nm.4084>

A measured decrease in ripple occurrence when IEDs couple to spindles is the scarce, consumable pool
C8 requires.

## Diagnosis, and where the surviving route points

Both models in this line put the pathology in **spindle events**. The measurements constrain spindle
events tightly — density −30 %, no association with discharge rate, induced spindles morphologically
normal — and every mechanism that places a discharge-driven lesion in the spindle *count* runs into
Bender's null. The first model died on it and this one fails C6 on it.

The one row that survived puts the lesion in the **ripple pool** instead, and that is also the only
place a discharge-driven decrease has actually been measured (Gelinas). A model whose primary lesion
is that IEDs consume or replace sharp-wave ripples would:

- predict no density/discharge-rate association at all, so C6 stops being a hazard;
- leave spindle morphology untouched, so C4/C5 come for free;
- rest on a measured decrease rather than an assumed one;
- still produce accelerated long-term forgetting, because what is lost is *content*, not oscillation.

That is a different model, not a repair of this one, and it should not be started without saying so
first.

## The larger error, which is about level of description

Both models in this line are **actuarial models of spindle events**. `spindlecorrupt.js` contains no
phase variable — spindles are a Bernoulli draw per slow-oscillation cycle, discharges are Poisson,
and "coupling strength" is an assigned scalar rather than a phase relationship anything computes.
That is not the level this project works at, and `src/spindlegate.js` already holds a thalamic
reticular oscillator that produces spindles emergently at 5.0/min and 759 ms — both in human range —
which was measured earlier in this same line of work and then not used.

Two consequences follow, and both are visible in the results above.

**Constraints were listed but never checked against the mechanism class.** C3 cannot be an emergent
check: with density fitted to 0.70 and corruption removing a share of the survivors, the delivering
ratio is algebraically 0.70 × (1 − corrupted fraction), so hitting 0.51 requires corrupting exactly
27 % — a second fit, not a test. C6 is the same: any mechanism where discharges *add* detector-visible
spindles in proportion to discharge rate must give ρ > 0 against a measured null. Both are settled by
arithmetic on paper. Neither needed a 748-second run to discover.

**The envelope abstraction is why the repair came up short.** Ngo's spindle refractoriness is T-type
calcium de-inactivation in reticular neurons. Modelling it as `res *= (1 - resCost)` with exponential
recovery is the envelope again, and it recovered ~25–30 % of each gap — the same shortfall seen
earlier when emergent corruption magnitude gave 0–32 ms against Sákovics's measured +126 ms. The same
missing physics, twice.

So the pre-build protocol did not fail on the literature search this time; the search was adequate.
It failed because a constraint list cannot rescue a model built at the wrong level of description,
and because no step required deriving whether the proposed mechanism could produce the required signs
and magnitudes *at all* before coding began. Both gaps belong in the protocol.
