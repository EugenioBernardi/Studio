"use strict";
/* Stage-27 — HOMEOSTATIC STRUCTURAL PLASTICITY: the rule the field actually uses.
 *
 * WHY THIS IS THE RIGHT NEXT EXPERIMENT. Stages 21–25 asked a co-activity-driven rewiring rule
 * to move a cortical graph toward measured cortical statistics, and it never did: σ 1.50 → 1.52
 * at N = 2400, 1.55 → 1.57 at N = 10 000, and 1.55 → 1.26 (backwards) when the distance gate was
 * removed. The final diagnosis was quantitative — at ~10% sparsity a cell has ~5340 co-active
 * partners of 10 000, so raw co-occurrence is dominated by chance and the term is close to a
 * uniform offset.
 *
 * But the field's established structural-plasticity rule is NOT co-activity-driven, and this
 * project never tried it. Butz & van Ooyen grow and retract synaptic elements to hold each
 * neuron at a firing-rate SET-POINT, and pair the free elements distance-dependently with no
 * correlation term at all (Front Comput Neurosci 2009, doi:10.3389/neuro.10.010.2009; Front
 * Synaptic Neurosci 2014, doi:10.3389/fnsyn.2014.00007 — titled "Homeostatic structural
 * plasticity increases the efficiency of small-world networks"; Front Neuroanat 2014,
 * doi:10.3389/fnana.2014.00115). Hebbian structural rules do reshape topology in simpler
 * settings (Damicelli et al., Chaos 2017, doi:10.1063/1.4979561), which is why the failure here
 * is worth pinning to a regime rather than to Hebbian rules in general.
 *
 * Run as a COMPARISON ARM against stage 24 §4, on the same substrate, the same agent, the same
 * seeds and the same number of episodes. The interesting quantity is the difference.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) HSP moves the DEGREE distribution far further than the co-activity rule, because degree
 *       is now an outcome of activity rather than a constant. `pruneAndRewire` enforced a fixed
 *       per-cell in-degree, so all variation had to come from out-degree; here both are free.
 *       Degree CV rises above 0.15, against 0.085 → 0.089.
 *   (2) It raises σ by more than 0.05, where the co-activity rule could not at any scale, any
 *       amount of experience, any participation level or either kernel form.
 *   (3) THE INTERACTION, and this is the prediction I most want tested. Stage 24 added
 *       homeostatic INTRINSIC excitability to fix the silent 40%. That mechanism equalises
 *       firing rates — which is exactly the error signal synaptic HSP feeds on. Two homeostats
 *       regulating the same variable should compete: with the intrinsic homeostat ON, the
 *       activity error is smaller and HSP's structural effect should be SMALLER. If so, the
 *       stage-24 fix has a cost that was invisible when it was introduced, and the two
 *       mechanisms cannot both be run at full strength.
 *   (4) Function survives, but off-target recall RISES, because HSP wires blind: nothing in the
 *       partner choice knows what a cell codes. The co-activity rule at least aimed at the right
 *       cells even if it could not reach them.
 *
 *   REGISTERED IN ADVANCE — WHAT A FAILURE WOULD MEAN. If HSP also fails to move σ, the honest
 *   conclusion is NOT "structural plasticity does not build small-worldness". It is that this
 *   NETWORK'S REGIME forbids it: a rate-coded sheet with ~60 inputs per cell, ~7% sparsity and
 *   feedback inhibition that clamps the population mean leaves very little activity error for
 *   any homeostatic rule to act on. That would be a claim about the model, and it would say the
 *   substrate has to change before the plasticity question can be asked at all.
 */

