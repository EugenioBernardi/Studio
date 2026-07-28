"use strict";
/* =====================================================================
   Thalamocortical sheet — FAITHFUL headless extraction of the validated model in
   apps/thalamocortical-3d.html (19 columns, 9 cell classes per column: E23, E4, E5,
   PV, SOM, VIP, NGF + TC, RTN per thalamic sector; 171 populations, ~1359 connections).

   Second-order PSP kernels (Jansen-Rit / Suffczynski class), dt = 0.5 ms. T-type Ca²⁺
   with de-inactivation h, I_h with Ca-dependent activation shift, burst-gated GABA-B
   cascade, spike-frequency adaptation (ACh-gated), synaptic depression/facilitation,
   NMDA voltage dependence. LFP = synaptic currents onto pyramidal dendrites.

   This is the model verbatim (renderer removed); `test/stage5_thalamocortical.js` re-verifies
   it reproduces the documented numbers (wake gamma; NREM slow oscillation/delta; the isolated
   TC–RTN spindle↔spike-wave GABA-B switch). It is the NREM state generator for the loop.
   ===================================================================== */

const DT = 0.5;

// ---- synapse kinds: PSP amplitude A (mV) and rate constant k (1/ms) ----
const SYN = {
  a: { A: 3.4, k: 1 / 10 },    // AMPA
  n: { A: 1.6, k: 1 / 80 },    // NMDA (slow, voltage-gated below)
  g: { A: -20.0, k: 1 / 6 },   // GABA-A perisomatic (PV) — fast, gamma
  G: { A: -20.0, k: 1 / 10 },  // GABA-A on TC (slower decay; sets spindle rate)
  d: { A: -11.0, k: 1 / 20 },  // GABA-A dendritic (SOM)
  b: { A: -11.0, k: 1 / 160 }, // GABA-B (NGF / RTN) — slow
};
const TYPES = ["E23", "E4", "E5", "PV", "SOM", "VIP", "NGF", "TC", "RTN"];
const SIG = {
  E23: { v0: 6.0, k: 1.9, rmax: 1 }, E4: { v0: 6.0, k: 1.9, rmax: 1 }, E5: { v0: 5.4, k: 2.0, rmax: 1 },
  PV: { v0: 4.6, k: 1.5, rmax: 1.5 }, SOM: { v0: 6.6, k: 2.2, rmax: 1.1 }, VIP: { v0: 6.4, k: 2.2, rmax: 1.1 },
  NGF: { v0: 6.1, k: 2.2, rmax: 1.0 }, TC: { v0: 5.6, k: 1.7, rmax: 1.2 }, RTN: { v0: 5.2, k: 1.7, rmax: 1.3 },
};
const ADAPT = { E23: { g: 14, t: 400 }, E4: { g: 8, t: 400 }, E5: { g: 16, t: 450 }, TC: { g: 1.8, t: 320 } };
const ACHF = M => M.achAdapt + (1 - M.achAdapt) / (1 + Math.exp((M.arousal - M.achMid) / 0.09));
const AD = (T, M) => ({ g: ADAPT[T].g * ACHF(M) * M.adapt, t: ADAPT[T].t * M.adTau });

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- hex geometry ----
const hlen = c => (Math.abs(c.q) + Math.abs(c.q + c.r) + Math.abs(c.r)) / 2;
function hexCoords(n) {
  const o = [];
  for (let q = -n; q <= n; q++) for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) o.push({ q, r });
  o.sort((a, b) => { const da = hlen(a), db = hlen(b); if (da !== db) return da - db;
    return Math.atan2(a.r + a.q / 2, a.q) - Math.atan2(b.r + b.q / 2, b.q); });
  return o;
}

// module-level network (one sheet per process — the loop uses a single thalamocortical network)
let RINGS = 2, NCOL = 19, HEX = [], CELLS = [], IDX = {}, NN = 0;
const hdist = (a, b) => hlen({ q: HEX[a].q - HEX[b].q, r: HEX[a].r - HEX[b].r });
function initNet(rings) {
  RINGS = rings; HEX = hexCoords(rings); NCOL = HEX.length; CELLS = [];
  for (let c = 0; c < NCOL; c++) for (const k of TYPES) CELLS.push({ id: `${k}_${c}`, type: k, col: c });
  IDX = {}; CELLS.forEach((c, i) => IDX[c.id] = i); NN = CELLS.length;
  return { CELLS, IDX, NN, NCOL, HEX };
}
initNet(2);

