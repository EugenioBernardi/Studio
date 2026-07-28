"use strict";
/* Stage-19 — AUDITORY CORTEX, extracted and re-verified; the temporal-lobe front end.
 *
 * The project's rule is that an extraction must be re-verified against the numbers the app
 * produced, because the visual extraction silently dropped from 100% to 52% when the app
 * rebuilt its Gabors with parameters the file literals never had. This stage is that check,
 * plus the claims the auditory architecture is actually making.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) The extraction reproduces the app's labels for every stimulus class.
 *   (2) It is DETERMINISTIC — the app used Math.random() and could not be re-run identically.
 *   (3) FM SWEEP DIRECTION IS ORIENTATION in the cochleagram (Shamma; Chi & Ru): up and down
 *       sweeps should give large modulation-spectrum asymmetries of OPPOSITE sign, and steady
 *       sounds ~zero. This is the architectural claim — that A1 is the visual V1 re-axed.
 *   (4) The documented limit holds: tone vs harmonic complex is NOT resolved at 40 channels.
 *   (5) …but the BELT should separate them anyway, because harmonic template matching is a
 *       different computation from modulation asymmetry. If it does, the limit is in the
 *       READOUT and not in the representation — the same critique already made of the HMAX
 *       decision layer in stage 7.
 */

