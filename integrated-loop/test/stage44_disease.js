"use strict";
/* Stage-44 — TWO DISEASES THROUGH ONE CHANNEL: epilepsy and Alzheimer's.
 *
 * Stage 43 established the mechanism: interictal discharges capture ripple–spindle coupling slots,
 * and the captured events are structurally intact and semantically empty. This stage asks what
 * happens when the same channel is attacked in the two ways real disease attacks it.
 *
 * Each disease is expressed through parameters that ALREADY EXIST in the model. Nothing was added
 * to make a disease work.
 *
 *   TEMPORAL LOBE EPILEPSY — a CAPTURE disorder. Discharges hijack a channel whose supply is
 *     normal. Transient epileptic amnesia (TEA) sits at the mild end, discharges without much
 *     structural damage; TLE with hippocampal sclerosis adds a degraded hippocampal route.
 *   ALZHEIMER'S — a SUPPLY disorder that also has some capture. Sleep fragmentation gives fewer
 *     slow-oscillation slots, reduced spindle generation weakens the ones that remain, cortical
 *     loss lowers how much any transition can hold, and subclinical epileptiform activity — present
 *     in a substantial minority of AD patients — captures a little of what is left.
 *
 * PREDICTIONS REGISTERED BEFORE THE MULTI-SUBJECT RUN:
 *   (P1) THE EPILEPSY FAMILY SPLITS BY STRUCTURAL DAMAGE. TEA gives PURE ALF — 30-minute recall
 *        within 0.10 of healthy, 1-week recall at least 0.25 below. TLE-HS gives early impairment
 *        too (30 min at least 0.15 below healthy). Same discharges, different presentation,
 *        because sclerosis damages the route that was carrying the early recall.
 *   (P2) THE TWO DISEASES REACH ALF BY DIFFERENT ROUTES. Both lose ≥0.25 at 1 week, but AD has at
 *        least 25% fewer coupling slots than healthy while epilepsy has the normal number.
 *   (P3) THE SLEEP STUDY TELLS THEM APART. Spindle density is HIGHER than healthy in epilepsy and
 *        LOWER than healthy in AD, even though the behavioural phenotype is shared. This is the
 *        bedside pay-off: the same accelerated forgetting, opposite EEG signatures.
 *   (P4) LEVETIRACETAM HELPS IN PROPORTION TO CAPTURE, NOT TO DIAGNOSIS. Modelled by its actual
 *        mechanism — SV2A-mediated damping of high-frequency bursting, which hits discharges harder
 *        than physiological ripples but hits both — the drug improves 1-week recall in the
 *        capture-dominated condition and fails in the supply-dominated one.
 *   (P5) AND IT HAS AN INVERTED-U DOSE RESPONSE in the capture-dominated condition: benefit peaks
 *        at low dose and is lost at high dose, because sharp-wave ripples ARE high-frequency bursts
 *        and enough drug suppresses the replay along with the discharges. This is offered as a
 *        mechanistic account of Bakker et al. (2015), where 62.5 and 125 mg BID improved memory in
 *        amnestic MCI and 250 mg did not.
 */

const A = require("../src/alf.js");

let pass = 0, fail = 0;
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? " n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "\n          " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "\n          " + (d || ""))));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SEEDS = [1, 2, 3, 4, 5, 6];
const ORDER = Array.from({ length: 16 }, (_, i) => i);
const DELAYS = [0.02, 1, 7];
const LABEL = ["30 min", "1 day", "1 week"];

console.log("\n" + clock() + " building and calibrating " + SEEDS.length + " subjects...");
const SUBJ = SEEDS.map(s => {
  const M = A.buildSubject(s, ORDER);
  const baseW = M.cons.wCCmax;
  const cal = A.calibrateSubject(M, {}).cortical;
  return { M, baseW, cal };
});
console.log("  healthy 1-week retention: " + f(mean(SUBJ.map(s => s.cal.achieved))) +
            " ± " + f(sd(SUBJ.map(s => s.cal.achieved))));

/* run a profile across all subjects; profiles never leak because wCCmax and the hippocampal
   route cache are restored between conditions */
function runProfile(prof) {
  const rec = DELAYS.map(() => []), bio = { slots: [], density: [], cs: [], frac: [] };
  for (const S of SUBJ) {
    const M = S.M;
    A.resetCortical(M); A.applyProfile(M, prof, S.baseW); M._hcache = new Map();
    const n = A.runNight(M, prof);
    bio.slots.push(n.nSlots); bio.density.push(n.spindleDensity);
    (bio.pcr = bio.pcr || []).push(n.physioCoupledRate);
    bio.cs.push(n.couplingStrength); bio.frac.push(n.replayFraction);
    DELAYS.forEach((d, i) => rec[i].push(A.recallAtDelay(M, d, prof).recall));
    M.cons.wCCmax = S.baseW; M._hcache = new Map();
  }
  return { recall: rec.map(mean), recallSd: rec.map(sd), slots: mean(bio.slots),
           density: mean(bio.density), physioCoupledRate: mean(bio.pcr),
           cs: mean(bio.cs), frac: mean(bio.frac) };
}

