"use strict";
/* Stage-48 — THE SIX CONSTRAINTS FIRST, THEN THE TWO PREDICTIONS.
 *
 * Ordered so the model can fail early and cheaply. Rows 1-6 are MEASURED FACTS the model must
 * reproduce; they are not results and no credit is claimed for them. Rows 7-8 are the only untested
 * territory and the only place a contribution could live. The previous model in this project
 * reached a full draft before anyone checked whether it contradicted rows 1 and 2. It did.
 *
 * WHAT IS FITTED AND WHAT MUST EMERGE, stated before running:
 *   FITTED   spindleLoss   — set so density matches Bender's measured -30%. A disease parameter
 *                            calibrated to a disease measurement is not a prediction.
 *   FITTED   couplingLoss  — set so coupling strength falls, matching Bender qualitatively.
 *   EMERGENT coupled spindle-slow-wave RATE. Nothing is tuned to Schiller's 0.51. If fitting the
 *            density gives a coupled rate near 0.51 anyway, that is a real check; if it does not,
 *            the architecture is wrong.
 *
 * REGISTERED:
 *   (C1) density ratio in TLE within 0.05 of 0.70                        [fitted — a check on the fit]
 *   (C2) coupling strength in TLE below control
 *   (C3) coupled-rate ratio within 0.12 of Schiller's 0.51               [EMERGENT — the real test]
 *   (C4) IED-coincident spindles longer and larger than normal ones
 *   (C5) IED-induced spindles morphologically identical to normal ones
 *   (C6) across a cohort, |rho(spindle density, IED rate)| < 0.4         [Bender's null]
 *   (C7) coincidence fraction predicts one-week recall better than IED rate does
 *   (C8) a CORRUPTED spindle is worse than an ABSENT one, matched on delivering spindles.
 *        Registered kill criterion: if corrupted is not worse under ANY ripple budget, the
 *        hypothesis collapses into rate-reduction and adds nothing. Reported as failure, not
 *        reinterpreted.
 */

const S = require("../src/spindlecorrupt.js");

let pass = 0, fail = 0;
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? " n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "\n          " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "\n          " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SEEDS = [1, 2, 3, 4];
const ORDER = Array.from({ length: 16 }, (_, i) => i);

function spearman(xs, ys) {
  const rank = a => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length); let k = 0;
    while (k < idx.length) { let j = k;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[k][0]) j++;
      const avg = (k + j) / 2 + 1;
      for (let m = k; m <= j; m++) r[idx[m][1]] = avg; k = j + 1; }
    return r; };
  const rx = rank(xs), ry = rank(ys), mx = mean(rx), my = mean(ry);
  let nu = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) { nu += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx > 0 && dy > 0 ? nu / Math.sqrt(dx * dy) : 0;
}

console.log("\n" + clock() + " building and calibrating " + SEEDS.length + " subjects...");
const SUBJ = SEEDS.map(s => { const M = S.buildSubject(s, ORDER); S.calibrate(M, {}); return M; });

function run(prof) {
  const dens = [], cpl = [], cs = [], dur = [], amp = [], cf = [], rec = [], wr = [];
  for (const M of SUBJ) {
    S.resetCortical(M); M._hc = new Map();
    const n = S.runNight(M, prof);
    dens.push(n.spindleDensity); cpl.push(n.coupledRate); cs.push(n.couplingStrength);
    dur.push(n.meanDuration); amp.push(n.meanAmplitude); cf.push(n.coincidenceFraction);
    wr.push(n.wastedRipples);
    rec.push(S.recallAtDelay(M, 7, prof).recall);
  }
  return { density: mean(dens), coupledRate: mean(cpl), couplingStrength: mean(cs),
           duration: mean(dur), amplitude: mean(amp), coincidenceFraction: mean(cf),
           wasted: mean(wr), recall: mean(rec) };
}

