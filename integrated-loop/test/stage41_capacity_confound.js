"use strict";
/* Stage-41 — THE CAPACITY LIMIT IS THE REHEARSAL BUDGET, NOT THE THALAMUS. A retraction.
 *
 * Stage 39's headline result (P2) was: per-memory consolidated weight falls 0.534 → 0.288 → 0.118
 * as 2 / 3 / 6 memories compete, while TOTAL weight stays flat 0.534 → 0.577 → 0.592. It was
 * reported as the reticular scheduler's doing — "the night has a fixed budget of spindle slots and
 * more memories divide it" — and stage 38's whole framing rests on it.
 *
 * IT DOES NOT TEST THAT. The control that was never run is `lateral = 0`: no competition between
 * reticular sectors at all, so spindles are global and simultaneous. That is exactly the standard
 * assumption the module was built to argue against, and if the capacity limit appears there too
 * then the limit was never thalamic.
 *
 * It appears there too.
 *
 * The reason, in hindsight, is embarrassing and structural. `scheduledNight` rehearses ONE memory
 * per ripple — a fix introduced in stage 39 for a good reason (writing every transition on every
 * event meant memories never contended at all). But one-memory-per-ripple with a fixed number of
 * ripples IS a fixed budget, by construction, before any thalamus is consulted. Total writes are
 * capped at the ripple count and dividing them among more memories necessarily lowers the
 * per-memory share. The gate only scales the throughput; it does not create the limit.
 *
 * WHAT THE GATE ACTUALLY DOES, once the confound is removed: it sets the GAIN. Raising `lateral`
 * lowers total consolidation monotonically. That is a real effect and it is not nothing, but it is
 * a throughput claim, not a capacity-limit claim, and the two support very different papers.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING (written after seeing the exploratory probe that prompted
 * this file, so §1 is a CONFIRMATION of that probe on held-out seeds, and labelled as such):
 *   (P1) The capacity signature — total flat, per-memory falling — appears at lateral = 0 just as
 *        it does at lateral = 0.5. If so, stage 39's P2 attribution is withdrawn.
 *   (P2) Total consolidation FALLS monotonically as lateral rises. This is what the gate does.
 *        [RESULT: FAILED. It is a threshold, not a gain — open below ~0.3, a cliff, then ragged.]
 *   (P3) The lesion dissociation is near-tautological and must be labelled as such: any element
 *        placed in series with the write step abolishes consolidation while leaving replay intact.
 *        Tested by substituting a CONTENT-BLIND random gate matched to the reticular gate's duty
 *        cycle. If a coin flip reproduces the dissociation, the dissociation is not evidence for
 *        the reticular nucleus specifically.
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
const out = {};

const ORDER = [0, 1, 2, 3, 4, 5];
const NIGHT = 90;
const SEEDS = [26, 27, 28, 29, 30];        // held out; the probe that prompted this used 1–5

/* Built ONCE per seed and cached; conditions are then run on the same cortex, hippocampus and
   cortico-cortical CONNECTIVITY, with only the weights zeroed between them. That makes every
   comparison paired — conditions differ in the gate and in nothing else, not even in which
   synapses exist — and it is what makes the whole file affordable. */
const CACHE = new Map();
function build(seed) {
  if (!CACHE.has(seed)) {
    const cortex = C.create({ seed }); C.encode(cortex);
    const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
    L.encodeSequence(cortex, hpc, ORDER);
    CACHE.set(seed, { cortex, hpc, cons: KC.createConsolidation(cortex) });
  }
  const m = CACHE.get(seed);
  for (const w of m.cons.wt) w.fill(0);
  m.cons.events = 0;
  return m;
}
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
  return { per, total: per.reduce((a, b) => a + b, 0), mean: mean(per) };
}
const territories = order => order.map((_, k) => {
  const s = Math.floor(64 / order.length);
  return Array.from({ length: s }, (_, i) => k * s + i);
});

/* one night. `gate` decides whether a rehearsal may be written:
     "reticular" — the model's gate, with the given `lateral`
     "open"      — always licensed (no gate at all)
     "coin"      — content-blind Bernoulli, matched to a target duty cycle */
function night(m, opts) {
  const memCols = territories(ORDER);
  const G = SG.createGate(64, { lateral: opts.lateral == null ? 0.5 : opts.lateral,
                                seed: opts.seed });
  if (opts.lesionAll) SG.lesionAll(G);
  const rnd = SG.mulberry32(555 + opts.seed);
  const coin = SG.mulberry32(9000 + opts.seed);
  const hippocampusIntact = opts.hippocampus !== false;
  let armed = true, licensedWrites = 0, replayEvents = 0;
  SG.runNREM(G, NIGHT, (g, act, so) => {
    if (so > 0.5 && armed) {
      armed = false;
      if (!hippocampusIntact) return;
      replayEvents++;
      const k = 1 + Math.floor(rnd() * (opts.nMem - 1));
      let allow;
      if (opts.gate === "open") allow = true;
      else if (opts.gate === "coin") allow = coin() < opts.duty;
      else allow = SG.licensed(g, memCols[k]);
      if (allow) {
        const prevSet = new Set(m.hpc.indices[ORDER[k - 1]].cortex);
        KC.writeTransition(m.cons, prevSet, m.hpc.indices[ORDER[k]].cortex);
        licensedWrites++;
      }
    }
    if (so < 0.1) armed = true;
  });
  return { licensedWrites, replayEvents };
}
function cortexOnlyRecall(m, order) {
  return KC.corticalRecall(m.cortex, m.cons,
    order.map(s => m.hpc.indices[s].cortex), { start: 0 }).length;
}

