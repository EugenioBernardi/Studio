"use strict";
/* Stage-34 — FIXING RETRIEVAL BY BIOLOGY: the acetylcholine-gated mossy fibre.
 *
 * Stage 33 built the route and it half worked. Encoding was fine — six correlated real-image
 * memories gave CA3 indices overlapping 0.119, sharpened from a cortical overlap of 0.250, with
 * hippocampus.js unchanged. Retrieval was not: from a 25% cortical cue, CA3 recovered the
 * correct index in 2 of 6 items, and the loop added activation without adding discrimination.
 *
 * The diagnosis was TWO PATTERN SEPARATORS IN SERIES. Stage 32 gave the cortical front end
 * dendritic nonlinearity and BCM precisely so it would separate; the dentate then separates
 * again, so a degraded cue is pushed further from its stored pattern rather than tolerated.
 *
 * THE BIOLOGY. The mossy fibre is a DETONATOR: it forces a new, well-separated pattern into CA3,
 * which is exactly what encoding needs and exactly what retrieval must not have. The lesion data
 * say so directly — mossy-fibre disruption impairs ACQUISITION while sparing RETRIEVAL (Treves &
 * Rolls 1992; Lassalle, Bataille & Halley 2000; Lee & Kesner 2004) — and acetylcholine is the
 * switch: high during encoding, low during retrieval, when the direct EC layer II → CA3
 * perforant path should carry the cue and the recurrent collaterals should complete it
 * (Hasselmo). In stage 33 the mossy path ran at FIXED gain in both modes, so the detonator was
 * still firing during recall.
 *
 * `hippocampus.js` now gates it: mfGate = (1 − achMF) + achMF·ACh. At encoding (ACh = 1) the gate
 * is 1 whatever achMF is, so every earlier stage is untouched — stage 2 (9/9) and stage 3 (7/7)
 * verified unchanged. Only retrieval changes, and only when achMF > 0.
 *
 * DISCLOSURE. §1's sweep over achMF and the conditional analysis in §3 were run BEFORE this file
 * was written, so they are exploratory and reported as discovery. §2 is the honest follow-up:
 * held-out seeds that played no part in choosing the gate.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING §2:
 *   (1) On held-out seeds, gating the mossy fibre improves CA3 index retrieval from a partial
 *       cortical cue. This is the mechanism claim and it is the one that matters.
 *   (2) A PREDICTION OF PARTIAL SUCCESS, stated because the exploratory run already showed the
 *       fix is not complete. Index retrieval will improve but will NOT reach ceiling, because
 *       the cue reaching entorhinal cortex has already been degraded by the cortical separator
 *       upstream — gating the dentate cannot undo that. If index retrieval reaches 6/6 I have
 *       misdiagnosed and should say so.
 *   (3) Conditional on the index being CORRECT, the hippocampal loop beats cortex alone; when
 *       the index is WRONG it is far worse. If so, the residual failure is entirely index
 *       retrieval, and the completion machinery downstream is sound.
 *
 * ============================================================================================
 * OUTCOME: P1 IS REFUTED. THE FIX DOES NOT WORK, AND THE NEAR-MISS IS THE MOST USEFUL THING HERE.
 *
 * The exploratory run said 2/6 → 4/6 in favour of the gate. On held-out seeds and cue draws it
 * goes the OTHER WAY: 10/18 → 5/18. The first number was one draw of a measure that is far
 * noisier than it looks — six items scored on a single random cue — and re-running the sweep
 * with a different draw does not reproduce it either.
 *
 * The mechanism was well motivated. Mossy-fibre lesions really do impair acquisition and spare
 * retrieval; acetylcholine really is the encode/retrieve switch. Being well motivated is not
 * evidence, and this project exists because a +10% effect at 50 trials became +1.8% ± 6.4 at
 * 110. The held-out test is the only reason this is a negative result rather than a shipped one.
 *
 * `achMF` stays in hippocampus.js at 0, documented as tested and NOT supported, so the
 * hypothesis is recorded and re-testable rather than quietly deleted.
 * ============================================================================================
 */

