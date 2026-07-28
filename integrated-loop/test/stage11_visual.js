"use strict";
/* Stage-11 — VISUAL PATHOLOGY, ILLUSIONS AND HALLUCINATION.
   Three classes of test, in increasing order of how hard they are to fake:

   A · FIELD DEFECTS (objective).  Retinotopic lesions produce perimetry maps. A hemianopia
       must respect the vertical meridian, a quadrantanopia a horizontal one, and macular
       sparing must leave the fovea intact — geometry the model either has or does not.

   B · ILLUSIONS (emergent).  These are not built in; they must fall out of mechanisms that
       are already there for other reasons:
         Mach bands      ← retinal difference-of-Gaussians (Ratliff & Hartline)
         tilt illusion   ← cross-orientation divisive normalisation in V1 (Blakemore 1970)
       If the model did not already have centre-surround and normalisation, neither would appear.

   C · HALLUCINATION (mechanistic).  Operationalised as a CONFIDENT PERCEPT WITH NO STIMULUS.
       Two distinct routes, matching two clinical accounts:
         C1 deafferentation + homeostatic gain → release phenomena  (Charles Bonnet; ffytche)
         C2 ungated top-down reinstatement     → memory intruding on perception
       C2 matters because we already MEASURED that reinstatement must be weak or it fabricates
       a full assembly — that finding is this mechanism, seen from the other side.            */

const V = require("../src/vision.js");
let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const N = V.N, out = {};

/* ---------------- retinotopic lesions ---------------- */
const FIELDS = {
  normal:          () => 1,
  hemianopia:      (x) => (x >= N / 2 ? 0 : 1),                       // right homonymous
  quadrantanopia:  (x, y) => (x >= N / 2 && y < N / 2 ? 0 : 1),       // superior right
  macularSparing:  (x, y) => (x >= N / 2 && Math.hypot(x - N / 2, y - N / 2) > N * 0.16 ? 0 : 1),
  scotoma:         (x, y) => (Math.hypot(x - N * 0.68, y - N * 0.38) < N * 0.13 ? 0 : 1),
};
const applyField = (img, fn) => { const o = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) o[y * N + x] = img[y * N + x] * fn(x, y);
  return o; };

/* ---------------- A · perimetry ---------------- */
console.log("\n== A · perimetry: retinotopic lesions produce field maps ==");
{
  const G = 12;                                    // perimetry grid
  function perimetry(fn) {
    const map = [];
    for (let gy = 0; gy < G; gy++) { const row = [];
      for (let gx = 0; gx < G; gx++) {
        // a small bright probe at this field location
        const img = new Float64Array(N * N);
        const cx = (gx + 0.5) * N / G, cy = (gy + 0.5) * N / G, r = N * 0.045;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
          if (Math.hypot(x - cx, y - cy) <= r) img[y * N + x] = 1;
        const L = V.lgn(V.retina(applyField(img, fn)));
        let e = 0; for (let i = 0; i < N * N; i++) e += Math.abs(L.signed[i]);
        row.push(e);
      }
      map.push(row);
    }
    return map;
  }
  const base = perimetry(FIELDS.normal);
  const baseMax = Math.max(...base.flat());
  const sens = m => m.map(r => r.map(v => v / baseMax));      // normalised sensitivity
  const maps = {}; for (const k in FIELDS) maps[k] = sens(perimetry(FIELDS[k]));
  out.perimetry = { G, maps };

  const half = (m, pred) => { let s = 0, n = 0;
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++)
      if (pred(gx, gy)) { s += m[gy][gx]; n++; } return s / n; };
  const H = maps.hemianopia, Q = maps.quadrantanopia, M = maps.macularSparing, S = maps.scotoma;
  const leftH = half(H, gx => gx < G / 2), rightH = half(H, gx => gx >= G / 2);
  console.log("  hemianopia      left field " + f(leftH) + "  ·  right field " + f(rightH));
  ok("hemianopia respects the vertical meridian", rightH < 0.15 && leftH > 0.7,
     "right " + f(rightH) + " vs left " + f(leftH));

  const upperR = half(Q, (gx, gy) => gx >= G / 2 && gy < G / 2);
  const lowerR = half(Q, (gx, gy) => gx >= G / 2 && gy >= G / 2);
  console.log("  quadrantanopia  upper-right " + f(upperR) + "  ·  lower-right " + f(lowerR));
  ok("quadrantanopia respects the horizontal meridian too", upperR < 0.15 && lowerR > 0.7,
     "upper " + f(upperR) + " vs lower " + f(lowerR));

  const fovea = half(M, (gx, gy) => Math.hypot(gx - G / 2, gy - G / 2) < G * 0.18);
  const periphR = half(M, (gx, gy) => gx >= G / 2 && Math.hypot(gx - G / 2, gy - G / 2) > G * 0.3);
  console.log("  macular sparing fovea " + f(fovea) + "  ·  blind periphery " + f(periphR));
  ok("macular sparing preserves the fovea inside a hemianopia", fovea > 0.6 && periphR < 0.2,
     "fovea " + f(fovea) + " vs periphery " + f(periphR));

  const inScot = half(S, (gx, gy) => Math.hypot(gx - G * 0.68, gy - G * 0.38) < G * 0.11);
  const outScot = half(S, (gx, gy) => Math.hypot(gx - G * 0.68, gy - G * 0.38) > G * 0.3);
  console.log("  scotoma         inside " + f(inScot) + "  ·  outside " + f(outScot));
  ok("a focal scotoma is focal", inScot < 0.3 && outScot > 0.7, "in " + f(inScot) + " out " + f(outScot));
}

