"use strict";
/* Registered tests for the olivocerebellar loop-instability hypothesis.
   Predictions and kill criteria fixed in docs/OLIVARY-LOOP-PREBUILD.md BEFORE the model was written.
   Nothing here is re-specified to make a row pass. */

const M = require("../models/olivary-loop.js");

let pass = 0, fail = 0;
const g = (x, d = 3) => (x == null || Number.isNaN(x) ? "  n/a" : (x >= 0 ? " " : "") + x.toFixed(d));
const e = x => x.toExponential(2);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "\n          " + d))
                           : (fail++, console.log("  FAIL  " + n + "\n          " + d)));

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const HEALTHY = { cfGain: 1.0 };
const ET = { cfGain: 6.0 };

const over = (opts) => {
  const rs = SEEDS.map(s => M.run(Object.assign({ seed: s }, opts)));
  const pick = k => rs.map(r => r[k]);
  return {
    ioR: mean(pick("ioR")), cs: mean(pick("csRatePerCell")),
    peakF: mean(pick("dcnPeakF")), peakFsd: sd(pick("dcnPeakF")),
    volF: mean(pick("volPeakF")),
    trem: mean(pick("tremorAbs")), tremSd: sd(pick("tremorAbs")),
    frac: mean(pick("tremorFrac")), raw: rs,
  };
};

console.log("\n=== olivocerebellar loop instability — 12 seeds per condition ===");
const H = over(HEALTHY), T = over(ET);
console.log("\n  condition        ioR   CS/cell   DCN peak    tremor power   4-12Hz frac");
const row = (n, x) => console.log("  " + n.padEnd(14) + g(x.ioR) + g(x.cs).padStart(9) +
  (g(x.peakF, 1) + " Hz").padStart(12) + e(x.trem).padStart(15) + g(x.frac).padStart(13));
row("healthy", H); row("ET (cfGain 6)", T);

/* ---- P1: 1 Hz cells, 4-12 Hz population rhythm ---- */
console.log("\n[P1] does a ~1 Hz per-cell complex-spike rate coexist with a 4-12 Hz population rhythm?");
ok("P1 tremor-band population rhythm on sub-2 Hz per-cell spiking",
   T.cs < 2.0 && T.peakF >= 4 && T.peakF <= 12,
   "per-cell CS " + g(T.cs) + " Hz with a population peak at " + g(T.peakF, 1) + " Hz. The camp-2 " +
   "objection — 'complex spikes fire at ~1 Hz so cannot carry a 4-12 Hz tremor' — conflates per-cell " +
   "rate with population rhythm. Kill criterion was per-cell CS > 2 Hz.");

/* ---- P2: is the loop necessary? ---- */
console.log("\n[P2] open the loop (nucleo-olivary drive frozen) WITH the full lesion present");
const Topen = over(Object.assign({}, ET, { loopOpen: true }));
row("ET loop-open", Topen);
const p2drop = 1 - Topen.trem / T.trem;
ok("P2 opening the loop abolishes the tremor",
   Topen.trem < 0.4 * T.trem,
   "tremor power " + e(T.trem) + " -> " + e(Topen.trem) + " (" + g(100 * p2drop, 0).trim() + "% reduction). " +
   "Kill criterion was tremor persisting with the loop open, which would make this a feedforward " +
   "oscillation to which the loop contributes nothing.");

/* ---- P3: gap junctions (CONSTRAINT, matches Marshall & Lang 2006) ---- */
console.log("\n[P3] remove olivary gap-junction coupling (constraint, not a prediction)");
const Tnogap = over(Object.assign({}, ET, { gGap: 0 }));
row("ET gGap=0", Tnogap);
ok("P3 gap-junction block abolishes the tremor",
   Tnogap.trem < 0.4 * T.trem,
   "tremor power " + e(T.trem) + " -> " + e(Tnogap.trem) + ". Marshall & Lang (2006) showed olivary " +
   "gap-junction block reduces complex-spike synchrony AND rhythmicity, so a model in which the " +
   "olive is the resonant element must lose the rhythm here.");

