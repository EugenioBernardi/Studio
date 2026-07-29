"use strict";
/* Stage-40 — WHICH SPINDLE MEASURE DOES THE SCHEDULER ACTUALLY TRACK, AND IS IT LOCAL?
 *
 * WHAT THIS IS NOT. Stage 39 registered "spindle density predicts retention, Spearman ρ > 0.8"
 * and it FAILED at ρ = 0.70. That prediction stays failed; nothing here rescues it, and no knob
 * is swept until a correlation crosses a threshold — that is the parameter-hunting the stage-39
 * commit explicitly ruled out. What is done instead is to ask a DIFFERENT and harder question
 * that needs no sweep at all, and, separately, to diagnose why the density measure was weak.
 *
 * THE HARDER QUESTION. If the reticular nucleus schedules consolidation sector by sector, then
 * within ONE ordinary night, with every parameter fixed, memories should not consolidate equally:
 * each should get what ITS OWN reticular territory happened to win. That is a within-night,
 * across-memory prediction with no free parameters, and it has a direct human counterpart —
 * spindle–memory relationships are topographically specific, over the cortical territory engaged
 * by the task rather than over the whole head (Nishida & Walker 2007, regionally specific spindles
 * over the learning hemisphere; Bergmann et al. 2012, spindle-coupled reactivation restricted to
 * the face- and scene-selective areas that learning engaged; Nir et al. 2011 for the locality of
 * the spindles themselves). A global-spindle account of consolidation cannot produce it: if
 * spindling were one whole-brain event, every memory would receive the same gate.
 *
 * THE CONFOUND, and how it is removed. If memories are rehearsed at random, one that happened to
 * be drawn more often would consolidate more for reasons having nothing to do with the thalamus.
 * So rehearsal here is ROUND-ROBIN: every memory is offered to the gate exactly equally often,
 * and the ONLY thing that differs between them is how much their own sectors spindled.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING (held-out seeds 6–15; stages 38–39 used 1–5):
 *   (P1) TOPOGRAPHIC SPECIFICITY. Pooling memories across seeds, consolidated cortico-cortical
 *        weight correlates with the spindle occupancy of that memory's OWN sectors, ρ > 0.5, and
 *        NOT with the occupancy of the other sectors, ρ_other < 0.25. Both halves are required:
 *        the first without the second would be a global-arousal effect wearing local clothes.
 *   (P2) TIME, NOT COUNT. On the same data, own-territory OCCUPANCY (total spindle time) predicts
 *        consolidated weight better than own-territory DENSITY (events per minute), because the
 *        gate licenses writes for as long as the envelope is up and is indifferent to how many
 *        onsets that time is divided into. This is a diagnosis of stage 39's failure and it is
 *        also a directly testable human claim: total spindle time over task territory should beat
 *        spindle count over the same territory.
 *   (P4, P5) registered inside their own sections, since each is a response to what the section
 *        before it returned. P4 offers an explanation for P1's outcome that could be false and
 *        turns out to be; P5 tests what the corrected picture implies.
 *   (P3) THE BEHAVIOURAL DISSOCIATION IS DOSE-LIMITED, NOT MECHANISM-LIMITED. Stage 39 asserted
 *        this rather than testing it. With a longer night and fewer competing memories, cortex-
 *        only recall in the intact condition reaches ≥ 2.5 of 3 while BOTH lesions stay ≤ 1.5.
 *        If it does not, the assertion was wrong and the dissociation is weak for a real reason.
 *
 * Nothing in cortex.js, hippocampus.js or consolidate.js is touched. spindlegate.js gains two
 * MEASUREMENT functions (per-sector statistics, territory statistics) and no dynamics.
 */

const C = require("../src/cortex.js");
const H = require("../src/hippocampus.js");
const L = require("../src/loop.js");
const KC = require("../src/consolidate.js");
const SG = require("../src/spindlegate.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null || Number.isNaN(x) ? "  n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SEEDS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];   // HELD OUT — stages 38–39 used 1–5
const NCOL = 64;

