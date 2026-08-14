# Mapping hypotheses to OpenNeuro data

## Verification status — read this first

`openneuro.org` is **blocked by this sandbox's network egress proxy**, so the
GraphQL API could not be queried directly from here. Dataset identifiers below
were confirmed through secondary sources (published papers citing the accession,
and search results), not by reading the OpenNeuro records themselves.

Consequence: **every accession below must be verified before use**, and
participant counts and modality details treated as approximate. The verification
step is one command on an unrestricted network:

```bash
pip install openneuro-py datalad
openneuro-py download --dataset=ds004100 --include=participants.tsv
```

Confidence is marked per row. Do not build an analysis plan on a `low` row
without checking it first.

## Datasets by hypothesis

### H4 — Epilepsy criticality (best-supported target)

| Accession | Contents | Why it fits | Confidence |
|---|---|---|---|
| [`ds004100`](https://openneuro.org/datasets/ds004100) | HUP iEEG, 55 patients (36 SEEG, 19 ECoG), refractory epilepsy, all underwent surgery | Has the **surgical outcome ground truth** H4 needs — seizure-freedom validates whether peak-branching-ratio channels were in the resected volume | High |
| [`ds003876`](https://openneuro.org/datasets/ds003876) | Epilepsy-iEEG-Interictal-Multicenter | **Interictal** recordings, multi-centre (tests generalisation across sites), and ships HFO detector outputs in `derivatives/` | High |

These two are the strongest fit in the whole catalogue. `ds003876` is especially
valuable because its bundled HFO derivatives give the **incumbent marker for
free** — H4's claim is that the branching ratio beats HFO rate at localisation,
and that comparison can be run without re-implementing an HFO detector. Multi-centre
structure also allows the train/test split that `01-method.md` requires: fix
preprocessing on one site, test on the others.

### H2 — Parkinson's beta bursts

| Accession | Contents | Why it fits | Confidence |
|---|---|---|---|
| `ds002778` | UC San Diego, resting EEG, ~31 subjects (15 PD / 16 controls) | Reported to include **ON and OFF medication** sessions — the within-subject contrast that controls for skull/montage/age | Medium |
| `ds003490` | Cavanagh, 64-channel resting EEG, 50 subjects (25 PD / 25 matched controls) | Larger, age- and sex-matched; good as the held-out confirmation cohort | Medium |

Using both is the right design: fix all analysis choices on one, test on the
other. Note the caveat in `02-hypotheses.md` — scalp sensorimotor beta is not STN
beta, so a null here does not refute the subcortical model.

### H3 — Alzheimer's / MCI

| Accession | Contents | Why it fits | Confidence |
|---|---|---|---|
| `ds004796` | PEARL-Neuro Database — EEG + fMRI + health/lifestyle, 79 participants at risk of dementia | Multimodal, and the **at-risk** framing suits the prodromal question better than a frank-AD contrast | Medium |

The Kopčanová et al. null result ([DOI](https://doi.org/10.1016/j.nbd.2023.106380))
that motivates H3 was itself established on open cohorts, so the primary
requirement is a dataset where the periodic/aperiodic decomposition can be
reproduced. Independent replication of that null in a *third* cohort is a
worthwhile standalone contribution and a good first task.

### H1 — GABA_A degeneracy

No specific accession required: **any** resting EEG cohort with medication
metadata works, since the test is a pharmacological contrast rather than a
disease contrast. What matters is the metadata, not the population — the ideal
dataset records benzodiazepine or anaesthetic exposure at the participant level.
Filter OpenNeuro's EEG datasets on `participants.tsv` containing medication
fields rather than searching by condition. Given the in-silico refutation in
`04-results.md`, this is now a lower priority.

### H5 — Schizophrenia ASSR

**Not verified — likely the weakest link in the catalogue.** Searches did not
surface a confirmed OpenNeuro 40 Hz ASSR schizophrenia dataset. Before committing
effort to H5, check availability directly; if nothing suitable exists on
OpenNeuro, alternatives are:

- **COBRE** (schizophrenia, via SchizConnect/NITRC) — primarily fMRI.
- **B-SNIP** — has EEG including ASSR, but is controlled-access, not open.
- Reformulate H5 around resting-state gamma alone, accepting the loss of the
  evoked half of the dissociation — which sacrifices exactly what made the
  hypothesis discriminative. A weakened H5 may not be worth running.

## Practical pipeline notes

### Getting the data

```bash
# Metadata first — never pull a full dataset before checking it fits
openneuro-py download --dataset=ds004100 --include=participants.tsv
openneuro-py download --dataset=ds004100 --include=dataset_description.json

# Then a single subject to validate the analysis end-to-end
openneuro-py download --dataset=ds004100 --include=sub-HUP060
```

iEEG datasets run to hundreds of GB. Always prototype on one subject.

### Preprocessing choices that will decide the result

The aperiodic exponent is fragile in specific, known ways. These are not
generic hygiene items — each one can manufacture or destroy the effects
predicted here:

1. **High-pass filtering** distorts the low-frequency spectrum. Fit the aperiodic
   component *above* the filter's transition band, or the slope reflects the
   filter.
2. **Line noise** at 50/60 Hz sits inside the 30–70 Hz fitting band used in this
   repo. Notch first, or move the band — otherwise the harmonic drags the slope.
3. **Referencing changes the exponent.** Common-average, bipolar, and Laplacian
   references give systematically different values. Pick one, apply it to every
   subject, state it.
4. **Epoch length sets frequency resolution**, which changes the fit. Use the same
   window length in seconds across simulation and data — this is why
   `welch_psd` takes `nperseg_s` in seconds rather than samples.
5. **Muscle artefact is broadband and dominates 20–100 Hz**, biasing the exponent
   toward flat. In patient groups with more movement, this alone can produce a
   spurious "flatter spectrum in patients" result — a plausible explanation for
   more than one published finding. ICA-clean before fitting.
6. **Eyes-open vs eyes-closed** changes alpha power dramatically and the aperiodic
   component measurably. Never pool the two conditions.

### Use `specparam`, not the estimator in this repo, for real data

`observables.aperiodic_exponent` is a plain log-log regression, adequate inside a
peak-free band in a model where the band is known to be clean. Real EEG has knees
and overlapping oscillatory peaks, so use
[`specparam`/FOOOF](https://fooof-tools.github.io/) with `aperiodic_mode='knee'`
for empirical work.

This creates a tension with the "same estimator on both sides" rule from
`01-method.md`. Resolve it by running **both** estimators on **both** simulation
and data, and confirming the two agree on direction. If the simulated effect
appears with the simple fit but not with `specparam`, it is an artefact of the
fitting method, not a finding.

### Confounds that specifically threaten these hypotheses

- **Age** flattens the aperiodic exponent, and patient groups skew older.
- **Medication** — benzodiazepines act directly on the H1 parameters; dopaminergic
  medication is the H2 contrast; antipsychotics affect gamma in H5.
- **Cognitive state** — drowsiness steepens the exponent, and patients are more
  likely to be drowsy during recording.
- **Recording site** in multi-centre data (`ds003876`) — amplifier and montage
  differences produce site effects that can exceed the disease effect.
