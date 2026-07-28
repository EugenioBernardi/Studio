"use strict";
/* =====================================================================
   TWO hippocampi, lateralised, joined by a hippocampal commissure.

   WHY THIS IS NOT COSMETIC. Three of the best-established facts in clinical memory
   neurology are statements about there being TWO of them, and a single-hippocampus model
   cannot express any of them:

     • Unilateral temporal lobectomy is a routine epilepsy operation and does NOT cause
       amnesia. It causes a MATERIAL-SPECIFIC deficit — left for verbal, right for
       visuospatial material (Milner 1958, 1968; Smith & Milner 1981).
     • BILATERAL medial temporal resection does (Scoville & Milner 1957, patient H.M.):
       dense anterograde amnesia with remote memory spared.
     • The Wada test exists precisely because "can the OTHER hippocampus carry memory on its
       own?" is not answerable from a single structure.

   HOW LATERALISATION IS IMPLEMENTED. Both hippocampi see the same neocortex — association
   cortex is callosally connected, and that is a deliberate simplification, not an oversight.
   What is lateralised is the GAIN on each sensory stream. Cortex is already split into a
   ventral ("what", object identity) and a dorsal ("where", spatial) half by cxStream; the
   left hippocampus weights ventral at 1.0 and dorsal at wCross, the right the mirror.

   THE SAME GAIN APPLIES TO THE RETURN PATH, and this is load-bearing. Hippocampal output
   re-enters cortex through its OWN entorhinal cortex, so the projection back is as ipsilateral
   as the projection in. Lateralising only the input makes the lesion felt on the cue side
   alone, and the material-specific deficit washes out — measured at 0.03 vs 0.07 and in the
   WRONG direction before the return path was lateralised too.

   READ THE MAPPING HONESTLY. The clinical axis is verbal vs visuospatial. This model has no
   language, so the streams stand in for it: ventral↔left↔"verbal-like", dorsal↔right↔spatial.
   The spatial half of that mapping is literal and well supported (right posterior hippocampus
   in spatial memory — Smith & Milner; Maguire). The verbal half is an ANALOGUE. What is
   tested is the LOGIC of material specificity — a unilateral lesion costs one class of
   material and spares the other — not the linguistics.

   THE COMMISSURE. CA3(L) ⟷ CA3(R), homotopic (mirror-image points), sparse, and ACh-gated
   like the local recurrent collaterals — it is the same class of associational synapse. In
   the RAT the ventral hippocampal commissure is substantial; in HUMANS it is sparse and
   whether it does functional work is not established. gComm is a slider with a deliberately
   low default, and stage 13 reports what it actually buys rather than assuming it buys
   something.
   ===================================================================== */

const C = require("./cortex.js");
const H = require("./hippocampus.js");
const L = require("./loop.js");

function bdefaults() {
  return {
    wCross: 0.35,     // gain on the NON-preferred stream (ipsilateral input dominates)
    gComm: 0.15,      // commissural gain — low, as the human hippocampal commissure is sparse
    kComm: 8,         // commissural in-degree onto each CA3 cell
    wComm: 0.5,       // mean commissural weight (before gComm)
    commSpread: 0.12, // homotopy: how far off the mirror-image point a commissural fibre lands
  };
}

/* per-hemisphere gain on each cortical cell, by which stream it belongs to */
function lateralGain(hpc, side, wCross) {
  const g = new Float64Array(hpc.NC);
  for (let i = 0; i < hpc.NC; i++) {
    const ventral = hpc.cxStream[i] === 0;
    const preferred = (side === "L") ? ventral : !ventral;   // left ← ventral, right ← dorsal
    g[i] = preferred ? 1 : wCross;
  }
  return g;
}

function createBrain(opts) {
  opts = opts || {};
  const P = Object.assign(bdefaults(), opts);
  const seed = opts.seed == null ? 101 : opts.seed;
  // the two hippocampi are separate draws of the same anatomy — homologous, not identical
  const hL = H.createHPC(Object.assign({}, opts, { seed: seed }));
  const hR = H.createHPC(Object.assign({}, opts, { seed: seed + 5000 }));

  const rnd = H.mulberry32(seed + 31337);
  // homotopic commissure: a cell at transverse t connects near the SAME t, narrow kernel
  const o = { sT: P.commSpread, sL: P.commSpread, lnSigma: 0.6 };
  const commLR = H.project(rnd, hL.F.ca3, hR.F.ca3, P.kComm, P.wComm, o);  // R → L
  const commRL = H.project(rnd, hR.F.ca3, hL.F.ca3, P.kComm, P.wComm, o);  // L → R

  hL.commIn = new Float64Array(hL.P.NCA3);
  hR.commIn = new Float64Array(hR.P.NCA3);

  return {
    P, L: hL, R: hR, commLR, commRL,
    gain: { L: lateralGain(hL, "L", P.wCross), R: lateralGain(hR, "R", P.wCross) },
    alive: { L: true, R: true },
    NC: hL.NC,
  };
}

