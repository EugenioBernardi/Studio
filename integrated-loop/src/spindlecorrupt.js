"use strict";
/* =====================================================================
   CORRUPTED SPINDLES: a discharge landing on an ongoing spindle wastes it.

   BUILT AGAINST SIX MEASURED CONSTRAINTS, enumerated in docs/PREBUILD-CHECK-02.md BEFORE any of
   this was written. The previous model in this project satisfied two of them and contradicted two,
   and nobody noticed until a draft existed. The constraints:

     1  spindle density reduced ~30% in TLE                     Bender 2023, n=81
     2  spindle-SO coupling strength reduced in TLE             Bender 2023, n=81
     3  coupled spindle-slow-wave rate 0.51 of control          Schiller 2025, n=20
     4  IED-COINCIDENT spindles altered: +126ms, +3.4uV, freq^  Sakovics 2022, n=21
     5  IED-INDUCED spindles morphologically NORMAL             Sakovics 2022, n=21
     6  no association between spindle measures and IED RATE    Bender 2023, n=81

   CONSTRAINT 5 IS WHY THIS MODEL EXISTS. The previous one assumed IED-induced spindles were the
   pathological, content-free events. Sakovics measured them as identical to unrelated spindles. So
   induction is not the lesion. COINCIDENCE is: a discharge arriving on a spindle already in
   progress deforms it, and it is those deformed spindles that mark the pathology.

   CONSTRAINT 6 DICTATES THE ARCHITECTURE, and forces a concession. If the spindle deficit were
   discharge-driven it would correlate with discharge rate, and in 81 patients it does not. So the
   density and coupling-strength deficits are modelled as DISEASE-LEVEL and discharge-independent —
   which concedes the EEG phenotype to the rate-reduction account. What this model claims is
   narrower and sits on top: among the spindles that survive, the ones a discharge corrupts are
   worse than useless.

   THE MECHANISM, stated in advance rather than fitted. A spindle opens a time-limited plasticity
   window that must align with ripple arrival. Sakovics measured coincident spindles as 126 ms
   longer with an upward frequency shift; a window that long and that mis-tuned no longer coincides
   with the replay it was meant to receive. The content arrives outside the window.

   WHY CORRUPTED IS WORSE THAN ABSENT — the one prediction that separates this from rate-reduction.
   Sharp-wave ripples are recruited by, and coordinated with, spindles. A spindle that is present
   RECRUITS a ripple; a spindle that is absent does not. So a corrupted spindle draws a replay event
   and wastes it, while an absent spindle leaves that replay available for a later coupling. Under
   rate-reduction a present spindle can never be harmful. Under corruption it can.

   RECONCILING UEHARA AND BENDER on coupling strength, because they appear to conflict and the
   distinction matters. Uehara (2026) found IED-coupled spindles show HIGHER phase consistency than
   uncoupled ones — a WITHIN-patient comparison. Bender (2023) found spindle-SO coupling REDUCED in
   TLE — a BETWEEN-group comparison. Both hold here: corrupted spindles carry higher consistency
   than their neighbours, while the disease lowers the baseline enough that the patient mean still
   falls below control.
   ===================================================================== */

