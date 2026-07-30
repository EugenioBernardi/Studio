# Interictal discharges cause accelerated long-term forgetting by capturing hippocampo-cortical coupling slots

**Working draft.** Status is stated plainly in §7: one registered prediction central to the
phenotype **failed**, and two subsidiary lines were withdrawn. This is a draft for internal
assessment, not a submission-ready manuscript.

---

## Abstract

Accelerated long-term forgetting (ALF) is a memory disorder in which recall is normal or
near-normal up to about an hour after learning and then declines abnormally fast over the following
days. It is prominent in transient epileptic amnesia and temporal lobe epilepsy, is routinely missed
by neuropsychological batteries that test at 30 minutes, and its cellular mechanism is unknown. A
2020 review of 51 group studies concluded that ALF is "likely a disorder of late memory
consolidation" and reported *contradictory* associations with epileptiform activity.

We asked whether ALF follows from a single, already-measured fact: interictal epileptiform
discharges (IEDs) are precisely coupled to cortical sleep spindles, and this coupling *surpasses*
physiological ripple–spindle coupling. We model the hippocampo-cortical dialogue as a channel with a
finite number of coupling slots per night, in which an IED-driven event is **structurally intact and
semantically empty** — the slow-oscillation/spindle machinery fires, more strongly than physiology
does, but carries no valid hippocampal replay.

The consequence follows without further assumption. The hippocampal trace decays on its normal
schedule, so early recall is nearly preserved; the cortical trace is never written, so late recall
collapses. Across 40 simulated patients in whom discharge rate and coupling varied
independently, one-week retention correlated with discharge rate at ρ = -0.50, with
spindle density at ρ = -0.14, and with the fraction of coupling events carrying replay at
ρ = 0.94. Because IEDs *add* spindles and *raise* coupling strength, the conventional
sleep-EEG markers of consolidation move in the wrong direction: at matched discharge rate, a night
that loses the memory and a night that does not are indistinguishable by spindle density
(14.2 vs 11.0/min) while one-week recall differs by
0.76 of the list.

We further show that Alzheimer's disease reaches the same behavioural phenotype through a different
failure of the same channel — undersupply rather than capture — and that the two are separable by
spindle density, which is *elevated* in epilepsy and *reduced* in Alzheimer's.

---

## 1. The problem

Two facts sit next to each other in the literature and have not been joined.

**First**, ALF exists and is mechanistically unexplained. Patients learn normally, perform normally
at 30 minutes, and have lost the material a week later. Because the standard delayed-recall interval
*is* 30 minutes, these patients are frequently recorded as having normal memory.

**Second**, IEDs interact with the physiology of consolidation in a specific and counter-intuitive
way. Gelinas et al. (2016) showed in rat and human that hippocampal IEDs are precisely coordinated
with prefrontal spindles, that this coordination *surpasses* normal ripple–spindle coupling, and that
it is accompanied by *decreased* ripple occurrence — concluding that IEDs impair memory through the
"misappropriation of physiological mechanisms" for hippocampo-cortical coupling. Uehara et al. (2026)
extended this in ten patients with temporal lobe epilepsy: hippocampal IEDs *induced* frontal
spindles, *increased* slow-oscillation incidence, and produced spindle–slow-oscillation coupling with
*higher* phase consistency than uncoupled spindles.

The implication has not been drawn: if discharges drive the coupling machinery *harder* than
physiology does while carrying nothing, then the channel is not blocked — it is fired with the wrong
payload. That is a hypothesis about *what is measured*, not only about what is lost, and it makes
predictions that run opposite to the standard reading of a sleep study.

## 2. Model

The model is deliberately minimal and is built on machinery validated previously in this project
(sparse cortical assemblies, a trisynaptic hippocampal index, ripple-paced replay, and a directed
cortico-cortical store).

**The channel.** Each slow-oscillation up-state is an opportunity for a coupling event. A
physiological spindle rides only a fraction of up-states, set so that healthy spindle density is
5.7/min — within the 2–6/min range reported in human NREM sleep. Each physiological
event replays one item and writes its transition into cortex.

**The pathology.** IEDs arrive as a Poisson process. An IED arriving at an up-state captures the slot
with probability *coupling*. A captured slot still produces a spindle — with the higher phase
consistency Uehara et al. report — but writes nothing.

