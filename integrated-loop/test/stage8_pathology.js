"use strict";
/* Stage-8 — PATHOLOGY. Does anatomically specific damage break the circuit in the ways real
   damage breaks memory? Each test looks for a DISSOCIATION, not a global decline: a lesion that
   degrades everything proves nothing, whereas a lesion that spares one capacity while abolishing
   another reproduces a clinical syndrome.

     P1  hippocampal lesion       → temporally graded retrograde amnesia   (Scoville & Milner 1957;
                                     recent abolished, remote spared        Squire & Alvarez 1995;
                                                                            Kim & Fanselow 1992)
     P2  entorhinal layer II loss → anterograde ≫ retrograde                (Gómez-Isla 1996: EC LII
                                     the early-Alzheimer signature           is the first field lost)
     P3  dentate disinhibition    → pattern separation fails, retrieval      (Yassa & Stark 2011;
                                     becomes promiscuous                      Small 2011 DG/CA3)
     P4  CA3 sprouting + PV loss  → self-sustaining runaway; impossible      (temporal-lobe epilepsy;
                                     without the sprouted recurrence          Nadler; Sutula)

   Everything is measured with the same instruments used in the healthy validation, so a
   pathological number is directly comparable to its intact counterpart.                       */

const L = require("../src/loop.js");
const K = require("../src/consolidate.js");
const { C, H } = L;

let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const ORDER = [0, 1, 2, 3, 4, 5];
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

function build(seed, hopts) {
  const cortex = C.create({ seed, NC: 800, nStim: 8 }); C.encode(cortex);
  const hpc = H.createHPC(Object.assign({ seed: 100 + seed * 7, NC: cortex.N }, hopts));
  hpc.plastic = true;
  return { cortex, hpc };
}
const encRank = () => { const e = {}; ORDER.forEach((s, k) => e[k] = k); return e; };

/* ------------------------------------------------------------------ P1 */
console.log("\n== P1 · hippocampal lesion: temporally graded retrograde amnesia ==");
{
  const AGES = [0, 2, 4, 6, 10, 20, 34];       // replay events = age of the memory
  const rows = [];
  for (const seed of [1, 2, 3]) {
    const { cortex, hpc } = build(seed);
    L.encodeSequence(cortex, hpc, ORDER);
    const A = hpc.indices.map(x => x.cortex), enc = encRank();
    const cons = K.createConsolidation(cortex);
    const row = [];
    for (const age of AGES) {
      K.consolidate(cortex, hpc, cons, age - cons.events, { order: ORDER });
      // "hippocampus lesioned" = recall must run on cortex alone
      row.push(L.spearman(K.corticalRecall(cortex, cons, A, {}), enc).rho);
    }
    rows.push(row);
  }
  const curve = AGES.map((_, i) => mean(rows.map(r => r[i])));
  console.log("  memory age (replay events): " + AGES.join("  "));
  console.log("  recall after HPC lesion:    " + curve.map(v => f(v)).join(" "));
  ok("recent memory abolished by the lesion (ρ ≤ 0.4 at 0–2 events)",
     curve[0] <= 0.4 && curve[1] <= 0.4, "= " + f(curve[0]) + ", " + f(curve[1]));
  ok("remote memory spared (ρ ≥ 0.8 at ≥10 events)", curve[4] >= 0.8, "= " + f(curve[4]));
  ok("the gradient is temporal, not all-or-none", curve[curve.length - 1] - curve[0] >= 0.6,
     "Δ = " + f(curve[curve.length - 1] - curve[0]));
}

