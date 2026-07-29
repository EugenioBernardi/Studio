"use strict";
/* =====================================================================
   Neocortex module (stage 1 of the loop).

   A recurrent rate network with feedback (PV-like) inhibition that sets
   sparsity, and Hebbian recurrent plasticity that makes each stimulus an
   auto-associative ASSEMBLY (sparse, stimulus-specific, pattern-completing).

   Two mechanisms carry the biology, and both are load-bearing (verified by
   the stage-1 probe — remove either and the assemblies stop working):

     • FEEDBACK INHIBITION, not a k-winners shortcut, sets the active fraction.
       A PV-like pool tracks mean activity and divides it back out, so sparsity
       is emergent and self-scaling.
     • SUBTRACTIVE synaptic normalisation (Miller & MacKay 1994; the same lesson
       the Kuramoto-assembly model paid for) bounds each cell's total *incoming*
       recurrent weight. Potentiating the within-assembly synapses therefore
       DEPRESSES a cell's other synapses — competition that keeps membership
       crisp and stops distinct assemblies from merging into one attractor.

   Validated here (stage 1, `test/stage1.js`): assemblies are sparse (2–10%),
   near-orthogonal across stimuli (encoded overlap ~chance), and complete from a
   partial cue (high recall) WITHOUT recruiting other assemblies (low off-target).
   The entorhinal + hippocampal stages attach to these assemblies in later files.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function defaults() {
  return {
    seed: 7,
    NC: 1600,           // cortical excitatory cells (4× baseline; dynamics are scale-invariant)
    nStim: 8,           // distinct sensory stimuli
    pIn: 0.10,          // fraction of cortex a stimulus drives (feedforward)
    inDrive: 1.0,       // feedforward drive amplitude (crisp: driven cells go clearly on)
    pRec: 0.15,         // recurrent connectivity (each cell ← pRec·NC others)
    wRecInit: 0.0,      // recurrent weights start silent; learning builds assemblies
    wRecMax: 1.2,       // per-synapse cap
    wBudget: 1.3,       // subtractive-normalisation cap on total incoming recurrent weight per cell
    gI: 9.0,            // feedback inhibition gain (sets sparsity)
    thr: 0.18,          // spiking threshold
    gain: 1.6,          // post-threshold gain (supralinear push toward a crisp on-state)
    tauA: 0.020,        // activity time constant (s)
    tauI: 0.006,        // inhibition time constant (s)
    dt: 0.001,          // s
    lrRec: 2.5,         // Hebbian recurrent learning rate
    encReps: 4,         // encoding presentations per stimulus (multi-trial learning)
    actThr: 0.30,       // "active" threshold for assembly membership
  };
}

function create(opts) {
  const P = Object.assign(defaults(), opts || {});
  const rnd = mulberry32(P.seed);
  const N = P.NC;

  // feedforward stimulus patterns: each stimulus drives a fixed sparse subset
  const stim = [];
  for (let s = 0; s < P.nStim; s++) {
    const v = new Float64Array(N);
    for (let i = 0; i < N; i++) if (rnd() < P.pIn) v[i] = P.inDrive * (0.7 + 0.6 * rnd());
    stim.push(v);
  }

  // sparse recurrent connectivity: presynaptic index/weight lists per postsynaptic cell.
  // convergence-preserving: pRec scales as 1/N (relative to the 400-cell baseline) so each cell
  // keeps a fixed ~60 recurrent inputs regardless of scale. This holds within-assembly recurrence
  // (hence pattern completion) constant AND makes the per-step cost O(N) instead of O(N²).
  const pRecEff = Math.min(1, P.pRec * 400 / N);
  const preIdx = [], preW = [];
  for (let i = 0; i < N; i++) {
    const idx = [], w = [];
    for (let j = 0; j < N; j++) if (j !== i && rnd() < pRecEff) { idx.push(j); w.push(P.wRecInit); }
    preIdx.push(Int32Array.from(idx)); preW.push(Float64Array.from(w));
  }

  return {
    P, rnd, N, stim, preIdx, preW,
    a: new Float64Array(N),
    nx: new Float64Array(N),            // scratch for one step; hoisted so N = 10 000 does not
                                        // allocate 80 kB per simulated millisecond
    inh: 0, ext: new Float64Array(N),   // ext = current external drive
    plastic: false,
    assemblies: [],                     // recorded assembly cell-sets per stimulus
  };
}

function setExt(S, vec) { S.ext.set(vec); }
function clearExt(S) { S.ext.fill(0); }

// subtractive normalisation of a cell's incoming recurrent weights to a budget
function normalizeCell(S, i) {
  const pw = S.preW[i]; if (pw.length === 0) return;
  let sum = 0; for (let k = 0; k < pw.length; k++) sum += pw[k];
  const excess = sum - S.P.wBudget;
  if (excess <= 0) return;
  const dec = excess / pw.length;                 // subtractive: same amount off every synapse
  for (let k = 0; k < pw.length; k++) pw[k] = pw[k] > dec ? pw[k] - dec : 0;
}

function step(S) {
  const P = S.P, N = S.N, dt = P.dt;
  let sumAct = 0;
  const nx = S.nx || (S.nx = new Float64Array(N));
  const a = S.a, ext = S.ext, gIinh = P.gI * S.inh + P.thr;
  for (let i = 0; i < N; i++) {
    let rec = 0; const pi = S.preIdx[i], pw = S.preW[i];
    for (let k = 0; k < pi.length; k++) rec += pw[k] * a[pi[k]];
    const drive = ext[i] + rec - gIinh;
    nx[i] = drive > 0 ? clamp(P.gain * drive, 0, 1.3) : 0;   // supralinear post-threshold gain
  }
  for (let i = 0; i < N; i++) { S.a[i] += (dt / P.tauA) * (nx[i] - S.a[i]); sumAct += S.a[i]; }
  const meanAct = sumAct / N;
  S.inh += (dt / P.tauI) * (meanAct - S.inh);      // feedback inhibition tracks mean activity

  // Hebbian recurrent plasticity (only when encoding): co-active pre→post strengthen,
  // then subtractive normalisation depresses the losers → crisp, competing assemblies.
  if (S.plastic) {
    for (let i = 0; i < N; i++) {
      if (S.a[i] < P.actThr) continue;
      const pi = S.preIdx[i], pw = S.preW[i];
      let touched = false;
      for (let k = 0; k < pi.length; k++) {
        const aj = S.a[pi[k]];
        if (aj > P.actThr) { pw[k] = clamp(pw[k] + P.lrRec * dt * S.a[i] * aj, 0, P.wRecMax); touched = true; }
      }
      if (touched) normalizeCell(S, i);
    }
  }
}

function run(S, seconds) { const n = Math.round(seconds / S.P.dt); for (let k = 0; k < n; k++) step(S); }

function activeSet(S, thr) { thr = thr == null ? S.P.actThr : thr;
  const set = []; for (let i = 0; i < S.N; i++) if (S.a[i] > thr) set.push(i); return set; }
function activeFrac(S, thr) { return activeSet(S, thr).length / S.N; }

// present a stimulus (optionally only a fraction of its inputs = partial cue), settle, return the assembly.
// reset: clear activity first so encoding one assembly never Hebbian-links it to the previous one.
function present(S, sIdx, frac, dur, reset) {
  frac = frac == null ? 1 : frac; dur = dur == null ? 0.35 : dur;
  if (reset) { S.a.fill(0); S.inh = 0; }
  const v = S.stim[sIdx];
  const cue = new Float64Array(S.N);
  if (frac >= 1) cue.set(v);
  else { for (let i = 0; i < S.N; i++) if (v[i] > 0 && S.rnd() < frac) cue[i] = v[i]; }
  setExt(S, cue); run(S, dur);
  const set = activeSet(S);
  clearExt(S); run(S, 0.12);
  return set;
}

// encode: present each stimulus (repeatedly) with plasticity on so its assembly auto-associates
function encode(S, dur) {
  dur = dur == null ? 0.35 : dur;
  const reps = S.P.encReps;
  for (let r = 0; r < reps; r++) {
    for (let s = 0; s < S.P.nStim; s++) {
      S.plastic = true; present(S, s, 1, dur, true); S.plastic = false;
    }
  }
  // record the settled assembly for each stimulus (weights frozen)
  S.assemblies = [];
  for (let s = 0; s < S.P.nStim; s++) S.assemblies.push(present(S, s, 1, dur, true));
}

const overlap = (a, b) => { const sb = new Set(b); let c = 0; for (const x of a) if (sb.has(x)) c++; return c; };

module.exports = { create, defaults, step, run, present, encode, setExt, clearExt,
  activeSet, activeFrac, overlap, normalizeCell, mulberry32 };