/* ---------------- A2 · hemianopia costs form, motion channel is separate ------------- */
console.log("\n== A2 · a lesion that spares the motion channel ==");
{
  // ventral identification with the object in the blind vs seeing field
  function idIn(fn, cx) {
    let okN = 0, tot = 0;
    for (const k of V.DEC) {
      const img = applyField(V.drawShape(k, { size: 0.34, cx }), fn);
      const C = V.v1complex(V.v1simple(V.lgn(V.retina(img))), { pw: 2 });
      const F = V.v2(C), st = V.oriStats(C);
      if (V.classify({ ...V.features(F), entropy: st.entropy, peaks: st.peaks }).label === k) okN++;
      tot++;
    }
    return okN / tot;
  }
  const seeing = idIn(FIELDS.hemianopia, -0.22), blind = idIn(FIELDS.hemianopia, 0.22);
  console.log("  shape identification: seeing field " + f(seeing * 100, 0) + "%  ·  blind field " + f(blind * 100, 0) + "%");
  ok("form vision is lost in the blind hemifield", blind < seeing, f(blind * 100, 0) + "% vs " + f(seeing * 100, 0) + "%");
  out.hemianopiaForm = { seeing, blind };
}

/* ---------------- B1 · Mach bands ---------------- */
console.log("\n== B1 · Mach bands (emergent from retinal centre-surround) ==");
{
  // luminance ramp: flat — linear ramp — flat
  const img = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v;
    if (x < N * 0.35) v = 0.2; else if (x > N * 0.65) v = 0.8;
    else v = 0.2 + 0.6 * (x - N * 0.35) / (N * 0.30);
    img[y * N + x] = v;
  }
  const R = V.retina(img);
  const prof = [], lum = [];
  const yMid = Math.floor(N / 2);
  for (let x = 0; x < N; x++) { let s = 0;
    for (let dy = -3; dy <= 3; dy++) s += R.signed[(yMid + dy) * N + x];
    prof.push(s / 7); lum.push(img[yMid * N + x]); }
  // the ramp is LINEAR, so any structure in the response is the model's own doing
  const kneeLo = Math.round(N * 0.35), kneeHi = Math.round(N * 0.65);
  const darkBand = Math.min(...prof.slice(kneeLo - 4, kneeLo + 3));
  const brightBand = Math.max(...prof.slice(kneeHi - 3, kneeHi + 4));
  const rampMid = prof[Math.round(N * 0.5)];
  console.log("  response at the dark knee " + f(darkBand, 3) + "  ·  mid-ramp " + f(rampMid, 3) +
              "  ·  bright knee " + f(brightBand, 3));
  ok("dark Mach band at the foot of the ramp", darkBand < rampMid - 0.01, f(darkBand, 3) + " < " + f(rampMid, 3));
  ok("bright Mach band at the top of the ramp", brightBand > rampMid + 0.01, f(brightBand, 3) + " > " + f(rampMid, 3));
  out.mach = { prof, lum };
}

