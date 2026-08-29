# What you conclude about neurodegeneration in a ventral-stream model depends on how you model the damage

*Working draft.*

---

## Abstract

In-silico lesioning of deep networks has become an established way to model
neurodegeneration of the visual system, but individual studies each adopt a
single lesion model — usually progressive deletion of weights or of units — and
report conclusions about "degeneration" in general. We asked whether that
generalisation is safe. Using CORnet-S, whose stages are explicitly labelled V1,
V2, V4 and IT, we damaged one stage at a time under three lesion models (channel
ablation, synaptic weight deletion, channel gain dysregulation) and measured
performance on a battery of seven stimulus conditions built as analogues of the
visual tests used clinically in posterior cortical atrophy. Lesions were equated
across stages on canonical-stimulus performance before profiles were compared, so
that differences reflect the shape of the deficit rather than its magnitude.

Conclusions reversed with the lesion model. IT was by a wide margin the most
robust stage under channel ablation and gain dysregulation, but lost that
advantage entirely under synaptic deletion. The relationship between lesion site
and deficit shape was absent under ablation and gain, but significant under
synaptic deletion — and in the direction opposite to the clinical prediction that
motivated the study. We conclude that lesion-model choice is not an
implementation detail in this literature, and that inferring the site of damage
from a profile of visual test scores is not supported even in a model where the
site is known exactly.

## Introduction

Posterior cortical atrophy (PCA) is defined by progressive degradation of visual
perception with relative sparing of memory early in the course. What makes it
computationally interesting is that the deficit is not uniform: patients
characteristically fail on impoverished input — incomplete letters, silhouettes,
low-contrast forms, crowded arrays — while doing comparatively well on clean,
canonical, isolated stimuli. That apperceptive profile is what distinguishes PCA
from the associative and semantic visual failures of typical Alzheimer's disease,
and the profile, not the overall score, is the diagnostic information.

A real literature now simulates neurodegeneration in artificial networks by
progressively deleting weights or units and tracking the decline [Tul21, Moo22],
extended to neuroplasticity and retraining [Moo23], cognitive intervention
[Moo25b], and more realistic progression in visual cortex [Moo25]. Its outcome
measures are overall accuracy, saliency and representational similarity. No study
we are aware of has compared damaged ventral-stream models against the clinical
tests on which the syndrome is actually identified. Nearby work sharpens rather
than closes that gap: higher-layer lesions reproduced category-dependent errors in
object agnosia [Sei21]; simultanagnosia has been modelled with HMAX and Navon
letters [Bel14]; lesioning category-selective units yields specialised deficits
[Pri23]; and there is a long tradition of lesioned connectionist models of
neuropsychological syndromes [Far93, Cow06] and of perturbation studies
benchmarking ventral-stream models against primate inactivation [Bon20].

We began with a clinically motivated hypothesis pair:

> **H1.** Damage at early-to-intermediate stages (V1, V2) disproportionately
> impairs signal-degraded stimuli — fragmented, low contrast, noisy, crowded.
>
> **H2.** Damage at IT disproportionately impairs transformed but clean stimuli,
> where identification requires view-invariant representation.

Together these constitute a double dissociation, and it is the dissociation, not
any single deficit, that would license reading lesion site off a clinical profile.

A first experiment using channel ablation found no such dissociation. Rather than
report that negative from one lesion model, we asked whether it was a property of
the visual hierarchy or of the way we had chosen to damage it. That question
turned out to be the more interesting one.

## Methods

### Model

CORnet-S, a recurrent convolutional model of the primate ventral stream whose four
blocks are explicitly labelled V1, V2, V4 and IT. In a generic classifier "layer 7"
has no anatomical interpretation; here the site of a lesion is a claim about level
in the visual hierarchy. Published ImageNet weights, never retrained, so damage
cannot be compensated by re-learning — the analogue of damage to a mature system.

### Stimuli

Seven procedurally generated conditions on a ten-letter identification task
(A, E, F, H, K, N, P, R, T, X), rendered at varying size in four typefaces.
Letters are the format of several clinical tests, notably VOSP Incomplete Letters.

