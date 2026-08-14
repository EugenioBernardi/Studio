# Method: turning a spiking model into a falsifiable clinical claim

## The gap this has to bridge

NEST and Brian2 simulate spikes and synaptic currents. OpenNeuro holds scalp EEG,
MEG, iEEG, fMRI and PET. Nothing in a spike train is directly comparable to a
voltage measured at Cz through skull and scalp. Any project of this kind lives or
dies on how that gap is crossed, so it is worth being explicit about the failure
mode before writing any model code.

The naive approach — simulate a disease, plot a power spectrum, note that it
"looks like" a patient spectrum — is not a test. A network with a few dozen free
parameters can be tuned to reproduce almost any spectral difference post hoc.
That is curve fitting with extra steps, and it generates no knowledge.

The approach here inverts the order. The simulation is not used to *reproduce* a
clinical finding. It is used to **derive a prediction that is risky**: a pattern
across two or more observables that most competing mechanisms would *not*
produce, stated with a direction and an approximate effect size, before touching
the data.

## Design rule 1: only forward-model-invariant observables

The mapping from cortical current to scalp voltage depends on skull thickness,
electrode montage, reference scheme, and tissue conductivity — none of which the
model knows. So any observable whose value depends on that mapping is unusable.

**Usable** (dimensionless, or a property of spectral/temporal *shape*):

| Observable | Why it survives the forward model |
|---|---|
| Aperiodic exponent (1/f slope) | Volume conduction is approximately a fixed linear filter; it shifts the offset, largely not the slope |
| Aperiodic knee frequency | Set by synaptic timescale, not amplitude |
| Relative band power (ratios) | Amplitude scaling cancels |
| Peak frequency | A frequency, not a magnitude |
| Phase–amplitude coupling (Tort MI) | Normalised, unitless |
| Avalanche exponents, branching ratio | Scale-free by construction |
| DFA / long-range temporal correlation exponent | Scale-free by construction |
| Entrainment ratio (e.g. 40 Hz ASSR vs. baseline) | Within-subject ratio |

**Unusable**: absolute power in µV², absolute firing rates, spike counts, raw
coherence magnitudes. If a hypothesis can only be stated in these terms, it is
not testable against OpenNeuro and should be reformulated or dropped.

This rule is enforced structurally in `neurosim/common/observables.py`: every
estimator takes `(array, sampling_rate)` and nothing else. It cannot know whether
its input is a model LFP or a BIDS `.edf`, so it cannot be accidentally
specialised to one of them. **The same function must produce both the prediction
and the measurement.** If the simulation side and the data side are analysed by
different code, the comparison is meaningless — differences in windowing,
detrending, or fitting band will swamp the biological effect.

## Design rule 2: hunt for dissociations, not effects

A single-observable prediction ("condition X flattens the spectrum") is weak.
Many mechanisms flatten spectra, so confirming it barely moves the posterior.

A *dissociation* prediction is strong: mechanism A moves observable 1 but not
observable 2, while mechanism B moves both — so the pair separates them even
though either alone does not. These are worth the compute, because:

1. Most rival mechanisms fail to produce the specific 2-D pattern.
2. It converts an ambiguous clinical biomarker into a discriminative one, which
   is where the clinical value actually lives.
3. It fails informatively. A null tells you the observables are degenerate, which
   is itself publishable and saves the next group the effort.

Experiment 1 (`gaba_dissociation.py`) is built on exactly this shape.

## Design rule 3: respect the degeneracy problem

Different parameter sets produce identical observables. This is not a nuisance to
be hidden; it is the central epistemic limit of the method, and the honest
response is to quantify it rather than pick one fit and present it as *the*
mechanism.

Practically: for every claimed mechanism, sweep the *other* parameters too and
report the full set of configurations consistent with the observable. If a
2-fold change in a different parameter mimics the effect, the hypothesis is not
identifiable from that observable and needs another one added.

## Design rule 4: the perturbation must have independent biological evidence

The parameter that gets perturbed must correspond to something measured in human
tissue — post-mortem immunohistochemistry, genetics, PET ligand binding, or
patch-clamp from resected tissue. Not from the EEG the model is meant to predict;
that would be circular.

Each hypothesis in `02-hypotheses.md` therefore carries an explicit
**biological warrant** line naming the independent evidence for the perturbation,
separate from the EEG evidence used to test it.

## Design rule 5: pre-specify the falsifier

Before running the analysis on real data, write down what result would count as
refutation. Without this, every outcome gets reinterpreted as partial support.
Each hypothesis carries a **falsifier** line.

## NEST or Brian2?

Both, at different stages — they are not competitors here.

**Brian2 for the exploratory stage.** Models are written as equation strings, so a
new lesion is a one-line change to a differential equation rather than a new C++
module. When the question is "what does shortening the GABA_A decay do to the
knee", iteration speed dominates and Brian2 wins outright. This is where
hypotheses are generated. All current code in this repo is Brian2.

**NEST for the confirmatory stage.** Once a hypothesis survives prototyping, it
needs to be shown to be robust in a network that was not built to produce it.
NEST's advantages:

- The **Potjans & Diesel (2014) cortical microcircuit** is a community-validated
  4-layer, 8-population model with connection probabilities from anatomical
  tracing. Reproducing an effect there means it does not depend on the toy
  network's arbitrary geometry — and its laminar structure supports a real
  current-dipole forward model, which a single-population model cannot.
- Basal ganglia loop models (STN–GPe–GPi–striatum) needed for Parkinson's
  hypotheses are established in NEST.
- MPI scaling for networks large enough that finite-size effects do not
  contaminate avalanche statistics — a real concern for the criticality
  hypotheses, where small networks manufacture cutoffs.

The recommended pipeline: **prototype the lesion→observable map in Brian2, then
re-derive the surviving prediction in NEST/Potjans-Diesel before testing on
data.** A prediction that does not survive the change of network was a property
of the model, not of the biology.

## The loop, end to end

```
  human molecular/cellular evidence
            |
            v
  [1] encode lesion as parameter perturbation      (models/)
            |
            v
  [2] sweep, incl. nuisance parameters             (experiments/)
            |
            v
  [3] compute forward-invariant observables        (common/observables.py)
            |
            v
  [4] look for dissociations; discard degenerate   <-- most ideas die here
            |
            v
  [5] pre-register direction + effect size + falsifier
            |
            v
  [6] confirm in NEST (different network)
            |
            v
  [7] test on OpenNeuro with the SAME estimator    (docs/03)
```

Step 4 is where most candidate hypotheses should die. If none of them do, the
observables are too permissive and the pipeline is not discriminating.

## Statistical discipline on the data side

- **Effect sizes, pre-specified.** The simulation predicts a magnitude, so the
  analysis is a comparison against a stated value, not a hunt for `p < 0.05`.
- **Split the datasets.** Use one OpenNeuro cohort to check preprocessing and
  fix all analysis choices, a second, untouched cohort for the actual test. The
  aperiodic exponent is sensitive to preprocessing (filter edges, referencing,
  epoch length), and choices made while looking at the outcome will bias it.
- **Confound the obvious confounders.** Age flattens the aperiodic exponent, and
  most patient cohorts are older than controls. Medication does too —
  benzodiazepines and anaesthetics act on precisely the GABA_A parameters
  Experiment 1 perturbs, so a drug effect can perfectly mimic the disease
  prediction. Age, medication status, and eyes-open/closed must be covariates,
  not afterthoughts.
- **Report the null.** A model prediction that fails on data is the most
  informative outcome the pipeline can produce, and the one most likely to go
  unpublished.
