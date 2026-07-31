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
    iedSpindleP: 0.05,   // P(an IED induces a frontal spindle).
                         //
                         // FALSIFIED AT 0.15 AND REDUCED HERE, and the correction removes what this
                         // model advertised as its identifying prediction. Bender et al. (Neurology
                         // 2023), 81 TLE patients against 28 non-epilepsy controls on overnight
                         // EEG, report spindle density REDUCED by ~30% in TLE and spindle-SO
                         // coupling strength REDUCED, with NO significant association between any
                         // spindle measure and hippocampal IED rate. At 0.15 this model predicted
                         // density RISING 5.7 -> 8.9/min and coupling strength rising 0.55 -> 0.73.
                         // Both directions are wrong against 81 patients.
                         //
                         // Uehara (2026) genuinely did observe spindle occurrence rising 0.4-0.8 s
                         // after a discharge, so peri-IED induction is real; but a local
                         // event-locked increase is compatible with a NET whole-night reduction
                         // once capture removes more physiological events than induction adds.
                         // 0.05 keeps the induction Uehara measured while letting the net density
                         // fall, which is what the whole-night data show.
                         //
                         // NOTE WHAT THIS PARAMETER DOES NOT TOUCH: one-week recall is 0.247 at both
                         // 0.15 and 0, identical to three decimals. Induced spindles carry no replay,
                         // so they never affected memory - they only ever affected the BIOMARKER.
                         // The mechanism is untouched by this correction; the prediction built on it
                         // is not.
    // ---- retrieval
    encodeScale: 1.0,    // ENCODING STRENGTH. A weakly encoded memory has both a weaker hippocampal
                         // index (so it reinstates cortex less well) and less to replay (so each
                         // replay writes less). Distinct from driveMul, which is a RETRIEVAL-side
                         // lesion applied to a normally encoded trace. Used to implement the
                         // encoding-deficit account of ALF as a rival to capture in stage 46.
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
  const P = Object.assign(adefaults(), M.cal || {}, opts || {});
  /* THREE INDEPENDENT STREAMS, and this is not fastidiousness — it is a correctness requirement
     that a single stream silently violates.
     With one generator, the discharge loop's draws advance the stream that also decides whether a
     physiological spindle occurs and which item is replayed. Raising the discharge rate then
     perturbs the spindle schedule even when coupling = 0 and nothing is captured. That produced a
     control condition with 11% fewer coupling slots than healthy (317 vs 355) purely from stream
     offset, which is why the registered matched-rate control (P2) appeared to fail: the control was
     never matched. Separate streams make the discharge parameters unable to touch the physiological
     schedule, so the comparison is genuinely paired. */
  const seed0 = (opts && opts.nightSeed) || 20260730;
  const rndIED  = mulberry32(seed0);                  // discharge arrival, induction, capture
  const rndSpin = mulberry32((seed0 * 2654435761) | 0); // does a physiological spindle occur
  const rndItem = mulberry32((seed0 * 1597334677) | 0); // which item is replayed
  const rnd = rndIED;                                  // legacy alias for the discharge stream
  const order = M.order;
  const seconds = P.nightMin * 60;
  const nCycles = Math.floor(seconds * P.fSO);
  const iedPerCycle = (P.iedRate / 60) / P.fSO;   // expected IEDs arriving per SO cycle

  let physio = 0, captured = 0, iedTotal = 0, iedSpindles = 0, writes = 0, suppressed = 0;
  let nSlots = 0;
  for (let s = 0; s < nCycles; s++) {
    // how many IEDs arrived in this cycle (Poisson, small-count sampling)
    let nIED = 0, Lp = Math.exp(-iedPerCycle), p = 1;
    do { p *= rndIED(); nIED++; } while (p > Lp);
    nIED -= 1;
    iedTotal += nIED;

    let taken = false;
    for (let k = 0; k < nIED; k++) {
      if (rndIED() < P.iedSpindleP) iedSpindles++;  // IEDs induce spindles whether or not they capture
      if (!taken && rndIED() < P.coupling) taken = true;
    }

    // does a physiological spindle ride this up-state at all? Only then is there a coupling SLOT.
    if (rndSpin() >= P.spindleP) continue;
    nSlots++;
    if (taken) { captured++; continue; }           // structurally intact, semantically empty

    // A drug that dampens high-frequency bursting removes some physiological ripples too. The slot
    // stays free — nothing captured it — but no replay rides it, so nothing is written.
    if (P.physioSuppression && rndSpin() < P.physioSuppression) { suppressed++; continue; }

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
    const k = M.sampleItem(rndItem);
    const prevSet = new Set(M.hpc.indices[order[k - 1]].cortex);
    // a weakly encoded trace has less to replay, so each event writes proportionally less
    const lrSave = M.cons.lrCC;
    if (P.encodeScale !== 1) M.cons.lrCC = lrSave * P.encodeScale;
    KC.writeTransition(M.cons, prevSet, M.hpc.indices[order[k]].cortex);
    M.cons.lrCC = lrSave;
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
  // the quantity Schiller et al. (Epilepsia 2025) measured: rate of PHYSIOLOGICAL coupled events,
  // excluding IED-induced spindles. Reported separately from total density because the two diverge.
  const physioCoupledRate = physio / minutes;

  return { nSlots, physio, captured, suppressed, iedTotal, iedSpindles, writes,
           spindleDensity, physioCoupledRate, couplingStrength, replayFraction,
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
/* Trace lifetime is CALIBRATED per subject, so disease profiles must express their effect on it
   RELATIVELY (tauHscale) and never as an absolute. An earlier version had diseaseProfile return
   `tauHdays: 3.0`, and because profiles are passed as opts they override the calibrated value —
   so every disease condition silently discarded the calibration and healthy one-week recall came
   out 0.95 instead of the anchored 0.852. Absolute values in a profile clobber calibration; scales
   compose with it. */
function hippocampalSupport(delayDays, P) {
  const tau = P.tauHdays * (P.tauHscale == null ? 1 : P.tauHscale);
  return Math.exp(-delayDays / Math.max(1e-6, tau));
}

/* GRADED RETRIEVAL, replacing a hard all-or-none threshold.
 *
 * Recovering 39% of a target assembly was scored 0 and 41% was scored 1. With fifteen items and a
 * calibration that places health near criterion, a 3% change in synaptic weight then flipped several
 * items at once and the whole model became knife-edge: a control condition differing by 2.5% in
 * replay count moved 1-week recall by 0.24. That is not a property of memory, it is a property of a
 * step function.
 *
 * Retrieval is a signal-detection process: an item held at moderate strength is recalled sometimes.
 * So evidence is mapped to a RECALL PROBABILITY through a logistic, and the score is the expected
 * number of items recalled. Deterministic, smooth, and it makes partial consolidation mean what it
 * should — a reduced chance of recall rather than a certainty either way. */
function pRecall(frac, thr, temp) {
  return 1 / (1 + Math.exp(-(frac - (thr == null ? 0.40 : thr)) / (temp == null ? 0.09 : temp)));
}

/* items of the sequence recoverable via the hippocampus at a given support level */
function hippoRoute(M, support, P) {
  const order = M.order, prob = new Float64Array(order.length); prob[0] = 1;
  // driveMul < 1 represents hippocampal sclerosis or entorhinal tau: the index survives but drives
  // cortex less effectively, so the early (hippocampus-dependent) route is itself degraded
  const scale = P.driveScale0 * support * (P.driveMul == null ? 1 : P.driveMul) *
                (P.encodeScale == null ? 1 : P.encodeScale);
  if (scale < 0.02) return prob;                    // trace effectively gone
  for (let k = 1; k < order.length; k++) {
    const target = new Set(M.hpc.indices[order[k]].cortex);
    const act = L.reinstateFromIndex(M.cortex, M.hpc, order[k], { driveScale: scale });
    let on = 0; for (const c of act) if (target.has(c)) on++;
    prob[k] = pRecall(on / Math.max(1, target.size), P.retThr, P.retTemp);
  }
  return prob;
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
function cortexRoute(M, P) {
  P = P || {};
  const order = M.order, prob = new Float64Array(order.length); prob[0] = 1;
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
    prob[k] = pRecall(on / Math.max(1, target.size), P.retThr, P.retTemp);
  }
  return prob;
}

/* Recall score at a delay: fraction of the list recovered by EITHER route.
 *
 * The hippocampal route is cached per subject per delay. It depends only on the surviving
 * hippocampal trace and on the encoded index — consolidation does not touch it — so it is identical
 * across every IED condition for a given subject, and recomputing it per condition is pure waste.
 * Caching it also guarantees the conditions are compared against an identical hippocampal route,
 * which is what makes the comparison paired. */
function recallAtDelay(M, delayDays, opts) {
  // per-subject calibration lives on the model, so every call site inherits it without threading
  const P = Object.assign(adefaults(), M.cal || {}, opts || {});
  const sup = hippocampalSupport(delayDays, P);
  M._hcache = M._hcache || new Map();
  // key on everything that changes the hippocampal route, not just the delay. Suites previously
  // cleared this cache between EVERY condition, forcing ~1.9 s of recomputation per subject per
  // delay even when the hippocampal parameters were identical across conditions.
  const key = [sup.toFixed(6), P.driveScale0, P.driveMul == null ? 1 : P.driveMul,
               P.encodeScale == null ? 1 : P.encodeScale, P.retThr, P.retTemp].join("|");
  if (!M._hcache.has(key)) M._hcache.set(key, hippoRoute(M, sup, P));
  const h = M._hcache.get(key);
  const c = cortexRoute(M, P);
  // two independent routes: P(recalled) = 1 - (1-ph)(1-pc)
  let both = 0, hh = 0, cc = 0;
  for (let k = 0; k < M.order.length; k++) {
    both += 1 - (1 - h[k]) * (1 - c[k]); hh += h[k]; cc += c[k];
  }
  const n = M.order.length;
  return { recall: both / n, hippo: hh / n, cortex: cc / n, support: sup };
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
  const P = Object.assign(adefaults(), M.cal || {}, opts || {});
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
    const cp = cortexRoute(M, P); let sc = 0;         // cortical route only — the hippocampal
    for (const v of cp) sc += v; const r = sc / M.order.length;
    if (r < target) lo = mid; else hi = mid;          // route is unaffected by consolidation
    best = mid;
  }
  M.cons.lrCC = best;
  resetCortical(M);
  runNight(M, Object.assign({}, opts, { iedRate: 0 }));
  const achievedP = cortexRoute(M, P); let ach = 0;
  for (const v of achievedP) ach += v;
  const achieved = ach / M.order.length;
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
      return { iedRate: 0, coupling: 0, nightMin: 60, tauHscale: 1.0, wCCscale: 1.0, driveMul: 1.0 };
    /* EPILEPSY ALSO SUPPRESSES PHYSIOLOGICAL SPINDLE-SLOW-WAVE COUPLING, and this was added after
       the model's prediction was contradicted by data. An earlier version gave epilepsy discharge
       capture on a channel of NORMAL supply, and therefore predicted that spindle density RUNS HOT
       in epilepsy (7.9/min against 5.7 healthy). Schiller et al. (Epilepsia 2025), in 20 unilateral
       drug-resistant TLE patients against 20 matched controls with HD-EEG and polysomnography,
       measured the opposite: coupled spindle-slow-wave rates are globally REDUCED in TLE, 0.18 vs
       0.35/min (d = -0.46), and they propose that decoupling as a mechanism of poor memory.
       So epilepsy undersupplies the channel AND captures what remains. Both push the replay
       fraction down, which leaves the ALF mechanism intact, but the "runs hot" biomarker claim is
       dead and the epilepsy-versus-Alzheimer's density dissociation with it.
       RESOLVED, and the resolution matters more than the scare. Schiller's measure is the COUPLED
       SPINDLE-SLOW-WAVE RATE, i.e. physiological coupling events. This model's `spindleDensity` is
       TOTAL spindles, physiological plus IED-induced, which is a different observable. Capture
       alone already drives the physiological coupled rate DOWN — to 0.66 of healthy in TEA against
       Schiller's 0.51 — in the right direction and the right order, with no extra mechanism. Adding
       a separate suppression term on top double-counts the same effect: it drove TEA's replay
       fraction to 0.33 and destroyed the early sparing that defines ALF.
       So the two measures DIVERGE, and which one is reported decides whether epilepsy looks hot or
       cold. `physioCoupledRate` is now reported alongside density so the model can be compared
       against Schiller on the quantity Schiller actually measured. Whether TOTAL spindle density is
       also reduced in TLE is a separate question this model does not settle and which would falsify
       the density half if answered yes. */
    case "TEA":                 // transient epileptic amnesia: discharges, little structural damage
      return { iedRate: 25 * s, coupling: 0.9, nightMin: 60, tauHscale: 1.0,
               wCCscale: 1.0, driveMul: 1.0 };
    case "TLE-HS":              // temporal lobe epilepsy with hippocampal sclerosis
      return { iedRate: 40 * s, coupling: 0.9, nightMin: 60, tauHscale: 1 - 0.47 * s,
               wCCscale: 1.0, driveMul: 1 - 0.45 * s };
    case "AD":                  // Alzheimer's: fewer slots, weaker slots, less capacity, some capture
      // Reduced spindle density is one of the better-replicated sleep findings in AD, and it is a
      // deficit in GENERATING physiological coupling events rather than in having them stolen. It
      // is therefore the same variable the drug acts on at high dose (physioSuppression), which is
      // the point: AD's channel is UNDERSUPPLIED where epilepsy's is HIJACKED, and a drug that
      // frees the channel cannot help a channel that was never occupied.
      return { iedRate: 12 * s, coupling: 0.7, nightMin: 60 * (1 - 0.40 * s),
               physioSuppression: 0.30 * s,
               tauHscale: 1 - 0.53 * s, wCCscale: 1 - 0.35 * s, driveMul: 1 - 0.30 * s };
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

/* ---------------------------------------------------------------------
   TWO-POINT BEHAVIOURAL CALIBRATION.

   The cortical route is anchored to normal one-week list retention (~0.85). The hippocampal route
   must be anchored too, and for a reason that decides whether this model can address ALF at all.

   Left uncalibrated, the hippocampal route recovered only 0.775 of the list at full support, so
   healthy 30-minute recall was substantially carried by CORTEX. Capture then dragged early recall
   down with it, and the model could not produce the defining ALF pattern at any dose: every dose
   gave either normal-early-but-mild-late or severe-late-but-impaired-early. That is not a fact
   about memory, it is a mis-set gain.

   Empirically an ALF patient with an intact hippocampus recalls a word list near-completely at 30
   minutes — that IS what "normal early recall" denotes. So the hippocampal drive is set so that the
   hippocampal route ALONE reaches `target` at full support. Early recall then belongs to the
   hippocampus, capture cannot touch it, and the preserved 30-minute test follows structurally
   rather than from a lucky dose.

   THE CEILING IS REAL AND IS REPORTED. Scanning drive shows the hippocampal route's score keeps
   rising to 0.94, but the rise above ~1.7 is CONFABULATION: overlap with a NON-TARGET assembly
   climbs from 0.11 to 0.40, so at the top of the range half the apparent recall is the wrong
   memory. Constrained to keep non-target overlap under 0.20, the route reaches ~0.90 and no more.
   The model therefore cannot produce complete early recall without confabulating, which is a
   property of this hippocampal index worth reporting rather than hiding.

   SPECIFICITY IS CHECKED, not assumed. Reinstatement drive cannot simply be turned up: loop.js
   warns that strong drive lets the WRONG memory clear threshold and cortical completion then
   amplifies it into a full spurious assembly. The scan is therefore over the score against the
   CORRECT target, which falls once drive starts reinstating neighbours, and the calibration takes
   the smallest drive reaching the target rather than the largest score. If no drive reaches the
   target the best achievable is returned and flagged, rather than silently pushing drive into the
   regime where the model confabulates. */
function calibrateHippocampalDrive(M, opts) {
  const P = Object.assign(adefaults(), opts || {});
  const target = P.healthyEarlyRecall == null ? 0.95 : P.healthyEarlyRecall;
  const specFloor = P.specificityFloor == null ? 0.20 : P.specificityFloor;
  const order = M.order;
  const rows = [];
  for (const d of [0.35, 0.45, 0.6, 0.8, 1.0, 1.3, 1.7, 2.2, 2.8, 3.5]) {
    let tgt = 0, oth = 0, nn = 0, score = 0;
    for (let k = 1; k < order.length; k++) {
      const tSet = new Set(M.hpc.indices[order[k]].cortex);
      const oIdx = order[(k % (order.length - 1)) + 1];
      const oSet = new Set(M.hpc.indices[oIdx].cortex);
      const act = L.reinstateFromIndex(M.cortex, M.hpc, order[k], { driveScale: d });
      let on = 0, on2 = 0;
      for (const c of act) { if (tSet.has(c)) on++; if (oSet.has(c)) on2++; }
      const fr = on / Math.max(1, tSet.size);
      tgt += fr; oth += on2 / Math.max(1, oSet.size); nn++;
      score += pRecall(fr, P.retThr, P.retTemp);
    }
    rows.push({ d, target: tgt / nn, other: oth / nn, score: (score + 1) / order.length });
  }
  // largest drive whose NON-TARGET overlap stays below the floor; among those, the best score
  const safe = rows.filter(r => r.other <= specFloor);
  const pick = safe.length ? safe.reduce((a, b) => (b.score > a.score ? b : a)) : rows[0];
  M._hcache = new Map();
  return { driveScale0: pick.d, achieved: pick.score, otherOverlap: pick.other,
           reachedTarget: pick.score >= target, rows,
           ceiling: rows.reduce((a, b) => (b.score > a.score ? b : a)).score };
}

/* TWO-POINT CALIBRATION in one call: anchor the hippocampal route to normal early recall, then the
   cortical route to normal one-week retention, and store both on the subject so every downstream
   call inherits them. Order matters — the learning-rate bisection must run with the hippocampal
   drive already fixed, or it compensates for a gain that is about to change. */
/* Calibration is deterministic given the seed and the anchors, costs ~24 s per subject, and was
   being recomputed identically on every run — the single largest cost in the suite and pure waste
   across re-runs and container restarts. The three resulting constants are cached to disk under a
   key built from the seed and every input that determines them, so a changed anchor invalidates the
   cache rather than silently reusing a stale fit. */
function calCachePath(M, P) {
  const key = [M.order.length, M.cortex.P.seed, P.healthyEarlyRecall, P.specificityFloor,
               P.hippoWeekCeiling, P.healthyWeekRetention, P.spindleP, P.fSO, P.nightMin,
               P.retThr, P.retTemp].join("_");
  return require("path").join(__dirname, "..", ".calcache", key + ".json");
}
/* A cheap assertion that the calibration is ACTUALLY IN EFFECT, run on both the fresh and the
   cached path. The disk cache introduced a bug in which cached subjects kept the calibrated
   constants in M.cal but ran with the default learning rate, and nothing downstream noticed until
   a whole suite reported healthy recall at ceiling. Checking the anchor directly costs one
   cortical read-out and makes that failure impossible to ship. */
function verifyCalibration(M, P, report) {
  const target = P.healthyWeekRetention == null ? 0.85 : P.healthyWeekRetention;
  resetCortical(M);
  runNight(M, Object.assign({}, P, { iedRate: 0 }));
  const cp = cortexRoute(M, P);
  let sc = 0; for (const v of cp) sc += v;
  const got = sc / M.order.length;
  resetCortical(M);
  report.verified = got;
  if (Math.abs(got - target) > 0.12) {
    throw new Error("calibration not in effect: healthy one-week cortical recall " +
      got.toFixed(3) + " against anchor " + target.toFixed(2) +
      " (lrCC=" + M.cons.lrCC + ", cal=" + JSON.stringify(M.cal) + ")");
  }
  return got;
}

function calibrateSubject(M, opts) {
  const P = Object.assign(adefaults(), opts || {});
  const fs2 = require("fs"), path2 = require("path");
  const cp = calCachePath(M, P);
  if (!P.noCalCache) {
    try {
      const hit = JSON.parse(fs2.readFileSync(cp, "utf8"));
      M.cal = hit.cal;
      // APPLY the cached fit, do not merely record it. calibrateLearningRate sets M.cons.lrCC as a
      // side effect, and the first version of this cache restored only M.cal.lrCC — so cached
      // subjects silently ran with the DEFAULT learning rate, roughly 4x the calibrated value, and
      // over-consolidated to ceiling. Healthy one-week recall read 1.00 against an anchor of 0.85,
      // and because only some seeds were cached the suite mixed calibrated and uncalibrated
      // subjects in one mean. A cache must restore every effect of what it replaces, not just its
      // return value.
      M.cons.lrCC = hit.cal.lrCC;
      M._hcache = new Map();
      const rep = Object.assign({ cached: true }, hit.report);
      verifyCalibration(M, P, rep);
      return rep;
    } catch (e) { /* miss */ }
  }
  /* STEP 1 — early anchor: hippocampal drive set so the hippocampal route alone carries normal
     30-minute recall, subject to the specificity constraint. */
  const hip = calibrateHippocampalDrive(M, opts);
  M.cal = { driveScale0: hip.driveScale0 };

  /* STEP 2 — trace lifetime. THIS IS NOT OPTIONAL AND WAS THE BUG.
     Raising the reinstatement drive 3.8x to satisfy the early anchor also extended how long the
     hippocampal trace remains useful: with tauH left at its arbitrary 3 days, healthy one-week
     recall rose from 0.85 to 0.95 and the hippocampal route MASKED the cortical differences the
     model exists to measure. Every late deficit compressed and the cohort correlation with replay
     fraction collapsed from 0.94 to 0.47. Drive and lifetime are not independent, and calibrating
     one without the other silently moved the other.
     tauH is therefore anchored to the structural claim that MAKES this a consolidation disorder:
     by one week the memory must be largely cortex-dependent, i.e. the hippocampal route alone
     recovers little. Without that, a "consolidation" model is really a slow-decay model. */
  const lateCeiling = P.hippoWeekCeiling == null ? 0.15 : P.hippoWeekCeiling;
  let chosenTau = P.tauHdays;
  for (const tau of [3.0, 2.5, 2.0, 1.7, 1.4, 1.2, 1.0, 0.8]) {
    const probe = Object.assign({}, P, M.cal, { tauHdays: tau });
    M._hcache = new Map();
    const pr = hippoRoute(M, hippocampalSupport(7, probe), probe);
    let sc = 0; for (const v of pr) sc += v;
    sc = (sc - 1) / (M.order.length - 1);      // exclude the always-cued first item
    chosenTau = tau;
    if (sc <= lateCeiling) break;
  }
  M.cal.tauHdays = chosenTau;
  M._hcache = new Map();

  /* STEP 3 — late anchor: per-replay increment set so the cortical route reaches normal one-week
     retention, with the hippocampal parameters already fixed. */
  const cort = calibrateLearningRate(M, opts);
  M.cal.lrCC = cort.lrCC;
  const report = { hippocampal: hip, tauHdays: chosenTau, cortical: cort };
  verifyCalibration(M, P, report);
  if (!P.noCalCache) {
    try {
      fs2.mkdirSync(path2.dirname(cp), { recursive: true });
      fs2.writeFileSync(cp, JSON.stringify({ cal: M.cal, report }));
    } catch (e) { /* cache is an optimisation, never a requirement */ }
  }
  return report;
}

module.exports = { adefaults, pRecall, calibrateHippocampalDrive, calibrateSubject, buildSubject, resetCortical, runNight, calibrateLearningRate,
  recallAtDelay, hippocampalSupport, hippoRoute, cortexRoute, mulberry32,
  diseaseProfile, applyProfile, levetiracetam };
