# Candidate topics: publishable computational neuroscience with clinical traction

Scoping note. These are chosen against three constraints: (1) they sit where the
Studio repo already points — biologically inspired visual models; (2) they reuse
data or cohorts already in reach (SPIN-type memory-unit cohorts, ADNI/OASIS,
open connectomes) rather than requiring new acquisition; (3) each has a
plausible, *checkable* knowledge gap, so a single Undermind deep search either
green-lights it or kills it in an afternoon.

## What actually makes a topic low-hanging

Worth stating explicitly, because it is the filter to reuse on future ideas:

1. **No new data collection.** Either open data, or variables already recorded
   in routine clinical practice (neuropsych scores, visual ratings, existing
   scans).
2. **The method is off-the-shelf and small.** A network-diffusion model is an
   eigendecomposition of a Laplacian; a CNN-lesioning study is a for-loop over
   layers. Anything requiring a new inference scheme is not low-hanging.
3. **The negative result is still publishable.** Robustness and validation
   questions have this property; novel-mechanism claims do not.
4. **The clinical framing is native, not bolted on.** The outcome variable
   should be something a clinician already measures.
5. **A referee can see the point from the abstract.** One figure, one claim.

---

## Tier A — fastest to a submittable manuscript

### A1. Computational models of visual hallucinations in Lewy body disease: a mapping review

**The idea.** There are now several distinct computational accounts of visual
hallucinations — predictive-coding / precision-weighting accounts, attractor and
noise-driven accounts, and deep generative-network demonstrations that produce
hallucination-like imagery by strengthening priors. What appears to be missing is
a systematic mapping of these models onto the *clinical phenomenology* that
neurologists actually grade: passage hallucinations vs. presence vs. formed
complex figures, the illusion–hallucination boundary, retained vs. lost insight,
and the relation to fluctuating attention.

**Why it is low-hanging.** No data at all. Undermind is close to purpose-built
for this: the deep-search output *is* the systematic-search backbone, and the
existing "Lewy Body Hallucinations" workspace already has the structural-MRI leg.
Realistically 4–6 weeks part-time.

**Where it lands.** A review-friendly clinical-neuroscience venue. It also does
double duty as the introduction and rationale section for A2/B2 below, so the
work is not spent once.

**Gap to verify.** Whether a review with this specific *model-to-symptom* framing
already exists. Reviews of hallucination mechanisms in DLB certainly exist; the
question is whether any of them is organised by computational model class rather
than by anatomy or neurotransmitter.

### A2. How much do network-spreading model conclusions depend on the connectome template?

**The idea.** Network-diffusion and epidemic-spreading models of tau and amyloid
propagation are almost always run on one structural connectome — often a healthy
young HCP template — and the choice is rarely justified. Re-run the same model on
several templates (different parcellations, tractography pipelines, age-matched
vs. young donors, functional vs. structural coupling) against the same tau-PET
data, and report how much the fitted epicentres and the model–data correlation
actually move.

**Why it is low-hanging.** Entirely open data. The model is a handful of lines of
linear algebra. And a null result — "conclusions are robust" — is as publishable
as a positive one, which removes most of the project risk.

**Where it lands.** A methods-oriented neuroimaging venue.

**Gap to verify.** Whether this sensitivity analysis has been done systematically
for *pathology-spreading* models specifically. Analogous work exists for
graph-theoretic connectomics metrics; that is not the same claim, and the
distinction is exactly what the search needs to resolve.

---

## Tier B — best novelty-per-unit-effort

### B1. Seeding a tau network-spreading model from plasma-predicted tau

**The idea.** Network-diffusion models need regional tau, which means tau-PET,
which most cohorts do not have. If plasma pTau217 (and related markers) can
predict a CenTauR-scaled tau burden, the question is whether a *predicted*
regional tau pattern is good enough to drive a spreading model — i.e. whether
model-fitted epicentres and predicted trajectories from plasma-derived input
agree with those from real PET in the subset where both exist.

**Why it matters clinically.** If it holds even approximately, spreading models
become runnable in the large plasma-only cohorts where PET will never be
affordable. If it fails, that is a useful and honest limit on how far
plasma-predicted tau can be pushed — currently an open question that people are
quietly assuming their way past.

