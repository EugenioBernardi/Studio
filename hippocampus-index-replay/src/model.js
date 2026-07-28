"use strict";
/* =====================================================================
   Hippocampal index-and-replay model — headless dynamics core.

   Trisynaptic circuit EC → DG → CA3 → CA2 → CA1 → subiculum, with per-field
   PV and SOM interneurons, hilar mossy cells, and medial-septum / diagonal-band
   theta pacing. Encoding vs retrieval are gated by acetylcholine (Hasselmo);
   sharp-wave ripples in the low-ACh state drive sequential replay of stored
   indices.

   This file is DYNAMICS ONLY — no DOM, no rendering. It is the faithful
   extraction of the reference implementation in app/index.html: the rate step,
   the phase (clock) step, the index store, the LFP, and the theta-band-power
   observable, wrapped in a small deterministic headless API.

   Every dynamics constant (PR, projection probabilities/gains, field sizes) is
   copied verbatim from the reference and MUST NOT be retuned (see ISSUES.md).
   ===================================================================== */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const f = x => clamp(x, 0, 1);
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/* ---- deterministic RNG (seeded; identical to the reference) ---- */
let RNG = 12345;
const rnd = () => { RNG = (RNG * 1103515245 + 12345) & 0x7fffffff; return RNG / 0x7fffffff; };

/* ================= validated parameters (DO NOT retune) ================= */
const PR = { recG: 1.35, asym: 0.38, bgP: 0.5, bgW: 0.36, pvW: 2.0, somW: 1.0, thr: 0.20,
  adapt: 0.30, achK: 0.78, swrBoost: 0.18, swrDisinh: 0.35, bgG: 1.45, septDep: 0.45 };

const CONCEPT_DEF = [
  { n: 'CORRIDOR', h: 200 }, { n: 'BLUE DOOR', h: 225 }, { n: 'COFFEE', h: 30 },
  { n: 'ATRIUM', h: 150 }, { n: 'STAIRWELL', h: 280 }, { n: 'MY DESK', h: 330 },
];

/* ================= module-level state (rebuilt by reset) ================= */
let F, FK, NC3, Wbg, Wpat, MF, PP_DG, PP_CA3, PP_CA1, SC_CA1, CA3_2, CA2_1, CA1_S, S_EC;
let CONCEPTS, indices, seq;
let M, ms, thetaPh, swrOn, swrCount, replayCount, inSWR, replayPtr, replayIgnite;
let lfp, seizure, seizTimer;
let cueConcept, cueUntil, routeIdx, routeUntil;

/* ---- feedforward projection: G = total synaptic weight onto each target ---- */
function proj(nFrom, nTo, p, G) {
  const Mx = Array.from({ length: nTo }, () => Array(nFrom).fill(0));
  for (let i = 0; i < nTo; i++) {
    let sum = 0;
    for (let j = 0; j < nFrom; j++) if (rnd() < p) { Mx[i][j] = 0.6 + rnd() * 0.8; sum += Mx[i][j]; }
    if (sum > 0) for (let j = 0; j < nFrom; j++) Mx[i][j] *= G / sum;
  }
  return Mx;
}
function rebuildMF(p) { MF = proj(F.DG.n, F.CA3.n, p, 5.2); }

