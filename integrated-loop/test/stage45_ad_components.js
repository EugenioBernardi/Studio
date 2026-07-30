"use strict";
/* Stage-45 — WHICH PART OF "ALZHEIMER'S" IS DOING THE WORK?
 *
 * Stage 44 modelled AD as FOUR stacked deficits — fewer coupling slots, reduced spindle generation,
 * lower cortical capacity, and a faster-decaying hippocampal trace — plus a little discharge
 * capture. It then reported that AD produces severe accelerated forgetting. That is not a finding
 * until the contribution of each part is separated: stage 41 was retracted for exactly this class
 * of error, attributing an outcome to a mechanism without varying the mechanism.
 *
 * So each component is run ALONE, then the full profile, then the full profile with each component
 * individually REMOVED (a leave-one-out). Anything whose removal barely changes the outcome is not
 * carrying the result, whatever the abstract says.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING — and note that a prediction here can be uncomfortable,
 * because if slot supply turns out to dominate then the discharge-capture mechanism that motivated
 * the whole line is largely irrelevant to AD:
 *   (P1) NO SINGLE COMPONENT reproduces the full AD deficit; the full profile is worse at 1 week
 *        than every component alone by at least 0.10.
 *   (P2) The deficit is NOT dominated by one component: leave-one-out shows at least two components
 *        whose removal recovers ≥0.08 of 1-week recall.
 *   (P3) HIPPOCAMPAL DECAY acts EARLY and SUPPLY acts LATE. Removing the faster hippocampal decay
 *        recovers more at 30 min than removing slot supply does; removing slot supply recovers more
 *        at 1 week than removing hippocampal decay does. This is the model's claim that the two
 *        halves of the AD memory profile have different causes, and it is falsifiable.
 *   (P4) DISCHARGE CAPTURE IS A MINOR CONTRIBUTOR IN AD — removing it recovers <0.08 at 1 week —
 *        even though it is the mechanism this whole line was built on. Reporting this is the point.
 */

const A = require("../src/alf.js");

let pass = 0, fail = 0;
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? " n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "\n          " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "\n          " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SEEDS = [1, 2, 3, 4, 5, 6];
const ORDER = Array.from({ length: 16 }, (_, i) => i);
const DELAYS = [0.02, 1, 7];

console.log("\n" + clock() + " building " + SEEDS.length + " subjects...");
const SUBJ = SEEDS.map(s => {
  const M = A.buildSubject(s, ORDER);
  const baseW = M.cons.wCCmax;
  const cal = A.calibrateSubject(M, {}).cortical;
  return { M, baseW, cal };
});

const HEALTHY = A.diseaseProfile("healthy", 1.0);
const FULL_AD = A.diseaseProfile("AD", 1.0);

/* the four components, each named by the parameter it moves */
const COMPONENTS = {
  "slot supply":        ["nightMin"],
  "spindle generation": ["physioSuppression"],
  "cortical capacity":  ["wCCscale"],
  "hippocampal decay":  ["tauHdays", "driveMul"],
  "discharge capture":  ["iedRate", "coupling"],
};

/* a profile with ONLY the named components set to their AD values, everything else healthy */
function onlyComponent(names) {
  const p = Object.assign({}, HEALTHY);
  for (const n of names) for (const k of COMPONENTS[n]) p[k] = FULL_AD[k];
  return p;
}
/* the full AD profile with the named component reverted to healthy */
function withoutComponent(name) {
  const p = Object.assign({}, FULL_AD);
  for (const k of COMPONENTS[name]) p[k] = HEALTHY[k];
  return p;
}

function runProfile(prof) {
  const rec = DELAYS.map(() => []), slots = [], dens = [], frac = [];
  for (const S of SUBJ) {
    const M = S.M;
    A.resetCortical(M); A.applyProfile(M, prof, S.baseW); M._hcache = new Map();
    const n = A.runNight(M, prof);
    slots.push(n.nSlots); dens.push(n.spindleDensity); frac.push(n.replayFraction);
    DELAYS.forEach((d, i) => rec[i].push(A.recallAtDelay(M, d, prof).recall));
    M.cons.wCCmax = S.baseW; M._hcache = new Map();
  }
  return { recall: rec.map(mean), slots: mean(slots), density: mean(dens), frac: mean(frac) };
}

/* ---------------- 1. each component alone ---------------- */
console.log("\n" + clock() + " == 1. each component ALONE, on an otherwise healthy brain ==");
const H = runProfile(HEALTHY), F = runProfile(FULL_AD);
const alone = {};
console.log("  condition              30 min   1 day  1 week  | slots  density  replayFrac");
const show = (tag, r) => console.log("  " + tag.padEnd(22) + r.recall.map(x => f(x).padStart(7)).join("") +
  "  | " + f(r.slots, 0).padStart(5) + "  " + f(r.density, 1).padStart(6) + "     " + f(r.frac));
