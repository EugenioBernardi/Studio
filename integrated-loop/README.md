# The loop — sensory cortex ⇄ entorhinal ⇄ hippocampus

A single, numerically validated dynamical model of the **encode → replay → consolidate**
cycle. A sequence of sensory stimuli forms cortical assemblies; the hippocampus binds an
index to each and stores their order; during sharp-wave-ripple states it **replays** the
sequence and reinstates the cortical assemblies in order, time-compressed; replay-driven
co-activation writes **cortico-cortical** links so that, after enough replay, the cortex
recalls the sequence **without the hippocampus** — the systems-consolidation gradient.

Every italicised phenomenon is checked against a specific experimental number. Nothing that
should be emergent is scripted: sparsity comes from feedback inhibition, the replay order
comes from learned CA3 transition weights, the consolidation gradient comes from how much
cortico-cortical weight a memory has accumulated.

## Scale

~1,470 principal cells with per-field feedback inhibition (PV-like pools), no k-winners
shortcuts:

| field | N | role |
|-------|---|------|
| neocortex | 400 | recurrent, plastic — assemblies (auto-associative) |
| entorhinal (EC) | 150 | bidirectional hub cortex⇄hippocampus |
| dentate gyrus (DG) | 500 | pattern separation (sparsest) |
| CA3 | 240 | index + sequence store (auto-assoc + directed transitions) |
| CA1 | 180 | back-projection relay to EC |

## Layout

    src/cortex.js        neocortical assemblies (stage 1)
    src/hippocampus.js   EC/DG/CA3/CA1 fields, forward/backward/replay dynamics
    src/loop.js          orchestrator: encode+bind, reinstate, ripple-paced replay
    src/consolidate.js   cortico-cortical consolidation + HP-independent cortical recall
    test/stage{1..4}.js  numeric acceptance tests (run with `npm test`)

## Validation — 31 / 31, against real data

Each stage replicates across seeds and includes an ablation proving its mechanism is
load-bearing (remove it and the target breaks).

**Stage 1 — cortical assemblies** (8 seeds, 8/8). Feedback inhibition sets sparsity;
subtractive synaptic normalisation (Miller & MacKay 1994) keeps membership crisp.
Sparsity **7.3 %** (Barth & Poulet 2012: 2–10 %), assemblies orthogonal (xoverlap 1.2 of
~29 cells), pattern-completion recall **0.88** from a 50 % cue, off-target 1.1 cells.
*Ablations:* no plasticity → recall 0.49 (= cue fraction); no normalisation → assemblies
merge (overlap 97/97).

**Stage 2 — index binding** (6 seeds, 9/9). Mossy detonator selects a sparse CA3 index;
bidirectional binding (Wec, Wc1e) ties it to its assembly. CA3 index **5.9 %** (~14 cells),
orthogonal; DG separation 4.7 % active; reactivating an index reinstates ITS assembly —
recall **0.87**, cross-talk **0.07**. *Ablation:* no binding → recall 0.00.

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