**Retrieval through two redundant routes.** An item is recalled if either the hippocampal route (CA3
walks the index and reinstates the cortical assembly; efficacy decays as exp(−t/τ), τ = 3 days) or
the cortical route (the consolidated weights alone) delivers it. Recall is graded: recovery evidence
is mapped to a recall probability through a logistic, so partial consolidation means a reduced
chance of recall rather than a certainty either way.

**Two corrections forced during construction**, both recorded because they changed the result:
replay is *salience-biased* along a serial-position curve rather than round-robin (with uniform
replay every item crosses threshold together and a list can only score 0 or 1); and health is
calibrated to ~0.85 one-week list retention rather than to perfect consolidation (perfect
consolidation gives healthy sleepers unlimited reserve and makes the model unfalsifiable).

**Calibration.** One free quantity: the per-replay weight increment, set by bisection so the
discharge-free night reaches 0.85 one-week retention. Calibrated on the healthy condition only and
frozen for every pathological condition, so it cannot absorb the pathology.

## 3. The phenotype

Eight simulated subjects, a 15-item list, one night of NREM.

| condition | 30 min | 6 h | 1 day | 1 week | 1 mo | density/min | coupling | replay frac |
|---|---|---|---|---|---|---|---|---|
| healthy | 0.97 | 0.97 | 0.97 | 0.85 | 0.85 | 5.7 | 0.55 | 1.00 |
| IED 15/min, coupled | 0.92 | 0.91 | 0.90 | 0.62 | 0.61 | 6.7 | 0.64 | 0.77 |
| IED 30/min, coupled | 0.85 | 0.85 | 0.83 | 0.36 | 0.35 | 7.9 | 0.71 | 0.55 |
| IED 60/min, coupled | 0.79 | 0.78 | 0.76 | 0.09 | 0.08 | 11.0 | 0.77 | 0.32 |
| IED 30/min, **uncoupled** | 0.97 | 0.97 | 0.97 | 0.85 | 0.85 | 10.4 | 0.67 | 1.00 |
| IED 60/min, **uncoupled** | 0.97 | 0.97 | 0.97 | 0.85 | 0.85 | 14.2 | 0.71 | 1.00 |

**Figure 1** plots these curves.

The deficit *grows with delay*: at 30 discharges/min the healthy-minus-patient gap runs
0.12 (30 min), 0.12 (6 h), 0.14 (1 day), 0.49 (1 week), 0.50 (1 mo). A fixed encoding deficit
would show a constant gap; this is loss over time, which is what "accelerated forgetting" names.

**The registered criterion for the phenotype was not met.** We required, at a single dose, an early
gap ≤ 0.10 *and* a one-week gap ≥ 0.25. At 15/min the early gap is
0.06 but the late gap is only 0.23; at
30/min the late gap is 0.49 but the early gap is
0.12. Neither dose satisfies both. We did not search for an
intermediate dose that would, because that is parameter-hunting. The model therefore predicts that
ALF patients are **not truly normal early** but near-normal, and that sufficiently sensitive early
testing should reveal a small deficit of order one to two items. This is falsifiable and, we note,
consistent with the literature's own hedge — "normal *or near-normal*".

## 4. Why the clinical literature disagrees with itself

Discharge rate and coupling vary independently across patients: two people with the same spike count
can differ in how much of it lands on the consolidation channel. Across 40 simulated patients
(**Figure 2**):

| predictor | Spearman ρ with one-week recall |
|---|---|
| discharge rate | -0.50 |
| spindle density | -0.14 |
| SO–spindle coupling strength | -0.75 |
| **fraction of coupling events carrying replay** | **0.94** |

Spike burden is a weak predictor; spindle density has essentially none; coupling strength is
*inverted*. The variable that predicts is the one no clinical study measures. This is a quantitative
account of the contradictory associations reported across 51 studies: the field has been correlating
against the wrong quantity.

**The inverted biomarker.** At matched discharge rate, coupled and uncoupled nights both raise
spindle density (11.0 and 14.2/min against healthy
5.7) and both raise coupling strength (0.77 and
0.71 against 0.55) — yet one-week recall is
0.09 coupled against 0.85 uncoupled. A sleep study sees the same
abnormality in a patient who will forget and a patient who will not. Reading spindle density as a
proxy for consolidation would rank the worst-affected patient as the healthiest.

## 5. Two diseases, one channel

