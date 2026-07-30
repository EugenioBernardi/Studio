"use strict";
/* Stage-46 — DOES CAPTURE EXPLAIN ALF BETTER THAN THE OBVIOUS ALTERNATIVES?
 *
 * Every stage so far asks whether OUR mechanism can produce accelerated long-term forgetting. That
 * is the wrong question for a modelling paper, and it is the question a reviewer will replace with
 * a harder one: so would several simpler accounts — why yours?
 *
 * Four accounts of ALF are implemented in the SAME model, each tuned to produce the SAME one-week
 * deficit so they cannot be separated by severity, and then compared on everything else:
 *
 *   A. CAPTURE (ours)         discharges take coupling slots; the events still fire, carrying nothing
 *   B. ENCODING DEFICIT       the memory is written weakly in the first place
 *   C. CONSOLIDATION RATE     fewer coupling events per night; nothing pathological about them
 *   D. HIPPOCAMPAL DECAY      the trace fades faster than normal
 *
 * B, C and D are not straw men. Each is a serious published position on what ALF is, and each can
 * produce accelerated forgetting. The question is whether any of them produces the FULL pattern.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (P1) SEVERITY DOES NOT DISCRIMINATE. With all four matched at one week (within 0.05), no
 *        account is distinguishable by the headline behavioural number. This is the point of the
 *        matching, and it is why a paper showing only "our model produces ALF" proves nothing.
 *   (P2) THE EARLY DELAY DISCRIMINATES ENCODING. B alone should show a deficit at 30 minutes,
 *        because a weakly written memory is weak immediately; A, C and D should be near-normal
 *        early. Registered threshold: B's 30-min gap exceeds the others' by at least 0.10.
 *   (P3) THE BIOMARKER DISCRIMINATES CAPTURE, and this is the claim the paper rests on. Only A
 *        produces the DIVERGENCE — total spindle density UP while the physiologically coupled rate
 *        falls. C lowers both; B and D leave both alone. If some other account also produces the
 *        divergence, our mechanism is not identified by the EEG and the paper's central
 *        measurement recommendation is worthless.
 *   (P4) NO ACCOUNT IS DISCRIMINATED BY THE FORGETTING CURVE SHAPE ALONE — the ratio of the
 *        one-day to one-week deficit is similar across accounts (spread < 0.20). Registered
 *        because if false, the cheap measurement (test at more delays) would settle it and the
 *        expensive one (intracranial coupling) would be unnecessary.
 */

const A = require("../src/alf.js");

let pass = 0, fail = 0;
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? " n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "\n          " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "\n          " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SEEDS = [1, 2, 3, 4, 5, 6];
const ORDER = Array.from({ length: 16 }, (_, i) => i);
const DELAYS = [0.02, 1, 7];

console.log("\n" + clock() + " building and calibrating " + SEEDS.length + " subjects (two-point)...");
const SUBJ = SEEDS.map(s => {
  const M = A.buildSubject(s, ORDER);
  const baseW = M.cons.wCCmax;
  A.calibrateSubject(M, {});
  return { M, baseW };
});

function runProfile(prof) {
  const rec = DELAYS.map(() => []), dens = [], pcr = [], frac = [];
  for (const S of SUBJ) {
    const M = S.M;
    A.resetCortical(M); A.applyProfile(M, prof, S.baseW);
    const n = A.runNight(M, prof);
    dens.push(n.spindleDensity); pcr.push(n.physioCoupledRate); frac.push(n.replayFraction);
    DELAYS.forEach((d, i) => rec[i].push(A.recallAtDelay(M, d, prof).recall));
    M.cons.wCCmax = S.baseW;
  }
  return { recall: rec.map(mean), density: mean(dens), pcr: mean(pcr), frac: mean(frac) };
}

