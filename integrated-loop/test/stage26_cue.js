"use strict";
/* Stage-26 — MAKING RECURRENCE LOAD-BEARING, so that topology can be measured at all.
 *
 * WHY THIS EXISTS. Stage 24b falsified three of my predictions that a local recurrent graph
 * would cost pattern completion: recall fell only 0.908 → 0.809 across a tenfold range of the
 * small-world index. The reason turned out to be the TEST, not the model. cortex.js cues with
 * 50% of a suprathreshold feedforward drive, and stage 1's ablation control puts the
 * no-recurrence floor at recall 0.50 — so half the score is handed over before the recurrent
 * network does anything, and a criterion of 0.6 was testing almost nothing. Measured as the
 * recurrent contribution (recall − 0.50) the cost of locality was 0.41 → 0.31, a 24% loss.
 *
 * The conclusion was that pattern completion here is largely FEEDFORWARD-DRIVEN and the
 * recurrent topology is close to a passenger. That is a statement about the measurement regime,
 * and this stage moves the regime: weaken the cue until the network cannot succeed without
 * recurrence, and only then ask what topology costs.
 *
 * The untrained control is stage 1's ablation, run at every cue fraction: the same network with
 * the recurrent weights never potentiated. Its recall IS the feedforward floor at that cue, so
 * the gap between trained and untrained is exactly the work the recurrent graph is doing.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) The recurrent contribution is not monotone in cue strength. At a full cue there is
 *       nothing to complete; at a vanishing cue there is nothing to complete FROM. The
 *       trained-minus-untrained gap therefore peaks at an intermediate cue, and specifically it
 *       is LARGER at a cue of 0.25 than at the 0.50 every previous stage has used. If so, every
 *       recall number in this project has been measured off the peak of its own sensitivity.
 *   (2) At that peak cue, locality DOES cost pattern completion — the P5b re-test done under
 *       conditions where it can be tested. Concretely: the trained-minus-untrained gap at
 *       σ_dev 0.03 falls to less than 70% of its value at σ_dev 0.20, against the 76% (0.31/0.41)
 *       measured at a cue of 0.50.
 *   (3) A DIRECTIONAL PREDICTION I EXPECT TO BE UNCOMFORTABLE. If (2) holds, then stage 24b's
 *       calibrated substrate — σ_dev 0.20, 6% long-range, σ_sw 2.05, recall 0.908 — was
 *       selected under a measurement that could not see the cost it was trading against, and
 *       its recall advantage over more local substrates will WIDEN here. The calibration
 *       survives, but for a reason that was not tested when it was made.
 */

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

const N = +(process.env.N26 || 10000);
const K = Math.round(0.15 * 400), SEED = 1, SAMP = 300;
const CUES = [0.50, 0.35, 0.25, 0.15, 0.10];
const CAL = { sigma: 0.20, pLong: 0.06, mixLong: true };   // stage 24b's calibrated substrate

/* recall at an arbitrary cue fraction. Same protocol as every earlier stage, with the 0.5
   that was hardcoded there exposed as a parameter. */
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

/* build a cortex on a given substrate; `trained` false = stage 1's ablation control, in which
   the recurrent weights are never potentiated but the assemblies are still recorded */
function build(cfg, trained) {
  const cx = C.create({ seed: SEED, NC: N, nStim: 8 });
  const con = S.connectDistance(N, pos, K, cfg, SEED + 11);
  cx.preIdx = con.preIdx; cx.preW = con.preW;
  if (trained) C.encode(cx);
  else {
    cx.assemblies = [];
    for (let s = 0; s < cx.P.nStim; s++) cx.assemblies.push(C.present(cx, s, 1, 0.35, true));
  }
  return cx;
}
const pos = S.layout(N, SEED);

