"use strict";
/* =====================================================================
   ACCELERATED LONG-TERM FORGETTING AS HIJACKED CONSOLIDATION.

   THE CLINICAL PHENOMENON. Normal memory 30–60 min after learning, then abnormally steep loss over
   hours to weeks. Standard neuropsychology tests at 30 min and reports these patients as NORMAL.
   Described in transient epileptic amnesia and temporal lobe epilepsy. A 2020 review of 51 group
   studies (Mameniškienė et al.) calls it "likely a disorder of late memory consolidation", reports
   "contradictory associations" with epileptiform activity, and states the cellular mechanism is
   unknown.

   THE MECHANISM, AND IT IS NOT WHAT IT LOOKS LIKE. Gelinas et al. (Nat Med 2016) showed interictal
   epileptiform discharges (IEDs) are precisely coordinated with prefrontal spindles, surpassing
   physiological ripple–spindle coupling, with decreased ripple occurrence. Uehara et al. (Clin
   Neurophysiol Pract, April 2026) went further in ten TLE patients: hippocampal IEDs INDUCED
   frontal spindles, INCREASED slow-oscillation incidence, and produced spindle–SO coupling with
   HIGHER phase consistency than uncoupled spindles.

   So IEDs do not degrade the consolidation machinery. They drive it HARDER than physiology does.
   The channel is not blocked — it is fired with the wrong payload.

       An IED-driven coupling event is STRUCTURALLY INTACT and SEMANTICALLY EMPTY.

   WHAT THAT PREDICTS, and it is the reason to build this. Because IED burden raises spindle density
   and raises coupling strength while lowering retention, the standard consolidation biomarkers do
   not merely fail in epilepsy — they point the WRONG WAY. The valid quantity is the FRACTION of
   coupling events that carry replay, not the strength of the coupling.

   WHAT IS ASSUMED AND WHAT IS DERIVED — stated because stage 41 was retracted for confusing them.
     ASSUMED (taken from data, not derived): that IED-coupled spindles have higher phase
       consistency than physiological ones (Uehara 2026), and that a hippocampal trace decays over
       days while a cortical one accrues. Two-store systems consolidation is the standard model.
     DERIVED: the SIZE of the deficit at each delay; that the same insult is undetectable at 30 min
       and severe at a week; that IED RATE is a poor predictor while CAPTURED FRACTION is a good
       one; and where the biomarker inversion sits quantitatively.

   THE CONTROL THAT CAN KILL IT (pre-specified, and it is the control stage 41 lacked): hold IED
   RATE exactly constant and vary only whether IEDs COUPLE to the consolidation channel. If matched
   rate with no coupling also produces forgetting, this is a rate story and the hypothesis is dead.
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

function adefaults() {
  return {
    // ---- the night
    nightMin: 60,        // minutes of NREM simulated
    fSO: 0.9,            // Hz — slow oscillation
    spindleP: 0.10,      // P(a physiological spindle rides a given up-state). NOT every up-state
                         // carries one: human NREM spindle density is ~2–6/min, while the slow
                         // oscillation runs near 0.9 Hz (~54/min). An earlier version treated every
                         // up-state as a coupling event and reported a healthy density of 54/min,
                         // an order of magnitude above anything measured. 0.9 Hz x 0.10 = 5.4/min,
                         // which is inside the reported range and makes the density numbers below
                         // comparable with a real sleep study.
    // ---- the pathology
    iedRate: 0,          // IEDs per minute (clinical range in TLE is broad: ~0–60/min)
    coupling: 1.0,       // P(an IED arriving near a slot CAPTURES it). THE mechanism parameter.
    // ---- what a coupling event looks like on scalp EEG, taken from Uehara 2026
    cPhys: 0.55,         // SO–spindle phase consistency of a physiological coupling event
    cIED: 0.82,          // ...of an IED-induced one. HIGHER — this is the measured finding.
    iedSpindleP: 0.15,   // P(an IED induces a frontal spindle), against a physiological baseline of
                         // spindleP = 0.10 — so a discharge raises spindle probability by about
                         // half, which is what "spindle occurrence increased 0.4–0.8 s after IEDs"
                         // (Uehara 2026) supports. An earlier version used 0.85, i.e. nearly every
                         // discharge spawning a spindle, which produced a healthy-vs-epilepsy
                         // density ratio of 5x that no sleep study reports. The elevation is real
                         // but modest, and the "runs hot" claim has to survive at the modest value
                         // or it is not a claim about patients.
    // ---- retrieval
    tauHdays: 3.0,       // hippocampal trace time constant (days)
    driveScale0: 0.45,   // intact hippocampus→cortex reinstatement drive (loop.js default)
  };
}

/* Build one subject. Cached by the caller; weights are zeroed between conditions so that every
   condition runs on identical anatomy — a paired design. */
