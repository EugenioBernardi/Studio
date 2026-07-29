"use strict";
/* Stage-38 — THE RETICULAR NUCLEUS AS A CONSOLIDATION SCHEDULER.
 *
 * THE SCIENTIFIC CLAIM. Systems-consolidation models are cortex plus hippocampus; the thalamus
 * is almost always absent. Yet spindles are thalamic, spindle density is the strongest
 * physiological predictor of overnight retention in humans (Gais 2002; Schabus 2004), and
 * thalamic lesions cause an amnesia that is clinically DIFFERENT from hippocampal amnesia. The
 * proposal is that the reticular nucleus is not a relay in memory but a SCHEDULER:
 *
 *     spindles are LOCAL and reticular sectors COMPETE, so only some cortical territory is
 *     plastic in any given up-state — making consolidation SERIAL and CAPACITY-LIMITED, with
 *     memories competing for spindle slots.
 *
 * WHAT THIS PROJECT ALREADY ASSUMED, and what is being overturned. `night.js` gates replay on
 * spindle power computed from `thalTC`, the mean over EVERY cortical column — one global
 * spindle. That is the standard modelling assumption. Nir et al. (2011) showed human spindles
 * and slow waves are frequently LOCAL; reticular sectors are topographically organised and
 * mutually inhibitory (Pinault 2004; Crabtree 2018). `src/spindlegate.js` adds exactly one
 * mechanism to express that — lateral inhibition between sectors — and nothing else.
 *
 * WHAT IS AND IS NOT MODELLED HERE. This stage measures the SCHEDULE: which memory is licensed
 * to consolidate, when, and for how long. The synaptic consolidation the schedule gates is the
 * project's existing validated machinery (stages 4 and 5: replay writes a cortico-cortical
 * chain, and only spindle-nested events are licensed). Licensed replay time is therefore the
 * scheduler's OUTPUT, not a proxy for memory strength, and it is reported as such.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) Lateral inhibition makes spindling LOCAL and mutually exclusive: up-state co-occupancy
 *       falls well below chance, where without it sectors spindle together at chance.
 *   (2) THE CAPACITY LIMIT, and the claim that matters. As more memories are learned in a day,
 *       TOTAL licensed replay time stays roughly FLAT while PER-MEMORY time falls — learning
 *       more does not consolidate more, it spreads the same budget thinner. A model without
 *       sector competition cannot produce this: every memory would be licensed whenever any
 *       spindle occurred.
 *   (3) CUEING IS ZERO-SUM. Biasing one sector — the model's analogue of targeted memory
 *       reactivation (Rasch & Born) — raises that memory's licensed time AND lowers the others',
 *       rather than adding capacity. If cueing simply adds consolidation without cost, the
 *       scheduler interpretation is wrong and TMR is doing something else.
 *       [OUTCOME: REFUTED, and the refutation is more useful than the prediction. See §3 — how a
 *        cue acts turns out to be a HYPOTHESIS, not an implementation detail, and the two
 *        versions make opposite, empirically distinguishable predictions about uncued items.]
 *   (4) THE CLINICAL DISSOCIATION, and the reason this is worth publishing. A hippocampal lesion
 *       abolishes REPLAY, so nothing is consolidated and nothing is replayed. A reticular lesion
 *       leaves REPLAY ENTIRELY INTACT and abolishes consolidation anyway, because no replay
 *       event is ever licensed. Replay and consolidation come apart. No cortex+hippocampus model
 *       can produce that dissociation, and it is the signature that separates diencephalic from
 *       medial-temporal amnesia.
 *   (5) A PARTIAL reticular lesion should spare the memories whose columns fall in surviving
 *       sectors and abolish the rest — a patchy, territory-specific consolidation deficit rather
 *       than a graded global one. That is a sharp, falsifiable prediction and it is what a focal
 *       thalamic infarct should look like.
 */