/* ================= construction (deterministic given seed) ================= */
function build(seed) {
  RNG = (seed == null ? 12345 : seed) | 0;
  if (RNG <= 0) RNG = 12345;

  F = {
    EC: { n: 14, lab: 'EC II / III' }, DG: { n: 20, lab: 'DG' },
    CA3: { n: 18, lab: 'CA3' }, CA2: { n: 6, lab: 'CA2' },
    CA1: { n: 16, lab: 'CA1' }, SUB: { n: 8, lab: 'SUB' },
  };
  FK = Object.keys(F);
  FK.forEach(k => { const q = F[k];
    q.a = Array(q.n).fill(0); q.ad = Array(q.n).fill(0);
    q.ph = Array.from({ length: q.n }, () => rnd() * TAU);
    q.w = Array.from({ length: q.n }, () => 0.9 + rnd() * 0.22);
    q.PV = 0; q.SOM = 0; q.R = 0; q.MPH = 0; q.frac = 0; q.mean = 0;
  });
  F.DG.MC = 0;

  // CA3 recurrent matrix: diffuse collaterals (epileptogenic substrate) + learned indices
  NC3 = F.CA3.n;
  Wbg = Array.from({ length: NC3 }, () => Array(NC3).fill(0));
  for (let i = 0; i < NC3; i++) {
    let sum = 0;
    for (let j = 0; j < NC3; j++) if (i !== j && rnd() < PR.bgP) { Wbg[i][j] = 0.6 + rnd() * 0.8; sum += Wbg[i][j]; }
    if (sum > 0) for (let j = 0; j < NC3; j++) Wbg[i][j] *= PR.bgG / sum;   // subcritical while inhibited
  }
  Wpat = Array.from({ length: NC3 }, () => Array(NC3).fill(0));

  PP_DG = proj(F.EC.n, F.DG.n, 0.35, 4.6);
  PP_CA3 = proj(F.EC.n, F.CA3.n, 0.18, 1.5);
  PP_CA1 = proj(F.EC.n, F.CA1.n, 0.28, 3.0);
  MF = proj(F.DG.n, F.CA3.n, 0.12, 5.2);
  SC_CA1 = proj(F.CA3.n, F.CA1.n, 0.32, 3.4);
  CA3_2 = proj(F.CA3.n, F.CA2.n, 0.30, 3.0);
  CA2_1 = proj(F.CA2.n, F.CA1.n, 0.35, 2.2);
  CA1_S = proj(F.CA1.n, F.SUB.n, 0.40, 3.4);
  S_EC = proj(F.SUB.n, F.EC.n, 0.35, 1.8);

  CONCEPTS = CONCEPT_DEF.map(d => {
    const c = { n: d.n, h: d.h, a: 0, drive: 0,
      cl: [0, 1, 2].map(k => ({ ph: rnd() * TAU, f: 1 + (k - 1) * 0.13 })), ec: [] };
    while (c.ec.length < 3) { const v = Math.floor(rnd() * F.EC.n); if (!c.ec.includes(v)) c.ec.push(v); }
    return c;
  });

  indices = []; seq = [];
  M = { mode: 'explore', ach: 1, thetaAmp: 1, pv: 1, som: 1, mc: 1, recG: 1, msLesion: false, mf: 0.12 };
  ms = 0; thetaPh = 0; swrOn = -1; swrCount = 0; replayCount = 0; inSWR = false;
  replayPtr = 0; replayIgnite = null;
  lfp = []; seizure = false; seizTimer = 0;
  cueConcept = null; cueUntil = -1; routeIdx = -1; routeUntil = -1;
}

/* ================= index store ================= */
function bindIndex(ci) {
  const used = new Set(indices.flatMap(x => x.cells));
  const score = [];
  for (let i = 0; i < NC3; i++) {
    let mfIn = 0; for (let j = 0; j < F.DG.n; j++) mfIn += MF[i][j] * F.DG.a[j];
    score.push({ i, v: mfIn + rnd() * 0.05 - (used.has(i) ? 2 : 0) });
  }
  score.sort((a, b) => b.v - a.v);
  const cells = score.slice(0, 3).map(o => o.i);
  const existing = indices.find(x => x.concept === ci);
  if (existing) return existing;
  const idx = { id: indices.length + 1, concept: ci, cells, hue: CONCEPTS[ci].h, strength: 1 };
  indices.push(idx);
  for (const i of cells) for (const j of cells) if (i !== j) Wpat[i][j] = PR.recG;   // Hebbian auto-assoc
  if (seq.length) {                                                                    // asymmetric route link
    const prev = indices.find(x => x.id === seq[seq.length - 1]);
    if (prev) for (const i of cells) for (const j of prev.cells) Wpat[i][j] += PR.asym;
  }
  seq.push(idx.id);
  return idx;
}

const achEff = () => M.msLesion ? Math.min(M.ach, 0.25) : M.ach;
const thetaOn = () => !M.msLesion && M.mode !== 'sleep';