/* remove a hippocampus. Resection: it takes no further part, ever. */
function resect(brain, side) { brain.alive[side] = false; }
/* transient inactivation — the Wada test. Reversible by design. */
function inactivate(brain, side, on) { brain.alive[side] = !on; }
const sides = brain => ["L", "R"].filter(s => brain.alive[s]);

/* one commissural exchange, using the OTHER hippocampus's CA3 state from the previous step
   (a one-step conduction delay, which is what a real commissural fibre imposes) */
function exchange(brain) {
  const { L: hL, R: hR, P } = brain;
  if (brain.alive.L) {
    const src = brain.alive.R ? hR.ca3 : null;
    for (let i = 0; i < hL.P.NCA3; i++) hL.commIn[i] = src ? P.gComm * H.dot(brain.commLR, i, src) : 0;
  }
  if (brain.alive.R) {
    const src = brain.alive.L ? hL.ca3 : null;
    for (let i = 0; i < hR.P.NCA3; i++) hR.commIn[i] = src ? P.gComm * H.dot(brain.commRL, i, src) : 0;
  }
}

/* the cortical drive each hemisphere actually receives */
function driveFor(brain, side, cortexA) {
  const g = brain.gain[side], out = new Float64Array(cortexA.length);
  for (let i = 0; i < cortexA.length; i++) out[i] = cortexA[i] * g[i];
  return out;
}

function clearFields(h) {
  h.ec2.fill(0); h.ec3.fill(0); h.ecd.fill(0);
  h.dg.fill(0); h.ca3.fill(0); h.ca1.fill(0); h.sub.fill(0);
  h.iEC2 = h.iEC3 = h.iECd = h.iDG = h.iCA3 = h.iCA1 = h.iSUB = 0;
  if (h.commIn) h.commIn.fill(0);
}

/* settle BOTH hippocampi on the current cortical pattern, exchanging across the commissure
   each millisecond. ach 1.0 = encoding (recurrence and commissure gated off), low = retrieval. */
function settleForwardBoth(brain, cortexA, ms, ach) {
  const live = sides(brain);
  for (const s of live) { clearFields(brain[s]); brain[s].P.ach = ach == null ? 1.0 : ach; }
  const dr = {}; for (const s of live) dr[s] = driveFor(brain, s, cortexA);
  for (let t = 0; t < (ms || 80); t++) {
    exchange(brain);
    for (const s of live) H.forwardStep(brain[s], dr[s]);
  }
}

/* ---------------------------------------------------------------------
   EPISODES: an arbitrary CROSS-STREAM conjunction — the ventral ("what") half of one
   stimulus bound to the dorsal ("where") half of a different one. This is the task the
   hippocampus exists for and the cortex cannot do: cortex never learned that pairing, so
   cued with the ventral half it completes to its OWN dorsal half — the wrong partner
   (measured: correct 0.05, wrong 0.52 with the hippocampus removed).

   The MEMORY is the cortical state the conjunction actually produced at encoding, not the
   idealised input. Scoring against the idealised pattern measures how much cortex distorted
   the input, which is not what a lesion study asks.
   --------------------------------------------------------------------- */
function makeEpisodes(cortex, brain, pairs) {
  const cs = brain.L.cxStream;
  return pairs.map(([a, b]) => {
    const pat = new Float64Array(cortex.N);
    for (let i = 0; i < cortex.N; i++) pat[i] = cs[i] === 0 ? cortex.stim[a][i] : cortex.stim[b][i];
    return { a, b, pat, cells: null };
  });
}

/* ENCODE into every surviving hippocampus. Each forms its OWN index for the same episode —
   they are not copies: the two see the streams at different gains and have different anatomy.
   Cortex is NOT made plastic here: cortical learning is slow, which is the whole premise of
   complementary learning systems, so the conjunction lives only in the hippocampus. */
