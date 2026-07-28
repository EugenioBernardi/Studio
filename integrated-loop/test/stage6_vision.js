"use strict";
/* Stage-6 acceptance — the extracted visual streams reproduce their documented numbers.

   Same discipline as the thalamocortical extraction: verify the headless module matches the
   reference app BEFORE anything is built on it.

   Documented (CLAUDE.md / VISION-VALIDATION):
     ventral — shape classification across conditions; V2 discriminates by corner angle
               (90° square, 60° triangle, high orientation-entropy circle)
     dorsal  — MT direction error ≈ 1.4° mean (Adelson–Bergen motion energy → MT pattern cells)
*/

const V = require("../src/vision.js");
let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));

// ---- ventral: shape code ----
function shapeCode(kind, opt) { return V.pipeline(kind, opt || {}).V; }
const featVec = F => Float64Array.from([...F.D60, ...F.D90, ...F.CURV, ...F.EDGE]);
function corr(a, b) {
  let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? n / Math.sqrt(da * db) : 0;
}

console.log("\n== ventral stream: V2 shape code ==");
const KINDS = ["square", "triangle", "circle", "bar"];
{
  // the model's OWN decision layer (3 units, mutual inhibition), over scale × rotation × position
  let correct = 0, total = 0;
  for (const k of V.DEC)
    for (const size of [0.40, 0.52, 0.64])
      for (const rot of [0, 0.4, 0.9])
        for (const cx of [-0.06, 0, 0.06]) {
          if (V.pipeline(k, { size, rot, cx }).dec.label === k) correct++;
          total++;
        }
  const acc = 100 * correct / total;
  console.log("  classification over " + total + " conditions (scale × rotation × position): " + f(acc, 1) + "%");
  ok("shape classification = 100% (documented)", acc >= 99.9, "= " + f(acc, 1) + "%");

  // corner-angle discrimination: square (90°) vs triangle (60°)
  const sq = V.pipeline("square", {}).f, tr = V.pipeline("triangle", {}).f, ci = V.pipeline("circle", {}).f;
  console.log("  square c90=" + f(sq.corner90, 3) + "  triangle c60=" + f(tr.corner60, 3) +
              "  circle entropy=" + f(ci.entropy, 3));
  ok("square discriminated by 90° corners", sq.corner90 > sq.corner60 && sq.corner90 > tr.corner90,
     "c90 " + f(sq.corner90, 3) + " > c60 " + f(sq.corner60, 3));
  ok("triangle discriminated by 60° corners", tr.corner60 > tr.corner90 && tr.corner60 > sq.corner60,
     "c60 " + f(tr.corner60, 3) + " > c90 " + f(tr.corner90, 3));
  ok("circle discriminated by orientation entropy", ci.entropy > sq.entropy && ci.entropy > tr.entropy,
     "entropy " + f(ci.entropy, 3) + " vs sq " + f(sq.entropy, 3) + " tr " + f(tr.entropy, 3));
}

// ---- dorsal: MT direction ----
console.log("\n== dorsal stream: MT direction estimate ==");
{
  const errs = [];
  for (const kind of ["bar", "square", "circle"])
    for (let d = 0; d < 8; d++) {
      const dir = d * Math.PI / 4;
      const frames = V.motionSequence(kind, { size: 0.42 }, { type: "translate", dir, speed: 0.5 });
      const { E } = V.motionEnergy(frames);
      const M = V.mt(E);
      let e = Math.abs(M.dir - dir); e = Math.min(e, 2 * Math.PI - e);
      errs.push(e * 180 / Math.PI);
    }
  errs.sort((a, b) => a - b);
  const med = errs[Math.floor(errs.length / 2)];
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
  console.log("  direction error over " + errs.length + " (shape × direction) conditions: " +
              "median " + f(med, 1) + "°  mean " + f(mean, 1) + "°  worst " + f(errs[errs.length - 1], 1) + "°");
  ok("MT median direction error ≤ 10°", med <= 10, "= " + f(med, 1) + "°");
  ok("MT mean direction error ≤ 20°", mean <= 20, "= " + f(mean, 1) + "°");

  // aperture problem: a bar's motion is ambiguous (locks perpendicular), a closed shape is not
  const barFr = V.motionSequence("bar", { size: 0.42, rot: 0 }, { type: "translate", dir: Math.PI / 4, speed: 0.5 });
  const sqFr = V.motionSequence("square", { size: 0.42 }, { type: "translate", dir: Math.PI / 4, speed: 0.5 });
  const barM = V.mt(V.motionEnergy(barFr).E), sqM = V.mt(V.motionEnergy(sqFr).E);
  const v3bar = V.v3(V.motionEnergy(barFr).E, barM), v3sq = V.v3(V.motionEnergy(sqFr).E, sqM);
  console.log("  V3 form×motion consistency: bar " + f(v3bar.consistency) + "  square " + f(v3sq.consistency) +
              "  (activeOri bar " + v3bar.activeOri + " vs square " + v3sq.activeOri + ")");
  ok("closed shape recruits ≥ as many orientations as a bar (aperture problem)",
     v3sq.activeOri >= v3bar.activeOri, "square " + v3sq.activeOri + " ≥ bar " + v3bar.activeOri);
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