function fireSWR() {
  swrOn = ms; swrCount++; inSWR = true;
  if (seq.length) {
    const first = indices.find(x => x.id === seq[replayPtr % seq.length]);
    replayIgnite = first ? first.cells : null;
    replayPtr++; replayCount++;
  } else replayIgnite = null;
}

/* ================= rate dynamics (1 ms step) ================= */
function step() {
  const tt = ms / 1000;
  const sAmp = thetaOn() ? M.thetaAmp : 0;
  thetaPh = (thetaPh + TAU * 8 / 1000) % TAU;
  const sG = sAmp * (0.5 + 0.5 * Math.sin(thetaPh));      // septal GABA → inhibits interneurons
  const ach = achEff();
  const achRec = 1 - PR.achK * ach;

  if (M.mode === 'sleep') {
    if (swrOn < 0 && rnd() < 0.0016) fireSWR();
    if (swrOn >= 0) { inSWR = (ms - swrOn) < 90; if (!inSWR && ms - swrOn > 260) swrOn = -1; }
  } else { inSWR = (swrOn >= 0 && ms - swrOn < 90); if (swrOn >= 0 && ms - swrOn > 260) swrOn = -1; }

  const ecDrive = Array(F.EC.n).fill(0);
  CONCEPTS.forEach((c, i) => {
    let d = 0;
    if (cueConcept === i && ms < cueUntil) d = 0.95;
    if (routeIdx >= 0 && CONCEPTS[routeIdx] === c && ms < routeUntil) d = 0.95;
    c.drive = d;
    if (d > 0) c.ec.forEach(e => ecDrive[e] = Math.max(ecDrive[e], d));
  });
  CONCEPTS.forEach((c, i) => {
    const idx = indices.find(x => x.concept === i);
    let back = 0;
    if (idx) back = mean(idx.cells.map(k => F.CA3.a[k])) * 0.9 * mean(F.SUB.a.map(v => v)) * 2.2;
    c.a += ((Math.max(c.drive, clamp(back, 0, 1))) - c.a) * 0.06;
  });

  const inh = q => (PR.pvW * M.pv * q.PV + PR.somW * M.som * q.SOM) * (inSWR ? (1 - PR.swrDisinh) : 1);
  const nx = {};
  nx.EC = F.EC.a.map((v, i) => {
    let s = ecDrive[i] + 0.30 + (rnd() - 0.5) * 0.05;
    for (let j = 0; j < F.SUB.n; j++) s += S_EC[i][j] * F.SUB.a[j] * 0.5;
    return f(s - inh(F.EC) * 0.5 - PR.thr * 0.6);
  });
  nx.DG = F.DG.a.map((v, i) => {
    let s = 0; for (let j = 0; j < F.EC.n; j++) s += PP_DG[i][j] * F.EC.a[j];
    return f(s - inh(F.DG) - PR.adapt * F.DG.ad[i] - PR.thr * 1.5);
  });
  nx.CA3 = F.CA3.a.map((v, i) => {
    let rec = 0; for (let j = 0; j < NC3; j++) rec += (Wbg[i][j] + Wpat[i][j] * M.recG) * F.CA3.a[j];
    let mf = 0; for (let j = 0; j < F.DG.n; j++) mf += MF[i][j] * F.DG.a[j];
    let pp = 0; for (let j = 0; j < F.EC.n; j++) pp += PP_CA3[i][j] * F.EC.a[j];
    let ig = 0;
    if (inSWR && replayIgnite && replayIgnite.includes(i) && (ms - swrOn) < 25) ig = 0.9;
    return f(rec * achRec + mf + pp + ig + (inSWR ? PR.swrBoost : 0)
      - inh(F.CA3) - PR.adapt * F.CA3.ad[i] - PR.thr + (rnd() - 0.5) * 0.03);
  });
  nx.CA2 = F.CA2.a.map((v, i) => {
    let s = 0; for (let j = 0; j < NC3; j++) s += CA3_2[i][j] * F.CA3.a[j];
    return f(s * achRec + -inh(F.CA2) * 1.4 - PR.thr);
  });
  nx.CA1 = F.CA1.a.map((v, i) => {
    let sc = 0; for (let j = 0; j < NC3; j++) sc += SC_CA1[i][j] * F.CA3.a[j];
    let ta = 0; for (let j = 0; j < F.EC.n; j++) ta += PP_CA1[i][j] * F.EC.a[j];
    let c2 = 0; for (let j = 0; j < F.CA2.n; j++) c2 += CA2_1[i][j] * F.CA2.a[j];
    return f(sc * achRec + ta * 0.8 + c2 + (inSWR ? PR.swrBoost : 0)
      - inh(F.CA1) - PR.adapt * F.CA1.ad[i] - PR.thr);
  });
  nx.SUB = F.SUB.a.map((v, i) => {
    let s = 0; for (let j = 0; j < F.CA1.n; j++) s += CA1_S[i][j] * F.CA1.a[j];
    return f(s - inh(F.SUB) * 0.7 - PR.thr);
  });

  FK.forEach(k => {
    const q = F[k], m = mean(q.a);
    const mcBoost = (k === 'DG') ? (0.9 * M.mc * F.DG.MC) : 0;
    const nPV = f(0.30 + 3.1 * m + mcBoost - PR.septDep * sG);
    const nSOM = f(0.22 + 1.5 * m - PR.septDep * 0.7 * sG);
    q.PV += (nPV - q.PV) / 6; q.SOM += (nSOM - q.SOM) / 15;
  });
  F.DG.MC += (f(1.8 * mean(F.DG.a)) - F.DG.MC) / 20;

  FK.forEach(k => {
    const q = F[k], n2 = nx[k];
    for (let i = 0; i < q.n; i++) { q.a[i] += (n2[i] - q.a[i]) / 12; q.ad[i] += (q.a[i] - q.ad[i]) / 90; }
    q.mean = mean(q.a);
  });

  // LFP: CA1 pyramidal drive minus perisomatic inhibition, plus a ripple carrier.
  // Model-owned observable (was previously computed in the renderer — see ISSUES.md #1).
  const rip = inSWR ? 0.35 * Math.sin(TAU * 180 * tt) : 0;
  lfp.push(F.CA1.mean - 0.35 * F.CA1.PV + rip);
  if (lfp.length > 1400) lfp.shift();
  ms++;
}

