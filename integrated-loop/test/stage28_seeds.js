"use strict";
/* Stage-28 — SEED REPLICATION of the whole structural arc. The blocker that now dominates.
 *
 * WHY. Stages 21–27 are all n = 1. Earlier stages in this project ran 12-seed robustness sweeps;
 * the entire structural-plasticity arc — including the headline comparison, HSP Δσ +2.327 against
 * the co-activity rule's +0.020 — rests on a single seed. This project's own first rule is
 * REPLICATE BEFORE BELIEVING, and it exists because a +10% effect at 50 trials became
 * +1.8% ± 6.4 (z = 0.28) at 110. A single-seed Δσ is not defensible and would not survive review.
 *
 * SCALE. Run at N = 2400 rather than 10 000, because ten seeds × three arms at 10 000 is about
 * eight hours and at 2400 it is about forty minutes. That is a deliberate trade and it is stated
 * rather than hidden: the SIGNIFICANCE of the comparison is established here across seeds, and
 * the MAGNITUDE at 10 000 is established in stages 24 and 27 at one seed. Stage 22 already showed
 * the dynamics are scale-invariant across 800/1600/2400 and stage 24 extended that to 10 000, so
 * the arms are being compared in a regime the model behaves the same way in. What this stage
 * cannot do is rule out that the ORDERING reverses somewhere between 2400 and 10 000; nothing
 * observed suggests it, and it is not tested.
 *
 * EVERYTHING varies with seed: the sheet layout, the initial connectivity draw, the cortical
 * stimulus patterns, the sensory projection, and the agent's trajectory.
 *
 * THREE ARMS, identical in every other respect:
 *   A  co-activity prune-and-rewire   (stages 21–25, multiplicative, per-cell normalised)
 *   B  HSP + intrinsic excitability homeostasis   (stage 27's bounded arm)
 *   C  HSP alone, intrinsic homeostat off          (stage 27's runaway arm)
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) Δσ is larger for HSP than for the co-activity rule in at least 9 of 10 seeds, and the
 *       paired difference is significant — |z| > 3 on the per-seed paired differences. Anything
 *       weaker and the stage-27 headline is a single-seed artefact.
 *   (2) The degree-CV ordering is cleaner still: 10 of 10 seeds. Degree is a direct consequence
 *       of the rule's structure (a fixed budget cannot vary in-degree; an element-based rule
 *       can), so it should be the most reliable discriminator.
 *   (3) The two-homeostat interaction — ΔCV smaller with intrinsic homeostasis than without —
 *       holds in at least 8 of 10 seeds. This is the result I most doubt, because it is a
 *       difference of differences and those are exactly what regress to nothing on replication.
 *   (4) The RUNAWAY in arm C replicates: mean in-degree grows monotonically across episodes in
 *       at least 8 of 10 seeds, confirming that arm C's large Δσ is partly unsatisfiable
 *       set-points rather than reorganisation. If arm C is stable across seeds, stage 27's
 *       caveat was wrong and its middle column can be read at face value.
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
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const N = +(process.env.N28 || 2400);
const K = Math.round(0.15 * 400), SAMP = 250;
const NSTEP = +(process.env.NSTEP28 || 800);
const EPISODES = +(process.env.EP28 || 3);
const NSEED = +(process.env.NSEED28 || 10);
const SETTLE = 0.06, CO_EVERY = 2;

const dense = new Uint16Array(N * N);

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

/* one seed: build the world, then run all three arms on identical inputs */
function runSeed(seed) {
  const pos = S.layout(N, seed);
  const con0 = S.connectDistance(N, pos, K, {}, seed + 11);
  const env = AG.createEnv({ seed: 21 + seed });
  const path = AG.trajectory(env, NSTEP, { seed });
  const DIM = AG.senseDim(env.P);
  const W = AG.makeProjector(DIM, N, seed + 5);
  const KDRIVE = Math.round(0.10 * N);
  const scratch = { s: new Float64Array(N), cp: new Float64Array(N) };

  const drivesPlain = path.map(p => H.driveHomeo(W, p.s, KDRIVE, 1.0, null, scratch));
  const hom = H.createHomeostat(N, KDRIVE / N, { eta: 0.02 });
  H.adapt(W, path.map(p => p.s), KDRIVE, hom, 4);
  hom.frozen = true;
  const drivesHomeo = path.map(p => H.driveHomeo(W, p.s, KDRIVE, 1.0, hom, scratch));

  function fresh() {
    const cx = C.create({ seed, NC: N, nStim: 8 });
    cx.preIdx = con0.preIdx.map(x => Int32Array.from(x));
    cx.preW = con0.preW.map(x => Float64Array.from(x));
    return cx;
  }
  /* returns per-cell mean activity, and fills `dense` when co-activity is needed */
  function experience(cx, drives, wantCo) {
    const act = new Float64Array(N);
    if (wantCo) dense.fill(0);
    let coSteps = 0;
    cx.plastic = true;
    for (let t = 0; t < drives.length; t++) {
      cx.a.fill(0); cx.inh = 0;
      C.setExt(cx, drives[t]); C.run(cx, SETTLE);
      for (let i = 0; i < N; i++) act[i] += cx.a[i];
      const A = wantCo ? C.activeSet(cx) : null;
      C.clearExt(cx);
      if (wantCo && t % CO_EVERY === 0) {
        coSteps++;
        for (const i of A) { const off = i * N; for (const j of A) if (j !== i) dense[off + j]++; }
      }
    }
    cx.plastic = false;
    for (let i = 0; i < N; i++) act[i] /= drives.length;
    return act;
  }
  function rowScales() {
    const rs = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const off = i * N; let mx = 0;
      for (let j = 0; j < N; j++) { const v = dense[off + j]; if (v > mx) mx = v; }
      rs[i] = mx > 0 ? 1 / mx : 0;
    }
    return rs;
  }
  function probe(cx) {
    const p = C.create({ seed, NC: N, nStim: 8 });
    p.preIdx = cx.preIdx.map(x => Int32Array.from(x));
    p.preW = cx.preW.map(x => Float64Array.from(x));
    C.encode(p);
    const fn = recallAt(p, 0.25);
    return { sparsity: 100 * mean(p.assemblies.map(a => a.length / p.N)), ...fn };
  }

  const res = {};
  // ---- arm A: co-activity prune-and-rewire ----
  {
    const cx = fresh();
    const before = S.report(cx, N, K, seed, SAMP);
    experience(cx, drivesHomeo, true);
    for (let ep = 0; ep < EPISODES; ep++) {
      S.pruneAndRewire(cx, pos, { dense, rowScale: rowScales() }, {}, seed + ep);
      experience(cx, drivesHomeo, true);
    }
    const after = S.report(cx, N, K, seed, SAMP);
    res.A = { dSigma: after.sigma - before.sigma, dCV: after.degree.cv - before.degree.cv,
              dRich: after.degree.richClub - before.degree.richClub,
              sigma: after.sigma, fn: probe(cx) };
  }
  // ---- arms B and C: HSP, with and without the intrinsic homeostat ----
  for (const [tag, drives] of [["B", drivesHomeo], ["C", drivesPlain]]) {
    const cx = fresh();
    const before = S.report(cx, N, K, seed, SAMP);
    let act = experience(cx, drives, false);
    const zs = [];
    for (let ep = 0; ep < EPISODES; ep++) {
      const st = S.hspRewire(cx, pos, act, {}, seed + ep);
      zs.push(st.meanZ);
      act = experience(cx, drives, false);
    }
    const after = S.report(cx, N, K, seed, SAMP);
    let monotone = true;
    for (let i = 1; i < zs.length; i++) if (zs[i] <= zs[i - 1]) monotone = false;
    res[tag] = { dSigma: after.sigma - before.sigma, dCV: after.degree.cv - before.degree.cv,
                 dRich: after.degree.richClub - before.degree.richClub,
                 sigma: after.sigma, meanZ: zs, growing: monotone, fn: probe(cx) };
  }
  return res;
}

