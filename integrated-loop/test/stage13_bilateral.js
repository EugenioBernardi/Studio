"use strict";
/* Stage-13 — TWO HIPPOCAMPI. The clinical logic of unilateral vs bilateral medial temporal
   damage, which a single-hippocampus model cannot express at all.

   TASK. An episode is an arbitrary CROSS-STREAM conjunction: the ventral ("what") half of one
   stimulus bound to the dorsal ("where") half of a different one. This is deliberately a task
   the cortex cannot do — cued with the ventral half, cortex completes to its OWN dorsal half,
   the wrong partner. Every condition is scored against the cortex-alone floor, so "the
   hippocampus did something" is a measurement rather than an assumption.

   WITHIN SUBJECT. Sections 2 and 5 encode ONCE per seed and then apply the lesion as a flag,
   so every condition is compared against the identical engram. Re-encoding per condition would
   confound the lesion with a fresh random encoding.

   PREDICTIONS REGISTERED BEFORE RUNNING:
     (1) The task is hippocampus-dependent: intact recovery clearly exceeds the cortical floor.
     (2) DOUBLE DISSOCIATION with crossover — left resection costs VENTRAL material more than
         dorsal, right resection the mirror, and each side is worse than the other side's
         lesion on its own preferred material. A single dissociation would not do: an
         "everything is a bit worse" result is what a non-specific lesion looks like.
     (3) Unilateral resection SPARES the ability to form new memories (above floor);
         bilateral resection abolishes it (at floor). This is the clinical fact that makes
         temporal lobectomy an operable procedure.
     (4) A memory already consolidated survives the same bilateral resection that abolishes
         new learning — anterograde and retrograde dissociate (H.M.).
     (5) WADA: a deficit incurred by inactivating one hippocampus DURING ENCODING is not
         rescued by having it back at test.
     (6) The COMMISSURE is the honest one. The human hippocampal commissure is sparse and its
         functional role is not established, so the prediction is a SMALL or NULL effect. It is
         reported either way; no parameter is swept to make it significant.

   Every effect is checked across seeds and the per-seed consistency count is printed — a mean
   difference with 3/6 seeds agreeing is not a result. */

const B = require("../src/bilateral.js");
const C = require("../src/cortex.js");
const H = require("../src/hippocampus.js");
const K = require("../src/consolidate.js");
const LP = require("../src/loop.js");

let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

const PAIRS = [[0, 4], [1, 5], [2, 6], [3, 7]];      // (ventral source, dorsal source)
const PAIRS2 = [[1, 6], [2, 7], [3, 4], [0, 5]];     // a second, disjoint list
const SEEDS = [1, 2, 3, 4, 5, 6];
const SCALE = 0.20, CUE = 0.35;
const out = {};

function subject(seed, bopts) {
  const cortex = C.create({ seed, NC: 800, nStim: 8 }); C.encode(cortex);
  const brain = B.createBrain(Object.assign({ seed: 100 + seed * 7, NC: cortex.N }, bopts));
  return { cortex, brain };
}
const run = (cortex, brain, eps) => B.testList(cortex, brain, eps, { scale: SCALE, cue: CUE });
const setAlive = (brain, l, r) => { brain.alive.L = l; brain.alive.R = r; };