function buildSubject(seed, order) {
  const cortex = C.create({ seed, nStim: Math.max(8, order.length) }); C.encode(cortex);
  const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
  L.encodeSequence(cortex, hpc, order);
  const M = { cortex, hpc, cons: KC.createConsolidation(cortex), order };

  /* ITEM SALIENCE — a serial-position curve, because that is what a word list actually produces.
     Items at the start and end of a list are encoded more strongly (primacy and recency) and are
     replayed more; middle items are the weak ones. This is the standard finding in list learning
     and it is what makes a list score graded rather than all-or-none. Salience sets both how often
     an item is replayed and, through that, how much cortical weight it accrues. */
  const nT = Math.max(1, order.length - 1);
  const sal = new Float64Array(nT + 1);
  let tot = 0;
  for (let k = 1; k <= nT; k++) {
    const u = (k - 1) / Math.max(1, nT - 1);                    // 0 at list start, 1 at list end
    const primacy = Math.exp(-u / 0.25), recency = Math.exp(-(1 - u) / 0.18);
    sal[k] = 0.35 + primacy + recency;
    tot += sal[k];
  }
  M.salience = sal; M.nItems = nT;
  const cum = new Float64Array(nT + 1);
  let run = 0;
  for (let k = 1; k <= nT; k++) { run += sal[k] / tot; cum[k] = run; }
  M.sampleItem = (rnd) => {                                     // sample ∝ salience
    const r = rnd();
    for (let k = 1; k <= nT; k++) if (r <= cum[k]) return k;
    return nT;
  };
  return M;
}
function resetCortical(M) {
  for (const w of M.cons.wt) w.fill(0);
  M.cons.events = 0;
}

/* ---------------------------------------------------------------------
   ONE NIGHT.

   Each slow-oscillation up-state is one COUPLING SLOT — an opportunity for a hippocampal ripple to
   ride a cortical spindle and write to cortex. IEDs arrive as a Poisson process. An IED landing in
   a slot captures it with probability `coupling`:

     captured  → an IED-induced spindle occurs, strongly SO-coupled, carrying NO replay. No write.
     free      → a physiological ripple replays the sequence and writes one transition to cortex.

   Note what is NOT assumed: captured slots are not "lost time". They produce MORE spindles and
   BETTER coupling than the physiological events they displace. That is the whole point.
   --------------------------------------------------------------------- */