/* ---------------- 1. the control stage 39 never ran (P1) ---------------- */
console.log("\n== 1. does the capacity signature need the thalamus at all? (P1) ==");
{
  const rows = [];
  console.log("  lateral   nMem | total weight   per-memory | writes / replay");
  for (const lateral of [0, 0.5, 0.9]) {
    for (const nMem of [2, 3, 6]) {
      const T = [], P = [], W = [];
      for (const s of SEEDS) {
        const m = build(s);
        const r = night(m, { lateral, seed: s, nMem, gate: "reticular" });
        const c = consolidatedWeight(m.cons, m.hpc, ORDER.slice(0, nMem));
        T.push(c.total); P.push(c.mean); W.push(r.licensedWrites);
      }
      rows.push({ lateral, nMem, total: mean(T), per: mean(P), writes: mean(W) });
      console.log("  " + f(lateral, 1).padStart(7) + "   " + String(nMem).padStart(4) + " |    " +
                  f(mean(T), 3) + "        " + f(mean(P), 3) + "  |   " + f(mean(W), 0));
    }
    console.log("");
  }
  out.confound = rows;
  const at = (lat, n) => rows.find(r => r.lateral === lat && r.nMem === n);
  // "capacity signature" = total roughly flat between 3 and 6 memories while per-memory falls
  const sig = lat => {
    const a = at(lat, 3), b = at(lat, 6);
    return b.per < 0.6 * a.per && b.total > 0.8 * a.total;
  };
  ok("the capacity signature appears with NO reticular competition (P1)", sig(0),
     "at lateral = 0 — global, simultaneous spindles, the assumption this module was built to " +
     "argue against — total goes " + f(at(0, 2).total, 3).trim() + " → " + f(at(0, 3).total, 3).trim() +
     " → " + f(at(0, 6).total, 3).trim() + " while per-memory goes " + f(at(0, 2).per, 3).trim() +
     " → " + f(at(0, 3).per, 3).trim() + " → " + f(at(0, 6).per, 3).trim() +
     ". Same shape as lateral = 0.5. STAGE 39's P2 ATTRIBUTION IS WITHDRAWN.");
  console.log("  WHY. `scheduledNight` rehearses ONE memory per ripple, and the ripple count is");
  console.log("  fixed by the night's length. That is already a fixed budget, before any thalamus");
  console.log("  is consulted: total writes cannot exceed the ripple count, so dividing them among");
  console.log("  more memories must lower the per-memory share. The signature is arithmetic.");
}

/* ---------------- 2. what the gate does do (P2) ---------------- */
console.log("\n== 2. so what IS the reticular gate contributing? (P2) ==");
{
  const rows = [];
  for (const lateral of [0, 0.3, 0.5, 0.7, 0.9]) {
    const T = [], W = [], R = [];
    for (const s of SEEDS) {
      const m = build(s);
      const r = night(m, { lateral, seed: s, nMem: 6, gate: "reticular" });
      T.push(consolidatedWeight(m.cons, m.hpc, ORDER).total);
      W.push(r.licensedWrites); R.push(cortexOnlyRecall(m, ORDER));
    }
    rows.push({ lateral, total: mean(T), writes: mean(W), recall: mean(R) });
  }
  out.gain = rows;
  console.log("  lateral | total weight | licensed writes | cortex-only recall");
  for (const r of rows)
    console.log("  " + f(r.lateral, 1).padStart(7) + " |    " + f(r.total, 3) + "     |      " +
                f(r.writes, 0).padStart(3) + "        |     " + f(r.recall, 2));
  const mono = rows.every((r, i) => i === 0 || r.total <= rows[i - 1].total + 0.02);
  ok("competition sets the GAIN on consolidation, monotonically (P2)", mono,
     "total weight " + rows.map(r => f(r.total, 2).trim()).join(" → ") + " as lateral rises " +
     rows.map(r => r.lateral).join(" → ") + ". A throughput claim, not a capacity-limit claim — " +
     "and the two support very different papers.");
}