/* ---------------- 1 & 2. dependence, and the double dissociation ---------------- */
console.log("\n== 1. the task: an arbitrary cross-stream conjunction ==");
console.log("== 2. unilateral resection — material-specific, not global ==");
{
  const rec = { intact: [], L: [], R: [], both: [] };
  for (const s of SEEDS) {
    const { cortex, brain } = subject(s, {});
    const eps = B.makeEpisodes(cortex, brain, PAIRS);
    B.encodeEpisodes(cortex, brain, eps);                  // encode ONCE, with both intact
    for (const [kill, l, r] of [["intact", 1, 1], ["L", 0, 1], ["R", 1, 0], ["both", 0, 0]]) {
      setAlive(brain, !!l, !!r);
      rec[kill].push(run(cortex, brain, eps));
    }
  }
  const m = k => ({ V: mean(rec[k].map(r => r.V)), D: mean(rec[k].map(r => r.D)) });
  const I = m("intact"), Lx = m("L"), Rx = m("R"), Bx = m("both");
  const fV = mean(rec.intact.map(r => r.floorV)), fD = mean(rec.intact.map(r => r.floorD));
  const act = mean(rec.intact.map(r => r.active));
  out.intact = { V: I.V, D: I.D, floorV: fV, floorD: fD, active: act };

  console.log("  with both hippocampi: ventral " + f(I.V) + " · dorsal " + f(I.D) +
              "      cortex alone: ventral " + f(fV) + " · dorsal " + f(fD));
  console.log("  cortex active during retrieval " + f(100 * act, 1) + "%   (encoded assemblies ≈ 8%)");
  ok("the hippocampus beats cortical completion (P1)", I.V > fV + 0.15 && I.D > fD + 0.15,
     "Δventral " + f(I.V - fV) + "  Δdorsal " + f(I.D - fD));

  out.dissociation = { intact: I, leftResected: Lx, rightResected: Rx, bilateral: Bx, seeds: SEEDS.length };
  console.log("");
  for (const [n, r] of [["intact", I], ["LEFT resected", Lx], ["RIGHT resected", Rx], ["bilateral", Bx]])
    console.log("  " + n.padEnd(16) + "ventral " + f(r.V) + "   dorsal " + f(r.D));

  const nL = rec.L.filter((r, i) => r.V < rec.R[i].V).length;
  const nR = rec.R.filter((r, i) => r.D < rec.L[i].D).length;
  console.log("  crossover per seed: ventral worse after LEFT " + nL + "/" + SEEDS.length +
              " · dorsal worse after RIGHT " + nR + "/" + SEEDS.length);
  out.dissociation.crossoverL = nL; out.dissociation.crossoverR = nR;

  ok("LEFT resection costs VENTRAL material more than dorsal",
     (I.V - Lx.V) > (I.D - Lx.D), "Δventral " + f(I.V - Lx.V) + " > Δdorsal " + f(I.D - Lx.D));
  ok("RIGHT resection costs DORSAL material more than ventral",
     (I.D - Rx.D) > (I.V - Rx.V), "Δdorsal " + f(I.D - Rx.D) + " > Δventral " + f(I.V - Rx.V));
  ok("CROSSOVER — each side is worse on its own preferred material (P2)",
     Lx.V < Rx.V && Rx.D < Lx.D,
     "ventral " + f(Lx.V) + "(L) vs " + f(Rx.V) + "(R) · dorsal " + f(Rx.D) + "(R) vs " + f(Lx.D) + "(L)");
  ok("…and the crossover holds in most seeds, not just the mean",
     nL >= 5 && nR >= 5, nL + "/" + SEEDS.length + " and " + nR + "/" + SEEDS.length);
  ok("BILATERAL resection abolishes the memory (falls to the cortical floor)",
     Bx.V < fV + 0.06 && Bx.D < fD + 0.06,
     f(Bx.V) + "/" + f(Bx.D) + " vs floor " + f(fV) + "/" + f(fD));
}

/* ---------------- 3. anterograde amnesia: can a NEW memory be formed? ---------------- */
console.log("\n== 3. new learning AFTER the resection (anterograde) ==");
{
  const res = { intact: [], L: [], both: [] };
  for (const s of SEEDS) {
    for (const [kill, l, r] of [["intact", 1, 1], ["L", 0, 1], ["both", 0, 0]]) {
      const { cortex, brain } = subject(s, {});
      setAlive(brain, !!l, !!r);                            // lesion FIRST
      const eps = B.makeEpisodes(cortex, brain, PAIRS2);
      B.encodeEpisodes(cortex, brain, eps);                 // then try to encode
      res[kill].push(run(cortex, brain, eps));
    }
  }
  const m = k => ({ V: mean(res[k].map(r => r.V)), D: mean(res[k].map(r => r.D)),
                    fV: mean(res[k].map(r => r.floorV)), fD: mean(res[k].map(r => r.floorD)) });
  const I = m("intact"), U = m("L"), Bb = m("both");
  out.anterograde = { intact: I, unilateral: U, bilateral: Bb };
  for (const [n, r] of [["intact", I], ["unilateral (L removed)", U], ["bilateral", Bb]])
    console.log("  " + n.padEnd(24) + "ventral " + f(r.V) + "   dorsal " + f(r.D) +
                "      (cortical floor " + f(r.fV) + "/" + f(r.fD) + ")");
  ok("unilateral resection still forms new memories (P3)",
     (U.V + U.D) / 2 > (U.fV + U.fD) / 2 + 0.15, "above floor by " + f((U.V + U.D) / 2 - (U.fV + U.fD) / 2));
  ok("bilateral resection cannot — dense anterograde amnesia",
     Math.abs((Bb.V + Bb.D) / 2 - (Bb.fV + Bb.fD) / 2) < 0.03, "at the cortical floor");
  ok("…and unilateral is clearly better than bilateral",
     (U.V + U.D) / 2 > (Bb.V + Bb.D) / 2 + 0.12,
     f((U.V + U.D) / 2) + " vs " + f((Bb.V + Bb.D) / 2));
  // note the asymmetry the design predicts: the SURVIVING right hippocampus encodes its own
  // preferred material well and the other stream poorly
  console.log("  note: the surviving RIGHT hippocampus encodes dorsal " + f(U.D) +
              " but ventral only " + f(U.V) + " — a new memory is formed, lopsidedly");
}

