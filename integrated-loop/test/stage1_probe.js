"use strict";
/* Stage-1 diagnostic probe (not the final acceptance test).
   Measures the FOUR quantities that actually matter for assemblies, kept
   separate so a degenerate "everything merges" solution cannot look good:

     sparsity      mean active fraction of a settled assembly        target 2–10%
     xoverlap      mean pairwise overlap of ENCODED assemblies       want ~chance, low
     recall        cue 50% of s  → fraction of assembly_s recovered  want high
     spec          cue 50% of s  → cells fired that are NOT in s      want low (specificity)

   A merged attractor scores recall≈1 but spec≈(everything) and xoverlap high — so it
   is caught. Distinct, completing assemblies score recall high AND spec low AND xoverlap low.
*/
const C = require("../src/cortex.js");

function evalParams(opts, seeds) {
  seeds = seeds || [1, 2, 3];
  let sp = 0, xo = 0, rc = 0, spc = 0;
  for (const seed of seeds) {
    const S = C.create(Object.assign({ seed }, opts));
    C.encode(S, opts._enc || 0.4);
    const A = S.assemblies.map(x => new Set(x));
    // sparsity
    let s0 = 0; for (const a of A) s0 += a.size / S.N; sp += s0 / A.length;
    // pairwise encoded overlap
    let ov = 0, np = 0;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      let c = 0; for (const x of A[i]) if (A[j].has(x)) c++; ov += c; np++;
    }
    xo += ov / np;
    // recall + specificity from 50% cue
    let r0 = 0, sp0 = 0;
    for (let s = 0; s < S.P.nStim; s++) {
      const got = new Set(C.present(S, s, 0.5, 0.35, true));
      const tgt = A[s];
      let hit = 0; for (const x of tgt) if (got.has(x)) hit++;
      r0 += hit / Math.max(1, tgt.size);
      let fp = 0; for (const x of got) if (!tgt.has(x)) fp++;
      sp0 += fp;                     // absolute count of off-target cells recruited
    }
    rc += r0 / S.P.nStim; spc += sp0 / S.P.nStim;
  }
  const n = seeds.length;
  return { sp: sp / n, xo: xo / n, rc: rc / n, spc: spc / n };
}

if (require.main === module) {
  const grid = process.argv.slice(2);
  const show = (o, r) =>
    console.log(
      `sparsity=${(r.sp * 100).toFixed(1)}%  xoverlap=${r.xo.toFixed(1)}  ` +
      `recall=${r.rc.toFixed(2)}  offtarget=${r.spc.toFixed(1)}   ${JSON.stringify(o)}`);
  // baseline
  show({}, evalParams({}));
}
module.exports = { evalParams };