/* ---------------- 3. is the lesion dissociation evidence for anything? (P3) ---------------- */
console.log("\n== 3. is the lesion dissociation specific to the reticular nucleus? (P3) ==");
{
  /* Match a CONTENT-BLIND coin to the reticular gate's duty cycle, then lesion each. If a coin
     flip reproduces the dissociation, then "replay intact, consolidation abolished" is a property
     of putting ANYTHING in series with the write step, and is not evidence about the thalamus. */
  const duty = [];
  for (const s of SEEDS) {
    const m = build(s);
    const r = night(m, { lateral: 0.5, seed: s, nMem: 6, gate: "reticular" });
    duty.push(r.licensedWrites / r.replayEvents);
  }
  const D = mean(duty);
  const conds = {
    "reticular gate": { gate: "reticular", lateral: 0.5 },
    "reticular LESIONED": { gate: "reticular", lateral: 0.5, lesionAll: true },
    "coin gate (matched)": { gate: "coin", duty: D },
    "coin gate, p = 0": { gate: "coin", duty: 0 },
    "hippocampal lesion": { gate: "reticular", lateral: 0.5, hippocampus: false },
  };
  const rows = {};
  for (const tag of Object.keys(conds)) {
    const T = [], R = [], RE = [];
    for (const s of SEEDS) {
      const m = build(s);
      const r = night(m, Object.assign({ seed: s, nMem: 6 }, conds[tag]));
      T.push(consolidatedWeight(m.cons, m.hpc, ORDER).mean);
      R.push(cortexOnlyRecall(m, ORDER)); RE.push(r.replayEvents);
    }
    rows[tag] = { weight: mean(T), recall: mean(R), replay: mean(RE) };
  }
  out.specificity = { duty: D, rows };
  console.log("  reticular gate duty cycle = " + f(D, 3) + ", matched into the coin");
  console.log("  condition               replay   weight   cortex-only recall");
  for (const tag of Object.keys(rows)) {
    const r = rows[tag];
    console.log("  " + tag.padEnd(23) + f(r.replay, 0).padStart(5) + "    " + f(r.weight, 3) +
                "        " + f(r.recall, 2));
  }
  ok("a content-blind coin reproduces the dissociation (P3)",
     rows["coin gate, p = 0"].weight < 0.1 * rows["coin gate (matched)"].weight &&
     rows["coin gate, p = 0"].replay === rows["coin gate (matched)"].replay,
     "at p = 0 the coin abolishes consolidation with replay untouched, exactly as the lesioned " +
     "reticular gate does. So 'replay intact, consolidation abolished' follows from placing ANY " +
     "element in series with the write step. It shows the dissociation is CONSISTENT with a " +
     "thalamic gate; it is not evidence FOR one.");
}

console.log("\n== what survives, stated plainly ==");
{
  console.log("  WITHDRAWN. Stage 39's P2 — the capacity limit as the reticular scheduler's doing.");
  console.log("  The limit is one-memory-per-ripple times a fixed ripple count, and it is present");
  console.log("  in full with the competition switched off. Stage 38's framing inherits the same");
  console.log("  problem: 'memories compete for spindle slots' was measured in licensed events,");
  console.log("  which are also budgeted by the ripple count.");
  console.log("");
  console.log("  DOWNGRADED. The lesion dissociation is consistent with a thalamic gate but is not");
  console.log("  evidence for one, because a coin in series does the same thing. It remains a");
  console.log("  useful demonstration that a gate CAN produce the diencephalic-vs-medial-temporal");
  console.log("  pattern; it cannot argue that the reticular nucleus IS that gate.");
  console.log("");
  console.log("  ALSO WITHDRAWN, and this was the fallback. §2 predicted competition sets a GAIN on");
  console.log("  consolidation monotonically. It does not: 1.54 → 1.60 → 0.63 → 0.33 → 0.43 as");
  console.log("  lateral rises. Below ~0.3 the gate is effectively OPEN (a sector is almost always");
  console.log("  up somewhere, so licence is near-certain); past that it falls off a cliff; beyond");
  console.log("  0.7 it is non-monotonic noise. 'Gain' implies a knob, and this is a threshold with");
  console.log("  a ragged tail. The fallback claim does not survive either.");
  console.log("");
  console.log("  WORSE, AND THE MOST DAMAGING NUMBER IN THE FILE. In §3 the content-blind coin,");
  console.log("  matched to the reticular gate's duty cycle, reaches essentially the same weight");
  console.log("  (0.121 vs 0.127) but BETTER cortex-only recall (2.80 vs 1.60). The reason is that");
  console.log("  reticular licensing is temporally CLUSTERED — spindles come in bouts — so writes");
  console.log("  pile onto whichever memories happen to be offered inside a bout, while an i.i.d.");
  console.log("  coin spreads the same number of writes evenly across memories. At equal");
  console.log("  throughput the thalamic gate is WORSE than a coin flip at building a usable");
  console.log("  cortical sequence. Nothing in the account predicted that, and it is the opposite");
  console.log("  of a scheduler earning its keep.");
  console.log("");
  console.log("  STANDS. Only stage 40 §4–6: the gate is fair rather than selective unless");
  console.log("  something biases it. That is a negative result about a mechanism, which is worth");
  console.log("  something — but it is not the paper stage 38 thought it was starting.");
  console.log("");
  console.log("  METHOD NOTE. The missing control was a single line — lateral = 0 — and it was");
  console.log("  never run because the result it would have killed was the one being hoped for.");
  console.log("  Stage 38 varied lateral to show LOCALITY changes, and then measured capacity at");
  console.log("  one value of lateral without re-varying it. Vary the mechanism parameter in EVERY");
  console.log("  measurement that claims the mechanism, not just the one that introduces it.");
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "confound.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