/* ---------------- 4. retrograde sparing: the H.M. dissociation ---------------- */
console.log("\n== 4. a CONSOLIDATED memory survives the same resection (retrograde) ==");
{
  const ORDER = [0, 1, 2, 3, 4, 5];
  const rhos = { recent: [], remote: [] };
  for (const s of SEEDS.slice(0, 3)) {
    for (const arm of ["recent", "remote"]) {
      const cortex = C.create({ seed: s, NC: 800, nStim: 8 }); C.encode(cortex);
      const brain = B.createBrain({ seed: 100 + s * 7, NC: cortex.N });
      const eps = ORDER.map(i => ({ pat: cortex.stim[i], cells: null }));
      B.encodeEpisodes(cortex, brain, eps);
      const assemblies = brain.L.indices.map(x => x.cortex);
      const cons = K.createConsolidation(cortex);
      // offline replay is driven from one hippocampus; in vivo it is bilaterally coherent
      if (arm === "remote") K.consolidate(cortex, brain.L, cons, 24, { order: ORDER });
      setAlive(brain, false, false);                         // now remove BOTH
      const encRank = {}; ORDER.forEach((_, k) => encRank[k] = k);
      rhos[arm].push(LP.spearman(K.corticalRecall(cortex, cons, assemblies, {}), encRank).rho);
    }
  }
  const rec = mean(rhos.recent), rem = mean(rhos.remote);
  out.retrograde = { recent: rec, remote: rem, recentAll: rhos.recent, remoteAll: rhos.remote };
  console.log("  after BILATERAL resection, cortex-only order recall:");
  console.log("    recent (0 replay events)  ρ " + f(rec) + "   [" + rhos.recent.map(x => f(x)).join(" ") + "]");
  console.log("    remote (24 replay events) ρ " + f(rem) + "   [" + rhos.remote.map(x => f(x)).join(" ") + "]");
  ok("remote memory survives the resection that abolishes new learning (P4)",
     rem > 0.8 && rem > rec + 0.5, "ρ " + f(rem) + " vs recent " + f(rec));
}

/* ---------------- 5. the Wada test ---------------- */
console.log("\n== 5. Wada — a hippocampus inactivated during ENCODING ==");
{
  const encOff = [], retOff = [], engram = [];
  for (const s of SEEDS) {
    // (a) left inactivated during encoding; the drug then wears off before the test
    {
      const { cortex, brain } = subject(s, {});
      B.inactivate(brain, "L", true);
      const eps = B.makeEpisodes(cortex, brain, PAIRS);
      B.encodeEpisodes(cortex, brain, eps);
      B.inactivate(brain, "L", false);                      // BOTH available at test
      let nz = 0; for (let i = 0; i < brain.L.NC; i++) for (const w of brain.L.Wec.wt[i]) if (w > 0) nz++;
      engram.push(nz);
      encOff.push(run(cortex, brain, eps));
    }
    // (b) both available at encoding, left inactivated only at test
    {
      const { cortex, brain } = subject(s, {});
      const eps = B.makeEpisodes(cortex, brain, PAIRS);
      B.encodeEpisodes(cortex, brain, eps);
      B.inactivate(brain, "L", true);
      retOff.push(run(cortex, brain, eps));
    }
  }
  const a = { V: mean(encOff.map(r => r.V)), D: mean(encOff.map(r => r.D)) };
  const b = { V: mean(retOff.map(r => r.V)), D: mean(retOff.map(r => r.D)) };
  const I = out.dissociation.intact;
  out.wada = { encodeOff: a, retrieveOff: b, intact: I, engramSynapses: mean(engram) };
  console.log("  left off during ENCODING, back at test :  ventral " + f(a.V) + "   dorsal " + f(a.D));
  console.log("  left present at encoding, off at TEST  :  ventral " + f(b.V) + "   dorsal " + f(b.D));
  console.log("  intact                                 :  ventral " + f(I.V) + "   dorsal " + f(I.D));
  console.log("  bound output synapses in the left hippocampus after encoding without it: " +
              mean(engram).toFixed(0));
  ok("a hippocampus that was off during encoding holds NO engram", mean(engram) === 0,
     "Wec nonzero synapses = " + mean(engram).toFixed(0));
  ok("having it back at test does not rescue the memory (P5)", a.V < I.V - 0.08,
     "ventral " + f(a.V) + " vs intact " + f(I.V));
  ok("the deficit is material-specific in the encoding case too",
     (I.V - a.V) > (I.D - a.D), "Δventral " + f(I.V - a.V) + " > Δdorsal " + f(I.D - a.D));
  // Stated rather than dressed up: the two rows above are IDENTICAL, and necessarily so.
  // A hippocampus with no bound output synapses contributes exactly what an absent one does,
  // so "off at encoding" and "off at retrieval" are the same arithmetic here. That equality is
  // the Wada test's whole premise — the question is what the REMAINING side can carry — but it
  // is a consequence of the construction, not an emergent dissociation, and is reported as such.
  console.log("  (the two lesion rows are numerically identical, and necessarily: a hippocampus");
  console.log("   with no bound output contributes exactly what an absent one does. That is the");
  console.log("   Wada premise, not an emergent finding — this model cannot dissociate encoding");
  console.log("   from retrieval failure, because it has no partial engram to retrieve from.)");
}