/* ------------------------------------------------------------------ P2 */
console.log("\n== P2 · entorhinal layer II loss: the early-Alzheimer dissociation ==");
{
  const FRACS = [0, 0.3, 0.6, 0.9];
  const newEnc = [], oldRecall = [], hpcRecall = [];
  for (const frac of FRACS) {
    const nE = [], oR = [], hR = [];
    for (const seed of [1, 2]) {
      // First: a memory laid down and consolidated BEFORE the disease
      const { cortex, hpc } = build(seed);
      L.encodeSequence(cortex, hpc, ORDER);
      const A = hpc.indices.map(x => x.cortex), enc = encRank();
      const cons = K.createConsolidation(cortex);
      K.consolidate(cortex, hpc, cons, 34, { order: ORDER });
      // Now the disease: entorhinal layer II is lost
      if (frac > 0) H.lesionField(hpc, "ec2", frac, 4242);
      // (a) retrieval of the OLD, already-consolidated memory — cortex alone
      oR.push(L.spearman(K.corticalRecall(cortex, cons, A, {}), enc).rho);
      // (b) CUE-DRIVEN retrieval: a partial cortical cue must reach CA3 through EC II and
      // recover the right index. This is the route the lesion actually sits on — seeding CA3
      // directly (as replay does) bypasses entorhinal cortex and would show nothing.
      let hit = 0;
      for (let k = 0; k < ORDER.length; k++) {
        const stored = new Set(hpc.indices[k].cells);
        cortex.a.fill(0); cortex.inh = 0;
        C.present(cortex, hpc.indices[k].s, 0.6, 0.35, true);   // partial cue
        L.settleForward(hpc, cortex.a, 80);
        const got = H.activeSet(hpc.ca3, hpc.P.actThr);
        let ov = 0; for (const q of got) if (stored.has(q)) ov++;
        hit += ov / Math.max(1, stored.size);
      }
      hR.push(hit / ORDER.length);
      // (c) can a NEW memory still be encoded DISTINCTLY? bind a fresh sequence and measure
      // how separable its indices are — size alone is renormalised by feedback inhibition.
      const fresh = [6, 7, 0, 1];
      L.encodeSequence(cortex, hpc, fresh);
      const fi = hpc.indices.map(x => x.cells);
      let o = 0, n = 0, sz = 0;
      for (let i = 0; i < fi.length; i++) { sz += fi[i].length;
        for (let j = i + 1; j < fi.length; j++) { const b = new Set(fi[j]); let c = 0;
          for (const q of fi[i]) if (b.has(q)) c++; o += c; n++; } }
      nE.push(1 - (o / n) / Math.max(1, sz / fi.length));       // index DISTINCTNESS
    }
    newEnc.push(mean(nE)); oldRecall.push(mean(oR)); hpcRecall.push(mean(hR));
  }
  console.log("  EC-II loss:                " + FRACS.map(x => f(x * 100, 0) + "%").join("    "));
  console.log("  new index distinctness:    " + newEnc.map(v => f(v)).join("  "));
  console.log("  cue-driven retrieval:      " + hpcRecall.map(v => f(v)).join("  "));
  console.log("  consolidated recall:       " + oldRecall.map(v => f(v)).join("  "));
  const dNew = (newEnc[0] - newEnc[3]) / Math.max(1e-9, newEnc[0]);
  const dCue = (hpcRecall[0] - hpcRecall[3]) / Math.max(1e-9, hpcRecall[0]);
  const dOld = (oldRecall[0] - oldRecall[3]) / Math.max(1e-9, oldRecall[0]);
  ok("EC-II loss degrades cue-driven (hippocampal) retrieval", dCue >= 0.25,
     "-" + f(dCue * 100, 0) + "% at 90% loss");
  ok("already-consolidated recall is SPARED", oldRecall[3] >= 0.8, "ρ = " + f(oldRecall[3]));
  ok("dissociation: hippocampal route hit far harder than the consolidated store",
     dCue > dOld + 0.2, "cue -" + f(dCue * 100, 0) + "% vs consolidated -" + f(dOld * 100, 0) + "%");
}

