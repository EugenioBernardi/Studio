"use strict";
/* =====================================================================
   Two posterior parietal cortices, and hemispatial neglect.

   WHY THIS AND NOT ANOTHER FIELD DEFECT. Stage 12 can already produce a homonymous
   hemianopia: half the visual field is gone, the loss respects the vertical meridian, and the
   patient knows it and scans into it. Neglect is the opposite kind of failure — the visual
   field is INTACT on perimetry, the stimulus is represented, and it still fails to reach
   awareness because it loses a competition. A model that cannot tell those two apart is not
   modelling attention at all. The differential is the point of this file.

   TWO STANDARD INGREDIENTS, both assumed, not derived:

   1. COVERAGE GRADIENT (Mesulam 1981; Heilman & Van Den Abell 1980; Weintraub & Mesulam).
      Each parietal cortex represents contralateral space densely and ipsilateral space
      sparsely — a gradient, not a hard hemifield boundary. The right hemisphere's ipsilateral
      tail is the LONGER one: it represents both hemifields substantially, the left mostly
      represents right space. This is the anatomical asymmetry, and it is a PARAMETER here
      (tailR > tailL), so the severity asymmetry that follows from it is assumed, not shown.

   2. OPPONENT PROCESSOR (Kinsbourne 1977, 1993). Each hemisphere pushes attention
      contralaterally AND inhibits the other across the callosum. Attention lands where the
      net drive wins.

   WHAT IS EMERGENT, given those two:
     • EXTINCTION — a contralesional stimulus detected alone is lost when an ipsilesional
       competitor appears. Nothing in the model encodes "extinction"; it falls out of the
       competition. Verified to survive with the coverage asymmetry REMOVED, so it is not a
       repackaging of ingredient 1.
     • the LINE-BISECTION bias toward the ipsilesional side, as the centre of mass of the
       surviving attention map.
     • CANCELLATION asymmetry — the bedside test, scored the bedside way.
     • the PARADOXICAL EFFECT: a second lesion, in the intact hemisphere, REDUCES neglect,
       because it removes the unopposed ipsilesional push. Counterintuitive, and the strongest
       available test of whether the opponent mechanism is really doing the work
       (Kinsbourne's prediction; Lomber & Payne in cat; Vuilleumier 1996 in man).

   Space here is the horizontal egocentric extent u ∈ [−1, +1], u < 0 = LEFT, sampled at NP
   positions — the coordinate of line bisection, cancellation and double simultaneous
   stimulation, and the same left/right convention the visual pathway uses.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function pdefaults() {
  return {
    seed: 77,
    NP: 24,           // sampled positions across the horizontal extent
    // coverage: half-height of each hemisphere's gradient, in u. Positive = reaches INTO
    // ipsilateral space. tailR > tailL is the Mesulam asymmetry.
    tailR: 0.60, tailL: 0.10,
    covW: 0.35,       // gradient transition width
    // ATTENTIONAL STRENGTH asymmetry — right-hemisphere dominance for spatial attention
    // (Heilman & Van Den Abell 1980; Mesulam 1981). This is a SECOND asymmetry, separable from
    // the coverage tails above, and stage 14 registered in advance that its absence was why
    // pseudoneglect came out with the wrong sign: a coverage asymmetry alone moves the mark
    // toward the BETTER-covered side, which is rightward, whereas normals bisect slightly left.
    // strR > strL makes the left half-field — driven by the stronger hemisphere — the more
    // strongly attended one. The magnitude is NOT fitted to the pseudoneglect range; it is
    // anchored on the independent clinical fact that right lesions neglect worse than left
    // ones, which stage 29 checks separately.
    strR: 1.0, strL: 1.0,
    // TONIC orienting drive (Kinsbourne's opponent processor, the half of it this model was
    // missing). Each hemisphere exerts a baseline pull toward its contralateral field that does
    // NOT depend on a stimulus being there. Without it the opponent term is purely
    // stimulus-driven, and stage 29 measured the consequence: in a serial cancellation search,
    // once the ipsilesional targets are cancelled the intact hemisphere has nothing to be
    // active about, its callosal inhibition vanishes, and the contralesional targets are then
    // found — 0% missed at every severity from 0.2 to 0.8, which is not neglect. A real patient
    // still cannot orient left after clearing the right, because the intact hemisphere's pull
    // is tonic. Subthreshold on its own; it biases competition, it does not create percepts.
    tonic: 0.0,
    // competition
    gLocal: 0.55,     // local excitation (attention is a bump, not a pixel)
    locW: 2,          // local excitation half-width in bins
    gGlobal: 2.4,     // within-hemisphere global inhibition
    // CALLOSAL cross-hemisphere inhibition — the opponent term. Was 1.9, which extinction
    // alone does not pin down: extinction holds anywhere above ~0.8, so 1.9 was free. Stage 29
    // added a SECOND independent clinical constraint — the line-bisection deviation must land
    // in its published 5–25% band — and that narrows the admissible range to roughly 0.8–1.0.
    // At 1.9 the competition is winner-take-all for an EXTENDED stimulus: the perceived gain of
    // the neglected half collapses to 0.03 instead of the ~0.7–0.8 a 10–20% deviation implies,
    // so bisection saturates at 50%. Constraining a previously unconstrained parameter with an
    // independent measurement is calibration; it is not the same as tuning until a number lands,
    // and stage 14 is re-run in full to show nothing else moved.
    // (PARIETAL_GCALL is honoured only so that stage 29 can sweep this parameter against the
    //  SHIPPED stage-14 suite rather than against a re-implementation of it. Unset in normal use.)
    gCall: +(process.env.PARIETAL_GCALL || 1.9),
    thr: 0.06, gain: 1.5,
    tauA: 0.020, tauI: 0.006, dt: 0.001,
    settleMs: 120,
    detectThr: 0.12,  // an item reaches awareness above this
    noise: 0.0,
  };
}

const uOf = (P, j) => -1 + 2 * j / (P.NP - 1);
/* coverage of position u by each hemisphere: ≈1 deep in contralateral space, falling through
   the ipsilateral tail. Right hemisphere covers u<0 (left space) and reaches to +tailR. */
