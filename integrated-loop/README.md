# The loop — sensory cortex ⇄ entorhinal ⇄ hippocampus

A single, numerically validated dynamical model of the **encode → replay → consolidate**
cycle. A sequence of sensory stimuli forms cortical assemblies; the hippocampus binds an
index to each and stores their order; during sharp-wave-ripple states it **replays** the
sequence and reinstates the cortical assemblies in order, time-compressed; replay-driven
co-activation writes **cortico-cortical** links so that, after enough replay, the cortex
recalls the sequence **without the hippocampus** — the systems-consolidation gradient.

## What this is (and is not)

This is a **synthesis of established mechanisms integrated into one coupled, interactive,
numerically testable circuit** — not a claim of new biology. Each component is a textbook
mechanism (hippocampal index theory; DG pattern separation and mossy-fibre detonation;
ACh-gated encoding/retrieval; CA3 attractor completion; sharp-wave-ripple replay and its
STDP-directed order; systems consolidation; the thalamocortical slow oscillation and
spindles). The contribution is that they run **together in one model**, each interface is
principled rather than glue, and every step reproduces a **published experimental number**
rather than a scripted animation. The value is a working, inspectable substrate for asking
"what happens to consolidation if I change X" — a tools/methods contribution, in the spirit
of eNeuro's Open Source Tools and Methods track.

Every italicised phenomenon above is checked against a specific experimental number, and
nothing that should be emergent is scripted: sparsity comes from feedback inhibition, the
replay order comes from learned CA3 transition weights, the consolidation gradient comes from
how much cortico-cortical weight a memory has accumulated.

## Scale

~5,880 principal cells with per-field feedback inhibition (PV-like pools), no k-winners
shortcuts:

| field | N | role |
|-------|---|------|
| neocortex | 1600 | recurrent, plastic — assemblies (auto-associative) |
| entorhinal (EC) | 600 | bidirectional hub cortex⇄hippocampus |
| dentate gyrus (DG) | 2000 | pattern separation (sparsest) |
| CA3 | 960 | index + sequence store (auto-assoc + directed transitions) |
| CA1 | 720 | back-projection relay to EC |

Stage 5 adds a validated **thalamocortical sheet** (333 populations, 9 cell classes ×
37 columns — the faithful extraction of `apps/thalamocortical-3d.html`) as the NREM state
generator that gates the loop. Its column count is orthogonal to the loop's neuron count and
is kept at 37 (rather than 61) so a full night stays tractable; the sheet reproduces the same
states at any ring count.

**Scale-invariance is a designed property, not luck.** Sparsity is set by mean-field feedback
inhibition (a fraction, independent of N), and every projection is *convergence-preserving*
(its connection probability scales as 1/N_presynaptic), so the per-cell input statistics — and
therefore assembly sparsity, index separation, reinstatement, replay, and the consolidation
rate — are unchanged by scale. The validated numbers are identical at 400, 800, and 1600
cortical cells; the sizes above are the shipped 4×-baseline configuration.

## Layout

    src/cortex.js        neocortical assemblies (stage 1)
    src/hippocampus.js   EC/DG/CA3/CA1 fields, forward/backward/replay dynamics
    src/loop.js          orchestrator: encode+bind, reinstate, ripple-paced replay
    src/consolidate.js   cortico-cortical consolidation + HP-independent cortical recall
    test/stage{1..4}.js  numeric acceptance tests (run with `npm test`)

## Validation — 40 / 40, against real data (at the shipped 2× scale)

Each stage replicates across seeds and includes an ablation proving its mechanism is
load-bearing (remove it and the target breaks). Numbers below are at 1600 cortical cells;
the *fractions* are identical at 400 and 800 (scale-invariance, above).

**Stage 1 — cortical assemblies** (8 seeds, 8/8). Feedback inhibition sets sparsity;
subtractive synaptic normalisation (Miller & MacKay 1994) keeps membership crisp.
Sparsity **7.3 %** (Barth & Poulet 2012: 2–10 %), assemblies orthogonal (~120 cells,
xoverlap ~5 %), pattern-completion recall **0.89** from a 50 % cue, off-target 2.7 % of the
assembly. *Ablations:* no plasticity → recall 0.50 (= cue fraction); no normalisation →
assemblies merge (overlap 385/385).

**Stage 2 — index binding** (6 seeds, 9/9). Mossy detonator selects a sparse CA3 index;
bidirectional binding (Wec, Wc1e) ties it to its assembly. CA3 index **6 %** (~56 cells),
orthogonal; DG separation 4.7 % active; reactivating an index reinstates ITS assembly —
recall **0.87**, cross-talk **0.06**. *Ablation:* no binding → recall 0.00.

