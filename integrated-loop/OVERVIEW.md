# Integrated loop — complete overview

A single codebase in which sensory cortex, entorhinal cortex, hippocampus, thalamus and
posterior parietal cortex run as one circuit, headless, in plain JavaScript with no
dependencies. Every mechanism in it is standard and sourced. **The contribution is the
integration and the discipline of the validation, not new biology.**

---

## 1. Method

The rules the work is held to, in the order they bind:

1. **Simulate first, draw second.** Headless prototype, printed numbers, explicit numeric
   targets. Rendering only afterwards, and then re-verified against the headless numbers.
2. **Nothing that should be emergent may be scripted.** Where an ingredient is assumed
   rather than derived, the source says so at the point of assumption.
3. **Register predictions before running.** Each stage test carries its predictions in the
   file header, including *predictions of failure*, so a miss cannot be reinterpreted as a
   hit afterwards.
4. **Report failures with a mechanism.** A negative result with a diagnosis is worth more
   than a positive one without. Several tests ship deliberately red.
5. **Replicate before believing.** Effects are checked across seeds and the per-seed
   consistency count is printed; a mean difference with half the seeds agreeing is not a
   result.
6. **Never sweep a parameter until something crosses significance.** That is p-hacking, and
   where a sweep would have manufactured an effect, the null is reported instead.

---

## 2. Modules

| file | lines | what it is |
|---|---|---|
| `src/cortex.js` | 173 | recurrent cortex; feedback inhibition sets sparsity; **subtractive** normalisation keeps assemblies crisp |
| `src/hippocampus.js` | 322 | human-ratio trisynaptic circuit, structured (non-random) topographic connectivity |
| `src/loop.js` | 275 | orchestrator: encode → bind → ripple-paced replay |
| `src/consolidate.js` | 136 | cortico-cortical chain; systems consolidation |
| `src/thalamocortical.js` | 230 | headless extraction of the 19/37/61-column NREM model |
| `src/night.js` | 81 | SO Up-state triggers replay; spindle power **gates** consolidation |
| `src/vision.js` | 390 | retina → LGN → V1 → V2 ventral; Adelson–Bergen motion energy dorsal |
| `src/hmax.js` | 144 | multi-scale HMAX S1/C1 front-end |
| `src/visualpathway.js` | 126 | two retinas, optic chiasm, six localising lesion sites |
| `src/spatial.js` | 157 | PPC ⇄ RSC ⇄ ATN egocentric/allocentric transform |
| `src/bilateral.js` | 258 | two lateralised hippocampi joined by a commissure |
| `src/parietal.js` | 197 | two parietal cortices; opponent processor on a coverage gradient |
| `src/limbicthalamus.js` | 197 | circuit of Papez, MD/familiarity route, pulvinar |

≈2 500 lines of model, ≈2 500 lines of test.

---

## 3. Stage record

| stage | what it establishes | result |
|---|---|---|
| 1 | cortical assemblies: sparse, near-orthogonal, pattern-completing | 8/8 |
| 2 | EC→DG→CA3 index binding and reinstatement | 9/9 |
| 3 | ripple-paced replay, forward ≫ backward | 7/7 |
| 4 | systems consolidation → cortico-cortical chain | 7/7 |
| 5 | cross-scale: SO Up-state triggers replay, spindle gates it | 9/9 |
| 6 | ventral + dorsal vision, extracted and re-verified | 7/7 |
| 7 | HMAX front-end | **1/4, deliberately** |
| 8 | pathology: TGRA, AD, DG disinhibition, TLE two-hit | 11/11 |
| 9 | egocentric ⇄ allocentric transform, and its lesions | 11/11 |
| 10 | Mnemonic Similarity Task, scored the field's way | 5/5 |
| 11 | visual pathology: perimetry, Mach bands, Charles Bonnet | **9/10, deliberately** |
| 12 | chiasm: six lesion sites, per-eye perimetry | 14/14 |
| 13 | two hippocampi: material specificity, H.M., Wada | 15/15 |
| 13b | the same crossover at 2× cortex | 5/5 |
| 14 | neglect: extinction, bisection, the paradox, the differential | **15/15 + 1 predicted failure** |
| 15 | limbic thalamus: diencephalic amnesia, recollection/familiarity, thalamic neglect | 16/16 |
| 16 | sensitivity: does each claim depend on a parameter I chose? | 4 robust · 2 moderate · **0 knife-edge** |
| 17 | external calibration audit against published ranges | **8/16 in range** |
| 18 | visual syndromes: blindsight, akinetopsia, the two agnosias | **10/10 + 2 predicted failures** |

