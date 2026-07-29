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
    pLong: 0.06,      // long-range term — see mixLong for what this number actually means
    mixLong: false,   // false (stages 21–23): pLong is a FLOOR added to the un-normalised
                      //   Gaussian weight. Its share of the total mass is then
                      //   pLong/((1−pLong)·π·sigma²) — 0.79 at sigma 0.16, 3.18 at 0.08, 8.13
                      //   at 0.05. So SHRINKING sigma makes the graph MORE random, not more
                      //   local, which is the opposite of what the parameter name suggests and
                      //   was found by stage 24 §1b when a locality sweep moved clustering the
                      //   wrong way. Kept as the default so earlier stages reproduce exactly.
                      // true: each component is normalised first, so pLong IS the long-range
                      //   fraction and sigma is free to control locality on its own.
    pruneThr: 0.02,   // a synapse this weak is a candidate for removal
    pruneFrac: 0.25,  // at most this fraction of a cell's contacts are pruned per episode
    rewireBias: 3.0,  // how strongly a new contact prefers a co-active partner
    budgetSlack: 0,   // extra contacts a cell may end with (0 = strict budget)

    // HOW CO-ACTIVITY ENTERS THE REGROWTH KERNEL. This is the parameter stage 24 died on.
    //   "multiplicative" (stages 21–24): v = local(d) · (1 + rewireBias·co). Distance is a
    //     GATE, not a prior — a strongly co-active but distant partner is multiplied by a
    //     near-zero local term and can never be reached. Stage 24 showed no setting of
    //     rewireBias escapes this: raising the boost's share of the sampling mass from 3.04%
    //     to 26.69% moved the graph by ΔCV 0.004 → 0.005 and σ by 0.02 → 0.05. The kernel,
    //     not the parameter, is the limit.
    //   "additive": v = local(d) + addBias·co. Distance now BIASES. A maximally co-active
    //     partner is reachable from anywhere on the sheet, which is what building long-range
    //     structure requires — and what it risks is function, since regrowth is no longer
    //     spatially constrained. Stage 25 tests both halves of that.
    rewireMode: "multiplicative",
    addBias: 1.0,     // additive mode: weight of a maximally co-active partner, against a
                      // local term that runs from pLong (far) to 1+pLong (adjacent)
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

/* Weighted draw from a prefix-sum array: the first index whose running total reaches r.
   Replaces the linear scan the sampling used up to stage 23. Same distribution, same prefix
   sums, same one rnd() per draw — but O(log N) instead of O(N), which is the difference
   between 6×10⁹ and 10⁸ operations at N = 10 000 and is why the scale-up is runnable at all. */
function pickCum(cum, n, r) {
  let lo = 0, hi = n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
  return lo;
}