/* ================= phase (the clocks) ================= */
function stepPhases(dt) {
  FK.forEach(k => {
    const q = F[k];
    let sx = 0, sy = 0, cnt = 0;
    for (let i = 0; i < q.n; i++) if (q.a[i] > 0.25) { sx += Math.cos(q.ph[i]); sy += Math.sin(q.ph[i]); cnt++; }
    q.R = cnt ? Math.hypot(sx / cnt, sy / cnt) : 0;
    q.MPH = cnt ? Math.atan2(sy / cnt, sx / cnt) : 0;
    q.frac = cnt / q.n;
  });
  const q = F.CA3;
  for (let i = 0; i < q.n; i++) {
    let coup = 0;
    for (let j = 0; j < q.n; j++) {
      if (i === j) continue;
      const w = (Wbg[i][j] + Wpat[i][j] * M.recG) * q.a[j] * q.a[i];
      if (w > 0.01) coup += w * 3.2 * Math.sin(q.ph[j] - q.ph[i]);
    }
    const shear = 5.5 * M.pv * q.PV * q.R * q.frac * Math.sin(q.ph[i] - q.MPH);
    q.ph[i] = (q.ph[i] + (TAU * 2.4 * q.w[i] + coup - shear + (rnd() - 0.5) * 0.5) * dt + TAU) % TAU;
  }
  FK.filter(k => k !== 'CA3').forEach(k => {
    const p = F[k];
    for (let i = 0; i < p.n; i++) {
      const lock = p.a[i] > 0.25 ? 2.6 : 0.2;
      p.ph[i] = (p.ph[i] + (TAU * 2.4 * p.w[i] + lock * Math.sin(p.MPH - p.ph[i])
        - 3.0 * M.pv * p.PV * p.R * p.frac * Math.sin(p.ph[i] - p.MPH) + (rnd() - 0.5) * 0.4) * dt + TAU) % TAU;
    }
  });
  CONCEPTS.forEach(c => {
    const mx = Math.atan2(mean(c.cl.map(q2 => Math.sin(q2.ph))), mean(c.cl.map(q2 => Math.cos(q2.ph))));
    c.cl.forEach(k => { k.ph = (k.ph + (TAU * 2.2 * k.f + (c.a > 0.3 ? 7 : 0) * Math.sin(mx - k.ph)) * dt + TAU) % TAU; });
  });
  const sz = (F.CA3.frac > 0.55 && F.CA3.R > 0.75);
  seizTimer = sz ? Math.min(1, seizTimer + dt * 2) : Math.max(0, seizTimer - dt * 1.2);
  seizure = seizTimer > 0.5;
}