/* ---------------- 6. the commissure — measured, then reported ---------------- */
console.log("\n== 6. what does the hippocampal commissure actually buy? ==");
{
  const rows = [];
  for (const gc of [0, 0.15, 0.4, 0.8]) {
    const r = SEEDS.slice(0, 4).map(s => {
      const { cortex, brain } = subject(s, { gComm: gc });
      const eps = B.makeEpisodes(cortex, brain, PAIRS);
      B.encodeEpisodes(cortex, brain, eps);
      return run(cortex, brain, eps);
    });
    const V = mean(r.map(x => x.V)), D = mean(r.map(x => x.D));
    rows.push({ gComm: gc, V, D, sdV: sd(r.map(x => x.V)), sdD: sd(r.map(x => x.D)) });
    console.log("  gComm " + f(gc) + "   ventral " + f(V) + " ± " + f(sd(r.map(x => x.V))) +
                "   dorsal " + f(D) + " ± " + f(sd(r.map(x => x.D))));
  }
  // WHY it comes out this way — measure what fraction of CA3 drive the commissure supplies
  const share = [];
  for (const gc of [0.15, 0.8]) {
    const { cortex, brain } = subject(1, { gComm: gc });
    const eps = B.makeEpisodes(cortex, brain, PAIRS);
    B.encodeEpisodes(cortex, brain, eps);
    const rnd = H.mulberry32(4242);
    const sp = B.splitEpisode(eps[0], brain.L.cxStream, CUE, rnd);
    const cueV = new Float64Array(cortex.N); for (const c of sp.cue) cueV[c] = 1.0;
    cortex.a.fill(0); cortex.inh = 0; C.setExt(cortex, cueV); C.run(cortex, 0.35);
    const cueA = Float64Array.from(cortex.a); C.clearExt(cortex);
    B.settleForwardBoth(brain, cueA, 1, 0.15);              // reset, then step manually
    const dr = { L: B.driveFor(brain, "L", cueA), R: B.driveFor(brain, "R", cueA) };
    let mf = 0, pp = 0, rc = 0, cm = 0;
    for (let t = 0; t < 80; t++) {
      B.exchange(brain);
      for (const s of ["L", "R"]) H.forwardStep(brain[s], dr[s]);
      const h = brain.L;
      for (let i = 0; i < h.P.NCA3; i++) {
        mf = Math.max(mf, H.dot(h.Wdc, i, h.dg)); pp = Math.max(pp, H.dot(h.Wec3, i, h.ec2));
        rc = Math.max(rc, H.dot(h.Rca3, i, h.ca3)); cm = Math.max(cm, h.commIn[i]);
      }
    }
    share.push({ gComm: gc, mossy: mf, perforant: pp, recurrent: rc, commissural: cm,
                 pct: 100 * cm / (mf + pp + rc) });
    console.log("  peak CA3 drive at gComm " + gc + ":  mossy " + f(mf, 1) + "  perforant " + f(pp, 1) +
                "  recurrent " + f(rc, 1) + "  COMMISSURAL " + f(cm, 2) +
                "   → " + f(share[share.length - 1].pct, 1) + "% of CA3 drive");
  }
  out.commissure = { rows, share };
  const span = Math.max(...rows.map(r => (r.V + r.D) / 2)) - Math.min(...rows.map(r => (r.V + r.D) / 2));
  const noise = mean(rows.map(r => r.sdV));
  out.commissure.span = span; out.commissure.noise = noise;
  console.log("  span across gComm " + f(span, 3) + "   vs between-seed sd " + f(noise));
  ok("the commissural drive actually reaches CA3 (so a null is a null, not a dead wire)",
     share[0].commissural > 0, "peak commissural drive " + f(share[0].commissural, 3));
  ok("NULL RESULT, with a mechanism (P6)", span < noise,
     "span " + f(span, 3) + " < seed noise " + f(noise) + " — the mossy fibre is a detonator at " +
     f(share[0].mossy, 0) + ", so a sparse commissure at " + f(share[0].pct, 1) +
     "% of CA3 drive cannot change which index wins");
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "bilateral.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
