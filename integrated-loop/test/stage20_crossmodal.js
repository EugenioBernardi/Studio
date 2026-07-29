"use strict";
/* Stage-20 — CROSS-MODAL binding: a sound bound to a shape.
 *
 * Stage 13 bound the ventral half of one visual stimulus to the dorsal half of another and
 * called the left/right axis "verbal-like vs spatial". That was flagged as an analogue from
 * the start, and stage 17 lists material-specific memory as having no external anchor partly
 * because of it. Here the two halves of cortex are driven by REAL auditory features (A1
 * modulation spectrum + belt pitch) and REAL visual features (V2 angle/curvature), so the
 * conjunction the hippocampus has to store is genuinely cross-modal.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) SIMILARITY IS PRESERVED. Cortical pattern overlap should correlate with feature
 *       similarity within each modality. If it does not, the "modalities" are arbitrary tags
 *       and nothing below means anything — this is the load-bearing check, not a formality.
 *   (2) The two modality halves are separable: an item's auditory pattern says nothing about
 *       its visual one, because the pairing is arbitrary.
 *   (3) CROSS-MODAL RECALL. Cue with the sound, recover the shape (and the reverse), above
 *       the cortex-alone floor. Cortex cannot do it: the pairing is arbitrary, so cortical
 *       completion has nothing to complete toward.
 *   (4) LATERALISATION NOW MAPS TO MODALITY. Left resection should cost AUDITORY material
 *       more than visual, right the reverse — the stage-13 crossover, but on a modality axis
 *       rather than an analogue one.
 */

const X = require("../src/crossmodal.js");
const B = require("../src/bilateral.js");
const C = require("../src/cortex.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};

/* Eight bimodal objects, on a CROSSED design. The first version reused three shapes across
   eight items, so the visual half carried category blocks — and once the visual feature vector
   was enriched from 6 to 17 dimensions those blocks became MORE visible, pushing the
   independence correlation from 0.43 to 0.56. That is a stimulus-set defect, not a finding.
   Here the four shape kinds are crossed with two rotations to give eight DISTINCT visual
   items, and sounds are assigned so that members of the same auditory family (the two tones,
   the two harmonics, the two sweeps) never share a shape kind. Sound similarity therefore
   cannot predict shape similarity by construction of the design rather than by luck. */
const ITEMS = [
  { sound: ["tone", { f0: 300 }],            image: ["square",   { size: 0.52, rot: 0 }] },
  { sound: ["tone", { f0: 700 }],            image: ["circle",   { size: 0.52, rot: 0.7 }] },
  { sound: ["harmonic", { f0: 180 }],        image: ["triangle", { size: 0.52, rot: 0 }] },
  { sound: ["harmonic", { f0: 320 }],        image: ["bar",      { size: 0.52, rot: 0.7 }] },
  { sound: ["up", { f0: 300, sweep: 6 }],    image: ["circle",   { size: 0.44, rot: 0 }] },
  { sound: ["down", { f0: 1800, sweep: 6 }], image: ["square",   { size: 0.44, rot: 0.7 }] },
  { sound: ["noise", { seed: 5 }],           image: ["bar",      { size: 0.60, rot: 0 }] },
  { sound: ["am", { f0: 600, am: 8 }],       image: ["triangle", { size: 0.60, rot: 0.7 }] },
];
/* ---------------- 1. does the front end preserve similarity? ---------------- */
console.log("\n== 1. is this a front end, or two arbitrary tags? (P1) ==");
let CM;
{
  CM = X.createCrossModal(ITEMS, { seed: 1, NC: 800 });
  const n = ITEMS.length;
  const fa = [], ca = [], fv = [], cv = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    fa.push(X.cosine(CM.aFeat[i], CM.aFeat[j]));
    ca.push(X.halfOverlap(CM.cortex.stim[i], CM.cortex.stim[j], 0, CM.half));
    fv.push(X.cosine(CM.vFeat[i], CM.vFeat[j]));
    cv.push(X.halfOverlap(CM.cortex.stim[i], CM.cortex.stim[j], CM.half, CM.cortex.N));
  }
  const rA = X.pearson(fa, ca), rV = X.pearson(fv, cv);
  out.similarity = { auditory: rA, visual: rV, nPairs: fa.length };
  console.log("  auditory: feature similarity vs cortical overlap   r = " + f(rA));
  console.log("  visual  : feature similarity vs cortical overlap   r = " + f(rV));
  ok("cortical overlap tracks AUDITORY feature similarity (P1)", rA > 0.4, "r = " + f(rA));
  ok("cortical overlap tracks VISUAL feature similarity", rV > 0.4, "r = " + f(rV));

  /* the concrete version of the same claim */
  const iUp = 4, iDown = 5, iNoise = 6;
  const upDown = X.halfOverlap(CM.cortex.stim[iUp], CM.cortex.stim[iDown], 0, CM.half);
  const upNoise = X.halfOverlap(CM.cortex.stim[iUp], CM.cortex.stim[iNoise], 0, CM.half);
  console.log("  concretely: up-sweep vs down-sweep overlap " + f(upDown) +
              "   up-sweep vs noise " + f(upNoise));
  out.concrete = { upDown, upNoise };
}

/* ---------------- 2. are the two halves independent? ---------------- */
console.log("\n== 2. the pairing is arbitrary, so the halves must be independent (P2) ==");
{
  const n = ITEMS.length, aa = [], vv = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    aa.push(X.halfOverlap(CM.cortex.stim[i], CM.cortex.stim[j], 0, CM.half));
    vv.push(X.halfOverlap(CM.cortex.stim[i], CM.cortex.stim[j], CM.half, CM.cortex.N));
  }
  const r = X.pearson(aa, vv);
  out.independence = r;
  console.log("  correlation between auditory-half and visual-half overlap: r = " + f(r));
  ok("knowing two items sound alike says little about whether they look alike",
     Math.abs(r) < 0.5, "r = " + f(r) + " — the conjunction carries information cortex lacks");
}

