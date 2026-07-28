"use strict";
/* Stage-15 — THE LIMBIC THALAMUS: diencephalic amnesia, recollection vs familiarity,
   and thalamic neglect.

   The model already had a thalamus — the first-order one that generates the NREM state. This
   is the higher-order limbic thalamus, and it reaches three clinical facts nothing else here
   can: amnesia WITHOUT a hippocampal lesion, the recollection/familiarity split, and neglect
   WITHOUT a parietal lesion.

   The Papez return is wired into the real retrieval path — it multiplies the hippocampal
   reinstatement in bilateral.js — so diencephalic amnesia is measured on the SAME
   cross-stream conjunction task as stage 13, scored against the same cortex-alone floor.
   Nothing about the memory model changes; only the circuit that returns to entorhinal cortex.

   PREDICTIONS REGISTERED BEFORE RUNNING:
     (1) A bilateral lesion anywhere on the Papez chain abolishes recollection while the
         hippocampus is untouched — amnesia from a diencephalic lesion.
     (2) NOT all nodes are equally vulnerable. The chain is a series of THRESHOLDED stages, so
         at equal partial severity a PROXIMAL lesion (fornix, mammillary bodies) should cost
         more than a DISTAL one (retrosplenial, cingulum), because the loss compounds through
         every stage downstream. This is the non-trivial consequence of the topology and the
         one thing here that is a genuine prediction rather than a reproduction.
     (3) RECOLLECTION and FAMILIARITY doubly dissociate (Aggleton & Brown 1999): an ATN/Papez
         lesion costs recollection and spares familiarity; an MD/perirhinal lesion the reverse.
     (4) Unilateral lesions are compensated, bilateral are not — as for the hippocampus.
     (5) A PULVINAR lesion produces neglect with parietal cortex intact AND a normal visual
         field — thalamic neglect, a third entry in the neglect/hemianopia differential.
     (6) The two thalamic routes doubly dissociate at the syndrome level: the Papez lesion
         causes amnesia and not neglect, the pulvinar lesion neglect and not amnesia. */

