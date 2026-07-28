"use strict";
/* Stage-17 — EXTERNAL CALIBRATION AUDIT, across every stage.
 *
 * Everything else in this project is INTERNALLY consistent: each result is measured against
 * another number the same model produced, or against a lesion of itself. That answers "is this
 * circuit self-consistent?" It does not answer "is it right?", and the word "validated" has
 * been doing work it has not earned.
 *
 * This stage puts every headline number next to a published one and reports the gap —
 * including, and especially, where the gap is large and where there is no anchor at all. It is
 * an AUDIT, not a fit: nothing is tuned to close any of these, and the file deliberately does
 * not exit non-zero, because a failing build would invite tuning the model to the reference
 * ranges, which is exactly what must not happen.
 *
 * ── READ BEFORE QUOTING ANY LINE OF THE OUTPUT ───────────────────────────────────────
 * Every reference range in REFS below is recorded from the literature but has NOT been
 * checked against a primary source in this environment. Each must be verified — number,
 * units, population and measurement convention — before it appears in a manuscript. A wrong
 * reference range makes a PASS meaningless and a FAIL unfair. They are collected in ONE table
 * precisely so they can be corrected in one place.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Three verdicts, and the third is the one that matters most:
 *   IN RANGE   — the model lands where the data does
 *   OUTSIDE    — it does not, and by how much
 *   TOO CLEAN  — it is outside on the OPTIMISTIC side: better than any real observer or
 *                patient. A model that outperforms the thing it models has not succeeded; it
 *                has removed a source of variability the biology actually has.
 */

const fs = require("fs"), path = require("path");
const FIG = path.join(__dirname, "..", "figures");
const read = n => { const p = path.join(FIG, n);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null; };

const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

/* ============================ THE REFERENCE TABLE ============================
   id · what · published lo/hi · units · source · direction of "too clean"
   `better` says which way is IMPLAUSIBLY GOOD, so an optimistic miss can be told from a
   pessimistic one: "low" means a value below the range is too good (an error measure),
   "high" means above it is too good (an accuracy measure), null means neither.        */
const REFS = [
  // ---- stage 1–2: sparsity and anatomy
  { st: "1", q: "cortical assembly sparsity", lo: 2, hi: 10, u: "% active", better: null,
    src: "Barth & Poulet 2012, review of sparse coding in sensory cortex" },
  { st: "2", q: "dentate gyrus sparsity", lo: 1, hi: 5, u: "% active", better: null,
    src: "Chawla et al. 2005; Jung & McNaughton 1993" },
  { st: "2", q: "CA3 sparsity", lo: 2, hi: 12, u: "% active", better: null,
    src: "Leutgeb et al. 2007, CA3 place-cell recordings" },
  { st: "2", q: "CA1 sparsity", lo: 5, hi: 25, u: "% active", better: null,
    src: "Thompson & Best 1989, CA1 place-cell recordings" },
  { st: "2", q: "CA1 : CA3 cell-count ratio", lo: 4.5, hi: 6.5, u: "×", better: null,
    src: "West & Gundersen 1990; Šimić 1997 — HUMAN stereology",
    note: "by construction: a design check, not a validation" },
  // ---- stage 3: replay
  { st: "3", q: "replay time compression", lo: 5, hi: 20, u: "×", better: null,
    src: "Nádasdy et al. 1999; Davidson, Kloosterman & Wilson 2009" },
  { st: "3", q: "forward replay order fidelity", lo: 0.6, hi: 1.0, u: "Spearman ρ", better: "high",
    src: "Lee & Wilson 2002" },
  { st: "3", q: "reverse replay order fidelity", lo: -1.0, hi: -0.6, u: "Spearman ρ", better: "low",
    src: "Foster & Wilson 2006; Diba & Buzsáki 2007" },
  // ---- stage 5: sleep
  { st: "5", q: "slow-oscillation frequency", lo: 0.5, hi: 1.0, u: "Hz", better: null,
    src: "Steriade et al. 1993; Achermann & Borbély 1997 (SO is <1 Hz by definition)" },
  { st: "5", q: "sleep-spindle frequency", lo: 11, hi: 16, u: "Hz", better: null,
    src: "De Gennaro & Ferrara 2003, spindle band" },
  { st: "5", q: "NREM Down-state occupancy", lo: 30, hi: 60, u: "%", better: null,
    src: "Steriade / Vyazovskiy cortical Up–Down recordings",
    note: "wide and state-dependent in vivo" },
  // ---- stage 6–7: vision
  { st: "6", q: "MT direction-estimate error", lo: 1, hi: 15, u: "degrees", better: "low",
    src: "human direction-discrimination thresholds; MT population decoding" },
  { st: "7", q: "MNIST accuracy, best front end", lo: 95, hi: 99.5, u: "%", better: "high",
    src: "human MNIST performance ≈98–99%" },
  // ---- stage 10: the mnemonic similarity task
  { st: "10", q: "MST lure discrimination index (healthy)", lo: 0.25, hi: 0.55, u: "LDI", better: "high",
    src: "Stark, Yassa et al., MST norms in healthy young adults" },
  { st: "10", q: "MST recognition index (healthy)", lo: 0.55, hi: 0.90, u: "REC", better: "high",
    src: "Stark, Yassa et al., same task" },
  // ---- stage 14: neglect
  { st: "14", q: "line-bisection deviation, RH neglect", lo: 5, hi: 25, u: "% of half-line", better: null,
    src: "clinical line-bisection series in right-hemisphere stroke" },
  { st: "14", q: "pseudoneglect in normals", lo: -3, hi: -0.5, u: "% (negative = LEFT)", better: null,
    src: "Jewell & McCourt 2000, meta-analysis" },
  { st: "14", q: "contralesional cancellation targets missed", lo: 40, hi: 100, u: "%", better: null,
    src: "star/line cancellation in moderate-to-severe neglect" },
  // ---- stage 18: visual syndromes
  { st: "18", q: "blindsight direction discrimination", lo: 60, hi: 90, u: "% correct (2AFC)", better: "high",
    src: "Weiskrantz; Barbur et al., residual motion discrimination after V1 damage" },
  { st: "18", q: "akinetopsia residual direction accuracy", lo: 40, hi: 65, u: "% correct (2AFC)", better: "high",
    src: "patient LM (Zihl et al.) — motion perception essentially absent" },
  { st: "18", q: "associative agnosia copying ability", lo: 70, hi: 100, u: "% of percept retained", better: null,
    src: "associative agnosics copy accurately what they cannot name" },
];

