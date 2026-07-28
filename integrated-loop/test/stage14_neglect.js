"use strict";
/* Stage-14 — HEMISPATIAL NEGLECT, and the differential against hemianopia.

   Stage 12 can already take half the visual field away. Neglect is the opposite kind of
   failure: perimetry is NORMAL, the stimulus is represented, and it still fails to reach
   awareness because it loses a competition. If a model cannot tell those two apart it is not
   modelling attention, so the differential is run here explicitly, through the same visual
   pathway stage 12 uses.

   TWO INGREDIENTS, BOTH ASSUMED (stated so the emergent results can be told from the inputs):
     · a COVERAGE GRADIENT per hemisphere, with the right hemisphere's ipsilateral tail the
       longer one (Mesulam; Heilman & Van Den Abell). The severity asymmetry follows from this
       parameter, so it is assumed — reported, but never claimed as a prediction.
     · an OPPONENT PROCESSOR: each hemisphere pushes attention contralaterally and inhibits the
       other across the callosum (Kinsbourne).

   PREDICTIONS REGISTERED BEFORE RUNNING:
     (1) EXTINCTION is emergent — a contralesional target seen alone is lost when an
         ipsilesional competitor appears. Nothing encodes "extinction".
     (2) It is NOT a repackaging of the coverage gradient: it must survive making the two
         hemispheres' coverage symmetric.
     (3) There is a NEGLECT BAND in lesion severity — below it nothing is wrong, above it the
         single target is already lost and the state is field-defect-like, not neglect.
     (4) LINE BISECTION shifts ipsilesionally; CANCELLATION is asymmetric.
     (5) The PARADOXICAL prediction: a second lesion in the intact hemisphere REDUCES neglect.
         This is counterintuitive and is the real test of whether the opponent term does the
         work. If it fails, the mechanism is wrong however good the other numbers look.
     (6) THE DIFFERENTIAL: a parietal lesion leaves perimetry untouched while abolishing the
         target under competition; an occipital lesion does the reverse.
     (7) PSEUDONEGLECT — normal subjects bisect slightly LEFT of centre. Predicted to come out
         wrong, because the model has a coverage asymmetry but no attentional-STRENGTH
         asymmetry, and pseudoneglect is usually attributed to the latter. Registered as a
         prediction of failure so it cannot be quietly reinterpreted afterwards. */

const P = require("../src/parietal.js");
const VP = require("../src/visualpathway.js");

let pass = 0, fail = 0, expected = 0;
const f = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const expectFail = (n, c, d) => { expected++;
  console.log("  " + (c ? "UNEXPECTED PASS" : "FAIL (predicted)") + "  " + n + "   " + (d || "")); };

const mk = o => P.createParietal(o || {});
const LES = 0.6;                         // operating point: mid-band of the neglect regime
const TGT = -0.7, COMP = +0.7;
const out = {};
const targets = []; for (let i = 0; i < 9; i++) { targets.push({ u: -0.9 + i * 0.09 }); targets.push({ u: 0.1 + i * 0.09 }); }

/* ---------------- 1. intact ---------------- */
console.log("\n== 1. intact ==");
{
  const S = mk();
  const lv = [-0.8, -0.4, 0, 0.4, 0.8].map(u => P.level(S, P.attend(S, P.stimuli(S, [{ u }])), u));
  const e = P.extinction(S, TGT, COMP);
  const c = P.cancellation(S, targets);
  const b = P.bisect(S, P.attend(S, P.line(S, -1, 1)));
  out.intact = { levels: lv, extinctionIndex: e.index, cancel: [c.left, c.right], bisect: b };
  console.log("  single targets across space: " + lv.map(v => f(v, 2)).join(" "));
  console.log("  cancellation " + c.left + "/" + c.nL + " left, " + c.right + "/" + c.nR + " right" +
              "      bisection " + f(b));
  ok("every position is attended, and uniformly",
     lv.every(v => v > 1.0) && Math.max(...lv) - Math.min(...lv) < 0.05,
     "spread " + f(Math.max(...lv) - Math.min(...lv)));
  ok("no extinction in the intact model", Math.abs(e.index) < 0.05, "index " + f(e.index));
  ok("cancellation is complete on both sides", c.left === c.nL && c.right === c.nR);
}