const C = require("./cortex.js");
const H = require("./hippocampus.js");
const L = require("./loop.js");
const KC = require("./consolidate.js");

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function defaults() {
  return {
    nightMin: 60,
    fSO: 0.9,                 // Hz — slow oscillation
    spindleP: 0.18,           // P(physiological spindle rides an up-state) → 5.2/min in health.
                              // Re-anchored from 0.10 when the generator became depletable: with
                              // `res` averaging <1 even in health, the old value gave 3.4/min. This
                              // is an anchor to the healthy human spindle rate, not a result.

    // ---- disease level, DISCHARGE-INDEPENDENT (constraint 6)
    spindleLoss: 0.0,         // fractional reduction in spindle GENERATION
    couplingLoss: 0.0,        // fractional reduction in baseline SO-coupling strength

    // ---- discharges
    iedRate: 0,               // per minute
    /* THE SPINDLE GENERATOR IS A SHARED, DEPLETABLE RESOURCE — and this is the correction that
       stage-48 forced. The first version treated physiological spindles and IED-induced spindles as
       two independent additive processes. That is not what the thalamocortical circuit does, and the
       model paid for it: spindle density rose with discharge rate at rho = +0.87, directly
       contradicting constraint 6, and inflating the density forced a larger fitted generation loss
       which in turn crushed the delivering rate to 0.25 of control against Schiller's 0.51.

       Three independent lines say the generator is shared and self-limiting:
         Ngo 2015     driving the circuit with repeated SO-locked clicks does NOT keep producing
                      spindles — phase-locked spindle activity fades rapidly within a train, and the
                      authors name spindle refractoriness as the protective mechanism. You cannot add
                      spindles by driving harder.
         Stoyell 2021 spindle rate is ANTICORRELATED with spike rate within a patient followed
                      longitudinally, "consistent with a competitively shared underlying
                      thalamocortical circuitry".
         Pan 2025     in a thalamocortical network model, once spike discharges become abundant they
                      inhibit spindle occurrence outright.

       So an IED does not add a spindle for free: it fires a generator that then cannot fire again
       until it recovers, consuming the opportunity a physiological spindle would have taken. The
       memory cost stops being stipulated ("induced spindles deliver nothing") and becomes
       DISPLACEMENT — the induced event spends the generator at a moment when no replay was
       scheduled, and the refractory blocks the spindle that would have carried some.

       This also changes what constraint 6 means. Bender's null is not evidence that discharges leave
       spindles alone; it is what a shared generator predicts, because induction (+) and depletion (-)
       cancel in the COUNT while the content is destroyed either way. Whether that cancellation is
       generic or knife-edge is a question for the sweep, not something to assert here. */
    resTau: 8.0,              // s — recovery time constant of the spindle generator
    resCost: 1.0,             // fraction of available generator resource spent per spindle event

    pInduce: 0.05,            // P(an IED induces a spindle where none was starting).
                              //
                              // MORPHOLOGICALLY NORMAL BUT FUNCTIONALLY EMPTY, and the distinction
                              // is the point. Sakovics measured induced spindles as identical to
                              // unrelated spindles in DURATION, AMPLITUDE and FREQUENCY —
                              // oscillatory properties, not content. An induced spindle occurs at a
                              // moment when no physiological spindle was starting, so the
                              // hippocampal replay that a spindle normally coordinates with was
                              // never scheduled. It is a normal-looking oscillation with nothing
                              // riding it.
                              // The first version of this model let induced spindles WRITE, and the
                              // consequence was absurd: at high discharge rates induction added
                              // more delivering spindles than corruption removed, so discharges
                              // IMPROVED consolidation. Counted in density, absent from delivery.
    pCorrupt: 0.85,           // P(an IED landing on an ONGOING spindle corrupts it)

    // ---- morphology, from Sakovics 2022 (constraint 4)
    durNormal: 0.85,          // s
    durCorruptAdd: 0.126,     // +126 ms
    ampNormal: 12.0,          // uV
    ampCorruptAdd: 3.4,       // +3.4 uV
    cPhys: 0.55,              // SO-coupling strength of a normal spindle
    cCorruptAdd: 0.18,        // corrupted spindles couple MORE tightly (Uehara, within-patient)

    // ---- what corruption costs
    corruptDelivers: 0.0,     // fraction of normal write a corrupted spindle achieves
    corruptConsumes: 1.0,     // does a corrupted spindle still RECRUIT (and waste) a ripple?

    /* THE RIPPLE BUDGET, and row 8 lives or dies on it.
       A corrupted spindle can only be WORSE than an absent one if the ripple it wasted was scarce.
       If replay events are abundant, wasting one costs nothing and corruption is merely neutral —
       identical to absence, and the hypothesis collapses into rate-reduction.
       So this is a parameter, not an assumption, and it is swept rather than chosen: `rippleBudget`
       is the number of replay events available per night for the tracked memory, as a multiple of
       the number a healthy night would use. Infinity = abundant. Values near 1 = limiting.
       Reporting that row 8 requires a limiting budget is a result about what the hypothesis NEEDS,
       and it is itself a testable claim about hippocampal replay. */
    rippleBudget: Infinity,

    tauHdays: 2.5,
    driveScale0: 1.7,
  };
}

function buildSubject(seed, order) {
  const cortex = C.create({ seed, nStim: Math.max(8, order.length) }); C.encode(cortex);
  const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
  L.encodeSequence(cortex, hpc, order);
  const M = { cortex, hpc, cons: KC.createConsolidation(cortex), order };
  const nT = Math.max(1, order.length - 1);
  const sal = new Float64Array(nT + 1); let tot = 0;
  for (let k = 1; k <= nT; k++) {
    const u = (k - 1) / Math.max(1, nT - 1);
    sal[k] = 0.35 + Math.exp(-u / 0.25) + Math.exp(-(1 - u) / 0.18);
    tot += sal[k];
  }
  const cum = new Float64Array(nT + 1); let run = 0;
  for (let k = 1; k <= nT; k++) { run += sal[k] / tot; cum[k] = run; }
  M.sampleItem = rnd => { const r = rnd(); for (let k = 1; k <= nT; k++) if (r <= cum[k]) return k; return nT; };
  M.nItems = nT;
  return M;
}
function resetCortical(M) { for (const w of M.cons.wt) w.fill(0); M.cons.events = 0; }

