"use strict";
/* =====================================================================
   The loop orchestrator — ties cortex ⇄ EC ⇄ hippocampus together and runs
   the three phases: ENCODE+BIND, REPLAY, CONSOLIDATE.

   Encoding (high ACh, theta): drive each stimulus in the sequence into cortex,
   let its assembly settle, push it forward through EC→DG→CA3 to select a sparse
   index, then bind bidirectionally (Wec: EC→cortex; Wc1e: CA1→EC) and store the
   ORDER as asymmetric CA3 recurrent links I_k→I_{k+1}.

   Replay (low ACh, SWR): ignite the first index; CA3 asymmetric recurrence walks
   the sequence; each index reinstates its cortical assembly through the back-
   projection. Consolidation Hebb then writes the cortico-cortical chain.
   ===================================================================== */

const C = require("./cortex.js");
const H = require("./hippocampus.js");

// settle the hippocampal fields to the pattern for the CURRENT cortical activity
function settleForward(hpc, cortexA, ms) {
  hpc.ec.fill(0); hpc.dg.fill(0); hpc.ca3.fill(0); hpc.ca1.fill(0);
  hpc.iEC = hpc.iDG = hpc.iCA3 = hpc.iCA1 = 0;
  for (let t = 0; t < (ms || 80); t++) H.forwardStep(hpc, cortexA);
}

// one-shot Hebbian outer-product binding of two settled patterns, with subtractive norm.
// proj is dense-per-postsynaptic (proj.wt[i] indexed by presynaptic j).
function bindDense(proj, postArr, preArr, actThr, lr, wMax, budget) {
  const preActive = [];
  for (let j = 0; j < preArr.length; j++) if (preArr[j] > actThr) preActive.push(j);
  for (let i = 0; i < postArr.length; i++) {
    if (postArr[i] < actThr) continue;
    const w = proj.wt[i];
    for (const j of preActive) w[j] = Math.min(wMax, w[j] + lr * postArr[i] * preArr[j]);
    H.normSparse(w, budget);
  }
}

// bind the CA3 recurrent store: symmetric auto-association within the current index
function bindCA3sym(hpc, actThr) {
  const P = hpc.P, ca3 = hpc.ca3, R = hpc.Rca3;
  for (let i = 0; i < ca3.length; i++) {
    if (ca3[i] < actThr) continue;
    const id = R.idx[i], w = R.wt[i]; let touched = false;
    for (let k = 0; k < id.length; k++) {
      const aj = ca3[id[k]];
      if (aj > actThr) { w[k] = Math.min(P.wRecMax3, w[k] + P.lrRec3 * ca3[i] * aj); touched = true; }
    }
    if (touched) H.normSparse(w, P.wBudget3);
  }
}

// store ORDER as directed transition weights in the SEPARATE Rseq matrix: a STRONG forward
// link prev→curr and a WEAKER backward link curr→prev, written directly (capped, no competitive
// normalisation), so the forward:backward ratio is exactly asymBack. Ignition site then sets
// replay direction — forward from the start (strong) or reverse from the end (weak backward links).
function bindCA3asym(hpc, prevSet, prevCells, currCells) {
  const P = hpc.P, R = hpc.Rseq, cap = P.wRecMax3;
  const currSet = new Set(currCells);
  for (const i of currCells) {                 // forward: postsynaptic curr ← presynaptic prev
    const id = R.idx[i], w = R.wt[i];
    for (let k = 0; k < id.length; k++) if (prevSet.has(id[k])) w[k] = Math.min(cap, w[k] + P.lrAsym);
  }
  for (const i of prevCells) {                  // backward: postsynaptic prev ← presynaptic curr (weaker)
    const id = R.idx[i], w = R.wt[i];
    for (let k = 0; k < id.length; k++) if (currSet.has(id[k])) w[k] = Math.min(cap, w[k] + P.lrAsym * P.asymBack);
  }
}

// ENCODE a sequence of stimulus indices. Returns the recorded indices (in order).
function encodeSequence(cortex, hpc, order, opts) {
  opts = opts || {};
  const actThr = hpc.P.actThr;
  hpc.P.ach = 1.0;                 // high ACh: recurrence gated off, plasticity on
  hpc.indices = [];
  let prevSet = null, prevCells = null;
  for (let k = 0; k < order.length; k++) {
    const s = order[k];
    // drive the assembly and KEEP it active while the hippocampus reads it and binding runs
    // (do not use C.present here: it clears drive and settles, so a marginal assembly decays)
    cortex.a.fill(0); cortex.inh = 0;
    C.setExt(cortex, cortex.stim[s]); C.run(cortex, 0.35);
    const cortexSet = C.activeSet(cortex);    // assembly A_s, with drive on
    settleForward(hpc, cortex.a, opts.settleMs || 80);
    const idxCells = H.activeSet(hpc.ca3, actThr);

    // bidirectional binding: index ↔ EC ↔ cortex
    bindDense(hpc.Wec,  cortex.a, hpc.ec,  actThr, hpc.P.lrBind, hpc.P.wBindMax, hpc.P.wBudgetBind);
    bindDense(hpc.Wc1e, hpc.ec,   hpc.ca1, actThr, hpc.P.lrBind, hpc.P.wBindMax, hpc.P.wBudgetBind);
    bindCA3sym(hpc, actThr);
    if (prevSet) bindCA3asym(hpc, prevSet, prevCells, idxCells);

    hpc.indices.push({ s, cells: idxCells, cortex: cortexSet });
    prevSet = new Set(idxCells); prevCells = idxCells;
  }
  C.clearExt(cortex);
  return hpc.indices;
}

