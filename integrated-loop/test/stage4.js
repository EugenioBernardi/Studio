"use strict";
/* Stage-4 acceptance — the SYSTEMS-CONSOLIDATION GRADIENT (SPEC target 5, the crux).

   Replay writes directed cortico-cortical links (Wcc). A RECENT memory (few replays) has
   weak Wcc and needs the hippocampus to recall; a REMOTE memory (many replays) has strong
   Wcc and recalls cortically on its own. So a hippocampal lesion abolishes recent recall but
   spares remote recall — the Kim & Fanselow (1992) / Frankland & Bontempi (2005) gradient.

   Two recall routes are measured, cueing the first item and asking for the sequence order:
     HPC-intact   : hippocampus replays and reinstates the cortical assemblies (ρ vs encode)
     HPC-lesioned : cortex must walk the sequence via Wcc alone (ρ vs encode)

   RECENT = 2 replay events; REMOTE = 30. Replicated across seeds. */

const L = require("../src/loop.js");
const K = require("../src/consolidate.js");
const { C, H } = L;
let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));

const SEEDS = [1, 2, 3, 4, 5, 6];
const ORDER = [0, 1, 2, 3, 4, 5];
const RECENT = 2, REMOTE = 30;

function trial(seed) {
  const cortex = C.create({ seed }); C.encode(cortex);
  const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
  L.encodeSequence(cortex, hpc, ORDER);
  const assemblies = hpc.indices.map(x => x.cortex);
  const enc = {}; ORDER.forEach((s, k) => enc[k] = k);
  const cons = K.createConsolidation(cortex);

  const hpcRecall = () => L.spearman(L.replaySequencePaced(cortex, hpc, {}).seq, enc).rho;
  const ctxRecall = () => L.spearman(K.corticalRecall(cortex, cons, assemblies, {}), enc).rho;

  // RECENT: little replay
  K.consolidate(cortex, hpc, cons, RECENT, { order: ORDER });
  const recent = { hpc: hpcRecall(), ctx: ctxRecall() };
  // REMOTE: continued replay consolidates cortex
  K.consolidate(cortex, hpc, cons, REMOTE - cons.events, { order: ORDER });
  const remote = { hpc: hpcRecall(), ctx: ctxRecall() };
  return { recent, remote };
}

const R = SEEDS.map(trial);
const m = sel => R.reduce((a, r) => a + sel(r), 0) / R.length;
const mRecentHpc = m(r => r.recent.hpc), mRecentCtx = m(r => r.recent.ctx);
const mRemoteHpc = m(r => r.remote.hpc), mRemoteCtx = m(r => r.remote.ctx);

console.log("\n== consolidation gradient (" + SEEDS.length + " seeds) ==");
console.log("            HPC-intact   HPC-lesioned (cortex only)");
console.log("  RECENT      ρ=" + f(mRecentHpc) + "        ρ=" + f(mRecentCtx) + "   ← recall lost without HPC");
console.log("  REMOTE      ρ=" + f(mRemoteHpc) + "        ρ=" + f(mRemoteCtx) + "   ← recall survives the lesion");

ok("HPC-intact recall works for RECENT memory (ρ ≥ 0.8)", mRecentHpc >= 0.8, "= " + f(mRecentHpc));
ok("HPC-intact recall works for REMOTE memory (ρ ≥ 0.8)", mRemoteHpc >= 0.8, "= " + f(mRemoteHpc));
ok("lesion ABOLISHES recent recall (cortex-only ρ ≤ 0.4)", mRecentCtx <= 0.4, "= " + f(mRecentCtx));
ok("lesion SPARES remote recall (cortex-only ρ ≥ 0.8)", mRemoteCtx >= 0.8, "= " + f(mRemoteCtx));
ok("gradient: remote cortical ≫ recent cortical (Δρ ≥ 0.5)", (mRemoteCtx - mRecentCtx) >= 0.5,
   "Δ = " + f(mRemoteCtx - mRecentCtx));
ok("every seed shows the dissociation", R.every(r => r.recent.ctx <= 0.5 && r.remote.ctx >= 0.8), "");

console.log("\n== mechanism control (ablation) ==");
{
  // no replay-driven consolidation (lrCC=0) → cortex never becomes HP-independent, even 'remote'
  let ctxRemote = 0;
  for (const seed of SEEDS) {
    const cortex = C.create({ seed }); C.encode(cortex);
    const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
    L.encodeSequence(cortex, hpc, ORDER);
    const assemblies = hpc.indices.map(x => x.cortex);
    const enc = {}; ORDER.forEach((s, k) => enc[k] = k);
    const cons = K.createConsolidation(cortex, { lrCC: 0 });
    K.consolidate(cortex, hpc, cons, REMOTE, { order: ORDER });
    ctxRemote += L.spearman(K.corticalRecall(cortex, cons, assemblies, {}), enc).rho;
  }
  ctxRemote /= SEEDS.length;
  ok("no consolidation plasticity → cortex never HP-independent (ρ ≤ 0.4)", ctxRemote <= 0.4, "= " + f(ctxRemote));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