/* ---------------------------------------------------------------------
   ONE NIGHT.

   Independent random streams for the discharge process, the spindle process and item selection, so
   that changing a discharge parameter cannot perturb the physiological spindle schedule. A shared
   stream produced a false negative earlier in this project and the lesson is cheap to keep.
   --------------------------------------------------------------------- */
function runNight(M, opts) {
  const P = Object.assign(defaults(), M.cal || {}, opts || {});
  const s0 = (opts && opts.nightSeed) || 20260731;
  const rIED = mulberry32(s0), rSpin = mulberry32((s0 * 2654435761) | 0),
        rItem = mulberry32((s0 * 1597334677) | 0);
  const nCycles = Math.floor(P.nightMin * 60 * P.fSO);
  const iedPerCycle = (P.iedRate / 60) / P.fSO;
  const spP = P.spindleP * (1 - P.spindleLoss);

  let normal = 0, corrupted = 0, induced = 0, writes = 0, wastedRipples = 0, iedTotal = 0;
  // budget expressed relative to what a healthy night consumes: spindleP x nCycles
  let budget = P.rippleBudget === Infinity ? Infinity
             : P.rippleBudget * P.spindleP * nCycles;
  let starved = 0;
  let durSum = 0, ampSum = 0, cSum = 0;
  const cBase = P.cPhys * (1 - P.couplingLoss);

  // shared generator: `res` is availability in [0,1], spent by any spindle, recovering with resTau
  const dtCycle = 1 / P.fSO;
  const recover = 1 - Math.exp(-dtCycle / Math.max(1e-6, P.resTau));
  let res = 1;

  for (let i = 0; i < nCycles; i++) {
    res += (1 - res) * recover;

    let nIED = 0, Lp = Math.exp(-iedPerCycle), p = 1;
    do { p *= rIED(); nIED++; } while (p > Lp);
    nIED -= 1;
    iedTotal += nIED;

    // a physiological spindle needs both the drive AND an available generator
    const spindleStarts = rSpin() < spP * res;

    if (spindleStarts) {
      // does a discharge land on this ongoing spindle and deform it?
      let hit = false;
      for (let k = 0; k < nIED; k++) if (rIED() < P.pCorrupt) { hit = true; break; }
      if (hit) {
        corrupted++;
        res *= (1 - P.resCost);
        durSum += P.durNormal + P.durCorruptAdd;
        ampSum += P.ampNormal + P.ampCorruptAdd;
        cSum += cBase + P.cCorruptAdd;
        // the corrupted spindle still recruits a ripple, and wastes it — drawing on the same
        // finite pool the delivering spindles need
        if (P.corruptConsumes > 0 && rSpin() < P.corruptConsumes) {
          if (budget > 0) { budget--; wastedRipples++; }
        }
        if (P.corruptDelivers > 0) {
          const k = M.sampleItem(rItem);
          const lrSave = M.cons.lrCC; M.cons.lrCC = lrSave * P.corruptDelivers;
          KC.writeTransition(M.cons, new Set(M.hpc.indices[M.order[k - 1]].cortex),
                             M.hpc.indices[M.order[k]].cortex);
          M.cons.lrCC = lrSave; writes += P.corruptDelivers;
        }
        continue;
      }
      normal++;
      res *= (1 - P.resCost);
      durSum += P.durNormal; ampSum += P.ampNormal; cSum += cBase;
      if (budget <= 0) { starved++; continue; }   // no replay left to ride this spindle
      budget--;
      const k = M.sampleItem(rItem);
      KC.writeTransition(M.cons, new Set(M.hpc.indices[M.order[k - 1]].cortex),
                         M.hpc.indices[M.order[k]].cortex);
      writes++; M.cons.events++;
      continue;
    }

    // No physiological spindle this cycle. A discharge may still fire the generator — but it fires
    // THE SAME generator, scaled by what is available, and spends it. That is the whole correction:
    // induction competes with physiological spindles rather than adding to them.
    let ind = false;
    for (let k = 0; k < nIED; k++) if (rIED() < P.pInduce * res) { ind = true; break; }
    if (ind) {
      // morphologically normal (constraint 5) and counted by a detector, but it carries nothing —
      // there was no replay scheduled for this moment — and the resource it spends is no longer
      // available to the physiological spindle that would have carried some.
      induced++;
      res *= (1 - P.resCost);
      durSum += P.durNormal; ampSum += P.ampNormal; cSum += cBase;
    }
  }

  const minutes = P.nightMin;
  const detected = normal + corrupted + induced;
  return {
    nCycles, normal, corrupted, induced, writes, wastedRipples, starved,
    spindleDensity: detected / minutes,
    // spindles that actually DELIVER replay. Induced spindles are excluded: they are counted by a
    // detector and contribute to `spindleDensity`, but carry nothing. Keeping them in this metric
    // contradicted the mechanism and made the matched comparison below impossible to satisfy.
    coupledRate: normal / minutes,
    couplingStrength: detected ? cSum / detected : 0,
    meanDuration: detected ? durSum / detected : 0,
    meanAmplitude: detected ? ampSum / detected : 0,
    coincidenceFraction: detected ? corrupted / detected : 0,
    iedRatePerMin: iedTotal / minutes,
  };
}