function runNight(M, opts) {
  const P = Object.assign(adefaults(), opts || {});
  const rnd = mulberry32((opts && opts.nightSeed) || 20260730);
  const order = M.order;
  const seconds = P.nightMin * 60;
  const nCycles = Math.floor(seconds * P.fSO);
  const iedPerCycle = (P.iedRate / 60) / P.fSO;   // expected IEDs arriving per SO cycle

  let physio = 0, captured = 0, iedTotal = 0, iedSpindles = 0, writes = 0, suppressed = 0;
  let nSlots = 0;
  for (let s = 0; s < nCycles; s++) {
    // how many IEDs arrived in this cycle (Poisson, small-count sampling)
    let nIED = 0, Lp = Math.exp(-iedPerCycle), p = 1;
    do { p *= rnd(); nIED++; } while (p > Lp);
    nIED -= 1;
    iedTotal += nIED;

    let taken = false;
    for (let k = 0; k < nIED; k++) {
      if (rnd() < P.iedSpindleP) iedSpindles++;    // IEDs induce spindles whether or not they capture
      if (!taken && rnd() < P.coupling) taken = true;
    }

    // does a physiological spindle ride this up-state at all? Only then is there a coupling SLOT.
    if (rnd() >= P.spindleP) continue;
    nSlots++;
    if (taken) { captured++; continue; }           // structurally intact, semantically empty

    // A drug that dampens high-frequency bursting removes some physiological ripples too. The slot
    // stays free — nothing captured it — but no replay rides it, so nothing is written.
    if (P.physioSuppression && rnd() < P.physioSuppression) { suppressed++; continue; }

    // Physiological event: replay reinstates ONE item and writes its transition.
    //
    // WHICH item is chosen STOCHASTICALLY, weighted by that item's salience — not round-robin.
    // This is not a convenience: replay is known to be biased by salience, novelty and reward
    // rather than uniformly scheduled, and the consequence matters for the phenomenon. Under
    // round-robin every item receives exactly the same number of replays, so the whole list
    // crosses the consolidation threshold together and a list can only ever score 0 or 1 — which
    // is what the first version of this model did, returning 1.00 everywhere. With salience-biased
    // sampling the replay counts are spread, so when the supply of replays falls the WEAKEST items
    // drop below threshold first and the list degrades gradually. Graded list loss is the
    // phenomenon being modelled, and it requires that items not be interchangeable.
    physio++;
    const k = M.sampleItem(rnd);
    const prevSet = new Set(M.hpc.indices[order[k - 1]].cortex);
    KC.writeTransition(M.cons, prevSet, M.hpc.indices[order[k]].cortex);
    writes++;
    M.cons.events++;
  }

  // ---- what a sleep study would actually measure
  const minutes = P.nightMin;
  const nSpindles = physio + iedSpindles;
  const spindleDensity = nSpindles / minutes;
  // mean SO–spindle coupling strength over ALL detected spindles — the standard scalp biomarker
  const couplingStrength = nSpindles > 0
    ? (physio * P.cPhys + iedSpindles * P.cIED) / nSpindles : 0;
  // the quantity this model says actually matters, and which scalp EEG does not currently report
  const replayFraction = nSlots > 0 ? physio / nSlots : 0;

  return { nSlots, physio, captured, suppressed, iedTotal, iedSpindles, writes,
           spindleDensity, couplingStrength, replayFraction,
           iedRatePerMin: iedTotal / minutes };
}

/* ---------------------------------------------------------------------
   RETRIEVAL AT A DELAY, THROUGH TWO REDUNDANT ROUTES.

   A memory is recalled if EITHER route delivers it:
     • the HIPPOCAMPAL route — CA3 walks the encoded sequence and reinstates each cortical
       assembly. Its efficacy decays with delay as exp(-t/tauH): the trace fades.
     • the CORTICAL route — the cortico-cortical weights laid down during the night walk the
       sequence unaided. Its efficacy is whatever consolidation managed to write.

   The crossover is therefore NOT imposed. At 30 min the hippocampal route is near-intact and
   carries the recall regardless of what the cortex holds, so groups look identical. At a week it
   has faded and recall is whatever was consolidated. Whether that produces a clinically
   recognisable ALF pattern, and at what delay, is what the simulation is for.
   --------------------------------------------------------------------- */
function hippocampalSupport(delayDays, P) { return Math.exp(-delayDays / P.tauHdays); }

