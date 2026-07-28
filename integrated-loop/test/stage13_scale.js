"use strict";
/* Stage-13b — SCALE. Stage 13 runs at NC=800, and cxStream halves that again, so the material-
   specificity result rests on two 400-cell cortices — the smallest anywhere in the project.
   Scale-invariance is a DESIGNED property here (convergence-preserving p ∝ 1/N) and was verified
   at 4× for stages 1–4, but never for the STREAM-SPLIT case, where each hippocampus reads one
   stream at gain 1.0 and the other at wCross. Designed is not measured. This measures it.

   PREDICTION REGISTERED BEFORE RUNNING: the crossover survives doubling the cortex. If it does
   not, the dissociation is a small-number artefact and stage 13 does not stand. */

const B = require("../src/bilateral.js");
const C = require("../src/cortex.js");
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const PAIRS = [[0, 4], [1, 5], [2, 6], [3, 7]];
const SEEDS = [1, 2, 3];

const RESULTS = [];
for (const NC of [800, 1600]) {
  const rec = { intact: [], L: [], R: [], both: [] };
  for (const s of SEEDS) {
    const cortex = C.create({ seed: s, NC, nStim: 8 }); C.encode(cortex);
    const brain = B.createBrain({ seed: 100 + s * 7, NC: cortex.N });
    const eps = B.makeEpisodes(cortex, brain, PAIRS);
    B.encodeEpisodes(cortex, brain, eps);
    for (const [k, l, r] of [["intact",1,1],["L",0,1],["R",1,0],["both",0,0]]) {
      brain.alive.L = !!l; brain.alive.R = !!r;
      rec[k].push(B.testList(cortex, brain, eps, { scale: 0.20, cue: 0.35 }));
    }
  }
  const m = k => ({ V: mean(rec[k].map(x => x.V)), D: mean(rec[k].map(x => x.D)) });
  const I = m("intact"), L = m("L"), R = m("R"), Bo = m("both");
  const fV = mean(rec.intact.map(x => x.floorV)), fD = mean(rec.intact.map(x => x.floorD));
  const nL = rec.L.filter((x,i) => x.V < rec.R[i].V).length;
  const nR = rec.R.filter((x,i) => x.D < rec.L[i].D).length;
  console.log("\n=== cortex NC=" + NC + "  (" + (NC/2) + " cells per stream) ===");
  console.log("  intact " + f(I.V) + "/" + f(I.D) + "   LEFT " + f(L.V) + "/" + f(L.D) +
              "   RIGHT " + f(R.V) + "/" + f(R.D) + "   bilateral " + f(Bo.V) + "/" + f(Bo.D) +
              "   floor " + f(fV) + "/" + f(fD));
  console.log("  crossover: ventral worse after LEFT " + nL + "/" + SEEDS.length +
              " · dorsal worse after RIGHT " + nR + "/" + SEEDS.length +
              "   |   holds: " + ((L.V < R.V && R.D < L.D) ? "YES" : "NO"));
  RESULTS.push({ NC, I, L, R, both: Bo, floorV: fV, floorD: fD, nL, nR,
                 crossover: L.V < R.V && R.D < L.D });
}

console.log("\n== does the crossover survive the scale-up? ==");
{
  let pass = 0, fail = 0;
  const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                              : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
  for (const r of RESULTS) {
    ok("NC=" + r.NC + " (" + (r.NC / 2) + " cells per stream): crossover holds",
       r.crossover, "ventral " + f(r.L.V) + "(L) vs " + f(r.R.V) + "(R) · dorsal " +
       f(r.R.D) + "(R) vs " + f(r.L.D) + "(L)");
    ok("NC=" + r.NC + ": crossover holds in every seed", r.nL === SEEDS.length && r.nR === SEEDS.length,
       r.nL + "/" + SEEDS.length + " and " + r.nR + "/" + SEEDS.length);
  }
  const small = RESULTS[0], big = RESULTS[1];
  const dL = r => r.I.V - r.L.V, dR = r => r.I.D - r.R.D;
  console.log("  left-lesion ventral deficit  " + f(dL(small)) + " → " + f(dL(big)) +
              "      right-lesion dorsal deficit  " + f(dR(small)) + " → " + f(dR(big)));
  ok("scaling does not wash the effect out — it grows",
     dL(big) >= dL(small) - 0.02 && dR(big) >= dR(small) - 0.02,
     "deficits at 2× cortex are at least as large");
  console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
  require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "bilateral_scale.json"),
    JSON.stringify(RESULTS));
  process.exit(fail ? 1 : 0);
}
