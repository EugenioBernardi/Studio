"use strict";
/* Stage-37 — THE OUTPUT STAGE: hippocampal feedback is MODULATORY, not driving.
 *
 * Stage 36 localised the last failure precisely. With a healthy cortex the route encodes well
 * (dentate sharpens 0.301 → 0.152), retrieves the index reasonably (64.6%), and hippocampus.js
 * needs no retuning — but the loop still does not beat cortical recurrence alone at expressing
 * the memory: margin 0.039 against 0.122. What it cannot do is put a retrieved index back into
 * cortex better than the cortex manages by itself.
 *
 * THE BIOLOGICAL ERROR, and it predicts the exact symptom that was measured. Long-range feedback
 * — hippocampal EC-deep → neocortex, and cortico-cortical feedback in general — terminates on the
 * APICAL TUFTS of pyramidal cells in layer 1. Apical input is MODULATORY, not driving: on its own
 * it does not make a cell fire, it amplifies a cell that already has basal support. That is the
 * driver/modulator distinction (Sherman & Guillery), and the cellular mechanism is dendritic
 * coincidence detection between basal and apical compartments (Larkum, Zhu & Sakmann 1999;
 * Larkum 2013). The project already uses the same idea in the pulvinar gate,
 * J_eff = J_direct + δJ·λ(x).
 *
 * Stages 33 and 36 injected reinstatement as a SOMATIC DRIVING CURRENT. A driving input recruits
 * cells with no support for the retrieved memory exactly as readily as cells with it — so recall
 * and off-target must rise together, which is precisely what both stages measured. A
 * multiplicative apical term cannot behave that way: a cell with zero basal drive gets zero
 * benefit however strong the feedback.
 *
 * All numbers are scored over 8 independent cue draws per item per seed, the method fix stage 34
 * earned and stage 36 carried forward.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) Modulatory reinstatement raises the loop's completion margin above cortex alone, which
 *       driving reinstatement never managed at any drive strength (stage 33 swept 0.15 → 0.45 and
 *       the margin fell monotonically as recall rose).
 *   (2) THE MECHANISM, and it is sharper than the margin. The gain comes from OFF-TARGET FALLING,
 *       not from recall rising. If modulatory feedback mainly raises recall, I have the mechanism
 *       wrong even if the margin improves.
 *   (3) The two modes are not a strength difference. Sweeping the driving version to match the
 *       modulatory version's recall will still leave its off-target higher — a driving input
 *       cannot buy selectivity by being weaker, it just does less of everything.
 *   (4) Encoding and index retrieval are untouched: this changes only how a retrieved index is
 *       expressed, so index accuracy should be statistically unchanged. If it moves, the change
 *       has leaked somewhere it should not have.
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
const CUE = 0.25, NDRAW = 8;
const CORTEX = { dendOn: true, bcmFF: true, ffiTC_PV4: 1.5, ffiL4_PV23: 2.5 };
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
const fr = (g, A) => { const s = new Set(g); let c = 0; for (const x of A) if (s.has(x)) c++;
  return c / Math.max(1, A.length); };

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

/* mode: "drive" reproduces stages 33/36 exactly; "apical" makes the same reinstatement
   multiplicative on the basal drive, which is where layer-1 feedback actually acts. */
function runRoute(mode, gain, seed) {
  const S = K.create(Object.assign({ NCOL, nL23: NL23, nTC: V.NORI, nStim: ITEMS.length, seed },
                                   CORTEX, mode === "apical" ? { gApical: gain } : {}));
  const hpc = H.createHPC({ seed: seed + 2, NC: S.NL23 });
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
  const rnd = K.mulberry32(9000 + seed);
  let correct = 0, trials = 0;
  const cxR = [], cxO = [], hR = [], hO = [];
  for (let d = 0; d < NDRAW; d++) {
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
      if (bi === k) correct++;
      trials++;
      for (let t = 0; t < 40; t++) H.backwardStep(hpc);
      // normalise the reinstatement so "drive" and "apical" see the same signal, differing only
      // in HOW it acts — otherwise the comparison would be about amplitude
      let mx = 0;
      for (let i = 0; i < S.NL23; i++) if (hpc.ecReinstate[i] > mx) mx = hpc.ecReinstate[i];
      const rein = new Float64Array(S.NL23);
      if (mx > 0) for (let i = 0; i < S.NL23; i++) rein[i] = hpc.ecReinstate[i] / mx;
      K.reset(S);
      if (mode === "apical") { K.setExtL23(S, cue); K.setApical(S, rein); }
      else {
        const dr = new Float64Array(S.NL23);
        for (let i = 0; i < S.NL23; i++) dr[i] = gain * rein[i] * S.P.inDrive + cue[i];
        K.setExtL23(S, dr);
      }
      K.run(S, 0.35);
      const gH = K.activeSet(S); K.clearExt(S);
      let a = 0, b = 0;
      for (let j = 0; j < ITEMS.length; j++) {
        if (j === k) continue;
        a = Math.max(a, fr(gC, CA[j])); b = Math.max(b, fr(gH, CA[j]));
      }
      cxR.push(fr(gC, A)); cxO.push(a); hR.push(fr(gH, A)); hO.push(b);
    }
  }
  return { idxAcc: correct / trials,
           cxRecall: mean(cxR), cxOff: mean(cxO), cxMargin: mean(cxR) - mean(cxO),
           hRecall: mean(hR), hOff: mean(hO), hMargin: mean(hR) - mean(hO) };
}