/* items of the sequence recoverable via the hippocampus at a given support level */
function hippoRoute(M, support, P) {
  const order = M.order, got = new Set([0]);
  // driveMul < 1 represents hippocampal sclerosis or entorhinal tau: the index survives but drives
  // cortex less effectively, so the early (hippocampus-dependent) route is itself degraded
  const scale = P.driveScale0 * support * (P.driveMul == null ? 1 : P.driveMul);
  if (scale < 0.02) return got;                     // trace effectively gone
  for (let k = 1; k < order.length; k++) {
    const target = new Set(M.hpc.indices[order[k]].cortex);
    const act = L.reinstateFromIndex(M.cortex, M.hpc, order[k], { driveScale: scale });
    let on = 0; for (const c of act) if (target.has(c)) on++;
    // reinstatement counts only if the CORRECT assembly is substantially recovered
    if (on / Math.max(1, target.size) > 0.40) got.add(k);
  }
  return got;
}
/* Items recoverable from cortex alone, tested ONE ASSOCIATION AT A TIME.
 *
 * The first version of this walked the sequence with corticalRecall and scored its length. That is
 * an all-or-none cascade — halving every weight still returned a perfect walk, so every condition
 * scored 1.00 and the model looked dead. It also does not match the experiment: an ALF paradigm
 * gives a word LIST and counts how many items survive, it does not require a chain.
 *
 * So each association k-1 → k is probed independently: clamp the cue assembly, let the cortex
 * settle under the consolidated weights alone, and ask whether the target assembly came back. The
 * score is the fraction of the list retained, which is graded, is what the clinic measures, and
 * lets partially-consolidated lists show partial loss. */
function cortexRoute(M) {
  const order = M.order, got = new Set([0]);
  const gWTA = 9.0, settleMs = 10, adapt = new Float64Array(M.cortex.N);
  for (let k = 1; k < order.length; k++) {
    const cue = M.hpc.indices[order[k - 1]].cortex;
    const target = new Set(M.hpc.indices[order[k]].cortex);
    const src = new Float64Array(M.cortex.N);
    for (const c of cue) src[c] = 1.0;
    M.cortex.a.fill(0); M.cortex.inh = 0;
    for (let s = 0; s < settleMs; s++) KC.cortexSettle(M.cortex, M.cons, src, adapt, gWTA);
    let on = 0;
    for (const c of target) if (M.cortex.a[c] > M.cortex.P.actThr) on++;
    if (on / Math.max(1, target.size) > 0.40) got.add(k);
  }
  return got;
}

/* Recall score at a delay: fraction of the list recovered by EITHER route.
 *
 * The hippocampal route is cached per subject per delay. It depends only on the surviving
 * hippocampal trace and on the encoded index — consolidation does not touch it — so it is identical
 * across every IED condition for a given subject, and recomputing it per condition is pure waste.
 * Caching it also guarantees the conditions are compared against an identical hippocampal route,
 * which is what makes the comparison paired. */
function recallAtDelay(M, delayDays, opts) {
  const P = Object.assign(adefaults(), opts || {});
  const sup = hippocampalSupport(delayDays, P);
  M._hcache = M._hcache || new Map();
  const key = sup.toFixed(6);
  if (!M._hcache.has(key)) M._hcache.set(key, hippoRoute(M, sup, P));
  const h = M._hcache.get(key);
  const c = cortexRoute(M);
  const union = new Set([...h, ...c]);
  return { recall: union.size / M.order.length,
           hippo: h.size / M.order.length,
           cortex: c.size / M.order.length,
           support: sup };
}

/* ---------------------------------------------------------------------
   DOSE CALIBRATION, done ONCE on the HEALTHY night and then frozen.

   The per-replay weight increment `lrCC` sets how many replay events a transition needs before its
   cortical weight saturates. Left at the stage-4 default a single 60-minute night delivers ~650
   replays per transition against a 40-replay ceiling, so EVERY condition saturates and no
   manipulation can show anything — the first run of this model returned recall 1.00 everywhere.

   So lrCC is set such that a healthy night's replays bring a transition to its ceiling using
   `targetFraction` of them, leaving the rest as reserve. Calibrated on the IED-FREE condition only
   and held fixed for every pathological condition, exactly as stage 42 calibrated its threshold —
   if it were re-calibrated per condition it would absorb the pathology and hide it.

   `targetFraction` is declared in advance and is a statement about physiological reserve: at 0.6,
   a healthy sleeper consolidates fully using 60% of the night's coupling slots. That is the one
   free parameter of the dose and it is stated rather than tuned.
   --------------------------------------------------------------------- */
