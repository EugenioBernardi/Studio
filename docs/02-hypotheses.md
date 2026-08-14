# Candidate hypotheses

Five programmes, ordered by how cleanly they can be tested with open data. Each
carries the same five fields, deliberately:

- **Biological warrant** — independent (non-EEG) human evidence for the lesion.
  If this is weak, the hypothesis is decoration on a simulation.
- **Model encoding** — the specific parameter change, in which simulator.
- **Prediction** — a *dissociation*, with direction, in forward-invariant
  observables.
- **Test** — the OpenNeuro modality and contrast.
- **Falsifier** — what result kills it.

Literature retrieved via PubMed; DOI links are given inline for each claim.

---

## H1 — The aperiodic exponent cannot distinguish receptor loss from receptor kinetics

**Status: implemented** (`neurosim/experiments/gaba_dissociation.py`), results in
`docs/04-results.md`.

**Biological warrant.** Two distinct routes reduce effective GABA_A inhibition in
human disease. *Conductance loss*: reduced GAD67 and parvalbumin expression in
schizophrenia, and PV+ interneuron loss across epilepsy and dementia, reduce the
number and strength of inhibitory synapses — downregulation of parvalbumin at
cortical GABA synapses directly reduces network gamma
([DOI](https://doi.org/10.1523/JNEUROSCI.3041-11.2011)). *Kinetic change*:
GABA_A subunit composition (α1 vs α5, and δ-subunit) sets the decay time
constant, and shifts in subunit expression are documented in epilepsy and
development — this is also the axis benzodiazepines act on, in the opposite
direction. Critically, the two routes are molecularly independent but both
reduce time-integrated inhibitory charge.

**Why it matters clinically.** The aperiodic exponent is now widely read as a
one-dimensional E/I dial: flatter means more excitation, means worse. The
inference from field potentials to E/I balance was established by Gao, Peterson &
Voytek ([DOI](https://doi.org/10.1016/j.neuroimage.2017.06.078)) and validated
invasively in humans — the aperiodic exponent of subthalamic field potentials
tracks E/I balance in Parkinsonism
([DOI](https://doi.org/10.7554/eLife.82467)). But if two mechanisms needing
*opposite* drugs produce the same exponent, that dial is not a treatment-selection
biomarker, and using it as one would be actively harmful.

**Model encoding.** Brian2 COBA network. Conductance route: `w_inh` ±33%.
Kinetic route: `tau_inh` 6/10/15 ms. Full 3×3 grid × 3 seeds, so the two axes can
be crossed rather than compared one at a time.

**Prediction.** The exponent responds to both perturbations and so is degenerate.
The **knee frequency** is set by the dominant synaptic time constant and should
respond mainly to `tau_inh`. Hence (exponent, knee) separates the two lesions in
2-D where the exponent alone does not.

**Test.** Any OpenNeuro resting EEG cohort with medication metadata. The strongest
version is a *within-subject pharmacological* contrast: a benzodiazepine shifts
`tau_inh` with `w_inh` held fixed, so it should move the knee along the predicted
axis and is a direct causal test of the model's kinetic axis in humans.

**Falsifier.** If the knee moves as much with `w_inh` as with `tau_inh` in the
model, the dissociation does not exist and H1 dies in silico — no data needed.
On the data side: if benzodiazepine exposure shifts exponent and knee along the
*same* axis as PV-loss cohorts, the separation is not measurable in scalp EEG.

> **What actually happened:** the in-silico test refuted the clean form of H1.
> See `docs/04-results.md` — the honest result is more interesting than the
> hypothesis was.

---

## H2 — In Parkinson's, beta *burst duration* tracks bradykinesia; mean beta power does not

**Biological warrant.** Dopamine depletion strengthens the striatal indirect
pathway and destabilises the STN–GPe feedback loop, whose intrinsic resonance
lies in the beta band. In humans with implanted electrodes, beta bursts during
continuous movement accompany the velocity decrement of Parkinsonism
([DOI](https://doi.org/10.1016/j.nbd.2019.03.013)), and STN activity dynamics
predict limb movement ([DOI](https://doi.org/10.1093/brain/awz417)). Synchronised
spiking underlies the phase–amplitude coupling seen in the Parkinsonian STN
([DOI](https://doi.org/10.1016/j.nbd.2019.02.005)).

**The idea.** Mean beta power is a time-average that conflates two very different
regimes: many short bursts vs. few long ones. The pathological variable in the
loop model is the *dwell time* in the synchronised state, which mean power blurs.
So the hypothesis is that burst-duration distribution — specifically its tail —
carries the clinical signal that mean power loses.

**Model encoding.** NEST, not Brian2: this needs the STN–GPe–striatum loop with
realistic conduction delays, and established NEST basal ganglia models exist.
Dopamine depletion = increased striatal→GPe inhibition plus reduced GPe→GPe
collateral inhibition. Sweep depletion severity; extract beta burst durations by
thresholding the beta envelope at the 75th percentile.

**Prediction.** As depletion increases, the burst-duration distribution develops a
heavy tail while *median* burst amplitude changes comparatively little.
Cortico-basal coupling should therefore show a supralinear rise in the fraction
of time spent in bursts >200 ms, with mean beta power rising only weakly.

**Test.** OpenNeuro resting scalp EEG in PD with ON/OFF medication states. The
ON/OFF within-subject contrast is the key design — it controls for age, skull,
and montage, which is exactly what the between-group comparison cannot do.
Sensorimotor beta bursts are detectable at the scalp over C3/C4.

**Falsifier.** If burst duration and mean beta power correlate above ~0.9 across
subjects, the two are not separable at the scalp and the hypothesis is untestable
non-invasively — regardless of whether it is true in the STN.

**Caveat worth stating up front.** Scalp beta over sensorimotor cortex is not STN
beta. The model predicts a subcortical variable; the test measures a cortical
one. This weakens the link and should be acknowledged rather than glossed — the
honest framing is that a positive result is suggestive and a null is
uninformative about the STN itself.

---

## H3 — Alzheimer's is an oscillatory, not an E/I, lesion (a hypothesis built from a *negative* result)

**Biological warrant, and an important constraint.** The obvious story — amyloid
causes hyperexcitability, PV+/Nav1.1 dysfunction reduces inhibition, so the
spectrum should flatten — makes a clear aperiodic prediction. That prediction
appears to be **wrong**. Across two independent cohorts, resting-state EEG
signatures of Alzheimer's were driven by *periodic* but not aperiodic changes:
alpha and beta oscillatory power fell while aperiodic features did **not** differ
from controls ([DOI](https://doi.org/10.1016/j.nbd.2023.106380)).

**Why this is the most valuable hypothesis in the list.** It is the one place
where simulation is doing real work rather than confirming the obvious. A
published null becomes a hard constraint that most candidate mechanisms fail:
any AD mechanism is only admissible if it reproduces the alpha/beta power loss
**while leaving the aperiodic exponent statistically unchanged**. That is a
narrow target, and it is a constraint that the field's default
"hyperexcitability" account struggles to hit — a cortical E/I shift moves the
exponent almost by definition.

**Model encoding.** Test candidate mechanisms against the joint constraint:

1. *Cortical E/I shift* (reduced `w_inh`) — the default account. Predicted to
   **fail**: it moves the exponent.
2. *Thalamocortical / cholinergic* — reduce the rhythmic thalamic drive that
   paces alpha, leaving intracortical E/I intact. Predicted to pass: it removes
   an oscillatory peak without touching the aperiodic background.
3. *Selective long-range synaptic loss* — reduce long-range excitatory
   connectivity, leaving local balance intact.

Mechanism 2 connects to the thalamocortical dysrhythmia framework
([DOI](https://doi.org/10.3389/fneur.2015.00124)), which posits that thalamic
hyperpolarisation and low-threshold calcium bursting produce a pathological
low-frequency rhythm across several disorders.

**Prediction.** Only mechanisms leaving local E/I intact satisfy both constraints
simultaneously. This makes a positive claim: **AD's resting EEG phenotype is
generated upstream of cortical E/I balance**, in thalamocortical/neuromodulatory
pacing.

**Test.** OpenNeuro AD/MCI resting EEG. Compute exponent *and* parameterised
oscillatory peaks (via `specparam`) — the analysis must separate periodic from
aperiodic, which is the methodological point of the source paper. Then check
which simulated mechanism's joint (Δexponent ≈ 0, Δalpha < 0) signature matches.

**Falsifier.** If *no* modelled mechanism reproduces alpha loss at unchanged
exponent, the model class is inadequate — likely because point neurons cannot
capture the relevant thalamocortical dynamics, requiring T-type calcium currents
and a genuine two-population thalamic model.

---

## H4 — Interictal epileptic cortex sits on the supercritical side of the critical point

**Biological warrant.** Healthy cortex operates near a critical point, where
activity neither dies out nor saturates — the branching ratio sits near 1 and
avalanche sizes follow a power law with exponent ≈ 1.5. Epileptic tissue is
hypothesised to be tuned above that point, so that a perturbation that a healthy
network absorbs instead propagates. Empirically, interictal epileptiform activity
shows measurable **deviations from critical dynamics**
([DOI](https://doi.org/10.1523/JNEUROSCI.0809-16.2016)), and the relationship
between fast and slow timescale dynamics is characterised in human MEG and SEEG
([DOI](https://doi.org/10.1523/JNEUROSCI.4880-14.2015)).

**The refinement worth testing.** Rather than the coarse claim "epileptic tissue
is supercritical", the useful question is *spatial*: does distance-from-criticality
localise the seizure onset zone better than spectral markers, and does it do so
**interictally** — when no seizure is present? That would matter clinically,
since it would shorten the monitoring stays that currently require capturing
actual seizures.

**Model encoding.** Brian2 or NEST network tuned to criticality, then locally
perturbed: raise recurrent excitation, or reduce inhibitory coupling, in a
sub-population representing the focus. Compute avalanche statistics per channel
(`observables.avalanche_statistics`).

**Prediction.** Branching ratio and avalanche exponent shift monotonically with
local excitability, and the spatial gradient of the branching ratio peaks at the
focus — with a steeper gradient than that of high-frequency-oscillation rate,
the current standard marker.

**Test.** OpenNeuro iEEG/SEEG epilepsy datasets with annotated seizure onset
zones and resection outcome. The strongest test uses **surgical outcome** as
ground truth: in seizure-free patients, the resected volume should contain the
peak-branching-ratio channels.

**Falsifier.** If branching ratio does not differ between onset-zone and control
channels interictally, or does not exceed HFO rate in localisation accuracy, the
marker adds nothing clinically even if the physics is right.

**Methodological warning.** Subsampling badly biases naive branching-ratio
estimators toward 1 — iEEG samples a minute fraction of neurons, so this is not a
small correction. Use the Wilting & Priesemann multistep-regression estimator.
The naive estimator in `observables.py` is documented as such and is adequate for
fully-observed simulations only. This single issue is the most likely source of a
spurious positive in H4.

---

## H5 — NMDA hypofunction on interneurons, not pyramidal cells, produces the schizophrenia gamma phenotype

**Biological warrant.** The NMDA-hypofunction account of schizophrenia is
supported by ketamine pharmacology and by post-mortem findings of reduced GAD67
and parvalbumin. But the *cellular target* is contested, and it matters: NMDAR
hypofunction models show abnormal gamma oscillations
([DOI](https://doi.org/10.1016/j.biopsych.2015.07.005)), while pyramidal-cell
selective ablation of NMDAR1 increases cellular and network excitability
([DOI](https://doi.org/10.1016/j.biopsych.2014.06.026)) — a distinct signature.
Modelling has linked PV+ interneurons specifically to auditory steady-state
response deficits ([DOI](https://doi.org/10.1038/s41598-019-53682-5)).

**The dissociation.** The clinical phenotype is paradoxical and therefore
diagnostic: schizophrenia shows *reduced* evoked 40 Hz ASSR power alongside
*increased* spontaneous broadband gamma. A single "less gamma" mechanism cannot
produce both. Removing NMDA drive from fast-spiking interneurons disinhibits
pyramidal cells (raising spontaneous gamma) while degrading the interneuron
network's ability to entrain to an external 40 Hz drive (lowering evoked ASSR).
Removing NMDA from pyramidal cells should reduce both.

**Model encoding.** Brian2 network with an explicit slow NMDA conductance
alongside fast AMPA, targeted separately at E and I populations. Drive with a
40 Hz modulated Poisson input to simulate the ASSR paradigm. Observables:
evoked 40 Hz inter-trial phase coherence, and spontaneous 30–80 Hz relative power
in the pre-stimulus baseline.

**Prediction.** *Interneuron-targeted* hypofunction uniquely produces the signed
double dissociation (evoked ↓, spontaneous ↑). Pyramidal-targeted hypofunction
moves both in the same direction. The sign pattern — not the magnitude — is the
discriminative result, which makes it robust to the amplitude ambiguity of scalp
EEG.

**Test.** OpenNeuro ASSR/auditory-oddball EEG datasets in schizophrenia. Both
observables come from a single recording, so the within-subject contrast is
immune to between-group montage and skull differences.

**Falsifier.** If pyramidal-targeted hypofunction also produces the signed
dissociation in the model, the ASSR/spontaneous-gamma pair does not localise the
lesion to a cell type, and the clinical claim cannot be supported.

---

## Prioritisation

| | Biological warrant | Testable on OpenNeuro | Clinical value | Effort |
|---|---|---|---|---|
| H1 GABA_A degeneracy | Strong | High | High — biomarker validity | Low (done) |
| H3 AD oscillatory | Strong (incl. a null) | High | High — mechanism | Medium |
| H5 Schizophrenia ASSR | Strong | Medium — needs ASSR data | High | Medium |
| H4 Epilepsy criticality | Strong | High (iEEG) | Very high — surgical | High |
| H2 Parkinson bursts | Very strong | Medium — scalp≠STN | Medium | High (NEST) |

**Recommended order: H1 → H3 → H5.** H1 is done and its refutation
(`docs/04-results.md`) already tightens the others. H3 is the best
science-per-unit-effort in the list, because a published null constrains it
before any new data is touched. H4 has the highest clinical ceiling but demands
the most methodological care, and its most likely failure mode — subsampling bias
in the branching ratio — produces a *false positive*, which is the worst kind.
