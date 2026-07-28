"use strict";
/* Stage-7 — does the HMAX multi-scale front-end pass BOTH benchmarks with ONE filter bank?

   The single-scale bank provably cannot: shape 100% / MNIST 71%, or shape 67% / MNIST 90.5%
   depending on which way it is tuned. The test is whether multi-scale + max pooling removes
   that trade-off.

   Both front-ends are scored with the SAME generic readout (nearest class centroid on the
   feature vector, cosine) so the comparison cannot be an artefact of hand-tuned decision
   thresholds. The model's own decision layer is reported alongside, for the shape task only.
*/
const fs = require("fs"), path = require("path");
const V = require("../src/vision.js");
const HM = require("../src/hmax.js");

let pass = 0, fail = 0;
const f = (x, d = 1) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));

const l2 = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1;
  const o = new Float64Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

function centroidAcc(X, xl, Y, yl, nClass) {
  const dim = X[0].length, cent = Array.from({ length: nClass }, () => new Float64Array(dim));
  X.forEach((v, i) => { const c = cent[xl[i]]; for (let d = 0; d < dim; d++) c[d] += v[d]; });
  const C = cent.map(l2);
  let ok = 0;
  Y.forEach((v, i) => { let b = -1, bs = -Infinity;
    for (let c = 0; c < nClass; c++) { const s = dot(v, C[c]); if (s > bs) { bs = s; b = c; } }
    if (b === yl[i]) ok++; });
  return 100 * ok / Y.length;
}

/* ---------------- shape task ---------------- */
const KINDS = V.DEC;                      // square, triangle, circle
const CONDS = [];
for (let k = 0; k < KINDS.length; k++)
  for (const size of [0.40, 0.52, 0.64]) for (const rot of [0, 0.4, 0.9]) for (const cx of [-0.06, 0, 0.06])
    CONDS.push({ k, kind: KINDS[k], size, rot, cx });

function shapeScores(mode) {
  const vecs = [], labs = [];
  let decOK = 0;
  for (const c of CONDS) {
    let V2, dec;
    if (mode === "hmax") { const r = HM.pipeline(c.kind, c); V2 = r.V; dec = r.dec.label; }
    else { const r = V.pipeline(c.kind, c); V2 = r.V; dec = r.dec.label; }
    vecs.push(l2(Float64Array.from([...V2.D60, ...V2.D90, ...V2.CURV, ...V2.EDGE])));
    labs.push(c.k);
    if (dec === c.kind) decOK++;
  }
  // leave-one-out nearest-centroid (generic readout, identical for both front-ends)
  let genOK = 0;
  for (let i = 0; i < vecs.length; i++) {
    const X = vecs.filter((_, j) => j !== i), xl = labs.filter((_, j) => j !== i);
    genOK += centroidAcc(X, xl, [vecs[i]], [labs[i]], KINDS.length) > 50 ? 1 : 0;
  }
  return { decision: 100 * decOK / CONDS.length, generic: 100 * genOK / vecs.length };
}

/* ---------------- MNIST ---------------- */
const DATA = path.join(__dirname, "..", "data");
const haveMNIST = fs.existsSync(path.join(DATA, "t10k-images-idx3-ubyte"));
function readImages(fn, n) { const b = fs.readFileSync(path.join(DATA, fn));
  const c = b.readUInt32BE(4), r = b.readUInt32BE(8), co = b.readUInt32BE(12); n = Math.min(n, c);
  const o = []; for (let i = 0; i < n; i++) { const a = new Float64Array(r * co);
    for (let j = 0; j < r * co; j++) a[j] = b[16 + i * r * co + j] / 255; o.push({ a, rows: r, cols: co }); } return o; }
const readLabels = (fn, n) => { const b = fs.readFileSync(path.join(DATA, fn));
  n = Math.min(n, b.readUInt32BE(4)); return Array.from({ length: n }, (_, i) => b[8 + i]); };
