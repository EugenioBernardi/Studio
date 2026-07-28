"use strict";
/* Stage-17 — EXTERNAL CALIBRATION AUDIT.
 *
 * Everything before this stage is INTERNALLY consistent: each result is measured against
 * another number the same model produced, or against a lesion of itself. That answers "is
 * this circuit self-consistent?" It does not answer "is it right?", and the word "validated"
 * has been doing work it has not earned.
 *
 * This stage puts the model's numbers next to published ones and reports the gap — including,
 * and especially, where the gap is large. It is an AUDIT, not a fit: nothing is tuned to
 * close any of these, and the failures are the point of running it.
 *
 * ── READ THIS BEFORE QUOTING ANY LINE OF THE OUTPUT ──────────────────────────────────
 * The reference ranges below are recorded from the literature but have NOT been checked
 * against the primary sources in this environment. Every one is marked with its source and
 * must be verified — number, units, population and measurement convention — before it appears
 * in a manuscript. A reference range that is wrong makes a PASS meaningless and a FAIL unfair.
 * They are provisional targets for triage, and are labelled that way in the output.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */

const C = require("../src/cortex.js");
const H = require("../src/hippocampus.js");
const L = require("../src/loop.js");
const PAR = require("../src/parietal.js");
const fs = require("fs"), path = require("path");

const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const rows = [];

/* record one comparison. lo/hi is the published range; `value` is the model. */
function audit(quantity, value, lo, hi, units, source, note) {
  const inRange = value >= lo && value <= hi;
  // how far outside, in units of the range width — a scale-free "how badly"
  const width = hi - lo || 1;
  const off = inRange ? 0 : (value < lo ? (lo - value) : (value - hi)) / width;
  rows.push({ quantity, value, lo, hi, units, source, inRange, off, note });
}

/* ---------------- sparsity and separation ---------------- */
{
  const cx = C.create({ seed: 1, NC: 800, nStim: 8 }); C.encode(cx);
  const sp = mean(cx.assemblies.map(a => a.length / cx.N));
  audit("cortical assembly sparsity", 100 * sp, 2, 10, "% active",
        "Barth & Poulet 2012 (review of sparse coding in sensory cortex)");

  const hpc = H.createHPC({ seed: 107, NC: cx.N });
  C.setExt(cx, cx.stim[0]); C.run(cx, 0.35);
  L.settleForward(hpc, cx.a, 80);
  C.clearExt(cx);
  const act = a => 100 * H.activeSet(a, hpc.P.actThr).length / a.length;
  audit("dentate gyrus sparsity", act(hpc.dg), 1, 5, "% active",
        "Chawla et al. 2005; Jung & McNaughton 1993 (DG is the sparsest field)");
  audit("CA3 sparsity", act(hpc.ca3), 2, 12, "% active",
        "Leutgeb et al. 2007 and related CA3 place-cell recordings");
  audit("CA1 sparsity", act(hpc.ca1), 5, 25, "% active",
        "Thompson & Best 1989 and related CA1 place-cell recordings");
  audit("CA1 : CA3 cell-count ratio", hpc.P.NCA1 / hpc.P.NCA3, 4.5, 6.5, "×",
        "West & Gundersen 1990; Šimić 1997 (HUMAN stereology)",
        "by construction — this is a design check, not a validation");
}

/* ---------------- replay ---------------- */
{
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "figures", "data.json"), "utf8"));
  audit("replay time compression", data.replay.compression, 5, 20, "×",
        "Nádasdy et al. 1999; Davidson, Kloosterman & Wilson 2009");
  audit("forward replay order fidelity", data.replay.forward.rho, 0.6, 1.0, "Spearman ρ",
        "Lee & Wilson 2002 (forward sequence replay in CA1)");
  audit("reverse replay order fidelity", data.replay.reverse.rho, -1.0, -0.6, "Spearman ρ",
        "Foster & Wilson 2006; Diba & Buzsáki 2007");
}

