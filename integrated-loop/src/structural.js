"use strict";
/* =====================================================================
   STRUCTURAL PLASTICITY: connectivity that starts biologically constrained and MOVES toward
   real network statistics as the network learns.

   THE PROBLEM THIS FIXES. hippocampus.js has been structured since stage 8 — topographic
   Gaussian kernels, lognormal weights, inverted Schaffer and subicular maps, lamellar mossy
   fibres. cortex.js has not: it is Erdős–Rényi, every pair equally likely, no space at all.
   That is defensible as a starting point and indefensible as a resting point, because real
   cortex is none of those things and its deviations are exactly what carry its computation.

   TWO CHANGES, and the second is the one that matters:

   1. THE INITIAL DRAW IS DISTANCE-DEPENDENT. Cells sit on a 2-D sheet; connection probability
      falls as a Gaussian in cortical distance, plus a small fraction of long-range contacts.
      This is a constraint, not a result — it is what development gives you before experience.

   2. CONNECTIONS ARE THEN REWIRED BY ACTIVITY. Synapses that stay weak are PRUNED (removed,
      not merely decayed — that is what makes it structural rather than weight plasticity), and
      new contacts form preferentially between co-active partners, distance-weighted, under a
      FIXED PER-CELL SYNAPSE BUDGET. The budget is the metabolic constraint: a cell cannot
      simply accumulate contacts, so every new synapse costs an old one.

   WHAT WOULD MAKE THIS A RESULT RATHER THAN A CONSTRUCTION. The target statistics are NOT
   drawn in. A purely local (lattice-like) network has high clustering and long path length;
   a random one has low clustering and short paths; neither is small-world. Real cortex is
   small-world with a heavy-tailed degree distribution and a rich club of hubs, and lognormal
   weights. If those emerge from pruning and rewiring alone, they are a consequence of the
   learning rule. Stage 21 measures every one of them BEFORE and AFTER, and also checks that
   FUNCTION SURVIVES — a network that rewires into beautiful statistics but can no longer
   recall has not improved, it has been vandalised.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function sdefaults() {
  return {
    sigma: 0.16,      // Gaussian falloff of connection probability, in sheet units
    pLong: 0.06,      // fraction of contacts drawn without regard to distance
    pruneThr: 0.02,   // a synapse this weak is a candidate for removal
    pruneFrac: 0.25,  // at most this fraction of a cell's contacts are pruned per episode
    rewireBias: 3.0,  // how strongly a new contact prefers a co-active partner
    budgetSlack: 0,   // extra contacts a cell may end with (0 = strict budget)
  };
}

/* cells on a 2-D sheet, in a jittered grid so distance means something */
function layout(N, seed) {
  const rnd = mulberry32(seed == null ? 5 : seed);
  const side = Math.ceil(Math.sqrt(N)), pos = [];
  for (let i = 0; i < N; i++) {
    const gx = i % side, gy = Math.floor(i / side);
    pos.push([(gx + 0.5 + 0.6 * (rnd() - 0.5)) / side, (gy + 0.5 + 0.6 * (rnd() - 0.5)) / side]);
  }
  return pos;
}
const dist = (p, a, b) => Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]);

/* distance-dependent initial connectivity with a long-range tail. k = in-degree per cell. */
function connectDistance(N, pos, k, P, seed) {
  P = Object.assign(sdefaults(), P || {});
  const rnd = mulberry32(seed == null ? 91 : seed);
  const preIdx = [], preW = [];
  for (let i = 0; i < N; i++) {
    const w = new Float64Array(N); let tot = 0;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const d = dist(pos, i, j);
      const local = Math.exp(-(d * d) / (2 * P.sigma * P.sigma));
      const v = (1 - P.pLong) * local + P.pLong;      // a floor gives the long-range tail
      w[j] = v; tot += v;
    }
    const chosen = new Set(), id = [];
    let guard = 0;
    while (id.length < k && guard++ < k * 60) {
      let r = rnd() * tot, j = 0;
      while (j < N - 1 && (r -= w[j]) > 0) j++;
      if (j === i || chosen.has(j)) continue;
      chosen.add(j); id.push(j);
    }
    preIdx.push(Int32Array.from(id));
    preW.push(new Float64Array(id.length));           // weights start silent, as cortex.js does
  }
  return { preIdx, preW };
}

