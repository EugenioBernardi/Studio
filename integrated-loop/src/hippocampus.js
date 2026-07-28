"use strict";
/* =====================================================================
   Hippocampus + entorhinal bridge (stages 2–3 of the loop).

   The shared currency is the cortical ASSEMBLY. The entorhinal cortex (EC) is
   the literal anatomical hub and carries traffic both ways:

     forward  (encode):  cortex assembly A_k → EC e_k → DG (separate) → CA3 index I_k
     backward (replay):  CA3 index I_k → CA1 → EC e_k → cortex assembly A_k

   Structural (fixed random) projections — the anatomy:
     Wce   cortex → EC        (feedforward; gives each assembly a distinct EC pattern)
     Wed   EC → DG            (perforant path; expansion 150→500 for pattern separation)
     Wdc   DG → CA3           (mossy fibres; sparse + powerful = detonator index select)
     Wc31  CA3 → CA1          (Schaffer collaterals)

   Plastic (Hebbian, encode only, ACh-gated) — the memory:
     Rca3  CA3 recurrent      symmetric auto-association + ASYMMETRIC I_k→I_{k+1} (order)
     Wc1e  CA1 → EC           regenerate e_k from the index (back-projection)
     Wec   EC → cortex        regenerate assembly A_k from e_k  (reinstatement)

   Sparsity everywhere is set by FEEDBACK INHIBITION (per field), not k-WTA. DG is the
   sparsest (pattern separation); the mossy detonator makes CA3 sparser still. ACh gates
   encoding vs retrieval (Hasselmo): high ACh during theta encoding, low ACh during SWR.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function hdefaults() {
  return {
    seed: 101,
    NEC: 150, NDG: 500, NCA3: 240, NCA1: 180,
    // structural projection densities
    pCE: 0.12,   // cortex→EC
    pED: 0.06,   // EC→DG (sparse perforant)
    pDC: 0.018,  // DG→CA3 mossy (few but strong)
    pC31: 0.10,  // CA3→CA1
    pRec3: 0.15, // CA3 recurrent connectivity
    // structural weights
    wCE: 0.9, wED: 1.3, wDC: 6.0, wC31: 1.1,
    // per-field feedback inhibition gains (set sparsity: EC≈15%, DG≈3% (separation), CA3≈7% index)
    gEC: 24.0, gDG: 120.0, gCA3: 150.0, gCA1: 30.0,
    // CA3 inhibition during REPLAY: the recurrent attractor drive is ~4× smaller than the
    // mossy detonator drive, so the ripple-state inhibition is correspondingly lower.
    gCA3rep: 4.0,
    // thresholds / gains
    thr: 0.14, gain: 1.5,
    tauA: 0.020, tauI: 0.006, dt: 0.001,
    // plasticity
    lrBind: 3.0,      // Wc1e, Wec binding rate
    lrRec3: 3.0,      // CA3 symmetric auto-association
    lrAsym: 0.9,      // CA3 directed transition weight (forward, per synapse) in Rseq
    asymBack: 0.35,   // backward transition weight, as a fraction of forward (enables reverse replay)
    seqGain: 1.0,     // gain of the directed transition drive during replay
    wRecMax3: 1.4, wBudget3: 2.0,   // CA3 recurrent cap + subtractive budget
    wBindMax: 1.6, wBudgetBind: 2.2,
    actThr: 0.30,
    ach: 1.0,         // 1 = encode (plastic on), low = retrieve
    // replay: spike-frequency adaptation lets the active index fatigue and hand off to the
    // next via the asymmetric I_k→I_{k+1} links (Hasselmo/Tsodyks sequence read-out). The
    // AHP current builds fast (tauAdaptUp) but recovers slowly (tauAdaptDn) — so a just-
    // visited index stays refractory while the wave passes, instead of ping-ponging back.
    tauAdaptUp: 0.015, tauAdaptDn: 0.280, adaptGain3: 0.6,
  };
}

function randSparse(rnd, nPost, nPre, p, w0) {
  const idx = [], wt = [];
  for (let i = 0; i < nPost; i++) {
    const id = [], w = [];
    for (let j = 0; j < nPre; j++) if (rnd() < p) { id.push(j); w.push(w0 * (0.6 + 0.8 * rnd())); }
    idx.push(Int32Array.from(id)); wt.push(Float64Array.from(w));
  }
  return { idx, wt };
}

function createHPC(opts) {
  const P = Object.assign(hdefaults(), opts || {});
  const rnd = mulberry32(P.seed);
  // structural projections
  const Wce = randSparse(rnd, P.NEC, opts && opts.NC ? opts.NC : 400, P.pCE, P.wCE);
  const Wed = randSparse(rnd, P.NDG, P.NEC, P.pED, P.wED);
  const Wdc = randSparse(rnd, P.NCA3, P.NDG, P.pDC, P.wDC);
  const Wc31 = randSparse(rnd, P.NCA1, P.NCA3, P.pC31, P.wC31);
  // CA3 recurrent (plastic, starts silent). Rca3 = symmetric auto-association (holds/completes
  // an index); Rseq = DIRECTED transition weights (forward≫backward), kept in a SEPARATE matrix
  // so subtractive normalisation of the auto-associator never corrupts the forward:backward ratio.
  const Rca3 = randSparse(rnd, P.NCA3, P.NCA3, P.pRec3, 0);
  for (let i = 0; i < P.NCA3; i++) for (let k = 0; k < Rca3.wt[i].length; k++) Rca3.wt[i][k] = 0;
  const Rseq = randSparse(rnd, P.NCA3, P.NCA3, P.pRec3, 0);
  for (let i = 0; i < P.NCA3; i++) for (let k = 0; k < Rseq.wt[i].length; k++) Rseq.wt[i][k] = 0;
  // plastic back-projections start silent, all-to-all (learned sparsely by Hebb)
  const Wc1e = { idx: [], wt: [] };  // EC ← CA1
  for (let i = 0; i < P.NEC; i++) { Wc1e.idx.push(null); Wc1e.wt.push(new Float64Array(P.NCA1)); }
  const Wec = { idx: [], wt: [] };   // cortex ← EC
  const NC = opts && opts.NC ? opts.NC : 400;
  for (let i = 0; i < NC; i++) { Wec.idx.push(null); Wec.wt.push(new Float64Array(P.NEC)); }

  return {
    P, rnd, NC,
    Wce, Wed, Wdc, Wc31, Rca3, Rseq, Wc1e, Wec,
    ec: new Float64Array(P.NEC), dg: new Float64Array(P.NDG),
    ca3: new Float64Array(P.NCA3), ca1: new Float64Array(P.NCA1),
    adapt3: new Float64Array(P.NCA3),   // CA3 spike-frequency adaptation (replay hand-off)
    iEC: 0, iDG: 0, iCA3: 0, iCA1: 0,   // per-field inhibition
    ecReinstate: new Float64Array(NC),  // EC→cortex drive (reinstatement current)
    indices: [],                        // recorded CA3 index cell-sets, in encode order
    plastic: false,
  };
}

// one settle of a field: x ← relu(gain*(input - thr - g*inh)); inhibition tracks mean
function fieldStep(H, arr, inputFn, g, key) {
  const P = H.P, N = arr.length, dt = P.dt;
  let sum = 0; const nx = new Float64Array(N);
  const inh = H[key];
  for (let i = 0; i < N; i++) {
    const drive = inputFn(i) - P.thr - g * inh;
    nx[i] = drive > 0 ? clamp(P.gain * drive, 0, 1.3) : 0;
  }
  for (let i = 0; i < N; i++) { arr[i] += (dt / P.tauA) * (nx[i] - arr[i]); sum += arr[i]; }
  H[key] += (dt / P.tauI) * (sum / N - H[key]);
}

const dot = (proj, i, src) => { const id = proj.idx[i], w = proj.wt[i]; let s = 0;
  for (let k = 0; k < id.length; k++) s += w[k] * src[id[k]]; return s; };
const dotDense = (proj, i, src) => { const w = proj.wt[i]; let s = 0;
  for (let j = 0; j < w.length; j++) s += w[j] * src[j]; return s; };

// FORWARD pass: cortex activity → EC → DG → CA3 (+ recurrent) → CA1. One dt.
function forwardStep(H, cortexA) {
  const P = H.P;
  fieldStep(H, H.ec,  i => dot(H.Wce, i, cortexA), P.gEC,  "iEC");
  fieldStep(H, H.dg,  i => dot(H.Wed, i, H.ec),    P.gDG,  "iDG");
  const achRec = 1 - 0.85 * P.ach;   // recurrence gated OFF during encode (Hasselmo)
  fieldStep(H, H.ca3, i => dot(H.Wdc, i, H.dg) + achRec * dot(H.Rca3, i, H.ca3), P.gCA3, "iCA3");
  fieldStep(H, H.ca1, i => dot(H.Wc31, i, H.ca3), P.gCA1, "iCA1");
}

// BACKWARD (replay) pass: CA3 index → CA1 → EC (via learned Wc1e) → cortex-reinstatement (via Wec).
function backwardStep(H) {
  const P = H.P;
  fieldStep(H, H.ca1, i => dot(H.Wc31, i, H.ca3), P.gCA1, "iCA1");
  fieldStep(H, H.ec,  i => dotDense(H.Wc1e, i, H.ca1), P.gEC, "iEC");
  for (let i = 0; i < H.NC; i++) H.ecReinstate[i] = dotDense(H.Wec, i, H.ec);
}

// CA3 recurrent walk (replay): recurrence ON (low ACh), asymmetric links advance the index.
function recurStep(H) {
  const P = H.P;
  fieldStep(H, H.ca3, i => dot(H.Rca3, i, H.ca3), P.gCA3, "iCA3");
  backwardStep(H);
}

// REPLAY step: CA3 recurrent dynamics with spike-frequency adaptation, then the
// backward reinstatement pass. Adaptation fatigues the currently-active index so the
// asymmetric I_k→I_{k+1} links move activity forward — a self-advancing sequence walk.
function replayStep(H) {
  const P = H.P, ca3 = H.ca3, N = ca3.length, dt = P.dt;
  const achRec = 1 - 0.85 * P.ach;          // low ACh → recurrence engaged
  let sum = 0; const nx = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const auto = dot(H.Rca3, i, ca3);          // symmetric: holds the current index
    const seq = dot(H.Rseq, i, ca3);           // directed: pushes toward the next index
    const drive = achRec * auto + P.seqGain * seq - P.thr - P.gCA3rep * H.iCA3 - P.adaptGain3 * H.adapt3[i];
    nx[i] = drive > 0 ? clamp(P.gain * drive, 0, 1.3) : 0;
  }
  for (let i = 0; i < N; i++) {
    ca3[i] += (dt / P.tauA) * (nx[i] - ca3[i]); sum += ca3[i];
    // asymmetric kinetics: adapt tracks activity — rises fast (tauUp), recovers slowly (tauDn)
    const tau = ca3[i] > H.adapt3[i] ? P.tauAdaptUp : P.tauAdaptDn;
    H.adapt3[i] += (dt / tau) * (ca3[i] - H.adapt3[i]);
  }
  H.iCA3 += (dt / P.tauI) * (sum / N - H.iCA3);
  backwardStep(H);
}

function activeSet(arr, thr) { const s = []; for (let i = 0; i < arr.length; i++) if (arr[i] > thr) s.push(i); return s; }

// subtractive normalisation of a plastic row to a budget. The excess is shared over the
// NONZERO synapses (the ones actually carrying weight), not the full row length — dividing
// by the full length on a sparse row leaves the budget effectively unenforced. Iterated a
// few times so that synapses driven to zero don't strand residual excess on the survivors.
function normSparse(wt, budget) {
  for (let pass = 0; pass < 6; pass++) {
    let s = 0, nz = 0;
    for (let k = 0; k < wt.length; k++) if (wt[k] > 0) { s += wt[k]; nz++; }
    const ex = s - budget;
    if (ex <= 1e-9 || nz === 0) return;
    const d = ex / nz;
    let clipped = false;
    for (let k = 0; k < wt.length; k++) if (wt[k] > 0) {
      if (wt[k] > d) wt[k] -= d; else { wt[k] = 0; clipped = true; }
    }
    if (!clipped) return;    // no synapse hit the floor → budget met exactly, done
  }
}

module.exports = { createHPC, hdefaults, forwardStep, backwardStep, recurStep, replayStep,
  fieldStep, activeSet, normSparse, mulberry32, dot, dotDense };
