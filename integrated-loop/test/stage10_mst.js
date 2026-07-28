"use strict";
/* Stage-10 — the MNEMONIC SIMILARITY TASK (Stark, Yassa & colleagues), run on the model.

   This is the field's own instrument for pattern separation in humans, and it is scored the
   way the field scores it, so the numbers are directly comparable to published data rather
   than being bespoke to this model.

   Protocol: study a list. At test, each probe is a TARGET (studied), a LURE (similar but not
   studied), or a FOIL (unrelated). The subject answers Old / Similar / New.

     LDI  (lure discrimination index) = p(Similar | Lure) − p(Similar | Foil)
     REC  (recognition)               = p(Old | Target)   − p(Old | Foil)

   The point of the pair is that they DISSOCIATE. In healthy young adults LDI is high; in
   ageing, MCI and early Alzheimer's LDI falls while REC is largely preserved (Stark et al.
   2013; Yassa & Stark 2011) — the deficit is separation, not recognition.

   PREDICTION REGISTERED BEFORE RUNNING:
     (1) dentate disinhibition lowers LDI while leaving REC roughly intact — the ageing/MCI
         signature, because lures collapse onto stored indices;
     (2) entorhinal layer-II loss lowers BOTH, because it degrades the input to the whole
         hippocampal code rather than just separation;
     (3) the decision criterion is fixed once on the intact model and never re-tuned, so any
         change is the circuit's, not the readout's.

   KNOWN LIMIT — read the absolute numbers with care. Intact LDI here is ~0.89 against ~0.3–0.5
   in healthy young adults, and REC saturates at 1.00 / 0.00. The cause is the stimuli: random
   sparse patterns have no perceptual confusability structure, so a 60%-preserved "lure" is far
   easier than two photographs of similar objects. The PATTERN (LDI falls while REC is spared)
   is what is comparable to human data; the absolute values are not. Driving the task from the
   MNIST front-end — two different 3s as a lure pair, a 3 vs an 8 as a foil — would supply real
   perceptual similarity and should bring the values into the human range. */

const L = require("../src/loop.js");
const { C, H } = L;

let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

const STUDY = [0, 1, 2, 3, 4, 5];      // studied items
const NB = 40;                          // bins for the criterion search

/* A LURE: keep `sim` of the studied item's feedforward pattern, resample the rest.
   This is the model's equivalent of the MST's perceptually similar object images. */
function lureOf(cortex, sIdx, sim, rnd) {
  const src = cortex.stim[sIdx], v = new Float64Array(cortex.N);
  for (let i = 0; i < cortex.N; i++) {
    if (src[i] > 0 && rnd() < sim) v[i] = src[i];
  }
  // replace the dropped mass with fresh, unrelated input so total drive is comparable
  let dropped = 0; for (let i = 0; i < cortex.N; i++) if (src[i] > 0 && v[i] === 0) dropped++;
  let placed = 0;
  while (placed < dropped) { const j = Math.floor(rnd() * cortex.N);
    if (v[j] === 0) { v[j] = cortex.P.inDrive * (0.7 + 0.6 * rnd()); placed++; } }
  return v;
}
function foilOf(cortex, rnd) {
  const v = new Float64Array(cortex.N);
  for (let i = 0; i < cortex.N; i++) if (rnd() < cortex.P.pIn) v[i] = cortex.P.inDrive * (0.7 + 0.6 * rnd());
  return v;
}

/* present an arbitrary cortical drive vector and read how well CA3 matches any stored index */
function matchScore(cortex, hpc, drive) {
  cortex.a.fill(0); cortex.inh = 0;
  C.setExt(cortex, drive); C.run(cortex, 0.35);
  L.settleForward(hpc, cortex.a, 80);
  C.clearExt(cortex);
  const got = new Set(H.activeSet(hpc.ca3, hpc.P.actThr));
  let best = 0;
  for (const idx of hpc.indices) {
    let ov = 0; for (const c of idx.cells) if (got.has(c)) ov++;
    best = Math.max(best, ov / Math.max(1, idx.cells.length));
  }
  return best;
}

