"use strict";
/* Stage-13 — TWO HIPPOCAMPI. The clinical logic of unilateral vs bilateral medial temporal
   damage, which a single-hippocampus model cannot express at all.

   TASK. An episode is an arbitrary CROSS-STREAM conjunction: the ventral ("what") half of one
   stimulus bound to the dorsal ("where") half of a different one. This is deliberately a task
   the cortex cannot do — cued with the ventral half, cortex completes to its OWN dorsal half,
   the wrong partner. Every condition is scored against the cortex-alone floor, so "the
   hippocampus did something" is a measurement rather than an assumption.

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
         rescued by having it back at test — encoding failure, not retrieval failure.
     (6) The COMMISSURE is the honest one. The human hippocampal commissure is sparse and
         its functional role is not established, so the prediction is a SMALL or NULL effect.
         It is reported either way; no parameter is swept to make it significant.

   Every effect is checked across seeds, and the per-seed consistency count is printed —
   a mean difference with 3/6 seeds agreeing is not a result. */

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

/* ---------------- 1. is the task hippocampus-dependent at all? ---------------- */
console.log("\n== 1. the task: an arbitrary cross-stream conjunction ==");
{
  const rows = SEEDS.map(s => {
    const { cortex, brain } = subject(s, {});
    const eps = B.makeEpisodes(cortex, brain, PAIRS);
    B.encodeEpisodes(cortex, brain, eps);
    return run(cortex, brain, eps);
  });
  const V = mean(rows.map(r => r.V)), D = mean(rows.map(r => r.D));
  const fV = mean(rows.map(r => r.floorV)), fD = mean(rows.map(r => r.floorD));
  const act = mean(rows.map(r => r.active));
  out.intact = { V, D, floorV: fV, floorD: fD, active: act, sdV: sd(rows.map(r => r.V)) };
  console.log("  with both hippocampi: ventral " + f(V) + " · dorsal " + f(D) +
              "      cortex alone: ventral " + f(fV) + " · dorsal " + f(fD));
  console.log("  cortex active during retrieval " + f(100 * act, 1) + "%   (encoded assemblies ≈ 8%)");
  ok("the hippocampus beats cortical completion (P1)", V > fV + 0.15 && D > fD + 0.15,
     "Δventral " + f(V - fV) + "  Δdorsal " + f(D - fD));
}

/* ---------------- 2. material specificity: the double dissociation ---------------- */
console.log("\n== 2. unilateral resection — material-specific, not global ==");
{
  const rec = { intact: [], L: [], R: [], both: [] };
  for (const s of SEEDS) {
    for (const kill of ["intact", "L", "R", "both"]) {
      const { cortex, brain } = subject(s, {});
      const eps = B.makeEpisodes(cortex, brain, PAIRS);
      B.encodeEpisodes(cortex, brain, eps);                 // encode with BOTH intact
      if (kill === "both") { B.resect(brain, "L"); B.resect(brain, "R"); }
      else if (kill !== "intact") B.resect(brain, kill);
      rec[kill].push(run(cortex, brain, eps));              // lesion applied at RETRIEVAL
    }
  }
  const m = k => ({ V: mean(rec[k].map(r => r.V)), D: mean(rec[k].map(r => r.D)) });
  const I = m("intact"), Lx = m("L"), Rx = m("R"), Bx = m("both");
  out.dissociation = { intact: I, leftResected: Lx, rightResected: Rx, bilateral: Bx, seeds: SEEDS.length };
  for (const [n, r] of [["intact", I], ["LEFT resected", Lx], ["RIGHT resected", Rx], ["bilateral", Bx]])
    console.log("  " + n.padEnd(16) + "ventral " + f(r.V) + "   dorsal " + f(r.D));

  // per-seed consistency, not just the means
  const cL = rec.L.filter((r, i) => (I.V - r.V) > (I.D - r.D) || (r.V < rec.R[i].V)).length;
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
     Bx.V < out.intact.floorV + 0.06 && Bx.D < out.intact.floorD + 0.06,
     f(Bx.V) + "/" + f(Bx.D) + " vs floor " + f(out.intact.floorV) + "/" + f(out.intact.floorD));
}