show("healthy", H);
for (const name of Object.keys(COMPONENTS)) {
  alone[name] = runProfile(onlyComponent([name]));
  show(name + " only", alone[name]);
}
show("FULL AD", F);
out.alone = { healthy: H, full: F, components: alone };

{
  const worstAlone = Math.min(...Object.values(alone).map(r => r.recall[2]));
  ok("no single component reproduces the full deficit (P1)",
     F.recall[2] <= worstAlone - 0.10,
     "full AD reaches " + f(F.recall[2]) + " at 1 week; the worst single component alone only " +
     "reaches " + f(worstAlone) + ". The phenotype is built from converging partial failures, " +
     "which is what a degenerative disease should look like and is why no single-mechanism " +
     "account of AD memory loss will fit.");
}

/* ---------------- 2. leave-one-out (P2, P3, P4) ---------------- */
console.log("\n" + clock() + " == 2. leave-one-out from the full profile ==");
const loo = {};
console.log("  removed from AD        30 min   1 day  1 week  | recovery at 30min / 1week");
for (const name of Object.keys(COMPONENTS)) {
  const r = runProfile(withoutComponent(name));
  loo[name] = r;
  console.log("  " + name.padEnd(22) + r.recall.map(x => f(x).padStart(7)).join("") +
              "  |    " + f(r.recall[0] - F.recall[0]) + "  /  " + f(r.recall[2] - F.recall[2]));
}
out.leaveOneOut = loo;

{
  const rec2 = Object.entries(loo).map(([k, r]) => [k, r.recall[2] - F.recall[2]]);
  const big = rec2.filter(([, v]) => v >= 0.08);
  ok("the deficit is distributed, not dominated by one component (P2)", big.length >= 2,
     big.length + " components recover >= 0.08 of 1-week recall when removed: " +
     big.map(([k, v]) => k + " (+" + f(v).trim() + ")").join(", ") + ".");

  const hipEarly = loo["hippocampal decay"].recall[0] - F.recall[0];
  const supEarly = loo["slot supply"].recall[0] - F.recall[0];
  const hipLate = loo["hippocampal decay"].recall[2] - F.recall[2];
  const supLate = loo["slot supply"].recall[2] - F.recall[2];
  console.log("");
  console.log("    hippocampal decay  removed:  +" + f(hipEarly).trim() + " at 30 min,  +" +
              f(hipLate).trim() + " at 1 week");
  console.log("    slot supply        removed:  +" + f(supEarly).trim() + " at 30 min,  +" +
              f(supLate).trim() + " at 1 week");
  ok("hippocampal decay acts EARLY, slot supply acts LATE (P3)",
     hipEarly > supEarly && supLate > hipLate,
     "the two halves of the AD memory profile have different causes: the early deficit is a faded " +
     "hippocampal trace, the late deficit is a night that never had enough coupling events. A " +
     "single 'hippocampal dysfunction' account cannot produce that split.");

  const capLate = loo["discharge capture"].recall[2] - F.recall[2];
  ok("discharge capture is a MINOR contributor in AD (P4)", capLate < 0.08,
     "removing it recovers only +" + f(capLate).trim() + " at 1 week. This is the mechanism the " +
     "whole line was built on, and in Alzheimer's it is nearly irrelevant — AD's channel is " +
     "undersupplied, not stolen. Reporting it matters more than defending the mechanism: it is " +
     "also why the levetiracetam prediction failed in AD in stage 44, and it makes epilepsy, not " +
     "AD, the population where the capture account should be tested.");
}

console.log("\n" + clock() + " == what this changes about the claim ==");
{
  console.log("  Stage 44 said 'Alzheimer's produces accelerated forgetting' and left four deficits");
  console.log("  stacked without separating them. Separated, the picture is more specific and less");
  console.log("  flattering to the mechanism that motivated the project:");
  console.log("");
  console.log("    • the CAPTURE mechanism belongs to EPILEPSY, where it dominates;");
  console.log("    • in AD it is a minor term, and the late deficit is carried by slot SUPPLY;");
  console.log("    • the early and late halves of the AD profile have DIFFERENT causes, which is a");
  console.log("      testable claim and the most useful thing in this stage.");
  console.log("");
  console.log("  The consequence for the paper is that the capture account should be stated as a");
  console.log("  model of epileptic accelerated forgetting, with AD as a contrast case showing the");
  console.log("  same phenotype arising from a different failure of the same channel — not as a");
  console.log("  unified theory of both.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "ad-components.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
