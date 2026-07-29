"use strict";
/* =====================================================================
   THE THALAMIC RETICULAR NUCLEUS AS A CONSOLIDATION SCHEDULER.

   THE CLAIM THIS MODULE EXISTS TO TEST. Systems-consolidation models are cortex plus
   hippocampus; the thalamus is almost always absent from them. Yet sleep spindles are
   thalamic, spindle density is the strongest physiological predictor of overnight retention in
   humans (Gais 2002; Schabus 2004), and thalamic lesions produce an amnesia that is clinically
   DIFFERENT from hippocampal amnesia. The proposal here is that the reticular nucleus is not a
   relay in memory but a SCHEDULER, and that this changes what consolidation is:

       spindles are LOCAL, reticular sectors COMPETE, therefore only some cortical columns are
       plastic in any given slow-oscillation up-state — so consolidation is SERIAL and
       CAPACITY-LIMITED, and memories compete for spindle slots.

   WHAT IS ALREADY IN THE PROJECT, and what this changes. `night.js` gates replay on spindle
   power computed from `thalTC`, the mean over EVERY column — a single global spindle. That is
   the standard assumption and it is the one being overturned. Nir et al. (2011) showed human
   spindles and slow waves are frequently LOCAL rather than global; reticular sectors are
   topographically organised and mutually inhibitory (Pinault 2004; Crabtree 2018).

   THE MODEL, kept deliberately minimal. Cortical columns are partitioned into reticular
   sectors. Each sector carries a spindle oscillator whose amplitude is driven by the ongoing
   slow oscillation, sustained by its own recurrence, and suppressed by every other sector. That
   single lateral-inhibition term is the whole mechanism: it makes spindling a competition, and
   the competition is what imposes a capacity limit. Nothing else is added.

   WHAT FALLS OUT, none of it scripted:
     • only a subset of sectors spindles in any up-state, and which subset varies
     • a memory consolidates only while a sector containing its cortical columns is spindling
     • total consolidation per night is capped by slot count, not by cortical storage
     • biasing one sector's drive — a cue — steers the competition, which is what targeted
       memory reactivation would be doing if this account is right
     • removing the reticular gate leaves REPLAY INTACT and consolidation ineffective, which is
       the dissociation between diencephalic and medial-temporal amnesia
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function sgdefaults() {
  return {
    seed: 5,
    nSector: 8,        // reticular sectors; each covers a contiguous block of cortical columns
    fSpindle: 13.0,    // Hz — within the 10–16 Hz spindle band
    fSO: 0.9,          // Hz — the slow oscillation that paces up-states
    dt: 0.002,         // s
    // sector dynamics
    drive: 1.0,        // how strongly the SO up-state drives a sector toward spindling
    selfGain: 1.35,    // sector recurrence — sustains a spindle once it starts
    lateral: 0.90,     // MUTUAL INHIBITION between sectors. This is the whole mechanism: set it
                       // to 0 and spindles become global and simultaneous, which is the standard
                       // assumption this module exists to test against.
    tau: 0.035,        // s — sector envelope time constant
    thr: 0.30,         // spindle detection threshold on the envelope
    noise: 0.06,       // symmetry-breaking; without it identical sectors never differentiate
    refractory: 0.45,  // s — a sector that has just spindled is briefly less excitable
    refracDepth: 0.55,
    // HOW A CUE ACTS, and the two options make OPPOSITE empirical predictions about targeted
    // memory reactivation, so the choice is a hypothesis rather than an implementation detail.
    //   "drive"       — the cue adds excitatory drive to its sector. Total spindling RISES, so
    //                   cueing ADDS capacity and uncued memories are not harmed.
    //   "competitive" — the cue biases who WINS without adding drive: the cued sector is less
    //                   suppressed by its rivals and suppresses them more. Total spindling is
    //                   conserved, so cueing MOVES capacity and uncued memories lose.
    // The human literature can adjudicate: whether TMR benefits for cued items come at a cost to
    // uncued items in the same night is exactly the discriminating measurement.
    biasMode: "drive",
  };
}

/* columns are assigned to sectors in contiguous blocks, because reticular topography is
   preserved: neighbouring cortical columns project to neighbouring reticular territory */
function createGate(NCOL, opts) {
  const P = Object.assign(sgdefaults(), opts || {});
  const rnd = mulberry32(P.seed);
  const sectorOf = new Int32Array(NCOL);
  const per = NCOL / P.nSector;
  for (let c = 0; c < NCOL; c++) sectorOf[c] = Math.min(P.nSector - 1, Math.floor(c / per));
  return {
    P, rnd, NCOL, sectorOf,
    env: new Float64Array(P.nSector),      // spindle envelope per sector
    phase: Float64Array.from({ length: P.nSector }, () => rnd() * 2 * Math.PI),
    refrac: new Float64Array(P.nSector),
    bias: new Float64Array(P.nSector),     // external bias — the cueing / TMR input
    lesioned: new Uint8Array(P.nSector),   // per-sector reticular lesion
    t: 0,
    spindleTime: new Float64Array(P.nSector),
    events: 0,
  };
}

