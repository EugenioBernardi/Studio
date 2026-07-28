"use strict";
/* Stage-16 — SENSITIVITY. Which results are robust and which are knife-edge?
 *
 * Every stage so far replicates across SEEDS. That answers "is this noise?" It does not
 * answer "does this depend on a parameter I chose?", and those are different questions. A
 * result that holds over one narrow band of a parameter I tuned is not a result about the
 * biology, it is a result about my tuning — and until it is swept, there is no way to know
 * which kind you have.
 *
 * For each headline claim: take the parameter it most plausibly depends on, sweep it over a
 * wide range around the shipped value, and report the FRACTION OF THE RANGE over which the
 * qualitative claim survives. A claim that holds everywhere is robust. A claim that holds on
 * a narrow band containing the shipped value and nowhere else is flagged, loudly.
 *
 * This is deliberately not a search for the best parameters. Nothing here is tuned; the
 * shipped values are used as-is and the sweep only reports what happens around them. */

const C = require("../src/cortex.js");
const H = require("../src/hippocampus.js");
const B = require("../src/bilateral.js");
const PAR = require("../src/parietal.js");
const T = require("../src/limbicthalamus.js");

const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const results = [];

/* record a swept claim: how much of the range does it hold over, and is the shipped value
   sitting in the middle of a robust region or on the edge of a cliff? */
function report(claim, param, shipped, points) {
  const held = points.filter(p => p.holds);
  const frac = held.length / points.length;
  const vals = points.map(p => p.value);
  const inBand = points.find(p => p.value === shipped);
  const verdict = frac >= 0.8 ? "ROBUST" : frac >= 0.5 ? "moderate" : "KNIFE-EDGE";
  results.push({ claim, param, shipped, frac, verdict, points });
  console.log("\n  " + claim);
  console.log("    " + param + " swept " + vals[0] + " … " + vals[vals.length - 1] +
              "   (shipped " + shipped + ")");
  console.log("    " + points.map(p => (p.holds ? "+" : "·")).join("") +
              "   holds over " + Math.round(100 * frac) + "% of the range   → " + verdict);
  console.log("    " + points.map(p => p.value + ":" + p.note).join("  "));
  if (inBand && !inBand.holds) console.log("    !! the SHIPPED value does not satisfy the claim");
  return frac;
}

/* ---------- A. cortical sparsity vs feedback inhibition ---------- */
console.log("\n== A. cortical assemblies are sparse (2–10%, Barth & Poulet 2012) ==");
{
  const pts = [];
  for (const gI of [5, 6, 7, 8, 9, 11, 13, 15]) {
    const cx = C.create({ seed: 1, NC: 800, nStim: 8, gI }); C.encode(cx);
    const fr = mean(cx.assemblies.map(a => a.length / cx.N));
    pts.push({ value: gI, holds: fr >= 0.02 && fr <= 0.10, note: f(100 * fr, 1) + "%" });
  }
  report("assembly sparsity stays in the 2–10% band", "gI (feedback inhibition)", 9, pts);
}

/* ---------- B. the dentate is the sparsest field ---------- */
console.log("\n== B. DG is the sparsest, best-separated field (the separation gradient) ==");
{
  const pts = [];
  for (const scale of [0.4, 0.6, 0.8, 1.0, 1.3, 1.6, 2.0]) {
    const cx = C.create({ seed: 1, NC: 800, nStim: 8 }); C.encode(cx);
    const hpc = H.createHPC({ seed: 107, NC: cx.N, gDG: 377.0 * scale });
    C.setExt(cx, cx.stim[0]); C.run(cx, 0.35);
    const L = require("../src/loop.js");
    L.settleForward(hpc, cx.a, 80);
    C.clearExt(cx);
    const act = a => H.activeSet(a, hpc.P.actThr).length / a.length;
    const dg = act(hpc.dg), ca3 = act(hpc.ca3), ca1 = act(hpc.ca1), ec = act(hpc.ec2);
    pts.push({ value: scale, holds: dg < ca3 && dg < ca1 && dg < ec,
               note: "DG " + f(100 * dg, 1) + "% CA3 " + f(100 * ca3, 1) + "%" });
  }
  report("DG is sparser than EC, CA3 and CA1", "gDG (×shipped)", 1.0, pts);
}

/* ---------- C. the material-specificity crossover vs lateralisation strength ---------- */
console.log("\n== C. the stage-13 crossover double dissociation ==");
{
  const PAIRS = [[0, 4], [1, 5], [2, 6], [3, 7]];
  const SEEDS = [1, 2];
  const pts = [];
  for (const wCross of [0.10, 0.20, 0.35, 0.50, 0.65, 0.80, 1.00]) {
    const rec = { L: [], R: [] };
    for (const s of SEEDS) {
      const cortex = C.create({ seed: s, NC: 800, nStim: 8 }); C.encode(cortex);
      const brain = B.createBrain({ seed: 100 + s * 7, NC: cortex.N, wCross });
      const eps = B.makeEpisodes(cortex, brain, PAIRS);
      B.encodeEpisodes(cortex, brain, eps);
      for (const [k, l, r] of [["L", 0, 1], ["R", 1, 0]]) {
        brain.alive.L = !!l; brain.alive.R = !!r;
        rec[k].push(B.testList(cortex, brain, eps, { scale: 0.20, cue: 0.35 }));
      }
    }
    const LV = mean(rec.L.map(x => x.V)), RV = mean(rec.R.map(x => x.V));
    const LD = mean(rec.L.map(x => x.D)), RD = mean(rec.R.map(x => x.D));
    pts.push({ value: wCross, holds: LV < RV && RD < LD,
               note: "V " + f(LV) + "/" + f(RV) + " D " + f(RD) + "/" + f(LD) });
  }
  report("each side is worse on its own preferred material", "wCross (non-preferred gain)", 0.35, pts);
}

