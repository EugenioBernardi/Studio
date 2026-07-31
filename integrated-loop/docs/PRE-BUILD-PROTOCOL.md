# Pre-build protocol

*Written after a model was built, validated, robustness-tested and drafted — and then falsified by
a study that was findable in one minute before any of it started. The failure was not skipping the
literature. It was checking the wrong question.*

---

## The failure this exists to prevent

Novelty was checked before building, and correctly: no mechanistic model of accelerated long-term
forgetting existed, the mechanism was measured, the clinical relevance was real. All three stated
criteria, checked in advance, recorded.

**Novelty is not non-falsification.** "Nobody has modelled this" and "the data already contradict
what this model will predict" are different questions. Only the first was asked.

The model's central prediction — spindle density *rises* in temporal lobe epilepsy — was
contradicted by Bender et al. (Neurology 2023), 81 patients against 28 controls, reporting a ~30%
*reduction*. That paper cost the identifying prediction, the rival-comparison stage built to
establish it, and most of the value of a sensitivity sweep that found the prediction robust in
24/24 perturbations. Robust inside the model, wrong against patients.

**And the search that would have found it was run — badly.** PubMed ANDs every term, a fact already
noted early in the project. On the one check that mattered:

    "sleep spindle density temporal lobe epilepsy patients controls reduced"  →  2 results
    "sleep spindle density temporal lobe epilepsy"                           →  9 results, incl. Bender

Over-specification hid it. The rule below exists because a conceptual gap and a mechanical slip
combined, and either alone would have been enough.

---

## Required before writing any model code

### 1. Enumerate the predicted DIRECTIONS

Not the hypothesis — the *observable consequences*, each as a signed direction on a quantity a
clinical study could measure. If the model cannot be reduced to such a list, it is not ready to
build.

### 2. Search each direction against the literature, and record the result

One row per direction:

| # | observable | model says | literature says | source | verdict |
|---|---|---|---|---|---|

Verdicts: **CONFIRMED** (data agree — an anchor), **CONTRADICTED** (data disagree — the design
changes or dies *now*), **UNTESTED** (no data — this is the prediction the paper is for),
**UNDERDETERMINED** (data conflict — the tension may itself be the target).

### 3. Query hygiene, because this is where it actually failed

- Start BROAD. Three or four terms. Add terms only to narrow an oversized result set, never to
  find something.
- If a search returns 0–2 results on a well-studied topic, the query is wrong, not the field.
- Search the direction **both ways**: "X increased in Y" *and* "X decreased in Y". A query carrying
  the expected direction finds only the expected answer.
- Check sample sizes. An n=81 study beats an n=10 study, and beats a model outright.

### 4. Kill criteria, stated before building

If a CONTRADICTED row is load-bearing, the design does not proceed. Writing the model first and
discovering this later costs everything downstream of it, as it did here.

---

## What is NOT required

This is a check on the model's *observable predictions*, not a literature review of the field. It
should take under an hour. It took zero minutes and cost far more than an hour.
