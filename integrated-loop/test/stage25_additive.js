"use strict";
/* Stage-25 — THE ADDITIVE REGROWTH KERNEL: the named fix for the rule stage 24 dropped.
 *
 * WHAT STAGE 24 ESTABLISHED, so this is not another round of the same excuse. Prune-and-rewire
 * could not reshape the cortical graph at N = 800, 2400 or 10 000; with eight static patterns
 * or with a moving agent's experience; with 56% or 100% of cells participating. σ moved
 * 1.55 → 1.57. The diagnosis was not "needs more of something" for the fourth time — it was
 * arithmetic, and then structural:
 *
 *   the kernel is  v(j) = local(d_ij) · (1 + rewireBias · co_ij)
 *
 * so distance MULTIPLIES. A strongly co-active but distant partner is multiplied by a
 * near-zero local term and is unreachable at any parameter setting. Raising the boost's share
 * of the sampling mass from 3.04% to 26.69% (by letting a cell judge partners against its own
 * best partner rather than a global maximum) changed ΔCV from 0.004 to 0.005. The parameter
 * was never the limit; the FORM was.
 *
 *   the additive kernel is  v(j) = local(d_ij) + addBias · co_ij
 *
 * Distance now biases rather than gates. This is the whole change, and it is a change of form,
 * so it gets its own stage and its own registered predictions rather than being folded back
 * into stage 24 as though the earlier result had been a tuning problem.
 *
 * WHAT MAKES THIS A REAL TEST AND NOT A GUARANTEED WIN. Removing the distance gate is exactly
 * what building long-range structure requires, and also exactly what could destroy the model's
 * function: the whole point of a distance-dependent draw is that it is the developmental
 * constraint, and a rule that ignores it is free to wire anything to anything. P3 registers
 * that risk as a real possible outcome, not a caveat.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) The additive kernel MOVES the graph where the multiplicative one could not: σ rises by
 *       more than 0.05 over three episodes, against 1.55 → 1.57 (multiplicative, same substrate,
 *       same experience, same seeds). This is the direct test of the structural diagnosis. If
 *       σ still does not move, the diagnosis was wrong twice and the problem is not the kernel
 *       at all but the pruning side — which selects the weakest 25% and hits its cap every
 *       episode, so it may be close to pruning at random.
 *   (2) The degree distribution moves much further: degree CV rises by more than 0.02 and the
 *       rich club by more than 0.10, because strongly co-active cells can now be reached from
 *       anywhere on the sheet and hubs are no longer capped by their spatial neighbourhood.
 *   (3) A REGISTERED RISK, not a caveat. Function may DEGRADE, because regrowth is no longer
 *       spatially constrained. If recall falls below 0.6 or off-target rises above recall − 0.2,
 *       the additive kernel buys topology at the cost of function, and the honest report is a
 *       TRADE-OFF rather than a fix — the multiplicative form would then have been protecting
 *       something, and the distance gate would be load-bearing rather than merely limiting.
 *   (4) Clustering will FALL even as σ rises, because long-range contacts shorten paths faster
 *       than they add triangles. σ = (C/C_rand)/(L/L_rand) can rise from the denominator alone.
 *       Registered so that a rise in σ is not read as "more clustered like cortex" when it may
 *       be "less clustered, but much better connected".
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

const N = +(process.env.N25 || 10000);
const K = Math.round(0.15 * 400), SEED = 1, SAMP = 300;
const NSTEP = +(process.env.NSTEP25 || 1200), NBIN = 8;
const EPISODES = +(process.env.EP25 || 3);
const SETTLE = 0.06, CO_EVERY = 2;

/* stage 24 §4, for reference — same substrate, same experience, multiplicative kernel */
const REF = { sigma: [1.55, 1.57], C: [0.019, 0.019], L: [2.27, 2.28],
              cv: [0.085, 0.089], richClub: [1.56, 1.57], recall: 0.905 };

const pos = S.layout(N, SEED);
const con0 = S.connectDistance(N, pos, K, {}, SEED + 11);