Epilepsy hijacks a channel of normal supply. Alzheimer's undersupplies it — fewer slow-oscillation
slots, reduced spindle generation, lower cortical capacity, a faster-decaying hippocampal trace, and
a modest amount of discharge capture from subclinical epileptiform activity. **Figure 3**.

| condition | 30 min | 1 day | 1 week | slots | density/min |
|---|---|---|---|---|---|
| healthy | 0.97 | 0.97 | 0.85 | 342 | 5.7 |
| TEA | 0.89 | 0.87 | 0.51 | 342 | 7.9 |
| TLE-HS | 0.78 | 0.35 | 0.27 | 342 | 9.0 |
| AD | 0.76 | 0.30 | 0.09 | 196 | 5.1 |

Two results follow.

**The epilepsy family splits by structural damage.** Transient epileptic amnesia — discharges without
much structural damage — gives an early gap of 0.08 and a
one-week gap of 0.34: pure accelerated forgetting behind a
normal bedside test. Adding hippocampal sclerosis gives an early gap of
0.19 — ordinary amnesia. The discharges are the same;
sclerosis removes the route that was covering the early delay. The bedside test was never measuring
the damaged system.

**Spindle density separates the mechanisms even though the behaviour does not.** Epilepsy
7.9/min, healthy 5.7/min, Alzheimer's
5.1/min. A hijacked channel runs hot; an undersupplied one runs cold.

**Which part of "Alzheimer's" carries the deficit.** We modelled AD as four stacked deficits and
then separated them, because attributing an outcome to a mechanism without varying the mechanism is
the error that invalidated an earlier line of this project. Leave-one-out from the full profile
(**Figure 4**), one-week recall recovered when each is reverted to healthy:

| component removed | recovery at 30 min | recovery at 1 day | recovery at 1 week |
|---|---|---|---|
| slot supply | +0.08 | +0.21 | +0.29 |
| spindle generation | +0.06 | +0.18 | +0.25 |
| discharge capture | +0.02 | +0.03 | +0.03 |
| hippocampal decay | +0.03 | +0.46 | +0.01 |
| cortical capacity | +0.00 | +0.00 | +0.00 |

Three things follow, two of them uncomfortable.

*AD's accelerated forgetting is a **supply** failure.* The one-week deficit is carried by the two
supply-side components — slot supply (+0.29) and
spindle generation (+0.25). No single component
reproduces the full deficit: the worst alone reaches
0.44 at one week against
0.09 for the full profile. The phenotype is built from converging partial
failures, which is what a degenerative disease should look like and why no single-mechanism account
of AD memory loss will fit.

*Discharge capture — the mechanism this whole model was built on — is a minor term in Alzheimer's*
(+0.03). It belongs to epilepsy. This is also why
the levetiracetam prediction failed in AD: a drug that frees a hijacked channel cannot help a channel
nobody occupied.

*One modelled component is inert.* Reduced cortical capacity contributes
+0.00 — nothing — because in this model the
cortico-cortical weights never approach their ceiling, so lowering the ceiling changes nothing. We
report it rather than quietly dropping it: it means the model as built has no purchase on cortical
synaptic loss, and any claim about that mechanism would have to come from elsewhere.

**A registered prediction about the timing of the components failed.** We predicted that hippocampal
decay would act early and slot supply late. Slot supply does act late
(+0.29 at one week vs
+0.08 at 30 min), but hippocampal decay does not act
early — it contributes +0.03 at 30 minutes and
+0.01 at one week, and its effect is
concentrated at the **intermediate** delay (+0.46
at one day). In hindsight this is the sensible answer and we should have predicted it: at 30 minutes
even a degraded hippocampal trace suffices, at one week it has decayed in every condition, and only
in between does its decay *rate* matter. The split between early and late causes is real; our
assignment of which cause acts when was wrong.

## 6. Predictions

1. **Measure the captured fraction, not the spike count.** The fraction of slow-oscillation/spindle
   coupling events accompanied by a physiological hippocampal ripple should predict overnight
   retention; spike counts should predict it weakly and inconsistently.
2. **Spindle density and SO–spindle coupling strength are corrupted biomarkers in epilepsy.** They
   rise with discharge burden while retention falls, and cannot separate a harmful from a harmless
   discharge burden at matched rate.
3. **ALF patients are near-normal, not normal, at short delay.** Sensitive early testing should show
   a small deficit (order 1–2 items on a 15-item list).
