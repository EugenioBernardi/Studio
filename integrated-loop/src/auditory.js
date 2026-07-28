"use strict";
/* =====================================================================
   Auditory cortex — cochlea → cochlear nucleus/MGv → A1 → belt.
   Headless extraction of apps/auditory-cortex.html, and the front end for the temporal lobe.

   WHY THIS IS THE RIGHT NEXT SENSE. The model's ventral visual stream gives the temporal lobe
   one modality. The hippocampal conjunction task in stage 13 therefore binds ventral-visual to
   dorsal-visual and calls that "verbal-like vs spatial" — an analogue that was flagged as such
   and is the weakest link in the material-specificity result. A real second modality makes
   that binding genuinely cross-modal, which is what the hippocampus is actually for, and moves
   the left/right axis much closer to the clinical verbal/visuospatial one.

   THE ARCHITECTURE IS THE VISUAL ONE, RE-AXED. That is the point, not a shortcut:
     cochleagram        frequency × time — the auditory "image"
     lateral inhibition along FREQUENCY (cochlear nucleus), then the MGv relay
     A1                 oriented Gabors on that image. ORIENTATION IS FM SWEEP DIRECTION;
                        this is the ripple / modulation-spectrum framework (Shamma; Chi & Ru)
     belt (A2–A4)       harmonic template matching = pitch. The conjunction detector, exactly
                        analogous to the V2 angle cells in vision.js

   TWO CHANGES FROM THE APP, both required and both stated:

   1. DETERMINISM. The app calls Math.random() inside synth() for noise and for the noise
      stimulus itself, so no two runs agree. Every stochastic draw here goes through a seeded
      generator instead. A model that cannot be re-run identically cannot be validated.

   2. NOTHING ELSE. The Gabor parameters are the app's own defaults (sigma 2.6, lambda 4.5,
      gamma 0.35) and the app's startup rebuild() passes exactly those, so unlike the visual
      extraction — where the app rebuilt with parameters the file literals never had, and
      classification silently dropped from 100% to 52% — there is no divergence to correct
      here. That was checked, not assumed.

   KNOWN LIMIT, carried over from the app and not hidden: tone vs harmonic complex is NOT
   resolved at 40 channels. The classifier reports both as STEADY.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const SR = 16000, DUR = 0.40, NCH = 40, NT = 48;
const F_LO = 120, F_HI = 6000;
const erb = f => 21.4 * Math.log10(1 + f * 0.00437);
const erbInv = e => (Math.pow(10, e / 21.4) - 1) / 0.00437;
const CF = [...Array(NCH)].map((_, i) => erbInv(erb(F_LO) + (erb(F_HI) - erb(F_LO)) * i / (NCH - 1)));

/* ---------- stimuli (seeded) ---------- */
function synth(kind, o) {
  o = o || {};
  const f0 = o.f0 == null ? 440 : o.f0, noise = o.noise || 0, level = o.level == null ? 1 : o.level;
  const sweep = o.sweep == null ? 1.6 : o.sweep, am = o.am == null ? 8 : o.am;
  const rnd = mulberry32(o.seed == null ? 12345 : o.seed);
  const n = Math.round(SR * DUR), x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR; let v = 0;
    if (kind === "tone") v = Math.sin(2 * Math.PI * f0 * t);
    else if (kind === "harmonic") {
      for (let k = 1; k <= 8; k++) { const f = f0 * k; if (f < SR / 2) v += Math.sin(2 * Math.PI * f * t) / k; }
      v /= 2.0;
    }
    else if (kind === "noise") v = (rnd() * 2 - 1);
    else if (kind === "up" || kind === "down") {
      const r = (kind === "up") ? sweep : 1 / sweep;
      const f1 = f0, f2 = f0 * r;
      v = Math.sin(2 * Math.PI * (f1 * t + (f2 - f1) * t * t / (2 * DUR)));
    }
    else if (kind === "am") v = (1 + 0.9 * Math.sin(2 * Math.PI * am * t)) * Math.sin(2 * Math.PI * f0 * t) / 2;
    const rp = 0.005 * SR;                       // 5 ms ramp, so we do not measure clicks
    x[i] = level * v * Math.min(1, Math.min(i, n - 1 - i) / rp);
  }
  if (noise > 0) for (let i = 0; i < n; i++) x[i] += noise * (rnd() * 2 - 1);
  return x;
}

