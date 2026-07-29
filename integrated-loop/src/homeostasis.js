"use strict";
/* =====================================================================
   HOMEOSTATIC INTRINSIC EXCITABILITY — the named, bounded fix stage 23 asked for.

   THE DEFECT IT REPAIRS. Stage 23 measured that only 60.3% of cortex was EVER driven over a
   whole 1200-step trajectory. The cause is not the agent and not the recurrent network: it is
   the feedforward encoding. Taking the top k of a fixed random projection gives the projection
   FAVOURITES — a unit whose row aligns poorly with the input manifold never reaches the top k
   however the input varies — so the participating fraction is capped by the projection's own
   coverage, not by experience. That is why more experience raised co-active PARTNERS per cell
   4.7-fold (208 → 977) and barely moved the participating FRACTION (56.4% → 59.5%).

   THE MECHANISM. Intrinsic excitability homeostasis (Desai, Rutherford & Turrigiano 1999;
   Turrigiano 2011): a neuron that fires below its target rate lowers its own threshold, one
   that fires above it raises it, on a slow timescale relative to the stimulus. Implemented as
   a per-unit adaptive bias subtracted from the drive:

       s_eff[u] = s[u] − b[u],        b[u] ← b[u] + η·(won[u] − target)

   with target = k/N, the fraction the competition can support. Fixed points require every unit
   to win at the target rate, so a permanently silent unit is not a fixed point.

   WHAT THIS IS NOT. It does not add information, choose which cells code what, or make the
   representation spatial. It equalises the MARGINAL participation rate and nothing else; the
   stimulus-dependent ordering within a moment is untouched. If spatial tuning survives it,
   that tuning was in the input either way — read stage 23's P3 note again before claiming
   otherwise.

   A quickselect threshold replaces the full sort the projection used: top-k of 10 000 units,
   1800 times, is 2.5×10⁸ comparator calls with `Array.sort` and 1.8×10⁷ without.
   ===================================================================== */

function hdefaults() {
  return {
    eta: 0.02,        // homeostatic rate — slow relative to the stimulus, as in the biology
    bMax: 4.0,        // bound on the bias, so a dead unit cannot win everything
  };
}

function createHomeostat(N, target, opts) {
  const P = Object.assign(hdefaults(), opts || {});
  return { N, target, P, b: new Float64Array(N), frozen: false,
           wins: new Float64Array(N), nUpdate: 0 };
}

/* value of the k-th largest element; destroys `arr` (pass a scratch copy) */
function kthLargest(arr, k) {
  const target = k - 1;
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const p = arr[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (arr[i] > p) i++;
      while (arr[j] < p) j--;
      if (i <= j) { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; i++; j--; }
    }
    if (target <= j) hi = j; else if (target >= i) lo = i; else break;
  }
  return arr[target];
}

/* projection → drive, with the homeostatic bias applied and (unless frozen) updated.
   `sc` is an optional scratch object {s, cp} to avoid reallocating two N-vectors per call. */
function driveHomeo(W, vec, k, amp, H, sc) {
  const n = W.length, dim = vec.length;
  const s = (sc && sc.s) || new Float64Array(n);
  const cp = (sc && sc.cp) || new Float64Array(n);
  for (let u = 0; u < n; u++) {
    const row = W[u]; let a = 0;
    for (let d = 0; d < dim; d++) a += row[d] * vec[d];
    s[u] = a - (H ? H.b[u] : 0);
  }
  cp.set(s);
  const thr = kthLargest(cp, k);
  const out = new Float64Array(n);
  for (let u = 0; u < n; u++) if (s[u] >= thr) out[u] = amp;
  if (H && !H.frozen) {
    const eta = H.P.eta, bM = H.P.bMax, tg = H.target;
    for (let u = 0; u < n; u++) {
      const won = out[u] > 0 ? 1 : 0;
      let b = H.b[u] + eta * (won - tg);
      H.b[u] = b > bM ? bM : (b < -bM ? -bM : b);
      H.wins[u] += won;
    }
    H.nUpdate++;
  } else if (H) {
    for (let u = 0; u < n; u++) if (out[u] > 0) H.wins[u]++;
    H.nUpdate++;
  }
  return out;
}

/* run the homeostat over a set of sensory vectors until the participation rate settles.
   Returns per-pass diagnostics so convergence is reported rather than assumed. */
function adapt(W, vecs, k, H, passes) {
  const n = W.length, sc = { s: new Float64Array(n), cp: new Float64Array(n) };
  const hist = [];
  for (let p = 0; p < (passes || 3); p++) {
    H.wins.fill(0); H.nUpdate = 0;
    for (const v of vecs) driveHomeo(W, v, k, 1, H, sc);
    hist.push(participation(H));
  }
  return hist;
}

/* what fraction of units ever won, and how uneven is the win rate? */
function participation(H) {
  const n = H.N; let live = 0, sum = 0;
  for (let u = 0; u < n; u++) { if (H.wins[u] > 0) live++; sum += H.wins[u]; }
  const m = sum / n;
  let sd = 0; for (let u = 0; u < n; u++) sd += (H.wins[u] - m) ** 2;
  sd = Math.sqrt(sd / n);
  // Gini of the win counts: 0 = every unit participates equally, 1 = one unit takes everything
  const w = Array.from(H.wins).sort((a, b) => a - b);
  let cum = 0, gini = 0;
  for (let i = 0; i < n; i++) { cum += w[i]; gini += cum; }
  gini = sum > 0 ? (n + 1 - 2 * gini / sum) / n : 0;
  return { fracEverActive: live / n, meanWins: m, cv: m ? sd / m : 0, gini };
}

module.exports = { hdefaults, createHomeostat, kthLargest, driveHomeo, adapt, participation };