/* one step. `so` is the slow-oscillation drive in [0,1]; up-states are its peaks. */
function stepGate(G, so) {
  const P = G.P, n = P.nSector, dt = P.dt;
  let tot = 0;
  for (let s = 0; s < n; s++) tot += G.env[s];
  const nx = new Float64Array(n);
  for (let s = 0; s < n; s++) {
    if (G.lesioned[s]) { nx[s] = 0; continue; }
    const others = tot - G.env[s];
    const comp = P.biasMode === "competitive";
    // competitive cueing rescales the INHIBITION a sector receives, leaving its own drive alone,
    // so the total drive entering the network is unchanged and only the winner is steered
    const lat = comp ? P.lateral / (1 + G.bias[s]) : P.lateral;
    const drive = P.drive * so * (comp ? 1 : 1 + G.bias[s])
                + P.selfGain * G.env[s]
                - lat * others
                - P.refracDepth * G.refrac[s]
                + P.noise * (G.rnd() * 2 - 1);
    nx[s] = drive > 0 ? Math.min(1.4, drive) : 0;
  }
  const kA = dt / P.tau, kR = dt / P.refractory;
  for (let s = 0; s < n; s++) {
    G.env[s] += kA * (nx[s] - G.env[s]);
    G.phase[s] += 2 * Math.PI * P.fSpindle * dt;
    const on = G.env[s] >= P.thr ? 1 : 0;
    G.refrac[s] += kR * (on - G.refrac[s]);
    if (on) G.spindleTime[s] += dt;
  }
  G.t += dt;
}

/* which sectors are spindling right now */
function spindling(G) {
  const out = [];
  for (let s = 0; s < G.P.nSector; s++) if (!G.lesioned[s] && G.env[s] >= G.P.thr) out.push(s);
  return out;
}
/* is a memory licensed to consolidate? — true when a sector holding any of its cortical
   columns is currently spindling. This is the whole gate. */
function licensed(G, columns) {
  for (const c of columns) {
    const s = G.sectorOf[c];
    if (!G.lesioned[s] && G.env[s] >= G.P.thr) return true;
  }
  return false;
}
function sectorsFor(G, columns) {
  const set = new Set();
  for (const c of columns) set.add(G.sectorOf[c]);
  return [...set];
}
function lesionSector(G, s) { G.lesioned[s] = 1; G.env[s] = 0; }
function lesionAll(G) { for (let s = 0; s < G.P.nSector; s++) lesionSector(G, s); }
function setBias(G, s, v) { G.bias[s] = v; }
function clearBias(G) { G.bias.fill(0); }

/* the slow oscillation, as a rectified sinusoid: up-states are the positive lobes */
function soDrive(G, t) {
  const v = Math.sin(2 * Math.PI * G.P.fSO * t);
  return v > 0 ? v : 0;
}

/* run `seconds` of NREM and report, per sector, how long it spent spindling and how the
   sectors' spindling relates in time */
function runNREM(G, seconds, onStep) {
  const steps = Math.round(seconds / G.P.dt);
  const trace = [], up = [];
  for (let i = 0; i < steps; i++) {
    const so = soDrive(G, G.t);
    stepGate(G, so);
    const act = spindling(G);
    trace.push(act); up.push(so > 0.5);
    if (onStep) onStep(G, act, so);
  }
  trace.up = up;
  return trace;
}

/* Co-occupancy: how often do two sectors spindle at the SAME time, against how often each does
   at all? Below 1 means they exclude one another — the signature of competition.
 *
 * CONDITIONED ON THE UP-STATE, and that is not a detail. Every sector is driven by the SAME
 * slow oscillation, so all of them are likelier to be spindling during an up-state and likelier
 * to be silent between up-states. Measured over the whole record that shared drive inflates
 * co-occurrence above chance even when the sectors are competing hard — the first version of
 * this function reported a ratio of 1.82 for a configuration that was plainly excluding, which
 * is the shared-drive confound and not competition. Restricting to up-state samples removes it.
 * Pass `upMask` (one boolean per trace sample) to condition; without it the whole record is used
 * and the ratio should not be read as evidence about competition. */
function coOccupancy(trace, nSector, upMask) {
  const alone = new Float64Array(nSector);
  const both = [];
  for (let a = 0; a < nSector; a++) both.push(new Float64Array(nSector));
  let T = 0;
  for (let i = 0; i < trace.length; i++) {
    if (upMask && !upMask[i]) continue;
    T++;
    const act = trace[i];
    for (const s of act) alone[s]++;
    for (const s of act) for (const q of act) if (s !== q) both[s][q]++;
  }
  T = T || 1;
  let obs = 0, exp = 0, n = 0;
  for (let a = 0; a < nSector; a++) for (let b = a + 1; b < nSector; b++) {
    obs += both[a][b] / T;
    exp += (alone[a] / T) * (alone[b] / T);
    n++;
  }
  return { observed: obs / n, expected: exp / n, ratio: exp > 0 ? (obs / n) / (exp / n) : 1,
           occupancy: Array.from(alone, x => x / T), nSamples: T };
}

module.exports = { sgdefaults, createGate, stepGate, spindling, licensed, sectorsFor,
  lesionSector, lesionAll, setBias, clearBias, soDrive, runNREM, coOccupancy, mulberry32 };