const ADJ = (a, b) => a !== b && hdist(a, b) === 1;
const FAR = (a, b) => a !== b && hdist(a, b) === 2;
const NADJ = c => { let n = 0; for (let k = 0; k < NCOL; k++) if (ADJ(c, k)) n++; return n; };
const NALL = c => { let n = 0; for (let k = 0; k < NCOL; k++) if (ADJ(c, k) || FAR(c, k)) n++; return n; };
const fk = (M, c) => (M.focus === c ? M.fKcc : 0) + M.egabaShift;
const fp = (M, c) => M.pv * (M.focus === c ? M.fPv : 1);
const fr = (M, c) => M.rec23 * (M.focus === c ? M.fRec : 1);

function buildConn(M) {
  const W = [], add = (t, s, w, d, k, stp) => W.push({ t: IDX[t], s: IDX[s], w, d: Math.round(d / DT), k, stp: stp || 0 });
  for (let c = 0; c < NCOL; c++) {
    const E23 = `E23_${c}`, E4 = `E4_${c}`, E5 = `E5_${c}`, PV = `PV_${c}`, SOM = `SOM_${c}`,
          VIP = `VIP_${c}`, NGF = `NGF_${c}`, TC = `TC_${c}`, RTN = `RTN_${c}`;
    add(E4, TC, M.thal_cx * 2.60, 3, "a"); add(PV, TC, M.thal_cx * 1.90, 3, "a");
    add(E23, E4, 2.20, 1, "a"); add(E5, E23, 1.90, 1, "a"); add(E23, E5, 0.95, 1, "a");
    add(E23, E23, fr(M, c), 1, "a"); add(E23, E23, fr(M, c) * 1.2, 1, "n");
    add(E5, E5, M.rec5, 1, "a"); add(E5, E5, M.rec5 * 1.2, 1, "n");
    add(E4, E4, 0.55, 1, "a");
    add(PV, E23, M.pvE, 1, "a"); add(PV, E4, M.pvE * 0.66, 1, "a"); add(PV, E5, M.pvE * 0.86, 1, "a");
    add(E23, PV, fp(M, c) * 1.55, 1, "g"); add(E4, PV, fp(M, c) * 1.05, 1, "g"); add(E5, PV, fp(M, c) * 1.45, 1, "g");
    add(PV, PV, fp(M, c) * 0.70, 1, "g");
    add(SOM, E23, M.wSom, 1.5, "a", 1); add(SOM, E5, M.wSom * 1.15, 1.5, "a", 1);
    add(E23, SOM, M.som * 1.15, 2, "d"); add(E5, SOM, M.som * 1.35, 2, "d");
    add(VIP, E23, 0.85, 1.5, "a"); add(SOM, VIP, M.vip * 1.30, 2, "d");
    add(NGF, E23, 1.05, 2, "a"); add(NGF, E5, 0.95, 2, "a"); add(NGF, TC, M.wNgfTC, 4, "a");
    add(E23, NGF, M.ngf * 0.85, 3, "b"); add(E5, NGF, M.ngf * 0.80, 3, "b");
    add(RTN, E5, M.cx_rtn * 2.70, 6, "a"); add(TC, E5, M.cx_tc * 1.25, 6, "a");
    add(RTN, TC, M.tc_rtn * M.wTR, 4, "a");
    add(TC, RTN, M.rtn_tc * M.wRT, 4, "G");
    add(TC, RTN, 1.0, 4, "b");            // GABA-B: spindle -> spike-wave switch
    add(RTN, RTN, M.rtn_rtn * 1.05, 2, "g");
  }
  for (let t = 0; t < NCOL; t++) {
    const na = NADJ(t) || 1, nl = NALL(t) || 1;
    for (let s2 = 0; s2 < NCOL; s2++) {
      if (ADJ(t, s2)) {
        add(`E23_${t}`, `E23_${s2}`, M.lat / na, 3, "a");
        add(`E5_${t}`, `E5_${s2}`, M.lat * 0.55 / na, 3, "a");
        add(`RTN_${t}`, `RTN_${s2}`, M.rtn_rtn * M.latRTN / na, 3, "g");
        add(`TC_${t}`, `RTN_${s2}`, M.rtn_tc * M.latRTN * 0.8 / na, 4, "G");
      }
      if (ADJ(t, s2) || FAR(t, s2)) {
        add(`PV_${t}`, `E23_${s2}`, M.latSur / nl, 3, "a");
        add(`SOM_${t}`, `E23_${s2}`, M.latSur * 0.45 / nl, 4, "a", 1);
      }
    }
  }
  return W;
}

