"use strict";
/* Stage-24 — TEN THOUSAND CELLS, and the two fixes stage 23 named.
 *
 * Stage 23 ended with two limits, explicitly separated: DEGREE structure needed experience and
 * got it (CV 0.086 → 0.111, rich club 1.57 → 1.99), while PATH structure needed lower density
 * and did not get it (L stuck at 1.97 at 4.9% density). It also measured a defect that was
 * nobody's fault but the encoding's: only 60.3% of cortex was EVER driven, because the top-k of
 * a fixed random projection has favourites. Both fixes are applied here — N = 10 000, and
 * homeostatic intrinsic excitability in the projection — and the graph question is re-asked.
 *
 * DISCLOSURE, because the method requires it. The initial-substrate row of §1 (N = 10 000,
 * in-degree 60 → L = 2.27, σ = 1.55) was seen during a timing benchmark run BEFORE this file
 * was written, while sizing whether the scale-up was runnable at all. It is therefore reported
 * below as a MEASUREMENT, not as a prediction, and no prediction is registered about it.
 * Everything downstream of the substrate — the dynamics, the homeostasis, the rewiring, the
 * spatial readout, the developmental sweep — was unmeasured when the predictions below were
 * written.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) The DYNAMICS are unchanged at 25× the baseline cortex: sparsity 2–12%, recall > 0.6,
 *       off-target below recall − 0.2. The project has claimed scale-invariance since stage 1;
 *       10 000 cells is the largest test of it.
 *   (2) Homeostatic excitability eliminates the silent subpopulation: the fraction of units the
 *       projection ever drives rises from ~0.60 to > 0.95, and the Gini of the win counts falls
 *       by at least half. This is a mechanism claim, not a tuning claim — a permanently silent
 *       unit is not a fixed point of b ← b + η·(won − target).
 *   (3) THE DECISIVE ONE. With full participation, dense co-activity from movement, and a
 *       substrate four times sparser, prune-and-rewire raises σ by > 0.05 and degree CV by
 *       > 0.02. Stage 23 moved the degree distribution and not σ. If σ STILL does not move
 *       after scale, experience and participation have all been supplied, the honest conclusion
 *       is that this rewiring rule cannot build small-worldness and the claim has to be dropped
 *       rather than re-explained a fourth time.
 *   (4) A PREDICTED FAILURE, registered as such. Rewiring will still NOT sharpen spatial tuning,
 *       because nothing has been added that could: there is no path integration anywhere in the
 *       model, so position exists only as whatever the sensory vector carries. If this test
 *       PASSES it is more likely that the measure is contaminated than that place coding has
 *       appeared, and it should be treated with suspicion, not satisfaction.
 *   (5) A more local substrate (smaller Gaussian σ_dev, smaller long-range floor) will reach a
 *       HIGHER small-world σ and a WORSE recall, because the stimulus map is not topographic:
 *       assembly members are scattered across the sheet, so a graph that only connects
 *       neighbours cannot hold an assembly together. If both halves hold, then topology and
 *       function are coupled through the MAP, and σ is not a free knob to tune.
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

const N = +(process.env.N24 || 10000);
const K = Math.round(0.15 * 400);              // in-degree, held absolute at every scale
const SEED = 1, SAMP = 300;
const NSTEP = +(process.env.NSTEP24 || 1200), NBIN = 8;
const EPISODES = +(process.env.EP24 || 3);
const SETTLE = 0.06;                           // 3·tauA — the settle time stage 23 used

/* ---------------- shared measurements ---------------- */
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
const sparsity = cx => 100 * mean(cx.assemblies.map(a => a.length / cx.N));