/* ---------------- constraints 1-3 ---------------- */
console.log("\n" + clock() + " == constraints 1-3: the EEG phenotype ==");
const HEALTHY = run({});
let TLE = null, fittedLoss = null;
{
  // fit spindleLoss to the measured -30% density; everything else is then read off
  let best = null;
  for (const sl of [0.30, 0.40, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75]) {
    const prof = { iedRate: 30, spindleLoss: sl, couplingLoss: 0.22 };
    const r = run(prof);
    const err = Math.abs(r.density / HEALTHY.density - 0.70);
    if (!best || err < best.err) best = { err, sl, r, prof };
  }
  fittedLoss = best.sl; TLE = best.r;
  out.healthy = HEALTHY; out.tle = TLE; out.fittedSpindleLoss = fittedLoss;

  console.log("  fitted spindleLoss = " + f(fittedLoss) + "  (fitted to density, nothing else)");
  console.log("  measure                  healthy     TLE    ratio   target");
  console.log("  spindle density /min     " + f(HEALTHY.density, 2).padStart(7) +
              f(TLE.density, 2).padStart(8) + f(TLE.density / HEALTHY.density).padStart(9) + "     0.70");
  console.log("  coupling strength        " + f(HEALTHY.couplingStrength).padStart(7) +
              f(TLE.couplingStrength).padStart(8) + f(TLE.couplingStrength / HEALTHY.couplingStrength).padStart(9) + "   reduced");
  console.log("  DELIVERING rate /min     " + f(HEALTHY.coupledRate, 2).padStart(7) +
              f(TLE.coupledRate, 2).padStart(8) + f(TLE.coupledRate / HEALTHY.coupledRate).padStart(9) + "     0.51");

  ok("C1 density matches the measured reduction", Math.abs(TLE.density / HEALTHY.density - 0.70) < 0.05,
     "ratio " + f(TLE.density / HEALTHY.density) + " against Bender's 0.70. FITTED, so this checks " +
     "the fit succeeded and claims nothing more.");
  ok("C2 coupling strength is reduced", TLE.couplingStrength < HEALTHY.couplingStrength,
     f(HEALTHY.couplingStrength) + " → " + f(TLE.couplingStrength) + ". Also fitted.");
  const ratio = TLE.coupledRate / HEALTHY.coupledRate;
  ok("C3 the coupled-rate ratio EMERGES near Schiller's measurement", Math.abs(ratio - 0.51) < 0.12,
     "model " + f(ratio) + " against measured 0.51. Nothing was tuned to this number — the only " +
     "fitted quantity was spindle loss, set against a different measurement (density). This is the " +
     "one row in the EEG phenotype that is a genuine check rather than a fit.");
}

/* ---------------- constraints 4-5: morphology ---------------- */
console.log("\n" + clock() + " == constraints 4-5: spindle morphology ==");
{
  const pureCorrupt = run({ iedRate: 60, spindleLoss: fittedLoss, couplingLoss: 0.22, pInduce: 0 });
  const pureInduce = run({ iedRate: 60, spindleLoss: fittedLoss, couplingLoss: 0.22, pCorrupt: 0 });
  out.morphology = { pureCorrupt, pureInduce, healthy: HEALTHY };
  console.log("  condition               duration  amplitude");
  console.log("  normal spindles only    " + f(HEALTHY.duration, 3).padStart(8) + f(HEALTHY.amplitude, 1).padStart(11));
  console.log("  with corruption only    " + f(pureCorrupt.duration, 3).padStart(8) + f(pureCorrupt.amplitude, 1).padStart(11));
  console.log("  with induction only     " + f(pureInduce.duration, 3).padStart(8) + f(pureInduce.amplitude, 1).padStart(11));
  ok("C4 coincident spindles are longer and larger",
     pureCorrupt.duration > HEALTHY.duration + 0.005 && pureCorrupt.amplitude > HEALTHY.amplitude + 0.1,
     "+" + f(1000 * (pureCorrupt.duration - HEALTHY.duration), 0).trim() + " ms and +" +
     f(pureCorrupt.amplitude - HEALTHY.amplitude, 1).trim() + " µV on the population mean, from " +
     "Sákovics's per-spindle +126 ms and +3.4 µV diluted by the uncorrupted majority.");
  ok("C5 induced spindles are morphologically identical",
     Math.abs(pureInduce.duration - HEALTHY.duration) < 0.002 &&
     Math.abs(pureInduce.amplitude - HEALTHY.amplitude) < 0.05,
     "duration and amplitude unchanged. They are counted by a detector and carry nothing — normal " +
     "morphology is not normal function, and that distinction is what makes this compatible with " +
     "Sákovics rather than contradicted by it.");
}