const covR = (P, u) => 0.5 * (1 - Math.tanh((u - P.tailR) / P.covW));
const covL = (P, u) => 0.5 * (1 + Math.tanh((u + P.tailL) / P.covW));

function createParietal(opts) {
  const P = Object.assign(pdefaults(), opts || {});
  const rnd = mulberry32(P.seed);
  const cov = { L: new Float64Array(P.NP), R: new Float64Array(P.NP) };
  for (let j = 0; j < P.NP; j++) {
    const u = uOf(P, j);
    cov.R[j] = covR(P, u); cov.L[j] = covL(P, u);
  }
  return {
    P, rnd, NP: P.NP, cov,
    u: Float64Array.from({ length: P.NP }, (_, j) => uOf(P, j)),
    a: { L: new Float64Array(P.NP), R: new Float64Array(P.NP) },
    inh: { L: 0, R: 0 },
    intact: { L: 1, R: 1 },
    lesions: {},
  };
}

/* a parietal lesion removes a FRACTION of the hemisphere's capacity — it does not remove
   the visual field. Stage 12's perimetry is untouched by this, which is the whole point. */
function lesionParietal(S, side, frac) {
  S.intact[side] = Math.max(0, 1 - frac);
  S.lesions[side] = frac;
}

/* ---- one settle step of the two competing maps ---- */
function step(S, sal) {
  const P = S.P, NP = P.NP, dt = P.dt;
  const nx = { L: new Float64Array(NP), R: new Float64Array(NP) };
  const sum = { L: 0, R: 0 };
  for (const side of ["L", "R"]) {
    const other = side === "L" ? "R" : "L";
    const a = S.a[side], cvg = S.cov[side], live = S.intact[side];
    const str = side === "R" ? P.strR : P.strL;
    for (let j = 0; j < NP; j++) {
      // local excitation: attention is a bump on the map, not an isolated pixel
      let loc = 0;
      for (let d = -P.locW; d <= P.locW; d++) {
        const k = j + d; if (k < 0 || k >= NP || d === 0) continue;
        loc += a[k];
      }
      const drive = live * str * cvg[j] * (sal[j] + P.tonic) + P.gLocal * loc
                    - P.gGlobal * S.inh[side] - P.gCall * S.inh[other] - P.thr;
      nx[side][j] = drive > 0 ? Math.min(1.3, P.gain * drive) : 0;
    }
  }
  for (const side of ["L", "R"]) {
    const a = S.a[side];
    for (let j = 0; j < NP; j++) { a[j] += (dt / P.tauA) * (nx[side][j] - a[j]); sum[side] += a[j]; }
  }
  for (const side of ["L", "R"]) S.inh[side] += (dt / P.tauI) * (sum[side] / NP - S.inh[side]);
}