const A = require("../src/auditory.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const out = {};

const STIM = [
  ["tone", { f0: 400 }, "STEADY"],
  ["harmonic", { f0: 200 }, "STEADY"],
  ["noise", {}, "NOISE"],
  ["up", { f0: 300, sweep: 6 }, "UP-SWEEP"],
  ["down", { f0: 1800, sweep: 6 }, "DOWN-SWEEP"],
  ["am", { f0: 600, am: 8 }, "STEADY"],
];

console.log("\n== 1. extraction fidelity, and what each stage computes ==");
const R = {};
console.log("  stimulus     label        flatness    asym    harmonicity  f0 est  partials");
for (const [k, o, expect] of STIM) {
  const r = A.pipeline(k, o);
  R[k] = { label: r.label, flatness: r.flatness, asym: r.asym,
           harmonicity: r.h.harmonicity, f0: r.h.best.f0, partials: r.h.nPartials, expect };
  console.log("  " + k.padEnd(12) + r.label.padEnd(13) + f(r.flatness) + "  " + f(r.asym) +
              "   " + f(r.h.harmonicity) + "      " + f(r.h.best.f0, 0).padStart(4) + "     " + r.h.nPartials);
}
out.stimuli = R;
ok("every stimulus gets the app's label (P1)", STIM.every(([k, , e]) => R[k].label === e),
   "6/6 classes reproduce the extraction source");

console.log("\n== 2. determinism ==");
{
  const a = A.pipeline("noise", { seed: 7 }), b = A.pipeline("noise", { seed: 7 });
  const c = A.pipeline("noise", { seed: 8 });
  ok("the same seed gives the identical result (P2)", a.flatness === b.flatness,
     "the app used Math.random() and could not be re-run identically");
  ok("…and different seeds genuinely differ", a.flatness !== c.flatness);
}

console.log("\n== 3. FM sweep direction IS orientation in the cochleagram (P3) ==");
{
  const rows = [];
  for (const sw of [2, 4, 6, 8]) {
    const u = A.pipeline("up", { f0: 300, sweep: sw }).asym;
    const d = A.pipeline("down", { f0: 1800, sweep: sw }).asym;
    rows.push({ sweep: sw, up: u, down: d });
    console.log("  sweep ×" + sw + "   up-asymmetry " + f(u) + "   down-asymmetry " + f(d));
  }
  out.fm = rows;
  const steady = A.pipeline("tone", { f0: 400 }).asym;
  console.log("  steady tone asymmetry " + f(steady) + "  (should be ≈0: no frequency modulation)");
  ok("up and down sweeps give OPPOSITE-signed asymmetries at every rate",
     rows.every(r => r.up > 0.5 && r.down < -0.5), "all four sweep rates");
  ok("a steady tone gives ≈0 asymmetry", Math.abs(steady) < 0.1, f(steady));
  ok("the sign is the sweep direction, not its magnitude",
     rows.every(r => Math.sign(r.up) === 1 && Math.sign(r.down) === -1),
     "orientation in frequency × time carries FM direction, as the ripple framework claims");
}

console.log("\n== 4. the documented limit, and where it actually lives ==");
{
  const T = R["tone"], H = R["harmonic"], N = R["noise"];
  console.log("  tone     label " + T.label + "   harmonicity " + f(T.harmonicity));
  console.log("  harmonic label " + H.label + "   harmonicity " + f(H.harmonicity));
  ok("the limit holds: tone and harmonic get the SAME label (P4)", T.label === H.label,
     "both " + T.label + " — the classifier cannot tell them apart, as documented");
  ok("…but the BELT separates them anyway (P5)", H.harmonicity > T.harmonicity + 0.15,
     "harmonicity " + f(H.harmonicity) + " vs " + f(T.harmonicity) +
     " — the distinction IS represented; the readout never reads it");

  /* an extended rule that uses what the belt already computes. This is reported ALONGSIDE the
     app's rule, never in place of it: the app-faithful numbers above are the extraction check,
     and mixing an improvement into them would destroy the thing being checked. */
  const extended = (r) => {
    if (r.flatness > 0.90) return "NOISE";               // flatness first — noise has spurious peaks
    if (r.asym > 0.5) return "UP-SWEEP";
    if (r.asym < -0.5) return "DOWN-SWEEP";
    return r.harmonicity > 0.5 ? "HARMONIC" : "TONE";    // the belt breaks the tie
  };
  const want = { tone: "TONE", harmonic: "HARMONIC", noise: "NOISE",
                 up: "UP-SWEEP", down: "DOWN-SWEEP", am: "TONE" };
  const got = {};
  for (const [k] of STIM) got[k] = extended(R[k]);
  out.extendedRule = { got, want };
  console.log("  extended rule (flatness → asymmetry → harmonicity):");
  for (const [k] of STIM)
    console.log("    " + k.padEnd(10) + got[k].padEnd(12) + (got[k] === want[k] ? "✓" : "✗ wanted " + want[k]));
  const nOk = STIM.filter(([k]) => got[k] === want[k]).length;
  ok("reading the belt resolves tone vs harmonic without changing the model",
     got.tone === "TONE" && got.harmonic === "HARMONIC",
     nOk + "/" + STIM.length + " classes correct under the extended readout");
  console.log("  NOTE: noise scores harmonicity " + f(N.harmonicity) + " — HIGH, because noise has");
  console.log("  peaks everywhere and the template finds some. Flatness must gate first; using");
  console.log("  harmonicity alone would call noise voiced. Order is load-bearing here.");
}

console.log("\n== 5. noise robustness — and a DEFECT in the extracted decision rule ==");
{
  /* corrected ordering: NOISE means "no structure", so it must require a flat spectrum AND
     the absence of a modulation asymmetry. The app tests flatness alone and first. */
  const corrected = r => {
    if (r.asym > 0.5) return "UP-SWEEP";
    if (r.asym < -0.5) return "DOWN-SWEEP";
    if (r.flatness > 0.90) return "NOISE";
    return r.harmonicity > 0.5 ? "HARMONIC" : "TONE";
  };
  const rows = [];
  for (const nz of [0, 0.1, 0.25, 0.5, 1.0]) {
    const u = A.pipeline("up", { f0: 300, sweep: 6, noise: nz, seed: 3 });
    const t = A.pipeline("tone", { f0: 400, noise: nz, seed: 3 });
    rows.push({ noise: nz, up: u.label, upFixed: corrected(u), tone: t.label,
                upAsym: u.asym, upFlat: u.flatness });
    console.log("  noise " + f(nz, 2) + "   up-sweep → app: " + u.label.padEnd(11) +
                " corrected: " + corrected(u).padEnd(11) +
                " (asym " + f(u.asym) + ", flatness " + f(u.flatness) + ")");
  }
  out.noise = rows;

  // the defect, stated as a measurement rather than hidden by relaxing the assertion
  const broken = rows.filter(r => r.up === "NOISE" && Math.abs(r.upAsym) > 0.5);
  console.log("\n  DEFECT FOUND IN THE EXTRACTED RULE: " + broken.length + " of " + rows.length +
              " noisy sweeps are labelled NOISE while carrying an unambiguous");
  console.log("  modulation asymmetry (up to " + f(Math.max(...broken.map(r => r.upAsym))) +
              "). The app tests flatness FIRST and alone, so any broadband");
  console.log("  stimulus is called noise however strongly it is modulated. A noisy up-sweep is");
  console.log("  still an up-sweep. This is the same class of error as the belt going unread:");
  console.log("  the representation is correct and the readout discards it.");
  ok("the defect is real and is not a sampling artefact", broken.length >= 2,
     "asymmetries " + broken.map(r => f(r.upAsym)).join(", ") + " all labelled NOISE");
  ok("with the ordering corrected, FM direction survives moderate noise",
     rows[2].upFixed === "UP-SWEEP", "UP-SWEEP at noise 0.25 once asymmetry is tested first");
  ok("…and degrades gracefully rather than flipping sign",
     rows.every(r => r.upAsym > -0.2), "asymmetry never reverses");
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "auditory.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
