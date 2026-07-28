"use strict";
/* =====================================================================
   Visual syndromes of the occipital, occipitotemporal and occipitoparietal lobes.

   Stage 12 handled the FIELD defects — where the lesion sits along the retina-to-V1
   pathway, read out by perimetry. Everything here is downstream of that: the lesion is at or
   beyond striate cortex, the field may be full, and what fails is a particular kind of seeing.

   Four routes, and every syndrome below is one of them failing while the others hold:

     GENICULOSTRIATE   retina → LGN → V1 → (ventral) V2 → shape readout
     TECTOPULVINAR     retina → superior colliculus → pulvinar → MT.  Coarse, motion-only,
                       and it does NOT pass through V1 — which is the whole reason
                       blindsight exists.
     DORSAL            V1 → MT/V5 → parietal.  Motion and location.
     PARIETAL          the attentional competition of parietal.js

   SYNDROMES REACHABLE HERE, and the lesion each one is:

     cortical blindness   V1 bilateral, tectopulvinar also gone
     BLINDSIGHT/Riddoch   V1 gone, tectopulvinar intact → motion direction survives with no
                          form at all. The statokinetic dissociation, and it is a
                          DISSOCIATION, not a weak version of sight.
     akinetopsia          MT gone, V1 intact → the mirror image: form survives, motion does not
     apperceptive agnosia V2 gone → the percept never forms; orientation energy is still there
     associative agnosia  readout gone → the percept forms intact and cannot be named
     optic ataxia         parietal gone → identify it, cannot localise it
     simultanagnosia      parietal bilateral → one object at a time, wherever it is

   The two agnosias are the pair worth care. Apperceptive and associative are not severities of
   one thing; they are different stages, and the test that separates them is whether the
   PERCEPT is intact when identification fails. So both are measured here: the V2 feature
   vector (the percept) and the label (the identification), separately.
   ===================================================================== */

const V = require("./vision.js");
const PAR = require("./parietal.js");

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* A lesion is CELL LOSS — a random subset of units silenced — not a uniform gain reduction.
   The distinction is not cosmetic: `classify` compares drives against each other, so scaling
   every feature by the same factor is an order-preserving map and CANNOT change the decision.
   Measured before this was fixed: a 95% "lesion" of V2 still classified 3/3 correctly, and a
   95% readout lesion likewise, because both were monotone transforms of the intact vector.
   Dropout removes information; scaling only removes contrast. */
function dropInPlace(arr, frac, rnd) {
  if (frac <= 0) return arr;
  for (let i = 0; i < arr.length; i++) if (rnd() < frac) arr[i] = 0;
  return arr;
}

function sdefaults() {
  return {
    tectoGain: 0.55,   // the tectopulvinar route is weaker than the geniculostriate one
    tectoBlur: 1.6,    // …and coarse: it carries low spatial frequencies only
    seed: 404,
  };
}
/* a lesion spec; every field is a fraction of that structure destroyed */
function noLesion() {
  return { v1: 0, v2: 0, readout: 0, mt: 0, sc: 0, pulvinar: 0, parietalL: 0, parietalR: 0 };
}
const les = o => Object.assign(noLesion(), o || {});

/* ---------------------------------------------------------------------
   VENTRAL: form. Each lesion removes UNITS (see dropInPlace above): v1 takes complex cells,
   v2 takes angle/curvature units, readout corrupts the feature→label mapping while leaving
   the features themselves untouched — an intact percept that cannot be named.
   --------------------------------------------------------------------- */
function formPath(kind, opt, L, P) {
  P = Object.assign(sdefaults(), P || {});
  L = les(L);
  const img = V.drawShape(kind, opt || {});
  const R = V.retina(img), lg = V.lgn(R), S = V.v1simple(lg);
  const C = V.v1complex(S, { pw: 2 });
  // V1 lesion: complex cells are LOST, not dimmed
  const rnd = mulberry32(P.seed);
  const Cl = C.map(m => dropInPlace(Float64Array.from(m), L.v1, rnd));
  const V2raw = V.v2(Cl);
  // V2 lesion: angle/curvature units are lost while orientation energy upstream is intact —
  // this is the apperceptive stage, and the percept itself is what degrades
  const V2 = {};
  for (const k of Object.keys(V2raw)) V2[k] = dropInPlace(Float64Array.from(V2raw[k]), L.v2, rnd);
  const feat = V.features(V2), st = V.oriStats(Cl);
  const ff = Object.assign({}, feat, { entropy: st.entropy, peaks: st.peaks });

  // The identification stage. An associative lesion corrupts the FEATURE→LABEL MAPPING, and
  // the corruption is FIXED (drawn once from a fixed seed), because associative agnosia
  // misnames the same object the same way — it is a damaged mapping, not moment-to-moment
  // noise. The features arriving are untouched, which is the whole diagnostic point.
  const d = V.drives(ff);
  const keys = Object.keys(d);
  const mag = keys.reduce((s, k) => s + Math.abs(d[k]), 0) / keys.length || 1;
  const rr = mulberry32(P.seed + 7717);
  const bias = keys.map(() => (rr() - 0.5) * 2 * mag);
  const dl = {}; keys.forEach((k, i) => { dl[k] = (1 - L.readout) * d[k] + L.readout * bias[i]; });
  let best = null, bv = -Infinity, second = -Infinity;
  for (const k of keys) { if (dl[k] > bv) { second = bv; bv = dl[k]; best = k; } else if (dl[k] > second) second = dl[k]; }

  // "percept intact?" — how much orientation/angle structure survives, independent of the label
  const energy = arr => { let s = 0; for (const x of arr) s += x; return s; };
  const perceptEnergy = energy(V2.D60) + energy(V2.D90) + energy(V2.CURV) + energy(V2.EDGE);
  const oriEnergy = Cl.reduce((s, m) => s + energy(m), 0);

  return { label: V.DEC[keys.indexOf(best)] || best, drives: dl, margin: bv - second,
           features: ff, perceptEnergy, oriEnergy, V2 };
}