/* Present a salience profile and settle. The attention map is the MAX over the two
   hemispheres, not the sum: either hemisphere can support awareness of a location, and it
   should not take two to do it. Summing double-counts near the midline, where both
   hemispheres have coverage — a stimulus at u = +0.4 read 2.594 against 1.297 everywhere
   else, a readout artefact that contaminates every centre-of-mass measure downstream. */
function attend(S, sal, opts) {
  opts = opts || {};
  S.a.L.fill(0); S.a.R.fill(0); S.inh.L = 0; S.inh.R = 0;
  const ms = opts.settleMs == null ? S.P.settleMs : opts.settleMs;
  for (let t = 0; t < ms; t++) step(S, sal);
  const A = new Float64Array(S.NP);
  for (let j = 0; j < S.NP; j++) A[j] = Math.max(S.a.L[j], S.a.R[j]);
  return A;
}

/* ---- stimuli ---- */
const nearest = (S, u) => { let b = 0, bd = Infinity;
  for (let j = 0; j < S.NP; j++) { const d = Math.abs(S.u[j] - u); if (d < bd) { bd = d; b = j; } } return b; };
function stimuli(S, items) {                       // items: [{u, w}]
  const sal = new Float64Array(S.NP);
  for (const it of items) sal[nearest(S, it.u)] += (it.w == null ? 1 : it.w);
  return sal;
}
/* a horizontal line: uniform salience across [uA, uB] */
function line(S, uA, uB, w) {
  const sal = new Float64Array(S.NP);
  for (let j = 0; j < S.NP; j++) if (S.u[j] >= uA && S.u[j] <= uB) sal[j] = w == null ? 1 : w;
  return sal;
}

/* ---- readouts, each the way the clinic scores it ---- */
/* is the item at u attended? */
function detected(S, A, u) { return A[nearest(S, u)] >= S.P.detectThr; }
function level(S, A, u) { return A[nearest(S, u)]; }

/* DEPRECATED as a clinical instrument — kept because stages 14 and 17 report it, and removing
   it would silently rewrite their record.
 *
 * Centre of mass of the attention map. This is a PROXY for the subjective midpoint, not a model
 * of the judgement, and it saturates by construction. With perceived gain g_L on the left half
 * and g_R on the right, CoM = (g_R − g_L) / (2·(g_L + g_R)), so at g_L → 0 it goes to exactly
 * 0.5 — 50% of the half-line — whatever else is true. Stage 17 measured 50.6% against a clinical
 * 5–25%, which is that ceiling and not a property of the model. Use `bisectMark`. */
function bisect(S, A) {
  let num = 0, den = 0;
  for (let j = 0; j < S.NP; j++) { num += A[j] * S.u[j]; den += A[j]; }
  return den > 0 ? num / den : 0;
}

/* THE CLINICAL INSTRUMENT. Line bisection is an EQUAL-EXTENT judgement: the subject marks the
   point at which the left segment appears as long as the right. Perceived extent is the
   attentional gain integrated over the segment, so the mark is where
       ∫(−1→m) A  =  ∫(m→+1) A
   — the weighted MEDIAN of attended salience, not its mean. Under a step-gain model this gives
   m = (g_R − g_L)/(2·g_R): a 20% underestimation of the left half puts the mark at 10% of the
   half-line, which is what the clinical series report. Interpolated within the winning bin so
   the measure is not quantised to NP positions.

   Returned in u. Positive = rightward (ipsilesional, for a right lesion). Multiply by 100 for
   the clinic's units, percent of half-line. */
function bisectMark(S, A) {
  let tot = 0;
  for (let j = 0; j < S.NP; j++) tot += A[j];
  if (tot <= 0) return 0;
  const half = tot / 2;
  let cum = 0;
  for (let j = 0; j < S.NP; j++) {
    const prev = cum;
    cum += A[j];
    if (cum >= half) {
      const uLo = j > 0 ? 0.5 * (S.u[j - 1] + S.u[j]) : S.u[0];
      const uHi = j < S.NP - 1 ? 0.5 * (S.u[j] + S.u[j + 1]) : S.u[S.NP - 1];
      const frac = A[j] > 0 ? (half - prev) / A[j] : 0;
      return uLo + frac * (uHi - uLo);
    }
  }
  return S.u[S.NP - 1];
}