function calibrateLearningRate(M, opts) {
  const P = Object.assign(adefaults(), opts || {});
  /* CALIBRATED AGAINST NORMAL HUMAN PERFORMANCE, not against a convenient number. A healthy adult
     does not retain a 15-word list perfectly for a week — delayed recall around 0.85 of the list is
     ordinary. So lrCC is set so the IED-FREE night lands there. That matters for the science as
     well as the arithmetic: if health were modelled as perfect consolidation, the model would say
     healthy sleepers have unlimited reserve and no capture fraction could ever hurt them, which is
     both wrong and unfalsifiable. Health has reserve, but finite reserve.
     Bisection on lrCC; calibrated on the healthy condition only and frozen thereafter. */
  const target = P.healthyWeekRetention == null ? 0.85 : P.healthyWeekRetention;
  let lo = 1e-5, hi = 0.2, best = M.cons.lrCC;
  for (let it = 0; it < 18; it++) {
    const mid = Math.sqrt(lo * hi);
    M.cons.lrCC = mid;
    resetCortical(M);
    runNight(M, Object.assign({}, opts, { iedRate: 0 }));
    const r = cortexRoute(M).size / M.order.length;   // cortical route only — the hippocampal
    if (r < target) lo = mid; else hi = mid;          // route is unaffected by consolidation
    best = mid;
  }
  M.cons.lrCC = best;
  resetCortical(M);
  runNight(M, Object.assign({}, opts, { iedRate: 0 }));
  const achieved = cortexRoute(M).size / M.order.length;
  resetCortical(M);
  return { lrCC: best, achieved };
}

/* =====================================================================
   TWO DISEASES THAT SHARE A FINAL COMMON PATH.

   Both temporal lobe epilepsy and Alzheimer's disease produce accelerated forgetting, and both do
   it partly through interictal discharges — subclinical epileptiform activity is present in a
   substantial minority of AD patients (Vossel; Palop & Mucke), which is the shared node. But they
   arrive there by different routes, and the model says the routes are distinguishable at the
   bedside. Each disease is expressed through parameters that already exist, not through new ones.

   TEMPORAL LOBE EPILEPSY — a CAPTURE disorder.
     • high IED rate with high coupling: the channel is hijacked
     • hippocampal sclerosis, when present, additionally weakens the hippocampal route (shorter
       tauH, reduced reinstatement drive). Transient epileptic amnesia sits at the mild end —
       discharges without much structural damage — which is exactly why TEA presents as PURE ALF
       with a normal 30-minute test, while TLE with sclerosis presents as ordinary amnesia.
     • slot SUPPLY is normal: these patients sleep.

   ALZHEIMER'S DISEASE — a SUPPLY-AND-CAPACITY disorder that also has capture.
     • sleep fragmentation reduces slow-oscillation up-states, so there are FEWER slots to begin
       with (reduced effective night)
     • synaptic and cortical loss reduces how much any one transition can hold (lower wCCmax)
     • entorhinal/hippocampal tau shortens the hippocampal trace (shorter tauH)
     • plus subclinical epileptiform capture, at a lower rate than epilepsy

   THE DISCRIMINATING PREDICTION. Both give ALF, but the sleep study differs: epilepsy keeps or
   raises spindle density while AD lowers it, and only AD shows the reduced slot supply. So spindle
   density separates the two mechanisms even though the behavioural phenotype is shared.
   ===================================================================== */