const AG = require("../src/agent.js");
const H = require("../src/homeostasis.js");
const S = require("../src/structural.js");
const C = require("../src/cortex.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null ? "  n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const N = +(process.env.N27 || 10000);
const K = Math.round(0.15 * 400), SEED = 1, SAMP = 300;
const NSTEP = +(process.env.NSTEP27 || 1200);
const EPISODES = +(process.env.EP27 || 3);
const SETTLE = 0.06;

/* stage 24 §4 — the co-activity rule, same substrate, same experience */
const REF = { sigma: [1.55, 1.57], C: [0.0189, 0.0190], L: [2.27, 2.28],
              cv: [0.085, 0.089], richClub: [1.56, 1.57], recall: 0.905 };

const pos = S.layout(N, SEED);
const con0 = S.connectDistance(N, pos, K, {}, SEED + 11);

/* stage 26 established that the recurrent contribution peaks at a cue of 0.25, not the 0.50
   earlier stages used, so both are reported here. */
function recallAt(cx, frac) {
  const rnd = S.mulberry32(77);
  let r = 0, off = 0;
  for (let s = 0; s < cx.P.nStim; s++) {
    const cue = new Float64Array(cx.N), src = cx.stim[s];
    for (let i = 0; i < cx.N; i++) if (src[i] > 0 && rnd() < frac) cue[i] = src[i];
    cx.a.fill(0); cx.inh = 0;
    C.setExt(cx, cue); C.run(cx, 0.35);
    const got = new Set(C.activeSet(cx)); C.clearExt(cx);
    const A = cx.assemblies[s];
    let on = 0; for (const c of A) if (got.has(c)) on++;
    r += on / Math.max(1, A.length);
    let best = 0;
    for (let t = 0; t < cx.P.nStim; t++) {
      if (t === s) continue;
      const B = cx.assemblies[t]; let o2 = 0;
      for (const c of B) if (got.has(c)) o2++;
      best = Math.max(best, o2 / Math.max(1, B.length));
    }
    off += best;
  }
  return { recall: r / cx.P.nStim, offTarget: off / cx.P.nStim };
}

/* ---------------- the shared experience ---------------- */
console.log("\n" + clock() + " == setup ==");
const env = AG.createEnv({ seed: 21 });
const path = AG.trajectory(env, NSTEP);
const DIM = AG.senseDim(env.P);
const W = AG.makeProjector(DIM, N, SEED + 5);
const KDRIVE = Math.round(0.10 * N);
const scratch = { s: new Float64Array(N), cp: new Float64Array(N) };

function makeDrives(useHomeostat) {
  if (!useHomeostat) return path.map(p => H.driveHomeo(W, p.s, KDRIVE, 1.0, null, scratch));
  const hom = H.createHomeostat(N, KDRIVE / N, { eta: 0.02 });
  H.adapt(W, path.map(p => p.s), KDRIVE, hom, 4);
  hom.frozen = true;
  return path.map(p => H.driveHomeo(W, p.s, KDRIVE, 1.0, hom, scratch));
}

/* run the agent's experience, learning, and return each cell's mean activity —
   the calcium-like trace HSP's set-point is compared against */
function experience(cx, drives, learn) {
  const act = new Float64Array(N);
  cx.plastic = !!learn;
  for (let t = 0; t < drives.length; t++) {
    cx.a.fill(0); cx.inh = 0;
    C.setExt(cx, drives[t]); C.run(cx, SETTLE);
    for (let i = 0; i < N; i++) act[i] += cx.a[i];
    C.clearExt(cx);
  }
  cx.plastic = false;
  for (let i = 0; i < N; i++) act[i] /= drives.length;
  return act;
}

function actStats(act) {
  const m = mean(Array.from(act));
  let sd = 0, silent = 0;
  for (let i = 0; i < N; i++) { sd += (act[i] - m) ** 2; if (act[i] < 1e-4) silent++; }
  sd = Math.sqrt(sd / N);
  return { mean: m, cv: m ? sd / m : 0, fracSilent: silent / N };
}

/* ---------------- one arm ---------------- */
function runArm(label, useHomeostat) {
  console.log("\n" + clock() + " == arm: " + label + " ==");
  const drives = makeDrives(useHomeostat);
  const cx = C.create({ seed: SEED, NC: N, nStim: 8 });
  cx.preIdx = con0.preIdx.map(x => Int32Array.from(x));
  cx.preW = con0.preW.map(x => Float64Array.from(x));
  const before = S.report(cx, N, K, SEED, SAMP);
  console.log("  " + clock() + " experience 0 …");
  let act = experience(cx, drives, true);
  const as0 = actStats(act);
  console.log("  " + clock() + " activity: mean " + f(as0.mean, 4) + "   CV " + f(as0.cv, 3) +
              "   silent " + f(100 * as0.fracSilent, 1) + "%");
  const hist = [];
  for (let ep = 0; ep < EPISODES; ep++) {
    const st = S.hspRewire(cx, pos, act, {}, SEED + ep);
    act = experience(cx, drives, true);
    const r = S.report(cx, N, K, SEED, SAMP);
    const nb = S.neighbourSets(cx.preIdx);
    hist.push({ ep, grown: st.grown, deleted: st.deleted, meanZ: st.meanZ,
                minZ: st.minZ, maxZ: st.maxZ, meanErr: st.meanErr,
                sigma: r.sigma, C: r.C, L: r.L, cv: r.degree.cv,
                richClub: r.degree.richClub, act: actStats(act) });
    console.log("  " + clock() + " ep " + ep + "   +" + String(st.grown).padStart(6) +
                " −" + String(st.deleted).padStart(6) +
                "   in-deg " + f(st.meanZ, 1).padStart(5) + " [" + st.minZ + "–" + st.maxZ + "]" +
                "   σ " + f(r.sigma, 2) + "   C " + f(r.C, 4) + "   L " + f(r.L, 2) +
                "   CV " + f(r.degree.cv) + "   rich " + f(r.degree.richClub, 2));
  }
  const after = S.report(cx, N, K, SEED, SAMP);
  const probe = C.create({ seed: SEED, NC: N, nStim: 8 });
  probe.preIdx = cx.preIdx.map(x => Int32Array.from(x));
  probe.preW = cx.preW.map(x => Float64Array.from(x));
  C.encode(probe);
  const fn25 = recallAt(probe, 0.25), fn50 = recallAt(probe, 0.50);
  const sp = 100 * mean(probe.assemblies.map(a => a.length / probe.N));
  console.log("  " + clock() + " function: sparsity " + f(sp, 1) + "%   recall(0.50) " +
              f(fn50.recall) + " off " + f(fn50.offTarget) + "   recall(0.25) " +
              f(fn25.recall) + " off " + f(fn25.offTarget));
  return { label, before, after, hist, act0: as0,
           fn: { sparsity: sp, cue50: fn50, cue25: fn25 } };
}

const armOn = runArm("HSP + intrinsic excitability homeostasis (as stage 24 ships)", true);
const armOff = runArm("HSP alone, intrinsic homeostat OFF", false);
out.armOn = armOn; out.armOff = armOff; out.reference = REF;

/* ---------------- verdicts ---------------- */
console.log("\n" + clock() + " == does the field's rule move what mine could not? ==");
{
  const row = (n, a, b, ref, d) => console.log("  " + n.padEnd(18) + f(a, d || 3).padStart(8) +
    "  " + f(b, d || 3).padStart(9) + "     " + ref);
  console.log("  measure            HSP+homeo    HSP alone    co-activity rule (stage 24 §4)");
  row("Δ small-world σ", armOn.after.sigma - armOn.before.sigma,
      armOff.after.sigma - armOff.before.sigma, f(REF.sigma[1] - REF.sigma[0], 3), 3);
  row("Δ clustering", armOn.after.C - armOn.before.C, armOff.after.C - armOff.before.C,
      f(REF.C[1] - REF.C[0], 4), 4);
  row("Δ path length", armOn.after.L - armOn.before.L, armOff.after.L - armOff.before.L,
      f(REF.L[1] - REF.L[0], 3), 3);
  row("Δ degree CV", armOn.after.degree.cv - armOn.before.degree.cv,
      armOff.after.degree.cv - armOff.before.degree.cv, f(REF.cv[1] - REF.cv[0], 3), 3);
  row("Δ rich club", armOn.after.degree.richClub - armOn.before.degree.richClub,
      armOff.after.degree.richClub - armOff.before.degree.richClub,
      f(REF.richClub[1] - REF.richClub[0], 3), 3);

  const bestCV = Math.max(armOn.after.degree.cv - armOn.before.degree.cv,
                          armOff.after.degree.cv - armOff.before.degree.cv);
  const bestSigma = Math.max(armOn.after.sigma - armOn.before.sigma,
                             armOff.after.sigma - armOff.before.sigma);
  ok("HSP moves the degree distribution far further than the co-activity rule (P1)",
     Math.max(armOn.after.degree.cv, armOff.after.degree.cv) > 0.15,
     "CV reaches " + f(Math.max(armOn.after.degree.cv, armOff.after.degree.cv)) +
     ", against 0.089 for the co-activity rule");
  ok("HSP raises σ where the co-activity rule could not (P2)", bestSigma > 0.05,
     "best Δσ " + f(bestSigma, 3) + " vs " + f(REF.sigma[1] - REF.sigma[0], 3));

  const dOn = armOn.after.degree.cv - armOn.before.degree.cv;
  const dOff = armOff.after.degree.cv - armOff.before.degree.cv;
  console.log("");
  console.log("  THE TWO HOMEOSTATS (P3). activity CV before rewiring:  with intrinsic " +
              f(armOn.act0.cv, 3) + "   without " + f(armOff.act0.cv, 3));
  console.log("  silent fraction:                                       with intrinsic " +
              f(100 * armOn.act0.fracSilent, 1) + "%      without " +
              f(100 * armOff.act0.fracSilent, 1) + "%");
  ok("the intrinsic homeostat REDUCES HSP's structural effect (P3)", dOn < dOff - 0.005,
     "ΔCV " + f(dOn) + " with intrinsic homeostasis vs " + f(dOff) + " without — " +
     "two homeostats competing for the same error signal");

  const fnOn = armOn.fn, fnOff = armOff.fn;
  console.log("");
  console.log("  FUNCTION (P4), at stage 26's sensitive cue of 0.25 and the legacy 0.50:");
  console.log("    HSP+homeo   sparsity " + f(fnOn.sparsity, 1) + "%   recall " +
              f(fnOn.cue25.recall) + " / " + f(fnOn.cue50.recall) + "   off-target " +
              f(fnOn.cue25.offTarget) + " / " + f(fnOn.cue50.offTarget));
  console.log("    HSP alone   sparsity " + f(fnOff.sparsity, 1) + "%   recall " +
              f(fnOff.cue25.recall) + " / " + f(fnOff.cue50.recall) + "   off-target " +
              f(fnOff.cue25.offTarget) + " / " + f(fnOff.cue50.offTarget));
  console.log("    co-activity rule (stage 24 §4)          recall     —   / " + f(REF.recall) +
              "   off-target    —   /  0.044");
  const intact = a => a.sparsity >= 2 && a.sparsity <= 14 && a.cue50.recall > 0.6 &&
                      a.cue50.offTarget < a.cue50.recall - 0.2;
  ok("function survives HSP (P4a)", intact(fnOn) && intact(fnOff),
     "sparse, completing and separate in both arms");
  ok("…but off-target rises, because HSP wires blind (P4b)",
     Math.max(fnOn.cue50.offTarget, fnOff.cue50.offTarget) > 0.044 * 1.5,
     "off-target " + f(Math.max(fnOn.cue50.offTarget, fnOff.cue50.offTarget)) +
     " vs 0.044 for the co-activity rule, which at least aimed at the right cells");

  console.log("");
  if (bestSigma <= 0.05) {
    console.log("  IF HSP ALSO FAILED — the registered reading, and it is about the MODEL:");
    console.log("  the conclusion is not that structural plasticity cannot build small-worldness.");
    console.log("  Butz & van Ooyen's own networks do exactly that. It is that THIS network's");
    console.log("  regime forbids it — a rate-coded sheet with ~60 inputs per cell, ~7% sparsity");
    console.log("  and feedback inhibition that actively clamps the population mean leaves very");
    console.log("  little activity error for any homeostatic rule to act on. Measured above as");
    console.log("  the activity CV. That would mean the SUBSTRATE has to change before the");
    console.log("  plasticity question can be asked at all, and it would make stage 24b's");
    console.log("  calibrated substrate (σ_dev 0.20, 6% long-range, σ_sw 2.05, recall 0.908) the");
    console.log("  right place to start rather than the shipped one.");
  }
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "hsp.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
