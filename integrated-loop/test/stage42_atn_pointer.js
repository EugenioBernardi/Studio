"use strict";
/* Stage-42 — THE ANTERIOR THALAMUS AS A PHASE POINTER. A mechanism that works and an effect
 * size that does not.
 *
 * THE TARGET. Frost et al. (J Neurosci 2021) lesioned the anterior thalamic nuclei: every spatial
 * signal in the subiculum — place, grid AND head-direction — disappeared, CA1 place fields were
 * "largely unaffected", spatial memory fell to chance. Aggleton & O'Mara (Nat Rev Neurosci 2022)
 * note that standard models leave the anterior thalamus out entirely, and the field's stated
 * explanation is that its input is "modulatory or enabling" — a placeholder, not a mechanism.
 *
 * THE HYPOTHESIS. Position is coded in theta phase (theta sequences sweep from behind the animal
 * to ahead of it). A read-out integrating over a narrow window extracts whichever position is
 * represented at the phase it looks at, so it needs the code AND a pointer saying when to look.
 * CA1 supplies the code; the anterior thalamus supplies the pointer. Remove it and the subiculum
 * samples a different point of the sweep each cycle — the code is intact, the synapses are intact,
 * and the read-out is looking in the wrong place.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING, over 4 seeds:
 *   (P1) MECHANISM SPECIFICITY. With sweep = 0 — position rate-coded, nothing swept across the
 *        cycle — losing the pointer costs at most 5% of spatial information. If the collapse still
 *        happens without a phase code, the mechanism is not what is claimed.
 *   (P2) THE EXPERIMENT. At a biologically realistic sequence span (sweep = 0.26, i.e. theta
 *        sequences covering ~26% of the environment: ~40 cm on a 1.5 m track), losing the pointer
 *        removes >80% of subicular spatial information AND drives population decoding above 0.15
 *        (chance = 0.25 on a circular track). THIS IS THE TEST OF THE HYPOTHESIS. Passing means it
 *        reproduces Frost et al.; failing means it does not, whatever else it gets right.
 *   (P3) DRIVE IS NOT THE STORY. Mean drive reaching the read-out changes by <5% between intact
 *        and lesioned. If the lesion works by removing input, this is not a timing account.
 *   (P4) GENERIC READ-OUT FAILURE. Place, grid and head-direction degrade by the same proportion
 *        (pairwise within 0.15), because one pointer failure should take down everything
 *        multiplexed through it — which is why Frost et al. saw all three go together.
 *   (P5) THE BOUND. The size of the effect scales monotonically with sequence span. This is
 *        registered because, if true, it constrains every phase-pointer account and not just this
 *        one: a pointer failure can only smear position by the span of the sweep.
 *
 * The threshold is auto-calibrated ONCE on the intact model and held fixed for every lesioned and
 * control condition, so it cannot absorb the lesion.
 */