function defaults() { return {
  arousal: 1, rec23: 9.0, rec5: 5.0, lat: 0.55, latSur: 0.40, latRTN: 0.15, focus: -1, fKcc: 0, fPv: 1, fRec: 1,
  pv: 1, som: 0.35, vip: 1, ngf: 0.7,
  thal_cx: 1, cx_rtn: 0.2, cx_tc: 0.3, tc_rtn: 1, rtn_tc: 1, rtn_rtn: 1,
  gabab: 0, gbTh: 0.28, gT: 1, gH: 1, adTau: 1, adaptSleep: 0, wRT: 3.0, wTR: 3.5, egabaShift: 0, depression: 4, adapt: 1.4,
  noise: 0.55, drive: 1, facMax: 3.2, wSom: 1.20, wNgfTC: 1.20, dVIP: 3.0, tcAr: 0.25, tcPol: 2.0, cxPol: 0.0,
  pvE: 0.85, dE: 5.2, eAr: 0.94, achAdapt: 0.0, achMid: 0.45, dTC: 12.0, dPV: 1.2, dRTN: 0.5,
}; }

function makeState(seed = 7) {
  const rnd = mulberry32(seed);
  const HL = Math.ceil(24 / DT) + 2;
  const S = { y: {}, z: {}, v: new Float64Array(NN), r: new Float64Array(NN),
    h: new Float64Array(NN), mh: new Float64Array(NN), ca: new Float64Array(NN),
    ad: new Float64Array(NN), dep: new Float64Array(NN),
    gbR: new Float64Array(NN), gbS: new Float64Array(NN), fac: new Float64Array(NN),
    hist: [], hp: 0, rnd, t: 0, lfpCol: new Float64Array(NCOL) };
  for (const k in SYN) { S.y[k] = new Float64Array(NN); S.z[k] = new Float64Array(NN); }
  for (let i = 0; i < NN; i++) { S.h[i] = 0.3; S.mh[i] = 0.1; S.ca[i] = 0.05; S.dep[i] = 1; S.fac[i] = 1; S.v[i] = (rnd() - 0.5) * 2; }
  for (let k = 0; k < HL; k++) S.hist.push(new Float64Array(NN));
  return S;
}
const sg = (v, T) => { const s = SIG[T]; return s.rmax / (1 + Math.exp((s.v0 - v) / s.k)); };