function encodeEpisodes(cortex, brain, eps, opts) {
  opts = opts || {};
  const live = sides(brain);
  for (const s of live) { brain[s].indices = []; brain[s].P.ach = 1.0; brain[s].plastic = true; }
  const prev = {};
  for (let k = 0; k < eps.length; k++) {
    cortex.a.fill(0); cortex.inh = 0;
    C.setExt(cortex, eps[k].pat); C.run(cortex, 0.35);
    const cortexSet = C.activeSet(cortex);
    eps[k].cells = cortexSet;
    settleForwardBoth(brain, cortex.a, opts.settleMs || 80, 1.0);
    for (const s of live) {
      const h = brain[s], at = h.P.actThr;
      const cells = H.activeSet(h.ca3, at);
      // bind the output stage to the EC-deep pattern RETRIEVAL produces (see loop.js)
      const save = Float64Array.from(h.ca3);
      h.ca3.fill(0); for (const c of cells) h.ca3[c] = 1.0;
      h.ca1.fill(0); h.sub.fill(0); h.ecd.fill(0); h.iCA1 = h.iSUB = h.iECd = 0;
      for (let t = 0; t < (opts.backMs || 40); t++) H.backwardStep(h);
      L.bindDense(h.Wec, cortex.a, h.ecd, at, h.P.lrBind, h.P.wBindMax, h.P.wBudgetBind);
      h.ca3.set(save);
      L.bindCA3sym(h, at);
      if (prev[s]) L.bindCA3asym(h, prev[s].set, prev[s].cells, cells);
      h.indices.push({ s: k, cells, cortex: cortexSet });
      prev[s] = { set: new Set(cells), cells };
    }
  }
  C.clearExt(cortex);
  return live;
}

/* split an encoded episode into a cue part and a to-be-recovered part, tracked per stream */
function splitEpisode(ep, cxStream, frac, rnd) {
  const cue = [], tgtV = [], tgtD = [];
  for (const c of ep.cells) {
    if (rnd() < frac) cue.push(c);
    else (cxStream[c] === 0 ? tgtV : tgtD).push(c);
  }
  return { cue, tgtV, tgtD };
}

/* RETRIEVE from a partial cue. The cue REMAINS present while the hippocampus reinstates —
   retrieval is cue + reinstatement, not reinstatement instead of the cue. Set useHPC false
   for the floor: what cortical pattern completion alone recovers. */
function retrieveSplit(cortex, brain, sp, opts) {
  opts = opts || {};
  const useHPC = opts.useHPC !== false;
  const scale = opts.scale == null ? 0.20 : opts.scale;
  const live = sides(brain);
  const cueV = new Float64Array(cortex.N);
  for (const c of sp.cue) cueV[c] = 1.0;
  cortex.a.fill(0); cortex.inh = 0;
  C.setExt(cortex, cueV); C.run(cortex, 0.35);

  let got;
  if (!useHPC || !live.length) { got = new Set(C.activeSet(cortex)); C.clearExt(cortex); }
  else {
    const cueA = Float64Array.from(cortex.a); C.clearExt(cortex);
    settleForwardBoth(brain, cueA, opts.settleMs || 80, opts.ach == null ? 0.15 : opts.ach);
    const drive = Float64Array.from(cueV);
    for (const s of live) {
      const h = brain[s], g = brain.gain[s];
      for (let t = 0; t < (opts.backMs || 40); t++) H.backwardStep(h);
      // lateralised RETURN path — see the header note; this is what makes the deficit
      // material-specific rather than merely global
      for (let i = 0; i < cortex.N; i++) drive[i] += scale * g[i] * h.ecReinstate[i];
    }
    cortex.a.fill(0); cortex.inh = 0;
    C.setExt(cortex, drive); C.run(cortex, opts.dur == null ? 0.20 : opts.dur);
    got = new Set(C.activeSet(cortex)); C.clearExt(cortex);
  }
  const ov = cells => { let c = 0; for (const x of cells) if (got.has(x)) c++;
    return c / Math.max(1, cells.length); };
  return { V: ov(sp.tgtV), D: ov(sp.tgtD), active: got.size / cortex.N };
}

/* run a whole list and return mean recovery by stream, with and without the hippocampi */
function testList(cortex, brain, eps, opts) {
  opts = opts || {};
  const rnd = H.mulberry32(opts.seed == null ? 4242 : opts.seed);
  const cs = brain.L.cxStream;
  let V = 0, D = 0, bV = 0, bD = 0, act = 0;
  for (const ep of eps) {
    const sp = splitEpisode(ep, cs, opts.cue == null ? 0.35 : opts.cue, rnd);
    const r = retrieveSplit(cortex, brain, sp, opts);
    const b = retrieveSplit(cortex, brain, sp, Object.assign({}, opts, { useHPC: false }));
    V += r.V; D += r.D; bV += b.V; bD += b.D; act += r.active;
  }
  const n = eps.length;
  return { V: V / n, D: D / n, floorV: bV / n, floorD: bD / n, active: act / n };
}

module.exports = { createBrain, bdefaults, resect, inactivate, sides, exchange, driveFor,
  settleForwardBoth, makeEpisodes, encodeEpisodes, splitEpisode, retrieveSplit, testList,
  lateralGain };