const T = require("../src/limbicthalamus.js");
const B = require("../src/bilateral.js");
const C = require("../src/cortex.js");
const PAR = require("../src/parietal.js");
const VP = require("../src/visualpathway.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};
const SUB = 0.8;                       // subicular output level driving the circuit

/* ---------------- 1. the chain ---------------- */
console.log("\n== 1. the circuit of Papez as a chain of thresholded stages ==");
{
  const S = T.createLimbic(), rows = [];
  for (const sub of [0.2, 0.4, 0.6, 0.8, 1.0]) {
    const ec = T.papezReturn(S, sub);
    rows.push({ sub, mb: S.act.mb.L, atn: S.act.atn.L, rsc: S.act.rsc.L, ec });
    console.log("  subiculum " + f(sub, 1) + "  → mammillary " + f(S.act.mb.L) + "  ATN " + f(S.act.atn.L) +
                "  retrosplenial " + f(S.act.rsc.L) + "  entorhinal " + f(ec));
  }
  out.chain = rows;
  ok("the chain propagates in a graded way, without pinning at the ceiling",
     rows[3].ec > 0.3 && rows[4].ec < 1.2, "entorhinal return " + f(rows[3].ec) + " at subiculum 0.8");
  ok("…and has a floor: too little subicular drive does not get through",
     rows[0].ec === 0, "0.2 subicular drive → " + f(rows[0].ec));
}

/* ---------------- 2. where on the chain does it matter most? ---------------- */
console.log("\n== 2. is the chain uniformly vulnerable? (the registered prediction) ==");
{
  const rows = {};
  for (const frac of [0.2, 0.3, 0.4, 0.5, 0.8, 1.0]) {
    rows[frac] = {};
    const line = [];
    for (const n of T.PAPEZ_NODES) {
      const S = T.createLimbic(); T.lesion(S, n, "both", frac);
      const v = T.papezReturn(S, SUB);
      rows[frac][n] = v; line.push(n + " " + f(v, 2));
    }
    console.log("  lesion " + f(frac, 1) + "   " + line.join("  "));
  }
  out.vulnerability = rows;
  const proximal = ["fornix", "mb"], distal = ["rsc", "cingulum"];
  const at = 0.3;
  const pm = mean(proximal.map(n => rows[at][n])), dm = mean(distal.map(n => rows[at][n]));
  ok("a bilateral lesion ANYWHERE on the chain abolishes the return (P1)",
     T.PAPEZ_NODES.every(n => rows[1.0][n] === 0), "all six nodes → 0 at complete lesion");
  ok("PROXIMAL lesions cost more than DISTAL ones at equal severity (P2)", pm < dm - 0.05,
     "at lesion " + at + ": fornix/mammillary " + f(pm) + " vs retrosplenial/cingulum " + f(dm) +
     " — the loss compounds through every stage downstream");
}

/* ---------------- 3. unilateral vs bilateral ---------------- */
console.log("\n== 3. unilateral vs bilateral ==");
{
  const rows = {};
  for (const n of T.PAPEZ_NODES) {
    const U = T.createLimbic(); T.lesion(U, n, "L", 1.0);
    const Bi = T.createLimbic(); T.lesion(Bi, n, "both", 1.0);
    rows[n] = { uni: T.papezReturn(U, SUB), bi: T.papezReturn(Bi, SUB) };
  }
  out.laterality = rows;
  console.log("  unilateral " + f(rows.atn.uni) + "   bilateral " + f(rows.atn.bi) + "   (ATN, complete)");
  ok("unilateral lesions are compensated, bilateral are not (P4)",
     T.PAPEZ_NODES.every(n => rows[n].uni > 0.3 && rows[n].bi === 0), "at every node");
  // stated, not hidden: compensation here is COMPLETE, where clinically a left-sided
  // thalamic lesion does produce a material-specific verbal memory deficit
  console.log("  limitation: compensation is COMPLETE here (either side suffices). Clinically a");
  console.log("  LEFT anterior thalamic lesion does impair verbal memory — this circuit is not");
  console.log("  lateralised by material the way the hippocampi in stage 13 are.");
}

/* ---------------- 4. diencephalic amnesia, on the stage-13 task ---------------- */
console.log("\n== 4. AMNESIA FROM A DIENCEPHALIC LESION, hippocampus untouched ==");
{
  const PAIRS = [[0, 4], [1, 5], [2, 6], [3, 7]];
  const SEEDS = [1, 2, 3];
  const conds = [
    ["intact", null], ["fornix (bilateral)", "fornix"], ["mammillary bodies", "mb"],
    ["MTT", "mtt"], ["anterior thalamus", "atn"],
  ];
  const res = {};
  const intactGain = T.papezReturn(T.createLimbic(), SUB);
  for (const [name, node] of conds) {
    const S = T.createLimbic(); if (node) T.lesion(S, node, "both", 1.0);
    const pz = T.papezReturn(S, SUB) / intactGain;         // normalised recollective gain
    const rows = SEEDS.map(s => {
      const cortex = C.create({ seed: s, NC: 800, nStim: 8 }); C.encode(cortex);
      const brain = B.createBrain({ seed: 100 + s * 7, NC: cortex.N });
      const eps = B.makeEpisodes(cortex, brain, PAIRS);
      B.encodeEpisodes(cortex, brain, eps);                 // hippocampus encodes normally
      return B.testList(cortex, brain, eps, { scale: 0.20, cue: 0.35, papez: pz });
    });
    const V = mean(rows.map(r => r.V)), D = mean(rows.map(r => r.D));
    const fV = mean(rows.map(r => r.floorV)), fD = mean(rows.map(r => r.floorD));
    res[name] = { papez: pz, V, D, floorV: fV, floorD: fD };
    console.log("  " + name.padEnd(20) + "recollective gain " + f(pz, 2) +
                "   recovery " + f(V, 2) + "/" + f(D, 2) + "   (floor " + f(fV, 2) + "/" + f(fD, 2) + ")");
  }
  out.amnesia = res;
  const I = res["intact"], A = res["anterior thalamus"];
  ok("an intact hippocampus plus a broken Papez circuit is AMNESIC (P1)",
     (A.V + A.D) / 2 < (A.floorV + A.floorD) / 2 + 0.05,
     "recovery " + f((A.V + A.D) / 2, 2) + " vs cortical floor " + f((A.floorV + A.floorD) / 2, 2));
  ok("…and the intact circuit is not", (I.V + I.D) / 2 > (I.floorV + I.floorD) / 2 + 0.15,
     "above floor by " + f((I.V + I.D) / 2 - (I.floorV + I.floorD) / 2, 2));
  ok("every node of the chain gives the same amnesia when completely cut",
     ["fornix (bilateral)", "mammillary bodies", "MTT", "anterior thalamus"]
       .every(k => Math.abs((res[k].V + res[k].D) / 2 - (A.V + A.D) / 2) < 0.03),
     "fornix, mammillary, MTT and ATN are interchangeable at complete lesion");
}

/* ---------------- 5. recollection vs familiarity ---------------- */
console.log("\n== 5. RECOLLECTION vs FAMILIARITY — the Aggleton & Brown double dissociation ==");
{
  const rnd = T.mulberry32(9);
  const mkPat = () => Float64Array.from({ length: 120 }, () => (rnd() < 0.15 ? 1 : 0));
  const studied = [mkPat(), mkPat(), mkPat(), mkPat()], foils = [mkPat(), mkPat(), mkPat(), mkPat()];
  const intactGain = T.papezReturn(T.createLimbic(), SUB);
  const rows = {};
  for (const [name, node] of [["intact", null], ["ATN (Papez route)", "atn"],
                              ["MD (perirhinal route)", "md"], ["perirhinal", "prh"]]) {
    const S = T.createLimbic();
    for (const p of studied) T.studyItem(S, p);
    if (node) T.lesion(S, node, "both", 1.0);
    const rec = T.papezReturn(S, SUB) / intactGain;
    const fam = mean(studied.map(p => T.familiarity(S, p))) - mean(foils.map(p => T.familiarity(S, p)));
    rows[name] = { rec, fam };
    console.log("  " + name.padEnd(24) + "recollection " + f(rec, 2) + "   familiarity " + f(fam, 2));
  }
  out.dualProcess = rows;
  const I = rows["intact"], A = rows["ATN (Papez route)"], M = rows["MD (perirhinal route)"];
  ok("the Papez lesion costs RECOLLECTION and spares FAMILIARITY",
     A.rec < 0.1 && A.fam > I.fam - 0.05, "recollection " + f(A.rec, 2) + ", familiarity " + f(A.fam, 2));
  ok("the MD lesion costs FAMILIARITY and spares RECOLLECTION",
     M.fam < 0.1 && M.rec > I.rec - 0.05, "familiarity " + f(M.fam, 2) + ", recollection " + f(M.rec, 2));
  ok("the two routes doubly dissociate (P3)",
     A.rec < M.rec && M.fam < A.fam, "each lesion costs its own route and not the other");
}

/* ---------------- 6. thalamic neglect ---------------- */
console.log("\n== 6. THALAMIC NEGLECT — pulvinar lesion, parietal cortex intact ==");
{
  const TGT = -0.7, COMP = +0.7;
  const rows = {};
  for (const [name, node, frac] of [["intact", null, 0], ["right pulvinar", "pulvinar", 0.6],
                                    ["right parietal cortex", null, 0.6]]) {
    const S = T.createLimbic();
    const par = PAR.createParietal();
    if (node) { T.lesion(S, node, "R", frac); T.drivePulvinar(S, par); }
    else if (frac) PAR.lesionParietal(par, "R", frac);
    else T.drivePulvinar(S, par);
    const e = PAR.extinction(par, TGT, COMP);
    const bis = PAR.bisect(par, PAR.attend(par, PAR.line(par, -1, 1)));
    rows[name] = { alone: e.alone, both: e.both, bisect: bis,
                   parietalIntact: par.intact.R, extinguished: e.aloneDetected && !e.bothDetected };
    console.log("  " + name.padEnd(24) + "target alone " + f(e.alone, 2) + " → with competitor " +
                f(e.both, 2) + "   bisection " + f(bis, 2) +
                (rows[name].extinguished ? "   EXTINGUISHED" : ""));
  }
  // the visual field, through the stage-12 pathway — the thalamic lesion is not in it
  const perim = VP.region(VP.chartPair(null, 12).L, u => u < 0.5);
  out.thalamicNeglect = { rows, perimetry: perim };
  console.log("  left-field perimetry with the pulvinar lesion: " + f(perim, 2) + " (normal)");
  ok("a pulvinar lesion produces extinction (P5)", rows["right pulvinar"].extinguished,
     f(rows["right pulvinar"].alone, 2) + " → " + f(rows["right pulvinar"].both, 2));
  ok("…with the visual field normal", perim > 0.6, f(perim, 2));
  ok("…and it looks like the parietal syndrome at the bedside",
     Math.abs(rows["right pulvinar"].bisect - rows["right parietal cortex"].bisect) < 0.2,
     "bisection " + f(rows["right pulvinar"].bisect, 2) + " vs " +
     f(rows["right parietal cortex"].bisect, 2) + " — indistinguishable without imaging");
  // Stated plainly: the pulvinar enters as a multiplicative gain on the SAME parietal
  // capacity a cortical lesion reduces, so bedside equivalence is true by construction here.
  // What the model contributes is the claim that thalamic and cortical neglect share a final
  // common path, and the consequence that follows from it — the visual field stays normal in
  // BOTH, so perimetry cannot separate them either. Only the lesion site does.
  console.log("  (bedside equivalence is by construction: the pulvinar is a gain on the same");
  console.log("   parietal capacity. The consequence — that perimetry separates neither — is not.)");
}

/* ---------------- 7. the two thalamic routes, at the syndrome level ---------------- */
console.log("\n== 7. do the memory and attention thalami dissociate? ==");
{
  const intactGain = T.papezReturn(T.createLimbic(), SUB);
  const rows = {};
  for (const [name, node] of [["ATN (memory)", "atn"], ["pulvinar (attention)", "pulvinar"]]) {
    const S = T.createLimbic(); T.lesion(S, node, node === "atn" ? "both" : "R", node === "atn" ? 1.0 : 0.6);
    const rec = T.papezReturn(S, SUB) / intactGain;
    const par = PAR.createParietal(); T.drivePulvinar(S, par);
    const e = PAR.extinction(par, -0.7, +0.7);
    rows[name] = { recollection: rec, extinguished: e.aloneDetected && !e.bothDetected, both: e.both };
    console.log("  " + name.padEnd(22) + "recollection " + f(rec, 2) +
                "   neglect: " + (rows[name].extinguished ? "YES" : "no"));
  }
  out.syndromeDissociation = rows;
  ok("the memory thalamus causes amnesia and NOT neglect (P6)",
     rows["ATN (memory)"].recollection < 0.1 && !rows["ATN (memory)"].extinguished);
  ok("the attention thalamus causes neglect and NOT amnesia",
     rows["pulvinar (attention)"].recollection > 0.9 && rows["pulvinar (attention)"].extinguished);
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "papez.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