/* ---------------- 1. the substrate at scale ---------------- */
console.log("\n" + clock() + " == 1. what the graph looks like at N = " + N + " (MEASURED, not predicted) ==");
const pos = S.layout(N, SEED);
let con0;
{
  console.log("      N    in-deg   density   clustering   path L     σ        reference");
  const rows = [];
  for (const n of [2400, N]) {
    const p = n === N ? pos : S.layout(n, SEED);
    const con = S.connectDistance(n, p, K, {}, SEED + 11);
    if (n === N) con0 = con;
    const stub = { preIdx: con.preIdx, preW: con.preW, N: n };
    const r = S.report(stub, n, K, SEED, SAMP);
    const nb = S.neighbourSets(con.preIdx), deg = mean(nb.map(x => x.size));
    rows.push({ N: n, deg, density: 100 * deg / n, C: r.C, L: r.L, sigma: r.sigma });
    console.log("  " + String(n).padStart(6) + "   " + f(deg, 1).padStart(6) + "   " +
                f(100 * deg / n, 2).padStart(5) + "%     " + f(r.C) + "     " + f(r.L, 2) +
                "     " + f(r.sigma, 2) + "     " + (n === 2400 ? "stage 23" : "this stage"));
  }
  out.substrate = rows;
  const a = rows[0], b = rows[1];
  ok("density falls ~4× at the same absolute in-degree", b.density < a.density / 3,
     f(a.density, 1) + "% → " + f(b.density, 1) + "%");
  ok("path length rises with the sparser graph", b.L > a.L + 0.15,
     "L " + f(a.L, 2) + " → " + f(b.L, 2));
  console.log("");
  console.log("  READ THE SIZE OF THAT, not just its sign. A 4.3-fold drop in density bought");
  console.log("  0.30 of path length and " + f(b.sigma - a.sigma, 2) + " of σ. Stage 23 said 'path structure needs lower");
  console.log("  density'; that was true and it was not sufficient. σ = (C/C_rand)/(L/L_rand) is");
  console.log("  dominated by the CLUSTERING ratio, and clustering is set by how LOCAL the");
  console.log("  developmental draw is — a parameter, not a scale. §1b tests that directly.");
}

/* ---------------- 1b. the developmental parameter, and what it costs ---------------- */
console.log("\n" + clock() + " == 1b. σ is a developmental parameter, not a scale (P5) ==");
{
  const CFG = [
    { sigma: 0.16, pLong: 0.06, tag: "shipped" },
    { sigma: 0.08, pLong: 0.06, tag: "more local" },
    { sigma: 0.05, pLong: 0.06, tag: "very local" },
    { sigma: 0.05, pLong: 0.02, tag: "very local, thin long-range" },
  ];
  const rows = [];
  console.log("   σ_dev  p_long   clustering   path L     σ      sparsity   recall   off-target");
  for (const cfg of CFG) {
    const cx = C.create({ seed: SEED, NC: N, nStim: 8 });
    const con = cfg.tag === "shipped" ? con0
              : S.connectDistance(N, pos, K, { sigma: cfg.sigma, pLong: cfg.pLong }, SEED + 11);
    cx.preIdx = con.preIdx.map(x => Int32Array.from(x));
    cx.preW = con.preW.map(x => Float64Array.from(x));
    const r = S.report(cx, N, K, SEED, SAMP);
    C.encode(cx);
    const fn = recall(cx), sp = sparsity(cx);
    rows.push({ ...cfg, C: r.C, L: r.L, sigma: r.sigma, sparsity: sp,
                recall: fn.recall, off: fn.offTarget });
    console.log("  " + f(cfg.sigma, 2) + "   " + f(cfg.pLong, 2) + "     " + f(r.C) +
                "      " + f(r.L, 2) + "    " + f(r.sigma, 2) + "     " + f(sp, 1).padStart(4) +
                "%     " + f(fn.recall) + "   " + f(fn.offTarget) + "    " + cfg.tag);
    console.log("      " + clock());
  }
  out.developmental = rows;
  const shipped = rows[0], local = rows[rows.length - 1];
  ok("a more local draw reaches a higher small-world σ (P5a)", local.sigma > shipped.sigma + 0.2,
     "σ " + f(shipped.sigma, 2) + " → " + f(local.sigma, 2));
  ok("…and it costs recall, because the stimulus map is NOT topographic (P5b)",
     local.recall < shipped.recall - 0.1,
     "recall " + f(shipped.recall) + " → " + f(local.recall));
  console.log("");
  console.log("  IF BOTH HELD: σ is not a free knob. The substrate can be made as small-world as");
  console.log("  cortex, and doing so breaks pattern completion, because cortex.js draws each");
  console.log("  stimulus as a RANDOM sparse subset — assembly members are scattered over the");
  console.log("  sheet, and a graph that mostly connects neighbours cannot hold them together.");
  console.log("  Real cortex does not have that problem because its maps are TOPOGRAPHIC: cells");
  console.log("  that code related things are near each other, so local wiring and functional");
  console.log("  wiring are the same wiring. That is the missing constraint, and it is a");
  console.log("  developmental one, not a plasticity one.");
}