function toRetina(im) { const N = V.N, out = new Float64Array(N * N), pad = 0.12, s = 1 - 2 * pad;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = ((x + 0.5) / N - pad) / s * im.cols - 0.5, v = ((y + 0.5) / N - pad) / s * im.rows - 0.5;
    if (u < 0 || v < 0 || u > im.cols - 1 || v > im.rows - 1) continue;
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const x1 = Math.min(im.cols - 1, x0 + 1), y1 = Math.min(im.rows - 1, y0 + 1);
    out[y * N + x] = im.a[y0 * im.cols + x0] * (1 - fx) * (1 - fy) + im.a[y0 * im.cols + x1] * fx * (1 - fy)
                   + im.a[y1 * im.cols + x0] * (1 - fx) * fy + im.a[y1 * im.cols + x1] * fx * fy; }
  return out; }
function knn(X, xl, Y, yl, k) { let ok = 0;
  Y.forEach((v, i) => { const best = [];
    X.forEach((u, j) => { const s = dot(v, u);
      if (best.length < k) { best.push([s, xl[j]]); best.sort((a, b) => a[0] - b[0]); }
      else if (s > best[0][0]) { best[0] = [s, xl[j]]; best.sort((a, b) => a[0] - b[0]); } });
    const vt = {}; best.forEach(([s, l]) => vt[l] = (vt[l] || 0) + s);
    let b = -1, bs = -Infinity; for (const q in vt) if (vt[q] > bs) { bs = vt[q]; b = +q; }
    if (b === yl[i]) ok++; });
  return 100 * ok / Y.length; }

console.log("\n== shape task: one filter bank, two front-ends ==");
const shOld = shapeScores("old"), shNew = shapeScores("hmax");
console.log(`  single-scale (as shipped)  decision ${f(shOld.decision)}%   generic readout ${f(shOld.generic)}%`);
console.log(`  HMAX multi-scale           decision ${f(shNew.decision)}%   generic readout ${f(shNew.generic)}%`);

const out = { shape: { old: shOld, hmax: shNew } };

if (haveMNIST) {
  const NT = +(process.env.NTRAIN || 400), NE = +(process.env.NTEST || 200);
  const tr = readImages("train-images-idx3-ubyte", NT).map(toRetina), trL = readLabels("train-labels-idx1-ubyte", NT);
  const te = readImages("t10k-images-idx3-ubyte", NE).map(toRetina), teL = readLabels("t10k-labels-idx1-ubyte", NE);
  console.log(`\n== MNIST (${NT} train / ${NE} test) ==`);
  const raw = knn(tr.map(l2), trL, te.map(l2), teL, 3);
  const t0 = Date.now();
  const hm = knn(tr.map(im => l2(HM.featureVector(im))), trL, te.map(im => l2(HM.featureVector(im))), teL, 3);
  console.log(`  raw pixels        kNN ${f(raw)}%   <- baseline`);
  console.log(`  HMAX C1           kNN ${f(hm)}%   (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  out.mnist = { raw: +raw.toFixed(1), hmax: +hm.toFixed(1), nTrain: NT, nTest: NE };

  console.log("\n== the trade-off the single-scale bank could not escape ==");
  ok("HMAX keeps the shape task (generic readout ≥ 95%)", shNew.generic >= 95, "= " + f(shNew.generic) + "%");
  ok("HMAX beats raw pixels on MNIST", hm > raw, "= " + f(hm) + "% vs " + f(raw) + "%");
  ok("HMAX beats the shipped single-scale bank on MNIST (71.0%)", hm > 71.0, "= " + f(hm) + "%");
  ok("ONE bank does both (shape ≥ 95% AND MNIST > raw)", shNew.generic >= 95 && hm > raw, "");
} else {
  console.log("\n  (MNIST not present in data/ — shape task only)");
}

fs.mkdirSync(path.join(__dirname, "..", "figures"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "figures", "hmax.json"), JSON.stringify(out));
console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
process.exit(fail ? 1 : 0);
