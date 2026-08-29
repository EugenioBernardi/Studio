# Lesion-model dependence in hierarchical models of visual neurodegeneration

*Working draft. Results and Discussion are rewritten from the re-run currently in
progress; Introduction, Methods and Controls are final.*

---

## Introduction

Posterior cortical atrophy (PCA) is defined by progressive degradation of visual
perception with relative sparing of memory early in the course, and the deficit
is not uniform: patients characteristically fail on impoverished input while
performing comparatively well on clean, canonical, isolated stimuli. That
apperceptive profile, rather than the overall score, is the diagnostic
information.

A literature now simulates neurodegeneration in artificial networks by
progressively deleting weights or units and tracking the decline. The founding
study framed itself explicitly around PCA, deleting a cumulative fraction of
VGG-19's weights and reporting that object-level representations are lost before
category-level ones [Tul21]; the approach has since been extended to the visual
system [Moo22], to neuroplasticity and retraining [Moo23], to cognitive
intervention [Moo25b], and to progressive synaptic decay in a compressed VGG-19,
where later layers lose representational similarity to the healthy model faster
than early ones [Moo25]. Notably, [Tul21] itself proposes two extensions it did
not perform: ablating whole nodes rather than synapses, and injuring specific
layers according to their correspondence with areas such as V4 and inferior
temporal cortex. The present study carries out both.

Two features of that literature motivate this work. First, its outcome measures
are overall accuracy and representational similarity, not performance across the
stimulus conditions on which the clinical syndrome is actually identified.
Second, each study adopts a single damage mechanism and draws conclusions about
neurodegeneration in general.

The second point is not a new concern, and we do not claim it as one. [Gue20]
surveyed five ways of implementing damage in connectionist networks — severing
connections, perturbing weights with noise, ablating units, adding activation
noise, and scaling weights — and showed in a semantic model that the ranking of
which *category* is more impaired can reverse between connection severing and
weight noise, concluding that aetiological claims may be artefacts of
implementation. That work was carried out in small classical connectionist
models, not hierarchical visual models; it explicitly declined to propose a
procedure for equating damage severity across mechanisms, noting that different
damage types "lack a common metric"; and it recommended precisely the sensitivity
analysis performed here. Our contribution is to extend the question from
semantic category to *level in a visual hierarchy*, to a deep recurrent model of
the ventral stream, and to supply the severity-matching procedure whose absence
[Gue20] identified.

### Choosing damage mechanisms that mean something biologically

The three mechanisms compared here were not chosen for convenience. They
correspond to three documented and temporally distinct aspects of Alzheimer
pathology.

- **Gain dysregulation.** Surviving neurons in Alzheimer cortex are not normal.
  Amyloid-associated hyperactivity, altered excitability and a pro-excitatory
  shift in the excitation–inhibition ratio are observed early [Lau21, Sca22],
  with tau burden later associated with oscillatory slowing and functional
  suppression. Multiplicative gain perturbation models surviving-but-disordered
  tissue.
- **Synaptic loss.** Synapse loss is the strongest clinicopathological correlate
  of cognition and generally precedes cell loss [Ser11], with inferior temporal
  synapse density already reduced by roughly a third at the stage of amnestic
  mild cognitive impairment [Sch11]. Random deletion of individual weights is the
  mechanism used by the existing in-silico literature [Tul21].
- **Unit loss.** Neuronal loss is a later and less consistent event than synapse
  loss [Weg20]. Silencing whole feature channels models it.

Read in this order the three mechanisms are not competing implementations of one
idea but a coarse ordering over the disease course, which is what makes any
dependence of conclusions on mechanism clinically consequential rather than
merely methodological.

A second biological constraint bears on which stages matter. In PCA, pathology,
atrophy and hypometabolism are concentrated in association visual cortex —
occipitotemporal and occipitoparietal — while V1 is relatively resistant though
not spared [Lew87, Leh11, Fir19]. The clinically relevant comparison is therefore
weighted towards intermediate and higher stages rather than towards V1.

### Hypotheses

> **H1.** Damage at early-to-intermediate stages disproportionately impairs
> signal-degraded stimuli.
>
> **H2.** Damage at IT disproportionately impairs transformed but clean stimuli,
> where identification requires view-invariant representation.

These were pre-specified, and the primary contrast — early minus late
dissociation index — was fixed before the confirmatory run.

## Methods

### Model

CORnet-S, a recurrent convolutional model of the primate ventral stream whose
four blocks are labelled V1, V2, V4 and IT. In a generic classifier "layer 7" has
no anatomical interpretation; here the site of a lesion is a claim about level in
the visual hierarchy. Published ImageNet weights, never retrained, so damage
cannot be compensated by re-learning.

### Stimuli

