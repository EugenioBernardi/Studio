"use strict";
/* Stage-32 — SOLVING THE SELECTION PROBLEM WITH BIOLOGY, and finding a trade-off that argues
 * for the entorhinal route rather than against it.
 *
 * WHERE THIS STARTS. Stage 31, once its own harness confound was corrected, established that the
 * columnar cortex has NO MECHANISM THAT SELECTS: its PV feedback inhibition normalises the
 * population without picking winners, so graded sensory drive produced assemblies overlapping
 * 0.79 across different shapes. Six parameter families failed to fix it. The instruction was to
 * solve it with biology rather than by bolting on a k-winners-take-all, and that turned out to
 * require finding the right STAGE first — the failure was not where I assumed.
 *
 * THE DIAGNOSTIC THAT LOCATED IT. Cross-shape assembly overlap, measured BEFORE and AFTER
 * Hebbian learning:
 *      linear cells, plain Hebbian        0.523 → 0.779
 * Learning was not preserving a poor representation; it was DESTROYING a better one. Two
 * mechanisms were needed, at two different stages, and neither alone is sufficient:
 *
 *   1. DENDRITIC NONLINEARITY — why a cell codes a PATTERN and not an AMOUNT. A linear cell
 *      (d = Σ w·x) fires in proportion to total drive, so every cell in a strongly driven column
 *      rises together. Pyramidal dendrites are not linear: branches are semi-independent
 *      nonlinear subunits, so a cell responds when a SPECIFIC subset of its inputs is co-active
 *      on one branch, not when the same current arrives spread thinly (Poirazi, Brannon & Mel
 *      2003; Polsky, Mel & Schiller 2004; Larkum 2013). This halves the initial overlap,
 *      0.523 → 0.283 — and plain Hebbian learning still doubles it back to 0.630.
 *
 *   2. BCM METAPLASTICITY — competition between stimuli FOR CELLS. A cell shared by two stimuli
 *      is potentiated for both and becomes a bridge that drags one assembly into the other. The
 *      sliding modification threshold (Bienenstock, Cooper & Munro 1982) makes the LTP/LTD
 *      crossover track the cell's own recent activity, θ ∝ ⟨a²⟩: a cell that responds to
 *      everything raises its threshold and its synapses DEPRESS, while a selective cell keeps
 *      potentiating. Promiscuous cells are expelled from assemblies; selective ones are kept.
 *
 * cortex.js never needed either, because its stimuli are random sparse subsets that barely
 * overlap to begin with. Natural stimuli are correlated, so the problem is unavoidable the
 * moment real sensory input is used — which is exactly the regime an entorhinal projection
 * would operate in.
 *
 * DISCLOSURE. §1 is EXPLORATORY. The mechanism sweep below was run before this file was written,
 * and its numbers are reported as discovery, not as a pre-registered test. §2 and §3 are the
 * honest follow-up: the same claim tested on SEEDS THAT PLAYED NO PART IN FINDING IT, with
 * predictions registered in advance.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING §2 AND §3:
 *   (1) On held-out seeds, dendritic nonlinearity + BCM beats the shipped linear/Hebbian column
 *       on natural-stimulus discrimination, in at least 4 of 5 seeds.
 *   (2) The mechanism works by stopping learning from merging assemblies: post-learning overlap
 *       should be LOWER than pre-learning overlap with BCM on, and HIGHER without it. This is
 *       the mechanistic claim, and it is sharper than the margin — a ratio that crosses 1.0.
 *   (3) A TRADE-OFF, predicted to be real rather than hoped away. The same mechanisms should
 *       COST auto-associative completion on stage 30's random-pattern task, because BCM depresses
 *       exactly the shared cells a partial cue relies on. Registered as a prediction of failure:
 *       recall at a 0.25 cue should FALL. If it does not, I have missed something.
 */

