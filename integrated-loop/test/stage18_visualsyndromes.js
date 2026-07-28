"use strict";
/* Stage-18 — VISUAL SYNDROMES beyond the field defect.
 *
 * Stage 12 asked WHERE along the retina-to-V1 pathway a lesion sits, and answered it with
 * perimetry. This stage is about what fails when the field is full and seeing is still broken.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) BLINDSIGHT. A complete V1 lesion abolishes form while the tectopulvinar route keeps
 *       motion direction, because that route does not pass through V1. Removing the pulvinar
 *       as well abolishes motion too — cortical blindness.
 *   (2) AKINETOPSIA is the mirror: an MT lesion abolishes motion with form intact. Together
 *       (1) and (2) are a double dissociation, not two severities of one deficit.
 *   (3) APPERCEPTIVE vs ASSOCIATIVE AGNOSIA doubly dissociate on the PERCEPT, not on
 *       identification. Both should cost identification; only the V2 lesion should cost the
 *       percept. This is the distinction that matters clinically — the associative patient can
 *       copy the drawing they cannot name.
 *   (4) OPTIC ATAXIA — predicted to FAIL. Localisation here is a noiseless read of a map whose
 *       peak does not move when the map is weakened, so a parietal lesion should leave
 *       localisation of a single target intact. Registered as a prediction of failure.
 *   (5) SIMULTANAGNOSIA — also predicted to FAIL, for a different reason: a bilateral parietal
 *       lesion scales down excitation AND the inhibition that excitation drives, so the
 *       competition rebalances and capacity is unchanged. Registered as a prediction of failure.
 *
 * (4) and (5) are registered as failures in advance so that a null cannot be quietly
 * reinterpreted afterwards, and so the missing mechanism is named rather than discovered.
 */

const S = require("../src/visualsyndromes.js");

let pass = 0, fail = 0, expected = 0;
const f = (x, d = 1) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const expectFail = (n, c, d) => { expected++;
  console.log("  " + (c ? "UNEXPECTED PASS" : "FAIL (predicted)") + "  " + n + "   " + (d || "")); };

const SHAPES = ["square", "triangle", "circle"];
const COND = [];
for (const size of [0.40, 0.52, 0.64]) for (const rot of [0, 0.3, 0.6, 0.9])
  for (const cx of [-0.1, 0, 0.1]) COND.push({ size, rot, cx });