/* ================= theta-band power of the LFP ================= */
// band(5–12 Hz) / total(2–40 Hz) power via a direct DFT of the LFP ring buffer.
// This is the physiological observable the paper's theta figure is computed from.
function thetaPower() {
  const n = Math.min(lfp.length, 1200); if (n < 300) return 0;
  const x = lfp.slice(-n), mu = mean(x), y = x.map(v => v - mu);
  let p = 0, tot = 0;
  for (let hz = 2; hz <= 40; hz++) {
    let c = 0, s = 0;
    for (let i = 0; i < n; i++) { const a = TAU * hz * i / 1000; c += y[i] * Math.cos(a); s += y[i] * Math.sin(a); }
    const pw = (c * c + s * s) / n; tot += pw; if (hz >= 5 && hz <= 12) p += pw;
  }
  return tot > 0 ? p / tot : 0;
}

/* ================= headless API ================= */
// advance real dynamics for `durMs` milliseconds (1 ms rate steps + phase clock).
// Route traversal (binding the six indices in sequence during encoding) is handled
// here exactly as the reference viewer's main loop does it.
function advance(durMs) {
  const n = Math.max(0, Math.round(durMs));
  for (let i = 0; i < n; i++) {
    if (routeIdx >= 0 && ms >= routeUntil) {
      bindIndex(routeIdx);
      routeIdx++;
      if (routeIdx >= CONCEPTS.length) routeIdx = -1; else routeUntil = ms + 520;
    }
    step();
    stepPhases(0.001);
  }
}

function reset(seed) { build(seed); }
function setMode(m) {
  M.mode = m;
  if (m === 'explore') M.ach = 1; else if (m === 'quiet') M.ach = 0.5; else M.ach = 0.15;
}
function cue(ci, durMs) { cueConcept = ci; cueUntil = ms + (durMs == null ? 700 : durMs); }
// encode the whole route: drive each concept for 520 ms, THEN bind its index
// (binding before the concept drives DG would pick cells by noise → overlap).
function route(start) { routeIdx = start == null ? 0 : start; routeUntil = ms + 520; }
function fieldMean(k) { return F[k].mean; }
function fieldActive(k, thr) { const q = F[k]; let c = 0; for (const v of q.a) if (v > (thr == null ? 0.25 : thr)) c++; return c / q.n; }
function lfpValue() { return lfp.length ? lfp[lfp.length - 1] : 0; }
function record() { return { ms, lfp: lfpValue(), thetaPower: thetaPower(), seizure,
  ca3Active: fieldActive('CA3'), ca3R: F.CA3.R, indices: indices.length }; }

build(12345);   // default construction on load

module.exports = {
  reset, setMode, cue, route, advance, step, bindIndex, fieldMean, fieldActive,
  thetaPower, lfp: lfpValue, record, PR,
  // live state accessors (tests set neuromodulators / lesions here)
  get M() { return M; }, get indices() { return indices; }, get seq() { return seq; },
  get seizure() { return seizure; }, get F() { return F; }, rebuildMF,
  setPV: v => { M.pv = v; }, setSOM: v => { M.som = v; }, setRecG: v => { M.recG = v; },
  setACh: v => { M.ach = v; }, setMC: v => { M.mc = v; }, setThetaAmp: v => { M.thetaAmp = v; },
  setLesion: b => { M.msLesion = !!b; }, setMF: p => { M.mf = p; rebuildMF(p); },
};
