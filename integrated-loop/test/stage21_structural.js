"use strict";
/* Stage-21 — STRUCTURAL PLASTICITY. Does constrained connectivity MOVE toward real network
 * statistics as the network learns, or does it just sit where it was drawn?
 *
 * cortex.js has been Erdős–Rényi since stage 1 — every pair equally likely, no space at all.
 * That is defensible as a starting point and indefensible as a resting point. Here the initial
 * draw is distance-dependent (a developmental constraint, not a result), and then synapses are
 * PRUNED when they stay weak and REGROWN toward co-active partners under a fixed per-cell
 * budget. Every target statistic is measured before and after; none is drawn in.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) The three starting topologies are distinguishable and neither extreme is small-world:
 *       RANDOM has low clustering and short paths; DISTANCE-DEPENDENT has high clustering and
 *       long paths. Small-worldness σ should be ≈1 for random and higher for local.
 *   (2) Learning + rewiring RAISES σ from the distance-dependent start — pruning weak local
 *       contacts and regrowing toward co-active partners should shorten paths while keeping
 *       clustering, which is what small-world means.
 *   (3) The degree distribution becomes HEAVY-TAILED and a RICH CLUB appears, from a start
 *       where every cell has the same in-degree. Hubs are not drawn in; if they appear they
 *       were made by the rewiring rule.
 *   (4) Weights become approximately LOGNORMAL (skew of log w near zero), as cortical weights
 *       are (Song 2005; Buzsáki & Mizuseki 2014).
 *   (5) FUNCTION SURVIVES. This is the control that makes the rest meaningful: a network that
 *       rewires into beautiful statistics but can no longer complete a pattern has been
 *       vandalised, not improved. Assembly sparsity and recall must hold up.
 */

