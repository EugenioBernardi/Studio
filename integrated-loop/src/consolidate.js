"use strict";
/* =====================================================================
   Systems consolidation (stage 4 of the loop).

   Replay reinstates the cortical assemblies A_1→A_2→… in the encoded order. A directed
   cortico-cortical store Wcc learns those transitions: each replay event that reinstates
   A_k just before A_{k+1} strengthens Wcc[A_{k+1} ← A_k]. After enough replay Wcc is strong
   enough that the cortex, cued with A_1, walks the whole sequence WITHOUT the hippocampus.

   That is the systems-consolidation gradient: a RECENT memory (few replays, weak Wcc) is
   HP-dependent — remove the hippocampus and recall is abolished; a REMOTE memory (many
   replays, strong Wcc) is HP-independent — recall survives the lesion (Kim & Fanselow 1992;
   Frankland & Bontempi 2005). The mechanism, not a switch: the gradient falls out of how
   much Wcc a memory has accumulated.

   The cortical walk reuses the SAME machinery as CA3 replay — directed transitions + within-
   assembly auto-association + refractory adaptation, ripple-paced — but in cortex, driven by
   Wcc instead of Rseq. Nothing about the order is scripted; Wcc holds it, replay wrote it.
   ===================================================================== */

const C = require("./cortex.js");
const H = require("./hippocampus.js");

function createConsolidation(cortex, opts) {
  opts = opts || {};
  const N = cortex.N, rnd = cortex.rnd, p = opts.pCC == null ? 0.15 : opts.pCC;
  // directed cortico-cortical connectivity (own random draw), weights start silent
  const idx = [], wt = [];
  for (let i = 0; i < N; i++) {
    const id = [], w = [];
    for (let j = 0; j < N; j++) if (j !== i && rnd() < p) { id.push(j); w.push(0); }
    idx.push(Int32Array.from(id)); wt.push(Float64Array.from(w));
  }
  return {
    N, idx, wt,
    lrCC: opts.lrCC == null ? 0.03 : opts.lrCC,       // per-event potentiation of a transition link
    wCCmax: opts.wCCmax == null ? 1.2 : opts.wCCmax,
    seqGain: opts.seqGain == null ? 0.9 : opts.seqGain, // directed cortical drive gain in recall
    adaptGain: opts.adaptGain == null ? 0.6 : opts.adaptGain,
    events: 0,                                          // replay events accumulated
  };
}

const dotCC = (cons, i, src) => { const id = cons.idx[i], w = cons.wt[i]; let s = 0;
  for (let k = 0; k < id.length; k++) s += w[k] * src[id[k]]; return s; };

// Write one transition A_prev → A_cur into Wcc (directed, capped). Called by replay for each
// consecutive pair of reinstated assemblies. Repetition across replay events accumulates weight.
function writeTransition(cons, prevSet, curCells) {
  const cap = cons.wCCmax;
  for (const i of curCells) {                          // postsynaptic = later assembly
    const id = cons.idx[i], w = cons.wt[i];
    for (let k = 0; k < id.length; k++) if (prevSet.has(id[k])) w[k] = Math.min(cap, w[k] + cons.lrCC);
  }
}

// Run `nEvents` replay events (HPC drives cortical reinstatement) and consolidate each into Wcc.
// This is the offline dialogue: every ripple lays a little more cortico-cortical weight down.
function consolidate(cortex, hpc, cons, nEvents, opts) {
  opts = opts || {};
  const ORDER = opts.order;                            // encode order of the stored indices
  for (let e = 0; e < nEvents; e++) {
    // ripple-paced HPC replay; at each frame reinstate the cortical assembly and write the link
    const rep = replayReinstateOrder(cortex, hpc, opts);
    for (let k = 1; k < rep.length; k++) {
      const prevSet = new Set(hpc.indices[rep[k - 1]].cortex);
      writeTransition(cons, prevSet, hpc.indices[rep[k]].cortex);
    }
    cons.events++;
  }
}

// helper: run one HPC replay and return the order of indices whose assemblies were reinstated
function replayReinstateOrder(cortex, hpc, opts) {
  const L = require("./loop.js");
  const rep = L.replaySequencePaced(cortex, hpc, opts);
  return rep.seq;
}

// One cortical settle step: within-assembly auto-association (cortex recurrent) + directed Wcc
// drive from the source assembly, under WTA inhibition and refractory adaptation. Cortex only.
function cortexSettle(cortex, cons, src, adapt, gWTA) {
  const P = cortex.P, N = cortex.N, dt = P.dt;
  const nx = new Float64Array(N); let sum = 0;
  for (let i = 0; i < N; i++) {
    let rec = 0; const pi = cortex.preIdx[i], pw = cortex.preW[i];
    for (let k = 0; k < pi.length; k++) rec += pw[k] * cortex.a[pi[k]];
    const directed = dotCC(cons, i, src);
    const drive = cons.seqGain * directed + rec - gWTA * cortex.inh - P.thr - cons.adaptGain * adapt[i];
    nx[i] = drive > 0 ? (P.gain * drive > 1.3 ? 1.3 : P.gain * drive) : 0;
  }
  for (let i = 0; i < N; i++) { cortex.a[i] += (dt / P.tauA) * (nx[i] - cortex.a[i]); sum += cortex.a[i]; }
  cortex.inh += (dt / P.tauI) * (sum / N - cortex.inh);
}

// CORTICAL recall WITHOUT the hippocampus: cue the first assembly, then let the cortex walk the
// sequence via Wcc. Returns the order of assemblies visited (by matching to the stored assemblies).
function corticalRecall(cortex, cons, assemblies, opts) {
  opts = opts || {};
  const gWTA = opts.gWTA == null ? 9.0 : opts.gWTA;
  const settleMs = opts.settleMs == null ? 10 : opts.settleMs;
  const nFrames = opts.nFrames == null ? assemblies.length + 2 : opts.nFrames;
  const refractory = opts.refractory == null ? 4.0 : opts.refractory;
  const floor = opts.floor == null ? 0.40 : opts.floor;
  const start = opts.start == null ? 0 : opts.start;
  const adapt = new Float64Array(cortex.N);

  const sets = assemblies.map(a => new Set(a));
  const dominant = () => {
    let best = -1, bf = floor;
    for (let k = 0; k < sets.length; k++) { let on = 0; for (const c of sets[k]) if (cortex.a[c] > cortex.P.actThr) on++;
      const fr = on / Math.max(1, sets[k].size); if (fr > bf) { bf = fr; best = k; } }
    return best;
  };

  let current = assemblies[start];
  for (const c of current) adapt[c] = refractory;
  const seq = [start]; const visited = new Set([start]);
  for (let f = 0; f < nFrames; f++) {
    const src = new Float64Array(cortex.N); for (const c of current) src[c] = 1.0;
    cortex.a.fill(0); cortex.inh = 0;
    for (let s = 0; s < settleMs; s++) cortexSettle(cortex, cons, src, adapt, gWTA);
    const win = dominant();
    if (win < 0 || visited.has(win)) break;
    seq.push(win); visited.add(win);
    for (const c of assemblies[win]) adapt[c] = refractory;
    current = assemblies[win];
  }
  return seq;
}

module.exports = { createConsolidation, consolidate, writeTransition, corticalRecall,
  cortexSettle, dotCC };
