"use strict";
/* Headless probe for the shared depletable spindle generator. Numbers before rendering, numbers
   before test rows. Two questions, both of which decide whether the correction is worth keeping:

   Q1  what spindleP holds healthy density at ~5/min once the generator can be depleted?
   Q2  is Bender's null (no density/rate association) GENERIC across resTau x pInduce, or does it
       only appear on a knife-edge? If knife-edge, the correction explains nothing and I say so.  */

const S = require("../src/spindlecorrupt.js");
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

const M = S.buildSubject(1, Array.from({ length: 16 }, (_, i) => i));

function night(o) { S.resetCortical(M); M._hc = new Map(); return S.runNight(M, o); }

console.log("\nQ1  healthy density vs spindleP (no discharges, generator depletable)");
console.log("    spindleP   density/min   mean gap(s)");
for (const sp of [0.10, 0.12, 0.13, 0.14, 0.15, 0.16, 0.18]) {
  const n = night({ spindleP: sp });
  console.log("    " + f(sp).padStart(8) + f(n.spindleDensity, 2).padStart(14) +
              f(60 / n.spindleDensity, 1).padStart(13));
}

console.log("\nQ2  does density track IED rate?  rho-like slope = (density at 80/min) / (density at 5/min)");
console.log("    resTau  pInduce |  d(5)  d(20)  d(40)  d(80) |  ratio 80/5   delivering 80/5");
const RATES = [5, 20, 40, 80];
for (const resTau of [4, 8, 12, 20]) {
  for (const pInduce of [0.02, 0.05, 0.10, 0.20]) {
    const ds = [], dl = [];
    for (const r of RATES) {
      const n = night({ spindleP: 0.14, resTau, pInduce, iedRate: r });
      ds.push(n.spindleDensity); dl.push(n.coupledRate);
    }
    console.log("    " + String(resTau).padStart(6) + f(pInduce).padStart(9) + " |" +
                ds.map(d => f(d, 2).padStart(7)).join("") + " |" +
                f(ds[3] / ds[0]).padStart(13) + f(dl[3] / dl[0]).padStart(18));
  }
}

console.log("\nQ3  with the generator shared, what does a TLE profile look like?");
console.log("    (spindleLoss fitted to Bender's 0.70 density ratio; delivering ratio read off)");
const H = night({ spindleP: 0.14 });
for (const sl of [0.20, 0.30, 0.40, 0.50, 0.60]) {
  const n = night({ spindleP: 0.14, spindleLoss: sl, iedRate: 30, couplingLoss: 0.22 });
  console.log("    spindleLoss " + f(sl) + "   density ratio " + f(n.spindleDensity / H.spindleDensity) +
              "   delivering ratio " + f(n.coupledRate / H.coupledRate) +
              "   coincidence " + f(n.coincidenceFraction));
}
console.log("");
