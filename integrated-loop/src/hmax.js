"use strict";
/* =====================================================================
   HMAX S1 / C1 front-end (Riesenhuber & Poggio 1999; Serre et al. 2007).

   Replaces the bespoke single-scale V1 with the published biologically-motivated
   architecture, because the MNIST benchmark showed a single fixed Gabor bank cannot serve
   both long-contour geometric shapes and fine curved strokes:

     S1  a bank of Gabors at SEVERAL SCALES × 12 orientations (simple cells)
     C1  local MAX pooling over position AND over adjacent scales within a band
         (complex cells) → tolerance to position and size

   The max pooling is the part that matters and the part a naive multi-scale concatenation
   misses: concatenating scales adds dimensions without adding invariance (measured: 87.5 %
   vs 90.5 % for a single scale), whereas taking the max over a scale band and a spatial
   window is what actually builds tolerance.

   C1 is emitted in the SAME shape as the existing v1complex output — an array of NORI maps
   on the NC×NC grid — so `v2()`, `features()`, `oriStats()` and the decision layer all work
   unchanged and the shape task stays directly comparable.
   ===================================================================== */

const V = require("./vision.js");
const N = V.N, NORI = V.NORI, NC = V.NC;

// Scale bank: sigma grows ~geometrically; lambda tied to sigma (Serre: lambda = sigma/0.8);
// gamma 0.5 is between the shape-tuned 0.30 and the digit-optimal 0.60 — the bank spans both
// rather than committing to either.
const SCALES = [
  { sigma: 1.2, lambda: 2.4, gamma: 0.5 },
  { sigma: 1.8, lambda: 3.2, gamma: 0.5 },
  { sigma: 2.6, lambda: 4.2, gamma: 0.5 },
  { sigma: 3.4, lambda: 5.0, gamma: 0.5 },
];
// C1 bands: overlapping pairs of adjacent scales, with a spatial pooling window that grows
// with scale (larger receptive fields pool more, as in cortex).
const BANDS = [{ s: [0, 1], pool: 4 }, { s: [1, 2], pool: 6 }, { s: [2, 3], pool: 8 }];

/* single even Gabor (S1 simple cell), zero-mean and L2-normalised as in Serre et al. */
function gabor(th, { sigma, lambda, gamma }) {
  const k = Math.ceil(Math.max(sigma, sigma / gamma) * 2.6), K = [];
  const ct = Math.cos(th), st = Math.sin(th);
  let sum = 0, n = 0;
  for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) {
    const X = i * ct + j * st, Y = -i * st + j * ct;
    if (X * X + Y * Y > k * k) continue;                      // circular support
    const g = Math.exp(-(X * X + gamma * gamma * Y * Y) / (2 * sigma * sigma))
            * Math.cos(2 * Math.PI * X / lambda);
    K.push({ i, j, g }); sum += g; n++;
  }
  const mean = sum / n;
  let ss = 0; for (const e of K) { e.g -= mean; ss += e.g * e.g; }
  const norm = Math.sqrt(ss) || 1; for (const e of K) e.g /= norm;
  return K;
}
const BANK = SCALES.map(sc => V.ORI.map(th => gabor(th, sc)));

/* S1: |Gabor response|, normalised by local input energy (contrast invariance) */
function s1(signed, si) {
  const out = [];
  for (let o = 0; o < NORI; o++) {
    const K = BANK[si][o], m = new Float64Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let a = 0, e = 0;
      for (const q of K) {
        const xx = x + q.i, yy = y + q.j;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const v = signed[yy * N + xx];
        a += q.g * v; e += v * v;
      }
      m[y * N + x] = Math.abs(a) / Math.sqrt(e + 1e-6);
    }
    out.push(m);
  }
  return out;
}

/* C1: max over the band's scales and over a pool×pool spatial window, sampled to NC×NC */
function c1(S, band) {
  const out = [];
  const half = Math.max(1, Math.round(band.pool / 2));
  for (let o = 0; o < NORI; o++) {
    const m = new Float64Array(NC * NC);
    for (let gy = 0; gy < NC; gy++) for (let gx = 0; gx < NC; gx++) {
      const cx = Math.round((gx + 0.5) * N / NC), cy = Math.round((gy + 0.5) * N / NC);
      let mx = 0;
      for (const si of band.s) {
        const map = S[si][o];
        for (let j = -half; j <= half; j++) for (let i = -half; i <= half; i++) {
          const xx = cx + i, yy = cy + j;
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          const v = map[yy * N + xx]; if (v > mx) mx = v;
        }
      }
      m[gy * NC + gx] = mx;
    }
    out.push(m);
  }
  return out;
}

/* Full front-end for one image.
   returns { bands: [NORI maps per band], C: NORI maps (max across bands) }
   `C` is drop-in compatible with v1complex output, so v2()/features()/classify() work. */
function front(img, opts) {
  opts = opts || {};
  const L = V.lgn(V.retina(img));
  const S = SCALES.map((_, si) => s1(L.signed, si));
  const bands = BANDS.map(b => c1(S, b));
  // scale-invariant C1: max across bands, then divisive normalisation across orientations
  // (kept from the original v1complex so downstream feature statistics stay comparable)
  const C = [];
  for (let o = 0; o < NORI; o++) {
    const m = new Float64Array(NC * NC);
    for (let i = 0; i < NC * NC; i++) { let mx = 0; for (const b of bands) if (b[o][i] > mx) mx = b[o][i]; m[i] = mx; }
    C.push(m);
  }
  const norm = opts.norm == null ? 0.35 : opts.norm;
  for (let i = 0; i < NC * NC; i++) {
    let tot = 0; for (let o = 0; o < NORI; o++) tot += C[o][i];
    for (let o = 0; o < NORI; o++) C[o][i] = C[o][i] / (norm + tot);
  }
  return { bands, C };
}

/* the same pipeline the reference app exposes, but with the HMAX front-end */
function pipeline(kind, opt) {
  const img = V.drawShape(kind, opt || {});
  const { C, bands } = front(img);
  const V2 = V.v2(C), f = V.features(V2), st = V.oriStats(C);
  const ff = { ...f, entropy: st.entropy, peaks: st.peaks };
  return { img, C, bands, V: V2, f: ff, ori: st, dec: V.classify(ff) };
}

/* feature vector for classification: all bands concatenated (before the across-band max) */
function featureVector(img) {
  const { bands } = front(img);
  const out = new Float64Array(bands.length * NORI * NC * NC);
  let k = 0;
  for (const b of bands) for (let o = 0; o < NORI; o++) { out.set(b[o], k); k += NC * NC; }
  return out;
}

module.exports = { SCALES, BANDS, gabor, s1, c1, front, pipeline, featureVector, N, NORI, NC };
