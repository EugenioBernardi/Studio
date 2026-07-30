"use strict";
/* Stage-43 — ACCELERATED LONG-TERM FORGETTING AS HIJACKED CONSOLIDATION.
 *
 * PREDICTIONS REGISTERED BEFORE THE MULTI-SEED RUN. An exploratory single-subject probe was run
 * while building the model (that is what showed the first two versions returned 1.00 everywhere and
 * forced the two biological corrections: salience-biased replay instead of round-robin, and
 * calibration against normal human delayed recall instead of against perfect consolidation). These
 * thresholds are fixed from that probe and are now tested on 8 subjects.
 *
 *   (P1) THE PHENOTYPE EMERGES. At a moderate coupled IED burden, 30-minute recall sits within 0.10
 *        of healthy while 1-week recall is at least 0.25 below it. Neither delay is fitted: the
 *        early sparing comes from the surviving hippocampal route, the late loss from what the
 *        night failed to consolidate.
 *   (P2) BIOMARKER CHANGE WITHOUT MEMORY CHANGE. At matched discharge rate, coupling = 0 and
 *        coupling = 1 raise spindle density and SO–spindle coupling strength by SIMILAR amounts —
 *        the discharges and the spindles they induce are present either way — yet only the coupled
 *        case loses memory. So the EEG changes in both and the memory changes in one, which means
 *        no amount of spindle measurement can separate them.
 *        HONESTY NOTE. An earlier version of P2 asked whether uncoupled discharges leave recall
 *        near healthy, and it FAILED — for a harness reason, not a biological one. A single random
 *        stream let the discharge loop's draws shift the stream deciding whether a physiological
 *        spindle occurred, so raising the discharge rate perturbed the spindle schedule even with
 *        nothing captured, and the "matched" control had 11% fewer coupling slots (317 vs 355).
 *        With independent streams the uncoupled night is now identical to healthy by construction,
 *        which makes the memory half of that question definitional and not worth scoring. What is
 *        NOT definitional, and is what P2 now tests, is that the biomarkers move anyway.
 *   (P3) THE INVERTED BIOMARKER. Across rising coupled burden, spindle density RISES and SO–spindle
 *        coupling strength RISES while 1-week retention FALLS. The standard sleep biomarkers do not
 *        merely fail here, they point the wrong way.
 *   (P4) RATE IS A POOR PREDICTOR, CAPTURE IS A GOOD ONE. Over a cohort in which IED rate and
 *        coupling vary independently, |rho(1-week recall, IED rate)| < 0.5 while
 *        |rho(1-week recall, replay fraction)| > 0.8. This is the quantitative explanation for the
 *        "contradictory associations" the 2020 review reports.
 *   (P5) A FORGETTING RATE, NOT AN OFFSET. The healthy-minus-patient gap grows monotonically with
 *        delay. A fixed encoding deficit would show a constant gap.
 */

const A = require("../src/alf.js");

let pass = 0, fail = 0;
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? " n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "\n          " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "\n          " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const ORDER = Array.from({ length: 16 }, (_, i) => i);   // a 15-item list, AVLT length
const DELAYS = [0.02, 0.25, 1, 7, 30];                   // ~30 min, 6 h, 1 day, 1 week, 1 month
const LABEL = ["30 min", "6 h", "1 day", "1 week", "1 mo"];