/* ---------------- 2. do the dynamics survive 25× the baseline? ---------------- */
console.log("\n" + clock() + " == 2. scale-invariance of the dynamics at N = " + N + " (P1) ==");
const cortex = C.create({ seed: SEED, NC: N, nStim: 8 });
cortex.preIdx = con0.preIdx.map(x => Int32Array.from(x));
cortex.preW = con0.preW.map(x => Float64Array.from(x));
{
  C.encode(cortex);
  const fn = recall(cortex), sp = sparsity(cortex);
  out.dynamics = { N, sparsity: sp, recall: fn.recall, offTarget: fn.offTarget };
  console.log("  sparsity " + f(sp, 1) + "%   recall " + f(fn.recall) +
              "   off-target " + f(fn.offTarget) +
              "        (N=2400, stage 22:  7.3%,  0.91,  0.06)");
  ok("the dynamics are unchanged at 25× the baseline cortex (P1)",
     sp >= 2 && sp <= 12 && fn.recall > 0.6 && fn.offTarget < fn.recall - 0.2,
     "sparse, completing and separate at N = " + N);
}

/* ---------------- 3. homeostatic excitability vs the silent subpopulation ---------------- */
console.log("\n" + clock() + " == 3. does homeostasis abolish the silent 40%? (P2) ==");
const env = AG.createEnv({ seed: 21 });
const path = AG.trajectory(env, NSTEP);
const DIM = AG.senseDim(env.P);
const W = AG.makeProjector(DIM, N, SEED + 5);
const KDRIVE = Math.round(0.10 * N);
const homeo = H.createHomeostat(N, KDRIVE / N, { eta: 0.02 });
{
  console.log("  " + NSTEP + " steps, " + DIM + "-dim sensory vector, coverage " +
              f(100 * AG.coverage(path, NBIN), 1) + "% of an " + NBIN + "×" + NBIN + " grid");
  const vecs = path.map(p => p.s);
  // baseline: the stage-23 encoding, no homeostat
  const flat = H.createHomeostat(N, KDRIVE / N, { eta: 0 });
  flat.frozen = true;
  const b0 = H.adapt(W, vecs, KDRIVE, flat, 1)[0];
  const hist = H.adapt(W, vecs, KDRIVE, homeo, 4);
  homeo.frozen = true;
  const bF = H.adapt(W, vecs, KDRIVE, homeo, 1)[0];
  out.homeostasis = { baseline: b0, passes: hist, frozen: bF };
  console.log("  pass                fraction ever driven     win-count CV     Gini");
  const row = (n, p) => console.log("  " + n.padEnd(18) + f(100 * p.fracEverActive, 1).padStart(8) +
                                    "%              " + f(p.cv) + "        " + f(p.gini));
  row("no homeostat", b0);
  hist.forEach((p, i) => row("homeostat, pass " + i, p));
  row("frozen readout", bF);
  ok("homeostasis abolishes the permanently silent population (P2)",
     bF.fracEverActive > 0.95 && b0.fracEverActive < 0.8,
     f(100 * b0.fracEverActive, 1) + "% → " + f(100 * bF.fracEverActive, 1) + "% of units ever driven");
  ok("…and the win distribution is far more even", bF.gini < b0.gini / 2,
     "Gini " + f(b0.gini) + " → " + f(bF.gini));
}

