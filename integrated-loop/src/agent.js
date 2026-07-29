"use strict";
/* =====================================================================
   A MOVING AGENT: continuous experience, which is what structural plasticity has been
   starved of.

   WHY THIS EXISTS NOW RATHER THAN AS A FEATURE. Stage 22 measured why prune-and-rewire could
   not reshape the cortical graph even after the substrate was made sparse enough to have a
   shape: only 56.4% of cells had ANY co-active partner, and pruning hit its cap every episode,
   because eight static patterns at ~7% sparsity leave almost every synapse unpotentiated. The
   corrected claim was that structural plasticity needs EXPERIENCE and eight patterns is not
   experience. This module is the test of that claim, not a new capability bolted on.

   THE ENVIRONMENT is a box with walls and a few landmarks. THE AGENT walks a smooth
   foraging-like trajectory with wall avoidance — momentum in heading, so the path is
   correlated in time the way a real trajectory is and not a sequence of teleports.

   THE SENSORY ENCODING is boundary-and-landmark, deliberately: distance to the wall in each
   of NDIR allocentric directions, plus distance and bearing to each landmark. This is what
   boundary-vector-cell models use, and it has the property the experiment needs — it varies
   SMOOTHLY and CONTINUOUSLY with position, so nearby places give overlapping cortical
   patterns and distant ones do not.

   READ THE SPATIAL TUNING HONESTLY WHEN IT APPEARS. If cortical cells end up spatially tuned,
   that is very largely INHERITED from a spatially smooth input, not discovered by the network.
   A place field here is not evidence of a place-cell mechanism. The non-trivial questions are
   whether rewiring SHARPENS that tuning beyond what the input dictates, and whether the graph
   statistics move now that there is something to move them — and stage 23 asks those, not
   "did place fields appear".
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = Math.PI * 2;

function adefaults() {
  return {
    seed: 21,
    NDIR: 12,          // allocentric directions in which wall distance is sensed
    nLandmark: 3,
    speed: 0.022,      // per step, in box units
    turnSd: 0.35,      // heading momentum: small random turns, so the path is smooth
    wallAvoid: 0.14,   // distance at which the agent starts turning away
    dt: 1,
  };
}

/* a square box [0,1]², with landmarks placed inside it */
function createEnv(P) {
  P = Object.assign(adefaults(), P || {});
  const rnd = mulberry32(P.seed);
  const landmarks = Array.from({ length: P.nLandmark }, () => [0.15 + 0.7 * rnd(), 0.15 + 0.7 * rnd()]);
  return { P, rnd, landmarks };
}

/* distance from (x,y) to the box wall along direction θ */
function wallDistance(x, y, th) {
  const cx = Math.cos(th), sy = Math.sin(th);
  let d = Infinity;
  if (cx > 1e-9) d = Math.min(d, (1 - x) / cx);
  if (cx < -1e-9) d = Math.min(d, (0 - x) / cx);
  if (sy > 1e-9) d = Math.min(d, (1 - y) / sy);
  if (sy < -1e-9) d = Math.min(d, (0 - y) / sy);
  return Math.max(0, Math.min(1.5, d));
}

/* the sensory vector at a pose: boundary distances + landmark distance/bearing.
   Smooth in position and heading, which is the property the experiment needs. */
function sense(env, x, y, hd) {
  const P = env.P, v = [];
  for (let i = 0; i < P.NDIR; i++) {
    const th = hd + i * TAU / P.NDIR;                 // EGOCENTRIC: rotates with the agent
    v.push(wallDistance(x, y, th));
  }
  for (const [lx, ly] of env.landmarks) {
    const dx = lx - x, dy = ly - y, d = Math.hypot(dx, dy);
    const bearing = ((Math.atan2(dy, dx) - hd) + TAU) % TAU;
    v.push(Math.exp(-d * 2), Math.cos(bearing), Math.sin(bearing));
  }
  return v;
}
const senseDim = P => P.NDIR + 3 * P.nLandmark;

/* a smooth foraging trajectory with wall avoidance */
function trajectory(env, nSteps, opts) {
  opts = opts || {};
  const P = env.P, rnd = mulberry32((P.seed || 21) + (opts.seed || 0) + 77);
  let x = 0.5, y = 0.5, hd = rnd() * TAU;
  const path = [];
  for (let t = 0; t < nSteps; t++) {
    // turn away from a wall we are approaching, otherwise drift
    const ahead = wallDistance(x, y, hd);
    let turn = P.turnSd * (rnd() * 2 - 1);
    if (ahead < P.wallAvoid) turn += (rnd() < 0.5 ? 1 : -1) * (0.5 + 0.6 * rnd());
    hd = (hd + turn + TAU) % TAU;
    const nx = x + Math.cos(hd) * P.speed, ny = y + Math.sin(hd) * P.speed;
    if (nx > 0.02 && nx < 0.98) x = nx;
    if (ny > 0.02 && ny < 0.98) y = ny;
    path.push({ x, y, hd, s: sense(env, x, y, hd) });
  }
  return path;
}

/* how much of the box did the agent actually visit? */
function coverage(path, nBin) {
  nBin = nBin || 10;
  const seen = new Set();
  for (const p of path) seen.add(Math.floor(p.x * nBin) * nBin + Math.floor(p.y * nBin));
  return seen.size / (nBin * nBin);
}

/* ---------- sensory vector → cortical drive, via the same sparse random projection
   crossmodal.js uses, so the encoding stage is shared rather than reinvented ---------- */
function makeProjector(dim, N, seed) {
  const rnd = mulberry32(seed == null ? 808 : seed), W = [];
  for (let u = 0; u < N; u++) {
    const row = new Float64Array(dim);
    for (let d = 0; d < dim; d++) row[d] = rnd() * 2 - 1;
    W.push(row);
  }
  return W;
}
function drive(W, vec, k, amp) {
  const n = W.length, s = new Float64Array(n);
  for (let u = 0; u < n; u++) { let a = 0; const row = W[u];
    for (let d = 0; d < vec.length; d++) a += row[d] * vec[d]; s[u] = a; }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => s[b] - s[a]);
  const out = new Float64Array(n);
  for (let i = 0; i < k; i++) out[order[i]] = amp;
  return out;
}

/* Spatial information (Skaggs): bits per spike, the standard measure of place tuning.
   rate[b] is the cell's mean activity in bin b, occ[b] the fraction of time spent there. */
function spatialInfo(rate, occ) {
  let mean = 0;
  for (let b = 0; b < rate.length; b++) mean += occ[b] * rate[b];
  if (mean <= 0) return 0;
  let I = 0;
  for (let b = 0; b < rate.length; b++) {
    if (rate[b] > 0 && occ[b] > 0) I += occ[b] * (rate[b] / mean) * Math.log2(rate[b] / mean);
  }
  return I;
}

module.exports = { adefaults, createEnv, wallDistance, sense, senseDim, trajectory,
  coverage, makeProjector, drive, spatialInfo, mulberry32, TAU };