/* ---------- constant-Q (cochlea-like) analysis ---------- */
function cochleagram(x, o) {
  o = o || {};
  const cycles = o.cycles == null ? 4 : o.cycles, comp = o.comp == null ? 0.30 : o.comp;
  const M = new Float64Array(NCH * NT), n = x.length;
  for (let c = 0; c < NCH; c++) {
    const fc = CF[c];
    const w = Math.min(1024, Math.max(48, Math.round(cycles * SR / fc)));
    for (let t = 0; t < NT; t++) {
      const centre = Math.round((t + 0.5) / NT * n);
      let re = 0, im = 0, norm = 0;
      for (let k = -w >> 1; k < w >> 1; k++) {
        const idx = centre + k; if (idx < 0 || idx >= n) continue;
        const hann = 0.5 - 0.5 * Math.cos(2 * Math.PI * (k + (w >> 1)) / w);
        const a = 2 * Math.PI * fc * k / SR;
        re += x[idx] * hann * Math.cos(a); im += x[idx] * hann * Math.sin(a); norm += hann;
      }
      M[c * NT + t] = Math.pow(Math.hypot(re, im) / (norm || 1), comp);   // hair-cell compression
    }
  }
  let mx = 0; for (let i = 0; i < M.length; i++) mx = Math.max(mx, M[i]);
  if (mx > 0) for (let i = 0; i < M.length; i++) M[i] /= mx;
  return M;
}

/* ---------- lateral suppression along FREQUENCY (cochlear nucleus) + MGv relay ---------- */
function lateralInhibit(M, o) {
  o = o || {};
  const k = o.k == null ? 0.55 : o.k, sig = o.sig == null ? 2.0 : o.sig;
  const out = new Float64Array(NCH * NT), w = [], K = Math.ceil(sig * 2.5);
  let s = 0; for (let i = -K; i <= K; i++) { const v = Math.exp(-i * i / (2 * sig * sig)); w.push(v); s += v; }
  for (let i = 0; i < w.length; i++) w[i] /= s;
  for (let t = 0; t < NT; t++) for (let c = 0; c < NCH; c++) {
    let sur = 0;
    for (let i = -K; i <= K; i++) { const cc = Math.min(NCH - 1, Math.max(0, c + i)); sur += w[i + K] * M[cc * NT + t]; }
    out[c * NT + t] = Math.max(0, M[c * NT + t] - k * sur);
  }
  let mx = 0; for (let i = 0; i < out.length; i++) mx = Math.max(mx, out[i]);
  if (mx > 0) for (let i = 0; i < out.length; i++) out[i] /= mx;
  return out;
}

/* ---------- A1: oriented STRFs. Orientation IS the FM sweep direction. ---------- */
const NORI = 12;
const ORI = [...Array(NORI).keys()].map(i => i * Math.PI / NORI);
function gabor(th, phase, o) {
  o = o || {};
  const sigma = o.sigma == null ? 2.6 : o.sigma, lambda = o.lambda == null ? 4.5 : o.lambda,
        gamma = o.gamma == null ? 0.35 : o.gamma;
  const k = Math.ceil(Math.max(sigma, sigma / gamma) * 2.4), K = [];
  const ct = Math.cos(th), st = Math.sin(th); let pos = 0, neg = 0;
  for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) {
    const X = i * ct + j * st, Y = -i * st + j * ct;
    const g = Math.exp(-(X * X + gamma * gamma * Y * Y) / (2 * sigma * sigma)) * Math.cos(2 * Math.PI * X / lambda + phase);
    K.push({ i, j, g }); if (g > 0) pos += g; else neg -= g;
  }
  const m = (pos + neg) / 2 || 1; K.forEach(e => e.g /= m);
  return K;
}
let GK = ORI.map(th => [gabor(th, 0), gabor(th, Math.PI / 2)]);
function rebuild(p) { GK = ORI.map(th => [gabor(th, 0, p), gabor(th, Math.PI / 2, p)]); }

/* i indexes TIME, j indexes FREQUENCY */
function conv(M, K) {
  const out = new Float64Array(NCH * NT);
  for (let c = 0; c < NCH; c++) for (let t = 0; t < NT; t++) {
    let a = 0;
    for (const e of K) {
      const tt = t + e.i, cc = c + e.j;
      if (tt < 0 || cc < 0 || tt >= NT || cc >= NCH) continue;
      a += e.g * M[cc * NT + tt];
    }
    out[c * NT + t] = a;
  }
  return out;
}
function a1(M, o) {
  const pw = (o && o.pw != null) ? o.pw : 2;
  const E = [];
  for (let i2 = 0; i2 < NORI; i2++) {
    const a = conv(M, GK[i2][0]), b = conv(M, GK[i2][1]);
    const e = new Float64Array(NCH * NT);
    for (let i = 0; i < NCH * NT; i++) e[i] = Math.pow(Math.sqrt(a[i] * a[i] + b[i] * b[i]), pw);
    E.push(e);
  }
  for (let i = 0; i < NCH * NT; i++) {
    let tot = 0; for (let o2 = 0; o2 < NORI; o2++) tot += E[o2][i];
    if (tot > 0) for (let o2 = 0; o2 < NORI; o2++) E[o2][i] /= (0.35 + tot);
  }
  return E;
}
function modSpectrum(E) {
  const H = new Float64Array(NORI); let tot = 0;
  for (let o = 0; o < NORI; o++) { let s = 0; for (let i = 0; i < NCH * NT; i++) s += E[o][i]; H[o] = s; tot += s; }
  if (tot <= 0) return { H, entropy: 0, tot: 0 };
  for (let o = 0; o < NORI; o++) H[o] /= tot;
  let e = 0; for (let o = 0; o < NORI; o++) if (H[o] > 0) e -= H[o] * Math.log(H[o]);
  return { H, entropy: e / Math.log(NORI), tot };
}