function runSubject(seed, hopts, ecLesion) {
  const cortex = C.create({ seed, NC: 800, nStim: 8 }); C.encode(cortex);
  const hpc = H.createHPC(Object.assign({ seed: 100 + seed * 7, NC: cortex.N }, hopts));
  hpc.plastic = true;
  L.encodeSequence(cortex, hpc, STUDY);
  if (ecLesion) H.lesionField(hpc, "ec2", ecLesion, 4242);
  const rnd = H.mulberry32(seed * 977 + 13);
  const targets = STUDY.map(s => matchScore(cortex, hpc, cortex.stim[s]));
  const lures = STUDY.map(s => matchScore(cortex, hpc, lureOf(cortex, s, 0.6, rnd)));
  const foils = STUDY.map(() => matchScore(cortex, hpc, foilOf(cortex, rnd)));
  return { targets, lures, foils };
}

/* Old / Similar / New from a match score, using two fixed criteria */
const respond = (m, lo, hi) => (m > hi ? "O" : m > lo ? "S" : "N");
function score(sub, lo, hi) {
  const p = (arr, r) => arr.filter(m => respond(m, lo, hi) === r).length / arr.length;
  return {
    LDI: p(sub.lures, "S") - p(sub.foils, "S"),
    REC: p(sub.targets, "O") - p(sub.foils, "O"),
  };
}

const SEEDS = [1, 2, 3];

console.log("\n== calibration: criteria set ONCE on the intact model, then frozen ==");
const intact = SEEDS.map(s => runSubject(s, {}, 0));
let bestLo = 0, bestHi = 0, bestLDI = -Infinity;
{
  const all = intact.flatMap(s => [...s.targets, ...s.lures, ...s.foils]);
  const mx = Math.max(...all) || 1;
  for (let i = 1; i < NB; i++) for (let j = i + 1; j < NB; j++) {
    const lo = mx * i / NB, hi = mx * j / NB;
    const sc = intact.map(s => score(s, lo, hi));
    const ldi = mean(sc.map(x => x.LDI)), rec = mean(sc.map(x => x.REC));
    if (rec >= 0.6 && ldi > bestLDI) { bestLDI = ldi; bestLo = lo; bestHi = hi; }
  }
  console.log("  criteria: similar > " + f(bestLo, 3) + ", old > " + f(bestHi, 3) +
              "   (chosen to maximise intact LDI subject to REC ≥ 0.60; never re-tuned below)");
}
const scoreAll = subs => { const sc = subs.map(s => score(s, bestLo, bestHi));
  return { LDI: mean(sc.map(x => x.LDI)), REC: mean(sc.map(x => x.REC)) }; };

console.log("\n== MST scores by condition ==");
const conditions = [
  ["intact", {}, 0],
  ["DG disinhibited ×0.5", { gDG: 377.0 * 0.5 }, 0],
  ["DG disinhibited ×0.25", { gDG: 377.0 * 0.25 }, 0],
  ["EC-II loss 60%", {}, 0.6],
  ["EC-II loss 90%", {}, 0.9],
];
const results = {};
for (const [name, hopts, ec] of conditions) {
  const subs = name === "intact" ? intact : SEEDS.map(s => runSubject(s, hopts, ec));
  const r = scoreAll(subs); results[name] = r;
  console.log("  " + name.padEnd(24) + "LDI " + f(r.LDI) + "   REC " + f(r.REC));
}

console.log("\n== the dissociation the task exists to detect ==");
const I = results["intact"], D = results["DG disinhibited ×0.25"], E = results["EC-II loss 90%"];
ok("intact model shows lure discrimination (LDI > 0.2)", I.LDI > 0.2, "= " + f(I.LDI));
ok("intact model recognises studied items (REC ≥ 0.6)", I.REC >= 0.6, "= " + f(I.REC));
ok("dentate disinhibition LOWERS LDI", D.LDI < I.LDI - 0.1, f(I.LDI) + " → " + f(D.LDI));
ok("…while recognition is comparatively SPARED (the ageing/MCI signature)",
   (I.REC - D.REC) < (I.LDI - D.LDI), "ΔREC " + f(I.REC - D.REC) + " < ΔLDI " + f(I.LDI - D.LDI));
ok("entorhinal loss degrades the code more broadly than dentate disinhibition",
   (I.REC - E.REC) >= (I.REC - D.REC), "ΔREC: EC " + f(I.REC - E.REC) + " vs DG " + f(I.REC - D.REC));

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "mst.json"),
  JSON.stringify({ results, criteria: { lo: bestLo, hi: bestHi }, seeds: SEEDS.length }));
process.exit(fail ? 1 : 0);