function step(S, M, W, inj) {
  const HL = S.hist.length;
  const d = { a: new Float64Array(NN), n: new Float64Array(NN), g: new Float64Array(NN),
              G: new Float64Array(NN), dd: new Float64Array(NN), b: new Float64Array(NN) };
  for (let q = 0; q < W.length; q++) {
    const w = W[q];
    const hp = (S.hp - w.d + HL * 2) % HL;
    const pre = S.hist[hp][w.s] * (w.stp === 1 ? S.fac[w.s] : S.dep[w.s]);
    if (w.k === "a") d.a[w.t] += w.w * pre; else if (w.k === "n") d.n[w.t] += w.w * pre;
    else if (w.k === "g") d.g[w.t] += w.w * pre; else if (w.k === "G") d.G[w.t] += w.w * pre;
    else if (w.k === "d") d.dd[w.t] += w.w * pre; else d.b[w.t] += w.w * pre;
  }
  const sleep = 1 - M.arousal;
  let lfpE = 0, lfpI = 0;
  const cE = new Float64Array(NCOL), cI = new Float64Array(NCOL);
  for (let i = 0; i < NN; i++) {
    const T = CELLS[i].type;
    let ext = 0;
    if (T[0] === "E") ext = M.drive * M.dE * (M.eAr + (1 - M.eAr) * M.arousal);
    else if (T === "TC") ext = M.drive * M.dTC * (1 - M.tcAr * (1 - M.arousal));
    else if (T === "PV") ext = M.drive * M.dPV;
    else if (T === "RTN") ext = M.drive * M.dRTN;
    else if (T === "VIP") ext = M.drive * M.dVIP * (0.20 + 0.80 * M.arousal);
    if (inj && inj[CELLS[i].id]) ext += inj[CELLS[i].id];
    ext += (S.rnd() - 0.5) * M.noise;
    if (T === "TC") ext -= M.tcPol * sleep;
    if (T === "RTN") ext -= 1.0 * sleep;
    if (T[0] === "E") ext -= M.cxPol * sleep;
    for (const k in SYN) {
      const src = (k === "a") ? d.a[i] : (k === "n") ? d.n[i] : (k === "g") ? d.g[i] : (k === "G") ? d.G[i] : (k === "d") ? d.dd[i] : d.b[i];
      let A = SYN[k].A; const kk = SYN[k].k;
      if (k === "g" || k === "d" || k === "G") A *= (1 - Math.min(0.95, fk(M, CELLS[i].col)));
      if (k === "b") {
        const bd = Math.max(0, src - M.gbTh), rel = bd * bd * 24;
        S.gbR[i] += DT * (0.010 * rel * (1 - S.gbR[i]) - 0.0045 * S.gbR[i]);
        S.gbS[i] += DT * (0.0060 * S.gbR[i] - 0.0020 * S.gbS[i]);
        const s4 = Math.pow(S.gbS[i] * 3.2, 4);
        S.y[k][i] = -(CELLS[i].type === "TC" ? 14 : 9) * M.gabab * (s4 / (s4 + 1));
        continue;
      }
      S.z[k][i] += DT * (A * kk * kk * src - 2 * kk * S.z[k][i] - kk * kk * S.y[k][i]);
      S.y[k][i] += DT * S.z[k][i];
    }
    let v = S.y.a[i] + S.y.g[i] + S.y.G[i] + S.y.d[i] + S.y.b[i] + ext;
    v += S.y.n[i] / (1 + Math.exp(-(v - 2) / 4));
    if (ADAPT[T]) { const AA = AD(T, M); S.ad[i] += DT * (S.r[i] - S.ad[i]) / AA.t; v -= AA.g * S.ad[i]; }
    if (T === "TC" || T === "RTN") {
      const hInf = 1 / (1 + Math.exp((v + 1.5) / 1.6));
      const tauH = 1.6 * ((T === "TC" ? 26 : 18) + (T === "TC" ? 230 : 160) / (1 + Math.exp((v + 1.5) / 2.4)));
      S.h[i] += DT * (hInf - S.h[i]) / tauH;
      const mInf = 1 / (1 + Math.exp(-(v + 3.2) / 1.5));
      const gT = (T === "TC" ? 9.5 : 8.0) * M.gT;
      const burst = gT * mInf * S.h[i];
      v += burst;
      if (T === "TC") {
        S.ca[i] += DT * (-(S.ca[i] - 0.05) / 260 + burst * 0.0016);
        const shift = 5.5 * S.ca[i] / (S.ca[i] + 0.30);
        const mhInf = 1 / (1 + Math.exp((v + 2.0 - shift) / 1.8));
        S.mh[i] += DT * (mhInf - S.mh[i]) / (320 + 900 / (1 + Math.exp((v + 2) / 2.5)));
        v += 4.2 * 0.4 * M.gH * S.mh[i];
      }
    }
    S.v[i] = v; S.r[i] = sg(v, T);
    if (T[0] === "E" && M.depression > 0) {
      S.dep[i] += DT * ((1 - S.dep[i]) / 420 - S.r[i] * S.dep[i] * 0.0022 * M.depression);
      S.fac[i] += DT * (-(S.fac[i] - 1) / 450 + S.r[i] * (M.facMax - S.fac[i]) * 0.006);
    } else { S.dep[i] = 1; S.fac[i] = 1; }
    if (T === "E23" || T === "E5") {
      const we = (T === "E23") ? 1 : 0.8;
      const eC = we * (S.y.a[i] + S.y.n[i]), iC = we * (S.y.g[i] + S.y.G[i] + S.y.d[i] + S.y.b[i]);
      lfpE += eC; lfpI += iC; cE[CELLS[i].col] += eC; cI[CELLS[i].col] += iC;
    }
  }
  const nhp = (S.hp + 1) % HL;
  for (let i = 0; i < NN; i++) S.hist[nhp][i] = S.r[i];
  S.hp = nhp; S.t += DT;
  for (let c = 0; c < NCOL; c++) S.lfpCol[c] = -(cE[c] + 0.9 * cI[c]);
  return -(lfpE + 0.9 * lfpI);   // sink convention
}

// ---- convenience wrapper: one network instance ----
function create(opts) {
  initNet(2);
  const M = Object.assign(defaults(), opts || {});
  const S = makeState(opts && opts.seed != null ? opts.seed : 7);
  const W = buildConn(M);
  return { M, S, W, rate: id => S.r[IDX[id]], IDX, CELLS, NCOL };
}
function stepNet(net, inj) { return step(net.S, net.M, net.W, inj); }
function rebuild(net) { net.W = buildConn(net.M); }

module.exports = { DT, TYPES, SIG, defaults, initNet, buildConn, makeState, step, sg,
  create, stepNet, rebuild, mulberry32,
  get CELLS() { return CELLS; }, get IDX() { return IDX; }, get NN() { return NN; }, get NCOL() { return NCOL; } };