/* retrieval: two redundant routes, graded read-out (both carried over from the validated model) */
const pRecall = (frac, thr, temp) =>
  1 / (1 + Math.exp(-(frac - (thr == null ? 0.40 : thr)) / (temp == null ? 0.09 : temp)));
const hippoSupport = (d, P) => Math.exp(-d / Math.max(1e-6, P.tauHdays * (P.tauHscale == null ? 1 : P.tauHscale)));

function hippoRoute(M, support, P) {
  const order = M.order, prob = new Float64Array(order.length); prob[0] = 1;
  const scale = P.driveScale0 * support * (P.driveMul == null ? 1 : P.driveMul);
  if (scale < 0.02) return prob;
  for (let k = 1; k < order.length; k++) {
    const target = new Set(M.hpc.indices[order[k]].cortex);
    const act = L.reinstateFromIndex(M.cortex, M.hpc, order[k], { driveScale: scale });
    let on = 0; for (const c of act) if (target.has(c)) on++;
    prob[k] = pRecall(on / Math.max(1, target.size), P.retThr, P.retTemp);
  }
  return prob;
}
function cortexRoute(M, P) {
  P = P || {};
  const order = M.order, prob = new Float64Array(order.length); prob[0] = 1;
  const adapt = new Float64Array(M.cortex.N);
  for (let k = 1; k < order.length; k++) {
    const cue = M.hpc.indices[order[k - 1]].cortex, target = new Set(M.hpc.indices[order[k]].cortex);
    const src = new Float64Array(M.cortex.N); for (const c of cue) src[c] = 1.0;
    M.cortex.a.fill(0); M.cortex.inh = 0;
    for (let s = 0; s < 10; s++) KC.cortexSettle(M.cortex, M.cons, src, adapt, 9.0);
    let on = 0; for (const c of target) if (M.cortex.a[c] > M.cortex.P.actThr) on++;
    prob[k] = pRecall(on / Math.max(1, target.size), P.retThr, P.retTemp);
  }
  return prob;
}
function recallAtDelay(M, delayDays, opts) {
  const P = Object.assign(defaults(), M.cal || {}, opts || {});
  const sup = hippoSupport(delayDays, P);
  M._hc = M._hc || new Map();
  const key = [sup.toFixed(6), P.driveScale0, P.driveMul == null ? 1 : P.driveMul].join("|");
  if (!M._hc.has(key)) M._hc.set(key, hippoRoute(M, sup, P));
  const h = M._hc.get(key), c = cortexRoute(M, P);
  let both = 0;
  for (let k = 0; k < M.order.length; k++) both += 1 - (1 - h[k]) * (1 - c[k]);
  return { recall: both / M.order.length };
}

/* calibrate the per-replay increment so a healthy night reaches normal one-week retention */
function calibrate(M, opts) {
  const P = Object.assign(defaults(), opts || {});
  const target = P.healthyWeekRetention == null ? 0.85 : P.healthyWeekRetention;
  let lo = 1e-5, hi = 0.2, best = M.cons.lrCC;
  for (let it = 0; it < 18; it++) {
    const mid = Math.sqrt(lo * hi);
    M.cons.lrCC = mid; resetCortical(M);
    runNight(M, Object.assign({}, opts, { iedRate: 0, spindleLoss: 0, couplingLoss: 0 }));
    const cp = cortexRoute(M, P); let sc = 0; for (const v of cp) sc += v;
    if (sc / M.order.length < target) lo = mid; else hi = mid;
    best = mid;
  }
  M.cons.lrCC = best; M.cal = { lrCC: best };
  resetCortical(M);
  runNight(M, Object.assign({}, opts, { iedRate: 0, spindleLoss: 0, couplingLoss: 0 }));
  const cp = cortexRoute(M, P); let sc = 0; for (const v of cp) sc += v;
  const achieved = sc / M.order.length;
  resetCortical(M);
  if (Math.abs(achieved - target) > 0.12)
    throw new Error("calibration not in effect: " + achieved.toFixed(3) + " vs " + target);
  return { lrCC: best, achieved };
}

module.exports = { defaults, buildSubject, resetCortical, runNight, recallAtDelay,
  calibrate, cortexRoute, hippoRoute, mulberry32 };
