# Where the damage sits determines what the patient fails: stage-specific lesions in a ventral-stream model reproduce the apperceptive profile of posterior cortical atrophy

*Working draft. Results and Discussion are written from `results/lesion_results.csv`
and are filled in once the run completes.*

---

## Introduction

Posterior cortical atrophy (PCA) is defined clinically by a progressive
degradation of visual perception with relative sparing of memory and insight
early in the course. What makes it interesting computationally is that the
deficit is not uniform. Patients characteristically fail on impoverished input —
incomplete letters, silhouettes, low-contrast forms, crowded arrays — while
performing comparatively well on clean, canonical, isolated stimuli. This is the
classical apperceptive profile, and it is what distinguishes PCA from the
associative and semantic visual failures seen in typical Alzheimer's disease.

There is by now a real literature simulating neurodegeneration in artificial
networks. Deep networks trained for object recognition have been progressively
damaged by deleting weights or whole units, and the resulting decline tracked
over "disease" progression [Tul21, Moo22], extended to neuroplasticity and
retraining [Moo23], to cognitive intervention [Moo25b], and to more realistic
progression dynamics in visual cortex [Moo25]. That work has established the
paradigm and shown, among other things, that damage can strip object-level
representations before category-level ones [Tul21], and that later layers can
degrade more than early ones under synaptic decay [Moo25].

What this literature has not done is ask the question a neurologist would ask.
Its outcome measures are overall recognition accuracy, saliency, and
representational similarity. But the clinical signature of PCA is not "worse
recognition" — it is a *specific pattern* of failure across stimulus conditions,
and that pattern is the diagnostic information. No study we are aware of has
compared damaged ventral-stream models against the standard clinical visual
tests — incomplete letters, silhouettes, object decision, shape detection,
crowding — on which the syndrome is actually identified.

The nearest neighbours make the gap sharper rather than closing it. Lesions to
higher layers of a network reproduced category-dependent errors in a case of
object agnosia [Sei21], but the target was semantic category, not apperceptive
processing. Simultanagnosia has been modelled with HMAX and Navon hierarchical
letters [Bel14], giving a test-like lesion framework, but without a deep network
or a degenerative syndrome. Lesioning category-selective units yields
functionally specialised deficits [Pri23], and there is a long tradition of
lesioned connectionist models of neuropsychological syndromes [Far93, Cow06] and
of perturbation studies benchmarking ventral-stream models against primate
inactivation [Bon20]. None of these addresses PCA.

We ask a question with a determinate answer. If the ventral stream is damaged at
different levels, does the *shape* of the resulting visual deficit change in the
way the clinical apperceptive/associative distinction predicts? Specifically:

> **H1.** Damage at early-to-intermediate stages (V1, V2) produces
> disproportionate impairment on signal-degraded stimuli — fragmented, low
> contrast, noisy, crowded — relative to canonical stimuli.
>
> **H2.** Damage at the top of the hierarchy (IT) produces disproportionate
> impairment on transformed but clean stimuli — unusual viewpoint — where
> identification requires view-invariant representation.

Together these constitute a double dissociation in the model, and it is the
double dissociation, not any single deficit, that would license mapping stage of
damage onto clinical phenotype.

The critical methodological point is that this question cannot be answered by
comparing lesions of equal nominal size. Silencing 30% of channels at V1 and at
IT does not do equal functional damage, so any raw comparison confounds *where*
the lesion is with *how bad* it is. We therefore equate lesions on a reference
condition — canonical stimuli, the analogue of a clinician's basic screening
test — before comparing them anywhere else. Whatever difference survives that
matching is a difference in the shape of the deficit.

## Methods

### Model

We use CORnet-S, a recurrent convolutional model of the primate ventral stream
whose four blocks are explicitly labelled V1, V2, V4 and IT and were designed to
map onto the corresponding cortical areas. This choice matters for the question:
in a generic feedforward classifier, "layer 7" has no anatomical interpretation,
whereas here the site of a lesion is a claim about level in the visual hierarchy.
The model is used with its published ImageNet weights and is never retrained, so
that a lesion cannot be compensated by re-learning — the analogue of damage to an
already-mature visual system.

### Stimuli

Six conditions were generated procedurally, each a perturbation of a letter
identification task with ten letter classes (A, E, F, H, K, N, P, R, T, X)
rendered at varying size and in four typefaces. Letters are used because they are
the format of several of the clinical tests themselves, notably VOSP Incomplete
Letters.

| Condition | Perturbation | Clinical analogue |
|---|---|---|
| `canonical` | upright, high contrast, isolated | baseline / screening |
| `fragmented` | ~50% of ink erased in circular patches centred on ink | VOSP Incomplete Letters |
| `low_contrast` | luminance contrast compressed to 12% | contrast sensitivity |
| `noise` | additive Gaussian pixel noise | degraded-form perception |
| `crowded` | target flanked by two distractor letters | crowding |
| `unusual_view` | 50–130° rotation plus shear | object decision / unusual views |

The first four impoverish the evidence for a form that is otherwise normally
posed (the degradation family); the last presents clean evidence for a form
outside its canonical pose (the transformation family). This split carries the
central contrast.

### Readout

A multinomial logistic readout was trained on spatially pooled IT activations of
the *intact* model, across all six conditions, so that the healthy model performs
every test — the analogue of a visual system that was competent before disease
onset. The readout is then frozen. All subsequent changes in performance are
caused by the lesion alone.

Pooling is restricted to a central window of the feature map (72% of its extent)
rather than the whole map. With whole-map pooling the flanking letters are
averaged into the target and crowding becomes an artefact of the readout rather
than a perceptual effect: intact crowded accuracy sat at 0.40 with whole-map
pooling versus 0.70 with the central window, while every other condition was
unchanged to two decimal places. The central window matches the clinical
situation, in which the target is foveated, while leaving units with large
receptive fields free to register interference from the flankers — which is what
crowding is.

### Lesions

A lesion is applied to the output of a single stage, so that all downstream
computation sees the corrupted signal, as it would after damage at an
intermediate cortical stage. Two lesion types were used:

- **ablation** — a random fixed subset of feature channels is silenced, standing
  in for loss of cortical units. The subset is drawn once per lesion and held
  fixed across stimuli, so the lesion is a property of the model rather than of
  the trial.
- **noise** — Gaussian noise scaled to the stage's own activation scale is added,
  standing in for degraded signalling in surviving tissue.

Severity was swept over 0.1–0.6 at each of V1, V2, V4 and IT, with three
independent lesion seeds for ablation and two for noise.

### Severity matching

For each stage and seed, performance is expressed as *preservation*: the fraction
of the intact model's above-chance competence that survives the lesion,

\[
\text{preservation} = \frac{\text{acc}_{\text{lesion}} - \text{chance}}{\text{acc}_{\text{intact}} - \text{chance}}
\]

which prevents a condition the intact model already finds hard from being scored
as impaired merely because its ceiling is lower. We then locate, per stage, the
severity at which preservation on `canonical` falls to 0.75, by linear
interpolation, and read every other condition's preservation at that same
severity. Stages are thereby equated for their effect on the screening condition
before being compared on the rest.

The summary measure is the **dissociation index**, the difference between mean
preservation on the transformation family and on the degradation family. H1 and
H2 jointly predict that this index is positive for early-stage lesions
(degradation-family conditions suffer more) and negative for IT lesions
(transformation suffers more).

### Reproducibility

All stimuli are generated procedurally from a fixed seed; no image dataset is
required. The full experiment runs on four CPU cores.

## Results

*To be written from the completed run.*

## Discussion

*To be written from the completed run.*