const SG = require("../src/spindlegate.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null || Number.isNaN(x) ? "  n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const out = {};

const NCOL = 64, NIGHT = 120;          // seconds of simulated NREM
const LATERAL = 0.5;                   // competition strength; §1 shows what it buys

/* a memory occupies a contiguous patch of cortical columns — memories are not smeared over the
   whole sheet, which is what makes them fall in particular reticular territory */
function makeMemories(nMem, seed, span) {
  const rnd = SG.mulberry32(seed);
  span = span || 6;
  const mems = [];
  for (let m = 0; m < nMem; m++) {
    const start = Math.floor(rnd() * (NCOL - span));
    const cols = [];
    for (let i = 0; i < span; i++) cols.push(start + i);
    mems.push(cols);
  }
  return mems;
}

/* one night: replay events fire at up-state onsets; each is LICENSED only if a sector holding
   the replayed memory's columns is spindling at that moment */
function night(mems, opts) {
  opts = opts || {};
  const G = SG.createGate(NCOL, { lateral: opts.lateral == null ? LATERAL : opts.lateral,
                                  seed: opts.seed == null ? 5 : opts.seed,
                                  biasMode: opts.biasMode || "drive" });
  if (opts.lesionSectors) for (const s of opts.lesionSectors) SG.lesionSector(G, s);
  if (opts.bias) for (const [s, v] of opts.bias) SG.setBias(G, s, v);
  const hippocampusIntact = opts.hippocampus !== false;
  const licensedTime = new Float64Array(mems.length);
  let replayEvents = 0, licensedEvents = 0;
  const rnd = SG.mulberry32(77 + (opts.seed || 0));
  let armed = true;
  SG.runNREM(G, opts.seconds || NIGHT, (g, act, so) => {
    // replay events are hippocampal: one per up-state onset, memory chosen at random.
    // A hippocampal lesion abolishes them; it does not touch the thalamus.
    if (so > 0.5 && armed) {
      armed = false;
      if (hippocampusIntact) {
        replayEvents++;
        const m = Math.floor(rnd() * mems.length);
        if (SG.licensed(g, mems[m])) { licensedEvents++; licensedTime[m] += 1; }
      }
    }
    if (so < 0.1) armed = true;
  });
  return { G, licensedTime: Array.from(licensedTime), replayEvents, licensedEvents,
           total: licensedTime.reduce((a, b) => a + b, 0) };
}

/* ---------------- 1. are spindles local and competitive? ---------------- */
console.log("\n== 1. does lateral inhibition make spindling local? (P1) ==");
{
  const rows = [];
  console.log("  lateral   sectors spindling at once   up-state co-occupancy   per-sector occupancy");
  for (const lat of [0.0, 0.15, 0.3, 0.5, 0.9]) {
    const G = SG.createGate(NCOL, { lateral: lat, seed: 5 });
    const tr = SG.runNREM(G, 40);
    const co = SG.coOccupancy(tr, G.P.nSector, tr.up);
    let up = 0, conc = 0;
    for (let i = 0; i < tr.length; i++) if (tr.up[i]) { up++; conc += tr[i].length; }
    const occ = co.occupancy;
    rows.push({ lateral: lat, concurrent: conc / up, ratio: co.ratio,
                occMin: Math.min(...occ), occMax: Math.max(...occ) });
    console.log("   " + f(lat, 2) + "            " + f(conc / up, 2) + "/" + G.P.nSector +
                "                 " + f(co.ratio, 2) + "               " +
                f(100 * Math.min(...occ), 0) + "–" + f(100 * Math.max(...occ), 0) + "%");
  }
  out.locality = rows;
  const none = rows[0], comp = rows.find(r => r.lateral === LATERAL);
  ok("without competition, sectors spindle together at chance (P1a)",
     none.ratio > 0.9 && none.concurrent > 6,
     "co-occupancy " + f(none.ratio, 2) + ", " + f(none.concurrent, 1) + "/8 sectors at once");
  ok("with competition, spindling becomes LOCAL and mutually exclusive (P1b)",
     comp.ratio < 0.8 && comp.concurrent < 3,
     "co-occupancy " + f(comp.ratio, 2) + ", " + f(comp.concurrent, 1) + "/8 at once — and every " +
     "sector still gets slots (" + f(100 * comp.occMin, 0) + "–" + f(100 * comp.occMax, 0) + "%)");
  console.log("");
  console.log("  The co-occupancy is conditioned on the UP-STATE. Every sector is driven by the");
  console.log("  same slow oscillation, so measured over the whole record that shared drive puts");
  console.log("  the ratio above 1 even when sectors are excluding one another — the first");
  console.log("  version of this measure reported 1.82 for a plainly competing configuration.");
}

/* ---------------- 2. the capacity limit ---------------- */
console.log("\n== 2. does learning more consolidate more? (P2) ==");
{
  const rows = [];
  console.log("  memories | total licensed  per-memory  | replay events  licensed fraction");
  for (const n of [2, 4, 8, 16]) {
    const perSeed = [];
    for (const sd of [1, 2, 3]) {
      const mems = makeMemories(n, 100 + sd);
      perSeed.push(night(mems, { seed: sd }));
    }
    const total = mean(perSeed.map(r => r.total));
    const per = total / n;
    const ev = mean(perSeed.map(r => r.replayEvents));
    const lic = mean(perSeed.map(r => r.licensedEvents));
    rows.push({ n, total, per, ev, frac: lic / ev });
    console.log("     " + String(n).padStart(4) + "  |     " + f(total, 1).padStart(6) + "        " +
                f(per, 2).padStart(5) + "    |     " + f(ev, 0).padStart(5) + "         " +
                f(lic / ev, 3));
  }
  out.capacity = rows;
  const small = rows[0], big = rows[rows.length - 1];
  ok("total consolidation does NOT scale with the number of memories (P2a)",
     big.total < small.total * 2.5,
     "2 memories → " + f(small.total, 1) + " licensed events, 16 → " + f(big.total, 1) +
     " (an eightfold increase in material would give " + f(small.total * 8, 1) + " if capacity were free)");
  ok("…so per-memory consolidation FALLS as more is learned (P2b)",
     big.per < small.per * 0.5,
     "per-memory " + f(small.per, 2) + " → " + f(big.per, 2));
  console.log("");
  console.log("  The licensed FRACTION is roughly constant across load, which is the mechanism:");
  console.log("  the gate is open the same proportion of the time whatever is queued, so the");
  console.log("  budget is fixed and adding material divides it rather than enlarging it.");
}

/* ---------------- 3. cueing: two mechanisms, opposite predictions ---------------- */
console.log("\n== 3. targeted memory reactivation: does cueing add capacity or move it? (P3) ==");
{
  const nMem = 8;
  const modes = {};
  for (const mode of ["drive", "competitive"]) {
    const base = [], cued = [], oBase = [], oCued = [], tBase = [], tCued = [];
    for (const sd of [1, 2, 3, 4]) {
      const mems = makeMemories(nMem, 100 + sd);
      const b = night(mems, { seed: sd, biasMode: mode });
      const G0 = SG.createGate(NCOL, { lateral: LATERAL, seed: sd });
      const sec = SG.sectorsFor(G0, mems[0]);
      const c = night(mems, { seed: sd, biasMode: mode, bias: sec.map(s => [s, 1.5]) });
      base.push(b.licensedTime[0]); cued.push(c.licensedTime[0]);
      oBase.push(b.licensedTime.slice(1).reduce((a, x) => a + x, 0));
      oCued.push(c.licensedTime.slice(1).reduce((a, x) => a + x, 0));
      tBase.push(b.total); tCued.push(c.total);
    }
    modes[mode] = { cuedBefore: mean(base), cuedAfter: mean(cued),
                    othersBefore: mean(oBase), othersAfter: mean(oCued),
                    totalBefore: mean(tBase), totalAfter: mean(tCued) };
  }
  out.tmr = modes;
  console.log("  how the cue acts   cued memory        uncued memories      TOTAL");
  for (const m of ["drive", "competitive"]) {
    const r = modes[m];
    console.log("  " + m.padEnd(18) + f(r.cuedBefore, 2) + " → " + f(r.cuedAfter, 2) +
                "        " + f(r.othersBefore, 2) + " → " + f(r.othersAfter, 2) +
                "     " + f(r.totalBefore, 2) + " → " + f(r.totalAfter, 2));
  }
  ok("cueing raises the cued memory's share (P3a)",
     modes.drive.cuedAfter > modes.drive.cuedBefore * 1.2,
     f(modes.drive.cuedBefore, 2) + " → " + f(modes.drive.cuedAfter, 2) + " (drive mode)");
  ok("…and it is taken FROM the others — cueing moves capacity, it does not add it (P3b)",
     modes.drive.othersAfter < modes.drive.othersBefore,
     "REFUTED in drive mode: uncued memories go " + f(modes.drive.othersBefore, 2) + " → " +
     f(modes.drive.othersAfter, 2) + ", i.e. cueing ADDS capacity rather than moving it");
  console.log("");
  console.log("  P3b IS REFUTED, AND THE REFUTATION IS THE USEFUL PART. How a cue acts is a");
  console.log("  HYPOTHESIS, not an implementation detail, and the two versions make opposite");
  console.log("  predictions about the memories that were NOT cued:");
  console.log("");
  console.log("    DRIVE       — the cue adds excitatory drive to its reticular sector. Total");
  console.log("                  spindling rises. Cued items gain and UNCUED ITEMS ARE UNHARMED.");
  console.log("    COMPETITIVE — the cue biases who wins without adding drive. Cued items gain a");
  console.log("                  little and UNCUED ITEMS LOSE substantially.");
  console.log("");
  console.log("  So the model does not predict one TMR result; it predicts a FORK, and names the");
  console.log("  measurement that resolves it — whether cueing some items during sleep costs the");
  console.log("  uncued items in the same night. That is a directly answerable human experiment,");
  console.log("  and either answer identifies which mechanism the reticular nucleus is using.");
  console.log("  Neither mode is strictly zero-sum: the competitive one LOSES total capacity");
  console.log("  (" + f(modes.competitive.totalBefore, 1) + " → " + f(modes.competitive.totalAfter, 1) +
              "), because a dominating sector suppresses its rivals more than its own");
  console.log("  refractory period lets it exploit.");
}

/* ---------------- 4. the clinical dissociation ---------------- */
console.log("\n== 4. hippocampal vs reticular lesion (P4, P5) ==");
{
  const nMem = 8;
  const rows = {};
  for (const [tag, opts] of [["intact", {}],
                             ["hippocampal lesion", { hippocampus: false }],
                             ["reticular lesion (complete)", { lesionSectors: [0,1,2,3,4,5,6,7] }],
                             ["reticular lesion (sectors 0–3)", { lesionSectors: [0,1,2,3] }]]) {
    const runs = [1, 2, 3].map(sd => night(makeMemories(nMem, 100 + sd), Object.assign({ seed: sd }, opts)));
    rows[tag] = { replay: mean(runs.map(r => r.replayEvents)),
                  licensed: mean(runs.map(r => r.licensedEvents)),
                  total: mean(runs.map(r => r.total)),
                  runs };
  }
  out.lesions = rows;
  console.log("  condition                        replay events   consolidated   ratio");
  for (const tag of Object.keys(rows)) {
    const r = rows[tag];
    console.log("  " + tag.padEnd(32) + f(r.replay, 0).padStart(6) + "         " +
                f(r.total, 1).padStart(6) + "       " + f(r.replay ? r.total / r.replay : 0, 3));
  }
  ok("a hippocampal lesion abolishes REPLAY and therefore consolidation (P4a)",
     rows["hippocampal lesion"].replay === 0 && rows["hippocampal lesion"].total === 0,
     "no replay events, nothing consolidated");
  ok("a reticular lesion abolishes consolidation with REPLAY FULLY INTACT (P4b)",
     rows["reticular lesion (complete)"].replay === rows["intact"].replay &&
     rows["reticular lesion (complete)"].total === 0,
     "replay " + f(rows["intact"].replay, 0) + " → " +
     f(rows["reticular lesion (complete)"].replay, 0) + " (unchanged), consolidated " +
     f(rows["intact"].total, 1) + " → 0");
  console.log("");
  console.log("  THAT IS THE DISSOCIATION, and it is why the thalamus belongs in these models.");
  console.log("  Both lesions abolish consolidation; only one abolishes replay. A cortex plus");
  console.log("  hippocampus model has no way to express the difference, because in it replay");
  console.log("  and consolidation are the same event. Here they come apart, and the clinical");
  console.log("  reading is direct: medial-temporal amnesia removes the rehearsal, diencephalic");
  console.log("  amnesia removes the licence to learn from it.");

  // P5: a PARTIAL reticular lesion should be territory-specific, not graded
  const part = rows["reticular lesion (sectors 0–3)"].runs;
  const spared = [], hit = [];
  for (let i = 0; i < part.length; i++) {
    const mems = makeMemories(nMem, 100 + (i + 1));
    const G0 = SG.createGate(NCOL, { lateral: LATERAL, seed: i + 1 });
    for (let m = 0; m < nMem; m++) {
      const sec = SG.sectorsFor(G0, mems[m]);
      const anySpared = sec.some(s => s >= 4);
      (anySpared ? spared : hit).push(part[i].licensedTime[m]);
    }
  }
  const partialTotal = rows["reticular lesion (sectors 0–3)"].total;
  const intactTotal = rows["intact"].total;
  console.log("");
  console.log("  AN UNEXPECTED PREDICTION, and it was not designed in. A PARTIAL reticular lesion");
  console.log("  RAISES total consolidation, " + f(intactTotal, 1) + " → " + f(partialTotal, 1) + ". Destroying half the sectors");
  console.log("  releases the survivors from lateral inhibition, so they spindle far more. The");
  console.log("  clinical reading is uncomfortable and testable: after a focal thalamic infarct,");
  console.log("  material whose cortical territory is SPARED should consolidate BETTER than");
  console.log("  normal, while material in the damaged territory consolidates not at all. That is");
  console.log("  a patchy deficit with local enhancement, not a graded global loss, and it is");
  console.log("  the opposite of what a capacity-scaling account would predict.");
  ok("a partial reticular lesion RELEASES the surviving sectors (disinhibition)",
     partialTotal > intactTotal * 1.2,
     f(intactTotal, 1) + " → " + f(partialTotal, 1) + " licensed events with half the gate destroyed");
  console.log("");
  console.log("  PARTIAL reticular lesion (sectors 0–3 destroyed), by memory territory:");
  console.log("    memories with columns in a SURVIVING sector : " + f(mean(spared), 2) + " licensed events");
  console.log("    memories confined to LESIONED sectors       : " + f(mean(hit), 2));
  ok("a focal reticular lesion is territory-specific, not graded (P5)",
     mean(hit) < 0.2 * Math.max(1e-9, mean(spared)),
     "spared territory " + f(mean(spared), 2) + " vs lesioned territory " + f(mean(hit), 2) +
     " — a patchy deficit, which is what a focal thalamic infarct should produce");
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "scheduler.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