/* ---------------- B2 · tilt illusion ---------------- */
console.log("\n== B2 · tilt illusion (emergent from cross-orientation normalisation) ==");
{
  function grating(theta, period, mask) {
    const img = new Float64Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const X = (x - N / 2) * Math.cos(theta) + (y - N / 2) * Math.sin(theta);
      const v = 0.5 + 0.5 * Math.sin(2 * Math.PI * X / period);
      img[y * N + x] = mask(x, y) ? v : 0.5;
    }
    return img;
  }
  const rIn = N * 0.17;
  const inner = (x, y) => Math.hypot(x - N / 2, y - N / 2) <= rIn;
  const outer = (x, y) => Math.hypot(x - N / 2, y - N / 2) > rIn;
  // read the V1 population orientation over the CENTRE only
  function centreOri(img) {
    const C = V.v1complex(V.v1simple(V.lgn(V.retina(img))), { pw: 2 });
    let sx = 0, sy = 0;
    const NC = V.NC, rC = NC * 0.17;
    for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) {
      if (Math.hypot(cx - NC / 2, cy - NC / 2) > rC) continue;
      for (let o = 0; o < V.NORI; o++) {
        const th = 2 * V.ORI[o], w = C[o][cy * NC + cx];
        sx += w * Math.cos(th); sy += w * Math.sin(th);
      }
    }
    return 0.5 * Math.atan2(sy, sx);                 // orientation in [-90°,90°]
  }
  const deg = r => r * 180 / Math.PI;
  const centreAlone = centreOri(grating(0, 6, inner));
  const shifts = [];
  for (const sur of [15, 30, 45, 60, 75]) {
    const s = sur * Math.PI / 180;
    const img = new Float64Array(N * N);
    const a = grating(0, 6, inner), b = grating(s, 6, outer);
    for (let i = 0; i < N * N; i++) img[i] = inner(i % N, Math.floor(i / N)) ? a[i] : b[i];
    let d = deg(centreOri(img) - centreAlone);
    while (d > 90) d -= 180; while (d < -90) d += 180;
    shifts.push({ sur, shift: d });
  }
  console.log("  surround tilt →  " + shifts.map(s => s.sur + "°").join("   "));
  console.log("  centre appears →" + shifts.map(s => f(s.shift, 1).padStart(7) + "°").join(""));
  const small = shifts.filter(s => s.sur <= 30);
  const repulsion = small.every(s => s.shift < 0.5);      // shifted AWAY from the surround
  // NOT REPRODUCED, and the cause is identified rather than guessed. Two measurements:
  //   · with the shipped filters the centre shifts TOWARD the surround (+12° for a 15° surround)
  //     — a 53×53 kernel on a 40×40 retina means one receptive field covers the whole image,
  //     so the "centre" readout is literally integrating the surround;
  //   · with fine filters and a large centre the shift is exactly 0.0° at every surround angle.
  // Zero interaction at any scale is the diagnosis: v1complex normalises across ORIENTATIONS at
  // each location but has no SPATIAL SURROUND normalisation, and the tilt illusion is a
  // surround-suppression effect (Cavanaugh, Bair & Movshon 2002). The mechanism is absent, not
  // mistuned. Left failing rather than relaxed — adding surround normalisation is the fix.
  ok("tilt illusion — surround repulsion [KNOWN MISSING MECHANISM]", repulsion,
     small.map(s => s.sur + "°→" + f(s.shift, 1) + "°").join(", ") + "  (assimilation, not repulsion)");
  out.tilt = shifts;
}

/* ---------------- C1 · Charles Bonnet: deafferentation + homeostatic gain ------------- */
console.log("\n== C1 · release hallucination after deafferentation ==");
{
  // no stimulus at all — only noise. Does the decision layer report a confident percept?
  function noiseTrial(gain, seed) {
    let r = seed;
    const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    const img = new Float64Array(N * N);
    for (let i = 0; i < N * N; i++) img[i] = 0.5 + 0.02 * (rnd() - 0.5);   // essentially blank
    const L = V.lgn(V.retina(img));
    for (let i = 0; i < N * N; i++) L.signed[i] *= gain;                   // homeostatic up-regulation
    const C = V.v1complex(V.v1simple(L), { pw: 2 });
    const F = V.v2(C), st = V.oriStats(C);
    const d = V.classify({ ...V.features(F), entropy: st.entropy, peaks: st.peaks });
    return d.margin;                                    // confidence of the winning percept
  }
  const GAINS = [1, 10, 40, 120];
  const conf = GAINS.map(g => { let s = 0;
    for (let t = 0; t < 12; t++) s += noiseTrial(g, 1234 + t * 7919); return s / 12; });
  console.log("  cortical gain:        " + GAINS.map(g => ("×" + g).padStart(6)).join(""));
  console.log("  percept confidence:   " + conf.map(c => f(c, 3).padStart(6)).join(""));
  ok("a blank field yields no percept at normal gain", conf[0] < 0.02, "= " + f(conf[0], 3));
  ok("deafferentation gain produces a confident percept from noise", conf[3] > conf[0] + 0.05,
     f(conf[0], 3) + " → " + f(conf[3], 3));
  out.bonnet = { gains: GAINS, conf };
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "visual_path.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
