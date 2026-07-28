"use strict";
/* Stage-9 — the egocentric/allocentric transform, and the three ways it fails.

   S1  the transform is correct        : a landmark at allocentric bearing θ, with the head at φ,
                                         must appear at egocentric bearing θ − φ
   S2  it is invertible                : reading the same gain-field units backwards recovers the
                                         allocentric scene from the egocentric view
   S3  RSC lesion                      : TRANSFORM lost while BOTH frames remain intact —
                                         topographical disorientation, and the computational
                                         signature depersonalisation theories implicate
   S4  ATN lesion                      : head direction lost, so the transform has nothing to
                                         rotate by — heading disorientation / diencephalic damage
   S5  PPC lesion                      : the egocentric rendering is lost, allocentric store intact

   The point of S3–S5 is that they are DIFFERENT failures of the same circuit: the frames, the
   rotation signal and the transform machinery can each be removed independently.               */

const S = require("../src/spatial.js");
let pass = 0, fail = 0;
const f = (x, d = 1) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const TAU = S.TAU;

/* one landmark, so the decoded bearing is unambiguous */
const oneLandmark = th => [{ bearing: th, w: 1 }];

console.log("\n== S1 · the transform is correct (ego = allo − head) ==");
{
  const errs = [];
  for (const allo of [0, 1, 2, 3, 4, 5].map(i => i * TAU / 6))
    for (const head of [0, 1, 2, 3].map(i => i * TAU / 4)) {
      const sp = S.createSpatial({});
      S.setHeading(sp, head);
      S.setAllocentric(sp, oneLandmark(allo));
      S.alloToEgo(sp);
      const got = S.readEgo(sp).ang, want = (allo - head + TAU) % TAU;
      errs.push(S.angErr(got, want));
    }
  const m = mean(errs), worst = Math.max(...errs);
  console.log("  egocentric bearing error over " + errs.length + " (allocentric × heading) conditions: mean " +
              f(m) + "°, worst " + f(worst) + "°");
  ok("transform accurate (mean error ≤ 10°)", m <= 10, "= " + f(m) + "°");
  ok("no condition fails badly (worst ≤ 25°)", worst <= 25, "= " + f(worst) + "°");
}

console.log("\n== S2 · the transform is invertible (ego → allo recovers the scene) ==");
{
  const errs = [];
  for (const allo of [0, 1, 2, 3, 4, 5].map(i => i * TAU / 6))
    for (const head of [0, 2, 4].map(i => i * TAU / 6)) {
      const sp = S.createSpatial({});
      S.setHeading(sp, head); S.setAllocentric(sp, oneLandmark(allo));
      S.alloToEgo(sp);
      const back = S.decodeAngle(S.egoToAllo(sp)).ang;
      errs.push(S.angErr(back, allo));
    }
  const m = mean(errs);
  console.log("  recovered allocentric bearing error: mean " + f(m) + "°");
  ok("inverse transform accurate (mean ≤ 10°)", m <= 10, "= " + f(m) + "°");
}

console.log("\n== S3 · retrosplenial lesion: the frames survive, the transform does not ==");
{
  const FR = [0, 0.4, 0.7, 0.95];
  const egoErr = [], egoCoh = [], alloCoh = [];
  for (const fr of FR) {
    const e = [], c = [], ac = [];
    for (const allo of [0, 2, 4].map(i => i * TAU / 6)) for (const head of [0, 3].map(i => i * TAU / 6)) {
      const sp = S.createSpatial({});
      if (fr > 0) S.lesionRSC(sp, fr, 99);
      S.setHeading(sp, head); S.setAllocentric(sp, oneLandmark(allo));
      S.alloToEgo(sp);
      const want = (allo - head + TAU) % TAU, r = S.readEgo(sp);
      e.push(S.angErr(r.ang, want)); c.push(r.coh); ac.push(S.readAllo(sp).coh);
    }
    egoErr.push(mean(e)); egoCoh.push(mean(c)); alloCoh.push(mean(ac));
  }
  console.log("  RSC lost:              " + FR.map(x => f(x * 100, 0) + "%").join("    "));
  console.log("  egocentric error (°):  " + egoErr.map(v => f(v)).join("   "));
  console.log("  egocentric coherence:  " + egoCoh.map(v => f(v, 2)).join("  "));
  console.log("  allocentric coherence: " + alloCoh.map(v => f(v, 2)).join("  "));
  // the transform is graded and REDUNDANT: the gain field tolerates heavy unit loss and then
  // fails, so the diagnostic is bearing ERROR, not the sharpness of the surviving bump
  ok("RSC loss corrupts the transformed bearing", egoErr[3] > egoErr[0] + 25,
     f(egoErr[0]) + "° → " + f(egoErr[3]) + "° at 95% loss");
  ok("the ALLOCENTRIC store is untouched by RSC loss", Math.abs(alloCoh[3] - alloCoh[0]) < 0.05,
     f(alloCoh[0], 2) + " → " + f(alloCoh[3], 2));
  ok("dissociation: transform lost while both frames survive",
     egoErr[3] > egoErr[0] + 25 && alloCoh[3] > 0.9 * alloCoh[0] && egoCoh[3] > 0.3,
     "ego still active (coh " + f(egoCoh[3], 2) + ") but mis-registered");
}