/* ---------------- the experience loop ---------------- */
const dense = new Uint16Array(N * N);           // 200 MB, row-major co-activity
const CO_EVERY = 2;                             // accumulate pairs on every other step
const scratch = { s: new Float64Array(N), cp: new Float64Array(N) };
const drives = path.map(p => H.driveHomeo(W, p.s, KDRIVE, cortex.P.inDrive, homeo, scratch));

function experience(cx, learn, wantCo) {
  const nb = NBIN * NBIN;
  const rate = Array.from({ length: N }, () => new Float64Array(nb));
  const occ = new Float64Array(nb);
  if (wantCo) dense.fill(0);
  let coSteps = 0;
  cx.plastic = !!learn;
  for (let t = 0; t < drives.length; t++) {
    const p = path[t];
    const b = Math.min(NBIN - 1, Math.floor(p.y * NBIN)) * NBIN + Math.min(NBIN - 1, Math.floor(p.x * NBIN));
    cx.a.fill(0); cx.inh = 0;
    C.setExt(cx, drives[t]); C.run(cx, SETTLE);
    const act = C.activeSet(cx);
    C.clearExt(cx);
    occ[b]++;
    for (const i of act) rate[i][b]++;
    if (wantCo && t % CO_EVERY === 0) {
      coSteps++;
      for (const i of act) { const off = i * N; for (const j of act) if (j !== i) dense[off + j]++; }
    }
  }
  cx.plastic = false;
  let tot = 0; for (let b = 0; b < nb; b++) tot += occ[b];
  for (let b = 0; b < nb; b++) occ[b] /= tot || 1;
  for (let i = 0; i < N; i++) for (let b = 0; b < nb; b++) rate[i][b] /= Math.max(1, occ[b] * tot);
  return { rate, occ, co: wantCo ? { dense, scale: 1 / Math.max(1, coSteps) } : null, coSteps };
}
function coStats(coSteps) {
  let withSig = 0, partners = 0;
  for (let i = 0; i < N; i++) {
    const off = i * N; let k = 0;
    for (let j = 0; j < N; j++) if (dense[off + j] > 0) k++;
    if (k) { withSig++; partners += k; }
  }
  return { frac: withSig / N, meanPartners: withSig ? partners / withSig : 0 };
}
/* per-cell normalisation: judge a cell's partners against its OWN best partner */
function rowScales(coSteps) {
  const rs = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const off = i * N; let mx = 0;
    for (let j = 0; j < N; j++) { const v = dense[off + j]; if (v > mx) mx = v; }
    rs[i] = mx > 0 ? 1 / mx : 0;
  }
  return rs;
}
/* How much of the regrowth sampling mass does the co-activity boost actually contribute,
   against the distance term it multiplies? If the answer is "almost none", the rule cannot
   reshape the graph however much experience it is given, and that is arithmetic, not tuning. */
function ruleArithmetic(scale, rs, nSample) {
  const rnd = S.mulberry32(4242), P = S.sdefaults();
  const inv2s2 = 1 / (2 * P.sigma * P.sigma);
  let fracG = 0, fracR = 0, mxG = 0, mxR = 0, n = 0;
  for (let t = 0; t < (nSample || 40); t++) {
    const i = Math.floor(rnd() * N), off = i * N;
    const xi = pos[i][0], yi = pos[i][1];
    let base = 0, boostG = 0, boostR = 0;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = pos[j][0] - xi, dy = pos[j][1] - yi;
      const loc = Math.exp(-(dx * dx + dy * dy) * inv2s2) + P.pLong;
      const c = dense[off + j];
      const bG = P.rewireBias * c * scale, bR = P.rewireBias * c * rs[i];
      base += loc; boostG += loc * bG; boostR += loc * bR;
      if (bG > mxG) mxG = bG;
      if (bR > mxR) mxR = bR;
    }
    if (base > 0) { fracG += boostG / (base + boostG); fracR += boostR / (base + boostR); n++; }
  }
  return { global: fracG / n, perCell: fracR / n, maxBoostGlobal: mxG, maxBoostPerCell: mxR };
}
const meanInfo = (rate, occ) => {
  const I = [];
  for (let i = 0; i < N; i++) { const v = AG.spatialInfo(rate[i], occ); if (v > 0) I.push(v); }
  I.sort((a, b) => b - a);
  return { mean: I.length ? mean(I) : 0,
           top10: I.length ? mean(I.slice(0, Math.ceil(0.1 * I.length))) : 0, nTuned: I.length };
};

