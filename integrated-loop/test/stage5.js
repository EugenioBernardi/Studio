"use strict";
/* Stage-5 acceptance — cross-scale coupling: a validated thalamocortical NREM oscillation
   gates hippocampal replay and consolidation (SPEC beyond the original targets).

   Part A re-verifies the extracted thalamocortical model reproduces its documented regimes
   (wake gamma; NREM slow oscillation with ~73% Down-state occupancy; isolated TC–RTN spindle
   ~15.7 Hz). Part B shows the emergent consequence: consolidation is SLEEP-DEPENDENT — in NREM
   the slow-oscillation Up-states trigger spindle-gated replay that consolidates the memory
   (cortex becomes hippocampus-independent); in wake the persistent Up state produces no SO
   onsets and no spindles, so nothing is gated and the memory stays hippocampus-dependent.

   The sleep rhythm is a global brain state → a fixed thalamocortical seed across memories;
   only the memory (cortex/hippocampus) seed varies. Nightly runtime is real (171-population
   sheet at dt 0.5 ms), so Part B uses short nights and few seeds — the dissociation is sharp. */

const L = require("../src/loop.js");
const K = require("../src/consolidate.js");
const N = require("../src/night.js");
const TC = require("../src/thalamocortical.js");
const { C, H } = L;
const DT = TC.DT;
let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));

function band(buf, lo, hi) { const M = buf.length, mean = buf.reduce((a, b) => a + b, 0) / M, fs = 1000 / DT;
  const pw = fr => { const w = 2 * Math.PI * fr / fs; let re = 0, im = 0;
    for (let n = 0; n < M; n++) { const x = buf[n] - mean; re += x * Math.cos(w * n); im -= x * Math.sin(w * n); } return re * re + im * im; };
  let b = 0, t = 0; for (let fr = 1; fr <= 40; fr += 0.5) { const p = pw(fr); t += p; if (fr >= lo && fr <= hi) b += p; } return t > 0 ? b / t : 0; }
function peak(buf, lo, hi) { const M = buf.length, mean = buf.reduce((a, b) => a + b, 0) / M, fs = 1000 / DT;
  let bp = 0, bf = 0; for (let fr = lo; fr <= hi; fr += 0.25) { const w = 2 * Math.PI * fr / fs; let re = 0, im = 0;
    for (let n = 0; n < M; n++) { const x = buf[n] - mean; re += x * Math.cos(w * n); im -= x * Math.sin(w * n); }
    const p = re * re + im * im; if (p > bp) { bp = p; bf = fr; } } return bf; }
function collect(net, ms) { const b = []; const n = Math.round(ms / DT); for (let i = 0; i < n; i++) b.push(TC.stepNet(net)); return b; }

console.log("\n== A. thalamocortical model reproduces its documented regimes ==");
{
  let net = TC.create({ seed: 7, arousal: 1 }); collect(net, 2000);
  const wk = collect(net, 4000);
  const gamma = band(wk, 16, 40), wdelta = band(wk, 1, 4);
  ok("wake: gamma-dominant (16–40 Hz > delta)", gamma > wdelta && gamma >= 0.25, "gamma=" + f(gamma) + " delta=" + f(wdelta));

  net = TC.create({ seed: 7, arousal: 0.08 }); collect(net, 2000);
  const nr = collect(net, 6000);
  let down = 0, tot = 0; net = TC.create({ seed: 7, arousal: 0.08 }); collect(net, 2000);
  for (let i = 0; i < Math.round(6000 / DT); i++) { TC.stepNet(net); let e = 0; for (let c = 0; c < net.NCOL; c++) e += net.S.r[net.IDX[`E23_${c}`]]; e /= net.NCOL; if (e < 0.15) down++; tot++; }
  const occ = 100 * down / tot, sof = peak(nr, 0.3, 4), nrdelta = band(nr, 1, 4);
  ok("NREM: slow oscillation < 2 Hz, delta-dominant", sof < 2 && nrdelta >= 0.4, "peak=" + f(sof) + "Hz delta=" + f(nrdelta));
  ok("NREM: Down-state occupancy ≈ 73% (60–85%)", occ >= 60 && occ <= 85, "= " + f(occ, 0) + "%");

  // isolated TC–RTN spindle ~15.7 Hz
  net = TC.create({ seed: 7, arousal: 0.08 }); net.M.thal_cx = 0; net.M.cx_tc = 0; net.M.cx_rtn = 0; net.M.wNgfTC = 0; TC.rebuild(net);
  collect(net, 2000); const tbuf = []; for (let i = 0; i < Math.round(6000 / DT); i++) { TC.stepNet(net); let s = 0; for (let c = 0; c < net.NCOL; c++) s += net.S.r[net.IDX[`TC_${c}`]]; tbuf.push(s); }
  const spf = peak(tbuf, 8, 20);
  ok("isolated TC–RTN spindle in 12–18 Hz (~15.7)", spf >= 12 && spf <= 18, "= " + f(spf, 1) + "Hz");
}

console.log("\n== B. consolidation is sleep-dependent (emergent from the thalamocortical state) ==");
{
  const ORDER = [0, 1, 2, 3, 4, 5];
  function night(memSeed, arousal) {
    const cortex = C.create({ seed: memSeed }); C.encode(cortex);
    const hpc = H.createHPC({ seed: 100 + memSeed * 7, NC: cortex.N }); hpc.plastic = true;
    L.encodeSequence(cortex, hpc, ORDER);
    const assemblies = hpc.indices.map(x => x.cortex);
    const enc = {}; ORDER.forEach((s, k) => enc[k] = k);
    const cons = K.createConsolidation(cortex);
    const st = N.runNight(cortex, hpc, cons, { arousal }, { seconds: 55, spindleThr: 0.15, order: ORDER, seed: 7 });
    return { rho: L.spearman(K.corticalRecall(cortex, cons, assemblies, {}), enc).rho, gated: st.gatedEvents, ups: st.upOnsets };
  }
  const SEEDS = [1, 2, 3];
  const nrem = SEEDS.map(s => night(s, 0.08));
  const wake = SEEDS.map(s => night(s, 1.0));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const nrRho = mean(nrem.map(r => r.rho)), wkRho = mean(wake.map(r => r.rho));
  const nrGated = mean(nrem.map(r => r.gated)), wkGated = mean(wake.map(r => r.gated));
  const wkUps = mean(wake.map(r => r.ups));
  console.log("  NREM: " + f(nrGated, 0) + " spindle-gated replay events → cortical recall ρ=" + f(nrRho));
  console.log("  WAKE: " + f(wkUps, 0) + " SO onsets, " + f(wkGated, 0) + " gated events → cortical recall ρ=" + f(wkRho));

  ok("wake produces no spindle-gated replay (≈0 events)", wkGated <= 1, "= " + f(wkGated, 1));
  ok("NREM produces many gated replay events (≥8)", nrGated >= 8, "= " + f(nrGated, 0));
  ok("NREM consolidates: cortex becomes HP-independent (ρ ≥ 0.8)", nrRho >= 0.8, "= " + f(nrRho));
  ok("wake does NOT consolidate: memory stays HP-dependent (ρ ≤ 0.4)", wkRho <= 0.4, "= " + f(wkRho));
  ok("sleep-dependence: Δρ(NREM−wake) ≥ 0.5", (nrRho - wkRho) >= 0.5, "Δ = " + f(nrRho - wkRho));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