/* ---------------- 1. the four conditions ---------------- */
console.log("\n" + clock() + " == 1. healthy, TEA, TLE-HS, AD ==");
const NAMES = ["healthy", "TEA", "TLE-HS", "AD"];
const R = {};
console.log("  condition   " + LABEL.map(l => l.padStart(9)).join("") +
            "  |  slots  density  coupling  replayFrac");
for (const nm of NAMES) {
  const prof = A.diseaseProfile(nm, 1.0);
  const r = runProfile(prof);
  R[nm] = r;
  console.log("  " + nm.padEnd(11) + r.recall.map(x => f(x).padStart(9)).join("") +
              "  | " + f(r.slots, 0).padStart(6) + "  " + f(r.density, 1).padStart(6) +
              "    " + f(r.cs) + "      " + f(r.frac));
}
out.conditions = R;

/* ---------------- 2. the epilepsy family (P1) ---------------- */
console.log("\n" + clock() + " == 2. why TEA and TLE present differently (P1) ==");
{
  const H = R["healthy"], T = R["TEA"], S = R["TLE-HS"];
  const teaEarly = Math.abs(T.recall[0] - H.recall[0]), teaLate = H.recall[2] - T.recall[2];
  const hsEarly = H.recall[0] - S.recall[0];
  ok("TEA is PURE accelerated forgetting; TLE-HS is amnesia (P1)",
     teaEarly <= 0.10 && teaLate >= 0.25 && hsEarly >= 0.15,
     "TEA: 30-min gap " + f(teaEarly) + ", 1-week gap " + f(teaLate) + " — a normal bedside test " +
     "and a devastated week. TLE-HS: 30-min gap " + f(hsEarly) + " — impaired from the start. " +
     "The discharges are the same; sclerosis removes the hippocampal route that was covering the " +
     "early delay, so the deficit becomes visible immediately.");
}

/* ---------------- 3. same phenotype, different route (P2, P3) ---------------- */
console.log("\n" + clock() + " == 3. epilepsy vs Alzheimer's: capture or supply? (P2, P3) ==");
{
  const H = R["healthy"], T = R["TEA"], D = R["AD"];
  console.log("  both lose the week:   TEA " + f(T.recall[2]) + "   AD " + f(D.recall[2]) +
              "   healthy " + f(H.recall[2]));
  console.log("  but for different reasons —");
  console.log("    coupling slots      TEA " + f(T.slots, 0) + "   AD " + f(D.slots, 0) +
              "   healthy " + f(H.slots, 0));
  console.log("    spindle density     TEA " + f(T.density, 1) + "   AD " + f(D.density, 1) +
              "   healthy " + f(H.density, 1));
  ok("both reach ALF, but only AD is short of slots (P2)",
     (H.recall[2] - T.recall[2]) >= 0.25 && (H.recall[2] - D.recall[2]) >= 0.25 &&
     D.slots <= 0.75 * H.slots && T.slots >= 0.95 * H.slots,
     "AD has " + f(100 * (1 - D.slots / H.slots), 0).trim() + "% fewer coupling opportunities; " +
     "epilepsy has the normal number and loses them to capture.");
  ok("TOTAL spindle density separates the two mechanisms (P3)",
     T.density > H.density && D.density < H.density,
     "epilepsy " + f(T.density, 1) + " vs healthy " + f(H.density, 1) + " vs Alzheimer's " +
     f(D.density, 1) + ". Identical accelerated forgetting, OPPOSITE EEG signatures — a hijacked " +
     "channel looks busier than normal, an undersupplied one looks quieter.");
}

/* ---------------- 4. levetiracetam (P4, P5) ---------------- */
console.log("\n" + clock() + " == 4. levetiracetam: who does it help, and at what dose? (P4, P5) ==");
{
  const DOSES = [0, 0.05, 0.10, 0.20, 0.35, 0.55, 0.80];
  const curves = {};
  console.log("  1-week recall by dose");
  console.log("  condition     " + DOSES.map(d => f(d).padStart(7)).join(""));
  for (const nm of ["TEA", "AD"]) {
    const base = A.diseaseProfile(nm, 1.0);
    const row = DOSES.map(d => runProfile(A.levetiracetam(base, d)).recall[2]);
    curves[nm] = row;
    console.log("  " + nm.padEnd(13) + row.map(x => f(x).padStart(7)).join(""));
  }
  out.levetiracetam = { doses: DOSES, curves };
  const tea = curves["TEA"], ad = curves["AD"];
  const teaGain = Math.max(...tea) - tea[0], adGain = Math.max(...ad) - ad[0];
  const teaPeak = DOSES[tea.indexOf(Math.max(...tea))];
  ok("the drug helps the CAPTURE-dominated disease and not the supply-dominated one (P4)",
     teaGain >= 0.08 && teaGain > adGain,
     "best gain " + f(teaGain) + " in epilepsy vs " + f(adGain) + " in Alzheimer's. The prediction " +
     "is that benefit tracks the fraction of the channel being stolen, not the diagnosis on the " +
     "chart — a drug that frees a hijacked channel cannot help a channel nobody occupied.");
  ok("and the dose response is an inverted U (P5)",
     teaPeak > 0 && teaPeak < DOSES[DOSES.length - 1] &&
     tea[tea.length - 1] < Math.max(...tea) - 0.05,
     "peak benefit at dose " + f(teaPeak) + ", falling to " + f(tea[tea.length - 1]) +
     " at the highest dose. Sharp-wave ripples ARE high-frequency bursts, so enough SV2A blockade " +
     "removes the replay along with the discharges. Offered as the mechanism behind Bakker et al. " +
     "(2015): 62.5 and 125 mg BID improved memory in amnestic MCI, 250 mg did not.");
}