/* ---------------- 4. THE DECISIVE TEST ---------------- */
console.log("\n" + clock() + " == 4. does the graph move, with scale AND experience AND participation? (P3) ==");
{
  const before = S.report(cortex, N, K, SEED, SAMP);
  console.log("  " + clock() + " running experience 0 …");
  let e = experience(cortex, true, true);
  const cs = coStats(e.coSteps);
  out.coactivity = { movement10k: cs, movement2400: { frac: 0.595, meanPartners: 977 },
                     staticEight: { frac: 0.564, meanPartners: 208.2 } };
  console.log("  " + clock() + " co-activity: " + f(100 * cs.frac, 1) + "% of cells have a co-active partner, " +
              "mean " + f(cs.meanPartners, 0) + " partners");
  console.log("             stage 23 (N=2400, no homeostat):  59.5%, mean 977");
  ok("every cell now has co-active partners", cs.frac > 0.95,
     f(100 * cs.frac, 1) + "% vs 59.5% at stage 23");

  const hist = [];
  for (let ep = 0; ep < EPISODES; ep++) {
    const st = S.pruneAndRewire(cortex, pos, e.co, {}, SEED + ep);
    e = experience(cortex, true, true);
    const r = S.report(cortex, N, K, SEED, SAMP);
    hist.push({ ep, pruned: st.pruned, grown: st.grown, sigma: r.sigma, C: r.C, L: r.L,
                cv: r.degree.cv, richClub: r.degree.richClub, logSkew: r.weights.logSkew });
    console.log("  " + clock() + " episode " + ep + "   pruned " + String(st.pruned).padStart(6) +
                "   σ " + f(r.sigma, 2) + "   clustering " + f(r.C) + "   path " + f(r.L, 2) +
                "   degree CV " + f(r.degree.cv) + "   rich club " + f(r.degree.richClub, 2));
  }
  const after = S.report(cortex, N, K, SEED, SAMP);
  out.rewire = { N, before, after, hist };
  out.lastCoSteps = e.coSteps;
  console.log("\n  measure              before      after      (stage 23, N = 2400)");
  const row = (n, a, b, ref, d) => console.log("  " + n.padEnd(20) + f(a, d || 3).padStart(7) +
    "   " + f(b, d || 3).padStart(8) + "     " + ref);
  row("small-world σ", before.sigma, after.sigma, "1.50 → 1.53", 2);
  row("clustering", before.C, after.C, "0.074 → 0.076");
  row("path length", before.L, after.L, "1.97 → 1.97", 2);
  row("degree CV", before.degree.cv, after.degree.cv, "0.086 → 0.111");
  row("rich club", before.degree.richClub, after.degree.richClub, "1.57 → 1.99", 2);
  row("log-weight skew", before.weights.logSkew, after.weights.logSkew, "—", 2);

  ok("rewiring raises σ once scale, experience and participation are all supplied (P3)",
     after.sigma > before.sigma + 0.05, "σ " + f(before.sigma, 2) + " → " + f(after.sigma, 2));
  ok("…and the degree distribution moves further than at N = 2400",
     after.degree.cv > before.degree.cv + 0.02,
     "CV " + f(before.degree.cv) + " → " + f(after.degree.cv));

  // Function must survive: a network that rewires beautifully and cannot recall is vandalised.
  // Run it on a CLONE — C.encode() is plastic, so testing recall on `cortex` itself would
  // overwrite the weights movement wrote, and §5 would then read out a network that had been
  // retrained on eight static stimuli.
  const probe = C.create({ seed: SEED, NC: N, nStim: 8 });
  probe.preIdx = cortex.preIdx.map(x => Int32Array.from(x));
  probe.preW = cortex.preW.map(x => Float64Array.from(x));
  C.encode(probe);
  const fn = recall(probe), sp = sparsity(probe);
  out.rewire.fn = { sparsity: sp, recall: fn.recall, offTarget: fn.offTarget };
  console.log("\n  " + clock() + " FUNCTION CONTROL after rewiring: sparsity " + f(sp, 1) +
              "%   recall " + f(fn.recall) + "   off-target " + f(fn.offTarget));
  ok("function survives rewiring at N = " + N,
     sp >= 2 && sp <= 12 && fn.recall > 0.6 && fn.offTarget < fn.recall - 0.15,
     "still sparse, still completing, still separate");
}