/* ---------------- 3–4. cross-modal recall, and modality lateralisation ---------------- */
console.log("\n== 3–4. cross-modal recall and the lateralisation it puts on a modality axis ==");
{
  const SEEDS = [1, 2, 3, 4, 5, 6];
  const PAIRS = [[0, 1], [2, 3], [4, 5], [6, 7]];   // episode k binds item a's sound to item b's shape
  const rec = { intact: [], L: [], R: [], both: [] };
  for (const s of SEEDS) {
    const cm = X.createCrossModal(ITEMS, { seed: s, NC: 800 });
    const cortex = cm.cortex;
    const brain = B.createBrain({ seed: 100 + s * 7, NC: cortex.N });
    // the hippocampi read the modality split, not the ventral/dorsal one
    brain.L.cxStream = cm.stream; brain.R.cxStream = cm.stream;
    brain.gain.L = B.lateralGain({ NC: cortex.N, cxStream: cm.stream }, "L", brain.P.wCross);
    brain.gain.R = B.lateralGain({ NC: cortex.N, cxStream: cm.stream }, "R", brain.P.wCross);

    const eps = B.makeEpisodes(cortex, brain, PAIRS);
    B.encodeEpisodes(cortex, brain, eps);
    for (const [k, l, r] of [["intact", 1, 1], ["L", 0, 1], ["R", 1, 0], ["both", 0, 0]]) {
      brain.alive.L = !!l; brain.alive.R = !!r;
      rec[k].push(B.testList(cortex, brain, eps, { scale: 0.20, cue: 0.35 }));
    }
  }
  const m = k => ({ A: mean(rec[k].map(r => r.V)), V: mean(rec[k].map(r => r.D)) });
  const I = m("intact"), L = m("L"), R = m("R"), Bo = m("both");
  const fA = mean(rec.intact.map(r => r.floorV)), fV = mean(rec.intact.map(r => r.floorD));
  out.recall = { intact: I, leftResected: L, rightResected: R, bilateral: Bo,
                 floorA: fA, floorV: fV, seeds: SEEDS.length };

  console.log("  condition          AUDITORY content   VISUAL content");
  for (const [n2, r] of [["intact", I], ["LEFT resected", L], ["RIGHT resected", R], ["bilateral", Bo]])
    console.log("  " + n2.padEnd(18) + f(r.A, 2).padStart(8) + "           " + f(r.V, 2).padStart(8));
  console.log("  cortex-alone floor " + f(fA, 2).padStart(8) + "           " + f(fV, 2).padStart(8));

  ok("cross-modal recall beats cortical completion (P3)",
     I.A > fA + 0.10 && I.V > fV + 0.10,
     "Δauditory " + f(I.A - fA, 2) + "  Δvisual " + f(I.V - fV, 2));
  ok("bilateral resection abolishes it", (Bo.A + Bo.V) / 2 < (fA + fV) / 2 + 0.06,
     f((Bo.A + Bo.V) / 2, 2) + " vs floor " + f((fA + fV) / 2, 2));

  const nL = rec.L.filter((r, i) => r.V < rec.R[i].V).length;
  const nR = rec.R.filter((r, i) => r.D < rec.L[i].D).length;
  out.recall.crossoverL = nL; out.recall.crossoverR = nR;
  console.log("  crossover per seed: auditory worse after LEFT " + nL + "/" + SEEDS.length +
              " · visual worse after RIGHT " + nR + "/" + SEEDS.length);
  ok("LEFT resection costs AUDITORY material more than visual (P4)",
     (I.A - L.A) > (I.V - L.V), "Δauditory " + f(I.A - L.A, 2) + " > Δvisual " + f(I.V - L.V, 2));
  ok("RIGHT resection costs VISUAL material more than auditory",
     (I.V - R.V) > (I.A - R.A), "Δvisual " + f(I.V - R.V, 2) + " > Δauditory " + f(I.A - R.A, 2));
  ok("the crossover holds on a MODALITY axis, not an analogue one",
     L.A < R.A && R.V < L.V,
     "auditory " + f(L.A, 2) + "(L) vs " + f(R.A, 2) + "(R) · visual " + f(R.V, 2) + "(R) vs " + f(L.V, 2) + "(L)");

  /* Stated rather than left to pass quietly: the per-seed counts are NOT as strong as stage
     13's 6/6 and 6/6. The right-lesion arm is 3/3 but the left-lesion arm is 2/3, and with
     n = 3 that is one seed away from a coin flip. The project's own rule is that a mean
     difference with a minority of seeds agreeing is not a result; 2/3 is not a minority but
     it is underpowered, and the honest reading is that the MEANS are clear (Δ0.30 vs Δ0.08)
     while the per-seed evidence on that arm is thin. More seeds are needed before this
     crossover is claimed at the strength of stage 13's. */
  if (nL < SEEDS.length || nR < SEEDS.length) {
    console.log("  UNDERPOWERED: per-seed agreement is " + nL + "/" + SEEDS.length + " and " +
                nR + "/" + SEEDS.length + ", against 6/6 and 6/6 in stage 13. The means are");
    console.log("  clear but the per-seed evidence on the weaker arm is thin at n = " + SEEDS.length +
                ". This result is NOT yet at stage 13's strength and should not be quoted as if it were.");
  }
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "crossmodal.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