/* ---------- network statistics ---------- */
/* undirected neighbour sets, for clustering and path length */
function neighbourSets(preIdx) {
  const N = preIdx.length, nb = Array.from({ length: N }, () => new Set());
  for (let i = 0; i < N; i++) for (const j of preIdx[i]) { nb[i].add(j); nb[j].add(i); }
  return nb;
}
function clustering(nb) {
  let tot = 0, n = 0;
  for (let i = 0; i < nb.length; i++) {
    const ns = [...nb[i]], d = ns.length;
    if (d < 2) continue;
    let links = 0;
    for (let a = 0; a < d; a++) for (let b = a + 1; b < d; b++) if (nb[ns[a]].has(ns[b])) links++;
    tot += 2 * links / (d * (d - 1)); n++;
  }
  return n ? tot / n : 0;
}
/* mean shortest path, estimated by BFS from a sample of sources (all-pairs is O(N²) edges) */
function pathLength(nb, nSample, seed) {
  const N = nb.length, rnd = mulberry32(seed == null ? 3 : seed);
  const srcs = [];
  for (let s = 0; s < (nSample || 40); s++) srcs.push(Math.floor(rnd() * N));
  let tot = 0, cnt = 0;
  for (const s of srcs) {
    const d = new Int32Array(N).fill(-1); d[s] = 0;
    const q = [s];
    for (let h = 0; h < q.length; h++) {
      const u = q[h];
      for (const v of nb[u]) if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); }
    }
    for (let i = 0; i < N; i++) if (i !== s && d[i] > 0) { tot += d[i]; cnt++; }
  }
  return cnt ? tot / cnt : 0;
}
/* degree distribution shape, and the rich club: do high-degree cells preferentially interconnect? */
function degreeStats(nb) {
  const deg = nb.map(s => s.size);
  const n = deg.length, m = deg.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(deg.reduce((a, b) => a + (b - m) ** 2, 0) / n);
  const skew = sd > 0 ? deg.reduce((a, b) => a + ((b - m) / sd) ** 3, 0) / n : 0;
  // rich club at the top decile: density among hubs / density overall
  const order = deg.map((d, i) => [d, i]).sort((a, b) => b[0] - a[0]);
  const hubs = order.slice(0, Math.max(2, Math.round(0.1 * n))).map(x => x[1]);
  const hs = new Set(hubs);
  let hl = 0; for (const i of hubs) for (const j of nb[i]) if (hs.has(j)) hl++;
  const hubDensity = hubs.length > 1 ? hl / (hubs.length * (hubs.length - 1)) : 0;
  const allLinks = deg.reduce((a, b) => a + b, 0);
  const allDensity = allLinks / (n * (n - 1));
  return { mean: m, sd, cv: m ? sd / m : 0, skew,
           richClub: allDensity > 0 ? hubDensity / allDensity : 0 };
}
/* how lognormal are the non-zero weights? report the skew of log(w) — 0 means lognormal */
function weightStats(preW) {
  const ws = [];
  for (const w of preW) for (const x of w) if (x > 1e-6) ws.push(x);
  if (ws.length < 8) return { n: ws.length, logSkew: null, cv: null };
  const lg = ws.map(Math.log);
  const m = lg.reduce((a, b) => a + b, 0) / lg.length;
  const sd = Math.sqrt(lg.reduce((a, b) => a + (b - m) ** 2, 0) / lg.length);
  const skew = sd > 0 ? lg.reduce((a, b) => a + ((b - m) / sd) ** 3, 0) / lg.length : 0;
  const mw = ws.reduce((a, b) => a + b, 0) / ws.length;
  const sw = Math.sqrt(ws.reduce((a, b) => a + (b - mw) ** 2, 0) / ws.length);
  return { n: ws.length, logSkew: skew, cv: mw ? sw / mw : 0 };
}
/* small-world index sigma = (C/C_rand) / (L/L_rand), using a degree-matched random graph */
function smallWorld(nb, N, k, seed) {
  const C0 = clustering(nb), L0 = pathLength(nb, 30, seed);
  const rnd = mulberry32((seed || 3) + 777);
  const rIdx = [];
  for (let i = 0; i < N; i++) {
    const s = new Set();
    while (s.size < k) { const j = Math.floor(rnd() * N); if (j !== i) s.add(j); }
    rIdx.push(Int32Array.from(s));
  }
  const rnb = neighbourSets(rIdx);
  const Cr = clustering(rnb), Lr = pathLength(rnb, 30, seed);
  return { C: C0, L: L0, Crand: Cr, Lrand: Lr,
           sigma: (Cr > 0 && L0 > 0 && Lr > 0) ? (C0 / Cr) / (L0 / Lr) : 0 };
}