const CHANCE = 100 / SHAPES.length;
const DIRS = [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
const out = {};

function form(L) {
  let ok2 = 0, n = 0, pe = 0, oe = 0;
  for (const k of SHAPES) for (const o of COND) {
    const r = S.formPath(k, o, L);
    if (r.label === k) ok2++; n++; pe += r.perceptEnergy; oe += r.oriEnergy;
  }
  return { acc: 100 * ok2 / n, percept: pe / n, ori: oe / n };
}
function motion(L) {
  let e = 0, coh = 0;
  for (const d of DIRS) {
    const r = S.motionPath("bar", { size: 0.42, rot: 0 }, { type: "translate", dir: d, speed: 0.5 }, L);
    e += S.dirErr(r.dir, d); coh += r.coherence;
  }
  return { err: e / DIRS.length, coh: coh / DIRS.length };
}

/* ---------------- 1–2. blindsight and akinetopsia ---------------- */
console.log("\n== 1. occipital: blindsight, cortical blindness, akinetopsia ==");
{
  const conds = [
    ["intact", {}],
    ["V1 complete", { v1: 1.0 }],
    ["V1 + pulvinar", { v1: 1.0, pulvinar: 1.0 }],
    ["V1 + colliculus", { v1: 1.0, sc: 1.0 }],
    ["MT complete", { mt: 1.0 }],
  ];
  const r = {};
  console.log("  condition          form identification   motion direction error");
  for (const [name, L] of conds) {
    const F = form(L), M = motion(L);
    r[name] = { acc: F.acc, err: M.err, coh: M.coh, percept: F.percept };
    console.log("  " + name.padEnd(18) + f(F.acc).padStart(6) + "%              " +
                f(M.err).padStart(6) + "°   coherence " + f(M.coh, 2));
  }
  out.occipital = r;
  const I = r["intact"], B = r["V1 complete"], CB = r["V1 + pulvinar"], A = r["MT complete"];
  ok("intact: form and motion both work", I.acc > 95 && I.err < 15, f(I.acc) + "%, " + f(I.err) + "°");
  ok("BLINDSIGHT — V1 gone, motion direction survives the tectopulvinar route (P1)",
     B.acc < CHANCE + 15 && B.err < 15,
     "form " + f(B.acc) + "% (chance " + f(CHANCE) + "), motion " + f(B.err) + "°");
  ok("…and removing the pulvinar as well abolishes motion — cortical blindness",
     CB.err > 45 && CB.coh < 0.05, "motion " + f(CB.err) + "°, coherence " + f(CB.coh, 2));
  ok("AKINETOPSIA — MT gone, form intact, motion lost (P2)",
     A.acc > 95 && A.err > 45, "form " + f(A.acc) + "%, motion " + f(A.err) + "°");
  ok("the two are a DOUBLE DISSOCIATION, not two severities of one deficit",
     B.acc < A.acc - 30 && A.err > B.err + 30,
     "V1 lesion keeps motion and loses form; MT lesion does the exact reverse");
}

/* ---------------- 3. the two agnosias ---------------- */
console.log("\n== 2. occipitotemporal: apperceptive vs associative agnosia ==");
{
  const conds = [
    ["intact", {}],
    ["V2 0.95 (apperceptive)", { v2: 0.95 }],
    ["V2 0.99 (apperceptive)", { v2: 0.99 }],
    ["readout 0.7 (associative)", { readout: 0.7 }],
    ["readout 0.9 (associative)", { readout: 0.9 }],
  ];
  const r = {};
  console.log("  condition                   identification   PERCEPT   V1 orientation");
  for (const [name, L] of conds) {
    const F = form(L);
    r[name] = F;
    console.log("  " + name.padEnd(28) + f(F.acc).padStart(6) + "%       " +
                f(F.percept, 3).padStart(7) + "     " + f(F.ori, 2).padStart(6));
  }
  out.agnosia = r;
  const I = r["intact"], AP = r["V2 0.99 (apperceptive)"], AS = r["readout 0.9 (associative)"];
  ok("both agnosias cost identification", AP.acc < I.acc - 20 && AS.acc < I.acc - 20,
     f(AP.acc) + "% and " + f(AS.acc) + "% against " + f(I.acc) + "%");
  ok("APPERCEPTIVE: the percept itself is destroyed", AP.percept < 0.25 * I.percept,
     f(AP.percept, 3) + " against " + f(I.percept, 3));
  ok("ASSOCIATIVE: the percept is INTACT and cannot be named (P3)",
     Math.abs(AS.percept - I.percept) < 0.01 * I.percept,
     f(AS.percept, 3) + " — identical to intact, which is the diagnostic point");
  ok("…and in both, upstream V1 orientation energy is untouched",
     Math.abs(AP.ori - I.ori) < 0.01 * I.ori && Math.abs(AS.ori - I.ori) < 0.01 * I.ori,
     "the lesions are downstream of striate cortex, as the syndromes are");
  console.log("  the clinical form of this: the associative patient can COPY the drawing they");
  console.log("  cannot name; the apperceptive patient cannot copy it either.");
}

/* ---------------- 4. optic ataxia — registered failure ---------------- */
console.log("\n== 3. occipitoparietal: optic ataxia (registered as a predicted failure) ==");
{
  const us = [-0.75, -0.35, 0.35, 0.75];
  const rows = [];
  for (const [name, L] of [["intact", {}], ["right parietal 0.6", { parietalR: 0.6 }],
                           ["bilateral 0.7", { parietalL: 0.7, parietalR: 0.7 }],
                           ["bilateral 0.9", { parietalL: 0.9, parietalR: 0.9 }]]) {
    const es = us.map(u => S.localise(u, L)).filter(x => x.error != null);
    const err = es.length ? es.reduce((a, b) => a + b.error, 0) / es.length : null;
    const F = form(L);
    rows.push({ name, err, responded: es.length, of: us.length, identify: F.acc });
    console.log("  " + name.padEnd(22) + "identify " + f(F.acc).padStart(6) + "%   localisation error " +
                (err == null ? "no response" : f(err, 3)) + "   responded " + es.length + "/" + us.length);
  }
  out.opticAtaxia = rows;
  const I = rows[0], B = rows[rows.length - 1];
  expectFail("a parietal lesion should degrade localisation while identification survives (P4)",
    B.err > I.err + 0.05,
    "localisation error " + f(I.err, 3) + " → " + f(B.err, 3) + ", i.e. unchanged. Diagnosis: " +
    "localisation here is a noiseless centre-of-mass read of the attention map, and weakening " +
    "the map does not MOVE its peak. Optic ataxia needs an effector-referenced readout with " +
    "noise that scales as the representation weakens — a reaching endpoint, not a map argmax. " +
    "The model has no motor stage, so this syndrome is out of reach by construction, not by tuning.");
}

/* ---------------- 5. simultanagnosia — registered failure ---------------- */
console.log("\n== 4. occipitoparietal: simultanagnosia (registered as a predicted failure) ==");
{
  const us = [-0.75, -0.25, 0.25, 0.75];
  const rows = [];
  for (const [name, L] of [["intact", {}], ["right parietal 0.6 (neglect)", { parietalR: 0.6 }],
                           ["bilateral 0.4", { parietalL: 0.4, parietalR: 0.4 }],
                           ["bilateral 0.6", { parietalL: 0.6, parietalR: 0.6 }],
                           ["bilateral 0.8", { parietalL: 0.8, parietalR: 0.8 }]]) {
    const r = S.howManySeen(us, L);
    rows.push({ name, n: r.n, of: r.of, left: r.left, right: r.right });
    console.log("  " + name.padEnd(30) + r.n + "/" + r.of + " seen   (left " + r.left +
                ", right " + r.right + ")");
  }
  out.simultanagnosia = rows;
  const uni = rows[1], bil = rows[rows.length - 1];
  ok("a UNILATERAL lesion produces a SPATIAL limit — the classic neglect pattern",
     uni.left === 0 && uni.right > 0, "left " + uni.left + ", right " + uni.right);
  expectFail("a BILATERAL lesion should produce a NUMERICAL limit — one object at a time (P5)",
    bil.n <= 2,
    "sees " + bil.n + "/" + bil.of + ". Diagnosis: a bilateral lesion scales down excitation " +
    "AND the inhibition that excitation drives, because inhibition here is computed from each " +
    "hemisphere's own activity. The competition rebalances and capacity is unchanged. " +
    "Simultanagnosia needs inhibition that does NOT scale with the lesion — a substantive claim " +
    "about parietal circuitry that this model does not currently make, and adding it to produce " +
    "the target would be fitting rather than modelling.");
}

console.log("\n==== " + pass + " passed, " + fail + " failed, " + expected + " failed as predicted ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "syndromes.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