// REINSTATE the cortical assembly from a CA3 index (backward pass + cortical completion).
// Seeds CA3 with the stored index, settles the back-projection, injects EC drive into cortex.
function reinstateFromIndex(cortex, hpc, k, opts) {
  opts = opts || {};
  const idx = hpc.indices[k];
  // seed CA3 with the index pattern
  hpc.ca3.fill(0); for (const c of idx.cells) hpc.ca3[c] = 1.0;
  hpc.ca1.fill(0); hpc.ec.fill(0); hpc.iCA1 = 0; hpc.iEC = 0;
  for (let t = 0; t < (opts.backMs || 40); t++) H.backwardStep(hpc);   // CA1→EC→ecReinstate
  // drive cortex with the reinstatement current, let cortical recurrence complete
  cortex.a.fill(0); cortex.inh = 0;
  const scale = opts.driveScale == null ? 1.8 : opts.driveScale;
  const drive = new Float64Array(cortex.N);
  for (let i = 0; i < cortex.N; i++) drive[i] = scale * hpc.ecReinstate[i];
  C.setExt(cortex, drive);
  C.run(cortex, opts.dur == null ? 0.20 : opts.dur);
  const got = C.activeSet(cortex);
  C.clearExt(cortex);
  return got;
}

// which stored index is currently dominant in CA3 (argmax active-fraction above a floor)?
function dominantIndex(hpc, floor) {
  floor = floor == null ? 0.40 : floor;
  let best = -1, bestFrac = floor;
  for (let k = 0; k < hpc.indices.length; k++) {
    const cells = hpc.indices[k].cells; let on = 0;
    for (const c of cells) if (hpc.ca3[c] > hpc.P.actThr) on++;
    const frac = on / Math.max(1, cells.length);
    if (frac > bestFrac) { bestFrac = frac; best = k; }
  }
  return best;
}

// REPLAY: ignite one index in a low-ACh SWR state and let CA3 asymmetric recurrence walk
// the sequence. Records the order indices become dominant and the time of each transition,
// and (optionally) the cortical assembly reinstated at each step for HPC→cortex lag.
function replaySequence(cortex, hpc, opts) {
  opts = opts || {};
  const dt = hpc.P.dt;
  hpc.P.ach = opts.ach == null ? 0.15 : opts.ach;     // low ACh: recurrence engaged
  hpc.adapt3.fill(0);
  const nIdx = hpc.indices.length;
  const start = opts.reverse ? nIdx - 1 : (opts.start == null ? 0 : opts.start);
  // ignite the seed index
  hpc.ca3.fill(0); for (const c of hpc.indices[start].cells) hpc.ca3[c] = 1.0;
  hpc.ca1.fill(0); hpc.ec.fill(0); hpc.iCA3 = hpc.iEC = hpc.iCA1 = 0;
  if (opts.trackCortex) { cortex.a.fill(0); cortex.inh = 0; }

  const seq = [], times = [], cortexSeq = [], cortexTimes = [];
  let lastIdx = -1, lastCortex = -1;
  const maxMs = opts.maxMs || 500;
  for (let t = 0; t < maxMs; t++) {
    H.replayStep(hpc);
    const cur = dominantIndex(hpc, opts.floor);
    if (cur >= 0 && cur !== lastIdx) { seq.push(cur); times.push(t); lastIdx = cur; }

    if (opts.trackCortex) {
      // drive cortex from the ongoing EC reinstatement current and let it settle a little
      const drive = new Float64Array(cortex.N);
      const sc = opts.driveScale == null ? 1.8 : opts.driveScale;
      for (let i = 0; i < cortex.N; i++) drive[i] = sc * hpc.ecReinstate[i];
      C.setExt(cortex, drive); C.step(cortex);
      // which assembly is dominant in cortex now?
      let bestC = -1, bf = 0.45;
      for (let k = 0; k < nIdx; k++) {
        const cs = hpc.indices[k].cortex; let on = 0;
        for (const x of cs) if (cortex.a[x] > cortex.P.actThr) on++;
        const fr = on / Math.max(1, cs.length);
        if (fr > bf) { bf = fr; bestC = k; }
      }
      if (bestC >= 0 && bestC !== lastCortex) { cortexSeq.push(bestC); cortexTimes.push(t); lastCortex = bestC; }
    }
  }
  if (opts.trackCortex) C.clearExt(cortex);
  return { seq, times, cortexSeq, cortexTimes };
}