/* distance-dependent initial connectivity with a long-range tail. k = in-degree per cell. */
function connectDistance(N, pos, k, P, seed) {
  P = Object.assign(sdefaults(), P || {});
  const rnd = mulberry32(seed == null ? 91 : seed);
  const preIdx = [], preW = [];
  const cum = new Float64Array(N);
  const g = new Float64Array(N);
  const inv2s2 = 1 / (2 * P.sigma * P.sigma), one = 1 - P.pLong;
  for (let i = 0; i < N; i++) {
    const xi = pos[i][0], yi = pos[i][1];
    let tot = 0;
    if (P.mixLong) {
      // normalise the two components separately, so pLong is genuinely the long-range fraction
      let gs = 0;
      for (let j = 0; j < N; j++) {
        if (j === i) { g[j] = 0; continue; }
        const dx = pos[j][0] - xi, dy = pos[j][1] - yi;
        g[j] = Math.exp(-(dx * dx + dy * dy) * inv2s2); gs += g[j];
      }
      const flat = P.pLong / (N - 1);
      for (let j = 0; j < N; j++) {
        if (j !== i) tot += (gs > 0 ? one * g[j] / gs : 0) + flat;
        cum[j] = tot;
      }
    } else {
      for (let j = 0; j < N; j++) {
        if (j !== i) {
          const dx = pos[j][0] - xi, dy = pos[j][1] - yi;
          tot += one * Math.exp(-(dx * dx + dy * dy) * inv2s2) + P.pLong;  // floor, not a fraction
        }
        cum[j] = tot;
      }
    }
    const chosen = new Set(), id = [];
    let guard = 0;
    while (id.length < k && guard++ < k * 60) {
      const j = pickCum(cum, N, rnd() * tot);
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
/* Sampled over `nSample` nodes when the network is large: clustering is O(N·d²) and the
   shipped degree is ~110, so an exhaustive pass at N = 4000 is 48M set lookups per call. */
function clustering(nb, nSample, seed) {
  let tot = 0, n = 0;
  const N = nb.length;
  let nodes;
  if (nSample && nSample < N) {
    const rnd = mulberry32(seed == null ? 13 : seed);
    const s = new Set();
    while (s.size < nSample) s.add(Math.floor(rnd() * N));
    nodes = [...s];
  } else nodes = Array.from({ length: N }, (_, i) => i);
  for (const i of nodes) {
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
function smallWorld(nb, N, k, seed, nSample) {
  const C0 = clustering(nb, nSample, seed), L0 = pathLength(nb, 30, seed);
  const rnd = mulberry32((seed || 3) + 777);
  const rIdx = [];
  for (let i = 0; i < N; i++) {
    const s = new Set();
    while (s.size < k) { const j = Math.floor(rnd() * N); if (j !== i) s.add(j); }
    rIdx.push(Int32Array.from(s));
  }
  const rnb = neighbourSets(rIdx);
  const Cr = clustering(rnb, nSample, seed), Lr = pathLength(rnb, 30, seed);
  return { C: C0, L: L0, Crand: Cr, Lrand: Lr,
           sigma: (Cr > 0 && L0 > 0 && Lr > 0) ? (C0 / Cr) / (L0 / Lr) : 0 };
}

/* ---------- the structural step ---------- */
/* Prune weak synapses and regrow the same number toward co-active partners, distance-weighted
   and under the cell's original budget.
 *
 * `coact` is an activity trace in one of two forms, because the two regimes need different
 * storage and pretending otherwise does not scale:
 *   • SPARSE — an array of per-cell objects, `coact[i][j]`. What `coactivity()` returns from a
 *     handful of static patterns, where most cells have no co-active partner at all.
 *   • DENSE  — `{ dense: Uint16Array(N*N) or Float64Array(N*N), scale }`, row-major. What a
 *     moving agent generates: at N = 10 000 with ~10% active, a step co-activates 10⁶ pairs and
 *     a per-cell hash map of that is ~10⁷ entries and gigabytes. A flat 200 MB typed array is
 *     both smaller and an O(1) row lookup, which is exactly what the sampler below wants.
 *
 * `scale` converts the raw trace to the [0,1] the boost expects. A per-row `rowScale[i]` may be
 * given instead, which judges each cell's partners against ITS OWN best partner rather than
 * against the global maximum. That is not a knob: it is the same competitive logic as the
 * subtractive weight normalisation above — a cell has no access to the network's maximum, only
 * to its own — and stage 24 measures what the difference is worth.
 */
function pruneAndRewire(cortex, pos, coact, P, seed) {
  P = Object.assign(sdefaults(), P || {});
  const rnd = mulberry32(seed == null ? 404 : seed);
  const N = cortex.N;
  const inv2s2 = 1 / (2 * P.sigma * P.sigma);
  const dense = coact && coact.dense ? coact.dense : null;
  const dScale = dense ? (coact.scale == null ? 1 : coact.scale) : 0;
  const v = new Float64Array(N), cum = new Float64Array(N);
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
    const xi = pos[i][0], yi = pos[i][1];
    for (let j = 0; j < N; j++) {
      if (j === i || have.has(j)) { v[j] = 0; continue; }
      const dx = pos[j][0] - xi, dy = pos[j][1] - yi;
      v[j] = Math.exp(-(dx * dx + dy * dy) * inv2s2) + P.pLong;
    }
    const additive = P.rewireMode === "additive";
    if (dense) {
      const off = i * N;
      const sc = coact.rowScale ? coact.rowScale[i] : dScale;
      if (sc > 0) for (let j = 0; j < N; j++) if (v[j] > 0) {
        const co = dense[off + j] * sc;
        v[j] = additive ? v[j] + P.addBias * co : v[j] * (1 + P.rewireBias * co);
      }
    } else if (coact && coact[i]) {
      const ci = coact[i];
      for (const key in ci) { const j = +key; if (v[j] > 0) {
        const co = ci[key];
        v[j] = additive ? v[j] + P.addBias * co : v[j] * (1 + P.rewireBias * co);
      } }
    }
    let tot = 0;
    for (let j = 0; j < N; j++) { tot += v[j]; cum[j] = tot; }
    // Sampling WITHOUT replacement, by rejection. Drawing from the fixed distribution and
    // rejecting repeats is identical to renormalising after each draw, and avoids rebuilding
    // the prefix sums per draw — `need` is ~15, so rejections are negligible.
    const taken = new Set();
    let g = 0, guard = 0;
    while (g < need && tot > 0 && guard++ < need * 200) {
      const j = pickCum(cum, N, rnd() * tot);
      if (j === i || have.has(j) || taken.has(j) || v[j] <= 0) continue;
      taken.add(j); keptIdx.push(j); keptW.push(0);     // a new contact starts silent
      g++; grown++;
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

function report(cortex, N, k, seed, nSample) {
  const nb = neighbourSets(cortex.preIdx);
  const sw = smallWorld(nb, N, k, seed, nSample);
  return Object.assign({}, sw, { degree: degreeStats(nb), weights: weightStats(cortex.preW) });
}

module.exports = { sdefaults, layout, dist, pickCum, connectDistance, neighbourSets, clustering,
  pathLength, degreeStats, weightStats, smallWorld, pruneAndRewire, coactivity, report,
  mulberry32 };