### The deliberate failures, and why they stay red

- **Stage 7** demands ≥95 % shape classification through the untouched decision layer. The
  honest result is the trade-off table: a filter bank tuned for shapes loses on digits and
  vice versa; HMAX is the only bank good at both, at the cost of ~5 points of MNIST. A green
  tick here would hide that.
- **Stage 11**, the tilt illusion, is exactly 0.0° at every angle once the filters are fine
  enough to be physiological. Diagnosis: `v1complex` has cross-orientation normalisation but
  **no spatial surround normalisation**. That is the missing mechanism, named.
- **Stage 14**, pseudoneglect, comes out with the wrong *sign* (+0.037 rightward; humans
  bisect slightly left). Diagnosis: the model has a coverage asymmetry but no attentional-
  **strength** asymmetry, and coverage alone shifts the centre of mass toward the
  better-covered side. Two separable asymmetries; one implemented. **Registered in advance
  as a prediction of failure.**

---

## 4. Principal results

**Memory loop.** Assemblies 2–10 % sparse and near-orthogonal; DG the sparsest and
best-separated field (3.3 % active, 7.5 % overlap) with a monotone separation gradient along
EC → DG → CA3 → CA1 → Sub that was not tuned for. Replay order fidelity ρ 1.00 forward,
−1.00 reverse, time-compressed 17.9× against encoding. Consolidation reaches cortex-only
ρ 1.00 by ~6 replay events.

**Sleep gating (cross-scale).** SO Up-onsets detected by hysteresis trigger replay; only
spindle-nested events are licensed to consolidate. Disrupt the thalamocortical state and
consolidation fails — the memory result depends on the mesoscale state, which is the point
of having both in one model.

**Vision.** 100 % shape classification over 81 scale × rotation × position conditions; MT
direction error 0.0° median over 8 directions. MNIST exposed a real limit: with the shipped
shape-tuned filters, *every stage of the hierarchy loses information relative to raw pixels*
(V1 78.3 %, V2 76.5 % vs 87.8 % raw). Fine filters reverse it (92.5 %) but collapse the shape
task. HMAX resolves it. **A prediction I made in advance — that V1 would rival raw pixels —
was wrong, and is recorded as such.**

**Localisation (stage 12).** Optic nerve → monocular blindness. Chiasm → left eye loses its
LEFT field (0.04) while the right eye loses its RIGHT (0.00): opposite halves, non-congruous,
impossible without two retinas. Optic tract → congruous homonymous (0.04/0.04). Meyer's loop
→ superior quadrant 0.08 vs inferior 0.85; parietal radiation the exact opposite. Occipital
fovea 0.24 → 0.85 with macular sparing, periphery 0.02 in both.

**Two hippocampi (stage 13).** Intact 0.76/0.79 against a cortical floor of 0.50/0.52. Left
resection 0.61/0.73, right 0.69/0.61 — a **crossover** double dissociation in 6/6 seeds both
ways. Bilateral resection lands exactly on the floor. New learning after unilateral resection
survives (0.62 vs floor 0.47); after bilateral it does not (0.47, on the floor) — while a
memory with 24 replay events behind it survives that same resection at ρ 1.00 against ρ 0.00
for an unconsolidated one. H.M. in one table. At 2× cortex the deficits **grow** (0.15 → 0.23).

