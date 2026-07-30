"use strict";
/* Stage-47 — WHICH CONCLUSIONS SURVIVE THE PARAMETERS THEY WERE BUILT ON?
 *
 * Five times in this project's history a result has been overturned by a coupling that looked
 * local and was not: a shared random stream, a step-function read-out, reinstatement drive coupled
 * to trace lifetime, a renamed parameter silently becoming undefined, and a cache that restored a
 * value without restoring its effect. Every one was caught by disbelieving a number rather than by
 * a test written to catch it. That is luck, and it does not scale.
 *
 * This stage is the systematic version. Every hand-set parameter is perturbed ±40% and the FOUR
 * conclusions the paper actually makes are re-evaluated. A conclusion that only holds at the
 * parameter values it was developed at is not a conclusion, it is a coincidence — and a reviewer
 * will say so before believing anything else in the manuscript.
 *
 * THE FOUR CONCLUSIONS UNDER TEST:
 *   C1  THE PHENOTYPE.   At 30 discharges/min, the 30-minute gap is ≤ 0.10 and the one-week gap
 *                        is ≥ 0.25. This is accelerated forgetting rather than plain amnesia.
 *   C2  THE DIVERGENCE.  Under capture, total spindle density RISES while the physiologically
 *                        coupled rate FALLS. This is the paper's identifying prediction and the
 *                        thing that distinguishes capture from every rival account.
 *   C3  THE EXTERNAL ANCHOR. The TLE physiologically-coupled-rate ratio lands within 0.15 of the
 *                        0.51 Schiller et al. (2025) measured. This is the only number in the
 *                        project validated against data it was not fitted to.
 *   C4  THE PREDICTOR.   Across a cohort with rate and coupling varying independently, replay
 *                        fraction predicts one-week recall better than discharge rate does.
 *
 * NOTHING IS TUNED HERE. The output is a table of which conclusions are robust and which are
 * fragile, and the fragile ones get stated as limitations in the manuscript rather than quietly
 * omitted. A parameter that breaks a conclusion at ±40% is a parameter the paper must justify.
 */

const A = require("../src/alf.js");

