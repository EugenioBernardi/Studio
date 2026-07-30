# The anterior thalamus: a literature check that closed four hypotheses

*Written after stage 42. Purpose: record what was searched, what was found, and why each candidate
mechanism was abandoned — so the next person does not spend the same weeks. Every hypothesis below
was checked against three criteria in order: **biological plausibility**, **scientific novelty**,
**clinical relevance**. All four passed 1 and 3. All four failed 2, or failed quantitatively.*

---

## The target finding

Frost, Martin, Cafalchio, Islam, Aggleton & O'Mara, *J Neurosci* 2021
([10.1523/JNEUROSCI.2868-20.2021](https://doi.org/10.1523/JNEUROSCI.2868-20.2021)):
anterior thalamic nuclei (ATN) lesions abolished **every** spatial signal in the subiculum — place,
grid and head-direction — while CA1 place fields were "largely unaffected" and spatial memory fell
to chance. Both permanent and reversible lesions did it.

Aggleton & O'Mara, *Nat Rev Neurosci* 2022
([10.1038/s41583-022-00591-8](https://doi.org/10.1038/s41583-022-00591-8)): the ATN is a core
component of episodic memory co-equal with the hippocampus, and standard models leave it out.

**The puzzle.** The subiculum's dominant input *is* CA1. If CA1's code is intact and the subiculum
reads CA1, the subiculum should be fine. It is not. The field's stated explanation — ATN input is
"modulatory or enabling" — names the gap rather than closing it.

**Clinical relevance (criterion 3), which never became the problem.** Diencephalic amnesia;
Korsakoff temporal-order deficits (Nelson & Vann 2016,
[10.1007/s00429-016-1330-x](https://doi.org/10.1007/s00429-016-1330-x): mammillothalamic tract
lesions "severely disrupted recency judgements involving multiple items but left intact both
recency and familiarity judgements for single items", and crossed-lesion controls showed this is
**independent of prefrontal cortex**); heading disorientation after retrosplenial/anterior thalamic
damage. This is a genuinely under-modelled clinical territory. That is not what killed the work.

---

## H1 — the reticular nucleus as a consolidation scheduler *(stages 38–41)*

**Retracted on internal grounds before the literature mattered.** See `test/stage41_capacity_confound.js`.
The capacity limit was produced by rehearsing one memory per ripple with a fixed ripple count — it
appeared in full with reticular competition switched off (`lateral = 0`). The lesion dissociation
was reproduced by a content-blind coin in series. Independently anticipated: Wei, Krishnan, Komarov
& Bazhenov, *PLoS Comput Biol* 2018
([10.1371/journal.pcbi.1006322](https://doi.org/10.1371/journal.pcbi.1006322)) — local spindles,
multiple trained memories, competition — and Antony et al., *Curr Biol* 2018
([10.1016/j.cub.2018.04.020](https://doi.org/10.1016/j.cub.2018.04.020)) established spindle
refractoriness segmenting sleep empirically.

## H2 — the ATN as a theta-phase pointer *(stage 42)*

Position is coded in theta phase; a narrow-window read-out needs a pointer saying *when* to look.
CA1 supplies the code, the ATN the pointer.

- **Mechanism confirmed.** Removing phase coding (`sweep = 0`) abolishes the effect; drive is
  unchanged to within 1%; place, grid and HD degrade together.
- **Quantitatively insufficient.** At the measured theta-sequence span (~26% of the environment)
  the lesion removes ~29% of spatial information and population decoding survives intact.
- **The bound, which is the transferable result.** Averaging a field of width σ over a sweep of
  span *s* gives ≈ √(σ² + s²/12). With σ ≈ 0.055 and measured *s* ≈ 0.15–0.30, a pointer failure
  can only broaden fields ~0.10 → ~0.17 of the track. **Abolition requires sequences spanning the
  whole environment, and they do not.** This constrains *every* phase-pointer account, not just
  this one: all of them predict broadened fields with preserved population decoding.
- **Further undermined by literature found afterwards.** Winter, Clark & Taube, *Science* 2015
  ([10.1126/science.1259591](https://doi.org/10.1126/science.1259591)) report that ATN manipulation
  disrupts grid and HD cells **while sparing theta rhythmicity**. A theta-phase-pointer account
  wants the thalamic lesion to disturb the theta reference; theta survives it.

## H3 — the ATN as the directional anchor (reference frame)

The ATN carries the head-direction signal; without it the spatial map is unanchored and rotates
between trials, so the trial-averaged rate map collapses while the within-trial code is intact.

- **Not novel.** Winter, Clark & Taube 2015 state it directly: "Computational models hypothesize
  that generation of the grid cell signal relies upon HD information that ascends to the
  hippocampal network via the anterior thalamic nuclei", and then demonstrate it.
- **Probably also wrong in the specific form proposed.** They found HD cell *characteristics*
  disrupted, not merely rotated — a network collapse, not an unanchored-but-intact map. The
  "intact within trial, incoherent across trials" prediction is likely already excluded.

## H4 — subicular coding as boundary-vector coding, which needs a compass

Subicular spatial coding is fundamentally boundary-vector coding (Lever, Burgess, Barry). A BVC
fires at a distance *and allocentric direction* from a boundary, so it is intrinsically
direction-dependent; CA1 place coding is not. Remove the HD reference and BVCs lose their
allocentric θ and die, while CA1 survives — which is exactly the observed dissociation.

- **Biologically the most plausible of the four**, and it explains the dissociation precisely.
- **Not novel.** The Byrne–Becker–Burgess line already assigns the anterior-thalamic HD signal this
  role. Bird, Bisby & Burgess, *Front Hum Neurosci* 2012
  ([10.3389/fnhum.2012.00142](https://doi.org/10.3389/fnhum.2012.00142)): "the activity of
  head-direction cells **along Papez's circuit** determine the viewpoint direction for which the
  egocentric image is generated." Papez's circuit is mammillary bodies → anterior thalamus →
  cingulate. The job is already assigned, in a well-known model.

---

## What is actually left open

Narrow, and worth stating precisely so it is not over-claimed. The grid/HD half of Frost et al. is
explained by the established HD-anchoring account. The residual is **subicular place cells**: why
they died when their principal driver, CA1, was intact. H4 is the best answer and it is not mine.

A defensible contribution would have to be one of:

1. **The bound itself** (H2 above) as a short theoretical note — it rules out a class of
   explanations quantitatively and predicts broadening-with-preserved-decoding, which is checkable
   against Frost et al.'s existing recordings. This is real but small, and it is a *negative*
   constraint.
2. A model that discriminates H3 from H4 by a measurement neither currently makes — e.g. whether
   surviving subicular cells after ATN lesion are the least directionally tuned (H4 predicts yes,
   H3 predicts no relationship). That is a genuine, answerable question, but it needs the animals'
   data, not a simulation.

## Method note, and it is the durable one

Four hypotheses, three criteria each. Biological plausibility and clinical relevance were satisfied
every time and discriminated nothing. **Novelty was the binding constraint in three of four cases,
and it was cheap to check — minutes of literature search against weeks of implementation.** The
order was wrong: novelty should have been checked *before* the model was built, not after it ran.
Stage 41's lesson was about controls; this one is about sequence.