Seven procedurally generated conditions on a ten-letter identification task
(A, E, F, H, K, N, P, R, T, X), rendered in ten typefaces at sizes from 84 to 132
pixels, with random position jitter of up to 26 pixels applied identically in
every condition. Letters are the format of several clinical tests, notably VOSP
Incomplete Letters.

| Condition | Perturbation | Family |
|---|---|---|
| `canonical` | upright, high contrast, isolated | reference |
| `fragmented` | ~50% of ink erased in patches centred on ink | degradation |
| `low_contrast` | contrast compressed to 12% | degradation |
| `noise` | additive Gaussian pixel noise | degradation |
| `crowded` | target flanked by two distractor letters | degradation |
| `rotated` | 50–130° rotation | transformation |
| `sheared` | strong shear, minimal rotation | transformation |

The degradation family impoverishes the evidence for a normally posed form; the
transformation family presents clean evidence for a form outside its canonical
pose, and carries two geometrically independent manipulations so that half the
central contrast does not rest on one perturbation.

### Readout

A multinomial logistic readout trained on pooled IT activations of the *intact*
model across all conditions, then frozen. Pooling is restricted to a central
window (72% of the feature map): whole-map pooling averages flanking letters into
the target and turns crowding into a readout artefact.

### Lesion models

Damage is applied to the output of a single stage, so all downstream computation
sees the consequence. Lesions are **nested** in severity — one random ordering is
drawn per seed and increasing severity damages a prefix of it — so that a
severity curve is one lesion worsening rather than a series of unrelated lesions.
This matches the cumulative injury used in [Tul21, Moo25]. Severity grids were
set by a calibration pass, because the mechanisms differ by roughly an order of
magnitude in damage per unit severity.

### Severity matching

Performance is expressed as *preservation*, the fraction of the intact model's
above-chance competence that survives. For each stage and seed we fit an
isotonic (non-increasing) curve to canonical preservation, locate the severity at
which it reaches 0.75, and read every other condition there. Damage cannot help,
so imposing monotonicity before locating a crossing prevents single-point noise
from displacing the matched severity. The **dissociation index** is mean
preservation on the transformation family minus that on the degradation family.
Inference is by permutation of stage labels; intervals are bootstrap.

### Controls

Three controls establish that the model is doing the work the design assumes.
Each was run on the full battery with an identical readout.

| Representation | Overall accuracy |
|---|---|
| raw pixels, 28×28 | 0.200 |
| untrained CORnet-S, IT | 0.171 |
| trained CORnet-S, IT | **0.817** |

Chance is 0.10. An earlier version of the battery placed every letter at the
image centre; a linear probe on raw pixels then scored 0.807 and *beat* the
network on crowding, meaning the readout did not depend on the ventral-stream
representation at all. Position jitter removes that shortcut. The architecture
alone is also insufficient: an untrained network with identical structure
performs near chance.

Transformation tolerance, expressed as transformation-family accuracy relative to
canonical, rises across the trained hierarchy — V1 0.28, V2 0.45, V4 0.82, IT
0.89 — and does so far less in the untrained network (0.24, 0.40, 0.70, 0.57).
The model therefore builds view-invariant representation hierarchically, which is
the property H2 presupposes. This is worth stating because it cannot be assumed:
ImageNet-trained CNNs in general have been reported not to show the human
increase in transformation tolerance across the hierarchy [Xu20].

### Relating to representational-similarity results

Our behavioural measure is not comparable to the representational-similarity
claim in [Moo25], which uses centred kernel alignment under damage applied to the
whole network at once, whereas we measure task accuracy under damage confined to
one stage. A separate analysis reproduces that comparison on its own terms —
whole-network damage, CKA as the measure — so that the two can be related and the
CKA result itself tested for lesion-model dependence.

## Results

*Rewritten from the confirmatory re-run.*

## Discussion

*Rewritten from the confirmatory re-run.*

### Limitations to state plainly

The relationship between this model's behaviour and human vision is not close,
and the paper should not pretend otherwise. ImageNet-trained convolutional
networks degrade far more steeply than human observers under contrast reduction,
additive noise, blur and fragmentation [Gei18], with contour integration emerging
only at very large training scale [Lon25]. Crowding in such networks is driven by
pooling and receptive-field structure and fails several human signatures,
including global uncrowding and similarity effects [Vol17, Lon19, Doe19b]; the
crowding condition here should therefore be read as flanker interference in the
model, not as a model of human crowding. Consequently the degradation conditions
index sensitivity to impoverished evidence *in this model*, and mapping that onto
the clinical apperceptive profile is an assumption, not a result.

Further limits: damage was confined to one stage at a time whereas degeneration
is distributed; behaviour was read out only from IT; the model omits the dorsal
contributions prominent in PCA; and no patient data were analysed.