/* ---------- the structural step ---------- */
/* Prune weak synapses and regrow the same number toward co-active partners, distance-weighted
   and under the cell's original budget. `coact[i][j]` is supplied as an activity trace. */
function pruneAndRewire(cortex, pos, coact, P, seed) {
  P = Object.assign(sdefaults(), P || {});
  const rnd = mulberry32(seed == null ? 404 : seed);
  const N = cortex.N;
  let pruned = 0, grown = 0;
  for (let i = 0; i < N; i++) {
    const idx = cortex.preIdx[i], w = cortex.preW[i];
    const budget = idx.length;
    // candidates for removal: the weakest, capped so a cell is never gutted in one episode
    const order = Array.from(idx, (j, a) => a).sort((a, b) => w[a] - w[b]);
    const maxPrune = Math.floor(P.pruneFrac * budget);
    const kill = new Set();
    for (const a of order) {
      if (kill.size >= maxPrune) break;
      if (w[a] < P.pruneThr) kill.add(a);
    }
    if (!kill.size) continue;
    const keptIdx = [], keptW = [];
    for (let a = 0; a < idx.length; a++) if (!kill.has(a)) { keptIdx.push(idx[a]); keptW.push(w[a]); }
    pruned += kill.size;
    // regrow to budget: prefer co-active, distance-weighted partners
    const have = new Set(keptIdx);
    const need = budget + P.budgetSlack - keptIdx.length;
    const cand = [], cw = [];
    for (let j = 0; j < N; j++) {
      if (j === i || have.has(j)) continue;
      const d = dist(pos, i, j);
      const local = Math.exp(-(d * d) / (2 * P.sigma * P.sigma)) + P.pLong;
      const co = coact ? (coact[i] ? (coact[i][j] || 0) : 0) : 0;
      cand.push(j); cw.push(local * (1 + P.rewireBias * co));
    }
    let tot = cw.reduce((a, b) => a + b, 0);
    for (let g = 0; g < need && tot > 0; g++) {
      let r = rnd() * tot, a = 0;
      while (a < cand.length - 1 && (r -= cw[a]) > 0) a++;
      if (cw[a] <= 0) continue;
      keptIdx.push(cand[a]); keptW.push(0);            // a new contact starts silent
      tot -= cw[a]; cw[a] = 0; grown++;
    }
    cortex.preIdx[i] = Int32Array.from(keptIdx);
    cortex.preW[i] = Float64Array.from(keptW);
  }
  return { pruned, grown };
}

/* accumulate a co-activity trace over the assemblies a cortex has learned */
function coactivity(cortex) {
  const N = cortex.N, co = Array.from({ length: N }, () => ({}));
  for (const a of cortex.assemblies) {
    for (const i of a) for (const j of a) if (i !== j) co[i][j] = (co[i][j] || 0) + 1;
  }
  const nA = Math.max(1, cortex.assemblies.length);
  for (let i = 0; i < N; i++) for (const j of Object.keys(co[i])) co[i][j] /= nA;
  return co;
}

function report(cortex, N, k, seed) {
  const nb = neighbourSets(cortex.preIdx);
  const sw = smallWorld(nb, N, k, seed);
  return Object.assign({}, sw, { degree: degreeStats(nb), weights: weightStats(cortex.preW) });
}

module.exports = { sdefaults, layout, dist, connectDistance, neighbourSets, clustering,
  pathLength, degreeStats, weightStats, smallWorld, pruneAndRewire, coactivity, report,
  mulberry32 };
