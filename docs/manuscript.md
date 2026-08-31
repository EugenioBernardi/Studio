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

The intact model performed every condition above chance (0.10): canonical 0.98,
low contrast 0.99, noise 0.96, rotated 0.90, sheared 0.89, fragmented 0.66,
crowded 0.58.

### Damage at early and intermediate stages is degradation-selective

Once lesions are equated on canonical performance, the pre-specified
early-minus-late contrast was:

| Damage mechanism | early − late | permutation *p* |
|---|---|---|
| channel ablation | **+0.121** | **0.0003** |
| gain dysregulation | **+0.113** | **0.0043** |
| synaptic deletion | +0.017 | 0.62 |

Under ablation and gain the per-stage gradient is monotonic and in the predicted
direction — ablation V1 +0.119, V2 +0.147, V4 +0.032, IT −0.008; gain V1 +0.141,
V2 +0.088, V4 0.000, IT +0.004. **H1 is supported** under two of three
mechanisms: damage at early-to-intermediate stages disproportionately impairs
stimuli whose evidence is impoverished, relative to stimuli that are merely
transformed. Synaptic deletion shows no gradient.

**H2 is not supported** under any mechanism. IT damage did not selectively impair
transformed stimuli; its dissociation index is indistinguishable from zero
throughout. There is no double dissociation, only its early half.

### Severity matching is necessary

Within a mechanism, stages required substantially different nominal severities
for equal canonical impairment — under ablation, 0.205 at V1 against 0.359 at V2.
Comparing raw lesion magnitudes across levels of a hierarchy mistakes fragility
for specificity.

### Behavioural and representational vulnerability come apart

Behaviourally, IT was the most robust stage under ablation (mean preservation
0.725, against 0.586, 0.541 and 0.491 for V2, V1 and V4) and under gain (0.777).
On centred kernel alignment under whole-network damage, the opposite holds and it
holds for every mechanism: later layers lose representational similarity to the
healthy model faster than early ones (rank correlation of CKA with depth −0.879
ablation, −0.845 synaptic deletion, −0.692 gain; all *p* < 0.0001).

Two things follow. The representational result reported for synaptic decay
[Moo25] replicates here and is **not** mechanism-dependent — it is robust. And
the stage whose representation is disturbed most is not the stage whose damage
costs most behaviourally. Representational change is a poor guide to functional
consequence, which matters because representational similarity is a common
outcome measure in this literature.

### Two negative results

**Recurrence.** Damaging the refinement timesteps of a block rather than its
initial feedforward pass, at matched severity, did not produce a
degradation-selective deficit (recurrent minus feedforward dissociation −0.055,
*p* = 0.23, four usable cells per mode). The early-stage gradient reported above
therefore has no mechanistic account here. The test was underpowered and should
be read as uninformative rather than as evidence against the hypothesis.

**False percepts.** Amplifying the gain on recurrent timesteps raised the
model's confidence in a letter on stimuli containing none, from 0.46 to 0.97,
with entropy falling to 0.001. This is an artefact. The IT feature norm inflates
roughly fourfold across the gain range; confidence rises on signal-present trials
even as accuracy on them falls from 0.51 to 0.16; and L2-normalising the feature
vector before the readout flattens the effect. More fundamentally, the intact
model is already about 0.85 confident on pure noise, because a ten-way readout
with no reject option cannot report that nothing is present. The measure was not
a valid index of false percepts, and testing this properly requires an open-set
readout.

### A methodological result obtained by accident

An earlier version of this experiment produced a significant dissociation of the
opposite sign under synaptic deletion (−0.128, *p* = 0.007), with sensitivity
analyses and per-seed consistency that all looked sound. It did not survive a
change to the stimuli. In that version letters were always centred, and a linear
probe on 28×28 raw pixels scored 0.807 — beating the network on crowding — so the
readout was not relying on the ventral-stream representation at all. Adding
position jitter dropped the pixel baseline to 0.200 against 0.817 for trained IT,
and the effect disappeared and reversed.

We report this because the discarded result was not obviously flawed. It was
statistically robust, mechanistically interpretable, and wrong. Studies in this
literature do not routinely report a pixel-level baseline for their stimuli, and
on this evidence they should.

## Discussion

Damage at early and intermediate stages of a ventral-stream model produces a
disproportionate impairment for degraded stimuli, under two mechanistically
distinct forms of damage, with lesions equated for their effect on clean stimuli.
That is the apperceptive pattern, and it arises at the levels of the hierarchy
where posterior cortical atrophy pathology concentrates [Lew87, Leh11, Fir19].
The corresponding late-stage prediction fails: IT damage produces no selective
loss for transformed stimuli, despite the model demonstrably building
transformation tolerance across those stages.

Three qualifications bound how far this travels.

The result is mechanism-dependent in a limited way. Ablation and gain
dysregulation agree; synaptic deletion, the mechanism used by most of this
literature and arguably the most defensible biologically given that synapse loss
is the strongest clinicopathological correlate of cognition [Ser11, Sch11], shows
no gradient at all. We are not able to say which mechanism should be believed,
and that is itself the point: [Gue20] argued that conclusions from damaged
networks can be artefacts of implementation, and this is a case where one of three
implementations disagrees with the other two.

The relationship to human vision is loose. Convolutional networks degrade far
more steeply than people under noise, contrast reduction and fragmentation
[Gei18, Lon25], and their crowding fails human signatures [Vol17, Lon19, Doe19b].
The degradation conditions index sensitivity to impoverished evidence in this
model; mapping that onto the clinical apperceptive profile remains an assumption.

And the strongest practical finding is a caution rather than a discovery. A
result that survived permutation testing, bootstrap intervals, leave-one-out
sensitivity analysis and per-seed consistency checks was nonetheless an artefact
of a stimulus set that a linear pixel classifier could solve. Every claim in this
literature rests on the assumption that the network is doing the work; that
assumption is cheap to test and, as far as we can determine, rarely tested.

### Limitations

Five to six lesion seeds per cell; one architecture; synthetic stimuli; damage
confined to one stage at a time whereas degeneration is distributed; behaviour
read out only from IT; the dorsal contributions prominent in PCA are absent; and
no patient data were analysed. The claims are claims about a model.

### Next steps

The comparison that would make this clinical is a severity-matched profile from
patients on the corresponding tests against a contrast group of amnestic
Alzheimer's disease, related to the posterior-to-anterior gradient of atrophy. A
second direction, better specified than anything attempted here, is to drive the
model along the documented disease trajectory — mechanism changing with stage,
damage weighted by the known posterior distribution — and ask whether the
predicted order of test failure matches the event-based sequence already
estimated from cohort data [Fir20], and whether a clinical profile carries enough
information to identify disease locus at all.