console.log("\n== S4 · anterior-thalamic lesion: nothing to rotate by ==");
{
  const FR = [0, 0.5, 1.0];
  const hdCoh = [], egoErr = [], alloCoh = [];
  for (const fr of FR) {
    const h = [], e = [], a = [];
    for (const allo of [0, 2, 4].map(i => i * TAU / 6)) for (const head of [TAU / 4, TAU / 2]) {
      const sp = S.createSpatial({});
      if (fr > 0) S.lesionATN(sp, fr);
      S.setHeading(sp, head); S.setAllocentric(sp, oneLandmark(allo));
      S.alloToEgo(sp);
      h.push(S.decodeAngle(sp.atn).coh);
      e.push(S.angErr(S.readEgo(sp).ang, (allo - head + TAU) % TAU));
      a.push(S.readAllo(sp).coh);
    }
    hdCoh.push(mean(h)); egoErr.push(mean(e)); alloCoh.push(mean(a));
  }
  console.log("  ATN lost:              " + FR.map(x => f(x * 100, 0) + "%").join("     "));
  console.log("  head-direction signal: " + hdCoh.map(v => f(v, 2)).join("  "));
  console.log("  egocentric error (°):  " + egoErr.map(v => f(v)).join("  "));
  console.log("  allocentric coherence: " + alloCoh.map(v => f(v, 2)).join("  "));
  ok("ATN loss abolishes the head-direction signal", hdCoh[2] < 0.15,
     "coherence " + f(hdCoh[0], 2) + " → " + f(hdCoh[2], 2));
  ok("without heading the egocentric bearing is wrong", egoErr[2] > 20, "= " + f(egoErr[2]) + "°");
  ok("allocentric store still intact (a DIFFERENT failure from RSC loss)",
     alloCoh[2] > 0.9 * alloCoh[0], f(alloCoh[0], 2) + " → " + f(alloCoh[2], 2));
}

console.log("\n== S5 · parietal lesion: the body-centred rendering is lost ==");
{
  const sp0 = S.createSpatial({}), sp1 = S.createSpatial({});
  S.lesionPPC(sp1, 1.0);
  let base = 0, les = 0, alloOK = 0;
  for (const allo of [0, 2, 4].map(i => i * TAU / 6)) {
    for (const [sp, acc] of [[sp0, "b"], [sp1, "l"]]) {
      S.setHeading(sp, TAU / 4); S.setAllocentric(sp, oneLandmark(allo)); S.alloToEgo(sp);
      const e = sp.ppc.reduce((a, b) => a + b, 0);
      if (acc === "b") base += e; else { les += e; alloOK += S.readAllo(sp).coh; }
    }
  }
  console.log("  egocentric map total activity: intact " + f(base, 2) + "  ·  PPC lesioned " + f(les, 2));
  ok("PPC lesion abolishes the egocentric map", les < 0.05 * base, f(les, 3) + " vs " + f(base, 2));
  ok("allocentric store survives the parietal lesion", alloOK / 3 > 0.5, "coherence " + f(alloOK / 3, 2));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