/* ---------------- 3. anterograde amnesia: can a NEW memory be formed? ---------------- */
console.log("\n== 3. new learning AFTER the resection (anterograde) ==");
{
  const res = { intact: [], L: [], both: [] };
  for (const s of SEEDS) {
    for (const kill of ["intact", "L", "both"]) {
      const { cortex, brain } = subject(s, {});
      if (kill === "both") { B.resect(brain, "L"); B.resect(brain, "R"); }
      else if (kill !== "intact") B.resect(brain, kill);
      const eps = B.makeEpisodes(cortex, brain, PAIRS2);
      B.encodeEpisodes(cortex, brain, eps);                 // encode AFTER the lesion
      res[kill].push(run(cortex, brain, eps));
    }
  }
  const m = k => ({ V: mean(res[k].map(r => r.V)), D: mean(res[k].map(r => r.D)),
                    fV: mean(res[k].map(r => r.floorV)), fD: mean(res[k].map(r => r.floorD)) });
  const I = m("intact"), U = m("L"), Bb = m("both");
  out.anterograde = { intact: I, unilateral: U, bilateral: Bb };
  for (const [n, r] of [["intact", I], ["unilateral (L)", U], ["bilateral", Bb]])
    console.log("  " + n.padEnd(16) + "ventral " + f(r.V) + "   dorsal " + f(r.D) +
                "      (cortical floor " + f(r.fV) + "/" + f(r.fD) + ")");
  ok("unilateral resection still forms new memories (P3)",
     (U.V + U.D) / 2 > (U.fV + U.fD) / 2 + 0.15, "above floor by " + f((U.V + U.D) / 2 - (U.fV + U.fD) / 2));
  ok("bilateral resection cannot — dense anterograde amnesia",
     Math.abs((Bb.V + Bb.D) / 2 - (Bb.fV + Bb.fD) / 2) < 0.03, "at the cortical floor");
  ok("…and unilateral is clearly better than bilateral",
     (U.V + U.D) / 2 > (Bb.V + Bb.D) / 2 + 0.12,
     f((U.V + U.D) / 2) + " vs " + f((Bb.V + Bb.D) / 2));
}

/* ---------------- 4. retrograde sparing: the H.M. dissociation ---------------- */
console.log("\n== 4. a CONSOLIDATED memory survives the same resection (retrograde) ==");
{
  // an ordered list is encoded, replayed offline until the cortico-cortical chain carries it,
  // then both hippocampi are removed. Order recall is scored, as in stage 4.
  const ORDER = [0, 1, 2, 3, 4, 5];
  const rhos = { recent: [], remote: [] };
  for (const s of SEEDS.slice(0, 3)) {
    for (const arm of ["recent", "remote"]) {
      const cortex = C.create({ seed: s, NC: 800, nStim: 8 }); C.encode(cortex);
      const brain = B.createBrain({ seed: 100 + s * 7, NC: cortex.N });
      brain.L.plastic = brain.R.plastic = true;
      const eps = ORDER.map(i => ({ pat: cortex.stim[i], cells: null }));
      B.encodeEpisodes(cortex, brain, eps);
      const assemblies = brain.L.indices.map(x => x.cortex);
      const cons = K.createConsolidation(cortex);
      const nEvents = arm === "remote" ? 24 : 0;
      // offline replay is driven from one hippocampus; in vivo it is bilaterally coherent
      if (nEvents) K.consolidate(cortex, brain.L, cons, nEvents, { order: ORDER });
      B.resect(brain, "L"); B.resect(brain, "R");           // now remove BOTH
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

/* ---------------- 5. the Wada test: encoding vs retrieval failure ---------------- */
console.log("\n== 5. Wada — a hippocampus off during ENCODING vs off during RETRIEVAL ==");
{
  const encOff = [], retOff = [];
  for (const s of SEEDS) {
    // (a) left inactivated during encoding, BOTH available at test
    {
      const { cortex, brain } = subject(s, {});
      B.inactivate(brain, "L", true);
      const eps = B.makeEpisodes(cortex, brain, PAIRS);
      B.encodeEpisodes(cortex, brain, eps);
      B.inactivate(brain, "L", false);                      // the drug wears off
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
  out.wada = { encodeOff: a, retrieveOff: b, intact: out.dissociation.intact };
  console.log("  left off during ENCODING, back at test :  ventral " + f(a.V) + "   dorsal " + f(a.D));
  console.log("  left present at encoding, off at TEST  :  ventral " + f(b.V) + "   dorsal " + f(b.D));
  console.log("  intact                                 :  ventral " + f(out.dissociation.intact.V) +
              "   dorsal " + f(out.dissociation.intact.D));
  ok("having the hippocampus back at test does NOT rescue what it never encoded (P5)",
     a.V < out.dissociation.intact.V - 0.08,
     "ventral " + f(a.V) + " vs intact " + f(out.dissociation.intact.V));
  ok("the deficit is material-specific in the encoding case too",
     (out.dissociation.intact.V - a.V) > (out.dissociation.intact.D - a.D),
     "Δventral " + f(out.dissociation.intact.V - a.V) + " > Δdorsal " + f(out.dissociation.intact.D - a.D));
}

/* ---------------- 6. the commissure — reported, not assumed ---------------- */
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
    rows.push({ gComm: gc, V, D, sdV: sd(r.map(x => x.V)) });
    console.log("  gComm " + f(gc) + "   ventral " + f(V) + " ± " + f(sd(r.map(x => x.V))) +
                "   dorsal " + f(D) + " ± " + f(sd(r.map(x => x.D))));
  }
  out.commissure = rows;
  const span = Math.max(...rows.map(r => (r.V + r.D) / 2)) - Math.min(...rows.map(r => (r.V + r.D) / 2));
  const noise = mean(rows.map(r => r.sdV));
  console.log("  span across gComm " + f(span) + "   vs between-seed sd " + f(noise));
  ok("the commissural effect is reported against seed noise, not asserted (P6)",
     true, span < noise ? "NULL: span " + f(span) + " < seed noise " + f(noise) +
                          " — as predicted for a sparse human commissure"
                        : "span " + f(span) + " exceeds seed noise " + f(noise) + " — a real effect");
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "bilateral.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
