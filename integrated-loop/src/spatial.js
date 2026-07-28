"use strict";
/* =====================================================================
   Body-centred spatial system: posterior parietal ⇄ retrosplenial ⇄ hippocampal,
   rotated by the anterior-thalamic head-direction signal.

   Architecture after Byrne, Becker & Burgess (2007) — the standard model of the
   egocentric/allocentric transform — with the anatomy the loop was missing:

     ATN   anterior thalamic nuclei — head-direction ring (Taube). Also the Papez relay:
           subiculum → mammillary bodies → ATN → retrosplenial/cingulate → parahippocampal.
     PPC   posterior parietal — EGOCENTRIC (body-centred) bearing map, driven by
           somatosensory/proprioceptive body state.
     RSC   retrosplenial — the TRANSFORM itself, a gain-field population indexed by
           (allocentric bearing × head direction). Each unit projects to the egocentric
           bin (allo − HD), so the population performs the rotation. Bidirectional:
           the same units read backwards recover allocentric from egocentric.

   Why this matters beyond navigation: the transform is what binds a world-centred memory
   to a body-centred point of view. Its failure is the computational signature that
   depersonalisation/derealisation theories implicate (Sierra & David; Blanke; Ehrsson) —
   the memory is still there, but no longer rendered from the self's frame. We model the
   TRANSFORM and its failure, not the experience.

   Lesions expressible here:
     ATN  → head direction lost   : Korsakoff/diencephalic amnesia + heading disorientation
     RSC  → transform lost        : topographical disorientation; frames intact but decoupled
     PPC  → egocentric map lost   : body-centred rendering fails, allocentric store intact
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = Math.PI * 2;

function sdefaults() {
  return {
    seed: 31,
    NB: 12,            // bearing bins (30° each) — matches the visual orientation resolution
    nLandmark: 5,      // landmarks composing a scene
    kappa: 2.6,        // von Mises concentration for bearing tuning
    hdKappa: 3.2,      // head-direction tuning sharpness
    rscGain: 1.0,      // gain-field transform strength
    noise: 0.02,
  };
}

/* circular tuning curve over NB bins centred on `ang` (radians).
   Bin i represents angle i·Δ (NOT (i+½)·Δ): the transform maps allocentric bin a and head
   bin h to egocentric bin (a−h), whose angle must equal aΔ − hΔ. Half-bin-centred bins put a
   systematic +Δ/2 offset into every transformed bearing — 15.0° at 30° bins, measured. */
function bump(NB, ang, kappa, amp) {
  const v = new Float64Array(NB);
  for (let i = 0; i < NB; i++) {
    const th = i * TAU / NB;
    v[i] = (amp == null ? 1 : amp) * Math.exp(kappa * (Math.cos(th - ang) - 1));
  }
  return v;
}
const norm = v => { let s = 0; for (const x of v) s += x; if (s > 0) for (let i = 0; i < v.length; i++) v[i] /= s; return v; };

function createSpatial(opts) {
  const P = Object.assign(sdefaults(), opts || {});
  const rnd = mulberry32(P.seed);
  const NB = P.NB;
  // RSC gain-field units: one per (allocentric bearing × head direction) pair.
  // Unit (a,h) fires when a landmark sits at allocentric bearing a AND the head points h,
  // and drives the egocentric bin (a − h) mod NB. This is the rotation, done by anatomy.
  const rscAlive = new Uint8Array(NB * NB).fill(1);
  const rscW = new Float64Array(NB * NB);
  for (let i = 0; i < NB * NB; i++) rscW[i] = 1 + 0.15 * (rnd() - 0.5);   // mild heterogeneity
  return {
    P, rnd, NB, rscAlive, rscW,
    atn: new Float64Array(NB),      // head-direction ring
    allo: new Float64Array(NB),     // allocentric bearing map (hippocampal/BVC side)
    ppc: new Float64Array(NB),      // egocentric bearing map (parietal side)
    rsc: new Float64Array(NB * NB),
    atnAlive: 1, ppcAlive: 1,
    lesions: {},
  };
}

