"use strict";
/* =====================================================================
   The LIMBIC thalamus, bilateral, and the circuit of Papez.

   The model already had a thalamus — the first-order sensory/relay one in
   thalamocortical.js, TC and RTN per cortical column, which generates the NREM state. That
   is not this. This is the higher-order limbic thalamus, and it is where three clinical
   facts live that nothing else in the model can reach:

     · DIENCEPHALIC AMNESIA. Korsakoff's syndrome, thalamic infarct, third-ventricle
       tumour and fornix transection all produce an anterograde amnesia that is
       behaviourally close to the medial temporal one — yet the hippocampus is intact. The
       lesion is on the extended circuit, not in the hippocampus.
     · RECOLLECTION vs FAMILIARITY (Aggleton & Brown 1999). Two routes out of the medial
       temporal lobe: hippocampus → fornix → mammillary bodies → mammillothalamic tract →
       anterior thalamic nuclei supports RECOLLECTION; perirhinal cortex → mediodorsal
       thalamus supports FAMILIARITY. Damage them separately and the two dissociate.
     · THALAMIC NEGLECT. Pulvinar and the intralaminar nuclei produce a neglect
       indistinguishable at the bedside from the parietal one, with parietal cortex intact.

   THE CIRCUIT, as a chain of rate units rather than a multiplied-out integrity factor:

     subiculum --fornix--> mammillary bodies --MTT--> ATN --> retrosplenial/cingulate
        ^                                                            |
        |                                                            v
        +---- entorhinal <---- parahippocampal <---- cingulum <-------+

   Each link is a real signal with a threshold, so a lesion anywhere degrades what arrives
   at the far end. The circuit being a SERIES chain is the anatomy; that a lesion at any node
   produces a comparable deficit is then a consequence to be measured, not a stipulation —
   and because the units are thresholded, partial lesions need NOT be equivalent, which is
   the non-trivial part.

   The Papez return re-enters the entorhinal cortex, so what it modulates is the hippocampal
   RETRIEVAL route. That is why a diencephalic lesion can abolish recollection while leaving
   an intact hippocampus sitting there.

   The MD route is deliberately SEPARATE and parallel: perirhinal cortex → MD → a scalar
   familiarity signal that never passes through the hippocampus. That separation is what
   makes the double dissociation possible at all.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function ldefaults() {
  return {
    seed: 613,
    // Chain gains, and the stage gain that sets the operating regime. For the chain to be
    // GRADED rather than a step function, the per-stage gain must sit just below the
    // stability point gain < x/(x−thr): at a subicular drive of 0.8 that is 1.18. At the
    // first tuning (gain 1.35, chain gains 1.25) every stage pinned at the 1.3 ceiling, so
    // lesions up to 50% did nothing at all and then everything collapsed at once — a step
    // function dressed as a circuit, and nothing partial could be measured on it.
    gFornix: 1.0, gMTT: 1.0, gATNrsc: 1.0, gRscEC: 1.0,
    thr: 0.12,            // per-stage threshold — this is what makes the chain nonlinear
    gain: 1.12,
    // the MD / familiarity route, kept off the ceiling for the same reason
    gPrhMD: 1.0, gMDout: 1.0,
    famTrace: 0.85,       // how much of an item's pattern perirhinal keeps
    // pulvinar → parietal attentional gain
    gPulv: 1.0,
    settleMs: 40, tauA: 0.020, dt: 0.001,
  };
}

/* one thresholded rate stage */
const stage = (P, drive, live) => {
  const d = live * drive - P.thr;
  return d > 0 ? Math.min(1.3, P.gain * d) : 0;
};

function createLimbic(opts) {
  const P = Object.assign(ldefaults(), opts || {});
  const node = () => ({ L: 1, R: 1 });
  return {
    P, rnd: mulberry32(P.seed),
    // integrity of each node/tract, per side. 1 = intact, 0 = destroyed.
    live: {
      fornix: node(), mb: node(), mtt: node(), atn: node(),
      rsc: node(), cingulum: node(),
      prh: node(), md: node(), pulvinar: node(),
    },
    // last computed activities, for inspection
    act: { mb: { L: 0, R: 0 }, atn: { L: 0, R: 0 }, rsc: { L: 0, R: 0 }, ec: { L: 0, R: 0 },
           md: { L: 0, R: 0 } },
    famStore: [],
    lesions: {},
  };
}