/* ---------------- 2. the neglect band ---------------- */
console.log("\n== 2. is there a NEGLECT BAND, or just a graded field defect? ==");
{
  const rows = [];
  for (const frac of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
    const S = mk(); P.lesionParietal(S, "R", frac);
    const e = P.extinction(S, TGT, COMP);
    const regime = !e.aloneDetected ? "field-defect-like" : (!e.bothDetected ? "NEGLECT" : "normal");
    rows.push({ frac, alone: e.alone, both: e.both, regime });
    console.log("  right lesion " + f(frac, 2) + "   single target " + f(e.alone) +
                (e.aloneDetected ? " seen" : " LOST") + "   with competitor " + f(e.both) +
                (e.bothDetected ? " seen" : " GONE") + "    " + regime);
  }
  out.band = rows;
  const band = rows.filter(r => r.regime === "NEGLECT").map(r => r.frac);
  ok("a neglect band exists — single target survives while competition kills it (P3)",
     band.length >= 3, "lesion " + band[0] + "–" + band[band.length - 1]);
  ok("…and severe damage leaves the band, becoming field-defect-like",
     rows[rows.length - 1].regime === "field-defect-like", "at lesion 1.0 the single target is lost too");
}

/* ---------------- 3. extinction, and the control that it is not the gradient ---------------- */
console.log("\n== 3. EXTINCTION at the operating point, and whether it is really emergent ==");
{
  const S = mk(); P.lesionParietal(S, "R", LES);
  const e = P.extinction(S, TGT, COMP);
  out.extinction = { alone: e.alone, both: e.both, competitor: e.competitor, index: e.index };
  console.log("  left target alone " + f(e.alone) + "  → with a right competitor " + f(e.both) +
              "   (the competitor itself reads " + f(e.competitor) + ")");
  ok("the contralesional target is EXTINGUISHED by competition (P1)",
     e.aloneDetected && !e.bothDetected, f(e.alone) + " → " + f(e.both));
  ok("…while the ipsilesional competitor is unaffected", e.competitor > 1.0, f(e.competitor));

  console.log("  control — remove the coverage asymmetry entirely (tailR = tailL):");
  const ctrl = [];
  for (const t of [0.10, 0.35, 0.60]) {
    const Sc = mk({ tailR: t, tailL: t }); P.lesionParietal(Sc, "R", LES);
    const ec = P.extinction(Sc, TGT, COMP);
    ctrl.push({ tail: t, alone: ec.alone, both: ec.both, index: ec.index, extinguished: ec.aloneDetected && !ec.bothDetected });
    console.log("    symmetric tails " + f(t, 2) + "   alone " + f(ec.alone) + " → " + f(ec.both) +
                (ec.aloneDetected && !ec.bothDetected ? "   still extinguishes" : ""));
  }
  out.symmetricControl = ctrl;
  ok("extinction survives symmetric coverage — it is the competition, not the gradient (P2)",
     ctrl.some(c => c.extinguished), "extinction present with tailR = tailL");
}

/* ---------------- 4. bedside measures, and the severity asymmetry ---------------- */
console.log("\n== 4. line bisection and cancellation ==");
{
  const rows = {};
  for (const [name, side] of [["RIGHT lesion", "R"], ["LEFT lesion", "L"]]) {
    const S = mk(); P.lesionParietal(S, side, LES);
    const b = P.bisect(S, P.attend(S, P.line(S, -1, 1)));
    const c = P.cancellation(S, targets);
    rows[side] = { bisect: b, left: c.left, right: c.right, nL: c.nL, nR: c.nR };
    console.log("  " + name.padEnd(14) + "bisection " + f(b) +
                "   cancellation: left " + c.left + "/" + c.nL + ", right " + c.right + "/" + c.nR);
  }
  out.bedside = rows;
  ok("right lesion shifts the subjective midpoint RIGHT (ipsilesional, P4)", rows.R.bisect > 0.2, f(rows.R.bisect));
  ok("left lesion shifts it LEFT", rows.L.bisect < -0.2, f(rows.L.bisect));
  ok("cancellation is asymmetric in the contralesional direction",
     rows.R.left < rows.R.nL && rows.L.right < rows.L.nR,
     "R lesion misses " + (rows.R.nL - rows.R.left) + " on the left; L lesion misses " +
     (rows.L.nR - rows.L.right) + " on the right");
  // NOTE: this asymmetry follows from tailR > tailL, which is an INPUT. Reported, not claimed.
  console.log("  severity: right lesion misses " + (rows.R.nL - rows.R.left) + " contralesional targets, " +
              "left lesion misses " + (rows.L.nR - rows.L.right) +
              "  — this follows from the assumed coverage asymmetry, and is not a prediction");
}