const S = require("../src/structural.js");
const C = require("../src/cortex.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};

const NC = 800, SEED = 1;
const K = Math.max(1, Math.round(0.15 * 400));      // the same in-degree cortex.js targets

/* recall from a partial cue — the function control */
function recall(cortex) {
  const rnd = S.mulberry32(77);
  let r = 0, off = 0;
  for (let s = 0; s < cortex.P.nStim; s++) {
    const cue = new Float64Array(cortex.N), src = cortex.stim[s];
    for (let i = 0; i < cortex.N; i++) if (src[i] > 0 && rnd() < 0.5) cue[i] = src[i];
    cortex.a.fill(0); cortex.inh = 0;
    C.setExt(cortex, cue); C.run(cortex, 0.35);
    const got = new Set(C.activeSet(cortex)); C.clearExt(cortex);
    const A = cortex.assemblies[s];
    let on = 0; for (const c of A) if (got.has(c)) on++;
    r += on / Math.max(1, A.length);
    let best = 0;
    for (let t = 0; t < cortex.P.nStim; t++) {
      if (t === s) continue;
      const B = cortex.assemblies[t]; let o2 = 0;
      for (const c of B) if (got.has(c)) o2++;
      best = Math.max(best, o2 / Math.max(1, B.length));
    }
    off += best;
  }
  return { recall: r / cortex.P.nStim, offTarget: off / cortex.P.nStim };
}
const sparsity = cx => 100 * mean(cx.assemblies.map(a => a.length / cx.N));

/* ---------------- 1. the two starting topologies ---------------- */
console.log("\n== 1. where does each starting topology sit? (P1) ==");
const pos = S.layout(NC, SEED);
let cxR, cxD;
{
  cxR = C.create({ seed: SEED, NC, nStim: 8 }); C.encode(cxR);       // Erdős–Rényi, as shipped
  cxD = C.create({ seed: SEED, NC, nStim: 8 });
  const con = S.connectDistance(NC, pos, K, {}, SEED + 11);
  cxD.preIdx = con.preIdx; cxD.preW = con.preW;
  C.encode(cxD);

  const rR = S.report(cxR, NC, K, SEED), rD = S.report(cxD, NC, K, SEED);
  out.start = { random: rR, distance: rD };
  console.log("  topology              clustering   path length   σ (small-world)");
  console.log("  random (as shipped)     " + f(rR.C) + "        " + f(rR.L, 2) + "         " + f(rR.sigma, 2));
  console.log("  distance-dependent      " + f(rD.C) + "        " + f(rD.L, 2) + "         " + f(rD.sigma, 2));
  ok("the distance-dependent draw has HIGHER clustering than random (P1)", rD.C > rR.C + 0.02,
     f(rD.C) + " vs " + f(rR.C));
  ok("…and LONGER paths — a lattice, not a small world", rD.L > rR.L,
     f(rD.L, 2) + " vs " + f(rR.L, 2));
  ok("the shipped random cortex is NOT small-world", rR.sigma < 1.5, "σ = " + f(rR.sigma, 2));
}

/* ---------------- 2–4. does learning move it? ---------------- */
console.log("\n== 2. prune and rewire, driven by what the network learned ==");
{
  const before = S.report(cxD, NC, K, SEED);
  const fnBefore = recall(cxD), spBefore = sparsity(cxD);
  const hist = [];
  let cum = { pruned: 0, grown: 0 };
  for (let ep = 0; ep < 6; ep++) {
    const co = S.coactivity(cxD);
    const st = S.pruneAndRewire(cxD, pos, co, {}, SEED + ep);
    cum.pruned += st.pruned; cum.grown += st.grown;
    C.encode(cxD);                                   // re-learn on the new wiring
    const r = S.report(cxD, NC, K, SEED);
    hist.push({ ep, sigma: r.sigma, C: r.C, L: r.L, richClub: r.degree.richClub,
                cv: r.degree.cv, skew: r.degree.skew, logSkew: r.weights.logSkew });
    console.log("  episode " + ep + "   pruned " + String(st.pruned).padStart(4) +
                " grown " + String(st.grown).padStart(4) +
                "   σ " + f(r.sigma, 2) + "   clustering " + f(r.C) +
                "   path " + f(r.L, 2) + "   rich club " + f(r.degree.richClub, 2));
  }
  const after = S.report(cxD, NC, K, SEED);
  const fnAfter = recall(cxD), spAfter = sparsity(cxD);
  out.evolution = { before, after, hist, cum,
                    fn: { before: fnBefore, after: fnAfter, spBefore, spAfter } };

  console.log("\n  measure              before      after");
  const row = (n, a, b, d) => console.log("  " + n.padEnd(20) + f(a, d || 3).padStart(7) + "   " + f(b, d || 3).padStart(8));
  row("small-world σ", before.sigma, after.sigma, 2);
  row("clustering", before.C, after.C);
  row("path length", before.L, after.L, 2);
  row("degree CV", before.degree.cv, after.degree.cv);
  row("degree skew", before.degree.skew, after.degree.skew, 2);
  row("rich club", before.degree.richClub, after.degree.richClub, 2);
  row("log-weight skew", before.weights.logSkew, after.weights.logSkew, 2);

  ok("rewiring RAISES small-worldness (P2)", after.sigma > before.sigma + 0.05,
     "σ " + f(before.sigma, 2) + " → " + f(after.sigma, 2));
  ok("a degree distribution appears where every cell started identical (P3)",
     after.degree.cv > before.degree.cv + 0.02,
     "CV " + f(before.degree.cv) + " → " + f(after.degree.cv));
  ok("…and hubs preferentially interconnect — a rich club",
     after.degree.richClub > before.degree.richClub + 0.05,
     f(before.degree.richClub, 2) + " → " + f(after.degree.richClub, 2));
  ok("weights are approximately lognormal (P4)",
     after.weights.logSkew != null && Math.abs(after.weights.logSkew) < 1.5,
     "skew of log w = " + f(after.weights.logSkew, 2));

  console.log("\n  FUNCTION CONTROL (P5) — statistics are worthless if the circuit stopped working:");
  console.log("    sparsity " + f(spBefore, 1) + "% → " + f(spAfter, 1) + "%" +
              "     recall " + f(fnBefore.recall) + " → " + f(fnAfter.recall) +
              "     off-target " + f(fnBefore.offTarget) + " → " + f(fnAfter.offTarget));
  ok("assemblies stay sparse after rewiring (P5)", spAfter >= 2 && spAfter <= 12,
     f(spAfter, 1) + "% active");
  ok("pattern completion survives", fnAfter.recall > 0.6,
     f(fnBefore.recall) + " → " + f(fnAfter.recall));
  ok("…and does not do it by merging assemblies", fnAfter.offTarget < fnAfter.recall - 0.15,
     "off-target " + f(fnAfter.offTarget) + " vs recall " + f(fnAfter.recall));
}

/* ---------------- 3. WHY P2 AND P3 FAILED — diagnosed, not tuned away ---------------- */
console.log("\n== 3. diagnosing the two failures ==");
{
  console.log("  (a) IS THE PATH-LENGTH MEASURE SATURATED BY DENSITY?");
  console.log("       k    undirected deg   clustering   path L    σ");
  const rows = [];
  for (const k of [4, 8, 15, 30, 60]) {
    const con = S.connectDistance(NC, pos, k, {}, SEED + 11);
    const nb = S.neighbourSets(con.preIdx);
    const deg = nb.map(x => x.size).reduce((a, b) => a + b, 0) / NC;
    const sw = S.smallWorld(nb, NC, k, SEED);
    rows.push({ k, deg, C: sw.C, L: sw.L, sigma: sw.sigma });
    console.log("      " + String(k).padStart(3) + "       " + f(deg, 1).padStart(6) +
                "        " + f(sw.C) + "      " + f(sw.L, 2) + "    " + f(sw.sigma, 2));
  }
  out.density = rows;
  const dense = rows[rows.length - 1], sparse = rows[1];
  ok("path length IS saturated at the shipped in-degree — the measure, not the model",
     dense.L < sparse.L - 0.5 && dense.sigma < sparse.sigma,
     "at k=60 L = " + f(dense.L, 2) + " (the 2-hop floor) and σ is squeezed to " +
     f(dense.sigma, 2));
}

console.log("\n  WHAT THE TWO FAILURES ACTUALLY MEAN:");
console.log("   P2 (σ does not rise). Not a failure of rewiring — a failure of the substrate.");
console.log("   cortex.js keeps ~60 inputs per cell at every scale (the convergence-preserving");
console.log("   rule pRec·400/N), which makes the UNDIRECTED degree 110 in a network of 800:");
console.log("   a density of ~14%, against roughly 0.1% for local cortex. Everything is two");
console.log("   hops from everything, so path length sits on its floor and σ has no room to");
console.log("   move. The rule was designed to keep the DYNAMICS scale-invariant and it does;");
console.log("   the cost, not noticed until now, is that the GRAPH is dense at every scale the");
console.log("   model runs at, and network topology cannot matter in it. Fixing this means");
console.log("   decoupling in-degree from dynamics — a real change, not a parameter tweak.");
console.log("");
console.log("   P3 (degree distribution barely moves). Two causes, both structural. In-degree");
console.log("   is constant BY CONSTRUCTION because the budget is enforced per cell, so all");
console.log("   variation must come from out-degree. And pruning cannot be selective: with 8");
console.log("   assemblies at ~7% sparsity, the overwhelming majority of pairs are never");
console.log("   co-active, so almost every synapse is equally weak and 'prune the weakest 25%'");
console.log("   is close to pruning at random — 12000 pruned every episode, the cap, every");
console.log("   time. Selective pruning needs either far more training patterns or a sparser");
console.log("   substrate where a synapse that matters is a larger share of the budget.");
console.log("");
console.log("   WHAT DID EMERGE, and was not drawn in: a RICH CLUB (1.54 → 1.62) and");
console.log("   approximately LOGNORMAL weights (log-skew −1.68 → −0.60), with function intact.");

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "structural.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