const f = (x, d = 2) => (x == null || Number.isNaN(x) ? " n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SEEDS = [1, 2, 3];
const ORDER = Array.from({ length: 16 }, (_, i) => i);

function spearman(xs, ys) {
  const rank = a => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length); let k = 0;
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

console.log("\n" + clock() + " building " + SEEDS.length + " subjects (once; reused for every perturbation)...");
const SUBJ = SEEDS.map(s => ({ M: A.buildSubject(s, ORDER) }));
SUBJ.forEach(S => { S.baseW = S.M.cons.wCCmax; });

/* evaluate all four conclusions under one parameter setting */
function evaluate(P) {
  // recalibrate every subject under this setting — anchors and dynamics both feed the fit
  for (const S of SUBJ) { A.calibrateSubject(S.M, P); }

  const run = prof => {
    const rec = [[], [], []], dens = [], pcr = [];
    for (const S of SUBJ) {
      const M = S.M;
      A.resetCortical(M); A.applyProfile(M, prof, S.baseW);
      const n = A.runNight(M, prof);
      dens.push(n.spindleDensity); pcr.push(n.physioCoupledRate);
      [0.02, 1, 7].forEach((d, i) => rec[i].push(A.recallAtDelay(M, d, prof).recall));
      M.cons.wCCmax = S.baseW;
    }
    return { recall: rec.map(mean), density: mean(dens), pcr: mean(pcr) };
  };

  const base = Object.assign({}, A.diseaseProfile("healthy", 1.0), P);
  const H = run(base);
  const cap = run(Object.assign({}, base, { iedRate: 30, coupling: 1.0 }));
  const tle = run(Object.assign({}, A.diseaseProfile("TLE-HS", 1.0), P));

  // C1 phenotype
  const early = H.recall[0] - cap.recall[0], late = H.recall[2] - cap.recall[2];
  const c1 = early <= 0.10 && late >= 0.25;
  // C2 divergence
  const c2 = cap.density > H.density + 0.2 && cap.pcr < H.pcr - 0.2;
  // C3 external anchor
  const ratio = tle.pcr / H.pcr;
  const c3 = Math.abs(ratio - 0.51) < 0.15;
  // C4 predictor — small cohort, rate and coupling independent
  const rnd = A.mulberry32(4242);
  const rate = [], frac = [], week = [];
  for (let i = 0; i < 18; i++) {
    const iedRate = 5 + rnd() * 55, coupling = rnd();
    const S = SUBJ[i % SUBJ.length], M = S.M;
    const prof = Object.assign({}, base, { iedRate, coupling });
    A.resetCortical(M); A.applyProfile(M, prof, S.baseW);
    const n = A.runNight(M, prof);
    rate.push(n.iedRatePerMin); frac.push(n.replayFraction);
    week.push(A.recallAtDelay(M, 7, prof).recall);
    M.cons.wCCmax = S.baseW;
  }
  const rhoRate = Math.abs(spearman(rate, week)), rhoFrac = Math.abs(spearman(frac, week));
  const c4 = rhoFrac > rhoRate;
  return { c1, c2, c3, c4, early, late, ratio, rhoRate, rhoFrac,
           density: [H.density, cap.density], pcr: [H.pcr, cap.pcr] };
}

/* every hand-set quantity in the model, with the ±40% perturbation applied to each in turn */
const PARAMS = [
  { name: "spindleP",            base: 0.10, key: "spindleP" },
  { name: "cPhys",               base: 0.55, key: "cPhys" },
  { name: "cIED",                base: 0.82, key: "cIED",  cap: 0.99 },
  { name: "iedSpindleP",         base: 0.15, key: "iedSpindleP" },
  { name: "fSO",                 base: 0.90, key: "fSO" },
  { name: "nightMin",            base: 60,   key: "nightMin" },
  { name: "retThr (readout)",    base: 0.40, key: "retThr" },
  { name: "retTemp (readout)",   base: 0.09, key: "retTemp" },
  { name: "early anchor",        base: 0.95, key: "healthyEarlyRecall", cap: 0.99 },
  { name: "week anchor",         base: 0.85, key: "healthyWeekRetention", cap: 0.99 },
  { name: "hippo week ceiling",  base: 0.15, key: "hippoWeekCeiling" },
  { name: "specificity floor",   base: 0.20, key: "specificityFloor" },
];

console.log("\n" + clock() + " == baseline ==");
const BASE = evaluate({});
out.baseline = BASE;
console.log("  C1 phenotype   " + (BASE.c1 ? "hold" : "FAIL") + "   early " + f(BASE.early) +
            "  late " + f(BASE.late));
console.log("  C2 divergence  " + (BASE.c2 ? "hold" : "FAIL") + "   density " +
            f(BASE.density[0], 1) + "→" + f(BASE.density[1], 1) + "  coupled " +
            f(BASE.pcr[0], 2) + "→" + f(BASE.pcr[1], 2));
console.log("  C3 anchor      " + (BASE.c3 ? "hold" : "FAIL") + "   ratio " + f(BASE.ratio) +
            " vs measured 0.51");
console.log("  C4 predictor   " + (BASE.c4 ? "hold" : "FAIL") + "   |rho| frac " + f(BASE.rhoFrac) +
            " vs rate " + f(BASE.rhoRate));

console.log("\n" + clock() + " == ±40% on every hand-set parameter ==");
console.log("  parameter              dir     C1     C2     C3     C4   | ratio  early  late");
const rows = [];
for (const p of PARAMS) {
  for (const dir of [-0.4, +0.4]) {
    let v = p.base * (1 + dir);
    if (p.cap != null) v = Math.min(v, p.cap);
    const P = {}; P[p.key] = v;
    let r;
    try { r = evaluate(P); }
    catch (e) { r = { c1: null, c2: null, c3: null, c4: null, err: String(e.message).slice(0, 60) }; }
    rows.push(Object.assign({ param: p.name, key: p.key, dir, value: v }, r));
    const mark = b => (b === null ? "  err" : b ? "  ok " : " FAIL");
    console.log("  " + p.name.padEnd(22) + (dir < 0 ? "-40%" : "+40%") + "  " +
                mark(r.c1) + "  " + mark(r.c2) + "  " + mark(r.c3) + "  " + mark(r.c4) +
                "  | " + (r.err ? r.err : f(r.ratio) + "  " + f(r.early) + "  " + f(r.late)));
  }
}
out.rows = rows;

console.log("\n" + clock() + " == robustness summary ==");
{
  const tally = c => {
    const done = rows.filter(r => r[c] !== null);
    return { held: done.filter(r => r[c]).length, of: done.length,
             broke: done.filter(r => !r[c]).map(r => r.param + (r.dir < 0 ? "−" : "+")) };
  };
  const names = { c1: "C1 phenotype", c2: "C2 divergence", c3: "C3 external anchor", c4: "C4 predictor" };
  const summary = {};
  for (const c of ["c1", "c2", "c3", "c4"]) {
    const t = tally(c);
    summary[c] = t;
    console.log("  " + names[c].padEnd(20) + " holds in " + t.held + "/" + t.of + " perturbations" +
                (t.broke.length ? "   breaks on: " + t.broke.join(", ") : ""));
  }
  out.summary = summary;
  console.log("");
  console.log("  Conclusions holding across the whole sweep can be stated plainly. Conclusions that");
  console.log("  break under a ±40% move belong in the limitations with the parameter named, because");
  console.log("  that is where a reviewer will find them if we do not put them there first.");
}

console.log("\n" + clock() + " done\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "sensitivity.json"),
  JSON.stringify(out));