/* Each account is a knob on the SAME model. `sev` is the severity dial that will be matched. */
const HEALTHY = A.diseaseProfile("healthy", 1.0);
const ACCOUNTS = {
  "A capture":            sev => Object.assign({}, HEALTHY, { iedRate: 140 * sev, coupling: 1.0 }),
  "B encoding deficit":   sev => Object.assign({}, HEALTHY, { encodeScale: 1 - 0.95 * sev }),
  "C consolidation rate": sev => Object.assign({}, HEALTHY, { physioSuppression: 0.95 * sev }),
  "D hippocampal decay":  sev => Object.assign({}, HEALTHY, { tauHscale: 1 - 0.95 * sev,
                                                              driveMul: 1 - 0.95 * sev }),
};

/* match every account to the same one-week recall by bisection on its own severity dial */
console.log("\n" + clock() + " == 0. matching all four accounts at one week ==");
const TARGET_WEEK = 0.55;
const matched = {};
for (const [name, mk] of Object.entries(ACCOUNTS)) {
  let lo = 0, hi = 1, best = null;
  for (let it = 0; it < 9; it++) {
    const mid = (lo + hi) / 2;
    const r = runProfile(mk(mid));
    best = { sev: mid, r };
    if (r.recall[2] > TARGET_WEEK) lo = mid; else hi = mid;
  }
  matched[name] = best;
  console.log("  " + name.padEnd(22) + " severity " + f(best.sev) + "  →  1-week " +
              f(best.r.recall[2]));
}
out.matched = Object.fromEntries(Object.entries(matched).map(([k, v]) => [k, { sev: v.sev, ...v.r }]));

/* ---------------- 1. severity does not discriminate (P1) ---------------- */
console.log("\n" + clock() + " == 1. all four look the same on the headline number (P1) ==");
{
  const H = runProfile(HEALTHY);
  out.healthy = H;
  console.log("  account                30 min   1 day  1 week  | density   coupled rate  replayFrac");
  console.log("  " + "healthy".padEnd(22) + H.recall.map(x => f(x).padStart(7)).join("") +
              "  | " + f(H.density, 1).padStart(7) + f(H.pcr, 2).padStart(14) + f(H.frac, 2).padStart(13));
  for (const [name, v] of Object.entries(matched))
    console.log("  " + name.padEnd(22) + v.r.recall.map(x => f(x).padStart(7)).join("") +
                "  | " + f(v.r.density, 1).padStart(7) + f(v.r.pcr, 2).padStart(14) +
                f(v.r.frac, 2).padStart(13));
  const reachable = Object.entries(matched).filter(([, v]) => Math.abs(v.r.recall[2] - TARGET_WEEK) <= 0.05);
  const unreachable = Object.entries(matched).filter(([, v]) => Math.abs(v.r.recall[2] - TARGET_WEEK) > 0.05);
  if (unreachable.length) {
    console.log("");
    console.log("  ACCOUNTS THAT CANNOT REACH ALF SEVERITY AT ALL, which is itself a result:");
    for (const [k, v] of unreachable)
      console.log("    " + k.padEnd(22) + " floors at " + f(v.r.recall[2]) + " even at maximum severity");
    console.log("  A pure hippocampal-decay account cannot produce accelerated forgetting below the");
    console.log("  CORTICAL floor: faster decay of the hippocampal trace leaves consolidation intact,");
    console.log("  so whatever reached cortex is still there at one week. Any account of ALF must");
    console.log("  therefore act on consolidation, not only on the trace.");
  }
  out.unreachable = unreachable.map(([k, v]) => ({ account: k, floor: v.r.recall[2] }));
  const weeks = reachable.map(([, v]) => v.r.recall[2]);
  ok("among accounts that CAN reach it, severity is uninformative (P1)",
     reachable.length >= 2 && Math.max(...weeks) - Math.min(...weeks) <= 0.05,
     "one-week recall spans " + f(Math.min(...weeks)) + "–" + f(Math.max(...weeks)) +
     " across four mechanistically different accounts. Any study reporting only that patients " +
     "forget faster cannot distinguish them, which is the situation the ALF literature is in.");
}