/* ---------------- constraint 6 and prediction 7: what predicts? ---------------- */
console.log("\n" + clock() + " == C6 and C7: rate vs coincidence across a cohort ==");
{
  const rnd = S.mulberry32(90210);
  const rate = [], coinc = [], dens = [], week = [];
  for (let i = 0; i < 32; i++) {
    // discharge rate and disease severity vary INDEPENDENTLY, as they do across patients
    const iedRate = 5 + rnd() * 75, sl = 0.2 + rnd() * 0.5;
    const M = SUBJ[i % SUBJ.length];
    const prof = { iedRate, spindleLoss: sl, couplingLoss: 0.22, rippleBudget: 0.7 };
    S.resetCortical(M); M._hc = new Map();
    const n = S.runNight(M, prof);
    rate.push(n.iedRatePerMin); coinc.push(n.coincidenceFraction); dens.push(n.spindleDensity);
    week.push(S.recallAtDelay(M, 7, prof).recall);
  }
  const rhoDensRate = spearman(dens, rate), rhoWeekRate = spearman(rate, week),
        rhoWeekCoinc = spearman(coinc, week);
  out.cohort = { n: rate.length, rhoDensRate, rhoWeekRate, rhoWeekCoinc };
  console.log("  rho(spindle density, IED rate)      = " + f(rhoDensRate) + "   [Bender: null]");
  console.log("  rho(1-week recall, IED rate)        = " + f(rhoWeekRate));
  console.log("  rho(1-week recall, COINCIDENCE fr.) = " + f(rhoWeekCoinc) + "   ← the prediction");
  ok("C6 spindle density does not track discharge rate", Math.abs(rhoDensRate) < 0.4,
     "|rho| = " + f(Math.abs(rhoDensRate)) + ". Reproduces Bender's null because the density deficit " +
     "is modelled as disease-level and discharge-independent — which concedes the EEG phenotype to " +
     "the rate-reduction account rather than claiming it.");
  ok("C7 coincidence fraction outpredicts discharge rate", Math.abs(rhoWeekCoinc) > Math.abs(rhoWeekRate),
     "|rho| " + f(Math.abs(rhoWeekCoinc)) + " for coincidence against " + f(Math.abs(rhoWeekRate)) +
     " for rate. If true in patients, it explains why studies correlating memory against spike " +
     "counts return inconsistent answers, and says what to measure instead.");
}

/* ---------------- prediction 8: the discriminating one ---------------- */
console.log("\n" + clock() + " == C8: is a corrupted spindle worse than an absent one? ==");
{
  S.resetCortical(SUBJ[0]);
  const target = HEALTHY.coupledRate * 0.55;
  const rows = [];
  console.log("  matched on DELIVERING spindles/min = " + f(target, 2));
  console.log("  budget |  absence: deliv  1wk  |  corruption: deliv wasted  1wk  |  difference");
  for (const b of [Infinity, 1.5, 1.0, 0.7, 0.5]) {
    const fit = (mk, vals) => { let best = null;
      for (const v of vals) { const prof = mk(v); const r = run(prof);
        if (!best || Math.abs(r.coupledRate - target) < Math.abs(best.r.coupledRate - target))
          best = { prof, r }; }
      return best; };
    const A = fit(sl => ({ iedRate: 0, spindleLoss: sl, rippleBudget: b }),
                  [0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65]);
    const Cc = fit(ir => ({ iedRate: ir, spindleLoss: 0.05, rippleBudget: b }),
                   [10, 20, 30, 40, 60, 80, 100, 130]);
    const diff = Cc.r.recall - A.r.recall;
    rows.push({ budget: b === Infinity ? null : b, absent: A.r.recall, corrupt: Cc.r.recall,
                diff, wasted: Cc.r.wasted, delivA: A.r.coupledRate, delivC: Cc.r.coupledRate });
    console.log("  " + String(b === Infinity ? "inf" : b).padStart(6) + " |  " +
                f(A.r.coupledRate, 2).padStart(11) + f(A.r.recall).padStart(7) + "  |  " +
                f(Cc.r.coupledRate, 2).padStart(14) + f(Cc.r.wasted, 0).padStart(7) +
                f(Cc.r.recall).padStart(7) + "  |  " + f(diff).padStart(10));
  }
  out.row8 = rows;
  const anyWorse = rows.some(r => r.diff < -0.05);
  const abundant = rows.filter(r => r.budget === null || r.budget >= 1.0);
  const limiting = rows.filter(r => r.budget !== null && r.budget < 1.0);
  ok("C8 corruption is worse than absence — under SOME budget", anyWorse,
     "worst difference " + f(Math.min(...rows.map(r => r.diff))) + ". The registered kill criterion " +
     "was that if corruption is never worse, the hypothesis collapses into rate-reduction.");
  console.log("");
  console.log("  AND THE CONDITION IS THE RESULT, not a caveat. With an abundant ripple budget the");
  console.log("  difference is " + f(mean(abundant.map(r => r.diff))) + " — corruption and absence are");
  console.log("  indistinguishable, because a wasted replay event costs nothing when replay is free.");
  console.log("  With a limiting budget it is " + f(mean(limiting.map(r => r.diff))) + ".");
  console.log("");
  console.log("  So the hypothesis REQUIRES hippocampal replay to be a scarce resource relative to");
  console.log("  spindles. That is not an escape clause: it is a measurable claim about ripple");
  console.log("  availability, and if replay turns out to be abundant this account reduces exactly");
  console.log("  to the rate-reduction one and should be abandoned.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "constraints.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
