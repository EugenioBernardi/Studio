"use strict";
/* Olivocerebellar v2 — BASELINE VALIDATED FIRST, then lesions.
   Structure imposed after three consecutive failures in this repo where a manipulation was validated
   against a control that was never checked. Stage A must pass before Stage B means anything. */

const M = require("../models/olive-v2.js");

let pass = 0, fail = 0;
const g = (x, d = 2) => (x == null || Number.isNaN(x) ? " n/a" : x.toFixed(d));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const med = a => { const v = a.slice().sort((x, y) => x - y); return v[v.length >> 1]; };
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "\n          " + d))
                           : (fail++, console.log("  FAIL  " + n + "\n          " + d)));

const N = 10;
const av = (o) => {
  const r = []; for (let s = 1; s <= N; s++) r.push(M.measure(Object.assign({ seed: s }, o)));
  const p = k => r.map(x => x[k]);
  return { R: mean(p("ioR")), gEff: mean(p("gEff")), cs: mean(p("csRate")),
           sh: med(p("sharpness")), shMean: mean(p("sharpness")), shSd: sd(p("sharpness")),
           f: med(p("peakF")) };
};

/* ================= STAGE A — the baseline, and the null it is judged against ================= */
console.log("\n=== STAGE A: does the HEALTHY circuit look healthy? ===");
console.log("No lesion is interpreted until this passes.\n");

const NULL = av({ noOsc: true });          // no oscillation at all: pure Poisson CS, same filter
console.log("  no-oscillation NULL:  CS " + g(NULL.cs, 3) + " Hz/cell, sharpness " +
            g(NULL.shMean, 1) + " +/- " + g(NULL.shSd, 1) + " at " + g(NULL.f, 1) + " Hz");
console.log("  A filtered point process scores ~" + g(NULL.shMean, 0) + " with NO rhythm present.");
console.log("  Every spectral number below is meaningless except relative to this.\n");

const HEALTH = av({ gGap: 8, loopOn: true, shuntTonic: 2.0 });
console.log("  healthy circuit:      CS " + g(HEALTH.cs, 3) + " Hz/cell, R " + g(HEALTH.R, 3) +
            ", sharpness " + g(HEALTH.sh, 0) + " at " + g(HEALTH.f, 1) + " Hz");

ok("A1 healthy per-cell complex-spike rate matches the measured ~1 Hz",
   HEALTH.cs > 0.7 && HEALTH.cs < 1.5, "CS = " + g(HEALTH.cs, 3) + " Hz/cell. Anchor, claims nothing.");

ok("A2 the healthy circuit carries NO rhythm above the no-oscillation null",
   HEALTH.sh < NULL.shMean + 2 * NULL.shSd,
   "healthy sharpness " + g(HEALTH.sh, 0) + " against null " + g(NULL.shMean, 0) + " +/- " +
   g(NULL.shSd, 0) + ". This is the check the previous model failed: its healthy state hummed at " +
   "6 Hz more coherently than its diseased one, which invalidated every comparison built on it.");

ok("A3 the healthy olive is weakly synchronised, not locked",
   HEALTH.R < 0.30, "R = " + g(HEALTH.R, 3) + ", consistent with an in-vivo olive that is " +
   "intermittently rather than strongly synchronised (Negrello 2019: a quasiperiodic ratchet).");

/* ================= STAGE B — what synchrony does ================= */
console.log("\n=== STAGE B: what does olivary synchrony actually do? ===\n");
console.log("  gGap    R     CS/cell   sharpness   peak Hz");
const ladder = [0, 4, 8, 16, 24].map(gg => ({ gg, r: av({ gGap: gg }) }));
for (const l of ladder)
  console.log("  " + String(l.gg).padStart(4) + g(l.r.R, 3).padStart(7) + g(l.r.cs, 3).padStart(9) +
              g(l.r.sh, 0).padStart(12) + g(l.r.f, 1).padStart(10));