/* ---------------- run ---------------- */
console.log("\n" + clock() + " == seed replication, N = " + N + ", " + NSEED + " seeds, " +
            EPISODES + " episodes ==");
console.log("  seed    Δσ  coact    Δσ  HSP+h    Δσ  HSP      ΔCV coact   ΔCV HSP+h   ΔCV HSP");
const rows = [];
for (let s = 1; s <= NSEED; s++) {
  const r = runSeed(s);
  rows.push(r);
  console.log("  " + String(s).padStart(4) + "   " + f(r.A.dSigma, 3).padStart(8) +
              "   " + f(r.B.dSigma, 3).padStart(9) + "   " + f(r.C.dSigma, 3).padStart(8) +
              "    " + f(r.A.dCV, 3).padStart(8) + "   " + f(r.B.dCV, 3).padStart(9) +
              "   " + f(r.C.dCV, 3).padStart(8) + "   " + clock());
}
out.rows = rows;

/* ---------------- verdicts ---------------- */
const col = (arm, k) => rows.map(r => r[arm][k]);
const z = d => { const s = sd(d); return s > 0 ? mean(d) / (s / Math.sqrt(d.length)) : 0; };
console.log("\n" + clock() + " == summary (mean ± sd over " + NSEED + " seeds) ==");
{
  const line = (n, a) => console.log("  " + n.padEnd(26) + f(mean(a), 3).padStart(8) + " ± " +
                                     f(sd(a), 3));
  line("Δσ   co-activity", col("A", "dSigma"));
  line("Δσ   HSP + homeostat", col("B", "dSigma"));
  line("Δσ   HSP alone", col("C", "dSigma"));
  line("ΔCV  co-activity", col("A", "dCV"));
  line("ΔCV  HSP + homeostat", col("B", "dCV"));
  line("ΔCV  HSP alone", col("C", "dCV"));
  line("Δrich co-activity", col("A", "dRich"));
  line("Δrich HSP + homeostat", col("B", "dRich"));
  line("Δrich HSP alone", col("C", "dRich"));

  const dS_BA = rows.map(r => r.B.dSigma - r.A.dSigma);
  const dS_CA = rows.map(r => r.C.dSigma - r.A.dSigma);
  const winS = dS_BA.filter(x => x > 0).length, winS2 = dS_CA.filter(x => x > 0).length;
  console.log("");
  ok("HSP beats the co-activity rule on Δσ in ≥9/10 seeds, significantly (P1)",
     Math.min(winS, winS2) >= Math.ceil(0.9 * NSEED) && Math.abs(z(dS_BA)) > 3 &&
     Math.abs(z(dS_CA)) > 3,
     "HSP+homeostat wins " + winS + "/" + NSEED + " (z = " + f(z(dS_BA), 1) +
     "), HSP alone " + winS2 + "/" + NSEED + " (z = " + f(z(dS_CA), 1) + ")");

  const dC_BA = rows.map(r => r.B.dCV - r.A.dCV), dC_CA = rows.map(r => r.C.dCV - r.A.dCV);
  const winC = dC_BA.filter(x => x > 0).length, winC2 = dC_CA.filter(x => x > 0).length;
  ok("the degree-CV ordering is 10/10 (P2)", winC === NSEED && winC2 === NSEED,
     "HSP+homeostat " + winC + "/" + NSEED + " (z = " + f(z(dC_BA), 1) + "), HSP alone " +
     winC2 + "/" + NSEED + " (z = " + f(z(dC_CA), 1) + ")");

  const inter = rows.map(r => r.C.dCV - r.B.dCV);   // >0 means the homeostat REDUCED the effect
  const winI = inter.filter(x => x > 0).length;
  ok("the two-homeostat interaction replicates in ≥8/10 seeds (P3)",
     winI >= Math.ceil(0.8 * NSEED),
     "ΔCV smaller with intrinsic homeostasis in " + winI + "/" + NSEED +
     " seeds, mean difference " + f(mean(inter), 3) + " ± " + f(sd(inter), 3) +
     " (z = " + f(z(inter), 1) + ")");

  const grow = rows.filter(r => r.C.growing).length;
  const growB = rows.filter(r => r.B.growing).length;
  ok("arm C's runaway replicates — in-degree grows monotonically in ≥8/10 seeds (P4)",
     grow >= Math.ceil(0.8 * NSEED),
     "HSP alone grows in " + grow + "/" + NSEED + " seeds; HSP + homeostat in " +
     growB + "/" + NSEED);

  const fnB = col("B", "fn").map(x => x.recall), fnA = col("A", "fn").map(x => x.recall);
  const offB = col("B", "fn").map(x => x.offTarget), offA = col("A", "fn").map(x => x.offTarget);
  console.log("");
  console.log("  FUNCTION at stage 26's sensitive cue of 0.25:");
  console.log("    co-activity      recall " + f(mean(fnA)) + " ± " + f(sd(fnA)) +
              "   off-target " + f(mean(offA)) + " ± " + f(sd(offA)));
  console.log("    HSP + homeostat  recall " + f(mean(fnB)) + " ± " + f(sd(fnB)) +
              "   off-target " + f(mean(offB)) + " ± " + f(sd(offB)));
  ok("function survives in every seed, in both rules",
     col("A", "fn").every(x => x.recall > 0.4 && x.sparsity >= 2 && x.sparsity <= 14) &&
     col("B", "fn").every(x => x.recall > 0.4 && x.sparsity >= 2 && x.sparsity <= 14),
     "no seed loses sparsity or completion");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "seeds.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