**Stage 3 — sharp-wave-ripple replay** (8 seeds, 7/7). CA3 stores order as directed
transition weights (Rseq, forward ≫ backward, separate from the auto-associator); a ripple
frame paces the walk, the content is emergent.

| phenomenon | target | value | source |
|-----------|--------|-------|--------|
| forward order fidelity | ρ ≥ 0.8 | **ρ = 1.00** | Lee & Wilson 2002 |
| time compression | 15–20× | **17.9×** | Davidson et al. 2009 |
| forward **and** reverse | both occur | ρ +1.00 / −1.00 | Diba & Buzsáki 2007 |

*Ablation:* remove the order links → replay coverage collapses to 1/6.

**Stage 4 — consolidation gradient** (6 seeds, 7/7). Replay writes directed cortico-cortical
links; a recent memory (2 replays) is HP-dependent, a remote memory (30 replays) is not.

| | HPC-intact | HPC-lesioned (cortex only) |
|--|-----------|----------------------------|
| **recent** | ρ = 1.00 | **ρ = 0.00** — recall abolished |
| **remote** | ρ = 1.00 | **ρ = 1.00** — recall spared |

The lesion abolishes recent but spares remote recall (Kim & Fanselow 1992; Frankland &
Bontempi 2005). *Ablation:* no consolidation plasticity → cortex never HP-independent (0.00).

**Stage 5 — cross-scale coupling: sleep-dependent consolidation** (`test/stage5.js`, run with
`npm run test:cross-scale`; 9/9). A validated thalamocortical sheet generates the NREM state
and *gates* the loop, replacing the hand-set low-ACh window. Its slow-oscillation Up-states
(Down→Up transitions) trigger hippocampal replay (Sirota 2003; Battaglia 2004), and thalamic
spindle power gates whether that replay consolidates (Latchoumane 2017; Maingret 2016). The
consolidation window is therefore **emergent from the thalamocortical rhythm**, and consolidation
becomes sleep-dependent:

- Part A — the extraction reproduces the documented regimes: wake **gamma-dominant**; NREM
  **slow oscillation 1.05 Hz** with **73% Down-state occupancy**; isolated TC–RTN **spindle 16.5 Hz**.
- Part B — **NREM** produces spindle-gated replay events/night → cortex becomes HP-independent
  (ρ = 1.00); **wake** (persistent Up state, no SO onsets, no spindles) gates nothing → the
  memory stays HP-dependent (ρ = 0.00). Δρ = 1.00.

This spans micro→meso (thalamocortical conductances and oscillation) → systems (replay gating)
→ behavioural (sleep-dependent consolidation gradient).

*Open — the pathological arm.* The natural next result is that the thalamic GABA-B spindle→
spike-wave switch abolishes consolidation (a mechanistic model of the ESES/CSWS cognitive-
regression syndrome). It is **not** in this build: that switch was validated in a standalone
thalamic model (`hex-model.js` / epilepsy `VALIDATION.md`) that is absent from this repository
and no longer available, and it does not express from the app-HTML extraction alone (the burst-
gated GABA-B never reaches its release threshold in the isolated loop as extracted). Substitute
epileptogenic perturbations (KCC2/PV loss) make the cortex *more* active, not less, so they do
not close the spindle gate. Reaching this result needs a from-scratch spiking thalamic model
that produces validated spindles **and** spike-wave — a substantial separate effort. What ships
here is the physiological arm, validated end to end.

## Use

```js
const L = require("./src/loop.js");
const K = require("./src/consolidate.js");
const { C, H } = L;

const cortex = C.create({ seed: 1 }); C.encode(cortex);        // learn 8 cortical assemblies
const hpc = H.createHPC({ seed: 108, NC: cortex.N }); hpc.plastic = true;
L.encodeSequence(cortex, hpc, [0,1,2,3,4,5]);                  // bind indices + store order

L.replaySequencePaced(cortex, hpc, {});            // forward replay  → [0,1,2,3,4,5]
L.replaySequencePaced(cortex, hpc, { reverse: true });         // reverse replay  → [5,4,3,...]

const cons = K.createConsolidation(cortex);
K.consolidate(cortex, hpc, cons, 30, { order: [0,1,2,3,4,5] });// 30 replay events
K.corticalRecall(cortex, cons, hpc.indices.map(x => x.cortex), {});  // recall WITHOUT hpc
```

## Method

Simulate headless, verify numbers, replicate across seeds; never tune a validated constant
to pass a test. Metrics are chosen so a degenerate solution fails: completion is scored
against specificity and encoded overlap (so a merged attractor can't pass), replay order
is Spearman ρ on first-appearance (the experimental measure), and the consolidation gradient
is a lesion dissociation, not a single curve.

## License

MIT.