/* ---------------------------------------------------------------------
   DORSAL: motion, by TWO routes that sum at MT.
     · geniculostriate, full spatial detail, scaled by V1 integrity
     · tectopulvinar, blurred and weaker, scaled by SC and pulvinar integrity, NOT by V1
   Blindsight is what the second route alone can still do.
   --------------------------------------------------------------------- */
/* a small separable box blur over an n×n frame — written here rather than reused from
   vision.js because that one assumes the full retinal size, and these frames are downsampled */
function blurFrame(fr, n, r) {
  const t = new Float64Array(n * n), o = new Float64Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let s = 0, c = 0;
    for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= n) continue; s += fr[y * n + xx]; c++; }
    t[y * n + x] = s / c;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let s = 0, c = 0;
    for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= n) continue; s += t[yy * n + x]; c++; }
    o[y * n + x] = s / c;
  }
  return o;
}

function motionPath(kind, opt, mot, L, P) {
  P = Object.assign(sdefaults(), P || {});
  L = les(L);
  const frames = V.motionSequence(kind, opt || {}, mot);
  const n = V.NM;
  const kGen = 1 - L.v1;                                    // geniculostriate survives V1
  const kTec = P.tectoGain * (1 - L.sc) * (1 - L.pulvinar); // tectopulvinar does not use V1
  const blurred = frames.map(fr => blurFrame(fr, n, Math.round(P.tectoBlur)));

  const Egen = V.motionEnergy(frames).E;
  const Etec = V.motionEnergy(blurred).E;
  const kMT = 1 - L.mt;
  const E = Egen.map((row, o) => row.map((v, k) => kMT * (kGen * v + kTec * Etec[o][k])));
  const M = V.mt(E);
  return { M, dir: M.dir, coherence: M.coherence, total: M.total,
           geniculostriate: kGen, tectopulvinar: kTec };
}

/* ---------------------------------------------------------------------
   WHERE: localisation through the parietal map. A ventral lesion does not touch it; a
   parietal one does. This is the other half of the two-streams dissociation — optic ataxia
   is being able to say what it is and not where.
   --------------------------------------------------------------------- */
function localise(uTrue, L, P) {
  L = les(L);
  const par = PAR.createParietal();
  par.intact.L *= (1 - L.parietalL);
  par.intact.R *= (1 - L.parietalR);
  const A = PAR.attend(par, PAR.stimuli(par, [{ u: uTrue }]));
  let num = 0, den = 0;
  for (let j = 0; j < par.NP; j++) { num += A[j] * par.u[j]; den += A[j]; }
  const est = den > 0 ? num / den : null;
  return { estimate: est, error: est == null ? null : Math.abs(est - uTrue), any: den > 0 };
}

/* how many of several simultaneously presented objects reach awareness?
   Neglect is a SPATIAL limit; simultanagnosia is a NUMERICAL one — the distinction the two
   lesions have to produce on their own. */
function howManySeen(us, L) {
  L = les(L);
  const par = PAR.createParietal();
  par.intact.L *= (1 - L.parietalL);
  par.intact.R *= (1 - L.parietalR);
  const A = PAR.attend(par, PAR.stimuli(par, us.map(u => ({ u }))));
  const seen = us.filter(u => PAR.detected(par, A, u));
  const left = seen.filter(u => u < 0).length, right = seen.filter(u => u >= 0).length;
  return { n: seen.length, of: us.length, seen, left, right };
}

/* angular error in degrees between two directions */
const dirErr = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d; return d * 180 / Math.PI; };

module.exports = { sdefaults, noLesion, les, formPath, motionPath, localise, howManySeen,
  dirErr, blurFrame };