/* ---------------- 4b. the rule's own arithmetic, and a representation fix ---------------- */
console.log("\n" + clock() + " == 4b. can this rule reshape ANY graph? — the sampling arithmetic ==");
{
  const scale = 1 / Math.max(1, out.lastCoSteps);
  const rs = rowScales(out.lastCoSteps);
  const ar = ruleArithmetic(scale, rs, 40);
  out.arithmetic = ar;
  console.log("  share of the regrowth sampling mass contributed by the co-activity boost,");
  console.log("  against the distance term it multiplies (mean over 40 sampled cells):");
  console.log("    global normalisation (as shipped)  : " + f(100 * ar.global, 2) +
              "%   max boost ×" + f(1 + ar.maxBoostGlobal, 2));
  console.log("    per-cell normalisation             : " + f(100 * ar.perCell, 2) +
              "%   max boost ×" + f(1 + ar.maxBoostPerCell, 2));
  console.log("");
  console.log("  The shipped rule normalises the co-activity trace by the GLOBAL maximum. A cell");
  console.log("  has no access to that; it can only compare its partners with each other. Judging");
  console.log("  each cell's partners against its OWN best partner is the same competitive logic");
  console.log("  as the subtractive weight normalisation cortex.js already uses, so it is a");
  console.log("  representation fix and not a knob — but it is a CHANGE, so it is run below as a");
  console.log("  separate, separately-reported experiment rather than folded into §4.");
}

console.log("\n" + clock() + " == 4c. rewiring with per-cell co-activity normalisation ==");
{
  const cx2 = C.create({ seed: SEED, NC: N, nStim: 8 });
  cx2.preIdx = con0.preIdx.map(x => Int32Array.from(x));
  cx2.preW = con0.preW.map(x => Float64Array.from(x));
  const before = S.report(cx2, N, K, SEED, SAMP);
  let e = experience(cx2, true, true);
  const hist = [];
  for (let ep = 0; ep < EPISODES; ep++) {
    const co = { dense, rowScale: rowScales(e.coSteps) };
    const st = S.pruneAndRewire(cx2, pos, co, {}, SEED + ep);
    e = experience(cx2, true, true);
    const r = S.report(cx2, N, K, SEED, SAMP);
    hist.push({ ep, pruned: st.pruned, sigma: r.sigma, C: r.C, L: r.L,
                cv: r.degree.cv, richClub: r.degree.richClub });
    console.log("  " + clock() + " episode " + ep + "   pruned " + String(st.pruned).padStart(6) +
                "   σ " + f(r.sigma, 2) + "   clustering " + f(r.C) + "   path " + f(r.L, 2) +
                "   degree CV " + f(r.degree.cv) + "   rich club " + f(r.degree.richClub, 2));
  }
  const after = S.report(cx2, N, K, SEED, SAMP);
  C.encode(cx2);
  const fn = recall(cx2), sp = sparsity(cx2);
  out.rewirePerCell = { before, after, hist, fn: { sparsity: sp, ...fn } };
  console.log("\n  measure              before      after      (§4, global normalisation)");
  const g = out.rewire;
  const row = (n, a, b, ref, d) => console.log("  " + n.padEnd(20) + f(a, d || 3).padStart(7) +
    "   " + f(b, d || 3).padStart(8) + "     " + ref);
  row("small-world σ", before.sigma, after.sigma, f(g.before.sigma, 2) + " → " + f(g.after.sigma, 2), 2);
  row("clustering", before.C, after.C, f(g.before.C) + " → " + f(g.after.C));
  row("path length", before.L, after.L, f(g.before.L, 2) + " → " + f(g.after.L, 2), 2);
  row("degree CV", before.degree.cv, after.degree.cv,
      f(g.before.degree.cv) + " → " + f(g.after.degree.cv));
  row("rich club", before.degree.richClub, after.degree.richClub,
      f(g.before.degree.richClub, 2) + " → " + f(g.after.degree.richClub, 2), 2);
  ok("per-cell normalisation lets the rule move the degree distribution further than global",
     after.degree.cv - before.degree.cv > g.after.degree.cv - g.before.degree.cv + 0.01,
     "ΔCV " + f(after.degree.cv - before.degree.cv) + " vs " +
     f(g.after.degree.cv - g.before.degree.cv));
  console.log("  " + clock() + " FUNCTION CONTROL: sparsity " + f(sp, 1) + "%   recall " +
              f(fn.recall) + "   off-target " + f(fn.offTarget));
  ok("function survives per-cell rewiring", sp >= 2 && sp <= 12 && fn.recall > 0.6 &&
     fn.offTarget < fn.recall - 0.15, "still sparse, still completing, still separate");
}