**Neglect (stage 14).** Contralesional target 1.291 alone → 0.003 with an ipsilesional
competitor; the competitor untouched at 1.297. Extinction **survives making the coverage
symmetric**, so it is the competition and not the built-in gradient. Neglect is a *band* in
lesion severity (0.4–0.8); below it nothing is wrong, above it the single target is already
lost and the state is field-defect-like. A second lesion in the intact hemisphere **relieves**
the neglect at 3/3 severities. Perimetry through the stage-12 pathway reads 0.87 in neglect
against 0.04 in hemianopia.

---

## 4b. Calibration — the honest status of the word "validated"

Stage 17 puts the model's numbers beside published ones. **8 of 16 fall inside range, and the
split is not random.**

| in range | outside |
|---|---|
| cortical sparsity 7.6 % (2–10) | MST LDI **0.89** (0.25–0.55) |
| dentate 3.3 % (1–5) · CA3 6.3 % · CA1 10.8 % | line bisection **50.6 %** of half-line (5–25) |
| CA1:CA3 = 5.5 (4.5–6.5) | pseudoneglect **+3.7 %** (−0.5 to −3, sign wrong) |
| replay compression 17.9× (5–20) | MST REC 1.00 (0.55–0.90) |
| order fidelity +1.00 / −1.00 | MT error **0.0°** (1–15) |
|  | SO 1.05 Hz · spindle 16.5 Hz (near misses) |

Everything **structural** is in range; everything **behavioural** is off. That is a diagnosis,
not a list of misses: circuit-level quantities were built to anatomical and physiological
targets, while the behavioural readouts are internal instruments with arbitrary thresholds and
scales that were never asked to land anywhere real. An MT error of 0.0° is *worse* than a large
one — it sits below the human floor, which is a failure of realism, not a success.

None of these ranges was used as a tuning target, so agreement means something where it occurs.
The reference ranges are **provisional** — recorded from the literature but not checked against
primary sources — and the audit deliberately does not fail the build, because a red build would
invite tuning the model to the references, which is exactly what must not happen.

**On this evidence the right word is CALIBRATED, not VALIDATED.**

## 4c. Sensitivity

Seed replication answers "is this noise?"; it does not answer "does this depend on a number I
chose?". Stage 16 sweeps the parameter each headline claim most plausibly rests on:

| claim | parameter | holds over | verdict |
|---|---|---|---|
| assembly sparsity in 2–10 % | gI | 88 % | ROBUST |
| DG sparser than EC/CA3/CA1 | gDG | 100 % | ROBUST |
| material-specificity crossover | wCross | 71 % | moderate |
| contralesional target extinguished | gCall | 88 % | ROBUST |
| a second lesion relieves neglect | gCall | 75 % | moderate |
| proximal Papez lesions cost more | per-stage gain | 100 % | ROBUST |

**Zero knife-edge claims**, and every failure sits where the responsible mechanism is switched
*off* — wCross → 1 makes the two hippocampi identical, gCall → 0.4 removes the competition.
Those are the control conditions; a claim that survived its own control would be the worrying
result. One parameter at a time, no interactions: a floor on fragility, not a proof of robustness.

## 5. Negative results, with mechanisms

These are load-bearing, not apologies.

- **The hippocampal commissure does nothing** across gComm 0 → 0.8, span 0.000 against a
  between-seed spread of 0.07. Checked as a suspected dead wire first: peak CA3 drive is
  mossy **64.9**, perforant 9.5, recurrent 2.4, commissural **0.71**. The current arrives; it
  is 0.9 % of CA3 drive. The DG→CA3 mossy fibre is a detonator synapse, which is the point of
  the architecture, and a sparse commissure cannot outvote it. It would take gComm 4.0 to
  reach 24 % — far outside anything defensible for a human commissure, and sweeping until it
  mattered would be p-hacking.