| Condition | Perturbation | Family | Clinical analogue |
|---|---|---|---|
| `canonical` | upright, high contrast, isolated | reference | screening |
| `fragmented` | ~50% of ink erased in patches centred on ink | degradation | VOSP Incomplete Letters |
| `low_contrast` | contrast compressed to 12% | degradation | contrast sensitivity |
| `noise` | additive Gaussian pixel noise | degradation | degraded-form perception |
| `crowded` | target flanked by two distractor letters | degradation | crowding |
| `rotated` | 50–130° rotation | transformation | unusual views |
| `sheared` | strong shear, minimal rotation | transformation | object decision |

The degradation family impoverishes the evidence for a normally posed form; the
transformation family presents clean evidence for a form outside its canonical
pose. The transformation family carries two geometrically independent
manipulations so that half the central contrast does not rest on one perturbation.

### Readout

A multinomial logistic readout trained on pooled IT activations of the *intact*
model across all conditions, then frozen, so subsequent changes are caused by the
lesion alone. Pooling is restricted to a central window (72% of the feature map):
whole-map pooling averages flanking letters into the target and turns crowding
into a readout artefact. In piloting, intact crowded accuracy was 0.40 under
whole-map pooling versus 0.70 with the central window, with every other condition
unchanged to two decimals.

### Lesion models

A lesion is applied to a single stage, so all downstream computation sees the
consequence, as after damage at an intermediate cortical stage.

- **Channel ablation** — a random fixed subset of feature channels silenced;
  loss of cortical units.
- **Synaptic deletion** — a random fraction of individual conv weights within
  the stage set to zero; the lesion model used by the existing in-silico
  degeneration literature. Because CORnet blocks are recurrent, a deleted weight
  is absent at every timestep, as a lost synapse would be.
- **Gain dysregulation** — a per-channel multiplicative gain, log-normal with
  standard deviation equal to severity; surviving but disordered tissue. This
  replaces an additive-noise lesion used in a first experiment, which proved
  uninformative because spatially independent noise is averaged away by the
  pooled readout.

Severity grids were set by a calibration pass, because the three models differ by
roughly an order of magnitude in damage per unit severity: ablation 0.08–0.55,
synaptic deletion 0.01–0.25, gain 0.15–0.90. Six lesion seeds for ablation and
deletion, five for gain.

### Severity matching and inference

Performance is expressed as *preservation*, the fraction of the intact model's
above-chance competence that survives:
\[
\text{preservation}=\frac{\text{acc}_{\text{lesion}}-\text{chance}}{\text{acc}_{\text{intact}}-\text{chance}}
\]
so a condition the intact model already finds hard is not scored as impaired
merely because its ceiling is lower. For each stage and seed we locate the
severity at which canonical preservation falls to 0.75 and read every other
condition at that severity. The **dissociation index** is mean preservation on
the transformation family minus that on the degradation family; H1 and H2 jointly
predict it to be positive for early stages and negative at IT.

The primary contrast was pre-specified as early (V1, V2) minus late (V4, IT)
dissociation index, tested by permuting stage labels across (stage, seed)
observations. Intervals are bootstrap; per-stage tests against zero are sign-flip
permutations.

## Results

The intact model performed every condition well above chance (0.10): canonical
1.00, low contrast 1.00, sheared 0.99, noise 0.97, rotated 0.97, crowded 0.86,
fragmented 0.67.

### Severity matching is necessary

Within a single lesion model, stages required very different nominal severities
to produce equal canonical impairment — under ablation, 0.18 at V1 against 0.40
at V2, a 2.2-fold difference. Any study comparing raw lesion magnitudes across
hierarchy levels will mistake fragility for specificity.

### Lesion site and deficit shape: the answer depends on the lesion model

The pre-specified early-minus-late contrast was:

| Lesion model | early − late | permutation *p* |
|---|---|---|
| channel ablation | +0.066 | 0.123 |
| synaptic deletion | **−0.128** | **0.0065** |
| gain dysregulation | −0.012 | 0.794 |

Under ablation and gain there is no detectable relationship between lesion site
and deficit shape. Under synaptic deletion there is a significant one — in the
direction *opposite* to H1 and H2. Per stage under deletion, V1 was −0.123
[−0.176, −0.071] and IT +0.157 [+0.130, +0.183], each significant against zero
(p = 0.031), with V1 negative in all six seeds and IT positive in all six. That is
a double dissociation, reversed: early synaptic loss disproportionately impairs
*transformed* stimuli, and IT synaptic loss disproportionately impairs *degraded*
stimuli.