4. **Spindle density distinguishes capture from undersupply** — elevated in epilepsy, reduced in
   Alzheimer's, with the same accelerated-forgetting profile.
5. **Sclerosis converts ALF into amnesia** by removing the compensating route, so the presence of a
   normal 30-minute test in an epilepsy patient is informative about hippocampal integrity.

## 7. Status, limitations, and what was withdrawn

Reported as failures rather than omitted.

- **The registered phenotype criterion (P1) failed**, as set out in §3. The qualitative pattern is
  robust; the specific conjunction of a ≤0.10 early gap with a ≥0.25 late gap was not achieved at
  either dose tested.
- **A prediction about component timing failed** (§5): hippocampal decay acts at the intermediate
  delay, not early, so our assignment of which AD component acts when was wrong even though the
  early/late split itself holds. One modelled component (cortical capacity) is inert.
- **A levetiracetam account was withdrawn.** We predicted that benefit would track captured fraction
  and show an inverted-U dose response (SV2A blockade damping discharges more than ripples, but
  damping both), offering a mechanism for the observation that 62.5 and 125 mg BID improved memory in
  amnestic MCI while 250 mg did not. Best gain was 0.00 of the list
  against a registered 0.08, on a non-monotone curve. Not supported; not tuned until it was.
- **A harness bug produced a false negative** and is recorded. A shared random stream let discharge
  parameters perturb the physiological spindle schedule, giving a "matched-rate" control with 11%
  fewer coupling slots (317 vs 355) and an apparent memory cost where nothing had been captured.
  With independent streams the uncoupled night is identical to healthy by construction — which makes
  the memory half of that control definitional, so the control was restated to test the biomarker
  dissociation, which is not definitional.
- **Assumed rather than derived**, each a published regularity and each a place the model could be
  wrong: higher phase consistency for IED-coupled spindles; a hippocampal trace decaying over days
  against an accruing cortical one; salience-biased replay; calibration to ~0.85 normal one-week
  retention.
- **Not modelled**: seizures themselves, medication effects other than the withdrawn levetiracetam
  analysis, REM, or any wake-state contribution to consolidation.

## 8. Availability

Model `src/alf.js`; suites `test/stage43_alf.js`, `test/stage44_disease.js`,
`test/stage45_ad_components.js` (`npm run test:alf`, `test:disease`, `test:ad-components`).
Every figure and every number in this draft is generated from `figures/*.json` written by those
suites; `figures/build-figures.js` and `figures/build-draft.js` regenerate the figure page and
this document.

## References

- Gelinas JN, Khodagholy D, Thesen T, Devinsky O, Buzsáki G. Interictal epileptiform discharges
  induce hippocampal–cortical coupling in temporal lobe epilepsy. *Nat Med* 2016;22:641–8.
  doi:10.1038/nm.4084
- Uehara T, Barcelon EA, Shigeto H, et al. Hippocampal interictal discharges induce frontal spindles
  and enhance spindle–slow oscillation coupling in temporal lobe epilepsy. *Clin Neurophysiol Pract*
  2026;11:321–31. doi:10.1016/j.cnp.2026.04.005
- Mameniškienė R, Puteikis K, Jasionis A, Jatužis D. A review of accelerated long-term forgetting in
  epilepsy. *Brain Sci* 2020;10:945. doi:10.3390/brainsci10120945
- Antony JW, Piloto L, Wang M, Pacheco P, Norman KA, Paller KA. Sleep spindle refractoriness
  segregates periods of memory reactivation. *Curr Biol* 2018;28:1736–43.
  doi:10.1016/j.cub.2018.04.020
- Wei Y, Krishnan GP, Komarov M, Bazhenov M. Differential roles of sleep spindles and sleep slow
  oscillations in memory consolidation. *PLoS Comput Biol* 2018;14:e1006322.
  doi:10.1371/journal.pcbi.1006322
- Bakker A, Albert MS, Krauss G, Speck CL, Gallagher M. Response of the medial temporal lobe network
  in amnestic mild cognitive impairment to therapeutic intervention. *Neuroimage Clin*
  2015;7:688–98. doi:10.1016/j.nicl.2015.02.009
- Horakova H, Fendrych Mazancova A, Vyhnalek M. Challenging memory tests in early Alzheimer's
  disease. *Neurosci Biobehav Rev* 2026;186:106701. doi:10.1016/j.neubiorev.2026.106701