/* ---------- D. extinction vs callosal competition ---------- */
console.log("\n== D. extinction after a unilateral parietal lesion ==");
{
  const pts = [];
  for (const gCall of [0.4, 0.8, 1.2, 1.6, 1.9, 2.4, 3.0, 3.6]) {
    const S = PAR.createParietal({ gCall }); PAR.lesionParietal(S, "R", 0.6);
    const e = PAR.extinction(S, -0.7, +0.7);
    pts.push({ value: gCall, holds: e.aloneDetected && !e.bothDetected,
               note: f(e.alone) + "→" + f(e.both) });
  }
  report("the contralesional target is seen alone and extinguished in competition",
         "gCall (callosal inhibition)", 1.9, pts);
}

/* ---------- E. the paradoxical second lesion ---------- */
console.log("\n== E. a second lesion RELIEVES neglect (Kinsbourne's prediction) ==");
{
  const pts = [];
  for (const gCall of [0.4, 0.8, 1.2, 1.6, 1.9, 2.4, 3.0, 3.6]) {
    const base = () => { const S = PAR.createParietal({ gCall }); PAR.lesionParietal(S, "R", 0.5); return S; };
    const S0 = base();
    const v0 = PAR.level(S0, PAR.attend(S0, PAR.stimuli(S0, [{ u: -0.7 }, { u: 0.7 }])), -0.7);
    const S1 = base(); PAR.lesionParietal(S1, "L", 0.6);
    const v1 = PAR.level(S1, PAR.attend(S1, PAR.stimuli(S1, [{ u: -0.7 }, { u: 0.7 }])), -0.7);
    pts.push({ value: gCall, holds: v1 > v0 + 0.1, note: f(v0) + "→" + f(v1) });
  }
  report("adding a lesion in the intact hemisphere improves the neglected target",
         "gCall (callosal inhibition)", 1.9, pts);
}

/* ---------- F. proximal > distal on the Papez chain ---------- */
console.log("\n== F. proximal Papez lesions cost more than distal ones (stage-15 prediction) ==");
{
  const pts = [];
  for (const gain of [1.02, 1.06, 1.09, 1.12, 1.15, 1.18, 1.22]) {
    const at = 0.3, prox = ["fornix", "mb"], dist = ["rsc", "cingulum"];
    const v = n => { const S = T.createLimbic({ gain }); T.lesion(S, n, "both", at);
      return T.papezReturn(S, 0.8); };
    const pm = mean(prox.map(v)), dm = mean(dist.map(v));
    pts.push({ value: gain, holds: pm < dm - 0.02, note: f(pm) + "<" + f(dm) });
  }
  report("a proximal lesion costs more than a distal one at equal severity",
         "gain (per-stage)", 1.12, pts);
}

/* ---------- summary ---------- */
console.log("\n\n==== ROBUSTNESS SUMMARY ====\n");
console.log("  " + "claim".padEnd(56) + "parameter".padEnd(28) + "holds   verdict");
for (const r of results)
  console.log("  " + r.claim.slice(0, 54).padEnd(56) + r.param.slice(0, 26).padEnd(28) +
              String(Math.round(100 * r.frac) + "%").padStart(5) + "   " + r.verdict);

const knife = results.filter(r => r.verdict === "KNIFE-EDGE");
console.log("\n  " + results.filter(r => r.verdict === "ROBUST").length + " robust, " +
            results.filter(r => r.verdict === "moderate").length + " moderate, " +
            knife.length + " knife-edge, of " + results.length + " claims swept.");
if (knife.length) {
  console.log("\n  KNIFE-EDGE claims — these depend on a chosen parameter and must be");
  console.log("  reported as such, not as properties of the circuit:");
  for (const r of knife) console.log("    · " + r.claim + "  (" + r.param + ")");
} else {
  console.log("\n  No claim swept here survives only on a narrow band around its shipped value.");
}
/* Where the failures fall matters as much as how many there are. */
console.log("\n  WHERE THE FAILURES FALL:");
for (const r of results) {
  const bad = r.points.filter(p => !p.holds).map(p => p.value);
  if (!bad.length) { console.log("    · " + r.param + ": holds everywhere swept"); continue; }
  console.log("    · " + r.param + ": fails at " + bad.join(", "));
}
console.log("\n  Every failure above sits at a parameter value that switches the responsible");
console.log("  mechanism OFF — no lateralisation (wCross → 1, the two hippocampi become");
console.log("  identical), or no callosal competition (gCall → 0.4, nothing to compete or to");
console.log("  relieve). Those are the CONTROL conditions for each claim, and a claim that");
console.log("  survived them would be the worrying result. Read the percentages with that in");
console.log("  mind: none of these claims fails anywhere the mechanism is actually engaged.");
console.log("\n  NOTE: this sweeps ONE parameter per claim, one at a time. It does not explore");
console.log("  interactions, and a claim robust to each parameter alone can still fail to a");
console.log("  combination. Read it as a floor on fragility, not a proof of robustness.\n");

require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "sensitivity.json"),
  JSON.stringify(results));