/* ---------------- 1. driving vs modulatory ---------------- */
console.log("\n" + clock() + " == 1. the same reinstatement, delivered two ways ==");
const SEEDS = [1, 2, 3];
const res = { drive: [], apical: [] };
{
  console.log("  seed | mode      recall   off-target   MARGIN   (cortex alone: margin)  index");
  for (const s of SEEDS) {
    const d = runRoute("drive", 0.35, s), a = runRoute("apical", 1.2, s);
    res.drive.push(d); res.apical.push(a);
    console.log("  " + String(s).padStart(4) + " | driving   " + f(d.hRecall) + "    " +
                f(d.hOff) + "     " + f(d.hMargin) + "        " + f(d.cxMargin) + "          " +
                f(100 * d.idxAcc, 0) + "%");
    console.log("       | apical    " + f(a.hRecall) + "    " + f(a.hOff) + "     " +
                f(a.hMargin) + "        " + f(a.cxMargin) + "          " +
                f(100 * a.idxAcc, 0) + "%   " + clock());
  }
  out.res = res;
  const M = (k, fl) => mean(res[k].map(r => r[fl]));
  console.log("");
  console.log("  mean over " + SEEDS.length + " seeds:");
  console.log("    cortex alone        recall " + f(M("drive", "cxRecall")) + "   off " +
              f(M("drive", "cxOff")) + "   margin " + f(M("drive", "cxMargin")));
  console.log("    + driving feedback  recall " + f(M("drive", "hRecall")) + "   off " +
              f(M("drive", "hOff")) + "   margin " + f(M("drive", "hMargin")));
  console.log("    + apical feedback   recall " + f(M("apical", "hRecall")) + "   off " +
              f(M("apical", "hOff")) + "   margin " + f(M("apical", "hMargin")));

  ok("modulatory reinstatement beats cortex alone (P1)",
     M("apical", "hMargin") > M("apical", "cxMargin") + 0.02,
     "cortex alone " + f(M("apical", "cxMargin")) + " → apical loop " + f(M("apical", "hMargin")));
  const dOff = M("apical", "hOff") - M("drive", "hOff");
  const dRec = M("apical", "hRecall") - M("drive", "hRecall");
  ok("the gain comes from OFF-TARGET FALLING, not recall rising (P2)",
     dOff < -0.02 && Math.abs(dOff) > Math.abs(dRec),
     "off-target " + f(M("drive", "hOff")) + " → " + f(M("apical", "hOff")) + " (Δ " + f(dOff) +
     "), recall " + f(M("drive", "hRecall")) + " → " + f(M("apical", "hRecall")) + " (Δ " + f(dRec) + ")");
  ok("index retrieval is untouched — the change is only in expression (P4)",
     Math.abs(M("apical", "idxAcc") - M("drive", "idxAcc")) < 0.06,
     f(100 * M("drive", "idxAcc"), 1) + "% → " + f(100 * M("apical", "idxAcc"), 1) + "%");
}

/* ---------------- 2. is it just amplitude? ---------------- */
console.log("\n" + clock() + " == 2. can a WEAKER driving input buy the same selectivity? (P3) ==");
{
  const rows = [];
  console.log("  driving gain   recall   off-target   margin");
  for (const g of [0.15, 0.25, 0.35, 0.50]) {
    const r = runRoute("drive", g, 1);
    rows.push({ g, ...r });
    console.log("     " + f(g, 2) + "        " + f(r.hRecall) + "    " + f(r.hOff) + "     " +
                f(r.hMargin) + "   " + clock());
  }
  const ap = res.apical[0];
  console.log("     apical      " + f(ap.hRecall) + "    " + f(ap.hOff) + "     " + f(ap.hMargin));
  out.driveSweep = rows;
  // find the driving setting whose recall is closest to the apical one, and compare off-target
  let best = rows[0];
  for (const r of rows) if (Math.abs(r.hRecall - ap.hRecall) < Math.abs(best.hRecall - ap.hRecall)) best = r;
  ok("at matched recall, driving feedback is still less selective (P3)",
     best.hOff > ap.hOff + 0.02,
     "at driving gain " + f(best.g, 2) + " recall matches (" + f(best.hRecall) + " vs " +
     f(ap.hRecall) + ") but off-target is " + f(best.hOff) + " against " + f(ap.hOff) +
     " — a driving input cannot buy selectivity by being weaker, it just does less of everything");
}

console.log("\n" + clock() + " == what this settles ==");
{
  const M = (k, fl) => mean(res[k].map(r => r[fl]));
  if (M("apical", "hMargin") > M("apical", "cxMargin") + 0.02) {
    console.log("  THE ROUTE PAYS. Every stage of it is a real circuit and none of it is an");
    console.log("  abstract vector: image → retina → LGN → V1 simple → V1 complex → thalamic");
    console.log("  relay sectors → L4 → L2/3 (dendritic subunits, afferent BCM, feedforward");
    console.log("  inhibition) → EC II/III → dentate → CA3 → CA1 → subiculum → EC deep → back to");
    console.log("  cortical LAYER 1, where it modulates rather than drives.");
    console.log("");
    console.log("  And hippocampus.js was never retuned — not one parameter changed from");
    console.log("  hdefaults() across stages 33 to 37. OVERVIEW §8.4 warned that this");
    console.log("  hippocampus was content-agnostic BY CONSTRUCTION because it only ever saw an");
    console.log("  abstract sparse vector. It has now indexed a code produced by a real sensory");
    console.log("  hierarchy, as shipped.");
  } else {
    console.log("  STILL NOT PAYING. Modulatory feedback did not rescue the output stage either,");
    console.log("  and with encoding, index retrieval and now the delivery mode all addressed,");
    console.log("  the remaining suspect is the EC-deep → cortex MAPPING itself — bound by a");
    console.log("  one-shot Hebbian outer product, which may simply not be selective enough to");
    console.log("  address a cortical code this correlated. That is the next thing to examine.");
  }
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "apical.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