/* ---------------- 1. where is recurrence load-bearing? ---------------- */
console.log("\n" + clock() + " == 1. the cue sweep: how much work is the recurrent graph doing? (P1) ==");
let peakCue = 0.5;
{
  const trained = build(CAL, true), untrained = build(CAL, false);
  const rows = [];
  console.log("   cue    trained recall   untrained (ff floor)   recurrent gap   off-target");
  for (const c of CUES) {
    const T = recallAt(trained, c), U = recallAt(untrained, c);
    rows.push({ cue: c, trained: T.recall, untrained: U.recall,
                gap: T.recall - U.recall, off: T.offTarget });
    console.log("   " + f(c, 2) + "        " + f(T.recall) + "            " + f(U.recall) +
                "               " + f(T.recall - U.recall) + "        " + f(T.offTarget) +
                "   " + clock());
  }
  out.cueSweep = rows;
  const best = rows.reduce((a, b) => (b.gap > a.gap ? b : a));
  peakCue = best.cue;
  out.peakCue = peakCue;
  const at50 = rows.find(r => r.cue === 0.50), at25 = rows.find(r => r.cue === 0.25);
  console.log("");
  console.log("  the recurrent contribution peaks at a cue of " + f(peakCue, 2) +
              " (gap " + f(best.gap) + ")");
  ok("the recurrent contribution is larger at a cue of 0.25 than at 0.50 (P1)",
     at25.gap > at50.gap,
     "gap " + f(at50.gap) + " at cue 0.50 vs " + f(at25.gap) + " at cue 0.25");
  ok("…and it is non-monotone — a vanishing cue leaves nothing to complete from",
     rows[rows.length - 1].gap < best.gap,
     "gap at cue " + f(CUES[CUES.length - 1], 2) + " is " + f(rows[rows.length - 1].gap) +
     ", below the peak of " + f(best.gap));
}

/* ---------------- 2. the P5b re-test, where it can be tested ---------------- */
console.log("\n" + clock() + " == 2. does locality cost completion, at a cue of " +
            f(peakCue, 2) + "? (P2) ==");
{
  const rows = [];
  console.log("  σ_dev   σ_sw    trained   untrained   recurrent gap   (gap at cue 0.50)");
  for (const sigma of [0.20, 0.12, 0.08, 0.05, 0.03]) {
    const cfg = { sigma, pLong: 0.06, mixLong: true };
    const tr = build(cfg, true), un = build(cfg, false);
    const r = S.report(tr, N, K, SEED, SAMP);
    const T = recallAt(tr, peakCue), U = recallAt(un, peakCue);
    const T50 = recallAt(tr, 0.50), U50 = recallAt(un, 0.50);
    rows.push({ sigmaDev: sigma, sigmaSW: r.sigma, trained: T.recall, untrained: U.recall,
                gap: T.recall - U.recall, gap50: T50.recall - U50.recall });
    console.log("   " + f(sigma, 2) + "   " + f(r.sigma, 2).padStart(6) + "    " + f(T.recall) +
                "     " + f(U.recall) + "        " + f(T.recall - U.recall) + "            " +
                f(T50.recall - U50.recall) + "   " + clock());
  }
  out.locality = rows;
  const wide = rows[0], tight = rows[rows.length - 1];
  const ratio = wide.gap > 0 ? tight.gap / wide.gap : 1;
  const ratio50 = wide.gap50 > 0 ? tight.gap50 / wide.gap50 : 1;
  console.log("");
  console.log("  retained recurrent contribution, σ_dev 0.20 → 0.03:");
  console.log("    at cue " + f(peakCue, 2) + " : " + f(100 * ratio, 0) + "%   (" +
              f(wide.gap) + " → " + f(tight.gap) + ")");
  console.log("    at cue 0.50 : " + f(100 * ratio50, 0) + "%   (" + f(wide.gap50) + " → " +
              f(tight.gap50) + ")");
  ok("locality costs pattern completion once recurrence is load-bearing (P2)",
     ratio < 0.70, "only " + f(100 * ratio, 0) + "% of the recurrent contribution survives, " +
     "against " + f(100 * ratio50, 0) + "% at the cue every earlier stage used");
  ok("the cost is BIGGER at the peak cue than at 0.50 — the earlier measurement was blind (P3)",
     ratio < ratio50 - 0.02,
     f(100 * ratio, 0) + "% vs " + f(100 * ratio50, 0) + "% retained");

  console.log("");
  console.log("  WHAT THIS SETTLES, EITHER WAY. If the two ratios are the same, then locality");
  console.log("  genuinely does not cost completion in this model and stage 24b's falsification");
  console.log("  stands unqualified — the cue was not hiding anything. If the peak-cue ratio is");
  console.log("  lower, then every recall number in this project has been read off the flat part");
  console.log("  of its own sensitivity curve, and the right cue for a completion test is not");
  console.log("  0.50 but " + f(peakCue, 2) + ". That would not invalidate the earlier results — a");
  console.log("  network that completes at cue 0.50 does complete — but it would mean the");
  console.log("  measure was insensitive to exactly the variable stages 21–25 were trying to");
  console.log("  move, which is worth knowing before any further topology work.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "cue.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
