# Assessment: whole-brain modelling of Alzheimer's vs. frontotemporal dementia

Requested check before committing effort: **has this been published, and is it
clinically relevant?** Short answers: **yes, substantially**, and **yes** — but
the two facts point to a narrower and better project than the original idea.

Literature via PubMed; DOIs inline.

## 1. Prior work — the concept is largely taken

| Study | What it did | Overlap with the idea |
|---|---|---|
| Coronel-Oliveros et al. 2024, *Alzheimer's & Dementia* ([DOI](https://doi.org/10.1002/alz.13788)) | Generative whole-brain model of **AD and bvFTD from EEG**, with anatomical priors and a perturbational approach; found connectome disintegration + **hypoexcitation** drive altered metaconnectivity; identified stimulation targets; replicated in a second cohort | **Near-complete.** This is essentially the proposed study |
| Sanz Perl et al. 2023, *eLife* ([DOI](https://doi.org/10.7554/eLife.83970)) | Whole-brain model of **AD and bvFTD** with atrophy priors (fMRI); increased stability of hippocampal (AD) and insular (bvFTD) dynamics; perturbation to find transitions back to healthy states | High, on the fMRI side |
| Zimmermann et al. 2018, *NeuroImage: Clinical* ([DOI](https://doi.org/10.1016/j.nicl.2018.04.017)) | **Personalised TVB** models across healthy aging → MCI → AD (n=124); model parameters predicted cognition better than empirical connectomes | High, TVB + AD specifically |
| Stefanovski et al. 2021, *Front. Neuroinform.* ([DOI](https://doi.org/10.3389/fninf.2021.630172)) | TVB framework for AD, linking molecular pathology to whole-brain simulation | Framework paper — read first |
| Luppi, Stam, Scheltens & de Haan 2024, *PLoS Comput Biol* ([DOI](https://doi.org/10.1371/journal.pcbi.1011164)) | Virtual brain network model of AD (78 neural masses) to optimise tDCS montages | High, on the intervention side |

**Conclusion: "use TVB to model AD vs FTD and compare to EEG" is not novel.**
Proposing it as a new idea would be scooped by Coronel-Oliveros 2024 in
particular, which used EEG, a generative whole-brain model, structural priors and
perturbation — the full stack.

## 2. Where genuine novelty *does* remain

### 2a. A sharp published contradiction that ds004504 can adjudicate

This is the strongest remaining opening, and it is a real disagreement in the
literature rather than a gap someone forgot to fill:

- Coronel-Oliveros et al. 2024 conclude that AD and bvFTD involve
  **hypoexcitation** — reduced local excitability — inferred from a generative
  model fitted to EEG ([DOI](https://doi.org/10.1002/alz.13788)).
- Kopčanová et al. 2023 find that AD resting EEG differs from controls in
  **periodic (oscillatory) components only**, with the **aperiodic exponent
  statistically unchanged**, replicated across two cohorts
  ([DOI](https://doi.org/10.1016/j.nbd.2023.106380)).

These sit awkwardly together. A genuine shift in excitability/E-I balance should
move the aperiodic exponent — that is the basis for reading the exponent as an
E/I proxy at all (Gao, Peterson & Voytek,
[DOI](https://doi.org/10.1016/j.neuroimage.2017.06.078)). If excitability drops
but the exponent does not move, then either the exponent is not tracking what it
is assumed to track, or the model-inferred "hypoexcitation" is a fitting artefact.

**Our own Experiment 1 bears directly on this** (`04-results.md`): in a spiking
network the exponent tracked *firing regime* (r = −0.79 with log rate) more
strongly than either synaptic parameter, and was non-monotonic in inhibitory
conductance. That is a mechanism for how both published results could be true at
once — and it is testable.

**Proposed study:** compute periodic/aperiodic decomposition on ds004504
(AD / FTD / control) and ask whether the aperiodic exponent moves in the
direction the hypoexcitation account requires. Three outcomes, all informative:
exponent shifts → supports Coronel-Oliveros, challenges Kopčanová's
generalisation; no shift → the model-inferred hypoexcitation lacks an independent
signature; FTD shifts but AD does not → a genuine syndrome dissociation, which
would be a new and clinically useful finding.

### 2b. Does any of it survive routine clinical EEG?

Existing whole-brain dementia modelling uses research-grade high-density EEG/MEG
and source reconstruction. **ds004504 is 19-channel routine clinical EEG from a
regional hospital** — which is what actually exists in every neurology
department. Whether model-derived markers survive at that montage density is a
translation question with a clear answer either way, and a negative answer is as
useful as a positive one.

## 3. Clinical relevance — genuine

AD vs FTD differential diagnosis is a real and consequential clinical problem.
bvFTD is frequently misdiagnosed as a primary psychiatric disorder, often for
years; the syndromes have different prognosis, different management, and
cholinesterase inhibitors are inappropriate in FTD. A cheap, widely available
discriminator based on routine EEG would matter. Whether modelling adds anything
over straightforward spectral features is exactly what should be tested — and
existing EEG classification work on this dataset is the baseline to beat.

## 4. Hard blocker for TVB specifically

**ds004504 contains EEG only — no structural MRI, no DWI.**

TVB's central premise is a *personalised* connectome from each subject's
diffusion imaging. Without it you must substitute a template connectome, which
discards exactly what makes TVB worth using and makes every subject structurally
identical — so all between-subject variance must be absorbed by local parameters.
Zimmermann 2018's headline result (model parameters beat empirical connectomes at
predicting cognition) is not reproducible in that setting.

Options, in order of honesty:

1. **Drop TVB; use a neural-mass model on a template connectome.** This is what
   de Haan's group does (78 masses, [DOI](https://doi.org/10.1371/journal.pcbi.1011164)).
   Appropriate for ds004504, and does not overclaim personalisation.
2. **Use a dataset with both DWI and EEG/MEG** if personalised TVB is the goal.
   ds004504 is the wrong dataset for that.
3. **Skip whole-brain modelling for the first pass** and do the 2a test, which
   needs only spectral parameterisation. Cheapest path to a real result.

**Recommendation: (3), then (1) if the spectral result warrants it.**

## 5. Cohort facts (verified from the dataset's own `participants.tsv`)

Retrieved from the OpenNeuro GitHub mirror (`OpenNeuroDatasets/ds004504`):

| Group | n | Age | MMSE | Sex (F/M) |
|---|---|---|---|---|
| AD (`A`) | 36 | 66.4 ± 7.9 | 17.8 ± 4.5 | 24 / 12 |
| FTD (`F`) | 23 | 63.7 ± 8.2 | 22.2 ± 2.6 | 9 / 14 |
| Control (`C`) | 29 | 67.9 ± 5.4 | 30.0 ± 0.0 | 11 / 18 |

Recording: 19 channels, 10-20, Nihon Kohden EEG 2100, A1/A2 reference, resting
eyes-closed, University of Ioannina / Arta, Greece. `derivatives/` ships a
preprocessed copy.

### Two constraints these numbers impose

1. **Severity is confounded with syndrome.** MMSE differs markedly between AD
   (17.8) and FTD (22.2). Any AD-vs-FTD difference may be dementia severity, not
   syndrome. MMSE must be a covariate, or the groups severity-matched by
   subsampling — which at n=23 for FTD will cost a lot of power.
2. **The data is filtered 0.4–50 Hz** (from the `_eeg.json` sidecar), with 50 Hz
   line frequency. The 30–70 Hz fit band used on the model LFP in Experiment 1 is
   therefore **unusable here** — most of it lies beyond the anti-alias filter.
   The aperiodic fit must sit below ~45 Hz, which means it contains alpha and
   beta peaks and *requires* `specparam` with explicit peak modelling. A plain
   log-log fit will be dominated by the alpha peak and will produce a confident,
   wrong answer.

Sex is also imbalanced in opposite directions (AD 67% F, FTD 61% M).

## 6. Verdict

- The original framing (TVB + AD/FTD + OpenNeuro) is **already published**, most
  directly by Coronel-Oliveros et al. 2024.
- A **sharper, smaller question survives**: does the aperiodic exponent in
  ds004504 behave as the hypoexcitation account requires, given that an
  independent two-cohort study says it does not change in AD? Our Experiment 1
  supplies a candidate mechanism for the discrepancy.
- That question needs **no TVB, no connectome, and no new recording** — only
  `specparam` on 88 existing recordings.
