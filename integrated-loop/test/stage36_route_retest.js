"use strict";
/* Stage-36 — THE ROUTE RE-TESTED WITH A CORTEX THAT CAN COMPLETE.
 *
 * Stage 33 built association cortex → entorhinal cortex → hippocampus and it half worked:
 * encoding fine (CA3 indices overlapping 0.119, sharpened from a cortical 0.250, hippocampus.js
 * unchanged), retrieval broken (2/6 indices recovered from a partial cue). The diagnosis was that
 * the cue reaching entorhinal cortex had already been degraded by a cortex tuned to separate.
 *
 * Two things have happened since, and they change what that diagnosis meant.
 *   • Stage 34 tested the first proposed fix — acetylcholine gating the mossy-fibre detonator —
 *     and REFUTED it on held-out seeds, 10/18 → 5/18. Good motivation, no effect.
 *   • Stage 35 found the real cause upstream of both: BCM had been placed on the RECURRENT
 *     collaterals, where it depresses exactly the synapses completion runs on. Moved to the
 *     AFFERENT synapses where Bienenstock, Cooper and Munro put it, the cortex separates just as
 *     well AND completes better than the original — completion margin 0.055 → 0.351 over four
 *     held-out seeds. Stage 32's trade-off was withdrawn.
 *
 * So stage 33's retrieval failure was measured on a cortex crippled by a misplaced learning rule.
 * This stage re-runs it, unchanged in every other respect, on the corrected cortex.
 *
 * METHOD FIX CARRIED FORWARD. Every retrieval number here is scored over 8 independent cue draws
 * per item per seed. Stage 34's near-miss — a noise result that looked like a mechanism — came
 * from trusting six items on a single draw.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) Index retrieval improves substantially over stage 33's 2/6. A cortex that completes hands
 *       entorhinal cortex a cue much closer to the encoded pattern, which is precisely what the
 *       surviving diagnosis said was missing.
 *   (2) THE ONE THAT MATTERS. The hippocampal loop now beats cortex alone on completion margin.
 *       In stage 33 it did not — it added activation and off-target equally. If it still does
 *       not, the route adds nothing even with a healthy front end, and that is a real verdict on
 *       the architecture rather than on the learning rule.
 *   (3) Encoding is preserved: CA3 indices stay distinct and the dentate still sharpens the
 *       cortical code. Nothing in stage 35's correction should have touched this, and if it has,
 *       something is wrong that I have not understood.
 *   (4) hippocampus.js remains unretuned — still not one parameter changed from hdefaults().
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
const CUE = 0.25, DRIVE = 0.25, NDRAW = 8;
/* stage 35's corrected cortex: dendritic subunits, BCM on the AFFERENT pathway, feedforward
   inhibition. The recurrent collaterals stay Hebbian, which is what lets them complete. */
const CORTEX_FIXED = { dendOn: true, bcmFF: true, ffiTC_PV4: 1.5, ffiL4_PV23: 2.5 };
const CORTEX_STAGE33 = { dendOn: true, bcmOn: true };
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

/* verbatim from loop.js */
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

function runRoute(cortexOpts, seed) {
  const S = K.create(Object.assign({ NCOL, nL23: NL23, nTC: V.NORI, nStim: ITEMS.length, seed }, cortexOpts));
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
  let cxOv = 0, m = 0;
  for (let i = 0; i < CA.length; i++) for (let j = i + 1; j < CA.length; j++) { cxOv += jac(CA[i], CA[j]); m++; }
  cxOv /= m;
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
  let ixOv = 0; m = 0;
  for (let i = 0; i < IX.length; i++) for (let j = i + 1; j < IX.length; j++) { ixOv += jac(IX[i], IX[j]); m++; }
  ixOv /= m;

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
      const dr = new Float64Array(S.NL23);
      for (let i = 0; i < S.NL23; i++) dr[i] = DRIVE * hpc.ecReinstate[i] + cue[i];
      K.reset(S); K.setExtL23(S, dr); K.run(S, 0.35);
      const gH = K.activeSet(S); K.clearExt(S);
      let a = 0, b = 0;
      for (let j = 0; j < ITEMS.length; j++) {
        if (j === k) continue;
        a = Math.max(a, fr(gC, CA[j])); b = Math.max(b, fr(gH, CA[j]));
      }
      cxR.push(fr(gC, A)); cxO.push(a); hR.push(fr(gH, A)); hO.push(b);
    }
  }
  return { cxOv, ixOv, idxAcc: correct / trials, trials,
           cxRecall: mean(cxR), cxMargin: mean(cxR) - mean(cxO),
           hRecall: mean(hR), hMargin: mean(hR) - mean(hO),
           retuned: Object.keys(H.hdefaults()).filter(k =>
             JSON.stringify(hpc.P[k]) !== JSON.stringify(H.hdefaults()[k]) &&
             k !== "ach" && k !== "seed" && k !== "NC") };
}