const V = require("../src/vision.js");
const K = require("../src/column.js");
const H = require("../src/hippocampus.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null || Number.isNaN(x) ? "  n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SIDE = 5, NCOL = SIDE * SIDE, PATCH = V.NC / SIDE, NL23 = 64;
const BIO = { dendOn: true, bcmOn: true };
const CUE = 0.25, DRIVE = 0.25;
const ITEMS = [];
for (const kind of V.DEC) for (const size of [0.45, 0.62]) ITEMS.push({ kind, size });

function tcVector(kind, opt) {
  const p = V.pipeline(kind, Object.assign({ size: 0.52, rot: 0, cx: 0, cy: 0 }, opt || {}));
  const vec = new Float64Array(NCOL * V.NORI);
  for (let cy = 0; cy < SIDE; cy++) for (let cx = 0; cx < SIDE; cx++) {
    const col = cy * SIDE + cx;
    for (let o = 0; o < V.NORI; o++) {
      let s = 0;
      for (let y = 0; y < PATCH; y++) for (let x = 0; x < PATCH; x++)
        s += p.C[o][(cy * PATCH + y) * V.NC + (cx * PATCH + x)];
      vec[col * V.NORI + o] = s / (PATCH * PATCH);
    }
  }
  let mx = 0; for (let i = 0; i < vec.length; i++) if (vec[i] > mx) mx = vec[i];
  if (mx > 0) for (let i = 0; i < vec.length; i++) vec[i] = 1.6 * vec[i] / mx;
  return vec;
}
const jac = (a, b) => { const sb = new Set(b); let c = 0; for (const x of a) if (sb.has(x)) c++;
  return c / Math.max(1, Math.min(a.length, b.length)); };
const frac = (got, A) => { const g = new Set(got); let c = 0; for (const x of A) if (g.has(x)) c++;
  return c / Math.max(1, A.length); };

/* binding helpers, verbatim from loop.js (see stage 33's note on why they are copied) */
function bindDense(proj, postArr, preArr, thr, lr, wMax, budget) {
  const pre = [];
  for (let j = 0; j < preArr.length; j++) if (preArr[j] > thr) pre.push(j);
  for (let i = 0; i < postArr.length; i++) {
    if (postArr[i] < thr) continue;
    const w = proj.wt[i];
    for (const j of pre) w[j] = Math.min(wMax, w[j] + lr * postArr[i] * preArr[j]);
    H.normSparse(w, budget);
  }
}
function bindCA3sym(h, thr) {
  const P = h.P, ca3 = h.ca3, R = h.Rca3;
  for (let i = 0; i < ca3.length; i++) {
    if (ca3[i] < thr) continue;
    const id = R.idx[i], w = R.wt[i]; let t = false;
    for (let k = 0; k < id.length; k++) {
      const aj = ca3[id[k]];
      if (aj > thr) { w[k] = Math.min(P.wRecMax3, w[k] + P.lrRec3 * ca3[i] * aj); t = true; }
    }
    if (t) H.normSparse(w, P.wBudget3);
  }
}

/* one full run: build cortex, encode through the hippocampus, retrieve from a partial cue */
function run(achMF, seed) {
  const S = K.create(Object.assign({ NCOL, nL23: NL23, nTC: V.NORI, nStim: ITEMS.length, seed }, BIO));
  const hpc = H.createHPC({ seed: seed + 2, NC: S.NL23 });
  hpc.P.achMF = achMF;
  for (let r = 0; r < 4; r++) for (const it of ITEMS) {
    K.reset(S); K.setExt(S, tcVector(it.kind, { size: it.size }));
    S.plastic = true; K.run(S, 0.35); S.plastic = false;
    K.clearExt(S); K.run(S, 0.12);
  }
  const CA = ITEMS.map(it => {
    K.reset(S); K.setExt(S, tcVector(it.kind, { size: it.size })); K.run(S, 0.35);
    const a = K.activeSet(S); K.clearExt(S); return a;
  });
  const thr = hpc.P.actThr;
  hpc.P.ach = 1.0;
  const IX = [];
  for (let k = 0; k < ITEMS.length; k++) {
    K.reset(S); K.setExt(S, tcVector(ITEMS[k].kind, { size: ITEMS[k].size })); K.run(S, 0.35);
    for (let t = 0; t < 80; t++) H.forwardStep(hpc, S.a);
    const ic = H.activeSet(hpc.ca3, thr);
    const sv = Float64Array.from(hpc.ca3);
    hpc.ca3.fill(0); for (const c of ic) hpc.ca3[c] = 1.0;
    hpc.ca1.fill(0); hpc.sub.fill(0); hpc.ecd.fill(0);
    hpc.iCA1 = hpc.iSUB = hpc.iECd = 0;
    for (let t = 0; t < 40; t++) H.backwardStep(hpc);
    bindDense(hpc.Wec, S.a, hpc.ecd, thr, hpc.P.lrBind, hpc.P.wBindMax, hpc.P.wBudgetBind);
    hpc.ca3.set(sv); bindCA3sym(hpc, thr);
    IX.push(ic); K.clearExt(S);
  }
  hpc.P.ach = 0.0;
  const rnd = K.mulberry32(4242 + seed);
  let correct = 0;
  const okR = [], okO = [], badR = [], badO = [], cxR = [], cxO = [], hR = [], hO = [];
  for (let k = 0; k < ITEMS.length; k++) {
    const A = CA[k], cue = new Float64Array(S.NL23);
    for (const i of A) if (rnd() < CUE) cue[i] = S.P.inDrive;
    K.reset(S); K.setExtL23(S, cue); K.run(S, 0.35);
    const gC = K.activeSet(S); K.clearExt(S);
    K.reset(S); K.setExtL23(S, cue); K.run(S, 0.35);
    for (let t = 0; t < 80; t++) H.forwardStep(hpc, S.a);
    const g3 = H.activeSet(hpc.ca3, thr);
    const ov = IX.map(x => jac(g3, x));
    let bi = 0, bv = 0;
    for (let j = 0; j < ov.length; j++) if (ov[j] > bv) { bv = ov[j]; bi = j; }
    for (let t = 0; t < 40; t++) H.backwardStep(hpc);
    const dr = new Float64Array(S.NL23);
    for (let i = 0; i < S.NL23; i++) dr[i] = DRIVE * hpc.ecReinstate[i] + cue[i];
    K.reset(S); K.setExtL23(S, dr); K.run(S, 0.35);
    const gH = K.activeSet(S); K.clearExt(S);
    let a = 0, b = 0;
    for (let j = 0; j < ITEMS.length; j++) {
      if (j === k) continue;
      a = Math.max(a, frac(gC, CA[j])); b = Math.max(b, frac(gH, CA[j]));
    }
    cxR.push(frac(gC, A)); cxO.push(a); hR.push(frac(gH, A)); hO.push(b);
    if (bi === k) { correct++; okR.push(frac(gH, A)); okO.push(b); }
    else { badR.push(frac(gH, A)); badO.push(b); }
  }
  return { correct, n: ITEMS.length,
           cxMargin: mean(cxR) - mean(cxO), hMargin: mean(hR) - mean(hO),
           okMargin: mean(okR) - mean(okO), badMargin: mean(badR) - mean(badO),
           nOK: okR.length, nBad: badR.length };
}

/* ---------------- 1. the sweep (EXPLORATORY) ---------------- */
console.log("\n" + clock() + " == 1. gating the detonator — EXPLORATORY, seed 1 ==");
{
  const rows = [];
  console.log("  achMF   index retrieved   cortex margin   loop margin");
  for (const a of [0, 0.5, 0.8, 0.95]) {
    const r = run(a, 1);
    rows.push({ achMF: a, ...r });
    console.log("   " + f(a, 2) + "        " + r.correct + "/" + r.n + "            " +
                f(r.cxMargin) + "        " + f(r.hMargin) + "   " + clock());
  }
  out.sweep = rows;
  console.log("");
  console.log("  READ §2 BEFORE BELIEVING ANY OF THIS. An earlier ad-hoc run of exactly this");
  console.log("  comparison, differing only in the random draw used to build the partial cue,");
  console.log("  reported 2/6 → 4/6 in favour of the gate. The sweep above, one cue draw later,");
  console.log("  does not reproduce it. Six items scored on a single cue draw is a far noisier");
  console.log("  measure than it looks, and I should not have trusted the first number.");
}

/* ---------------- 2. held-out seeds (REGISTERED) ---------------- */
console.log("\n" + clock() + " == 2. held-out seeds: does the gate replicate? (P1, P2) ==");
{
  const SEEDS = [21, 22, 23];
  const rows = [];
  console.log("  seed |  index retrieved: gate OFF   gate ON");
  for (const s of SEEDS) {
    const off = run(0, s), on = run(0.8, s);
    rows.push({ seed: s, off, on });
    console.log("  " + String(s).padStart(4) + " |          " + off.correct + "/" + off.n +
                "               " + on.correct + "/" + on.n + "     " + clock());
  }
  out.heldOut = rows;
  const offTot = rows.reduce((a, r) => a + r.off.correct, 0);
  const onTot = rows.reduce((a, r) => a + r.on.correct, 0);
  const total = rows.length * ITEMS.length;
  ok("gating the mossy fibre improves index retrieval on held-out seeds (P1)", onTot > offTot,
     offTot + "/" + total + " → " + onTot + "/" + total + " indices recovered — the gate makes " +
     "retrieval WORSE, and P1 is refuted");
  ok("…but does NOT reach ceiling, as predicted (P2)", onTot < total,
     onTot + "/" + total + " recovered");
  console.log("");
  console.log("  P1 IS REFUTED, AND THE NEAR-MISS IS THE POINT. The mechanism is well motivated:");
  console.log("  the mossy fibre is a detonator, its lesion impairs acquisition and spares");
  console.log("  retrieval, and acetylcholine is the switch. The exploratory run agreed, 2/6 →");
  console.log("  4/6. On seeds and cue draws that played no part in choosing the gate it goes the");
  console.log("  OTHER WAY, " + offTot + "/" + total + " → " + onTot + "/" + total + ". The first result was one draw of a noisy");
  console.log("  measure, and this project exists because a +10% effect at 50 trials became");
  console.log("  +1.8% ± 6.4 at 110. The held-out test caught it; the exploratory number would");
  console.log("  have been shipped as a biological fix.");
  console.log("");
  console.log("  achMF stays in hippocampus.js, DEFAULTED TO 0 and documented as tested and NOT");
  console.log("  supported, so the hypothesis is recorded and re-testable rather than deleted.");
}

/* ---------------- 3. conditional on the index (EXPLORATORY, disclosed) ---------------- */
console.log("\n" + clock() + " == 3. is the residual failure ONLY index retrieval? (P3) ==");
{
  const r = run(0.8, 1);
  out.conditional = r;
  console.log("  cortex alone                     margin " + f(r.cxMargin));
  console.log("  loop, index CORRECT (" + r.nOK + " items)      margin " + f(r.okMargin));
  console.log("  loop, index WRONG   (" + r.nBad + " items)      margin " + f(r.badMargin));
  const enough = r.nOK >= 3;
  ok("with the right index the loop beats cortex alone (P3)", enough && r.okMargin > r.cxMargin,
     enough ? f(r.cxMargin) + " → " + f(r.okMargin)
     : "NOT ASSESSABLE — only " + r.nOK + " item(s) retrieved the right index in this run, and a " +
       "margin computed over " + r.nOK + " item(s) is not a measurement. Reported as unassessable " +
       "rather than as the encouraging number it happens to be");
  ok("…and the wrong-index items are what drag the mean down",
     enough && r.badMargin < r.cxMargin - 0.03,
     enough ? "wrong-index margin " + f(r.badMargin) + " against " + f(r.cxMargin)
     : "not assessable for the same reason");
  console.log("");
  console.log("  WHERE THIS LEAVES THE ROUTE. Stage 33's finding stands and is unaffected by");
  console.log("  this stage's failure: encoding works on a real, correlated cortical code, the");
  console.log("  dentate sharpens it (0.250 → 0.119), and hippocampus.js needed no retuning.");
  console.log("  What does not work is retrieval from a degraded cortical cue, and the mossy");
  console.log("  gate is now a tested and REJECTED explanation rather than an untested one.");
  console.log("");
  console.log("  THE DIAGNOSIS THAT SURVIVES is the one stage 33 measured directly: the cue that");
  console.log("  reaches entorhinal cortex has already passed through a cortex tuned to SEPARATE,");
  console.log("  so it arrives further from the stored pattern than a raw sensory cue would. That");
  console.log("  is upstream of anything the hippocampus can gate, which is consistent with");
  console.log("  gating the dentate not helping.");
  console.log("");
  console.log("  WHAT TO TRY NEXT, and it is structural rather than a parameter. In the real");
  console.log("  circuit superficial entorhinal cortex receives from perirhinal and");
  console.log("  parahippocampal cortex directly, not only from the deepest association stage, so");
  console.log("  the cue can reach the hippocampus by a route that has NOT been separated. That");
  console.log("  bypass is the next experiment.");
  console.log("");
  console.log("  AND A METHOD FIX THIS STAGE EARNED: score retrieval over MANY cue draws, not");
  console.log("  one. Six items × one draw is what let a noise result look like a mechanism.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "mossy_gate.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