const rows = [];
function put(q, value) {
  const r = REFS.find(x => x.q === q);
  if (!r) throw new Error("no reference for: " + q);
  if (value == null || Number.isNaN(value)) { rows.push({ ...r, value: null, verdict: "NO DATA" }); return; }
  const inRange = value >= r.lo && value <= r.hi;
  let verdict = "in range";
  if (!inRange) {
    const tooGood = (r.better === "high" && value > r.hi) || (r.better === "low" && value < r.lo);
    const width = (r.hi - r.lo) || 1;
    const off = value < r.lo ? (r.lo - value) / width : (value - r.hi) / width;
    verdict = tooGood ? "TOO CLEAN" : (off < 0.5 ? "outside (near)" : off < 2 ? "OUTSIDE" : "FAR OUTSIDE");
  }
  rows.push({ ...r, value, verdict });
}

/* ============================ MODEL VALUES ============================ */
const data = read("data.json"), mst = read("mst.json"), ng = read("neglect.json");
const syn = read("syndromes.json");
/* the MNIST front-end comparison lives in the accumulated report data, not mnist.json —
   mnist.json holds only the probe's own k-NN results */
const rd = read("report-data.json"), mn = rd && rd.mnist;

/* sparsity + anatomy: computed live, they are cheap */
{
  const C = require("../src/cortex.js"), H = require("../src/hippocampus.js"),
        L = require("../src/loop.js");
  const cx = C.create({ seed: 1, NC: 800, nStim: 8 }); C.encode(cx);
  put("cortical assembly sparsity", 100 * mean(cx.assemblies.map(a => a.length / cx.N)));
  const hpc = H.createHPC({ seed: 107, NC: cx.N });
  C.setExt(cx, cx.stim[0]); C.run(cx, 0.35); L.settleForward(hpc, cx.a, 80); C.clearExt(cx);
  const act = a => 100 * H.activeSet(a, hpc.P.actThr).length / a.length;
  put("dentate gyrus sparsity", act(hpc.dg));
  put("CA3 sparsity", act(hpc.ca3));
  put("CA1 sparsity", act(hpc.ca1));
  put("CA1 : CA3 cell-count ratio", hpc.P.NCA1 / hpc.P.NCA3);
}
if (data) {
  put("replay time compression", data.replay.compression);
  put("forward replay order fidelity", data.replay.forward.rho);
  put("reverse replay order fidelity", data.replay.reverse.rho);
  put("MT direction-estimate error", data.mt.mean);
}
put("slow-oscillation frequency", 1.05);      // stage-5 record
put("sleep-spindle frequency", 16.5);
put("NREM Down-state occupancy", 73);
if (mn) put("MNIST accuracy, best front end", Math.max(...mn.frontends.map(x => x.mnist)));
if (mst) {
  put("MST lure discrimination index (healthy)", mst.results["intact"].LDI);
  put("MST recognition index (healthy)", mst.results["intact"].REC);
}
if (ng) {
  put("line-bisection deviation, RH neglect", 100 * ng.bedside.R.bisect);
  put("pseudoneglect in normals", 100 * ng.pseudoneglect);
  put("contralesional cancellation targets missed",
      100 * (ng.bedside.R.nL - ng.bedside.R.left) / ng.bedside.R.nL);
}
if (syn) {
  /* 2AFC accuracy comes from stage 18's PER-TRIAL scoring, not from thresholding a mean
     error. Thresholding the mean at 90 degrees called an 81-degree (chance) estimate
     "correct", which made akinetopsia read as too clean when it is in fact at chance. */
  put("blindsight direction discrimination", syn.occipital["V1 complete"].acc2afc);
  put("akinetopsia residual direction accuracy", syn.occipital["MT complete"].acc2afc);
  const I = syn.agnosia["intact"], AS = syn.agnosia["readout 0.9 (associative)"];
  put("associative agnosia copying ability", 100 * AS.percept / I.percept);
}