function recall(cx) {
  const rnd = S.mulberry32(77);
  let r = 0, off = 0;
  for (let s = 0; s < cx.P.nStim; s++) {
    const cue = new Float64Array(cx.N), src = cx.stim[s];
    for (let i = 0; i < cx.N; i++) if (src[i] > 0 && rnd() < 0.5) cue[i] = src[i];
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

/* ---------------- the same experience the multiplicative arm received ---------------- */
console.log("\n" + clock() + " == setup: the same agent, substrate and homeostat as stage 24 §4 ==");
const env = AG.createEnv({ seed: 21 });
const path = AG.trajectory(env, NSTEP);
const DIM = AG.senseDim(env.P);
const W = AG.makeProjector(DIM, N, SEED + 5);
const KDRIVE = Math.round(0.10 * N);
const homeo = H.createHomeostat(N, KDRIVE / N, { eta: 0.02 });
H.adapt(W, path.map(p => p.s), KDRIVE, homeo, 4);
homeo.frozen = true;
{
  const p = H.participation(homeo);
  console.log("  " + NSTEP + " steps, coverage " + f(100 * AG.coverage(path, NBIN), 1) +
              "%, homeostat frozen at " + f(100 * p.fracEverActive, 1) + "% participation");
}
const scratch = { s: new Float64Array(N), cp: new Float64Array(N) };
const drives = path.map(p => H.driveHomeo(W, p.s, KDRIVE, 1.0, homeo, scratch));
const dense = new Uint16Array(N * N);

function experience(cx, learn) {
  dense.fill(0);
  let coSteps = 0;
  cx.plastic = !!learn;
  for (let t = 0; t < drives.length; t++) {
    cx.a.fill(0); cx.inh = 0;
    C.setExt(cx, drives[t]); C.run(cx, SETTLE);
    const act = C.activeSet(cx);
    C.clearExt(cx);
    if (t % CO_EVERY === 0) {
      coSteps++;
      for (const i of act) { const off = i * N; for (const j of act) if (j !== i) dense[off + j]++; }
    }
  }
  cx.plastic = false;
  return coSteps;
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

/* ---------------- the additive arm ---------------- */
console.log("\n" + clock() + " == does an ADDITIVE kernel move the graph? (P1, P2, P4) ==");
const cx = C.create({ seed: SEED, NC: N, nStim: 8 });
cx.preIdx = con0.preIdx.map(x => Int32Array.from(x));
cx.preW = con0.preW.map(x => Float64Array.from(x));
{
  const before = S.report(cx, N, K, SEED, SAMP);
  console.log("  " + clock() + " running experience 0 …");
  let coSteps = experience(cx, true);
  const hist = [];
  for (let ep = 0; ep < EPISODES; ep++) {
    const co = { dense, rowScale: rowScales() };
    const st = S.pruneAndRewire(cx, pos, co, { rewireMode: "additive", addBias: 1.0 }, SEED + ep);
    coSteps = experience(cx, true);
    const r = S.report(cx, N, K, SEED, SAMP);
    hist.push({ ep, pruned: st.pruned, grown: st.grown, sigma: r.sigma, C: r.C, L: r.L,
                cv: r.degree.cv, richClub: r.degree.richClub, logSkew: r.weights.logSkew });
    console.log("  " + clock() + " episode " + ep + "   pruned " + String(st.pruned).padStart(6) +
                "   σ " + f(r.sigma, 2) + "   clustering " + f(r.C, 4) + "   path " + f(r.L, 2) +
                "   degree CV " + f(r.degree.cv) + "   rich club " + f(r.degree.richClub, 2));
  }
  const after = S.report(cx, N, K, SEED, SAMP);
  out.additive = { before, after, hist, reference: REF };

  console.log("\n  measure              before      after      MULTIPLICATIVE (stage 24 §4)");
  const row = (n, a, b, ref, d) => console.log("  " + n.padEnd(20) + f(a, d || 3).padStart(7) +
    "   " + f(b, d || 3).padStart(8) + "     " + ref);
  row("small-world σ", before.sigma, after.sigma, f(REF.sigma[0], 2) + " → " + f(REF.sigma[1], 2), 2);
  row("clustering", before.C, after.C, f(REF.C[0], 4) + " → " + f(REF.C[1], 4), 4);
  row("path length", before.L, after.L, f(REF.L[0], 2) + " → " + f(REF.L[1], 2), 2);
  row("degree CV", before.degree.cv, after.degree.cv, f(REF.cv[0]) + " → " + f(REF.cv[1]));
  row("rich club", before.degree.richClub, after.degree.richClub,
      f(REF.richClub[0], 2) + " → " + f(REF.richClub[1], 2), 2);
  row("log-weight skew", before.weights.logSkew, after.weights.logSkew, "—", 2);

  const dSigma = after.sigma - before.sigma, dRef = REF.sigma[1] - REF.sigma[0];
  ok("the additive kernel moves σ where the multiplicative one could not (P1)",
     dSigma > 0.05, "Δσ " + f(dSigma, 3) + " vs " + f(dRef, 3) + " multiplicative");
  ok("the degree distribution moves much further (P2a)",
     after.degree.cv - before.degree.cv > 0.02,
     "ΔCV " + f(after.degree.cv - before.degree.cv) + " vs " +
     f(REF.cv[1] - REF.cv[0]) + " multiplicative");
  ok("…and so does the rich club (P2b)",
     after.degree.richClub - before.degree.richClub > 0.10,
     "Δrich club " + f(after.degree.richClub - before.degree.richClub, 2) + " vs " +
     f(REF.richClub[1] - REF.richClub[0], 2) + " multiplicative");
  /* P4 asks WHERE σ moved from, so report the decomposition rather than a bare direction.
     σ = (C/C_rand)/(L/L_rand): a rise can come from the clustering ratio or the path ratio, and
     "more clustered like cortex" and "less clustered but better connected" are opposite claims
     that the single number cannot distinguish. Checking `clustering fell` alone would also pass
     when σ FELL, which would be a meaningless tick. */
  const ratC = [before.C / before.Crand, after.C / after.Crand];
  const ratL = [before.L / before.Lrand, after.L / after.Lrand];
  console.log("\n  where σ moved from:   C/C_rand " + f(ratC[0], 2) + " → " + f(ratC[1], 2) +
              "     L/L_rand " + f(ratL[0], 2) + " → " + f(ratL[1], 2));
  ok("σ rose, and it rose from the PATH term with clustering falling (P4)",
     dSigma > 0.05 && after.C < before.C && ratL[1] < ratL[0],
     dSigma <= 0.05 ? "σ did not rise, so there is nothing to decompose"
     : "clustering " + f(before.C, 4) + " → " + f(after.C, 4) + ", path ratio " +
       f(ratL[0], 2) + " → " + f(ratL[1], 2));
}

/* ---------------- the registered risk ---------------- */
console.log("\n" + clock() + " == what did it cost? (P3 — a registered risk, not a caveat) ==");
{
  const probe = C.create({ seed: SEED, NC: N, nStim: 8 });
  probe.preIdx = cx.preIdx.map(x => Int32Array.from(x));
  probe.preW = cx.preW.map(x => Float64Array.from(x));
  C.encode(probe);
  const fn = recall(probe);
  const sp = 100 * mean(probe.assemblies.map(a => a.length / probe.N));
  out.function = { sparsity: sp, ...fn, referenceRecall: REF.recall };
  console.log("  sparsity " + f(sp, 1) + "%   recall " + f(fn.recall) + "   off-target " +
              f(fn.offTarget) + "        (multiplicative, stage 24 §4: recall " +
              f(REF.recall) + ")");
  const intact = sp >= 2 && sp <= 12 && fn.recall > 0.6 && fn.offTarget < fn.recall - 0.2;
  ok("function survives the additive kernel (P3)", intact,
     intact ? "still sparse, still completing, still separate"
            : "FUNCTION LOST — the additive kernel buys topology by wiring anything to anything");
  if (!intact) {
    console.log("");
    console.log("  THE HONEST READING IF THIS FAILED: the distance gate was LOAD-BEARING, not");
    console.log("  merely limiting. The multiplicative kernel's inability to build long-range");
    console.log("  structure would then be the same fact as its ability to preserve a sparse,");
    console.log("  separable code — one property, seen from two sides — and the right conclusion");
    console.log("  is a trade-off curve in addBias, not a fix.");
  }
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "additive.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