/* ---------------- sleep rhythms ---------------- */
{
  const sleep = { so: 1.05, spindle: 16.5, downOcc: 73 };   // from the stage-5 record
  audit("slow-oscillation frequency", sleep.so, 0.5, 1.0, "Hz",
        "Steriade et al. 1993; Achermann & Borbély 1997 (the SO is < 1 Hz by definition)");
  audit("sleep-spindle frequency", sleep.spindle, 11, 16, "Hz",
        "De Gennaro & Ferrara 2003 (spindle band 11–16 Hz)");
  audit("NREM Down-state occupancy", sleep.downOcc, 30, 60, "%",
        "Steriade / Vyazovskiy cortical Up–Down recordings", "wide and state-dependent in vivo");
}

/* ---------------- memory behaviour ---------------- */
{
  const mst = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "figures", "mst.json"), "utf8"));
  audit("MST lure discrimination index (healthy)", mst.results["intact"].LDI, 0.25, 0.55, "LDI",
        "Stark, Yassa et al. — Mnemonic Similarity Task norms, healthy young adults");
  audit("MST recognition index (healthy)", mst.results["intact"].REC, 0.55, 0.90, "REC",
        "Stark, Yassa et al. — same task");
}

/* ---------------- vision ---------------- */
{
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "figures", "data.json"), "utf8"));
  audit("MT direction-estimate error", data.mt.mean, 1, 15, "degrees",
        "human direction-discrimination thresholds; MT population decoding",
        "a model error BELOW the human floor is a failure of realism, not a success");
}

/* ---------------- neglect behaviour ---------------- */
{
  const S = PAR.createParietal(); PAR.lesionParietal(S, "R", 0.6);
  const bis = PAR.bisect(S, PAR.attend(S, PAR.line(S, -1, 1)));
  audit("line-bisection deviation, right-hemisphere neglect", 100 * bis, 5, 25,
        "% of half-line, rightward",
        "clinical line-bisection series in right-hemisphere stroke");
  const N = PAR.createParietal();
  const nb = PAR.bisect(N, PAR.attend(N, PAR.line(N, -1, 1)));
  audit("pseudoneglect in normals", 100 * nb, -3, -0.5, "% of half-line (negative = LEFT)",
        "Jewell & McCourt 2000 (meta-analysis: normals bisect slightly left)");
}

/* ---------------- report ---------------- */
console.log("\n===== EXTERNAL CALIBRATION AUDIT =====");
console.log("  Reference ranges are PROVISIONAL — recorded from the literature but not checked");
console.log("  against primary sources in this environment. Verify before quoting.\n");
const W = 46;
console.log("  " + "quantity".padEnd(W) + "model".padStart(9) + "   published".padEnd(18) + " verdict");
console.log("  " + "-".repeat(W + 40));
for (const r of rows) {
  const range = r.lo + "–" + r.hi;
  const verdict = r.inRange ? "in range"
    : (r.off < 0.5 ? "outside (near)" : r.off < 2 ? "OUTSIDE" : "FAR OUTSIDE");
  console.log("  " + r.quantity.slice(0, W - 2).padEnd(W) + f(r.value).padStart(9) +
              "   " + range.padEnd(15) + "  " + verdict);
}

const inR = rows.filter(r => r.inRange).length;
const far = rows.filter(r => !r.inRange && r.off >= 2);
console.log("\n  " + inR + " of " + rows.length + " quantities fall inside their published range.");

console.log("\n  OUTSIDE THE RANGE — each with what it means:");
for (const r of rows.filter(x => !x.inRange)) {
  console.log("\n    " + r.quantity + ":  model " + f(r.value) + " " + r.units +
              ", published " + r.lo + "–" + r.hi);
  console.log("      source: " + r.source);
  if (r.note) console.log("      note:   " + r.note);
}

console.log("\n  WHAT THIS AUDIT CHANGES:");
console.log("    · Quantities inside their range were NOT fitted to it — none of these ranges");
console.log("      was used as a tuning target — so agreement is meaningful where it occurs.");
console.log("    · Quantities outside it are the honest cost of a model tuned for internal");
console.log("      consistency. They are now visible instead of implied.");
console.log("    · Until the reference ranges are checked against primary sources, the right");
console.log("      word for this project is CALIBRATED, not VALIDATED.\n");

fs.writeFileSync(path.join(__dirname, "..", "figures", "external.json"),
  JSON.stringify({ rows, inRange: inR, total: rows.length }));
/* deliberately does NOT exit non-zero: an audit that fails its own build would invite
   tuning the model to the reference ranges, which is exactly what must not happen here */