/* ---------------- run both cortices, three seeds ---------------- */
console.log("\n" + clock() + " == the route, stage-33 cortex vs stage-35 corrected cortex ==");
console.log("  every number below is scored over " + NDRAW + " independent cue draws per item\n");
const SEEDS = [1, 2, 3];
const res = { old: [], fixed: [] };
{
  console.log("  seed | cortex   index acc | cortex margin  loop margin | cx overlap → index overlap");
  for (const s of SEEDS) {
    const o = runRoute(CORTEX_STAGE33, s), n = runRoute(CORTEX_FIXED, s);
    res.old.push(o); res.fixed.push(n);
    console.log("  " + String(s).padStart(4) + " | st.33     " + f(100 * o.idxAcc, 0).padStart(4) +
                "%  |     " + f(o.cxMargin) + "       " + f(o.hMargin) + "  |   " +
                f(o.cxOv) + " → " + f(o.ixOv));
    console.log("       | st.35     " + f(100 * n.idxAcc, 0).padStart(4) +
                "%  |     " + f(n.cxMargin) + "       " + f(n.hMargin) + "  |   " +
                f(n.cxOv) + " → " + f(n.ixOv) + "   " + clock());
  }
  out.res = res;
  const M = (k, fl) => mean(res[k].map(r => r[fl]));
  console.log("");
  console.log("  mean over " + SEEDS.length + " seeds, " + res.fixed[0].trials + " retrieval trials each:");
  console.log("    stage-33 cortex : index " + f(100 * M("old", "idxAcc"), 1) + "%   cortex margin " +
              f(M("old", "cxMargin")) + "   loop margin " + f(M("old", "hMargin")));
  console.log("    stage-35 cortex : index " + f(100 * M("fixed", "idxAcc"), 1) + "%   cortex margin " +
              f(M("fixed", "cxMargin")) + "   loop margin " + f(M("fixed", "hMargin")));

  ok("index retrieval improves with a cortex that can complete (P1)",
     M("fixed", "idxAcc") > M("old", "idxAcc") + 0.05,
     f(100 * M("old", "idxAcc"), 1) + "% → " + f(100 * M("fixed", "idxAcc"), 1) + "%");
  ok("THE ONE THAT MATTERS: the loop now beats cortex alone (P2)",
     M("fixed", "hMargin") > M("fixed", "cxMargin") + 0.02,
     "cortex alone " + f(M("fixed", "cxMargin")) + " → with the hippocampus " +
     f(M("fixed", "hMargin")));
  ok("encoding is preserved — the dentate still sharpens the cortical code (P3)",
     res.fixed.every(r => r.ixOv < r.cxOv) && M("fixed", "ixOv") < 0.25,
     "cortex " + f(M("fixed", "cxOv")) + " → CA3 " + f(M("fixed", "ixOv")));
  ok("hippocampus.js is still unretuned (P4)", res.fixed.every(r => r.retuned.length === 0),
     "no parameter differs from hdefaults()");
}

console.log("\n" + clock() + " == what the route is worth ==");
{
  const M = (k, fl) => mean(res[k].map(r => r[fl]));
  const gained = M("fixed", "hMargin") - M("fixed", "cxMargin");
  if (gained > 0.02) {
    console.log("  The architecture pays. A columnar, thalamically coupled association cortex");
    console.log("  learning by dendritic subunits and afferent BCM produces a code the");
    console.log("  hippocampus can index without retuning, and the hippocampal loop then");
    console.log("  retrieves that code from a partial cue BETTER than cortical recurrence alone.");
    console.log("  Every stage of it is a real circuit: image → retina → LGN → V1 → thalamic");
    console.log("  relay → L4 → L2/3 → entorhinal → dentate → CA3 → CA1 → subiculum → back.");
  } else {
    console.log("  THE ROUTE STILL DOES NOT PAY, and with a healthy cortex that is now a verdict");
    console.log("  on the ARCHITECTURE rather than on a learning rule. The cortex completes on");
    console.log("  its own (margin " + f(M("fixed", "cxMargin")) + ") and adding the hippocampal loop does not improve");
    console.log("  it (" + f(M("fixed", "hMargin")) + "). Encoding is not the problem — indices are distinct and the");
    console.log("  dentate sharpens the code. What the loop cannot do is EXPRESS a retrieved");
    console.log("  index back into cortex better than the cortex can do for itself, which points");
    console.log("  at the EC-deep → neocortex output stage as the next thing to examine.");
  }
  console.log("");
  console.log("  AND A CORRECTION TO STAGE 33's HEADLINE. It reported 2 of 6 indices retrieved,");
  console.log("  i.e. 33%. Scored the same way but over " + NDRAW + " cue draws instead of one, the SAME");
  console.log("  stage-33 cortex retrieves " + f(100 * M("old", "idxAcc"), 1) + "%. The failure was real but overstated,");
  console.log("  and by the same single-draw noise that produced stage 34's false positive — once");
  console.log("  in each direction now, which is what an unreliable measure does.");
  console.log("");
  console.log("  Both cortical mechanisms stay OFF by default in column.js, so stages 30 and 31");
  console.log("  reproduce unchanged. They are opt-in until a stage is migrated deliberately.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "route_retest.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
