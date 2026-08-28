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

The intact model performed every test well above chance: canonical 0.99,
low contrast 0.99, noise 1.00, unusual view 0.91, crowded 0.83, fragmented 0.68
(chance 0.10). The battery therefore has room to show impairment in both
directions without floor or ceiling artefacts.

### Severity matching is necessary, and by a large margin

Stages required very different nominal severities to produce the same
impairment on canonical stimuli: 0.16 at V1, 0.35 at V2, 0.16 at V4 and 0.34 at
IT. Averaged across all conditions and severities, preservation ordered
IT (0.67) > V2 (0.50) > V1 (0.43) > V4 (0.34). Damage at V4 is roughly twice as
costly as the same nominal damage at IT.

This ordering is the single most robust effect in the data, and it is
condition-invariant: the same rank order of stages holds in all six panels of
Figure 1. It also runs against the expectation set by prior work reporting that
later layers degrade more than early ones under synaptic decay [Moo25]. The
difference is likely to be one of lesion model — channel ablation at a stage
output rather than progressive weight decay — and is worth stating as a direct
contrast rather than a discrepancy to be smoothed over.

### The predicted double dissociation is absent

Once lesions are equated on canonical performance, the *shape* of the deficit is
largely invariant to lesion site. The dissociation index (transformation minus
degradation) was 0.028 (SD 0.062) at V1, 0.179 (SD 0.068) at V2, 0.020 (SD 0.116)
at V4 and 0.012 (SD 0.046) at IT, with three lesion seeds per stage.

**H2 is refuted.** IT lesions did not selectively impair identification of
transformed stimuli; the index at IT is slightly positive, that is, in the
opposite direction to the prediction. There is no complementary late-stage
deficit and therefore no double dissociation.

**H1 survives only in weakened form.** V2 is the only stage whose index is
positive across all three seeds (0.147, 0.257, 0.132). But inspection of Figure 2
shows this is carried almost entirely by one condition: preservation on noisy
stimuli was 0.32 at V2 against 0.86, 0.73 and 0.77 at V1, V4 and IT. Excluding
noise, the index becomes 0.121 (SD 0.061) at V1, 0.137 (SD 0.102) at V2, 0.065
(SD 0.131) at V4 and 0.058 (SD 0.037) at IT — a weak early-over-late gradient in
the predicted direction, but small relative to its own variability and not
supported by the number of seeds run here.

The honest reading is that lesion site in this model determines **how much**
competence is lost rather than **what** is lost.

### Crowding is the most sensitive condition, and it does not localise

At matched severity, mean preservation ordered crowded (0.45) worst, then
fragmented (0.52), low contrast (0.61), unusual view (0.62), noise (0.67), and
canonical (0.75). Crowding was the most impaired condition at every lesion site.
This is the clearest clinically relevant result in the run, and its interest lies
in the conjunction: crowding is highly sensitive to ventral-stream damage but
carries no information about where that damage sits.

### The noise lesion was uninformative

Additive Gaussian noise at a stage output produced essentially no behavioural
effect at any stage or severity (preservation 0.96–1.01 throughout). This is an
artefact of the design rather than a finding: the readout averages over a spatial
window, which suppresses spatially independent noise by roughly the square root
of the number of pooled positions. Any future use of a noise lesion must make the
perturbation spatially correlated, or apply it as a channel-wise gain change.
The noise-lesion arm should be treated as not yet run.

## Discussion

The study set out to test whether stage of damage in a ventral-stream model
reproduces the apperceptive-versus-associative distinction that separates
posterior cortical atrophy from typical Alzheimer's disease. Under the conditions
tested, it does not. The deficit profile is largely stage-invariant once lesions
are equated for global severity, and the specific prediction that IT damage would
selectively compromise view-invariant identification was refuted.

That negative has a direct clinical implication, and it cuts against the
motivating idea rather than for it. If profile shape does not track lesion site
even in a model where the site is known exactly, then inferring the locus of
damage from a patient's profile across these tests is not straightforward. The
result functions as a caution about the inferential step that clinical
interpretation of such profiles relies on.

Three findings are nonetheless worth carrying forward. First, severity matching
is not a technicality: stages differed roughly twofold in the damage needed for
equal canonical impairment, so any study comparing raw lesion magnitudes across
levels of the hierarchy will mistake fragility for specificity. Second, the
vulnerability ordering — V4 most fragile, IT most robust — is consistent across
every condition and stands in explicit contrast to [Moo25]. Third, crowding is
sensitive but non-localising, which is a useful property to know about a test
that is already used in PCA assessment.

### Limitations

The number of lesion seeds (three for ablation) is too small to support the
weak effects reported, and is the first thing to increase. Only one lesion type
yielded interpretable data, for the reason given above. Channel ablation at a
stage output is a blunt instrument compared with the progressive weight decay
used elsewhere in this literature, and the negative result may not survive a
different lesion model. Behaviour was read out only from IT. Finally, and most
importantly, the model was not compared against patients; the claims here are
claims about a model, and the resemblance to any clinical syndrome remains
untested.

### Next steps

Increase seeds; fix and re-run the noise lesion with spatially correlated
perturbations; add progressive weight decay as a second lesion model to test
whether the stage-invariance of profile shape is specific to channel ablation;
and read out from each stage rather than IT alone. Only then is a comparison
against patient profiles worth attempting.