**Why it is tractable.** It builds directly on the existing plasma-predicted
tau-PET gap analysis workspace, which is the hard part already done. The modelling
layer on top is small.

**Effort.** Larger than Tier A — call it a few months — but the groundwork is laid.

**Gap to verify.** Whether anyone has driven a spreading/propagation model from
plasma-derived rather than PET-derived regional burden.

### B2. Layer-wise degradation of a ventral-stream CNN as a model of posterior cortical atrophy

**The idea.** This is the one that uses the repo for what it is for. Take a
biologically-constrained ventral-stream model, degrade it in ways that mimic
posterior-predominant disease — add noise, prune units, reduce recurrence, damage
early vs. late layers — and ask whether the resulting *error profile* matches the
error profile of PCA / visual-variant AD patients on the visual tests already used
in clinic (shape and object perception, figure copy, space perception, crowding).
The claim to test is a dissociation: do posterior-early lesions reproduce the
apperceptive pattern while later-layer lesions do not?

**Why it is attractive.** Patient side is retrospective neuropsych data already in
the record. Model side is a laptop. And it is genuinely computational
neuroscience — a model of the visual system, not a classifier — while the outcome
variable is something a neurologist already scores. It also gives the repo a
first concrete target.

**The honest risk.** CNN-to-human error-profile comparison is methodologically
contested; the analysis must be framed as pattern-of-deficit similarity, not as a
claim that the network is a patient. That framing needs to be settled *before*
the analysis, not in response to review.

**Gap to verify.** Whether artificial-network lesioning has been used specifically
as a model of PCA, as opposed to the well-trodden general use of CNNs as ventral
stream models.

---

## Tier C — higher ceiling, longer runway

**Patient-specific generative model of hallucinations in DLB.** Rather than
demonstrating that a generative network can hallucinate, parameterize the
strength of the prior on a patient-derived variable — occipital hypometabolism,
dopaminergic imaging, cholinergic status — and test whether the parameter that
best reproduces each patient's imagery tracks their clinical hallucination
severity. This is the paper A1 and B2 are both stepping stones toward. It is not
low-hanging fruit and should not be attempted first.

---

## Suggested order

Run the gap checks for **A1**, **A2** and **B2** first — they are cheap and
mutually independent. A1 is the safest single bet and feeds everything else. B2 is
the one worth doing if the gap check comes back clean, because it is the only
candidate here that is both clinically native and genuinely *this repo's* project.

---

## Appendix: deep-search goals, ready to run

Written as self-contained goals, since that is what deep search wants. Each is
phrased so that a *dense* result set is the kill signal and a sparse one is the
green light.

**A1** — Find papers presenting computational or mathematical models of visual
hallucinations in Lewy body disease, Parkinson's disease dementia, or Charles
Bonnet syndrome, including predictive coding and precision-weighting accounts,
attractor-network and noise-driven models, and deep generative network
demonstrations. Prioritise papers that explicitly relate model parameters to
clinical hallucination phenomenology — passage and presence hallucinations,
formed complex hallucinations, illusions, retained insight — and any existing
reviews that organise this literature by model class rather than by anatomy or
neurotransmitter system.

**A2** — Find papers assessing how sensitive network-diffusion, epidemic-spreading,
or connectome-based propagation models of tau or amyloid pathology are to the
choice of structural connectome template, parcellation scheme, tractography
pipeline, or donor population. Include studies that compare fitted disease
epicentres or model–data fit across multiple connectome inputs, and distinguish
these from sensitivity analyses of ordinary graph-theoretic connectomic metrics.

**B1** — Find papers that drive a network-spreading, network-diffusion, or
connectome-based propagation model of tau pathology using regional tau estimates
derived from plasma biomarkers such as pTau217, rather than from tau-PET directly.
Include studies validating plasma-predicted regional or CenTauR-scaled tau burden
against tau-PET, and any work assessing whether predicted tau patterns preserve
the spatial information needed for propagation modelling.

**B2** — Find papers that lesion, degrade, or ablate units and layers of
convolutional or recurrent neural network models of the ventral visual stream and
compare the resulting behavioural error patterns to those of neurological patients
with visual-perceptual deficits. Prioritise work addressing posterior cortical
atrophy, visual-variant Alzheimer's disease, or apperceptive visual agnosia, and
studies comparing model degradation profiles to clinical visual-perception test
performance.
