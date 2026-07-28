"use strict";
/* Numeric acceptance tests for the hippocampal index-and-replay model.
   Each target maps to a documented reference number (README / ISSUES.md).
   Run with `npm test`. No dynamics constant is tuned to pass — protocols only. */

const M = require("../src/model.js");
let pass = 0, fail = 0;
const f = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (name, cond, detail) =>
  (cond ? (pass++, console.log("  PASS  " + name + "   " + (detail || "")))
        : (fail++, console.log("  FAIL  " + name + "   " + (detail || ""))));

const SEED = 12345;
function encodeRoute() { M.setMode("explore"); M.route(0); M.advance(6 * 520 + 600); }

// --- retrieval titration: encode, then hold a cue and titrate PV, read steady state ---
function titrate(pv, opts) {
  opts = opts || {};
  M.reset(SEED); encodeRoute();
  M.setMode("quiet"); M.setPV(pv); M.setRecG(opts.recG == null ? 1 : opts.recG);
  let acc = 0, ct = 0;
  for (let s = 0; s < 3000; s++) { if (s % 250 === 0) M.cue(0, 300); M.advance(1); if (s > 2000) { acc += M.fieldActive("CA3"); ct++; } }
  return { active: acc / ct, R: M.F.CA3.R, seiz: M.seizure };
}

console.log("\n== THETA (LFP band power) ==");
{
  M.reset(SEED); M.setMode("explore"); M.advance(2200); const intact = M.thetaPower();
  M.setLesion(true); M.advance(2200); const lesion = M.thetaPower();
  M.setLesion(false); M.advance(2200); const restored = M.thetaPower();
  console.log("  intact=" + f(intact) + "  lesion=" + f(lesion) + "  restored=" + f(restored));
  ok("theta power, septum intact  >= 0.70", intact >= 0.70, "= " + f(intact));
  ok("theta power, septal lesion  <= 0.40", lesion <= 0.40, "= " + f(lesion));
  ok("theta power, restored       >= 0.70", restored >= 0.70, "= " + f(restored));
  ok("lesion effect size          >= 0.40", (intact - lesion) >= 0.40, "= " + f(intact - lesion));
}

console.log("\n== PV titration (inhibition → activity) ==");
{
  const p100 = titrate(1.0), p60 = titrate(0.6), p30 = titrate(0.3);
  console.log("  PV100 active=" + f(p100.active) + "  PV60=" + f(p60.active) + "  PV30=" + f(p30.active) + " (R " + f(p30.R) + ", seiz " + p30.seiz + ")");
  ok("CA3 sparse at PV 100%       <= 0.35", p100.active <= 0.35, "= " + f(p100.active));
  ok("PV → activity monotonic", p100.active <= p60.active + 1e-6 && p60.active <= p30.active + 1e-6,
     "[" + f(p100.active, 2) + " " + f(p60.active, 2) + " " + f(p30.active, 2) + "]");
  ok("runaway active at PV 30%    >= 0.80", p30.active >= 0.80, "= " + f(p30.active));
  ok("CA3 coherence R at PV 30%   >= 0.85", p30.R >= 0.85, "= " + f(p30.R));
  // recG=0 safety is about the SELF-SUSTAINING attractor: ignite an index, release the
  // drive, and without learned recurrence (Wpat) it decays — the diffuse Wbg alone is
  // subcritical. (With drive held, Wbg can run away on its own; that is a separate regime.)
  function igniteRelease(recG) {
    M.reset(SEED); encodeRoute();
    M.setMode("quiet"); M.setPV(0.3); M.setRecG(recG);
    M.cue(0, 400); M.advance(400); M.advance(3600);   // ignite, then release
    return { active: M.fieldActive("CA3"), seiz: M.seizure };
  }
  const withRec = igniteRelease(1), noRec = igniteRelease(0);
  console.log("  ignite→release @ PV30:  recG=1 active=" + f(withRec.active) + " seiz=" + withRec.seiz + "   recG=0 active=" + f(noRec.active) + " seiz=" + noRec.seiz);
  ok("self-sustaining seizure needs recG (recG=1 seizes)", withRec.seiz && withRec.active >= 0.80, "active=" + f(withRec.active));
  ok("seizure impossible, recG=0", !noRec.seiz && noRec.active <= 0.35, "active=" + f(noRec.active) + " seiz=" + noRec.seiz);
}

console.log("\n== index binding & orthogonality ==");
{
  M.reset(SEED); encodeRoute();
  ok("six indices bound", M.indices.length === 6, "= " + M.indices.length);
  let full = 0, sumShared = 0, N = 20;
  for (let s = 1; s <= N; s++) {
    M.reset(s * 777 + 1); encodeRoute();
    const seen = {}; let sh = 0;
    for (const idx of M.indices) for (const c of idx.cells) { if (seen[c]) sh++; seen[c] = 1; }
    sumShared += sh; if (sh === 0) full++;
  }
  const meanShared = sumShared / N;
  console.log("  orthogonality across " + N + " seeds: " + full + "/" + N + " fully orthogonal, mean shared=" + f(meanShared, 2));
  ok("index near-orthogonality (mean shared <= 1.0)", meanShared <= 1.0, "mean=" + f(meanShared, 2) + " (" + full + "/" + N + " perfect)");
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
