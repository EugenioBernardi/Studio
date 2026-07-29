"use strict";
/* Stage-31 — TESTING THE PREMISE BEFORE BUILDING ON IT.
 *
 * The proposal is: high-order associative cortex, columnar and corticothalamically coupled,
 * should project to entorhinal cortex and thence to the hippocampus. The argument is a chain —
 * columns beat single neurons at feature extraction and invariance; coupled corticothalamic
 * loops beat columns alone; therefore route that into EC. The anatomy is right and the target
 * addresses a recorded gap (OVERVIEW §8.4: this hippocampus is content-agnostic BY CONSTRUCTION,
 * because it receives an abstract sparse vector rather than a cortical representation).
 *
 * But neither link of the chain has been tested, and one of them is currently FALSE in this
 * implementation:
 *   • Stage 30 never tested feature extraction or invariance. On the one capability it did
 *     compare head-to-head, the columnar cortex was WORSE (completion 0.517 vs 0.763).
 *   • Corticothalamic feedback is nearly inert: removing it moves sparsity 3.8% → 4.1% and
 *     recall 0.517 → 0.512. The reticular gate does work; the L5→TC loop currently does not.
 * Building an EC→hippocampus route on an untested premise would put the interesting claim
 * downstream of an unexamined one. This stage tests the premise.
 *
 * THE TASK. The ventral stream's V1-complex output is a 20×20 RETINOTOPIC map with 12
 * orientation channels — exactly the input a columnar cortex is for. Each column takes a 4×4
 * patch of visual field; its thalamic relay sector carries that patch's 12 orientations. The
 * flat sheet receives the SAME 4800 values through a random projection, so the information is
 * identical and only the topography differs. Networks learn three shapes at a canonical view,
 * then see them at novel scales, rotations and positions with plasticity OFF.
 *
 * INVARIANCE IS MEASURED AS AN ASSEMBLY QUESTION, not a classifier accuracy: does a transformed
 * view of a shape reactivate the SAME assembly the canonical view wrote? The margin between
 * same-shape and different-shape reactivation is the quantity, because a network that lights up
 * everything for everything would score well on either alone.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) THE PREMISE, first link. The columnar cortex shows better transformation invariance than
 *       the flat sheet — a larger margin between same-shape and different-shape reactivation.
 *       Registered as the claim to beat, not as an expectation: stage 30 found columns WORSE at
 *       completion, so this could easily fail.
 *   (2) THE PREMISE, second link. Removing corticothalamic feedback degrades invariance. I
 *       expect this to FAIL, because stage 30 measured the L5→TC loop as nearly inert, and a
 *       loop that changes nothing cannot be what makes columns work. If it fails, the second
 *       link of the chain is unsupported and the loop must be made load-bearing before the
 *       EC→hippocampus step, not after.
 *   (3) Removing the reticular gate degrades invariance, since stage 30 showed it is the part
 *       of the thalamus that does work.
 *   (4) A REGISTERED RISK. If the flat sheet wins P1, the chain's first premise is false in this
 *       model and the EC step should wait — not because the anatomy is wrong, but because the
 *       reason for preferring columns would not be established here. That would be reported as
 *       the result, not worked around.
 *
 * ============================================================================================
 * CORRECTION, ADDED AFTER THE FIRST RUN. The first version of this stage concluded that the
 * columnar cortex "discards almost all the discriminative information its input carries",
 * preserving 8% of the available margin against the flat sheet's 150%. THAT CONCLUSION WAS AN
 * ARTEFACT OF THIS HARNESS, and it was mine.
 *
 * The flat arm reached cortex through `project()`, which takes the TOP-K of a random projection
 * — a hard k-winners-take-all. The columnar arm received graded thalamic drive and used feedback
 * inhibition with a threshold. I gave one arm an explicit selection stage and the other none,
 * then attributed the difference to topography.
 *
 * The control that settles it (§0 below): the SAME flat sheet, driven by the same projection
 * WITHOUT top-k, scores a margin of 0.000 — same-shape 1.000, other-shape 1.000, every assembly
 * identical to every other. The flat sheet is not better than the columnar one. A hard k-WTA is
 * better than no k-WTA, in either architecture.
 *
 * §5 then asks whether the columnar model can produce that selection from its own machinery.
 * Six parameter families were swept: recurrent range, long-range fraction, within-assembly
 * convergence, reticular strength and spread, cross-column feedforward convergence (a genuinely
 * missing pathway, now added as `ffRadius`), and an explicit k-WTA readout on L2/3. The best
 * combination reaches 0.146 against the flat arm's 0.624. So the corrected finding is neither
 * "columns are worse" nor "columns are better":
 *
 *   DISCRIMINATION IN THIS COMPARISON IS PRODUCED BY A HARD k-WINNERS-TAKE-ALL OVER A
 *   HIGH-DIMENSIONAL RANDOM PROJECTION. Neither architecture discriminates without one, and the
 *   columnar model has no mechanism that implements one: its PV feedback inhibition NORMALISES
 *   but does not SELECT.
 * ============================================================================================
 */

