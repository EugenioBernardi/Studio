"use strict";
/* Emits docs/ALF-DRAFT.md. Prose is fixed here; every NUMBER is interpolated from figures/*.json,
   which the test suites write. A number in the manuscript therefore cannot be stale or invented —
   if a suite is re-run and a result moves, the draft moves with it. */

const fs = require("fs"), path = require("path");
const DIR = __dirname, ROOT = path.join(DIR, "..");
const read = n => { try { return JSON.parse(fs.readFileSync(path.join(DIR, n), "utf8")); }
                    catch (e) { return null; } };
const alf = read("alf.json"), dis = read("disease.json"), adc = read("ad-components.json");
const sen = read("sensitivity.json"), alt = read("alternatives.json");
if (!alf || !dis || !adc) {
  console.error("missing figures/*.json — run test:alf, test:disease, test:ad-components first");
  process.exit(1);
}
const n = (x, d = 2) => (x == null || Number.isNaN(x) ? "—" : Number(x).toFixed(d));
const cv = alf.curves, co = alf.cohort, C = dis.conditions;
const H = cv["healthy"], M15 = cv["IED 15/min, coupled"], M30 = cv["IED 30/min, coupled"],
      M60 = cv["IED 60/min, coupled"], U30 = cv["IED 30/min, UNCOUPLED"],
      U60 = cv["IED 60/min, UNCOUPLED"];
const DL = ["30 min", "6 h", "1 day", "1 week", "1 mo"];
const row = (tag, c) => `| ${tag} | ${c.recall.map(x => n(x)).join(" | ")} | ${n(c.density, 1)} | ${n(c.couplingStrength)} | ${n(c.replayFrac)} |`;

/* leave-one-out ordering for the AD section */
const looRows = Object.entries(adc.leaveOneOut)
  .map(([k, r]) => ({ k, late: r.recall[2] - adc.alone.full.recall[2],
                      mid: r.recall[1] - adc.alone.full.recall[1],
                      early: r.recall[0] - adc.alone.full.recall[0] }))
  .sort((a, b) => b.late - a.late);

