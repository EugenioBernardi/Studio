"use strict";
/* Stage-3 acceptance — sharp-wave-ripple REPLAY of the encoded sequence.

   In a low-ACh SWR state, ignition of one index makes CA3 walk the stored order via the
   directed Rseq links, ripple-paced. The test checks the three experimental crux numbers:

     target 1  order fidelity   Spearman ρ(replay, encode) ≥ 0.8    Lee & Wilson 2002
     target 2  time compression replay ≈ 15–20× faster than encode  Davidson 2009 (~20×)
     target 4  forward & reverse both occur                          Diba & Buzsáki 2007

   Encoding lays each item over T_ENC = 0.43 s of simulated time (0.35 s cortical drive +
   0.08 s forward settle). Replay advances one index per ripple frame (frameMs). Replicated
   across seeds; acceptance on the seed mean, plus an ablation proving the order links carry it. */

const L = require("../src/loop.js");
const { C, H } = L;
let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const ORDER = [0, 1, 2, 3, 4, 5];
const T_ENC = 0.43;                 // s of encoding time laid down per item

function build(seed) {
  const cortex = C.create({ seed }); C.encode(cortex);
  const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
  L.encodeSequence(cortex, hpc, ORDER);
  const enc = {}; hpc.indices.forEach((x, k) => enc[k] = k);
  return { cortex, hpc, enc };
}
const uniq = a => [...new Set(a)];

const fwd = [], rev = [], comp = [], cover = [];
for (const seed of SEEDS) {
  const { cortex, hpc, enc } = build(seed);
  const F = L.replaySequencePaced(cortex, hpc, {});
  const Rv = L.replaySequencePaced(cortex, hpc, { reverse: true });
  const spF = L.spearman(F.seq, enc), spR = L.spearman(Rv.seq, enc);
  fwd.push(spF.rho); rev.push(spR.rho);
  cover.push(uniq(F.seq).length);
  const nT = F.seq.length - 1, span = F.times[F.times.length - 1] - F.times[0];
  comp.push(nT > 0 && span > 0 ? (nT * T_ENC * 1000) / span : 0);
}
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const worstLo = a => a.reduce((w, v) => v < w ? v : w, a[0]);
const worstHi = a => a.reduce((w, v) => v > w ? v : w, a[0]);

console.log("\n== replay (" + SEEDS.length + " seeds) ==");
console.log("  forward ρ mean=" + f(mean(fwd)) + " worst=" + f(worstLo(fwd)) +
            "  coverage=" + f(mean(cover), 1) + "/6  compression=" + f(mean(comp), 1) + "×");
console.log("  reverse ρ mean=" + f(mean(rev)) + " worst=" + f(worstHi(rev)));

ok("target 1 — forward order fidelity ρ ≥ 0.8 (mean)", mean(fwd) >= 0.8, "= " + f(mean(fwd)));
ok("target 1 — worst-seed forward ρ ≥ 0.8", worstLo(fwd) >= 0.8, "= " + f(worstLo(fwd)));
ok("forward replay covers ≥ 5/6 indices (mean)", mean(cover) >= 5.0, "= " + f(mean(cover), 1));
ok("target 2 — compression in 12–24× (≈15–20× range)", mean(comp) >= 12 && mean(comp) <= 24, "= " + f(mean(comp), 1) + "×");
ok("target 4 — reverse replay occurs, reverse order ρ ≤ -0.8 (mean)", mean(rev) <= -0.8, "= " + f(mean(rev)));
// Reverse replay is reported as a DISTRIBUTION, not an all-seeds requirement: experimentally
// reverse replay occurs on a fraction of ripple events, not every one, and the backward links
// are deliberately weaker than the forward ones. Forward is required on every seed.
{
  const revSeeds = rev.filter(r => r <= -0.8).length;
  ok("target 4 — forward every seed, reverse on ≥70% of seeds",
     fwd.every(r => r >= 0.8) && revSeeds >= 0.7 * rev.length,
     "fwd " + fwd.length + "/" + fwd.length + ", rev " + revSeeds + "/" + rev.length);
}

console.log("\n== mechanism control (ablation) ==");
{
  // remove the directed order links (Rseq) → ignition cannot walk the sequence
  let rhoNo = [], covNo = [];
  for (const seed of SEEDS) {
    const cortex = C.create({ seed }); C.encode(cortex);
    const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N, lrAsym: 0 }); hpc.plastic = true;
    L.encodeSequence(cortex, hpc, ORDER);
    const enc = {}; hpc.indices.forEach((x, k) => enc[k] = k);
    const F = L.replaySequencePaced(cortex, hpc, {});
    rhoNo.push(Math.abs(L.spearman(F.seq, enc).rho)); covNo.push(uniq(F.seq).length);
  }
  ok("no order links → no sequential replay (coverage ≤ 2/6)", mean(covNo) <= 2.0, "coverage=" + f(mean(covNo), 1));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