function spearman(xs, ys) {
  const rank = a => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    let k = 0;
    while (k < idx.length) {
      let j = k; while (j + 1 < idx.length && idx[j + 1][0] === idx[k][0]) j++;
      const avg = (k + j) / 2 + 1;
      for (let m = k; m <= j; m++) r[idx[m][1]] = avg;
      k = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys), mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

/* subjects are built and calibrated ONCE; every condition then runs on identical anatomy with the
   cortical weights zeroed between them, and against an identical (cached) hippocampal route */
console.log("\n" + clock() + " building and calibrating " + SEEDS.length + " subjects...");
const SUBJ = SEEDS.map(s => {
  const M = A.buildSubject(s, ORDER);
  const cal = A.calibrateLearningRate(M, {});
  return { M, cal };
});
console.log("  healthy 1-week cortical retention after calibration: " +
            f(mean(SUBJ.map(s => s.cal.achieved))) + " ± " + f(sd(SUBJ.map(s => s.cal.achieved))) +
            "   (target 0.85, anchored to normal human delayed recall)");

/* run one condition on every subject and return per-delay recall plus the night's biomarkers */
function condition(iedRate, coupling) {
  const rec = DELAYS.map(() => []), bio = { density: [], coupling: [], replayFrac: [], rate: [] };
  for (const { M } of SUBJ) {
    A.resetCortical(M);
    const n = A.runNight(M, { iedRate, coupling });
    bio.density.push(n.spindleDensity); bio.coupling.push(n.couplingStrength);
    bio.replayFrac.push(n.replayFraction); bio.rate.push(n.iedRatePerMin);
    DELAYS.forEach((d, i) => rec[i].push(A.recallAtDelay(M, d).recall));
  }
  return { recall: rec.map(mean), recallSd: rec.map(sd),
           density: mean(bio.density), couplingStrength: mean(bio.coupling),
           replayFrac: mean(bio.replayFrac), rate: mean(bio.rate) };
}

/* ---------------- 1. the forgetting curves ---------------- */
console.log("\n" + clock() + " == 1. forgetting curves, 8 subjects, 15-item list ==");
const CONDS = [
  { tag: "healthy",                 ied: 0,  cp: 1.0 },
  { tag: "IED 15/min, coupled",     ied: 15, cp: 1.0 },
  { tag: "IED 30/min, coupled",     ied: 30, cp: 1.0 },
  { tag: "IED 60/min, coupled",     ied: 60, cp: 1.0 },
  { tag: "IED 30/min, UNCOUPLED",   ied: 30, cp: 0.0 },
  { tag: "IED 60/min, UNCOUPLED",   ied: 60, cp: 0.0 },
];
const R = {};
console.log("  condition                  " + LABEL.map(l => l.padStart(8)).join("") +
            "   | density  coupl  replayFrac");
for (const c of CONDS) {
  const r = condition(c.ied, c.cp);
  R[c.tag] = r;
  console.log("  " + c.tag.padEnd(26) + r.recall.map(x => f(x).padStart(8)).join("") +
              "   | " + f(r.density, 1).padStart(6) + "  " + f(r.couplingStrength) +
              "     " + f(r.replayFrac));
}
out.curves = R;

/* ---------------- 2. does the phenotype emerge? (P1, P5) ---------------- */
console.log("\n" + clock() + " == 2. is this accelerated long-term FORGETTING? (P1, P5) ==");
{
  const H = R["healthy"], P = R["IED 30/min, coupled"];
  const early = Math.abs(P.recall[0] - H.recall[0]);
  const late = H.recall[3] - P.recall[3];
  ok("normal early, impaired late — the defining ALF pattern (P1)",
     early <= 0.10 && late >= 0.25,
     "at 30 min the gap is " + f(early) + " of the list (healthy " + f(H.recall[0]) + " vs patient " +
     f(P.recall[0]) + "); at 1 week it is " + f(late) + " (healthy " + f(H.recall[3]) + " vs patient " +
     f(P.recall[3]) + "). A 30-minute test — which is what standard neuropsychology administers — " +
     "would call this patient normal.");
  const gaps = DELAYS.map((_, i) => H.recall[i] - P.recall[i]);
  const mono = gaps.every((g, i) => i === 0 || g >= gaps[i - 1] - 0.02);
  ok("the deficit GROWS with delay — a forgetting rate, not a fixed offset (P5)", mono,
     "gap by delay: " + gaps.map((g, i) => LABEL[i] + " " + f(g).trim()).join(", ") +
     ". An encoding deficit would show a constant gap; this is loss over time.");
}

/* ---------------- 3. the control that could kill it (P2) ---------------- */
console.log("\n" + clock() + " == 3. is it the RATE or the COUPLING? (P2) ==");
{
  const H = R["healthy"];
  const c30 = R["IED 30/min, coupled"], u30 = R["IED 30/min, UNCOUPLED"];
  const c60 = R["IED 60/min, coupled"], u60 = R["IED 60/min, UNCOUPLED"];
  console.log("  matched IED rate, coupling on vs off, 1-week recall:");
  console.log("    30/min   coupled " + f(c30.recall[3]) + "   uncoupled " + f(u30.recall[3]) +
              "   healthy " + f(H.recall[3]));
  console.log("    60/min   coupled " + f(c60.recall[3]) + "   uncoupled " + f(u60.recall[3]));
  console.log("  and what the EEG shows at that SAME matched rate:");
  console.log("    60/min uncoupled   density " + f(u60.density, 1) + "  coupling " + f(u60.couplingStrength) +
              "   1-week " + f(u60.recall[3]));
  console.log("    60/min coupled     density " + f(c60.density, 1) + "  coupling " + f(c60.couplingStrength) +
              "   1-week " + f(c60.recall[3]));
  console.log("    healthy            density " + f(H.density, 1) + "  coupling " + f(H.couplingStrength) +
              "   1-week " + f(H.recall[3]));
  const bioMovesBoth = (u60.density > H.density + 0.5) && (c60.density > H.density + 0.5) &&
                       (u60.couplingStrength > H.couplingStrength + 0.03) &&
                       (c60.couplingStrength > H.couplingStrength + 0.03);
  const memMovesOne = Math.abs(u60.recall[3] - H.recall[3]) <= 0.05 &&
                      (H.recall[3] - c60.recall[3]) >= 0.25;
  ok("the EEG moves in both, the memory moves in one (P2)", bioMovesBoth && memMovesOne,
     "at 60/min both uncoupled and coupled raise density (" + f(u60.density, 1).trim() + " and " +
     f(c60.density, 1).trim() + " vs healthy " + f(H.density, 1).trim() + ") and raise coupling " +
     "strength (" + f(u60.couplingStrength).trim() + " and " + f(c60.couplingStrength).trim() +
     " vs " + f(H.couplingStrength).trim() + "), but 1-week recall is " + f(u60.recall[3]).trim() +
     " uncoupled against " + f(c60.recall[3]).trim() + " coupled. A sleep study sees the same " +
     "abnormality in a patient who will forget and one who will not.");
}

/* ---------------- 4. the inverted biomarker (P3) ---------------- */
console.log("\n" + clock() + " == 4. what a sleep study would see (P3) ==");
{
  const seq = ["healthy", "IED 15/min, coupled", "IED 30/min, coupled", "IED 60/min, coupled"];
  const dens = seq.map(t => R[t].density), cpl = seq.map(t => R[t].couplingStrength),
        ret = seq.map(t => R[t].recall[3]);
  console.log("  rising coupled IED burden →");
  console.log("    spindle density /min      " + dens.map(x => f(x, 1).padStart(7)).join("") + "   RISES");
  console.log("    SO–spindle coupling       " + cpl.map(x => f(x).padStart(7)).join("") + "   RISES");
  console.log("    1-week retention          " + ret.map(x => f(x).padStart(7)).join("") + "   FALLS");
  const up = a => a.every((v, i) => i === 0 || v >= a[i - 1] - 0.01);
  const down = a => a.every((v, i) => i === 0 || v <= a[i - 1] + 0.01);
  ok("the standard biomarkers point the WRONG WAY (P3)", up(dens) && up(cpl) && down(ret),
     "both conventional consolidation markers improve while memory is destroyed. Reading spindle " +
     "density or SO–spindle coupling as a proxy for consolidation in epilepsy would rank the " +
     "worst-affected patient as the healthiest.");
  console.log("");
  console.log("  Worse, the biomarkers cannot even separate harmful from harmless burden:");
  console.log("    60/min UNCOUPLED (memory intact):  density " + f(R["IED 60/min, UNCOUPLED"].density, 1) +
              ", coupling " + f(R["IED 60/min, UNCOUPLED"].couplingStrength) +
              ", 1-week " + f(R["IED 60/min, UNCOUPLED"].recall[3]));
  console.log("    60/min COUPLED   (memory lost):    density " + f(R["IED 60/min, coupled"].density, 1) +
              ", coupling " + f(R["IED 60/min, coupled"].couplingStrength) +
              ", 1-week " + f(R["IED 60/min, coupled"].recall[3]));
}

/* ---------------- 5. why the clinical literature disagrees with itself (P4) ---------------- */
console.log("\n" + clock() + " == 5. a simulated cohort: what predicts forgetting? (P4) ==");
{
  /* Rate and coupling vary INDEPENDENTLY across the cohort, which is the realistic situation: two
     patients with the same spike count can differ in how much of it lands on the consolidation
     channel. If that is what nature does, then any study correlating ALF with spike burden is
     correlating against the wrong variable — and will get inconsistent answers. */
  const rnd = A.mulberry32(4242);
  const rows = [];
  for (let i = 0; i < 40; i++) {
    const iedRate = 5 + rnd() * 55, coupling = rnd();
    const s = SUBJ[i % SUBJ.length].M;
    A.resetCortical(s);
    const n = A.runNight(s, { iedRate, coupling, nightSeed: 1000 + i });
    rows.push({ iedRate: n.iedRatePerMin, coupling, replayFrac: n.replayFraction,
                density: n.spindleDensity, cStrength: n.couplingStrength,
                week: A.recallAtDelay(s, 7).recall });
  }
  const rhoRate = spearman(rows.map(r => r.iedRate), rows.map(r => r.week));
  const rhoFrac = spearman(rows.map(r => r.replayFrac), rows.map(r => r.week));
  const rhoDens = spearman(rows.map(r => r.density), rows.map(r => r.week));
  const rhoCS = spearman(rows.map(r => r.cStrength), rows.map(r => r.week));
  out.cohort = { n: rows.length, rhoRate, rhoFrac, rhoDens, rhoCS, rows };
  console.log("  n = " + rows.length + " simulated patients, IED rate and coupling varying independently");
  console.log("    rho(1-week recall, IED rate)              = " + f(rhoRate));
  console.log("    rho(1-week recall, spindle density)       = " + f(rhoDens));
  console.log("    rho(1-week recall, SO–spindle coupling)   = " + f(rhoCS));
  console.log("    rho(1-week recall, REPLAY FRACTION)       = " + f(rhoFrac) + "   ← the quantity");
  ok("spike burden is a weak predictor, captured fraction a strong one (P4)",
     Math.abs(rhoRate) < 0.5 && Math.abs(rhoFrac) > 0.8,
     "|rho| = " + f(Math.abs(rhoRate)) + " for IED rate against " + f(Math.abs(rhoFrac)) +
     " for replay fraction. This is a quantitative account of the 'contradictory associations' " +
     "between epileptiform activity and ALF that the 2020 review reports across 51 studies: the " +
     "field has been correlating against spike counts, and spike counts are not the variable.");
}

console.log("\n" + clock() + " == what this says, and what it does not ==");
{
  console.log("  CLAIMED. Given that IEDs capture ripple–spindle coupling slots (Gelinas 2016) and");
  console.log("  drive coupling harder than physiology does (Uehara 2026), the ALF phenotype follows");
  console.log("  without further assumption: early recall is carried by a hippocampal trace that the");
  console.log("  discharges do not touch, late recall by a cortical trace they prevented from being");
  console.log("  written. The clinically useful consequences are that spike COUNT is the wrong");
  console.log("  measure, and that the conventional sleep biomarkers are inverted in this population.");
  console.log("");
  console.log("  NOT CLAIMED. That blocking consolidation causes late forgetting — that is");
  console.log("  arithmetic, and stage 41 was retracted for reporting exactly that kind of thing as");
  console.log("  a result. The content here is in P2 (matched rate, no effect without coupling),");
  console.log("  P4 (which variable predicts) and P3 (the inversion), none of which follow from the");
  console.log("  two-store architecture alone.");
  console.log("");
  console.log("  ASSUMED FROM DATA, not derived: higher phase consistency for IED-coupled spindles;");
  console.log("  a hippocampal trace decaying over days; salience-biased replay; and a calibration");
  console.log("  anchored to ~0.85 normal 1-week list retention. Each is a published regularity, and");
  console.log("  each is a place the model could be wrong.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "alf.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