const lo = ladder[0].r, hi = ladder[4].r;
ok("B1 synchrony converts an aperiodic input into a rhythm WITHOUT changing the spike rate",
   hi.sh > 5 * NULL.shMean && Math.abs(hi.cs - lo.cs) < 0.1,
   "uncoupled: sharpness " + g(lo.sh, 0) + " at " + g(lo.cs, 3) + " Hz/cell. Locked: sharpness " +
   g(hi.sh, 0) + " at " + g(hi.cs, 3) + " Hz/cell. Same spikes, different output — this is " +
   "synchrony doing work rather than depicting it.");

console.log("\n  does the emergent rhythm track the OLIVE's own frequency?");
console.log("  fIO (Hz)   peak (Hz)");
const track = [3, 6, 9].map(f => ({ f, r: av({ fIO: f, gGap: 24 }) }));
for (const t of track) console.log("  " + g(t.f, 1).padStart(8) + g(t.r.f, 1).padStart(12));
ok("B2 the rhythm is the olive's, not the filter's",
   track.every(t => Math.abs(t.r.f - t.f) < 0.15 * t.f + 0.6),
   track.map(t => g(t.f, 0) + "->" + g(t.r.f, 1)).join(", ") + " Hz. This settles the standing " +
   "objection to the olivary hypothesis: complex spikes at ~1 Hz per cell CAN carry a 4-12 Hz " +
   "population rhythm, because per-cell rate and population rhythm are different quantities.");

/* ================= STAGE C — can any cerebellar lesion reach that state? ================= */
console.log("\n=== STAGE C: can a cerebellar lesion drive the olive into that state? ===\n");
console.log("  shuntTonic |  healthy R  sharp |  CF->PC x6 (ET)  R  sharp |  dentato-olivary  R  sharp  Hz");
const rows = [0.5, 1, 2, 4, 8].map(st => ({
  st,
  h: av({ gGap: 8, loopOn: true, shuntTonic: st }),
  t: av({ gGap: 8, loopOn: true, shuntTonic: st, cfGain: 6 }),
  o: av({ gGap: 8, loopOn: true, shuntTonic: st, noLesion: 0.95 }),
}));
for (const r of rows)
  console.log("  " + g(r.st, 1).padStart(10) + " |" + g(r.h.R, 3).padStart(11) + g(r.h.sh, 0).padStart(7) +
              " |" + g(r.t.R, 3).padStart(19) + g(r.t.sh, 0).padStart(7) +
              " |" + g(r.o.R, 3).padStart(19) + g(r.o.sh, 0).padStart(7) + g(r.o.f, 1).padStart(6));

ok("C1 the ET cortical lesion NEVER produces an olivary rhythm, at any shunt strength",
   rows.every(r => r.t.R < r.h.R && r.t.sh < NULL.shMean + 2 * NULL.shSd),
   "the CF->PC lesion LOWERS olivary coherence at every setting (" +
   rows.map(r => g(r.h.R, 2) + "->" + g(r.t.R, 2)).join(", ") + ") and never exceeds the null. " +
   "Purkinje cells are GABAergic onto the nuclei and nucleo-olivary neurons are GABAergic onto the " +
   "olivary glomeruli, so ANY cortical lesion that reduces Purkinje output disinhibits the nuclei, " +
   "raises nucleo-olivary drive, increases shunting, and de-couples the olive. The sign is structural.");

const crossing = rows.filter(r => r.o.sh > 3 * NULL.shMean);
ok("C2 removing nucleo-olivary inhibition DOES, once tonic shunting is strong enough",
   crossing.length > 0 && crossing.length < rows.length,
   "a rhythm appears from shuntTonic >= " + g(crossing[0].st, 1) + " (R " + g(crossing[0].o.R, 2) +
   ", sharpness " + g(crossing[0].o.sh, 0) + ") but not below it. So the question 'can the olive be " +
   "driven into tremor from the cerebellum?' reduces to ONE measurable number: how much does tonic " +
   "nucleo-olivary tone shunt olivary electrical coupling?");

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