const V = require("../src/vision.js");
const K = require("../src/column.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null ? "  n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SIDE = 5, NCOL = SIDE * SIDE, PATCH = V.NC / SIDE, NL23 = 64;
const TESTS = [{ size: 0.38 }, { size: 0.66 }, { cx: 0.10 }, { cy: -0.10 }];
const BIO = { dendOn: true, bcmOn: true };

function tcVector(kind, opt) {
  const p = V.pipeline(kind, Object.assign({ size: 0.52, rot: 0, cx: 0, cy: 0 }, opt || {}));
  const vec = new Float64Array(NCOL * V.NORI);
  for (let cy = 0; cy < SIDE; cy++) for (let cx = 0; cx < SIDE; cx++) {
    const col = cy * SIDE + cx;
    for (let o = 0; o < V.NORI; o++) {
      let s = 0;
      for (let y = 0; y < PATCH; y++) for (let x = 0; x < PATCH; x++)
        s += p.C[o][(cy * PATCH + y) * V.NC + (cx * PATCH + x)];
      vec[col * V.NORI + o] = s / (PATCH * PATCH);
    }
  }
  let mx = 0; for (let i = 0; i < vec.length; i++) if (vec[i] > mx) mx = vec[i];
  if (mx > 0) for (let i = 0; i < vec.length; i++) vec[i] = 1.6 * vec[i] / mx;
  return vec;
}
const jac = (a, b) => { const sb = new Set(b); let c = 0; for (const x of a) if (sb.has(x)) c++;
  return c / Math.max(1, Math.min(a.length, b.length)); };

/* natural-stimulus discrimination, plus the before/after overlap that shows the mechanism */
function visual(opts, seed) {
  const S = K.create(Object.assign({ NCOL, nL23: NL23, nTC: V.NORI, nStim: 3, seed }, opts));
  const pre = [];
  for (let s = 0; s < 3; s++) {
    K.reset(S); K.setExt(S, tcVector(V.DEC[s])); K.run(S, 0.35);
    pre.push(K.activeSet(S)); K.clearExt(S);
  }
  let po = 0; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) po += jac(pre[i], pre[j]);
  po /= 3;
  for (let rep = 0; rep < 4; rep++) for (let s = 0; s < 3; s++) {
    K.reset(S); K.setExt(S, tcVector(V.DEC[s]));
    S.plastic = true; K.run(S, 0.35); S.plastic = false;
    K.clearExt(S); K.run(S, 0.12);
  }
  const canon = [];
  for (let s = 0; s < 3; s++) {
    K.reset(S); K.setExt(S, tcVector(V.DEC[s])); K.run(S, 0.35);
    canon.push(K.activeSet(S)); K.clearExt(S);
  }
  let qo = 0; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) qo += jac(canon[i], canon[j]);
  qo /= 3;
  let same = 0, diff = 0, n = 0, corr = 0;
  for (const t of TESTS) for (let s = 0; s < 3; s++) {
    K.reset(S); K.setExt(S, tcVector(V.DEC[s], t)); K.run(S, 0.35);
    const got = K.activeSet(S); K.clearExt(S);
    const ov = canon.map(a => jac(got, a));
    same += ov[s];
    let m = 0, bi = 0, bv = 0;
    for (let k = 0; k < 3; k++) { if (ov[k] > bv) { bv = ov[k]; bi = k; } if (k !== s) m = Math.max(m, ov[k]); }
    if (bi === s) corr++;
    diff += m; n++;
  }
  return { pre: po, post: qo, ratio: po > 0 ? qo / po : 1,
           margin: (same - diff) / n, correct: corr / n };
}

/* stage 30's random-pattern auto-association, for the trade-off */
function auto(opts, seed) {
  const S = K.create(Object.assign({ NCOL: 36, nL23: 48, nStim: 8, seed }, opts));
  K.encode(S);
  let r = 0, off = 0;
  for (let s = 0; s < S.P.nStim; s++) {
    const got = new Set(K.present(S, s, 0.25, 0.35, true));
    const A = S.assemblies[s];
    let on = 0; for (const c of A) if (got.has(c)) on++;
    r += on / Math.max(1, A.length);
    let best = 0;
    for (let t = 0; t < S.P.nStim; t++) {
      if (t === s) continue;
      const B = S.assemblies[t]; let o2 = 0;
      for (const c of B) if (got.has(c)) o2++;
      best = Math.max(best, o2 / Math.max(1, B.length));
    }
    off += best;
  }
  let xo = 0, n = 0, sz = 0;
  for (let a = 0; a < 8; a++) { sz += S.assemblies[a].length;
    for (let b = a + 1; b < 8; b++) { xo += K.overlap(S.assemblies[a], S.assemblies[b]); n++; } }
  return { recall: r / S.P.nStim, offTarget: off / S.P.nStim,
           xOverlap: (xo / n) / (sz / 8),
           sparsity: 100 * mean(S.assemblies.map(a => a.length / S.NL23)) };
}

/* ---------------- 1. the mechanism sweep (EXPLORATORY) ---------------- */
console.log("\n" + clock() + " == 1. locating the failure — EXPLORATORY, seed 1 ==");
{
  const rows = [];
  console.log("  mechanism                     overlap pre → post   margin   correct");
  for (const [lbl, o] of [["linear + plain Hebbian", {}],
                          ["dendritic only", { dendOn: true }],
                          ["BCM only", { bcmOn: true }],
                          ["dendritic + BCM", BIO]]) {
    const v = visual(o, 1);
    rows.push({ lbl, ...v });
    console.log("  " + lbl.padEnd(28) + f(v.pre) + " → " + f(v.post) + "      " +
                f(v.margin).padStart(6) + "    " + f(100 * v.correct, 0) + "%");
  }
  out.sweep = rows;
  console.log("");
  console.log("  Learning was not preserving a poor representation — it was destroying a better");
  console.log("  one. The dendritic nonlinearity halves the initial overlap and plain Hebbian");
  console.log("  learning doubles it back; only with BCM does learning stop merging assemblies.");
  console.log("  Neither mechanism alone is sufficient, and they act at different stages.");
}

