"use strict";
/* Stage-1 acceptance test — cortical assemblies (SPEC target 7 + the two
   properties an auto-associator must have and a merged attractor must not).

   Four quantities, kept separate so a degenerate "everything merges" answer
   (recall≈1 but every assembly identical) fails instead of passing:

     sparsity   settled active fraction               2–10 %  (Barth & Poulet 2012)
     xoverlap   pairwise overlap of encoded assemblies ≪ assembly size (orthogonal)
     recall     50 %-cue → fraction of assembly_s back  high  (pattern completion)
     offtarget  50 %-cue → cells fired outside assembly_s low   (specificity)

   Replicated across seeds; the acceptance is on the seed MEAN with a floor on
   the worst seed, not a single cherry-picked run. */

const C = require("../src/cortex.js");
let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (name, cond, detail) =>
  (cond ? (pass++, console.log("  PASS  " + name + "   " + (detail || "")))
        : (fail++, console.log("  FAIL  " + name + "   " + (detail || ""))));

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function measure(seed) {
  const S = C.create({ seed });
  C.encode(S);
  const A = S.assemblies.map(x => new Set(x));
  const N = S.N, nS = S.P.nStim;

  let sp = 0; for (const a of A) sp += a.size / N; sp /= nS;

  let ov = 0, np = 0;
  for (let i = 0; i < nS; i++) for (let j = i + 1; j < nS; j++) {
    let c = 0; for (const x of A[i]) if (A[j].has(x)) c++; ov += c; np++;
  }
  ov /= np;

  let rc = 0, spc = 0;
  for (let s = 0; s < nS; s++) {
    const got = new Set(C.present(S, s, 0.5, 0.35, true));
    const tgt = A[s];
    let hit = 0; for (const x of tgt) if (got.has(x)) hit++;
    rc += hit / Math.max(1, tgt.size);
    let fp = 0; for (const x of got) if (!tgt.has(x)) fp++;
    spc += fp;
  }
  rc /= nS; spc /= nS;

  // mean assembly size (for reporting xoverlap as a fraction)
  let sz = 0; for (const a of A) sz += a.size; sz /= nS;
  return { sp, ov, rc, spc, sz };
}

const R = SEEDS.map(measure);
const mean = k => R.reduce((a, r) => a + r[k], 0) / R.length;
const worst = (k, cmp) => R.reduce((w, r) => cmp(r[k], w) ? r[k] : w, R[0][k]);

const mSp = mean("sp"), mOv = mean("ov"), mRc = mean("rc"), mSpc = mean("spc"), mSz = mean("sz");
const wRc = worst("rc", (v, w) => v < w);          // worst (lowest) recall
const wOv = worst("ov", (v, w) => v > w);          // worst (highest) overlap

console.log("\n== cortical assemblies (" + SEEDS.length + " seeds) ==");
console.log("  sparsity=" + f(mSp * 100, 1) + "%  assembly≈" + f(mSz, 0) + " cells  " +
            "xoverlap=" + f(mOv, 1) + "  recall=" + f(mRc) + "  offtarget=" + f(mSpc, 1));

ok("sparsity in 2–10% (Barth & Poulet)", mSp >= 0.02 && mSp <= 0.10, "= " + f(mSp * 100, 1) + "%");
ok("assemblies orthogonal (xoverlap ≤ 15% of size)", mOv <= 0.15 * mSz,
   "overlap " + f(mOv, 1) + " vs size " + f(mSz, 0));
ok("worst-seed overlap still ≤ 25% of size", wOv <= 0.25 * mSz, "worst " + f(wOv, 1));
ok("pattern completion recall ≥ 0.80 (mean)", mRc >= 0.80, "= " + f(mRc));
ok("completion robust: worst-seed recall ≥ 0.75", wRc >= 0.75, "= " + f(wRc));
ok("completion is specific: off-target ≤ 5% of assembly", mSpc <= 0.05 * mSz,
   "= " + f(mSpc, 1) + " of " + f(mSz, 0) + " (" + f(100 * mSpc / mSz, 1) + "%)");

// mechanism controls — each load-bearing piece must matter (remove it → a target breaks)
console.log("\n== mechanism controls (ablations) ==");
{
  // no recurrent plasticity → no completion (recall collapses toward the cue fraction 0.5)
  let rcFlat = 0;
  for (const seed of SEEDS) {
    const S = C.create({ seed, lrRec: 0 });   // silent recurrence
    C.encode(S);
    const A = S.assemblies.map(x => new Set(x));
    let rc = 0;
    for (let s = 0; s < S.P.nStim; s++) {
      const got = new Set(C.present(S, s, 0.5, 0.35, true));
      let hit = 0; for (const x of A[s]) if (got.has(x)) hit++;
      rc += hit / Math.max(1, A[s].size);
    }
    rcFlat += rc / S.P.nStim;
  }
  rcFlat /= SEEDS.length;
  ok("no plasticity → no completion (recall ≤ 0.62)", rcFlat <= 0.62, "recall=" + f(rcFlat));

  // no subtractive normalisation (huge budget) → assemblies merge (overlap blows up)
  let ovMerge = 0, szMerge = 0;
  for (const seed of SEEDS) {
    const S = C.create({ seed, wBudget: 1e9 });
    C.encode(S);
    const A = S.assemblies.map(x => new Set(x));
    let ov = 0, np = 0, sz = 0;
    for (let i = 0; i < A.length; i++) { sz += A[i].size;
      for (let j = i + 1; j < A.length; j++) { let c = 0; for (const x of A[i]) if (A[j].has(x)) c++; ov += c; np++; } }
    ovMerge += ov / np; szMerge += sz / A.length;
  }
  ovMerge /= SEEDS.length; szMerge /= SEEDS.length;
  ok("no normalisation → assemblies merge (overlap ≥ 40% of size)", ovMerge >= 0.40 * szMerge,
     "overlap " + f(ovMerge, 1) + " vs size " + f(szMerge, 0));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