/* ---- the lesion the loop's SIGN STRUCTURE points to ---- */
console.log("\n[extra] the nucleo-olivary lesion: dentato-olivary interruption (oculopalatal tremor)");
const OPT = over({ cfGain: 1.0, noLesion: 0.9 });
row("nucleo-oliv -90%", OPT);
console.log("     Every cerebellar CORTICAL lesion raises DCN output and therefore raises shunting,");
console.log("     de-coupling the olive. Only removing nucleo-olivary inhibition itself de-shunts it.");
const OPTnogap = over({ cfGain: 1.0, noLesion: 0.9, gGap: 0 });
row("  + gGap=0", OPTnogap);
console.log("     gap-junction dependence: ET-lesion " + g(Tnogap.trem / T.trem, 2) +
            " of tremor retained, nucleo-olivary lesion " + g(OPTnogap.trem / OPT.trem, 2) + ".");

/* ---- P4: tremor vs ataxia dissociation ---- */
console.log("\n[P4] two cerebellar lesions: CF->PC gain (AC) versus Purkinje loss (DC)");
const PL = over({ cfGain: 1.0, pcLoss: 0.6 });
row("PC loss 60%", PL);
const cfTrem = T.trem / H.trem, plTrem = PL.trem / H.trem;
ok("P4 the two lesions dissociate",
   cfTrem > 2.0 && plTrem < 2.0,
   "CF-gain lesion multiplies tremor power x" + g(cfTrem, 1).trim() + "; Purkinje loss x" +
   g(plTrem, 1).trim() + ". Kill criterion was both lesions producing tremor, or neither.");

/* ---- P5: frequency invariance, amplitude scaling ---- */
console.log("\n[P5] does lesion severity move the FREQUENCY or only the AMPLITUDE?");
console.log("     cfGain    DCN peak (Hz)      tremor power   ratio to healthy");
const sweep = [1, 2, 3, 4, 6, 8].map(cg => ({ cg, r: over({ cfGain: cg }) }));
for (const s of sweep)
  console.log("     " + String(s.cg).padStart(6) + (g(s.r.peakF, 2) + " +/- " + g(s.r.peakFsd, 2).trim()).padStart(20) +
              e(s.r.trem).padStart(16) + g(s.r.trem / H.trem, 1).padStart(15) + "x");
const fs = sweep.map(s => s.r.peakF), amps = sweep.map(s => s.r.trem);
const fSpread = (Math.max(...fs) - Math.min(...fs)) / mean(fs);
const aSpread = Math.max(...amps) / Math.min(...amps);
ok("P5 frequency is near-invariant while amplitude scales",
   fSpread < 0.25 && aSpread > 3,
   "frequency varies " + g(100 * fSpread, 0).trim() + "% across an 8x lesion range while amplitude " +
   "varies " + g(aSpread, 1).trim() + "x. Clinically ET amplitude progresses while frequency stays " +
   "stable; the kill criterion was frequency tracking lesion magnitude.");

/* ---- the olivary frequency claim: is the rhythm the OLIVE's, or the loop delay's? ---- */
console.log("\n[extra] is the tremor frequency set by the OLIVE or by the LOOP DELAY?");
console.log("     this was not a registered row, but it decides what the olive actually contributes");
console.log("     fIO (Hz)  loopDelay(ms)   DCN peak (Hz)");
for (const [fIO, ld] of [[4, 20], [6, 20], [9, 20], [6, 10], [6, 40], [6, 60]]) {
  const r = over(Object.assign({}, ET, { fIO, loopDelay: ld / 1000 }));
  console.log("     " + g(fIO, 1).padStart(8) + String(ld).padStart(13) + g(r.peakF, 2).padStart(16));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