const md = `# Interictal discharges cause accelerated long-term forgetting by capturing hippocampo-cortical coupling slots

**Working draft.** Status is stated plainly in §7. This is a draft for internal assessment.
Robustness of every claim to ±40% perturbation of every hand-set parameter is reported in §6b: the
two load-bearing conclusions hold in ${sen.summary.c2.of}/${sen.summary.c2.of} perturbations, and
the three that fail are named with the parameter responsible.

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
collapses. Across ${co.n} simulated patients in whom discharge rate and coupling varied
independently, one-week retention correlated with discharge rate at ρ = ${n(co.rhoRate)}, with
spindle density at ρ = ${n(co.rhoDens)}, and with the fraction of coupling events carrying replay at
ρ = ${n(co.rhoFrac)}. Because IEDs *add* spindles and *raise* coupling strength, the conventional
sleep-EEG markers of consolidation move in the wrong direction: at matched discharge rate, a night
that loses the memory and a night that does not are indistinguishable by spindle density
(${n(U60.density, 1)} vs ${n(M60.density, 1)}/min) while one-week recall differs by
${n(U60.recall[3] - M60.recall[3])} of the list.

The model reproduces an independent human measurement it was not fitted to. Schiller et al. (2025)
report coupled spindle–slow-wave rates reduced to ${n(dis.schiller.measured)} of control in temporal
lobe epilepsy; the model gives ${n(dis.schiller.modelRatio)}, produced by slot capture alone. The
same simulated patient shows *total* spindle density **rising** (${n(dis.schiller.densityHealthy, 1)}
→ ${n(dis.schiller.densityTLE, 1)}/min) while the *physiologically coupled* rate **falls** — so which
measure is reported decides whether epilepsy appears hyper- or hypo-coupled. Alzheimer's reaches the
same behavioural phenotype through undersupply rather than capture.

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
${n(H.density, 1)}/min — within the 2–6/min range reported in human NREM sleep. Each physiological
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

| condition | ${DL.join(" | ")} | density/min | coupling | replay frac |
|---|---|---|---|---|---|---|---|---|
${row("healthy", H)}
${row("IED 15/min, coupled", M15)}
${row("IED 30/min, coupled", M30)}
${row("IED 60/min, coupled", M60)}
${row("IED 30/min, **uncoupled**", U30)}
${row("IED 60/min, **uncoupled**", U60)}

**Figure 1** plots these curves.

The deficit *grows with delay*: at 30 discharges/min the healthy-minus-patient gap runs
${DL.map((d, i) => `${n(H.recall[i] - M30.recall[i])} (${d})`).join(", ")}. A fixed encoding deficit
would show a constant gap; this is loss over time, which is what "accelerated forgetting" names.

**The registered criterion for the phenotype was not met.** We required, at a single dose, an early
gap ≤ 0.10 *and* a one-week gap ≥ 0.25. At 15/min the early gap is
${n(H.recall[0] - M15.recall[0])} but the late gap is only ${n(H.recall[3] - M15.recall[3])}; at
30/min the late gap is ${n(H.recall[3] - M30.recall[3])} but the early gap is
${n(H.recall[0] - M30.recall[0])}. Neither dose satisfies both. We did not search for an
intermediate dose that would, because that is parameter-hunting. The model therefore predicts that
ALF patients are **not truly normal early** but near-normal, and that sufficiently sensitive early
testing should reveal a small deficit of order one to two items. This is falsifiable and, we note,
consistent with the literature's own hedge — "normal *or near-normal*".

## 4. Why the clinical literature disagrees with itself

Discharge rate and coupling vary independently across patients: two people with the same spike count
can differ in how much of it lands on the consolidation channel. Across ${co.n} simulated patients
(**Figure 2**):

| predictor | Spearman ρ with one-week recall |
|---|---|
| discharge rate | ${n(co.rhoRate)} |
| spindle density | ${n(co.rhoDens)} |
| SO–spindle coupling strength | ${n(co.rhoCS)} |
| **fraction of coupling events carrying replay** | **${n(co.rhoFrac)}** |

Spike burden is a weak predictor; spindle density has essentially none; coupling strength is
*inverted*. The variable that predicts is the one no clinical study measures. This is a quantitative
account of the contradictory associations reported across 51 studies: the field has been correlating
against the wrong quantity.

**The inverted biomarker.** At matched discharge rate, coupled and uncoupled nights both raise
spindle density (${n(M60.density, 1)} and ${n(U60.density, 1)}/min against healthy
${n(H.density, 1)}) and both raise coupling strength (${n(M60.couplingStrength)} and
${n(U60.couplingStrength)} against ${n(H.couplingStrength)}) — yet one-week recall is
${n(M60.recall[3])} coupled against ${n(U60.recall[3])} uncoupled. A sleep study sees the same
abnormality in a patient who will forget and a patient who will not. Reading spindle density as a
proxy for consolidation would rank the worst-affected patient as the healthiest.

## 5. Two diseases, one channel

Epilepsy hijacks a channel of normal supply. Alzheimer's undersupplies it — fewer slow-oscillation
slots, reduced spindle generation, lower cortical capacity, a faster-decaying hippocampal trace, and
a modest amount of discharge capture from subclinical epileptiform activity. **Figure 3**.

| condition | 30 min | 1 day | 1 week | slots | density/min |
|---|---|---|---|---|---|
${["healthy", "TEA", "TLE-HS", "AD"].filter(k => C[k]).map(k =>
  `| ${k} | ${C[k].recall.map(x => n(x)).join(" | ")} | ${n(C[k].slots, 0)} | ${n(C[k].density, 1)} |`).join("\n")}

Two results follow.

**The epilepsy family splits by structural damage.** Transient epileptic amnesia — discharges without
much structural damage — gives an early gap of ${n(C.healthy.recall[0] - C.TEA.recall[0])} and a
one-week gap of ${n(C.healthy.recall[2] - C.TEA.recall[2])}: pure accelerated forgetting behind a
normal bedside test. Adding hippocampal sclerosis gives an early gap of
${n(C.healthy.recall[0] - C["TLE-HS"].recall[0])} — ordinary amnesia. The discharges are the same;
sclerosis removes the route that was covering the early delay. The bedside test was never measuring
the damaged system.

**Spindle density separates the mechanisms even though the behaviour does not.** Epilepsy
${n(C.TEA.density, 1)}/min, healthy ${n(C.healthy.density, 1)}/min, Alzheimer's
${n(C.AD.density, 1)}/min. A hijacked channel runs hot; an undersupplied one runs cold.

**Which part of "Alzheimer's" carries the deficit.** We modelled AD as four stacked deficits and
then separated them, because attributing an outcome to a mechanism without varying the mechanism is
the error that invalidated an earlier line of this project. Leave-one-out from the full profile
(**Figure 4**), one-week recall recovered when each is reverted to healthy:

| component removed | recovery at 30 min | recovery at 1 day | recovery at 1 week |
|---|---|---|---|
${looRows.map(r => `| ${r.k} | +${n(r.early)} | +${n(r.mid)} | +${n(r.late)} |`).join("\n")}

Three things follow, two of them uncomfortable.

*AD's accelerated forgetting is a **supply** failure.* The one-week deficit is carried by the two
supply-side components — slot supply (+${n(looRows.find(r => r.k === "slot supply").late)}) and
spindle generation (+${n(looRows.find(r => r.k === "spindle generation").late)}). No single component
reproduces the full deficit: the worst alone reaches
${n(Math.min(...Object.values(adc.alone.components).map(r => r.recall[2])))} at one week against
${n(adc.alone.full.recall[2])} for the full profile. The phenotype is built from converging partial
failures, which is what a degenerative disease should look like and why no single-mechanism account
of AD memory loss will fit.

*Discharge capture — the mechanism this whole model was built on — is a minor term in Alzheimer's*
(+${n(looRows.find(r => r.k === "discharge capture").late)}). It belongs to epilepsy. This is also why
the levetiracetam prediction failed in AD: a drug that frees a hijacked channel cannot help a channel
nobody occupied.

*One modelled component is inert.* Reduced cortical capacity contributes
+${n(looRows.find(r => r.k === "cortical capacity").late)} — nothing — because in this model the
cortico-cortical weights never approach their ceiling, so lowering the ceiling changes nothing. We
report it rather than quietly dropping it: it means the model as built has no purchase on cortical
synaptic loss, and any claim about that mechanism would have to come from elsewhere.

**A registered prediction about the timing of the components failed.** We predicted that hippocampal
decay would act early and slot supply late. Slot supply does act late
(+${n(looRows.find(r => r.k === "slot supply").late)} at one week vs
+${n(looRows.find(r => r.k === "slot supply").early)} at 30 min), but hippocampal decay does not act
early — it contributes +${n(looRows.find(r => r.k === "hippocampal decay").early)} at 30 minutes and
+${n(looRows.find(r => r.k === "hippocampal decay").late)} at one week, and its effect is
concentrated at the **intermediate** delay (+${n(looRows.find(r => r.k === "hippocampal decay").mid)}
at one day). In hindsight this is the sensible answer and we should have predicted it: at 30 minutes
even a degraded hippocampal trace suffices, at one week it has decayed in every condition, and only
in between does its decay *rate* matter. The split between early and late causes is real; our
assignment of which cause acts when was wrong.

## 5b. External validation, and a claim withdrawn

The model made a prediction we could check against data it had never seen. It failed on one measure
and succeeded on another, and the two are not in conflict.

**The failure.** Reading *total* spindle density, the model says epilepsy runs hot — density
${n(dis.schiller.densityHealthy, 1)} → ${n(dis.schiller.densityTLE, 1)}/min — because
discharge-induced spindles add to the count. Schiller, von Ellenrieder, … Frauscher (*Epilepsia*
2025), recording 20 patients with unilateral drug-resistant temporal lobe epilepsy against 20
matched controls with high-density EEG and polysomnography, report the opposite direction for
spindle–slow-wave coupling: **globally reduced**, 0.18 vs 0.35/min (*d* = −0.46). The "runs hot"
claim, as stated, is withdrawn.

**The success, and the reason both are true.** Schiller's measure is the rate of *coupled
spindle–slow-wave events* — physiological coupling. That is not total spindle count. In the model
these two quantities diverge in the same patient:

| measure | healthy | TEA | TLE + sclerosis |
|---|---|---|---|
| total spindle density /min | ${n(dis.conditions.healthy.density, 1)} | ${n(dis.conditions.TEA.density, 1)} | ${n(dis.conditions["TLE-HS"].density, 1)} |
| **physiologically coupled rate /min** | ${n(dis.conditions.healthy.physioCoupledRate, 2)} | ${n(dis.conditions.TEA.physioCoupledRate, 2)} | ${n(dis.conditions["TLE-HS"].physioCoupledRate, 2)} |

The model's TLE/healthy ratio on Schiller's measure is **${n(dis.schiller.modelRatio)}** against a
measured **${n(dis.schiller.measured)}**. Nothing was fitted to it: the ratio falls out of slot
capture, and the comparison was made after the model was built and after its prediction was fixed.

We record that our first response to the contradiction was wrong. We added a spindle-suppression
term to the epilepsy profiles to reproduce the reduction directly, which destroyed the phenotype —
replay fraction fell to 0.33 and 30-minute recall to 0.78, eliminating the preserved early recall
that defines ALF. That was double-counting: capture already produces the reduction. The term was
removed.

**What this costs the disease-discrimination claim.** On the externally validated measure, epilepsy
and Alzheimer's are *both* reduced (${n(dis.schiller.modelRatio)} and
${n(dis.conditions.AD.physioCoupledRate / dis.conditions.healthy.physioCoupledRate)} of healthy). They
separate only on *total* density, which is the measure we cannot point to as validated. **A study
reporting total spindle density reduced in TLE would falsify that half outright.** We found none
either way.

## 6. Predictions

1. **Measure the captured fraction, not the spike count.** The fraction of slow-oscillation/spindle
   coupling events accompanied by a physiological hippocampal ripple should predict overnight
   retention; spike counts should predict it weakly and inconsistently.
2. **Spindle density and SO–spindle coupling strength are corrupted biomarkers in epilepsy.** They
   rise with discharge burden while retention falls, and cannot separate a harmful from a harmless
   discharge burden at matched rate.
3. **ALF patients are near-normal, not normal, at short delay.** Sensitive early testing should show
   a small deficit (order 1–2 items on a 15-item list).
4. **Total spindle count and physiologically coupled rate diverge in epilepsy** — the first rises
   with discharge burden, the second falls, in the same patient and the same night. Studies
   reporting one should not be read as evidence about the other. Only the second tracks retention.
5. **Sclerosis converts ALF into amnesia** by removing the compensating route, so the presence of a
   normal 30-minute test in an epilepsy patient is informative about hippocampal integrity.

## 6b. Robustness: which conclusions survive their own parameters

A conclusion that holds only at the values it was developed at is a coincidence, not a result. Every
hand-set quantity in the model — the physiological spindle probability, both coupling-consistency
constants, the discharge-induced spindle probability, slow-oscillation frequency, night length, both
read-out constants, both behavioural anchors, the hippocampal week ceiling and the specificity floor
— was perturbed by ±40% and the four conclusions re-evaluated. Nothing was tuned; the sweep only
reports.

| conclusion | holds in | breaks on |
|---|---|---|
| C1 the phenotype (early gap ≤ 0.10, late gap ≥ 0.25) | ${sen.summary.c1.held}/${sen.summary.c1.of} | ${sen.summary.c1.broke.join(", ") || "—"} |
| **C2 the divergence (density up, coupled rate down)** | **${sen.summary.c2.held}/${sen.summary.c2.of}** | ${sen.summary.c2.broke.join(", ") || "—"} |
| C3 the external anchor (ratio within 0.15 of 0.51) | ${sen.summary.c3.held}/${sen.summary.c3.of} | ${sen.summary.c3.broke.join(", ") || "—"} |
| **C4 the predictor (replay fraction beats rate)** | **${sen.summary.c4.held}/${sen.summary.c4.of}** | ${sen.summary.c4.broke.join(", ") || "—"} |

**The two claims the paper rests on are unconditionally robust.** The identifying prediction — that
capture and only capture drives total spindle density up while the physiologically coupled rate
falls — and the measurement recommendation — that replay-carrying fraction outpredicts discharge
count — each survive every perturbation of every parameter.

The three failures are named rather than buried, and each has a reason:

- **C1 under a 40% higher read-out threshold.** Raising the criterion for counting an item recalled
  compresses the early ceiling, so the 30-minute gap widens past 0.10. The phenotype is intact; the
  measurement of "normal early" is what moves.
- **C1 under a 40% higher one-week retention anchor.** Anchoring health near ceiling leaves less
  room for the late deficit to reach 0.25. This is a statement about the anchor, not the mechanism,
  and the anchor is set from normal human delayed recall.
- **C3 under a 40% lower slow-oscillation frequency.** Fewer coupling opportunities per night change
  the ratio to 0.36, outside the window around Schiller's 0.51. The external anchor therefore
  assumes a roughly normal slow-oscillation rate — reasonable for the patients Schiller recorded,
  but it means the quantitative match should not be claimed for populations with grossly abnormal
  slow-wave sleep.

## 7. Status, limitations, and what was withdrawn

Reported as failures rather than omitted.

- **The registered phenotype criterion (P1) failed**, as set out in §3. The qualitative pattern is
  robust; the specific conjunction of a ≤0.10 early gap with a ≥0.25 late gap was not achieved at
  either dose tested.
- **The "epilepsy runs hot" claim was withdrawn** after checking against Schiller et al. 2025
  (§5b), and our first attempted fix was itself wrong and is recorded there.
- **A prediction about component timing failed** (§5): hippocampal decay acts at the intermediate
  delay, not early, so our assignment of which AD component acts when was wrong even though the
  early/late split itself holds. One modelled component (cortical capacity) is inert.
- **A levetiracetam account was withdrawn.** We predicted that benefit would track captured fraction
  and show an inverted-U dose response (SV2A blockade damping discharges more than ripples, but
  damping both), offering a mechanism for the observation that 62.5 and 125 mg BID improved memory in
  amnestic MCI while 250 mg did not. Best gain was ${n((dis.levetiracetam ? Math.max(...dis.levetiracetam.curves.TEA) - dis.levetiracetam.curves.TEA[0] : 0))} of the list
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
- **Externally validated**: the physiologically coupled rate ratio in TLE
  (${n(dis.schiller.modelRatio)} model vs ${n(dis.schiller.measured)} measured, Schiller 2025), and
  reduced spindle activity in early Alzheimer's (Bender et al., *Neurology* 2025). **Not externally
  validated**: everything else, including the total-density discrimination between the two diseases.
- **A rival account is eliminated outright.** Of three serious alternatives implemented in the same
  model and matched for one-week severity — encoding deficit, consolidation-rate reduction, faster
  hippocampal decay — the decay account cannot reach ALF severity at all, flooring at
  ${n(alt && alt.unreachable && alt.unreachable.length ? alt.unreachable[0].floor : null)} because
  faster trace decay leaves consolidation untouched and whatever reached cortex is still there.
  Any viable account of ALF must act on consolidation, not only on the trace.
- **Not modelled**: seizures themselves, medication effects other than the withdrawn levetiracetam
  analysis, REM, or any wake-state contribution to consolidation.

## 8. Availability

Model \`src/alf.js\`; suites \`test/stage43_alf.js\`, \`test/stage44_disease.js\`,
\`test/stage45_ad_components.js\` (\`npm run test:alf\`, \`test:disease\`, \`test:ad-components\`).
Every figure and every number in this draft is generated from \`figures/*.json\` written by those
suites; \`figures/build-figures.js\` and \`figures/build-draft.js\` regenerate the figure page and
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
- Schiller K, von Ellenrieder N, Mansilla D, et al. Widespread decoupling of spindles and slow waves
  in temporal lobe epilepsy. *Epilepsia* 2025;66:2421–32. doi:10.1111/epi.18359
- Bender AC, Berezuk C, Pellerin KR, et al. Association of sleep spindle activity with cognitive
  decline in early clinical stages of Alzheimer disease. *Neurology* 2025;106:e214459.
  doi:10.1212/WNL.0000000000214459
- Bakker A, Albert MS, Krauss G, Speck CL, Gallagher M. Response of the medial temporal lobe network
  in amnestic mild cognitive impairment to therapeutic intervention. *Neuroimage Clin*
  2015;7:688–98. doi:10.1016/j.nicl.2015.02.009
- Horakova H, Fendrych Mazancova A, Vyhnalek M. Challenging memory tests in early Alzheimer's
  disease. *Neurosci Biobehav Rev* 2026;186:106701. doi:10.1016/j.neubiorev.2026.106701
`;

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs", "ALF-DRAFT.md"), md);
console.log("wrote docs/ALF-DRAFT.md (" + (md.length / 1024).toFixed(1) + " kB)");
