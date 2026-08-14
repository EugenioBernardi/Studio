# Studio — spiking-network hypothesis generation for clinical neurophysiology

A framework for using spiking neural network simulation (Brian2 / NEST) to
generate **falsifiable** hypotheses about brain disorders, stated in observables
that can be measured in open human electrophysiology from
[OpenNeuro](https://openneuro.org).

## The premise

Simulating a disease and noting that the output "looks like" a patient recording
is not evidence — a network with enough free parameters can be tuned to match
almost any spectral difference after the fact. This project is built around the
opposite move: use the simulation to derive a **dissociation** that most rival
mechanisms would not produce, commit to its direction and a falsifier in advance,
then test it against open data using *the same analysis code* that produced the
prediction.

Three constraints follow, and they shape the whole codebase:

1. **Only forward-model-invariant observables.** Absolute µV² depends on skull
   thickness and montage; the model knows nothing about either. Exponents,
   ratios, peak frequencies and coupling indices survive. Absolute power does not.
2. **One estimator, both sides.** `neurosim/common/observables.py` takes
   `(array, sampling_rate)` and cannot tell whether its input is a simulated LFP
   or a BIDS `.edf`. If prediction and measurement used different code,
   differences in windowing or fitting band would swamp the biology.
3. **Perturbations need independent biological warrant.** The parameter change
   must be supported by human post-mortem, genetic, PET or patch-clamp evidence —
   not by the EEG the model is supposed to predict. Otherwise it is circular.

Full rationale in [`docs/01-method.md`](docs/01-method.md).

## What is here

```
neurosim/
  common/observables.py       aperiodic exponent & knee, band power, PAC,
                              avalanche statistics — provenance-blind by design
  models/cortical_column.py   conductance-based E/I microcircuit (Brian2),
                              parameterised by biological lesion
  experiments/
    gaba_dissociation.py      Experiment 1: can the aperiodic exponent tell
                              receptor loss from receptor kinetics?
docs/
  01-method.md                design rules, NEST-vs-Brian2, statistical discipline
  02-hypotheses.md            five hypothesis programmes with warrants + falsifiers
  03-openneuro-mapping.md     datasets, preprocessing traps, confounds
  04-results.md               Experiment 1 results — H1 was refuted
```

## Quickstart

```bash
pip install -r requirements.txt
python -m neurosim.experiments.gaba_dissociation
```

Runs a 3×3×3 grid (inhibitory conductance × GABA_A decay × seed) and writes
`results/gaba_dissociation.csv`. Takes roughly 20 minutes on one core.

> **Note on `numpy`:** pinned `<2.3`. Brian2 2.9 still calls `np.ndarray.ptp`,
> which newer numpy removed — with numpy ≥ 2.3 the import fails outright.

## The five hypotheses

| | Claim | Status |
|---|---|---|
| **H1** | The aperiodic exponent cannot distinguish GABA_A receptor loss from kinetic change | **Tested in silico — refuted**, see below |
| **H2** | In Parkinson's, beta *burst duration* tracks bradykinesia where mean beta power does not | Designed (needs NEST basal ganglia loop) |
| **H3** | Alzheimer's resting EEG is an oscillatory, not an E/I, lesion | Designed — best next step |
| **H4** | Interictal epileptic cortex is supercritical, and the branching-ratio gradient localises the seizure onset zone | Designed — highest clinical ceiling |
| **H5** | NMDA hypofunction on interneurons, not pyramidal cells, produces the schizophrenia gamma phenotype | Designed — dataset availability unconfirmed |

Details, biological warrants and falsifiers in
[`docs/02-hypotheses.md`](docs/02-hypotheses.md).

## Experiment 1 outcome

H1 predicted that the aperiodic **exponent** and the **knee frequency** would
dissociate: the exponent tracking inhibitory conductance, the knee tracking
GABA_A decay kinetics — making the pair jointly identify which lesion a patient
has, where the exponent alone cannot.

**The model refuted this**, and the refutation is more useful than the hypothesis
would have been. See [`docs/04-results.md`](docs/04-results.md) for the numbers
and what they imply for reading the aperiodic exponent clinically.

## Status and honest limitations

- Only H1 has been executed. H2–H5 are designs, not results.
- The network is a single homogeneous population of point neurons: no laminar
  structure, no dendrites, no NMDA, no neuromodulation. It cannot address
  anything requiring dendritic computation or T-type calcium bursting.
- The LFP proxy (Σ|I_exc| + |I_inh| over pyramidal cells) follows Mazzoni et al.
  (2015) but is not a volume-conduction forward model.
- No OpenNeuro data has been analysed. Dataset accessions in
  `docs/03-openneuro-mapping.md` were confirmed from secondary sources only —
  `openneuro.org` is blocked from this environment's network — and **must be
  verified before use**.
- The next real milestone is confirming a surviving prediction in NEST with the
  Potjans & Diesel (2014) microcircuit, since an effect that does not transfer to
  a differently-built network was a property of the model, not the biology.
