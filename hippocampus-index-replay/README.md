# Hippocampal index-and-replay model

A minimal, numerically validated model of the hippocampal **trisynaptic circuit**
`EC → DG → CA3 → CA2 → CA1 → subiculum`, with per-field PV and SOM interneurons, hilar mossy
cells, and medial-septum / diagonal-band theta pacing. Encoding and retrieval are gated by
acetylcholine (Hasselmo); sharp-wave ripples in the low-ACh state drive sequential **replay** of
stored indices.

The model runs headlessly as a Node library (`src/model.js`, no dependencies) and interactively in
a browser (`app/index.html`, no build step). The two are the same dynamics; the library is the
extraction of the viewer's core.

## Layout

    src/model.js      dynamics only — no rendering, no DOM
    test/validate.js  numeric acceptance tests (12 targets)
    app/index.html    interactive viewer (self-contained)
    paper/            manuscript and figures

## Use

```js
const M = require('./src/model.js');
M.reset(12345);              // deterministic seed
M.setMode('explore');        // 'explore' | 'quiet' | 'sleep'  (ACh 1 / 0.5 / 0.15)
M.route(0);                  // encode the six-concept route (binds indices)
M.advance(3600);             // run 3.6 s of dynamics (1 ms steps + phase clocks)
console.log(M.indices.length, M.thetaPower(), M.record());
```

Run the acceptance tests with `npm test`.

## Status of numeric reproduction — **12 / 12**

`src/model.js` is the faithful extraction of the reference viewer (`app/index.html`): the rate
step, the phase (clock) step, the index store, the **LFP**, and the theta-band-power observable,
with the renderer removed. No dynamics constant was altered.

| target | acceptance | value | status |
|--------|-----------|-------|--------|
| theta power, septum intact | ≥ 0.70 | 0.95 | ✅ |
| theta power, septal lesion | ≤ 0.40 | 0.13 | ✅ |
| theta power, restored | ≥ 0.70 | 0.94 | ✅ |
| lesion effect size | ≥ 0.40 | 0.82 | ✅ |
| CA3 sparse coding at PV 100% | ≤ 0.35 | 0.19 | ✅ |
| PV → activity monotonic | 100≤60≤30 | 0.19 · 0.38 · 0.94 | ✅ |
| runaway active at PV 30% | ≥ 0.80 | 0.94 | ✅ |
| CA3 coherence R at PV 30% | ≥ 0.85 | 1.00 | ✅ |
| self-sustaining seizure needs recG | recG=1 seizes | 0.94 | ✅ |
| seizure impossible, recG = 0 | no seizure | 0.00 | ✅ |
| six indices bound | = 6 | 6 | ✅ |
| index near-orthogonality | mean shared ≤ 1 | 0.35 (14/20 seeds perfect) | ✅ |

The two previously-open extraction-fidelity issues are closed:

1. **LFP theta power.** The LFP (`CA1 pyramidal drive − perisomatic inhibition + ripple carrier`)
   is now a model-owned observable computed inside `step()`, with `M.thetaPower()` exposing the
   band(5–12 Hz)/total(2–40 Hz) power ratio. It had lived only in the renderer.
2. **PV-30% runaway.** The headless driver now reproduces the seizure: it requires the
   **low-ACh** state (recurrent transmission un-gated), an **ignition** (a cued/replayed index to
   seed activity), and a **multi-second** window. The self-sustaining seizure is carried by the
   learned recurrent weights, so it is impossible with `recG = 0`.

Index orthogonality is reported as a **distribution** (14/20 seeds fully orthogonal, mean overlap
0.35 of 18 cells) rather than a single cherry-picked seed — the honest claim for a field packed to
capacity by design.

## Citation

See `CITATION.cff`. A Zenodo DOI is minted against the `v1.0.0` release tag; the model is deposited
in ModelDB.

## License

MIT — see `LICENSE`.