/* ------------------------------------------------------------------ P3 */
console.log("\n== P3 · dentate disinhibition: pattern separation fails ==");
{
  const GAINS = [1.0, 0.5, 0.25];              // multiplier on DG feedback inhibition
  const sep = [], cross = [];
  for (const g of GAINS) {
    const s0 = [], x0 = [];
    for (const seed of [1, 2]) {
      const { cortex, hpc } = build(seed, { gDG: 377.0 * g });
      L.encodeSequence(cortex, hpc, ORDER);
      const idx = hpc.indices.map(x => x.cells);
      let o = 0, n = 0, sz = 0;
      for (let i = 0; i < idx.length; i++) { sz += idx[i].length;
        for (let j = i + 1; j < idx.length; j++) { const b = new Set(idx[j]); let c = 0;
          for (const q of idx[i]) if (b.has(q)) c++; o += c; n++; } }
      s0.push((o / n) / Math.max(1, sz / idx.length));       // index overlap as a fraction
      const A = hpc.indices.map(x => new Set(x.cortex));
      let cr = 0;
      for (let k = 0; k < ORDER.length; k++) {
        const got = new Set(L.reinstateFromIndex(cortex, hpc, k));
        let mx = 0;
        for (let j = 0; j < ORDER.length; j++) { if (j === k) continue; let c = 0;
          for (const q of A[j]) if (got.has(q)) c++; mx = Math.max(mx, c / Math.max(1, A[j].size)); }
        cr += mx;
      }
      x0.push(cr / ORDER.length);
    }
    sep.push(mean(s0)); cross.push(mean(x0));
  }
  console.log("  DG inhibition:      " + GAINS.map(g => f(g * 100, 0) + "%").join("   "));
  console.log("  index overlap:      " + sep.map(v => f(v * 100, 1) + "%").join("  "));
  console.log("  retrieval crosstalk:" + cross.map(v => f(v)).join("   "));
  ok("disinhibiting DG degrades separation (overlap rises)", sep[2] > sep[0] * 1.3,
     f(sep[0] * 100, 1) + "% → " + f(sep[2] * 100, 1) + "%");
  ok("retrieval becomes promiscuous (crosstalk rises)", cross[2] > cross[0] + 0.05,
     f(cross[0]) + " → " + f(cross[2]));
}

/* ------------------------------------------------------------------ P4 */
console.log("\n== P4 · CA3 sprouting + PV loss: self-sustaining runaway ==");
{
  function igniteRelease(sproutGain, pvFrac) {
    const { cortex, hpc } = build(1, { gCA3: 202.4 * pvFrac });
    L.encodeSequence(cortex, hpc, ORDER);
    if (sproutGain > 1) H.sprout(hpc, sproutGain);
    hpc.P.ach = 0.15;                            // low-ACh: recurrence un-gated
    hpc.P.seqGain = 0;                           // isolate RECURRENCE: without this the directed
                                                 // transition drive dominates and masks sprouting
    // ignite one index, then release and let the network run on its own
    hpc.ca3.fill(0); for (const c of hpc.indices[0].cells) hpc.ca3[c] = 1.0;
    hpc.adapt3.fill(0); hpc.iCA3 = 0;
    for (let t = 0; t < 1200; t++) H.replayStep(hpc);
    let act = 0; for (let i = 0; i < hpc.P.NCA3; i++) if (hpc.ca3[i] > hpc.P.actThr) act++;
    return act / hpc.P.NCA3;
  }
  const healthy = igniteRelease(1, 1.0);
  const pvOnly = igniteRelease(1, 0.35);
  const sproutOnly = igniteRelease(3.0, 1.0);
  const both = igniteRelease(3.0, 0.35);
  console.log("  CA3 active 1.2 s after the drive is released:");
  console.log("    healthy                " + f(healthy * 100, 1) + "%");
  console.log("    PV loss only           " + f(pvOnly * 100, 1) + "%");
  console.log("    sprouting only         " + f(sproutOnly * 100, 1) + "%");
  console.log("    sprouting + PV loss    " + f(both * 100, 1) + "%");
  ok("healthy CA3 does not self-sustain", healthy <= 0.20, "= " + f(healthy * 100, 1) + "%");
  ok("sprouting + PV loss produces runaway", both >= 0.40, "= " + f(both * 100, 1) + "%");
  ok("runaway needs BOTH insults (neither alone suffices)",
     both > pvOnly + 0.15 && both > sproutOnly + 0.15,
     "both " + f(both * 100, 0) + "% vs PV " + f(pvOnly * 100, 0) + "% / sprout " + f(sproutOnly * 100, 0) + "%");
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