// One CA3 settle step seeded by a source index whose Rseq output (the directed transition
// drive) points toward the next index, under strong WTA inhibition. Auto-association sharpens
// the seeded cells into a full index; adaptation keeps just-visited indices from being reselected.
function ca3Settle(hpc, src, gWTA) {
  const P = hpc.P, ca3 = hpc.ca3, N = ca3.length, dt = P.dt;
  const achRec = 1 - 0.85 * P.ach;
  let sum = 0; const nx = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const directed = H.dot(hpc.Rseq, i, src);            // transition drive from the source index
    const drive = P.seqGain * directed + achRec * H.dot(hpc.Rca3, i, ca3)
                  - P.thr - gWTA * hpc.iCA3 - P.adaptGain3 * hpc.adapt3[i];
    nx[i] = drive > 0 ? (drive * P.gain > 1.3 ? 1.3 : drive * P.gain) : 0;
  }
  for (let i = 0; i < N; i++) { ca3[i] += (dt / P.tauA) * (nx[i] - ca3[i]); sum += ca3[i]; }
  hpc.iCA3 += (dt / P.tauI) * (sum / N - hpc.iCA3);
}

// RIPPLE-PACED replay. Each ripple frame is one transition: the current index's Rseq output
// seeds a fresh WTA competition that settles onto the NEXT index; the winner is recorded, made
// refractory (adaptation), and becomes the seed for the following frame. The ripple supplies the
// clock (150–250 Hz organises replay into discrete cycles); Rseq supplies the content — which
// index follows which is entirely emergent from the encoded order, never scripted.
function replaySequencePaced(cortex, hpc, opts) {
  opts = opts || {};
  const P = hpc.P, nIdx = hpc.indices.length;
  P.ach = opts.ach == null ? 0.15 : opts.ach;
  hpc.adapt3.fill(0);
  const gWTA = opts.gWTA == null ? 9.0 : opts.gWTA;
  const settleMs = opts.settleMs == null ? 10 : opts.settleMs;
  const frameMs = opts.frameMs == null ? 24 : opts.frameMs;   // ripple-frame period → ~18× compression
  const nFrames = opts.nFrames == null ? nIdx + 3 : opts.nFrames;
  const refractory = opts.refractory == null ? 4.0 : opts.refractory;
  const start = opts.reverse ? nIdx - 1 : (opts.start == null ? 0 : opts.start);

  let current = hpc.indices[start].cells;
  for (const c of current) hpc.adapt3[c] = refractory;  // the seed index is now refractory
  const seq = [start], times = [0], cortexSeq = [], cortexTimes = [];
  const visited = new Set([start]);
  let t = 0, lastCortex = -1;

  for (let f = 0; f < nFrames; f++) {
    // directed seed from the current index
    const src = new Float64Array(P.NCA3);
    for (const c of current) src[c] = 1.0;
    // fresh WTA settle onto the next index
    hpc.ca3.fill(0); hpc.iCA3 = 0;
    for (let s = 0; s < settleMs; s++) ca3Settle(hpc, src, gWTA);
    t += frameMs;

    const win = dominantIndex(hpc, opts.floor);
    if (win < 0 || visited.has(win)) break;              // wave died or looped back — sequence ends
    seq.push(win); times.push(t); visited.add(win);
    for (const c of hpc.indices[win].cells) hpc.adapt3[c] = refractory;   // refractory
    current = hpc.indices[win].cells;

    if (opts.trackCortex) {                              // reinstate cortex from this index
      const got = reinstateFromIndex(cortex, hpc, win, { driveScale: opts.driveScale });
      // (dominant assembly is `win` by construction of reinstateFromIndex; log its onset)
      if (win !== lastCortex) { cortexSeq.push(win); cortexTimes.push(t); lastCortex = win; }
      // reinstateFromIndex overwrote hpc.ca3/ca1/ec; restore the index seed for the next frame
      hpc.ca3.fill(0); for (const c of current) hpc.ca3[c] = 1.0;
    }
  }
  return { seq, times, cortexSeq, cortexTimes };
}

// Spearman rank correlation between an observed order of items and their encoded rank.
function spearman(observed, encodedRankOf) {
  // observed: array of item ids in the order they first appeared during replay
  const seen = [], ranks = [];
  for (const it of observed) if (!seen.includes(it)) seen.push(it);
  if (seen.length < 2) return { rho: 0, n: seen.length };
  const x = seen.map((_, i) => i);                 // replay order rank
  const y = seen.map(it => encodedRankOf[it]);     // encode order rank
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(x), my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return { rho: dx && dy ? num / Math.sqrt(dx * dy) : 0, n: seen.length };
}

module.exports = { C, H, settleForward, encodeSequence, reinstateFromIndex,
  bindDense, bindCA3sym, bindCA3asym, replaySequence, replaySequencePaced,
  ca3Settle, dominantIndex, spearman };
