"use strict";
/* =====================================================================
   The cross-scale coupling (stage 5): a validated thalamocortical NREM oscillation
   GATES hippocampal replay and consolidation — instead of the loop asserting a low-ACh
   window by hand.

   Two signals are read from the thalamocortical sheet (src/thalamocortical.js), and nothing
   about WHICH memory replays is scripted — only WHEN a replay is licensed:

     • SO Up-state onset (cortical Down→Up transition) TRIGGERS a hippocampal replay event.
       Sharp-wave ripples ride the Up-states of the cortical slow oscillation
       (Sirota 2003; Battaglia 2004; Hahn 2007).
     • SPINDLE presence (thalamic 10–16 Hz power in that window) GATES whether the replay's
       co-activation actually consolidates — spindle-nested replay is when the cortical
       plasticity takes (Latchoumane 2017; Maingret 2016; the SO–spindle–ripple triple).

   Healthy NREM produces ~1 Hz Up-states with nested spindles → many gated replay events →
   the cortico-cortical chain consolidates → the memory becomes hippocampus-independent.
   Disrupt the thalamocortical state (cortex saturates, discrete Up-states and spindles are
   lost) and the gate never opens → no consolidation → the memory stays hippocampus-dependent.
   ===================================================================== */

const TC = require("./thalamocortical.js");
const K = require("./consolidate.js");
const DT = TC.DT;

// mean cortical E23 firing across the sheet — the slow-oscillation signal
function cortexE(net) { let e = 0; for (let c = 0; c < net.NCOL; c++) e += net.S.r[net.IDX[`E23_${c}`]]; return e / net.NCOL; }
// thalamic activity (TC pool) — spindle carrier
function thalTC(net) { let s = 0; for (let c = 0; c < net.NCOL; c++) s += net.S.r[net.IDX[`TC_${c}`]]; return s / net.NCOL; }

// spindle power = 10–16 Hz power fraction of a short thalamic buffer
function spindlePower(buf) {
  const N = buf.length; if (N < 32) return 0;
  const mean = buf.reduce((a, b) => a + b, 0) / N, fs = 1000 / DT;
  const pw = f => { const w = 2 * Math.PI * f / fs; let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const x = buf[n] - mean; re += x * Math.cos(w * n); im -= x * Math.sin(w * n); } return re * re + im * im; };
  let band = 0, tot = 0;
  for (let f = 4; f <= 30; f += 1) { const p = pw(f); tot += p; if (f >= 10 && f <= 16) band += p; }
  return tot > 0 ? band / tot : 0;
}

/* Run one NREM "night": step the thalamocortical sheet, detect SO Up-onsets, and on each one
   fire a hippocampal replay event whose consolidation is gated by concurrent spindle power.
   Returns per-night statistics and leaves `cons` (cortico-cortical weights) updated. */
function runNight(cortex, hpc, cons, tcState, opts) {
  opts = opts || {};
  const seconds = opts.seconds == null ? 60 : opts.seconds;
  const upThr = opts.upThr == null ? 0.35 : opts.upThr;      // E rate marking an Up-state
  const downThr = opts.downThr == null ? 0.20 : opts.downThr; // hysteresis: must dip below to re-arm
  const spindleThr = opts.spindleThr == null ? 0.30 : opts.spindleThr; // spindle-gate threshold
  const order = opts.order;

  const net = TC.create(Object.assign({ seed: opts.seed == null ? 7 : opts.seed, arousal: 0.08,
    rings: opts.rings == null ? 3 : opts.rings }, tcState));
  Object.assign(net.M, tcState || {}); TC.rebuild(net);
  for (let i = 0; i < Math.round(2000 / DT); i++) TC.stepNet(net);   // settle into NREM

  const tcBuf = [];
  let armed = true, upOnsets = 0, gatedEvents = 0, spindleHits = 0;
  const nSteps = Math.round(seconds * 1000 / DT);
  for (let i = 0; i < nSteps; i++) {
    TC.stepNet(net);
    tcBuf.push(thalTC(net)); if (tcBuf.length > 120) tcBuf.shift();   // ~60 ms window
    const e = cortexE(net);
    if (e < downThr) armed = true;
    if (armed && e > upThr) {                     // Down→Up transition = SO Up-onset
      armed = false; upOnsets++;
      const sp = spindlePower(tcBuf);
      if (sp >= spindleThr) {                     // spindle-nested → consolidation is licensed
        spindleHits++;
        // fire a hippocampal replay event and consolidate its reinstated cortical sequence
        const rep = K.consolidate(cortex, hpc, cons, 1, { order }) || 1;
        gatedEvents++;
      }
    }
  }
  return { upOnsets, gatedEvents, spindleHits, seconds };
}

module.exports = { runNight, cortexE, thalTC, spindlePower };