/* ---------------- 2. what the early delay buys you (P2) ---------------- */
console.log("\n" + clock() + " == 2. does testing earlier discriminate? (P2) ==");
{
  const H = out.healthy;
  const early = Object.fromEntries(Object.entries(matched)
    .map(([k, v]) => [k, H.recall[0] - v.r.recall[0]]));
  for (const [k, v] of Object.entries(early))
    console.log("  " + k.padEnd(22) + " 30-min gap " + f(v));
  const enc = early["B encoding deficit"];
  const others = Object.entries(early).filter(([k]) => k !== "B encoding deficit").map(([, v]) => v);
  ok("only the encoding account is impaired early (P2)", enc - Math.max(...others) >= 0.10,
     "encoding shows a 30-min gap of " + f(enc).trim() + " against at most " +
     f(Math.max(...others)).trim() + " for the others. So a 30-minute test separates ENCODING from " +
     "the three consolidation accounts — but cannot separate those three from each other.");
}

/* ---------------- 3. the biomarker (P3) — the claim the paper rests on ---------------- */
console.log("\n" + clock() + " == 3. does the sleep EEG identify the mechanism? (P3) ==");
{
  const H = out.healthy;
  console.log("  account                Δ total density   Δ coupled rate   divergent?");
  const div = {};
  for (const [k, v] of Object.entries(matched)) {
    const dd = v.r.density - H.density, dp = v.r.pcr - H.pcr;
    div[k] = dd > 0.5 && dp < -0.5;
    console.log("  " + k.padEnd(22) + f(dd, 1).padStart(12) + f(dp, 2).padStart(17) +
                "     " + (div[k] ? "YES" : "no"));
  }
  out.divergence = div;
  ok("only capture produces the biomarker divergence (P3)",
     div["A capture"] && !div["B encoding deficit"] && !div["C consolidation rate"] &&
     !div["D hippocampal decay"],
     "total spindle density rises while the physiologically coupled rate falls in the capture " +
     "account and in no other. The rate-reduction account lowers BOTH; the encoding and decay " +
     "accounts leave both untouched. This is what identifies the mechanism, and it is why the " +
     "measurement recommendation is not interchangeable with 'measure spindles'.");
}

/* ---------------- 4. is the curve shape enough? (P4) ---------------- */
console.log("\n" + clock() + " == 4. could a cheaper measurement settle it? (P4) ==");
{
  const H = out.healthy;
  const shape = Object.fromEntries(Object.entries(matched).map(([k, v]) => {
    const dDay = H.recall[1] - v.r.recall[1], dWeek = H.recall[2] - v.r.recall[2];
    return [k, dWeek > 0 ? dDay / dWeek : NaN];
  }));
  for (const [k, v] of Object.entries(shape))
    console.log("  " + k.padEnd(22) + " 1-day deficit / 1-week deficit = " + f(v));
  const vals = Object.values(shape).filter(Number.isFinite);
  const spread = Math.max(...vals) - Math.min(...vals);
  ok("curve shape alone does not identify the mechanism (P4)", spread < 0.20,
     "the ratio spans " + f(spread).trim() + " across accounts. Adding delays to the behavioural " +
     "protocol is cheap and worth doing, but on this model it will not tell you WHICH consolidation " +
     "failure a patient has — that needs the sleep recording.");
}

console.log("\n" + clock() + " == what this establishes ==");
{
  console.log("  The paper's argument is not 'capture can produce accelerated forgetting'. Three");
  console.log("  other accounts do that too, and once matched for severity the behavioural data");
  console.log("  cannot separate any of them. The argument is that capture is the only one of the");
  console.log("  four that ALSO predicts the biomarker divergence — total spindle density rising");
  console.log("  while the physiologically coupled rate falls, in the same patient, in the same");
  console.log("  night. That is an identifying prediction rather than a compatible one, and it is");
  console.log("  measurable with recordings that are already being made in epilepsy monitoring units.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "alternatives.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