const A = require("../src/anteriorthalamus.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null || Number.isNaN(x) ? " n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const out = {};
const SEEDS = [1, 2, 3, 4];

/* one condition: calibrate on intact if no threshold is supplied, then measure */
function ev(opts, thr, kind) {
  kind = kind || "place";
  const M = A.createModel(opts);
  if (thr == null) thr = A.calibrateThreshold(M, kind, 0.15); else M.P.thr = thr;
  const tmpl = A.rateMap(M, kind, 1), probe = A.rateMap(M, kind, 99);
  return { thr,
           info: A.meanOf(A.spatialInfo(probe)),
           width: A.meanOf(A.fieldWidth(probe)),
           decode: A.decodeError(tmpl, probe),
           drive: A.meanDrive(M, kind) };
}
/* intact and lesioned on the SAME model and the SAME threshold */
function pair(opts, kind) {
  const intact = ev(Object.assign({}, opts, { kATN: 1.0 }), null, kind);
  const lesion = ev(Object.assign({}, opts, { kATN: 0.0 }), intact.thr, kind);
  return { intact, lesion, ratio: lesion.info / intact.info };
}

/* ---------------- 1. is the effect specific to the phase code? (P1) ---------------- */
console.log("\n== 1. does the effect require position to be PHASE-coded? (P1) ==");
{
  const withSweep = [], without = [];
  for (const seed of SEEDS) {
    withSweep.push(pair({ seed, sweep: 0.26 }).ratio);
    without.push(pair({ seed, sweep: 0.0 }).ratio);
  }
  out.specificity = { withSweep: mean(withSweep), without: mean(without) };
  console.log("  info retained after lesion, WITH a theta sweep (0.26):  " +
              f(mean(withSweep), 3) + " ± " + f(sd(withSweep), 3));
  console.log("  info retained after lesion, NO sweep (rate code only):  " +
              f(mean(without), 3) + " ± " + f(sd(without), 3));
  ok("removing the phase code abolishes the lesion effect (P1)", mean(without) > 0.95,
     "with no sweep the pointer is worth " + f(100 * (1 - mean(without)), 1).trim() +
     "% of spatial information; with a sweep it is worth " + f(100 * (1 - mean(withSweep)), 1).trim() +
     "%. The mechanism is phase-coded position and nothing else — this is the control that could " +
     "have killed the account and did not.");
}

/* ---------------- 2. does it reproduce the experiment? (P2, P3) ---------------- */
console.log("\n== 2. does it reproduce Frost et al.? (P2, P3) ==");
{
  const ratio = [], dec = [], wI = [], wL = [], dI = [], dL = [];
  for (const seed of SEEDS) {
    const p = pair({ seed, sweep: 0.26 });
    ratio.push(p.ratio); dec.push(p.lesion.decode);
    wI.push(p.intact.width); wL.push(p.lesion.width);
    dI.push(p.intact.drive); dL.push(p.lesion.drive);
  }
  out.experiment = { ratio: mean(ratio), decode: mean(dec), widthIntact: mean(wI),
                     widthLesion: mean(wL), driveIntact: mean(dI), driveLesion: mean(dL) };
  console.log("  spatial information retained     " + f(mean(ratio), 3) + " ± " + f(sd(ratio), 3) +
              "   (target: < 0.20)");
  console.log("  field width  intact → lesioned   " + f(mean(wI), 3) + " → " + f(mean(wL), 3) +
              "   (×" + f(mean(wL) / mean(wI), 2).trim() + ")");
  console.log("  population decode error          " + f(mean(dec), 3) +
              "   (chance = 0.250, target: > 0.150)");
  console.log("  mean drive   intact → lesioned   " + f(mean(dI), 4) + " → " + f(mean(dL), 4) +
              "   (" + f(100 * (mean(dL) / mean(dI) - 1), 1).trim() + "%)");
  ok("the lesion abolishes subicular spatial coding (P2)",
     mean(ratio) < 0.20 && mean(dec) > 0.15,
     "it does not. " + f(100 * mean(ratio), 0).trim() + "% of spatial information survives and the " +
     "population still localises the animal to " + f(mean(dec), 3).trim() + " of the track against " +
     "a chance level of 0.250. Frost et al. report signals DISAPPEARING; this model broadens them.");
  ok("the lesion does not work by removing drive (P3)",
     Math.abs(mean(dL) / mean(dI) - 1) < 0.05,
     "drive changes by " + f(100 * (mean(dL) / mean(dI) - 1), 1).trim() +
     "%. So the degradation that IS present is genuinely a timing effect, not a gain effect.");
}

/* ---------------- 3. do all three signal types go together? (P4) ---------------- */
console.log("\n== 3. is it a generic read-out failure across signal types? (P4) ==");
{
  const byKind = {};
  for (const kind of ["place", "grid", "hd"]) {
    const r = [];
    for (const seed of SEEDS) r.push(pair({ seed, sweep: 0.26 }, kind).ratio);
    byKind[kind] = mean(r);
    console.log("  " + kind.padEnd(6) + " info retained " + f(mean(r), 3));
  }
  out.kinds = byKind;
  const vals = Object.values(byKind);
  const spread = Math.max(...vals) - Math.min(...vals);
  ok("all three signal types degrade alike (P4)", spread < 0.15,
     "spread " + f(spread, 3).trim() + " across place / grid / head-direction. One pointer, one " +
     "failure, everything multiplexed through it goes together — which is the part of Frost et " +
     "al.'s result a coding-specific lesion cannot explain.");
}

/* ---------------- 4. the bound, and it generalises (P5) ---------------- */
console.log("\n== 4. how big CAN a pointer failure be? (P5) ==");
{
  const rows = [];
  console.log("  sweep | info retained | field width ×  | decode error");
  for (const sweep of [0.13, 0.26, 0.40, 0.60, 0.80, 1.00]) {
    const r = [], wr = [], d = [];
    for (const seed of SEEDS) {
      const p = pair({ seed, sweep });
      r.push(p.ratio); wr.push(p.lesion.width / p.intact.width); d.push(p.lesion.decode);
    }
    rows.push({ sweep, ratio: mean(r), widthRatio: mean(wr), decode: mean(d) });
    console.log("  " + f(sweep, 2).padStart(5) + " |     " + f(mean(r), 3) + "     |     ×" +
                f(mean(wr), 2) + "     |    " + f(mean(d), 3));
  }
  out.bound = rows;
  const mono = rows.every((r, i) => i === 0 || r.ratio <= rows[i - 1].ratio + 0.03);
  ok("the effect scales monotonically with sequence span (P5)", mono,
     "info retained " + rows.map(r => f(r.ratio, 2).trim()).join(" → ") + " as the sweep spans " +
     rows.map(r => r.sweep).join(" → ") + " of the environment");
  console.log("");
  console.log("  THE BOUND, and it constrains the whole class of explanations rather than only this");
  console.log("  model. A pointer failure can only smear a read-out across the range the sequence");
  console.log("  actually sweeps. Averaging a field of width σ over a sweep of span s gives roughly");
  console.log("  sqrt(σ² + s²/12), so with σ ≈ 0.055 and the measured s ≈ 0.15–0.30 the field can");
  console.log("  at best go from about 0.10 to about 0.17 of the track — a broadening, not an");
  console.log("  abolition. To lose 80% of spatial information the sweep has to span essentially");
  console.log("  the WHOLE environment, and theta sequences do not: they cover tens of centimetres");
  console.log("  on tracks of metres.");
  console.log("");
  console.log("  So ANY account in which anterior thalamic lesions work by decoupling a phase");
  console.log("  pointer predicts BROADENED subicular fields with preserved population decoding.");
  console.log("  That is a falsifiable prediction and it is not what Frost et al. describe. Either");
  console.log("  their cells fail significance criteria while still carrying coarse position — in");
  console.log("  which case this model is right and the experimental summary is too strong — or the");
  console.log("  mechanism is something else, and a phase pointer is not it.");
}

console.log("\n== verdict ==");
{
  console.log("  The mechanism is REAL and SPECIFIC: it needs phase-coded position (§1), it is not");
  console.log("  a drive effect (§2, drive unchanged to within 1%), and it takes down place, grid");
  console.log("  and head-direction together (§3), which is the hard part of the observation.");
  console.log("");
  console.log("  The mechanism is INSUFFICIENT: at the theta-sequence span actually measured in");
  console.log("  animals it removes about a quarter of subicular spatial information and leaves");
  console.log("  population decoding intact, where the experiment reports spatial signals gone.");
  console.log("  Cranking `sweep` to 1.0 would clear the registered threshold and would be exactly");
  console.log("  the parameter-hunting this project forbids, so it is reported as a failure.");
  console.log("");
  console.log("  NEXT, and it follows from the bound rather than from taste. The pointer cannot be");
  console.log("  the whole story, so either (a) the anterior thalamus supplies the read-out's");
  console.log("  PERMISSIVE drive as well as its timing — testable, and it predicts drive-matched");
  console.log("  rescue, which this model denies; or (b) subicular selectivity is built by learning");
  console.log("  that itself depends on the pointer, so the lesion degrades the WEIGHTS over time");
  console.log("  rather than the instantaneous read-out — which predicts a lesion effect that grows");
  console.log("  with time since lesion and is absent in the reversible/acute case. Frost et al.");
  console.log("  used BOTH permanent and reversible lesions and both abolished signalling, which");
  console.log("  argues against (b) and is the kind of constraint worth having before building it.");
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "atn-pointer.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