/* the perceived gain of each half-line — the quantity the judgement above compares, exposed so
   that a bisection result can be read against the attenuation that produced it */
function halfGains(S, A) {
  let gL = 0, nL = 0, gR = 0, nR = 0;
  for (let j = 0; j < S.NP; j++) {
    if (S.u[j] < 0) { gL += A[j]; nL++; } else { gR += A[j]; nR++; }
  }
  gL = nL ? gL / nL : 0; gR = nR ? gR / nR : 0;
  return { gL, gR, ratio: gR > 0 ? gL / gR : 0 };
}
/* CANCELLATION AS SERIAL SEARCH — the way the test is actually taken, and the way the
   single-shot version below is not.
 *
 * A patient given a cancellation sheet does not apprehend all targets in one 120 ms settle. They
 * SCAN: the most salient unmarked target wins attention, is crossed out, and thereby leaves the
 * competition; the next fixation is a fresh competition among what remains; the search ends when
 * nothing further reaches awareness. That structure is what makes the test GRADED — once the
 * ipsilesional targets have been marked and removed, the contralesional ones face no competitor,
 * so a patient with partial (not absolute) attenuation finds some of them.
 *
 * The single-shot version is all-or-none by construction: with ten simultaneous competitors and
 * strong callosal inhibition, any lesion that lets the right side win at all wipes the left
 * completely. Stage 29 measured exactly that — 100% of left targets missed at every severity
 * from 0.30 to 0.95 — which is why no severity could reproduce the clinical combination of
 * partial cancellation loss with a 5–25% bisection deviation.
 *
 * `maxFix` bounds the search the way a time limit does. Returns the same shape as
 * `cancellation`, plus the fixation count, so the two can be compared directly. */
function cancellationSerial(S, targets, opts) {
  opts = opts || {};
  const maxFix = opts.maxFix == null ? targets.length * 3 : opts.maxFix;
  const items = targets.map(t => ({ u: t.u, found: false }));
  let fixations = 0;
  for (let fx = 0; fx < maxFix; fx++) {
    const left = items.filter(t => !t.found);
    if (!left.length) break;
    const A = attend(S, stimuli(S, left), opts);
    let best = -1, bv = 0;
    for (let k = 0; k < left.length; k++) {
      const v = level(S, A, left[k].u);
      if (v > bv) { bv = v; best = k; }
    }
    if (best < 0 || bv < S.P.detectThr) break;   // nothing reaches awareness: search terminates
    left[best].found = true;
    fixations++;
  }
  let l = 0, r = 0, nL = 0, nR = 0;
  for (const t of items) {
    if (t.u < 0) { nL++; if (t.found) l++; } else { nR++; if (t.found) r++; }
  }
  return { left: l, right: r, nL, nR, fixations,
           leftFrac: nL ? l / nL : 0, rightFrac: nR ? r / nR : 0 };
}

/* cancellation: how many of an array of targets are found, per side */
function cancellation(S, targets, opts) {
  const A = attend(S, stimuli(S, targets), opts);
  let left = 0, right = 0, nL = 0, nR = 0;
  for (const t of targets) {
    const hit = detected(S, A, t.u);
    if (t.u < 0) { nL++; if (hit) left++; } else { nR++; if (hit) right++; }
  }
  return { left, right, nL, nR, A,
           leftFrac: nL ? left / nL : 0, rightFrac: nR ? right / nR : 0 };
}

/* EXTINCTION: detect a contralesional item alone, then with an ipsilesional competitor.
   The index is what the item LOSES to competition — nothing here encodes extinction. */
function extinction(S, uTarget, uCompetitor, opts) {
  const alone = attend(S, stimuli(S, [{ u: uTarget }]), opts);
  const both = attend(S, stimuli(S, [{ u: uTarget }, { u: uCompetitor }]), opts);
  return {
    alone: level(S, alone, uTarget), both: level(S, both, uTarget),
    aloneDetected: detected(S, alone, uTarget), bothDetected: detected(S, both, uTarget),
    competitor: level(S, both, uCompetitor),
    index: level(S, alone, uTarget) - level(S, both, uTarget),
  };
}

module.exports = { createParietal, pdefaults, lesionParietal, attend, step, stimuli, line,
  detected, level, bisect, bisectMark, halfGains, cancellation, cancellationSerial,
  extinction, nearest, covR, covL, mulberry32 };