function lesion(S, node, side, frac) {
  if (!S.live[node]) throw new Error("no such limbic node: " + node);
  const sides = side === "both" ? ["L", "R"] : [side];
  for (const s of sides) S.live[node][s] = Math.max(0, 1 - frac);
  S.lesions[node + ":" + side] = frac;
}
function resetLesions(S) {
  for (const k of Object.keys(S.live)) { S.live[k].L = 1; S.live[k].R = 1; }
  S.lesions = {};
}

/* ---------------------------------------------------------------------
   THE PAPEZ RETURN. Drive the chain from a subicular output level and return what reaches
   the entorhinal cortex. Each side runs its own chain; the two are summed at entorhinal
   cortex, because either side's circuit can support retrieval — which is why UNILATERAL
   diencephalic lesions are not amnesic and bilateral ones are.
   --------------------------------------------------------------------- */
function papezReturn(S, subicular) {
  const P = S.P, L = S.live;
  let best = 0;
  for (const s of ["L", "R"]) {
    const mb  = stage(P, P.gFornix * subicular, L.fornix[s] * L.mb[s]);
    const atn = stage(P, P.gMTT * mb, L.mtt[s] * L.atn[s]);
    const rsc = stage(P, P.gATNrsc * atn, L.rsc[s]);
    const ec  = stage(P, P.gRscEC * rsc, L.cingulum[s]);
    S.act.mb[s] = mb; S.act.atn[s] = atn; S.act.rsc[s] = rsc; S.act.ec[s] = ec;
    best = Math.max(best, ec);
  }
  return best;                       // the recollective gain returned to entorhinal cortex
}

/* ---------------------------------------------------------------------
   THE FAMILIARITY ROUTE. Perirhinal cortex keeps a decayed trace of each item it has seen;
   familiarity is the best match between a probe and those traces, relayed through MD. It
   never touches the hippocampus, the index, or the Papez chain.
   --------------------------------------------------------------------- */
function studyItem(S, pattern) {
  const t = new Float64Array(pattern.length);
  for (let i = 0; i < pattern.length; i++) t[i] = S.P.famTrace * pattern[i];
  S.famStore.push(t);
}
const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (na && nb) ? d / Math.sqrt(na * nb) : 0;
};
function familiarity(S, probe) {
  const P = S.P, L = S.live;
  let match = 0;
  for (const t of S.famStore) match = Math.max(match, cosine(probe, t));
  let best = 0;
  for (const s of ["L", "R"]) {
    const prh = stage(P, P.gPrhMD * match, L.prh[s]);
    const md = stage(P, P.gMDout * prh, L.md[s]);
    S.act.md[s] = md;
    best = Math.max(best, md);
  }
  return best;
}

/* ---------------------------------------------------------------------
   PULVINAR → parietal attentional gain. The pulvinar of one side supports attention to
   CONTRALATERAL space, exactly as its cortex does, so damaging it degrades the same
   hemisphere's attentional capacity without touching parietal cortex or the visual field.
   --------------------------------------------------------------------- */
function pulvinarGain(S, side) { return S.P.gPulv * S.live.pulvinar[side]; }
/* apply the pulvinar to a parietal model in place: the thalamic contribution to each
   hemisphere's capacity. Returns the parietal object for chaining. */
function drivePulvinar(S, parietal) {
  for (const s of ["L", "R"]) parietal.intact[s] *= pulvinarGain(S, s);
  return parietal;
}

const PAPEZ_NODES = ["fornix", "mb", "mtt", "atn", "rsc", "cingulum"];

module.exports = { createLimbic, ldefaults, lesion, resetLesions, papezReturn,
  studyItem, familiarity, pulvinarGain, drivePulvinar, cosine, stage, PAPEZ_NODES,
  mulberry32 };