function diseaseProfile(name, severity) {
  const s = severity == null ? 1.0 : severity;
  switch (name) {
    case "healthy":
      return { iedRate: 0, coupling: 0, nightMin: 60, tauHdays: 3.0, wCCscale: 1.0, driveMul: 1.0 };
    case "TEA":                 // transient epileptic amnesia: discharges, little structural damage
      return { iedRate: 25 * s, coupling: 0.9, nightMin: 60, tauHdays: 3.0,
               wCCscale: 1.0, driveMul: 1.0 };
    case "TLE-HS":              // temporal lobe epilepsy with hippocampal sclerosis
      return { iedRate: 40 * s, coupling: 0.9, nightMin: 60, tauHdays: 3.0 - 1.4 * s,
               wCCscale: 1.0, driveMul: 1 - 0.45 * s };
    case "AD":                  // Alzheimer's: fewer slots, weaker slots, less capacity, some capture
      // Reduced spindle density is one of the better-replicated sleep findings in AD, and it is a
      // deficit in GENERATING physiological coupling events rather than in having them stolen. It
      // is therefore the same variable the drug acts on at high dose (physioSuppression), which is
      // the point: AD's channel is UNDERSUPPLIED where epilepsy's is HIJACKED, and a drug that
      // frees the channel cannot help a channel that was never occupied.
      return { iedRate: 12 * s, coupling: 0.7, nightMin: 60 * (1 - 0.40 * s),
               physioSuppression: 0.30 * s,
               tauHdays: 3.0 - 1.6 * s, wCCscale: 1 - 0.35 * s, driveMul: 1 - 0.30 * s };
    default: throw new Error("unknown disease " + name);
  }
}

/* apply a profile to a subject for one condition. wCCmax is restored by the caller via
   resetCortical + reapply, so profiles never leak between conditions. */
function applyProfile(M, prof, baseWCCmax) {
  M.cons.wCCmax = baseWCCmax * prof.wCCscale;
}

/* Levetiracetam, modelled by its mechanism rather than as a generic "improvement".
 *
 * LEV acts at SV2A and preferentially dampens HIGH-FREQUENCY BURST firing, which is what makes it
 * an antiepileptic that is relatively gentle on normal transmission. But sharp-wave ripples ARE
 * high-frequency bursts. So the same action that suppresses discharges must, at sufficient dose,
 * suppress physiological ripples too — and physiological ripples are the vehicle consolidation
 * rides on.
 *
 * That predicts an INVERTED U in dose, with no extra assumption: low dose removes capture and
 * memory improves; high dose starts removing the replay itself and memory falls again. This is the
 * unexplained feature of Bakker et al. (2015), where 62.5 and 125 mg BID improved memory in
 * amnestic MCI and 250 mg did not. `selectivity` is how much more sensitive discharges are than
 * physiological ripples; it is the one quantity this account rests on and it is falsifiable. */
function levetiracetam(prof, dose, opts) {
  const o = opts || {};
  const selectivity = o.selectivity == null ? 3.0 : o.selectivity;
  const kIED = o.kIED == null ? 1.6 : o.kIED;          // per unit dose
  const suppIED = 1 - Math.min(0.97, kIED * dose);
  const suppPhys = 1 - Math.min(0.97, (kIED / selectivity) * dose);
  // the drug's suppression COMPOUNDS with any the disease already imposes — a survival product,
  // not a replacement. Overwriting it would silently cure AD's reduced spindle generation.
  const intrinsic = prof.physioSuppression || 0;
  return Object.assign({}, prof, {
    iedRate: prof.iedRate * suppIED,
    physioSuppression: 1 - (1 - intrinsic) * suppPhys,
  });
}

module.exports = { adefaults, buildSubject, resetCortical, runNight, calibrateLearningRate,
  recallAtDelay, hippocampalSupport, hippoRoute, cortexRoute, mulberry32,
  diseaseProfile, applyProfile, levetiracetam };