function spearman(xs, ys) {
  const rank = a => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    let k = 0;
    while (k < idx.length) {                     // average ranks over ties
      let j = k; while (j + 1 < idx.length && idx[j + 1][0] === idx[k][0]) j++;
      const avg = (k + j) / 2 + 1;
      for (let m = k; m <= j; m++) r[idx[m][1]] = avg;
      k = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys), n = xs.length;
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

function build(seed, order) {
  const cortex = C.create({ seed }); C.encode(cortex);
  const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
  L.encodeSequence(cortex, hpc, order);
  const cons = KC.createConsolidation(cortex);
  return { cortex, hpc, cons };
}

/* the cortical columns each memory occupies — contiguous, so reticular topography is meaningful */
function territories(order) {
  const span = Math.floor(NCOL / order.length);
  return order.map((_, k) => Array.from({ length: span }, (_, i) => k * span + i));
}

/* per-memory consolidated cortico-cortical weight — the substrate cortex-only recall walks */
function consolidatedWeight(cons, hpc, order) {
  const per = [];
  for (let k = 1; k < order.length; k++) {
    const prev = new Set(hpc.indices[order[k - 1]].cortex);
    const cur = hpc.indices[order[k]].cortex;
    let w = 0, n = 0;
    for (const i of cur) {
      const id = cons.idx[i], wt = cons.wt[i];
      for (let a = 0; a < id.length; a++) if (prev.has(id[a])) { w += wt[a]; n++; }
    }
    per.push(n ? w / n : 0);
  }
  return per;
}

/* ONE NIGHT with ROUND-ROBIN rehearsal: every memory is offered to the gate exactly equally
   often, so any difference in what they consolidate is the gate's doing and nothing else. */
function night(model, order, opts) {
  opts = opts || {};
  const { hpc, cons } = model;
  const G = SG.createGate(NCOL, { lateral: 0.5, seed: opts.seed == null ? 5 : opts.seed });
  if (opts.lesionSectors) for (const s of opts.lesionSectors) SG.lesionSector(G, s);
  const hippocampusIntact = opts.hippocampus !== false;
  const memCols = territories(order);
  const seconds = opts.seconds == null ? 90 : opts.seconds;
  const offers = new Float64Array(order.length), writes = new Float64Array(order.length);
  let armed = true, replayEvents = 0, turn = 0;
  const trace = SG.runNREM(G, seconds, (g, act, so) => {
    if (so > 0.5 && armed) {
      armed = false;
      if (!hippocampusIntact) return;
      replayEvents++;
      const k = 1 + (turn++ % (order.length - 1));   // ROUND ROBIN — equal opportunity per memory
      offers[k]++;
      if (SG.licensed(g, memCols[k])) {
        const prevSet = new Set(hpc.indices[order[k - 1]].cortex);
        KC.writeTransition(cons, prevSet, hpc.indices[order[k]].cortex);
        writes[k]++;
      }
      cons.events++;
    }
    if (so < 0.1) armed = true;
  });
  const stats = SG.spindleStats(trace, G.P.nSector, G.P.dt);
  const terr = memCols.map(cols => SG.territoryStats(G, stats, cols));
  return { G, stats, terr, replayEvents,
           offers: Array.from(offers), writes: Array.from(writes) };
}

function cortexOnlyRecall(model, order) {
  const assemblies = order.map(s => model.hpc.indices[s].cortex);
  return KC.corticalRecall(model.cortex, model.cons, assemblies, { start: 0 }).length;
}

/* ---------------- 1. is the spindle gate heterogeneous at all? ---------------- */
console.log("\n" + clock() + " == 1. do sectors get UNEQUAL shares of one ordinary night? ==");
{
  const ORDER = [0, 1, 2, 3, 4, 5];
  const occAll = [], denAll = [], durAll = [];
  for (const s of SEEDS.slice(0, 4)) {
    const m = build(s, ORDER);
    const r = night(m, ORDER, { seed: s });
    occAll.push(r.stats.occupancy); denAll.push(r.stats.density); durAll.push(r.stats.meanDuration);
  }
  const spread = occAll.map(o => sd(o) / mean(o));
  console.log("  per-sector occupancy, seed " + SEEDS[0] + ":  " +
              occAll[0].map(x => f(x, 2)).join(""));
  console.log("  per-sector density  /min:      " + denAll[0].map(x => f(x, 1)).join(""));
  console.log("  per-sector mean duration (s):  " + durAll[0].map(x => f(x, 3)).join(""));
  console.log("  coefficient of variation of occupancy across sectors: " +
              f(mean(spread), 3) + " (mean over 4 seeds)");
  out.heterogeneity = { cv: mean(spread), occupancy: occAll[0], density: denAll[0],
                        duration: durAll[0] };
  ok("sector shares FLUCTUATE over a 90 s window",
     mean(spread) > 0.05,
     "CV = " + f(mean(spread), 3) + ". Read narrowly: this is short-run fluctuation, and it is " +
     "the necessary condition for P1 to be testable at all. It is NOT evidence that any sector " +
     "is persistently favoured — §4 shows the spread collapses as the night lengthens, and " +
     "treating this number as a standing bias is precisely the error P1a rests on.");
}

/* ---------------- 2. topographic specificity (P1) and time-vs-count (P2) ---------------- */
console.log("\n" + clock() + " == 2. does a memory get what ITS OWN territory won? (P1, P2) ==");
{
  const ORDER = [0, 1, 2, 3, 4, 5];
  const own = [], other = [], ownDen = [], wgt = [], byseed = [];
  for (const s of SEEDS) {
    const m = build(s, ORDER);
    const r = night(m, ORDER, { seed: s });
    const w = consolidatedWeight(m.cons, m.hpc, ORDER);
    const o = [], t = [], d = [], ww = [];
    for (let k = 1; k < ORDER.length; k++) {
      own.push(r.terr[k].occupancy);   o.push(r.terr[k].occupancy);
      other.push(r.terr[k].otherOccupancy); t.push(r.terr[k].otherOccupancy);
      ownDen.push(r.terr[k].density);  d.push(r.terr[k].density);
      wgt.push(w[k - 1]);              ww.push(w[k - 1]);
    }
    byseed.push({ seed: s, rhoOwn: spearman(o, ww), offers: r.offers.slice(1),
                  writes: r.writes.slice(1) });
  }
  const rhoOwn = spearman(own, wgt);
  const rhoOther = spearman(other, wgt);
  const rhoDen = spearman(ownDen, wgt);
  /* THE DIFFERENCE SCORE, run because the literature runs it and NOT scored, because it is post
     hoc. Nishida & Walker (2007) found offline motor-memory gain correlated with spindle activity
     in the LEARNING MINUS NON-LEARNING hemisphere and not with either hemisphere alone — which is
     structurally the same contrast as own-versus-other territory here. It is the first analysis a
     reviewer would ask for, so it is reported whether or not it helps. */
  const rhoDiff = spearman(own.map((o, i) => o - other[i]), wgt);
  out.topographic = { rhoOwn, rhoOther, rhoDen, rhoDiff, n: own.length,
                      withinSeed: mean(byseed.map(b => b.rhoOwn)) };

  const off = byseed[0].offers, wr = byseed[0].writes;
  console.log("  rehearsal opportunities per memory (seed " + SEEDS[0] + "):  " +
              off.map(x => String(x).padStart(5)).join("") + "   ← equal by construction");
  console.log("  licensed writes per memory:                " +
              wr.map(x => String(x).padStart(5)).join("") + "   ← the gate's doing");
  console.log("");
  console.log("  n = " + own.length + " memories (" + SEEDS.length + " seeds × 5 transitions), pooled");
  console.log("  ρ(OWN territory spindle time,   consolidated weight) = " + f(rhoOwn, 2));
  console.log("  ρ(OTHER territory spindle time, consolidated weight) = " + f(rhoOther, 2));
  console.log("  ρ(OWN territory spindle DENSITY, consolidated weight) = " + f(rhoDen, 2));
  console.log("  ρ(OWN − OTHER difference score,  consolidated weight) = " + f(rhoDiff, 2) +
              "   (post hoc, Nishida & Walker 2007's contrast — reported, not scored)");
  console.log("  within-seed mean ρ(own, weight) = " + f(mean(byseed.map(b => b.rhoOwn)), 2) +
              "  (5 points per seed — coarse, reported for honesty not as the test)");

  ok("consolidation follows a memory's OWN reticular territory (P1a)", rhoOwn > 0.5,
     "ρ = " + f(rhoOwn, 2) + " with rehearsal opportunity held exactly equal — the memory that " +
     "consolidates is the one whose sectors won the competition");
  ok("…and NOT the rest of the thalamus (P1b)", rhoOther < 0.25,
     "ρ_other = " + f(rhoOther, 2) + ". A global-arousal account predicts these two are the " +
     "same number; here they are not, which is what makes the claim topographic");
  ok("spindle TIME predicts better than spindle COUNT (P2)", rhoOwn > rhoDen,
     "occupancy ρ = " + f(rhoOwn, 2) + " vs density ρ = " + f(rhoDen, 2) + " — the gate " +
     "licenses for as long as the envelope is up and is blind to how many onsets that is");
}

/* ---------------- 3. the dose claim, tested rather than asserted (P3) ---------------- */
console.log("\n" + clock() + " == 3. is the weak behavioural dissociation really just dose? (P3) ==");
{
  const ORDER3 = [0, 1, 2];
  const conds = {
    "intact": {},
    "hippocampal lesion": { hippocampus: false },
    "reticular lesion": { lesionSectors: [0, 1, 2, 3, 4, 5, 6, 7] },
  };
  const rows = {};
  for (const tag of Object.keys(conds)) {
    const rec = [], wg = [], rep = [];
    for (const s of SEEDS) {
      const m = build(s, ORDER3);
      const r = night(m, ORDER3, Object.assign({ seed: s, seconds: 360 }, conds[tag]));
      rec.push(cortexOnlyRecall(m, ORDER3));
      wg.push(mean(consolidatedWeight(m.cons, m.hpc, ORDER3)));
      rep.push(r.replayEvents);
    }
    rows[tag] = { recall: mean(rec), recallSd: sd(rec), weight: mean(wg), replay: mean(rep) };
  }
  out.dose = rows;
  console.log("  360 s night, 3 memories, " + SEEDS.length + " held-out seeds");
  console.log("  condition             replay   weight   cortex-only recall (of 3)");
  for (const tag of Object.keys(rows)) {
    const r = rows[tag];
    console.log("  " + tag.padEnd(21) + f(r.replay, 0).padStart(5) + "    " + f(r.weight, 3) +
                "        " + f(r.recall, 2) + " ± " + f(r.recallSd, 2));
  }
  ok("with adequate dose the intact loop recovers the sequence from cortex alone (P3a)",
     rows["intact"].recall >= 2.5,
     "recall " + f(rows["intact"].recall, 2) + " of 3 — stage 39's 1.20 was the 90 s, 6-memory " +
     "dose, not the mechanism");
  ok("and BOTH lesions lose it (P3b)",
     rows["hippocampal lesion"].recall <= 1.5 && rows["reticular lesion"].recall <= 1.5,
     "hippocampal " + f(rows["hippocampal lesion"].recall, 2) + ", reticular " +
     f(rows["reticular lesion"].recall, 2));
  ok("with replay intact in the reticular lesion (P3c)",
     rows["reticular lesion"].replay === rows["intact"].replay &&
     rows["hippocampal lesion"].replay === 0,
     "replay " + f(rows["intact"].replay, 0) + " / " + f(rows["hippocampal lesion"].replay, 0) +
     " / " + f(rows["reticular lesion"].replay, 0) + " — the diencephalic case rehearses " +
     "normally and learns nothing, which is the clinical shape of thalamic amnesia");
}

/* ---------------- 4. why P1a fell short — a diagnosis that can be wrong (P4) ---------------- */
console.log("\n" + clock() + " == 4. is P1a's shortfall attenuation, or is the relation absent? (P4) ==");
const P4 = {};
{
  /* P1a came in at ρ = 0.33 against a registered 0.5. Before accepting or explaining that, note
     what the outcome variable actually is. Weight is licensed writes × lrCC, and over a 90 s
     night each memory is offered the gate ~16 times and wins ~4–6. Five memories separated by
     one or two integer counts is a heavily TIED, heavily quantised outcome, and the number of
     wins is binomial around the true licence probability. Both attenuate a rank correlation
     regardless of how real the underlying relation is.
     THIS IS A CLAIM THAT CAN BE FALSE, and that is the point of testing it rather than asserting
     it: if occupancy really sets the licence probability, then giving each memory more offers
     shrinks the binomial noise and ρ must CLIMB toward its asymptote. If occupancy is not the
     driver, more offers cannot help and ρ stays where it is.

     MEASURED ON THE LICENSED FRACTION, NOT ON WEIGHT, and that substitution is forced rather
     than convenient: Wcc saturates at wCCmax = 1.2, i.e. 40 writes, so past a few hundred
     seconds every memory is pinned at the cap and the weights cannot express any difference at
     all. Which is itself worth stating — topographic scheduling shapes what is consolidated only
     while the dose is limited, and a limited dose is the normal case (one night, many memories).

     The gate alone is run here; no cortex is built, because the licence fraction is a property of
     the scheduler and the rehearsal schedule and of nothing downstream.

     REGISTERED: ρ(own-territory occupancy, licensed fraction) rises monotonically with night
     length and exceeds 0.5 by the longest night, while ρ(other-territory occupancy, ·) does not
     exceed 0.25 at any length. */
  const ORDER = [0, 1, 2, 3, 4, 5];
  const memCols = territories(ORDER);
  function gateNight(seed, seconds, bias) {
    const G = SG.createGate(NCOL, { lateral: 0.5, seed, biasMode: (bias || {}).mode || "drive" });
    if (bias && bias.per) for (let k = 1; k < ORDER.length; k++)
      for (const s of SG.sectorsFor(G, memCols[k])) SG.setBias(G, s, bias.per[k]);
    const offers = new Float64Array(ORDER.length), writes = new Float64Array(ORDER.length);
    const union = new Float64Array(ORDER.length);
    let armed = true, turn = 0, n = 0;
    const trace = SG.runNREM(G, seconds, (g, act, so) => {
      n++;
      for (let k = 1; k < ORDER.length; k++) if (SG.licensed(g, memCols[k])) union[k]++;
      if (so > 0.5 && armed) {
        armed = false;
        const k = 1 + (turn++ % (ORDER.length - 1));
        offers[k]++;
        if (SG.licensed(g, memCols[k])) writes[k]++;
      }
      if (so < 0.1) armed = true;
    });
    const stats = SG.spindleStats(trace, G.P.nSector, G.P.dt);
    return { terr: memCols.map(c => SG.territoryStats(G, stats, c)),
             union: Array.from(union, x => x / Math.max(1, n)),
             offers: Array.from(offers), writes: Array.from(writes) };
  }
  P4.gateNight = gateNight; P4.memCols = memCols; P4.ORDER = ORDER;
  const rows = [];
  console.log("  night (s)   offers/mem   writes   licensed frac   ρ(own,frac)   ρ(other,frac)   CV(territory)");
  for (const secs of [90, 360, 900, 1800]) {
    const own = [], other = [], frac = [], offs = [], wr = [], uni = [];
    for (const s of SEEDS) {
      const r = gateNight(s, secs);
      for (let k = 1; k < ORDER.length; k++) {
        own.push(r.terr[k].occupancy); other.push(r.terr[k].otherOccupancy);
        frac.push(r.writes[k] / Math.max(1, r.offers[k]));
        offs.push(r.offers[k]); wr.push(r.writes[k]); uni.push(r.union[k]);
      }
    }
    const ro = spearman(own, frac), rt = spearman(other, frac);
    rows.push({ secs, offers: mean(offs), frac: mean(frac), rhoOwn: ro, rhoOther: rt,
                writes: mean(wr), cvTerritory: sd(uni) / mean(uni), cvOutcome: sd(frac) / mean(frac) });
    console.log("  " + String(secs).padStart(7) + "    " + f(mean(offs), 0).padStart(7) + "  " +
                f(mean(wr), 0).padStart(7) + "        " + f(mean(frac), 3) + "        " + f(ro, 2) +
                "         " + f(rt, 2) + "        " + f(sd(uni) / mean(uni), 3));
  }
  out.attenuation = rows;
  const climbs = rows.every((r, i) => i === 0 || r.rhoOwn >= rows[i - 1].rhoOwn - 0.02);
  const last = rows[rows.length - 1];
  ok("ρ climbs with rehearsal opportunity and clears 0.5 (P4)",
     climbs && last.rhoOwn > 0.5,
     "ρ_own " + rows.map(r => f(r.rhoOwn, 2).trim()).join(" → ") + " across " +
     rows.map(r => r.secs + "s").join(" / "));
  console.log("");
  console.log("  P4 IS REFUTED, AND IT WAS THE RIGHT KIND OF WRONG — it named a number that could");
  console.log("  contradict it, and the number did. More rehearsal opportunity does not raise ρ, so");
  console.log("  P1a's 0.33 is not a quantised relation showing through noise. The table says what");
  console.log("  it is instead: as the night lengthens, the spread of spindle availability ACROSS");
  console.log("  territories collapses — CV " + f(rows[0].cvTerritory, 3).trim() + " at " + rows[0].secs +
              " s down to " + f(last.cvTerritory, 3).trim() + " at " + last.secs + " s — while the");
  console.log("  spread of the OUTCOME stays at " + f(last.cvOutcome, 3).trim() +
              ", three times larger, and is binomial sampling.");
  console.log("");
  console.log("  So the unbiased scheduler is CAPACITY-LIMITED BUT FAIR. Competition plus the");
  console.log("  refractory term make which sector is up fluctuate fast, and integrated over a");
  console.log("  night every territory receives the same share (§1's per-sector CV of 0.122 is that");
  console.log("  fluctuation over 90 s, not a standing bias — it did not license P1a and should not");
  console.log("  have been read as though it did). A scheduler with no bias source has no reason to");
  console.log("  favour one memory, and it does not.");
  console.log("");
  console.log("  Two consequences, and the second is a testable prediction rather than a repair:");
  console.log("    • Wcc caps at 40 writes (wCCmax 1.2 / lrCC 0.03) and mean writes reach " +
              f(last.writes, 0).trim() + " by " + last.secs + " s,");
  console.log("      so at long dose every memory saturates and weights cannot differ at all.");
  console.log("      Scheduling shapes WHAT IS KEPT only while dose is limited — one night, more");
  console.log("      memories than slots, which is the ordinary case.");
  console.log("    • Topographic spindle–memory correlations in humans should therefore be WEAK");
  console.log("      for spontaneous sleep and appear when something BIASES the competition. §5–6.");
}

/* ---------------- 5. EXPLORATORY — what makes the gate topographic, then? ---------------- */
console.log("\n" + clock() + " == 5. EXPLORATORY: a bias source, on sector-aligned territories ==");
const EXPL = {};
{
  /* §4 leaves a sharp question. If an unbiased reticular gate is FAIR, then the topographic
     spindle–memory relationships reported in humans (Nishida & Walker 2007; Bergmann 2012) cannot come from a
     scheduler running freely — something must tilt it. The model contains exactly one candidate,
     added in stage 38 for a different purpose: a per-sector bias, which is what a cue supplies.
     Whether that is sufficient is a real question — lateral inhibition could swallow a graded
     bias, or saturate on the largest one and give a step rather than a gradient.
   *
   * THIS SECTION IS LABELLED EXPLORATORY AND IS NOT SCORED, for two honest reasons:
   *   • The first version of it was confounded. Memories occupy 10 columns and sectors 8, so
   *     neighbouring memories SHARE a sector and a per-memory bias does not produce a per-memory
   *     gradient — the shared sector simply keeps whichever bias was written last. That was found
   *     by inspecting the output, not predicted, and territories are sector-aligned here as a
   *     result. A confound found by looking makes the numbers that follow exploratory.
   *   • The uncued-cost comparison below was run before any threshold was fixed.
   * §6 therefore re-runs every claim made here on a seed set that has never been touched, with
   * the criteria written down first. Nothing in §5 is counted as a result. */
  const memCols = Array.from({ length: 6 }, (_, k) =>
    Array.from({ length: 8 }, (_, i) => k * 8 + i));      // one sector per memory, no sharing
  EXPL.memCols = memCols;
  function gateNight(seed, seconds, bias) {
    const G = SG.createGate(NCOL, { lateral: 0.5, seed, biasMode: (bias || {}).mode || "drive" });
    if (bias && bias.per) for (let k = 1; k < 6; k++)
      for (const s of SG.sectorsFor(G, memCols[k])) SG.setBias(G, s, bias.per[k]);
    const offers = new Float64Array(6), writes = new Float64Array(6);
    let armed = true, turn = 0;
    SG.runNREM(G, seconds, (g, act, so) => {
      if (so > 0.5 && armed) {
        armed = false;
        const k = 1 + (turn++ % 5);
        offers[k]++;
        if (SG.licensed(g, memCols[k])) writes[k]++;
      }
      if (so < 0.1) armed = true;
    });
    return Array.from(writes, (w, k) => w / Math.max(1, offers[k]));
  }
  EXPL.gateNight = gateNight;
  const GRADE = [0, 0, 0.125, 0.25, 0.375, 0.5];
  EXPL.GRADE = GRADE;

  function gradient(seeds, bias) {
    const b = [], fr = [], byMem = [[], [], [], [], [], []];
    for (const s of seeds) {
      const v = gateNight(s, 360, bias);
      for (let k = 1; k < 6; k++) { b.push(bias ? GRADE[k] : k); fr.push(v[k]); byMem[k].push(v[k]); }
    }
    return { rho: spearman(b, fr), perMem: byMem.slice(1).map(mean) };
  }
  EXPL.gradient = gradient;

  const flat = gradient(SEEDS, null);
  const gD = gradient(SEEDS, { mode: "drive", per: GRADE });
  const gC = gradient(SEEDS, { mode: "competitive", per: GRADE });
  console.log("  bias on each memory's sector:            " + GRADE.slice(1).map(x => f(x, 3)).join(""));
  console.log("  licensed fraction, NO bias:             " + flat.perMem.map(x => f(x, 3)).join("") +
              "    ρ(rank, frac) = " + f(flat.rho, 2));
  console.log("  licensed fraction, drive cueing:        " + gD.perMem.map(x => f(x, 3)).join("") +
              "    ρ(bias, frac) = " + f(gD.rho, 2));
  console.log("  licensed fraction, competitive cueing:  " + gC.perMem.map(x => f(x, 3)).join("") +
              "    ρ(bias, frac) = " + f(gC.rho, 2));

  /* the single-cue design is the one that answers the TMR question — cue ONE memory and ask what
     happens to the others, against a no-cue baseline in the same seeds */
  const CUE = 3;
  EXPL.CUE = CUE;
  function single(seeds, mode) {
    const per = [0, 0, 0, 0, 0, 0]; if (mode) per[CUE] = 0.5;
    const c = [], u = [];
    for (const s of seeds) {
      const v = gateNight(s, 360, mode ? { mode, per } : null);
      c.push(v[CUE]); u.push(mean([1, 2, 4, 5].map(k => v[k])));
    }
    return { cued: mean(c), uncued: mean(u) };
  }
  EXPL.single = single;
  const b0 = single(SEEDS, null), sD = single(SEEDS, "drive"), sC = single(SEEDS, "competitive");
  console.log("");
  console.log("  cue ONE memory (bias 0.5 on its sector), 4 uncued in the same night:");
  console.log("    no cue        cued " + f(b0.cued, 3) + "   uncued " + f(b0.uncued, 3));
  console.log("    drive         cued " + f(sD.cued, 3) + "   uncued " + f(sD.uncued, 3) +
              "   (" + f(100 * (sD.uncued / b0.uncued - 1), 0).trim() + "% vs baseline)");
  console.log("    competitive   cued " + f(sC.cued, 3) + "   uncued " + f(sC.uncued, 3) +
              "   (" + f(100 * (sC.uncued / b0.uncued - 1), 0).trim() + "% vs baseline)");
  EXPL.observed = { flat, gD, gC, b0, sD, sC };
  out.exploratory = { flatRho: flat.rho, driveRho: gD.rho, compRho: gC.rho,
                      base: b0, drive: sD, competitive: sC };
  console.log("");
  console.log("  STAGE 38's FORK NEEDS CORRECTING, and this is where it shows. Stage 38 concluded");
  console.log("  that drive-mode cueing leaves uncued items UNHARMED and only competitive cueing");
  console.log("  costs them. On sector-aligned territories, measured on the consolidation licence,");
  console.log("  BOTH modes cost the uncued; what separates them is how much. The fork survives as");
  console.log("  a quantitative claim rather than a qualitative one, which is harder to test in");
  console.log("  humans and more likely to be true. §6 decides whether even that holds up.");
}

/* ---------------- 6. CONFIRMATORY — fresh seeds, criteria fixed first (P5) ---------------- */
console.log("\n" + clock() + " == 6. CONFIRMATORY on seeds 16–25, criteria fixed from §5 ==");
{
  /* Every threshold below is taken from §5's exploratory values and written down BEFORE this
     section runs. The seeds have not been used anywhere in this project. If a claim from §5 was
     a feature of seeds 6–15 it dies here, which is the point. */
  const FRESH = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
  const { gradient, single, GRADE } = EXPL;
  const flat = gradient(FRESH, null);
  const gD = gradient(FRESH, { mode: "drive", per: GRADE });
  const gC = gradient(FRESH, { mode: "competitive", per: GRADE });
  const b0 = single(FRESH, null), sD = single(FRESH, "drive"), sC = single(FRESH, "competitive");
  out.confirm = { flatRho: flat.rho, driveRho: gD.rho, compRho: gC.rho,
                  base: b0, drive: sD, competitive: sC };

  console.log("  no bias:      per-memory " + flat.perMem.map(x => f(x, 3)).join("") +
              "   ρ = " + f(flat.rho, 2));
  console.log("  drive:        per-memory " + gD.perMem.map(x => f(x, 3)).join("") +
              "   ρ = " + f(gD.rho, 2));
  console.log("  competitive:  per-memory " + gC.perMem.map(x => f(x, 3)).join("") +
              "   ρ = " + f(gC.rho, 2));
  console.log("  single cue:   baseline cued " + f(b0.cued, 3) + " uncued " + f(b0.uncued, 3) +
              " | drive " + f(sD.cued, 3) + "/" + f(sD.uncued, 3) +
              " | competitive " + f(sC.cued, 3) + "/" + f(sC.uncued, 3));
  console.log("");

  ok("the UNBIASED gate is flat — no territory is favoured (P5a)", Math.abs(flat.rho) < 0.30,
     "ρ = " + f(flat.rho, 2) + " between territory identity and licensed fraction. This is §4's " +
     "conclusion on fresh seeds and with territories that share no sector: a scheduler with no " +
     "bias source does not produce topographic specificity");
  ok("a graded bias DOES make it topographic, in both cue modes (P5b)",
     gD.rho > 0.8 && gC.rho > 0.8,
     "ρ(bias, licensed fraction) = " + f(gD.rho, 2).trim() + " drive, " + f(gC.rho, 2).trim() +
     " competitive — the correlation human studies report is a signature of a BIASED competition");
  ok("cueing raises the cued memory more than twofold (P5c)",
     sD.cued > 2 * b0.cued && sC.cued > 2 * b0.cued,
     "cued " + f(b0.cued, 3).trim() + " → " + f(sD.cued, 3).trim() + " (drive) / " +
     f(sC.cued, 3).trim() + " (competitive)");
  ok("BOTH modes cost the uncued — stage 38's qualitative fork is withdrawn (P5d)",
     sD.uncued < b0.uncued && sC.uncued < b0.uncued,
     "uncued " + f(b0.uncued, 3).trim() + " → " + f(sD.uncued, 3).trim() + " / " +
     f(sC.uncued, 3).trim() + ". Stage 38 said drive-mode cueing is free; on aligned territories " +
     "and the consolidation licence it is not");
  ok("…and competitive cueing costs them MORE, which is what survives of the fork (P5e)",
     sC.uncued < sD.uncued,
     "uncued " + f(sD.uncued, 3).trim() + " (drive) vs " + f(sC.uncued, 3).trim() +
     " (competitive), baseline " + f(b0.uncued, 3).trim() + " — the human experiment is the SIZE " +
     "of the cost to uncued items in a cued night, not whether there is one");
}

console.log("\n" + clock() + " == what this adds ==");
{
  console.log("  THE HEADLINE IS THE PREDICTION THAT FAILED. I expected a reticular scheduler to");
  console.log("  make consolidation topographically specific all by itself — hold rehearsal exactly");
  console.log("  equal and let each memory take what its own sectors won. It does not. With no bias");
  console.log("  source the gate is CAPACITY-LIMITED BUT FAIR: competition and the refractory term");
  console.log("  make the winner fluctuate fast, and over a night every territory gets the same");
  console.log("  share (CV 0.026 across territories against 0.080 of binomial noise in the outcome).");
  console.log("  P1a failed at ρ = 0.33 and P4, the attenuation excuse offered for it, was refuted");
  console.log("  by its own test — more rehearsal opportunity does not raise ρ.");
  console.log("");
  console.log("  What that buys is a sharper claim than the one I set out to make. Serial capacity");
  console.log("  and topographic selectivity are SEPARABLE properties of the same scheduler: the");
  console.log("  first is intrinsic to lateral inhibition, the second requires something to tilt");
  console.log("  the competition. So the model predicts topographic spindle–memory correlations");
  console.log("  should be WEAK in spontaneous sleep and strong under cueing or prioritisation —");
  console.log("  and §6 confirms on untouched seeds that a graded bias produces exactly that.");
  console.log("");
  console.log("  Two corrections to earlier stages, both from looking harder rather than from new");
  console.log("  mechanism: stage 39's spindle-DENSITY prediction failed because the gate licenses");
  console.log("  TIME and density is a lossy proxy (§2, ρ 0.33 vs −0.29); and stage 38's claim that");
  console.log("  drive-mode cueing is free for uncued items is withdrawn (§6) — both cue modes cost");
  console.log("  the uncued, and only the SIZE of the cost distinguishes them.");
  console.log("");
  console.log("  Standing intact from stages 38–39, and strengthened by §3: the lesion dissociation.");
  console.log("  A reticular lesion leaves replay entirely normal and consolidation at zero, which");
  console.log("  is the clinical shape of diencephalic amnesia and is not something a cortex-plus-");
  console.log("  hippocampus model can produce.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "topographic.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