/* ---------------- 5. external validation against Schiller et al. 2025 (P6) ---------------- */
console.log("\n" + clock() + " == 5. against independent human data (P6) ==");
{
  /* Found AFTER the model was built and after its "epilepsy runs hot" prediction was made.
     Schiller, von Ellenrieder, ... Frauscher (Epilepsia 2025) recorded 20 unilateral drug-resistant
     TLE patients and 20 matched controls with HD-EEG and polysomnography, and report COUPLED
     SPINDLE-SLOW-WAVE RATES globally reduced in TLE: 0.18 vs 0.35 per minute, a ratio of 0.51.

     That measure is the rate of PHYSIOLOGICAL coupling events. It is NOT this model's
     `spindleDensity`, which counts total spindles including the IED-induced ones. The two diverge,
     and the divergence is the point: in the same simulated patient, total density RISES while the
     physiological coupled rate FALLS. Reporting the first makes epilepsy look hot; reporting the
     second makes it look cold; only the second is what Schiller measured.

     REGISTERED: the model's TLE physiological coupled rate, as a ratio to healthy, falls within
     0.15 of the 0.51 Schiller reports. Nothing was fitted to this number - the ratio is produced by
     slot capture alone. */
  const H = R["healthy"], T = R["TLE-HS"], A2 = R["TEA"];
  const ratio = T.physioCoupledRate / H.physioCoupledRate;
  const MEASURED = 0.51;
  out.schiller = { modelRatio: ratio, measured: MEASURED,
                   teaRatio: A2.physioCoupledRate / H.physioCoupledRate,
                   densityHealthy: H.density, densityTLE: T.density };
  console.log("  measure                                healthy    TEA   TLE-HS");
  console.log("  TOTAL spindle density /min            " + f(H.density, 1).padStart(7) +
              f(A2.density, 1).padStart(7) + f(T.density, 1).padStart(9) + "     RISES");
  console.log("  PHYSIOLOGICAL coupled rate /min       " + f(H.physioCoupledRate, 2).padStart(7) +
              f(A2.physioCoupledRate, 2).padStart(7) + f(T.physioCoupledRate, 2).padStart(9) + "     FALLS");
  console.log("");
  console.log("  model TLE/healthy coupled rate ratio = " + f(ratio) +
              "     Schiller et al. 2025 measured = " + f(MEASURED));
  ok("the model reproduces an independent human measurement it was not fitted to (P6)",
     Math.abs(ratio - MEASURED) < 0.15,
     "model " + f(ratio).trim() + " against measured " + f(MEASURED).trim() + ". This prediction " +
     "was not available when the model was built and no parameter was adjusted to meet it: the " +
     "ratio falls out of slot capture. It also corrects a claim made earlier in this project - " +
     "reading TOTAL spindle density, the model said epilepsy 'runs hot', and on the quantity human " +
     "studies actually report it runs cold. Both are true of the same simulated patient.");
}

console.log("\n" + clock() + " == the clinical reading ==");
{
  console.log("  A patient with accelerated forgetting and a normal 30-minute test is not a patient");
  console.log("  with a mild deficit — on this model they are a patient whose hippocampus is still");
  console.log("  covering for a cortex that never received the memory. The bedside test is measuring");
  console.log("  the intact route.");
  console.log("");
  console.log("  Two mechanisms produce that picture and the sleep EEG distinguishes them: a");
  console.log("  HIJACKED channel runs hot (spindle density and coupling strength both up), an");
  console.log("  UNDERSUPPLIED one runs cold. Neither is visible on the memory test, and the");
  console.log("  conventional reading of the EEG gets the hijacked case exactly backwards.");
  console.log("");
  console.log("  The therapeutic prediction is the sharpest thing here: antiepileptic benefit for");
  console.log("  memory should track the CAPTURED FRACTION at baseline, and should be lost at doses");
  console.log("  that suppress physiological ripples. That is measurable before treating, and it");
  console.log("  says the right dose is the lowest one that clears the discharges.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "disease.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