/* ---------------- 2. held-out seeds (REGISTERED) ---------------- */
console.log("\n" + clock() + " == 2. held-out seeds: does it replicate? (P1, P2) ==");
{
  const SEEDS = [11, 12, 13, 14, 15];      // none used in finding the mechanism
  const rows = [];
  console.log("  seed |  baseline margin  bio margin  |  baseline post/pre  bio post/pre");
  for (const s of SEEDS) {
    const b = visual({}, s), g = visual(BIO, s);
    rows.push({ seed: s, base: b, bio: g });
    console.log("  " + String(s).padStart(4) + " |     " + f(b.margin).padStart(7) + "     " +
                f(g.margin).padStart(7) + "   |      " + f(b.ratio, 2).padStart(5) + "        " +
                f(g.ratio, 2).padStart(5) + "     " + clock());
  }
  out.heldOut = rows;
  const wins = rows.filter(r => r.bio.margin > r.base.margin).length;
  ok("dendritic + BCM beats the shipped column on held-out seeds (P1)", wins >= 4,
     wins + "/" + SEEDS.length + " seeds, mean margin " +
     f(mean(rows.map(r => r.base.margin))) + " → " + f(mean(rows.map(r => r.bio.margin))));
  const baseMerges = rows.filter(r => r.base.ratio > 1).length;
  const bioKeeps = rows.filter(r => r.bio.ratio <= 1).length;
  ok("the mechanism is that learning stops MERGING assemblies (P2)",
     baseMerges >= 4 && bioKeeps >= 4,
     "post/pre overlap ratio > 1 in " + baseMerges + "/" + SEEDS.length + " baseline seeds, ≤ 1 in "
     + bioKeeps + "/" + SEEDS.length + " with the mechanisms — the ratio crosses 1.0");
  console.log("  mean correct: baseline " + f(100 * mean(rows.map(r => r.base.correct)), 0) +
              "%   with biology " + f(100 * mean(rows.map(r => r.bio.correct)), 0) + "%");
}

/* ---------------- 3. the trade-off (REGISTERED as a failure) ---------------- */
console.log("\n" + clock() + " == 3. what it costs: separation vs completion (P3) ==");
{
  const SEEDS = [11, 12, 13];
  const rows = [];
  console.log("  seed |  baseline recall  bio recall  |  baseline x-overlap  bio x-overlap");
  for (const s of SEEDS) {
    const b = auto({}, s), g = auto(BIO, s);
    rows.push({ seed: s, base: b, bio: g });
    console.log("  " + String(s).padStart(4) + " |      " + f(b.recall).padStart(6) + "      " +
                f(g.recall).padStart(6) + "   |        " + f(b.xOverlap).padStart(6) + "         " +
                f(g.xOverlap).padStart(6) + "   " + clock());
  }
  out.tradeoff = rows;
  const recallFell = rows.filter(r => r.bio.recall < r.base.recall).length;
  const sepImproved = rows.filter(r => r.bio.xOverlap < r.base.xOverlap).length;
  ok("the mechanisms COST auto-associative completion, as predicted (P3)",
     recallFell >= 2,
     "recall fell in " + recallFell + "/" + SEEDS.length + " seeds, mean " +
     f(mean(rows.map(r => r.base.recall))) + " → " + f(mean(rows.map(r => r.bio.recall))));
  ok("…while improving separation on the same task", sepImproved >= 2,
     "cross-assembly overlap " + f(mean(rows.map(r => r.base.xOverlap))) + " → " +
     f(mean(rows.map(r => r.bio.xOverlap))));
}

/* ---------------- 4. what it means ---------------- */
console.log("\n" + clock() + " == 4. the trade-off argues FOR the entorhinal route ==");
{
  console.log("  The same two mechanisms that let this cortex discriminate natural, correlated");
  console.log("  stimuli make it a WORSE auto-associator on random sparse patterns. That is not");
  console.log("  a defect to be tuned away — it is the pattern separation / pattern completion");
  console.log("  trade-off, and the brain's answer to it is anatomical rather than parametric:");
  console.log("  separation and completion are done by DIFFERENT structures. Dentate gyrus and");
  console.log("  entorhinal cortex separate; CA3's recurrent collaterals complete.");
  console.log("");
  console.log("  So the columnar association cortex does NOT need to be a good auto-associator,");
  console.log("  and the flat sheet's advantage at that task stops being an argument against");
  console.log("  columns. What an entorhinal projection needs from cortex is a well-separated,");
  console.log("  transformation-tolerant code, and that is precisely what these two mechanisms");
  console.log("  buy. The hippocampus already in this project supplies the completion.");
  console.log("");
  console.log("  STATED AS INTERPRETATION, NOT RESULT: the trade-off is measured; the claim that");
  console.log("  it is resolved by handing completion to CA3 is an argument about architecture,");
  console.log("  and it is exactly what an EC→hippocampus build would TEST rather than assume.");
  console.log("");
  console.log("  Both mechanisms default to OFF, so stages 30 and 31 reproduce unchanged. They");
  console.log("  are opt-in until a stage is migrated deliberately.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "dendritic.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