### Stage vulnerability also reverses

IT was the most robust stage under ablation (+0.205 mean preservation versus the
other stages, p < 0.0001) and under gain (+0.258, p < 0.0001), but under synaptic
deletion that advantage disappeared and reversed (−0.050, p = 0.014). The reversal
is measure-dependent in an interpretable way: on the threshold measure — severity
needed to reach 75% canonical preservation — IT under deletion is indistinguishable
from the other stages (−0.005, p = 0.82). IT therefore withstands synaptic loss as
well as any stage up to a threshold and then collapses more steeply beyond it,
whereas V1 degrades gradually from the outset.

This matters for reading the existing literature. Reports that later layers
degrade more than early ones under synaptic decay [Moo25] are reproduced here
under synaptic deletion and contradicted under channel ablation, in the same model
on the same battery. The discrepancy is attributable to lesion model rather than
to a fact about the hierarchy.

### Crowding is sensitive but does not localise

Crowding was the most impaired condition at almost every combination of stage and
lesion model, with preservation as low as 0.10 (V4, synaptic deletion). Its
sensitivity to ventral-stream damage is high and its localising value is nil.

### Robustness of the deletion effect

The sign of the deletion contrast is stable across matching targets from 0.85 to
0.65 (−0.067 to −0.128), but its significance is not (p = 0.006 at target 0.75,
0.229 at 0.65). Leave-one-condition-out analysis shows the effect is carried
disproportionately by the noise condition: removing it takes the contrast to
−0.032 (p = 0.49), while removing any other condition leaves or strengthens it
(p ≤ 0.004). The reversed dissociation should therefore be reported as real but
not broadly distributed across the degradation family, and it is the weakest of
the three findings reported here.

## Discussion

We set out to test whether stage of damage in a ventral-stream model reproduces
the apperceptive-versus-associative distinction that separates PCA from typical
Alzheimer's disease. It does not. Under two of three lesion models there is no
relationship between lesion site and deficit shape at all, and under the third the
relationship runs opposite to the clinical prediction.

The more consequential finding is the one we did not set out to test. Two
conclusions that this literature routinely draws — which level of the hierarchy is
most vulnerable, and whether damage site shapes the deficit — both reverse
depending on whether degeneration is modelled as unit loss, synaptic loss, or
gain dysregulation, with lesions equated for global behavioural impact and
everything else held fixed. Lesion-model choice is therefore not an implementation
detail. A study using one lesion model is entitled to conclusions about that
lesion model, and the field's habit of generalising from one to "neurodegeneration"
is not supported by these results. The practical recommendation is that in-silico
degeneration studies report at least two mechanistically distinct lesion models,
and treat any finding that does not survive both as provisional.

For clinical interpretation the message is a caution. If profile shape does not
track lesion site even in a model where the site is known exactly and severity is
controlled by construction, then inferring the locus of damage from a patient's
profile across these tests is not straightforward. The finding on crowding points
the same way: it is the most sensitive marker of ventral-stream damage in this
model and simultaneously the least informative about where the damage is.

### Limitations

Five to six lesion seeds per cell is adequate for the vulnerability results and
marginal for the deletion dissociation, whose significance is target-dependent and
leans on one stimulus condition. The model is a feedforward-recurrent
approximation of the ventral stream and omits the dorsal contributions that are
prominent in PCA. Behaviour was read out only from IT. Damage was confined to one
stage at a time, whereas degeneration is distributed. Most importantly, no patient
data were analysed: these are claims about a model, and the resemblance to any
clinical syndrome remains untested.

### Next steps

The comparison that would make this clinical is a severity-matched profile from
patients on the corresponding tests — VOSP Incomplete Letters, Silhouettes, Object
Decision, plus a crowding measure — against a contrast group of amnestic
Alzheimer's disease, testing profile shape against the posterior-to-anterior
gradient of atrophy or hypometabolism. The present results predict that such
profiles will discriminate poorly by site, which is a falsifiable prediction and
the right way to use a null.