- **The Wada test cannot be modelled as an encoding/retrieval dissociation here.** Encode-off
  and retrieve-off returned byte-identical numbers, necessarily: a hippocampus inactivated
  during encoding ends with **0** bound output synapses (measured), so it contributes exactly
  what an absent one does. The clinical claim stands; the dissociation is arithmetic, and the
  model has no partial engram to retrieve from.
- **Pseudoneglect has the wrong sign** — see §3.
- **The tilt illusion is exactly 0.0°** — see §3.
- **V1 does not beat raw pixels on MNIST** — see §4.
- **Unilateral Papez compensation is COMPLETE** here, where clinically a left anterior thalamic
  lesion impairs verbal memory. The circuit is not lateralised by material the way the
  hippocampi are.
- **Thalamic and cortical neglect are equivalent at the bedside BY CONSTRUCTION** — the pulvinar
  enters as a gain on the same parietal capacity. The consequence, that perimetry separates
  neither, is not by construction.

---

## 6. Bugs worth not re-deriving

Each cost real time and each is a diagnostic pattern, not a typo.

- A task that **wasn't hippocampus-dependent**: cue-alone recall 0.87 with off-target 0.12 —
  cortical pattern completion solved it outright. Replaced with an arbitrary cross-stream
  conjunction where cortex gives an actively *wrong* answer (correct 0.05, wrong 0.52).
- **Encoding contamination read as retrieval error**: seeding CA3 with the exact stored index
  still produced the wrong partner at 0.33, because cortex had already distorted the episode
  toward its learned attractor. The memory must be defined as *what was actually encoded*.
- **Lateralising only the input** made the material-specific deficit vanish (0.03 vs 0.07, in
  the wrong direction). The hippocampal return path is as ipsilateral as the path in.
- **A readout that double-counted**: summing two parietal hemispheres gave 2.594 at the
  midline against 1.297 elsewhere. Max, not sum — either hemisphere can support awareness.
- **A saturated measure hiding an effect**: severity comparison run where both sides read
  0.000. Graded measures required.
- **A foveal region predicate that straddled the meridian**, making an unspared macula read
  as preserved (0.69 instead of 0.24).
- **A half-bin offset** in the egocentric transform — a systematic 15.0° error at 30° bins.
- **Vision extracted at the wrong parameters**: the app calls `rebuildGabors` at startup and
  the file literals were never the validated settings (52 % → 100 %).
- **Figures**: independently normalised maps, colours resolved once at load so a theme change
  baked in the old palette, containers cleared on assignment but not on append (double
  render), meridian lines invisible against half the cells they cross.

---

## 7. Known gaps

1. **The thalamus is not in the memory-lesion arm.** Stage 13's retrograde result calls
   `consolidate()` directly — replay is ungated, bypassing the SO/spindle machinery stage 5
   validated. The result is "consolidated by fiat", not "by a night of sleep".
2. **One thalamus, two hippocampi, two parietal cortices.** Thalamic neglect is a recognised
   syndrome; the pulvinar and TRN are the obvious next lesion sites and cannot be reached.
3. **No spatial surround normalisation in V1** — blocks the tilt illusion and every other
   contextual illusion.
4. **No attentional-strength asymmetry** — blocks pseudoneglect.
5. **HMAX still reads through a 3-scalar decision layer**; a population readout would close it.
6. **Scale.** Cortex 800–1600 units, hippocampus ≈7 700. Human *ratios*, toy *counts*.
7. **The lateralisation mapping is an analogue.** ventral↔verbal is a stand-in; the spatial
   half (right hemisphere ↔ spatial) is literal, the verbal half is not.
8. **Scale is checked in one place only** (stage 13b). Sensitivity is now swept for six claims
   (stage 16) but one parameter at a time, with no interaction terms.
9. **The behavioural readouts are uncalibrated** (stage 17). Fixing them means giving each
   instrument a real scale — bisection in mm of a real line length, MST with perceptually
   confusable stimuli from the MNIST front end, MT with a decision noise floor — not retuning
   the circuits behind them.