const V = require("../src/vision.js");
const K = require("../src/column.js");
const C = require("../src/cortex.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null ? "  n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SHAPES = V.DEC;                      // square, triangle, circle
const SIDE = 5, NCOL = SIDE * SIDE;        // 5×5 columns over the 20×20 map → 4×4 patch each
const PATCH = V.NC / SIDE;
const NL23 = 64;
const CAN = { size: 0.52, rot: 0, cx: 0, cy: 0 };
const TESTS = [
  { tag: "scale 0.38", size: 0.38 }, { tag: "scale 0.66", size: 0.66 },
  { tag: "rot 15°", rot: 15 * Math.PI / 180 }, { tag: "rot 30°", rot: 30 * Math.PI / 180 },
  { tag: "shift +x", cx: 0.10 }, { tag: "shift −y", cy: -0.10 },
];

/* ---- the retinotopic thalamic input: column c, orientation o ---- */
function tcVector(kind, opt) {
  const p = V.pipeline(kind, Object.assign({}, CAN, opt || {}));
  const vec = new Float64Array(NCOL * V.NORI);
  for (let cy = 0; cy < SIDE; cy++) for (let cx = 0; cx < SIDE; cx++) {
    const col = cy * SIDE + cx;
    for (let o = 0; o < V.NORI; o++) {
      let s = 0;
      for (let y = 0; y < PATCH; y++) for (let x = 0; x < PATCH; x++) {
        s += p.C[o][(cy * PATCH + y) * V.NC + (cx * PATCH + x)];
      }
      vec[col * V.NORI + o] = s / (PATCH * PATCH);
    }
  }
  // normalise to the drive scale the cortex expects, preserving relative structure
  let mx = 0; for (let i = 0; i < vec.length; i++) if (vec[i] > mx) mx = vec[i];
  if (mx > 0) for (let i = 0; i < vec.length; i++) vec[i] = 1.6 * vec[i] / mx;
  return vec;
}
/* the same information, flattened, for the flat sheet */
function flatVector(kind, opt) { return tcVector(kind, opt); }

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function makeProjector(dim, N, seed) {
  const rnd = mulberry32(seed), W = [];
  for (let u = 0; u < N; u++) {
    const row = new Float64Array(dim);
    for (let d = 0; d < dim; d++) row[d] = rnd() * 2 - 1;
    W.push(row);
  }
  return W;
}
/* `mode` exists because of the correction in the header. "topk" is a hard k-winners-take-all
   over the random projection — an explicit selection stage. "graded" is the same projection,
   rectified and scaled, with NO selection: the drive the columnar arm actually receives. */
function project(W, vec, k, amp, mode) {
  const n = W.length, s = new Float64Array(n);
  for (let u = 0; u < n; u++) { let a = 0; const row = W[u];
    for (let d = 0; d < vec.length; d++) a += row[d] * vec[d]; s[u] = a; }
  const outv = new Float64Array(n);
  if (mode === "graded") {
    let mx = 0; for (let u = 0; u < n; u++) if (s[u] > mx) mx = s[u];
    for (let u = 0; u < n; u++) outv[u] = Math.max(0, s[u]) / (mx || 1) * amp;
    return outv;
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => s[b] - s[a]);
  for (let i = 0; i < k; i++) outv[order[i]] = amp;
  return outv;
}
const jaccardish = (a, b) => { const sb = new Set(b); let c = 0; for (const x of a) if (sb.has(x)) c++;
  return c / Math.max(1, Math.min(a.length, b.length)); };

/* ---------------- the columnar arm ---------------- */
function topSet(a, k) {
  const idx = Array.from({ length: a.length }, (_, i) => i).sort((x, y) => a[y] - a[x]);
  const o = []; for (let i = 0; i < k && a[idx[i]] > 0; i++) o.push(idx[i]);
  return o;
}
function runColumnar(label, opts, kwta) {
  const S = K.create(Object.assign({ NCOL, nL23: NL23, nTC: V.NORI, nStim: SHAPES.length,
                                     seed: 1 }, opts || {}));
  const kk = Math.round(0.09 * S.NL23);
  const read = () => (kwta ? topSet(S.a, kk) : K.activeSet(S));
  // learn the canonical view of each shape
  const canon = [];
  for (let rep = 0; rep < 4; rep++) {
    for (let s = 0; s < SHAPES.length; s++) {
      K.reset(S); K.setExt(S, tcVector(SHAPES[s]));
      S.plastic = true; K.run(S, 0.35); S.plastic = false;
      K.clearExt(S); K.run(S, 0.12);
    }
  }
  for (let s = 0; s < SHAPES.length; s++) {
    K.reset(S); K.setExt(S, tcVector(SHAPES[s])); K.run(S, 0.35);
    canon.push(read()); K.clearExt(S);
  }
  return probe(label, canon, (kind, opt) => {
    K.reset(S); K.setExt(S, tcVector(kind, opt)); K.run(S, 0.35);
    const a = read(); K.clearExt(S); return a;
  }, canon.map(a => a.length));
}

/* ---------------- the flat arm: same information, no topography ---------------- */
function runFlat(label, mode) {
  mode = mode || "topk";
  const N = NCOL * NL23;
  const cx = C.create({ seed: 1, NC: N, nStim: SHAPES.length });
  const W = makeProjector(NCOL * V.NORI, N, 808);
  const kDrive = Math.round(0.10 * N);
  const canon = [];
  for (let rep = 0; rep < 4; rep++) {
    for (let s = 0; s < SHAPES.length; s++) {
      cx.a.fill(0); cx.inh = 0;
      C.setExt(cx, project(W, flatVector(SHAPES[s]), kDrive, cx.P.inDrive, mode));
      cx.plastic = true; C.run(cx, 0.35); cx.plastic = false;
      C.clearExt(cx); C.run(cx, 0.12);
    }
  }
  for (let s = 0; s < SHAPES.length; s++) {
    cx.a.fill(0); cx.inh = 0;
    C.setExt(cx, project(W, flatVector(SHAPES[s]), kDrive, cx.P.inDrive, mode)); C.run(cx, 0.35);
    canon.push(C.activeSet(cx)); C.clearExt(cx);
  }
  return probe(label, canon, (kind, opt) => {
    cx.a.fill(0); cx.inh = 0;
    C.setExt(cx, project(W, flatVector(kind, opt), kDrive, cx.P.inDrive, mode)); C.run(cx, 0.35);
    const a = C.activeSet(cx); C.clearExt(cx); return a;
  }, canon.map(a => a.length));
}

/* ---------------- the shared measurement ---------------- */
function probe(label, canon, present, sizes) {
  let same = 0, diff = 0, correct = 0, n = 0;
  const perTest = {};
  for (const t of TESTS) {
    let s0 = 0, d0 = 0, c0 = 0;
    for (let s = 0; s < SHAPES.length; s++) {
      const got = present(SHAPES[s], t);
      const ov = canon.map(a => jaccardish(got, a));
      s0 += ov[s];
      let best = 0, bi = 0;
      for (let k = 0; k < ov.length; k++) { if (ov[k] > best) { best = ov[k]; bi = k; } }
      let dm = 0; for (let k = 0; k < ov.length; k++) if (k !== s) dm = Math.max(dm, ov[k]);
      d0 += dm;
      if (bi === s) c0++;
      same += ov[s]; diff += dm; n++;
      if (bi === s) correct++;
    }
    perTest[t.tag] = { same: s0 / SHAPES.length, diff: d0 / SHAPES.length,
                       correct: c0 + "/" + SHAPES.length };
  }
  return { label, same: same / n, diff: diff / n, margin: (same - diff) / n,
           correct: correct / n, meanSize: mean(sizes), perTest };
}

/* ---------------- the CEILING: how much margin does the input itself carry? ----------------
   Added after the first run, and it changes what this stage measures. Without it the test asks
   "which architecture is more invariant", which is unanswerable if the input carries no
   invariance to begin with — and for ROTATION it does not: a 30° rotated square has cosine
   0.34 with the canonical square and 0.46 with the best other shape, an input margin of −0.114.
   No network can recover invariance that is not in its input and was never trained on. That
   sub-test was a criterion with no possible true positive, which is a failure mode this
   project's own bug list already records. With the ceiling in place the question becomes the
   right one: HOW MUCH OF THE AVAILABLE MARGIN DOES EACH ARCHITECTURE PRESERVE? */
const cosSim = (a, b) => { let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / Math.sqrt((na || 1e-9) * (nb || 1e-9)); };
function inputMargin(t) {
  let same = 0, diff = 0;
  for (let i = 0; i < SHAPES.length; i++) {
    const canon = tcVector(SHAPES[i]), moved = tcVector(SHAPES[i], t);
    same += cosSim(canon, moved);
    let m = 0;
    for (let j = 0; j < SHAPES.length; j++) if (j !== i) m = Math.max(m, cosSim(tcVector(SHAPES[j]), moved));
    diff += m;
  }
  return { same: same / SHAPES.length, diff: diff / SHAPES.length,
           margin: (same - diff) / SHAPES.length };
}

/* ---------------- run ---------------- */
console.log("\n" + clock() + " == transformation invariance: columnar vs flat ==");
console.log("  " + NCOL + " columns (" + SIDE + "×" + SIDE + ") over a " + V.NC + "×" + V.NC +
            " retinotopic map, " + PATCH + "×" + PATCH + " patch each, " + V.NORI +
            " orientation channels per relay sector");
console.log("  trained on the canonical view only; tested on " + TESTS.length +
            " transformations with plasticity OFF\n");

const arms = [];
arms.push(runFlat("flat sheet + k-WTA drive", "topk"));
arms.push(runFlat("flat sheet, GRADED drive", "graded"));      // §0: the harness control
console.log("  " + clock() + " flat arms done");
arms.push(runColumnar("columnar + full thalamus"));
arms.push(runColumnar("columnar, no CT feedback", { ctOn: false }));
arms.push(runColumnar("columnar, no reticular gate", { rtnOn: false }));
arms.push(runColumnar("columnar + k-WTA readout", {}, true));
arms.push(runColumnar("columnar + k-WTA + cross-column RF", { ffRadius: 3 }, true));
console.log("  " + clock() + " columnar arms done\n");
out.arms = arms;

console.log("  arm                            same-shape   other-shape   MARGIN   correct");
for (const a of arms) {
  console.log("  " + a.label.padEnd(30) + f(a.same).padStart(7) + "      " +
              f(a.diff).padStart(7) + "    " + f(a.margin).padStart(7) + "   " +
              f(100 * a.correct, 0).padStart(4) + "%");
}
const flat = arms[0], flatGraded = arms[1], col = arms[2], noCT = arms[3],
      noRTN = arms[4], colK = arms[5], colKF = arms[6];

console.log("");
console.log("  §0 THE HARNESS CONTROL, and it overturns this stage's first conclusion.");
console.log("  The flat sheet's drive was a hard k-WTA over a random projection; the columnar");
console.log("  arm's was graded. Same flat sheet, same projection, WITHOUT the k-WTA:");
console.log("      margin " + f(flatGraded.margin) + "   (same " + f(flatGraded.same) +
            ", other " + f(flatGraded.diff) + ")");
console.log("  Every assembly identical to every other. So this was never flat-versus-columnar.");
console.log("  It was k-WTA versus no k-WTA, and I had given it to one arm only.");
ok("the flat sheet's advantage survives removing its k-WTA — i.e. it was about topography",
   flatGraded.margin > 0.3 * flat.margin,
   "margin " + f(flat.margin) + " with k-WTA → " + f(flatGraded.margin) + " without it; the " +
   "advantage was the SELECTION STAGE, not the absence of columns");
console.log("");
ok("the columnar cortex is more transformation-invariant than the flat sheet (P1)",
   col.margin > flat.margin + 0.02,
   "margin " + f(flat.margin) + " (flat+kWTA) vs " + f(col.margin) + " (columnar)");
ok("corticothalamic feedback contributes to invariance (P2)",
   noCT.margin < col.margin - 0.02,
   "margin " + f(col.margin) + " → " + f(noCT.margin) + " without the L5→TC loop");
ok("the reticular gate contributes to invariance (P3)",
   noRTN.margin < col.margin - 0.02,
   "margin " + f(col.margin) + " → " + f(noRTN.margin) + " without the reticular gate");

console.log("\n  per-transformation margin, against the CEILING the input carries:");
console.log("  transformation     input     flat    columnar   informative?");
const ceilings = {};
for (const t of TESTS) {
  const im = inputMargin(t); ceilings[t.tag] = im;
  const a = flat.perTest[t.tag], b = col.perTest[t.tag];
  const informative = im.margin > 0.05;
  console.log("  " + t.tag.padEnd(18) + f(im.margin).padStart(6) + "   " +
              f(a.same - a.diff).padStart(6) + "   " + f(b.same - b.diff).padStart(7) +
              "     " + (informative ? "yes" : "NO — no margin to recover"));
}
out.ceilings = ceilings;
const useful = TESTS.filter(t => ceilings[t.tag].margin > 0.05);
const fMean = mean(useful.map(t => flat.perTest[t.tag].same - flat.perTest[t.tag].diff));
const cMean = mean(useful.map(t => col.perTest[t.tag].same - col.perTest[t.tag].diff));
const iMean = mean(useful.map(t => ceilings[t.tag].margin));
out.preserved = { input: iMean, flat: fMean, columnar: cMean };
console.log("");
console.log("  over the " + useful.length + " transformations the input actually carries a margin on:");
console.log("    margin available in the input : " + f(iMean));
console.log("    preserved by the flat sheet   : " + f(fMean) + "   (" + f(100 * fMean / iMean, 0) + "% of ceiling)");
console.log("    preserved by the columnar     : " + f(cMean) + "   (" + f(100 * cMean / iMean, 0) + "% of ceiling)");
ok("the columnar cortex preserves the discriminative information its input carries",
   cMean > 0.5 * iMean,
   "it retains " + f(100 * cMean / iMean, 0) + "% of the available margin against the flat " +
   "sheet's " + f(100 * fMean / iMean, 0) + "%");

console.log("\n" + clock() + " == can the columnar model produce its own selection? ==");
{
  console.log("  arm                                  MARGIN");
  console.log("  columnar, threshold readout         " + f(col.margin).padStart(7));
  console.log("  columnar + k-WTA on L2/3            " + f(colK.margin).padStart(7));
  console.log("  columnar + k-WTA + cross-column RF  " + f(colKF.margin).padStart(7));
  console.log("  flat sheet + k-WTA (reference)      " + f(flat.margin).padStart(7));
  console.log("");
  ok("the columnar model can reach the flat sheet's discrimination with a selection stage",
     colKF.margin > 0.5 * flat.margin,
     "best columnar " + f(colKF.margin) + " against " + f(flat.margin) +
     " — six parameter families swept (recurrent range, long-range fraction, within-assembly " +
     "convergence, reticular strength and spread, cross-column receptive field, k-WTA readout)");
  console.log("  Adding a cross-column receptive field (ffRadius) helps — it was a genuinely");
  console.log("  MISSING PATHWAY, since with ffRadius = 0 no cell sees more than one patch of the");
  console.log("  sensory map at encoding time, the recurrent route being silent at birth. It is");
  console.log("  kept as a parameter defaulting to 0, so stage 30 is unaffected.");
}

console.log("\n" + clock() + " == what this means for the EC → hippocampus step ==");
{
  console.log("  THE CORRECTED READING. Neither architecture discriminates from graded drive:");
  console.log("  the flat sheet without its k-WTA scores " + f(flatGraded.margin) + ". So the first link of the");
  console.log("  chain is not refuted by this stage — it is UNTESTED, because the comparison I");
  console.log("  built compared selection mechanisms, not topographies. What the stage does");
  console.log("  establish is narrower and still useful: this columnar model has NO MECHANISM");
  console.log("  THAT SELECTS. Its PV feedback inhibition normalises the population but does not");
  console.log("  pick winners, and six families of parameter change do not make it. Until it has");
  console.log("  one, it cannot form distinct assemblies from graded sensory drive, and that —");
  console.log("  not topography — is what blocks it as a source for an entorhinal projection.");
  console.log("");
  if (col.margin > flat.margin + 0.02) {
    console.log("  The first link of the chain HOLDS in this model: a topographically organised,");
    console.log("  thalamically gated columnar cortex generalises across scale, rotation and");
    console.log("  position better than a flat sheet given identical input information. That is");
    console.log("  the reason to prefer columns as the source of an entorhinal projection, and");
    console.log("  it is now measured rather than assumed.");
  } else {
    console.log("  THE FIRST LINK DOES NOT HOLD HERE, and that is the result. Given identical");
    console.log("  input information, the columnar cortex does not generalise better than a flat");
    console.log("  sheet. The anatomy of an association-cortex → EC → hippocampus route is not in");
    console.log("  question; what is missing is this model's reason for preferring a columnar");
    console.log("  source, and building the route now would place an interesting claim downstream");
    console.log("  of an unsupported one.");
  }
  if (!(noCT.margin < col.margin - 0.02)) {
    console.log("");
    console.log("  THE SECOND LINK IS UNSUPPORTED, as predicted. The corticothalamic loop is not");
    console.log("  doing work: removing it leaves invariance essentially unchanged, matching stage");
    console.log("  30's finding that it barely moves sparsity or recall. A loop that changes");
    console.log("  nothing cannot be the thing that makes columns better than neurons. Before the");
    console.log("  EC step, L5→TC needs a JOB — the obvious candidate is filling in a degraded");
    console.log("  relay pattern, which is what corticothalamic feedback is for and which this");
    console.log("  model does not currently ask of it.");
  }
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "invariance.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
