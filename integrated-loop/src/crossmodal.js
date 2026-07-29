"use strict";
/* =====================================================================
   CROSS-MODAL cortex: real auditory features and real visual features driving the two halves
   of the cortical sheet, so the hippocampus binds a SOUND to a SHAPE.

   WHY THIS REPLACES WHAT STAGE 13 DID. Stage 13's episodes were the ventral half of one
   visual stimulus bound to the dorsal half of another, and the left/right lateralisation was
   called "verbal-like vs spatial". That mapping was flagged as an ANALOGUE from the start, and
   the external audit (stage 17) lists material-specific memory as having no external anchor
   partly because of it. Binding a sound to a shape is not an analogue: it is the arbitrary
   cross-modal conjunction the hippocampus exists for, and it puts the left/right axis on
   auditory vs visual material — much closer to the clinical verbal/visuospatial one.

   HOW A FEATURE VECTOR BECOMES A CORTICAL PATTERN. Each modality's features are projected
   through a FIXED random matrix onto that modality's half of cortex, and the top-k units are
   driven. This is a sparse random projection, so it PRESERVES SIMILARITY: two up-sweeps at
   different rates land on overlapping cortical patterns, an up-sweep and noise do not. That
   property is what makes this a front end rather than a relabelling, and stage 20 measures it
   rather than assuming it — if similarity were not preserved, the "cross-modal binding" would
   just be two arbitrary tags and the hippocampus would have nothing modality-like to bind.

   The modality split reuses cxStream, so the lateralisation machinery in bilateral.js works
   unchanged: stream 0 (the left hippocampus's preferred input) is now AUDITORY, stream 1
   (the right's) is VISUAL.
   ===================================================================== */

const A = require("./auditory.js");
const V = require("./vision.js");
const C = require("./cortex.js");

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- feature vectors ---------- */
/* auditory: the modulation spectrum (A1) plus the belt's pitch descriptors */
function auditoryFeatures(kind, opt) {
  const r = A.pipeline(kind, opt || {});
  const v = Array.from(r.S.H);                       // 12 modulation-orientation channels
  v.push(r.h.harmonicity, r.flatness, r.S.entropy,
         Math.log(r.h.best.f0) / Math.log(900), r.h.nPartials / 6);
  return v;
}
/* visual: the V1 ORIENTATION HISTOGRAM plus the V2 angle/curvature descriptors.
   MATCHED TO THE AUDITORY VECTOR BY CONSTRUCTION, and this is a correction. The first version
   returned 6 numbers against audition's 17 — a ~3× asymmetry in how much a modality could say,
   which is not a modelling choice but an oversight. It is a live confound for two things
   stage 20 flagged: the modality halves correlating at r = 0.43 (a 6-dimensional code makes
   less distinctive patterns, so more incidental overlap) and the crossover being 2/3 on one
   arm and 3/3 on the other.
   The fix is principled rather than cosmetic padding: A1 and V1 are the SAME computation on
   different axes, so their feature vectors should have the same shape. Both are now a
   12-channel orientation histogram (modulation orientation in audition, edge orientation in
   vision) plus five higher-order descriptors from the next stage up (belt pitch / V2 angle). */
function visualFeatures(kind, opt) {
  const p = V.pipeline(kind, opt || {});
  const f = p.f;
  const v = Array.from(p.ori.H);                     // 12 orientation channels, as in A1
  v.push(f.corner60, f.corner90, f.curv || 0, f.edge || 0, (f.peaks || 0) / 4);
  return v;
}

/* ---------- sparse random projection onto one half of cortex ---------- */
function projector(dim, nUnits, seed) {
  const rnd = mulberry32(seed), W = [];
  for (let u = 0; u < nUnits; u++) {
    const row = new Float64Array(dim);
    for (let d = 0; d < dim; d++) row[d] = rnd() * 2 - 1;
    W.push(row);
  }
  return W;
}
/* drive the top-k units of the projection; k sets the per-modality sparsity */
function project(W, vec, k, amp, rnd) {
  const n = W.length, s = new Float64Array(n);
  for (let u = 0; u < n; u++) { let a = 0; const row = W[u];
    for (let d = 0; d < vec.length; d++) a += row[d] * vec[d]; s[u] = a; }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => s[b] - s[a]);
  const out = new Float64Array(n);
  for (let i = 0; i < k; i++) out[order[i]] = amp * (0.7 + 0.6 * rnd());
  return out;
}

/* ---------- build a cortex whose stimuli ARE sounds and shapes ---------- */
/* items: [{ sound: [kind, opt], image: [kind, opt] }] — each item is one bimodal object */
function createCrossModal(items, opts) {
  opts = opts || {};
  const NC = opts.NC == null ? 800 : opts.NC;
  const seed = opts.seed == null ? 1 : opts.seed;
  const cortex = C.create({ seed, NC, nStim: items.length });
  const half = NC >> 1;                              // 0..half-1 AUDITORY, half..NC-1 VISUAL
  const k = Math.round((opts.pIn == null ? 0.10 : opts.pIn) * NC / 2);
  const rnd = mulberry32(seed + 991);

  const aFeat = items.map(it => auditoryFeatures(it.sound[0], it.sound[1]));
  const vFeat = items.map(it => visualFeatures(it.image[0], it.image[1]));
  const Wa = projector(aFeat[0].length, half, seed + 17);
  const Wv = projector(vFeat[0].length, NC - half, seed + 43);

  const stim = items.map((_, i) => {
    const pa = project(Wa, aFeat[i], k, cortex.P.inDrive, rnd);
    const pv = project(Wv, vFeat[i], k, cortex.P.inDrive, rnd);
    const s = new Float64Array(NC);
    for (let j = 0; j < half; j++) s[j] = pa[j];
    for (let j = 0; j < NC - half; j++) s[half + j] = pv[j];
    return s;
  });
  cortex.stim = stim;
  C.encode(cortex);
  return { cortex, aFeat, vFeat, half, k,
           stream: Int8Array.from({ length: NC }, (_, i) => (i < half ? 0 : 1)) };
}

/* cosine similarity, for the similarity-preservation check */
function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (na && nb) ? d / Math.sqrt(na * nb) : 0;
}
/* overlap of two cortical drive patterns, restricted to one modality half */
function halfOverlap(x, y, lo, hi) {
  let both = 0, any = 0;
  for (let i = lo; i < hi; i++) { const a = x[i] > 0, b = y[i] > 0;
    if (a && b) both++; if (a || b) any++; }
  return any ? both / any : 0;
}
/* Pearson correlation, for "does cortical overlap track feature similarity?" */
function pearson(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return (dx && dy) ? num / Math.sqrt(dx * dy) : 0;
}

module.exports = { auditoryFeatures, visualFeatures, projector, project,
  createCrossModal, cosine, halfOverlap, pearson, mulberry32 };
