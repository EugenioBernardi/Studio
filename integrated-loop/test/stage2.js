"use strict";
/* Stage-2 acceptance — entorhinal bridge + hippocampal index binding.

   A sequence of cortical assemblies is pushed through EC→DG→CA3; each selects a sparse
   CA3 index; the index is bound bidirectionally to its assembly. The test checks the
   index code (sparse, orthogonal, pattern-separated) and the binding (reactivating an
   index reinstates ITS assembly and no other). Replicated across seeds; acceptance on
   the seed mean with a floor on the worst seed. */

const L = require("../src/loop.js");
const { C, H } = L;
let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));

const SEEDS = [1, 2, 3, 4, 5, 6];
const ORDER = [0, 1, 2, 3, 4, 5];

function measure(seed) {
  const cortex = C.create({ seed }); C.encode(cortex);
  const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
  L.encodeSequence(cortex, hpc, ORDER);
  const idx = hpc.indices.map(x => x.cells);
  const A = hpc.indices.map(x => new Set(x.cortex));

  // CA3 index sparsity + orthogonality
  let sz = 0; for (const c of idx) sz += c.length; sz /= idx.length;
  let io = 0, ip = 0;
  for (let i = 0; i < idx.length; i++) for (let j = i + 1; j < idx.length; j++) {
    const b = new Set(idx[j]); let c = 0; for (const x of idx[i]) if (b.has(x)) c++; io += c; ip++;
  }
  io /= ip;

  // DG pattern separation: DG codes should be sparse and near-orthogonal (< index overlap fraction)
  const dgPats = [];
  for (const s of ORDER) {
    cortex.a.fill(0); cortex.inh = 0; C.setExt(cortex, cortex.stim[s]); C.run(cortex, 0.35);
    L.settleForward(hpc, cortex.a, 80);
    dgPats.push(H.activeSet(hpc.dg, 0.3));
  }
  C.clearExt(cortex);
  let dgSz = 0; for (const p of dgPats) dgSz += p.length; dgSz /= dgPats.length;
  let dgo = 0, dp = 0;
  for (let i = 0; i < dgPats.length; i++) for (let j = i + 1; j < dgPats.length; j++) {
    const b = new Set(dgPats[j]); let c = 0; for (const x of dgPats[i]) if (b.has(x)) c++; dgo += c; dp++;
  }
  dgo /= dp;

  // reinstatement: index k → its assembly (recall), not others (cross-talk)
  let rc = 0, cross = 0;
  for (let k = 0; k < ORDER.length; k++) {
    const got = new Set(L.reinstateFromIndex(cortex, hpc, k));
    const tgt = A[k]; let hit = 0; for (const x of tgt) if (got.has(x)) hit++;
    rc += hit / Math.max(1, tgt.size);
    let mx = 0;
    for (let j = 0; j < ORDER.length; j++) { if (j === k) continue; let c = 0; for (const x of A[j]) if (got.has(x)) c++; mx = Math.max(mx, c / Math.max(1, A[j].size)); }
    cross += mx;
  }
  rc /= ORDER.length; cross /= ORDER.length;
  return { sz, io, dgSz: dgSz / hpc.P.NDG, dgo, rc, cross, nIdx: hpc.indices.length };
}

const R = SEEDS.map(measure);
const mean = k => R.reduce((a, r) => a + r[k], 0) / R.length;
const worstLo = k => R.reduce((w, r) => r[k] < w ? r[k] : w, R[0][k]);
const worstHi = k => R.reduce((w, r) => r[k] > w ? r[k] : w, R[0][k]);

const HP = H.hdefaults(), NCA3 = HP.NCA3, NDG = HP.NDG;
const mSz = mean("sz"), mIo = mean("io"), mDgo = mean("dgo"), mRc = mean("rc"), mCr = mean("cross");
console.log("\n== index code + binding (" + SEEDS.length + " seeds) ==");
console.log("  CA3 index≈" + f(mSz, 0) + " cells (" + f(100 * mSz / NCA3, 1) + "% of " + NCA3 + ")  xoverlap=" + f(mIo, 1) +
            "   DG≈" + f(mean("dgSz") * NDG, 0) + " cells xoverlap=" + f(mDgo, 1));
console.log("  reinstatement recall=" + f(mRc) + "  cross-talk=" + f(mCr));

ok("six indices bound", R.every(r => r.nIdx === 6), "");
ok("CA3 index sparse (3–15%)", mSz / NCA3 >= 0.03 && mSz / NCA3 <= 0.15, "= " + f(100 * mSz / NCA3, 1) + "%");
ok("indices orthogonal (xoverlap ≤ 20% of size)", mIo <= 0.20 * mSz, "overlap " + f(mIo, 1) + " / size " + f(mSz, 0));
ok("DG sparse & separated (≤8% active, overlap ≤15% of size)",
   mean("dgSz") <= 0.08 && mDgo <= 0.15 * (mean("dgSz") * NDG),
   f(mean("dgSz") * 100, 1) + "% active, overlap " + f(mDgo, 1) + " / size " + f(mean("dgSz") * NDG, 0));
ok("reinstatement recall ≥ 0.80 (mean)", mRc >= 0.80, "= " + f(mRc));
ok("reinstatement recall worst-seed ≥ 0.72", worstLo("rc") >= 0.72, "= " + f(worstLo("rc")));
ok("reinstatement specific: cross-talk ≤ 0.15", mCr <= 0.15, "= " + f(mCr));
ok("reinstatement specific: worst-seed cross ≤ 0.25", worstHi("cross") <= 0.25, "= " + f(worstHi("cross")));

console.log("\n== mechanism control (ablation) ==");
{
  // no binding plasticity (lrBind=0) → index cannot reinstate its assembly
  let rcFlat = 0;
  for (const seed of SEEDS) {
    const cortex = C.create({ seed }); C.encode(cortex);
    const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N, lrBind: 0 }); hpc.plastic = true;
    L.encodeSequence(cortex, hpc, ORDER);
    const A = hpc.indices.map(x => new Set(x.cortex));
    let rc = 0;
    for (let k = 0; k < ORDER.length; k++) {
      const got = new Set(L.reinstateFromIndex(cortex, hpc, k));
      let hit = 0; for (const x of A[k]) if (got.has(x)) hit++; rc += hit / Math.max(1, A[k].size);
    }
    rcFlat += rc / ORDER.length;
  }
  rcFlat /= SEEDS.length;
  ok("no binding → no reinstatement (recall ≤ 0.30)", rcFlat <= 0.30, "recall=" + f(rcFlat));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
