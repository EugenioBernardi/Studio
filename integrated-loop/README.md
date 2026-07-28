# The loop — sensory cortex ⇄ entorhinal ⇄ hippocampus ⇄ thalamus

A single, numerically validated dynamical model of the **encode → replay → consolidate**
cycle, with the sensory front end, the sleep state that gates it, and the lateralised
structures whose damage produces recognisable clinical syndromes. Headless, plain JavaScript,
**no dependencies**.

```bash
node --version    # ≥ 16, nothing else needed
npm test          # stages 1–4: the memory loop end to end
```

No build step, no install, nothing to fetch. `npm test` runs `node`.

## What this is (and is not)

This is a **synthesis of established mechanisms integrated into one coupled, numerically
testable circuit** — not a claim of new biology. Each component is a textbook mechanism
(hippocampal index theory; DG pattern separation and mossy-fibre detonation; ACh-gated
encoding/retrieval; CA3 attractor completion; sharp-wave-ripple replay and its directed order;
systems consolidation; the thalamocortical slow oscillation and spindles; Kinsbourne's
opponent processor; the circuit of Papez; Aggleton & Brown's dual-process account). The
contribution is that they run **together in one model**, each interface is principled rather
than glue, and the failures are reported as carefully as the successes. The value is a
working, inspectable substrate for asking "what happens to X if I lesion Y" — a tools/methods
contribution.

Nothing that should be emergent is scripted: sparsity comes from feedback inhibition, replay
order from learned CA3 transition weights, the consolidation gradient from accumulated
cortico-cortical weight, extinction from interhemispheric competition.

## Scale

At shipped defaults — ~9 600 principal cells with per-field feedback inhibition (PV-like
pools), no k-winners shortcuts. Hippocampal field ratios are **human** stereology (West &
Gundersen 1990; Šimić 1997; Gómez-Isla 1996), whose signature is CA1 ≈ 5.5× CA3 — the
expansion is at the output/comparator stage, not the attractor.

| field | N | role |
|---|---|---|
| neocortex | 1600 | recurrent, plastic — auto-associative assemblies |
| EC layer II / III / deep | 300 / 300 / 800 | bidirectional hub, cortex ⇄ hippocampus |
| dentate gyrus | 2700 | pattern separation (sparsest field) |
| CA3 | 480 | index + sequence store |
| CA1 | 2640 | back-projection relay and comparator |
| subiculum | 800 | output stage |

The lesion suites (stages 8, 10, 13–15) run at **NC = 800** for tractability. Stage 13b checks
that the material-specificity result survives doubling to 1600 — it does, and grows.

Stage 5 adds a thalamocortical sheet (37 columns × 9 cell classes, the headless extraction of
`apps/thalamocortical-3d.html`) as the NREM state generator.

**Scale-invariance is a designed property, not luck.** Sparsity is set by mean-field feedback
inhibition (a fraction, independent of N), and every projection is *convergence-preserving*
(connection probability scales as 1/N_presynaptic), so per-cell input statistics — and
therefore sparsity, index separation, reinstatement, replay and consolidation rate — are
unchanged by scale. Designed, and in one place measured (stage 13b); not measured everywhere.

## Running the suites

| command | what it checks | result |
|---|---|---|
| `npm test` | 1–4 · assemblies, index binding, replay, consolidation | 31/31 |
| `npm run test:cross-scale` | 5 · SO Up-states trigger replay, spindles gate it | 9/9 |
| `npm run test:vision` | 6 · ventral + dorsal streams | 7/7 |
| `npm run test:pathology` | 8 · TGRA, AD, DG disinhibition, TLE two-hit | 11/11 |
| `npm run test:spatial` | 9 · egocentric ⇄ allocentric transform | 11/11 |
| `npm run test:mst` | 10 · Mnemonic Similarity Task | 5/5 |
| `npm run test:visual-pathology` | 11 · perimetry, Mach bands, Charles Bonnet | 9/10 † |
| `npm run test:chiasm` | 12 · six localising lesions, per-eye fields | 14/14 |
| `npm run test:bilateral` | 13 · material specificity, H.M., Wada | 15/15 |
| `npm run test:bilateral-scale` | 13b · the same crossover at 2× cortex | 5/5 |
| `npm run test:neglect` | 14 · extinction, bisection, the paradox | 15/15 † |
| `npm run test:papez` | 15 · diencephalic amnesia, thalamic neglect | 16/16 |

† **Three checks are deliberately red** (stage 7 HMAX, stage 11 tilt illusion, stage 14
pseudoneglect). Each is a failure with a *named missing mechanism*, kept visible rather than
quietly relaxed. See `OVERVIEW.md` §3.

## What it reproduces

**Memory.** Replay order fidelity ρ 1.00 forward and −1.00 reverse, time-compressed 17.9×
(Lee & Wilson 2002; Davidson 2009; Diba & Buzsáki 2007). A recent memory is
hippocampus-dependent and a remote one is not (Kim & Fanselow 1992; Frankland & Bontempi 2005).

**Sleep.** Slow oscillation 1.05 Hz with 73 % Down-state occupancy; isolated TC–RTN spindle at
16.5 Hz. NREM produces spindle-gated replay and the cortex becomes independent (ρ 1.00); wake
gates nothing (ρ 0.00). The consolidation window is emergent from the rhythm, not hand-set.

**Vision.** 100 % shape classification over 81 scale × rotation × position conditions; MT
direction error 0.0° median.

**Localisation.** Optic nerve, chiasm, tract, Meyer's loop, parietal radiation and occipital
lesions each produce their own pair of perimetry charts — the chiasm giving a bitemporal defect
that is non-congruous by construction, impossible without two retinas.

**Lateralised syndromes.** Material-specific amnesia after unilateral temporal lobectomy with a
crossover double dissociation in 6/6 seeds; dense anterograde amnesia with spared remote memory
after bilateral resection; hemispatial neglect with extinction, ipsilesional bisection bias and
Kinsbourne's paradoxical relief from a second lesion; diencephalic amnesia with an intact
hippocampus; the recollection/familiarity double dissociation; thalamic neglect.

## Using the modules

CommonJS, plain options objects, nothing global.

```js
const C = require("./src/cortex.js");
const H = require("./src/hippocampus.js");
const L = require("./src/loop.js");
const K = require("./src/consolidate.js");

const cortex = C.create({ seed: 1, NC: 800, nStim: 8 }); C.encode(cortex);
const hpc = H.createHPC({ seed: 107, NC: cortex.N }); hpc.plastic = true;

L.encodeSequence(cortex, hpc, [0, 1, 2, 3, 4, 5]);
L.replaySequencePaced(cortex, hpc, {});                  // → [0,1,2,3,4,5], emergent
L.replaySequencePaced(cortex, hpc, { reverse: true });   // → [5,4,3,…]

const cons = K.createConsolidation(cortex);
K.consolidate(cortex, hpc, cons, 30, { order: [0, 1, 2, 3, 4, 5] });
K.corticalRecall(cortex, cons, hpc.indices.map(x => x.cortex), {});   // recall WITHOUT hpc
```

A syndrome is a few lines:

```js
const B = require("./src/bilateral.js");
const T = require("./src/limbicthalamus.js");
const P = require("./src/parietal.js");

const brain = B.createBrain({ seed: 107, NC: cortex.N });
B.resect(brain, "L");                        // left temporal lobectomy

const limb = T.createLimbic();
T.lesion(limb, "mb", "both", 1.0);           // bilateral mammillary bodies — Korsakoff
T.papezReturn(limb, 0.8);                    // → 0: recollection abolished

const par = P.createParietal();
P.lesionParietal(par, "R", 0.6);             // right parietal
P.extinction(par, -0.7, +0.7);               // contralesional target, ipsilesional competitor
```

## Module map

| file | what it is |
|---|---|
| `src/cortex.js` | recurrent cortex; feedback inhibition; subtractive normalisation |
| `src/hippocampus.js` | human-ratio trisynaptic circuit, topographic connectivity |
| `src/loop.js` | encode → bind → ripple-paced replay |
| `src/consolidate.js` | cortico-cortical chain; systems consolidation |
| `src/thalamocortical.js` | 19/37/61-column NREM model, headless |
| `src/night.js` | SO Up-state triggers replay; spindle power gates consolidation |
| `src/vision.js` | retina → LGN → V1 → V2 ventral; motion energy dorsal |
| `src/hmax.js` | multi-scale HMAX S1/C1 front end |
| `src/visualpathway.js` | two retinas, optic chiasm, six lesion sites |
| `src/spatial.js` | PPC ⇄ RSC ⇄ ATN egocentric/allocentric transform |
| `src/bilateral.js` | two lateralised hippocampi + commissure |
| `src/parietal.js` | two parietal cortices; opponent processor on a coverage gradient |
| `src/limbicthalamus.js` | circuit of Papez, MD/familiarity route, pulvinar |

## Figures

```bash
node test/make_figures.js     # recompute figures/data.json from the models
node figures/build.js         # assemble figures/report.html from template + JSON
```

The report is **assembled, never hand-edited**: each stage test writes its own JSON beside the
template and `build.js` merges them, so the figures cannot drift away from the models.

## Method

Full rules in `OVERVIEW.md` §1. In short: simulate headless first and print numbers; register
predictions — *including predictions of failure* — in the test header before running; report
negatives with a mechanism; replicate across seeds and print the per-seed count; never sweep a
parameter until something crosses significance. Metrics are chosen so a degenerate solution
fails: completion is scored against specificity, replay order by Spearman ρ on first
appearance, consolidation by a lesion dissociation rather than a single curve.

## Status and limits

Read `OVERVIEW.md` §7 before relying on any of this. The load-bearing ones:

- Results are **internally consistent, not externally validated**. Very little is compared
  quantitatively against published datasets; where it is (the MST) the absolute values are off
  in a documented way (LDI ≈ 0.89 against ≈ 0.3–0.5 in healthy adults).
- Parameters are tuned to targets with seed replication but **no systematic sensitivity
  analysis** beyond the one scale check.
- Human *ratios*, toy *counts*. Rate models throughout; nothing spikes.
- The thalamus gates consolidation in stage 5 but is **not** wired into the lesion suites;
  stage 15's diencephalic result uses ungated replay.
- The pathological cross-scale arm (thalamic GABA-B spindle → spike-wave, the ESES/CSWS
  mechanism) is **not** in this build: it was validated in a standalone thalamic model absent
  from this repository, and does not express from the app extraction alone.

## Licence

MIT.