/* ---------- belt: harmonic templates = pitch (the V2-angle-cell analogue) ---------- */
const chanNear = f => { let b = 0, bd = 1e9;
  for (let c = 0; c < NCH; c++) { const d = Math.abs(Math.log(CF[c] / f)); if (d < bd) { bd = d; b = c; } }
  return bd < 0.12 ? b : -1; };
function spectralProfile(M) {
  const P = new Float64Array(NCH);
  for (let c = 0; c < NCH; c++) { let s = 0; for (let t = 0; t < NT; t++) s += M[c * NT + t]; P[c] = s / NT; }
  let mx = 0; for (let c = 0; c < NCH; c++) mx = Math.max(mx, P[c]);
  if (mx > 0) for (let c = 0; c < NCH; c++) P[c] /= mx;
  return P;
}
/* spectral PEAKS, not raw excitation: a pure tone smears across channels, and template
   matching on the raw profile lets one partial satisfy many harmonic slots */
function peaks(P, o) {
  const thr = (o && o.thr != null) ? o.thr : 0.22;
  const pk = new Float64Array(P.length);
  for (let c = 1; c < P.length - 1; c++) if (P[c] > thr && P[c] >= P[c - 1] && P[c] >= P[c + 1]) pk[c] = P[c];
  return pk;
}
function harmonicTemplates(M, o) {
  o = o || {};
  const nH = o.nH == null ? 6 : o.nH, lo = o.f0lo == null ? 100 : o.f0lo,
        hi = o.f0hi == null ? 900 : o.f0hi, steps = o.steps == null ? 60 : o.steps;
  const P0 = spectralProfile(M), P = peaks(P0), out = [];
  for (let s = 0; s < steps; s++) {
    const f0 = lo * Math.pow(hi / lo, s / (steps - 1));
    // absolute score: a missing harmonic counts ZERO, so a pure tone can never score like a
    // full stack. Requiring the fundamental rejects subharmonic templates whose 3rd harmonic
    // happens to land on the only real partial; low harmonics are weighted more heavily.
    let hit = 0, filled = 0, wsum = 0, haveF0 = false;
    for (let k = 1; k <= nH; k++) {
      const c = chanNear(f0 * k); if (c < 0) continue;
      const v = Math.max(P[c], P[Math.max(0, c - 1)] || 0, P[Math.min(P.length - 1, c + 1)] || 0);
      const w = 1 / Math.sqrt(k);
      hit += w * v; wsum += w;
      if (v > 0.22) { filled++; if (k === 1) haveF0 = true; }
    }
    out.push({ f0, score: (haveF0 && wsum > 0) ? hit / wsum : 0, filled });
  }
  let best = out[0]; for (const x of out) if (x.score > best.score) best = x;
  return { best, harmonicity: best.score, nPartials: best.filled, profile: P0, peaks: P, curve: out };
}
/* spectral flatness: 1 = noise-like (flat), low = tonal */
function flatness(M) {
  const P = spectralProfile(M);
  let g = 0, a = 0, n = 0;
  for (let c = 0; c < NCH; c++) { const v = P[c] + 1e-6; g += Math.log(v); a += v; n++; }
  return Math.exp(g / n) / (a / n);
}

/* ---------- the app's decision rule, extracted verbatim ---------- */
function classify(S, fl) {
  const asym = (S.H[7] - S.H[5]) / (S.H[7] + S.H[5] + 1e-9);
  if (fl > 0.90) return { label: "NOISE", asym };
  if (asym > 0.5) return { label: "UP-SWEEP", asym };
  if (asym < -0.5) return { label: "DOWN-SWEEP", asym };
  return { label: "STEADY", asym };
}

function pipeline(kind, opt) {
  opt = opt || {};
  const x = synth(kind, opt);
  const raw = cochleagram(x);
  const M = lateralInhibit(raw, { k: opt.li == null ? 0.55 : opt.li });
  const E = a1(M), S = modSpectrum(E);
  const h = harmonicTemplates(M), fl = flatness(M);
  const dec = classify(S, fl);
  return { x, raw, M, E, S, h, flatness: fl, asym: dec.asym, label: dec.label, dec };
}

module.exports = { SR, DUR, NCH, NT, NORI, ORI, CF, erb, erbInv,
  synth, cochleagram, lateralInhibit, gabor, rebuild, conv, a1, modSpectrum,
  spectralProfile, peaks, harmonicTemplates, flatness, classify, pipeline, mulberry32 };
