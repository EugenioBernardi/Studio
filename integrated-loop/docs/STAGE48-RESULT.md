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