/* ---- head direction from ATN ---- */
function setHeading(S, theta) {
  if (S.atnAlive <= 0) { S.atn.fill(1 / S.NB); return; }   // lesion: no heading, flat ring
  const b = bump(S.NB, theta, S.P.hdKappa);
  S.atn.set(norm(b));
  // partial lesion degrades the bump toward flat
  if (S.atnAlive < 1) {
    for (let i = 0; i < S.NB; i++) S.atn[i] = S.atnAlive * S.atn[i] + (1 - S.atnAlive) / S.NB;
  }
}
const decodeAngle = v => { let x = 0, y = 0;
  for (let i = 0; i < v.length; i++) { const th = i * TAU / v.length; x += v[i] * Math.cos(th); y += v[i] * Math.sin(th); }
  return { ang: (Math.atan2(y, x) + TAU) % TAU, coh: Math.hypot(x, y) / (v.reduce((a, b) => a + b, 0) || 1) };
};

/* ---- a scene: landmarks at allocentric bearings ---- */
function makeScene(S, nLandmark, seed) {
  const rnd = mulberry32(seed == null ? 7 : seed);
  const n = nLandmark == null ? S.P.nLandmark : nLandmark;
  return Array.from({ length: n }, () => ({ bearing: rnd() * TAU, w: 0.6 + 0.8 * rnd() }));
}
function setAllocentric(S, scene) {
  S.allo.fill(0);
  for (const lm of scene) { const b = bump(S.NB, lm.bearing, S.P.kappa, lm.w);
    for (let i = 0; i < S.NB; i++) S.allo[i] += b[i]; }
  for (let i = 0; i < S.NB; i++) S.allo[i] += S.P.noise * (S.rnd() - 0.5);
  return S.allo;
}

/* ---- RSC transform: allocentric × head-direction → egocentric ----
   ego[(a−h) mod NB] += allo[a] · atn[h] · w(a,h), summed over the surviving gain-field units. */
function alloToEgo(S) {
  const NB = S.NB; S.rsc.fill(0); S.ppc.fill(0);
  if (S.ppcAlive <= 0) return S.ppc;
  for (let a = 0; a < NB; a++) for (let h = 0; h < NB; h++) {
    const u = a * NB + h; if (!S.rscAlive[u]) continue;
    const act = S.allo[a] * S.atn[h] * S.rscW[u] * S.P.rscGain;
    S.rsc[u] = act;
    S.ppc[(a - h + NB) % NB] += act;
  }
  if (S.ppcAlive < 1) for (let i = 0; i < NB; i++) S.ppc[i] *= S.ppcAlive;
  return S.ppc;
}
/* ---- and backwards: egocentric × head-direction → allocentric (same units, read in reverse) */
function egoToAllo(S) {
  const NB = S.NB; const out = new Float64Array(NB);
  for (let e = 0; e < NB; e++) for (let h = 0; h < NB; h++) {
    const a = (e + h) % NB, u = a * NB + h;
    if (!S.rscAlive[u]) continue;
    out[a] += S.ppc[e] * S.atn[h] * S.rscW[u] * S.P.rscGain;
  }
  return out;
}

/* ---- lesions ---- */
function lesionRSC(S, frac, seed) {
  const rnd = mulberry32(seed == null ? 555 : seed); let n = 0;
  for (let i = 0; i < S.rscAlive.length; i++) if (rnd() < frac) { S.rscAlive[i] = 0; n++; }
  S.lesions.rsc = n / S.rscAlive.length; return n;
}
function lesionATN(S, frac) { S.atnAlive = Math.max(0, 1 - frac); S.lesions.atn = frac; }
function lesionPPC(S, frac) { S.ppcAlive = Math.max(0, 1 - frac); S.lesions.ppc = frac; }

/* ---- readout: where does the population say the landmark is? ---- */
const readEgo = S => decodeAngle(S.ppc);
const readAllo = S => decodeAngle(S.allo);

/* angular error between two bearings, in degrees */
function angErr(a, b) { let d = Math.abs(a - b) % TAU; if (d > Math.PI) d = TAU - d; return d * 180 / Math.PI; }

module.exports = { createSpatial, sdefaults, setHeading, setAllocentric, makeScene,
  alloToEgo, egoToAllo, lesionRSC, lesionATN, lesionPPC, readEgo, readAllo,
  decodeAngle, angErr, bump, norm, mulberry32, TAU };