/* ============================ REPORT ============================ */
console.log("\n===== EXTERNAL CALIBRATION AUDIT — every stage =====");
console.log("  Reference ranges are PROVISIONAL: recorded from the literature, NOT checked");
console.log("  against primary sources here. They live in one table (REFS) so they can be");
console.log("  corrected in one place. Verify before quoting.\n");
const W = 44;
console.log("  st  " + "quantity".padEnd(W) + "model".padStart(9) + "  published".padEnd(16) + " verdict");
console.log("  " + "-".repeat(W + 46));
for (const r of rows)
  console.log("  " + r.st.padEnd(4) + r.q.slice(0, W - 2).padEnd(W) +
              (r.value == null ? "   —" : f(r.value)).padStart(9) +
              "  " + (r.lo + "–" + r.hi).padEnd(15) + " " + r.verdict);

const inR = rows.filter(r => r.verdict === "in range");
const clean = rows.filter(r => r.verdict === "TOO CLEAN");
const out = rows.filter(r => !["in range", "TOO CLEAN", "NO DATA"].includes(r.verdict));

console.log("\n  " + inR.length + " in range · " + clean.length + " TOO CLEAN · " +
            out.length + " outside · of " + rows.length + " anchored quantities.");

if (clean.length) {
  console.log("\n  TOO CLEAN — the model beats the biology. Each of these is a source of");
  console.log("  variability the real system has and this one does not:");
  for (const r of clean)
    console.log("    · " + r.q + ": model " + f(r.value) + " " + r.u + ", published " + r.lo + "–" + r.hi);
}
if (out.length) {
  console.log("\n  OUTSIDE THE RANGE:");
  for (const r of out)
    console.log("    · " + r.q + ": model " + f(r.value) + " " + r.u + ", published " + r.lo + "–" + r.hi +
                "\n        " + r.src + (r.note ? "\n        note: " + r.note : ""));
}

/* ---------------- coverage: what has NO external anchor at all? ---------------- */
const UNANCHORED = [
  ["4", "systems-consolidation gradient", "ρ against replay-event count — no human or animal " +
    "dataset maps replay COUNT to recall, so the shape is unconstrained"],
  ["8", "TLE two-hit, AD lure overlap, DG disinhibition", "the direction of each is well " +
    "established; the magnitudes are not measured against any series"],
  ["9", "egocentric ⇄ allocentric transform error", "no behavioural dataset in the same units"],
  ["12", "the six chiasmal/retrochiasmal field defects", "the PATTERN is textbook and is what " +
    "the stage tests; per-location sensitivity in dB is not compared"],
  ["13", "material-specific memory after unilateral lobectomy", "effect DIRECTION matches Milner; " +
    "the model's units are conjunction recovery, which no clinical series reports"],
  ["15", "diencephalic amnesia; recollection/familiarity", "direction matches Aggleton & Brown; " +
    "no ROC-based remember/know numbers are compared"],
  ["16", "parameter robustness", "internal by construction — nothing external to compare"],
];
console.log("\n  NO EXTERNAL ANCHOR — results that are directionally right and quantitatively");
console.log("  uncompared. These are NOT validated, and saying so is the point of this list:");
for (const [st, what, why] of UNANCHORED)
  console.log("    stage " + st.padEnd(3) + what + "\n        " + why);

console.log("\n  WHAT THIS AUDIT ESTABLISHES:");
console.log("    · Where the model is anchored, the STRUCTURAL quantities land in range and the");
console.log("      BEHAVIOURAL ones do not. That is a pattern, not a scatter: circuit-level");
console.log("      numbers were built to anatomical targets, while the behavioural readouts are");
console.log("      internal instruments with arbitrary thresholds that were never asked to land");
console.log("      anywhere real.");
console.log("    · The behavioural misses are mostly in ONE direction — too clean. A model that");
console.log("      outperforms the observer it models has removed variability, not explained it.");
console.log("    · Roughly half the project's stages have no external anchor at all. For those,");
console.log("      the correct claim is that the DIRECTION of an effect is reproduced.");
console.log("    · Until REFS is checked against primary sources, the right word for this");
console.log("      project is CALIBRATED, not VALIDATED.\n");

fs.writeFileSync(path.join(FIG, "external.json"), JSON.stringify({
  rows, unanchored: UNANCHORED,
  inRange: inR.length, tooClean: clean.length, outside: out.length, total: rows.length }));