/* ---------------- 5. the paradoxical second lesion ---------------- */
console.log("\n== 5. does a SECOND lesion, in the intact hemisphere, RELIEVE neglect? ==");
{
  const rows = [];
  for (const base of [0.40, 0.50, 0.60]) {
    const vals = [];
    for (const f2 of [0, 0.2, 0.4, 0.6, 0.8]) {
      const S = mk(); P.lesionParietal(S, "R", base); if (f2) P.lesionParietal(S, "L", f2);
      const A = P.attend(S, P.stimuli(S, [{ u: TGT }, { u: COMP }]));
      vals.push(P.level(S, A, TGT));
    }
    rows.push({ base, vals });
    console.log("  right lesion " + f(base, 2) + "  + left lesion 0 / 0.2 / 0.4 / 0.6 / 0.8  →  " +
                vals.map(v => f(v, 2)).join("  "));
  }
  out.paradox = rows;
  const improved = rows.filter(r => Math.max(...r.vals) > r.vals[0] + 0.1).length;
  ok("a second lesion RELIEVES the neglect it should worsen (P5)", improved === rows.length,
     improved + "/" + rows.length + " severities improve — the opponent term is doing the work");
}

/* ---------------- 6. THE DIFFERENTIAL ---------------- */
console.log("\n== 6. neglect vs hemianopia — the same behaviour, told apart by perimetry ==");
{
  const G = 12;
  const region = (chart, pred) => VP.region(chart, pred);
  const LEFTF = u => u < 0.5;
  // perimetry is run through the stage-12 pathway. A PARIETAL lesion is not in that pathway
  // at all, so its charts are the intact ones — that is the entire clinical point.
  const normal = VP.chartPair(null, G);
  const occip = VP.chartPair({ site: "occipital", side: "R" }, G);
  const permNeglect = region(normal.L, LEFTF), permHemi = region(occip.L, LEFTF);

  // behaviour, same task both times
  const Sn = mk(); P.lesionParietal(Sn, "R", LES);
  const en = P.extinction(Sn, TGT, COMP);
  // hemianopia: parietal cortex intact, but left-field stimuli never arrive
  const Sh = mk();
  const aloneH = P.level(Sh, P.attend(Sh, P.stimuli(Sh, [{ u: TGT, w: 0 }])), TGT);
  const bothH = P.level(Sh, P.attend(Sh, P.stimuli(Sh, [{ u: TGT, w: 0 }, { u: COMP }])), TGT);

  out.differential = { perimetryNeglect: permNeglect, perimetryHemianopia: permHemi,
    neglectAlone: en.alone, neglectBoth: en.both, hemiAlone: aloneH, hemiBoth: bothH };
  console.log("                        left-field perimetry   single left target   with competitor");
  console.log("  parietal (neglect)         " + f(permNeglect, 2) + "                 " +
              f(en.alone, 2) + " seen           " + f(en.both, 2) + " GONE");
  console.log("  occipital (hemianopia)     " + f(permHemi, 2) + "                 " +
              f(aloneH, 2) + " LOST           " + f(bothH, 2) + " LOST");
  ok("neglect leaves the visual field NORMAL on perimetry (P6)", permNeglect > 0.6, f(permNeglect));
  ok("hemianopia abolishes it", permHemi < 0.1, f(permHemi));
  ok("…yet only the neglect case shows a target that is seen alone and lost in competition",
     en.aloneDetected && !en.bothDetected && aloneH < S_thr(Sh), "the dissociation the bedside exam is for");
  function S_thr(S) { return S.P.detectThr; }
}

/* ---------------- 7. the registered failure ---------------- */
console.log("\n== 7. pseudoneglect — predicted, in advance, to come out wrong ==");
{
  const S = mk();
  const b = P.bisect(S, P.attend(S, P.line(S, -1, 1)));
  out.pseudoneglect = b;
  console.log("  intact subjective midpoint " + f(b) + "   (humans bisect slightly LEFT: negative)");
  expectFail("normal subjects should bisect slightly LEFT of centre (P7)", b < -0.005,
    "got " + f(b) + ", i.e. RIGHTWARD. Diagnosis: the model has a coverage asymmetry (the right " +
    "hemisphere represents more of space) but no attentional-STRENGTH asymmetry (the right " +
    "hemisphere pushing harder). Coverage alone shifts the centre of mass toward the better-" +
    "covered side, which is the wrong direction. Pseudoneglect needs the strength term; it is a " +
    "separable second asymmetry the model does not have.");
}

console.log("\n==== " + pass + " passed, " + fail + " failed, " + expected + " failed as predicted ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "neglect.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