/* ---------------- 5. spatial tuning: the predicted failure ---------------- */
console.log("\n" + clock() + " == 5. spatial tuning — inherited or sharpened? (P4, predicted FAILURE) ==");
{
  // The control must be MATCHED FOR EXPERIENCE, not just un-rewired. The rewired network has
  // been through EPISODES+1 learning passes; a control given one pass would differ in amount of
  // learning as well as in structure, and stage 23's version of this test had exactly that
  // confound. Here the control receives the same number of passes and no structural change.
  const ctl = C.create({ seed: SEED, NC: N, nStim: 8 });
  ctl.preIdx = con0.preIdx.map(x => Int32Array.from(x));
  ctl.preW = con0.preW.map(x => Float64Array.from(x));
  for (let p = 0; p <= EPISODES; p++) experience(ctl, true, false);
  const ec = experience(ctl, false, false);              // readout with weights frozen, as below
  const iC = meanInfo(ec.rate, ec.occ);
  const eR = experience(cortex, false, false);           // rewired network, weights frozen
  const iR = meanInfo(eR.rate, eR.occ);
  out.spatial = { control: iC, rewired: iR };
  console.log("  spatial information (Skaggs, bits):   mean      top decile   cells tuned");
  console.log("    control, " + (EPISODES + 1) + " passes, NOT rewired       " + f(iC.mean) + "      " + f(iC.top10) +
              "        " + iC.nTuned);
  console.log("    rewired                             " + f(iR.mean) + "      " + f(iR.top10) +
              "        " + iR.nTuned);
  console.log("    stage 23 (N = 2400)                  1.230        4.332");
  const sharpened = iR.top10 > iC.top10 * 1.05;
  if (sharpened) {
    ok("rewiring sharpens spatial tuning — CONTRARY to the registered prediction (P4)", true,
       "top decile " + f(iC.top10) + " → " + f(iR.top10) + " — treat this with suspicion, not " +
       "satisfaction: with no path integration anywhere in the model there is no mechanism " +
       "that should produce it, so audit the measure first");
  } else {
    console.log("  FAIL as predicted (P4)   rewiring does not sharpen spatial tuning");
    console.log("    top decile " + f(iC.top10) + " (control) vs " + f(iR.top10) + " (rewired).");
    console.log("    Registered in advance, and it is the right answer for the right reason:");
    console.log("    there is no PATH INTEGRATION anywhere in this model. Position is never");
    console.log("    computed, only inherited from a sensory vector that happens to vary smoothly");
    console.log("    with it. Until a recurrent attractor maintains position from velocity, every");
    console.log("    'place field' in this project is a boundary-and-landmark tuning curve seen");
    console.log("    from the wrong side, and calling it a place cell would be false.");
    fail++;
  }
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "scale10k.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
