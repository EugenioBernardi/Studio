"use strict";
/* Challenge the visual front-end with MNIST.

   The question is NOT "can we beat a CNN" — we cannot and that is not the claim. The question
   is WHICH STAGE of the biologically-motivated front-end carries the most usable code for a
   hard, naturalistic item set, and whether the V2 stage (built for closed geometric shapes)
   is throwing information away.

   Same readout for every representation, so the comparison isolates the REPRESENTATION and
   not the classifier: L2-normalised features, nearest-class-centroid and k-NN (cosine).

   Predictions registered before running (see the session log):
     1. raw pixels are a strong baseline
     2. V2 (400-d corner/curvature summary) is WORSE than raw pixels — over-specialised
     3. V1 complex (oriented energy) beats V2 and rivals raw pixels
*/
const fs = require("fs"), path = require("path");
const V = require("../src/vision.js");

const DATA = path.join(__dirname, "..", "data");
function readImages(f, n) {
  const b = fs.readFileSync(path.join(DATA, f));
  const count = b.readUInt32BE(4), rows = b.readUInt32BE(8), cols = b.readUInt32BE(12);
  n = Math.min(n, count);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = new Float64Array(rows * cols);
    for (let j = 0; j < rows * cols; j++) a[j] = b[16 + i * rows * cols + j] / 255;
    out.push({ a, rows, cols });
  }
  return out;
}
function readLabels(f, n) {
  const b = fs.readFileSync(path.join(DATA, f));
  const count = b.readUInt32BE(4); n = Math.min(n, count);
  return Array.from({ length: n }, (_, i) => b[8 + i]);
}

// 28×28 → the model's N×N retina, centred, with a small border (bilinear)
function toRetina(im) {
  const N = V.N, out = new Float64Array(N * N);
  const pad = 0.12, s = (1 - 2 * pad);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = ((x + 0.5) / N - pad) / s * im.cols - 0.5;
    const v = ((y + 0.5) / N - pad) / s * im.rows - 0.5;
    if (u < 0 || v < 0 || u > im.cols - 1 || v > im.rows - 1) continue;
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const x1 = Math.min(im.cols - 1, x0 + 1), y1 = Math.min(im.rows - 1, y0 + 1);
    out[y * N + x] =
      im.a[y0 * im.cols + x0] * (1 - fx) * (1 - fy) + im.a[y0 * im.cols + x1] * fx * (1 - fy) +
      im.a[y1 * im.cols + x0] * (1 - fx) * fy + im.a[y1 * im.cols + x1] * fx * fy;
  }
  return out;
}

function featurise(img) {
  const L = V.lgn(V.retina(img));
  const S = V.v1simple(L);
  const C = V.v1complex(S, { pw: 2 });
  const F = V.v2(C);
  const v1 = new Float64Array(V.NORI * V.NC * V.NC);
  for (let o = 0; o < V.NORI; o++) v1.set(C[o], o * V.NC * V.NC);
  return {
    raw: img,
    v1,
    v2: Float64Array.from([...F.D60, ...F.D90, ...F.CURV, ...F.EDGE]),
  };
}

const l2 = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1;
  const o = new Float64Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const NTRAIN = +(process.env.NTRAIN || 800), NTEST = +(process.env.NTEST || 400);
const trIm = readImages("train-images-idx3-ubyte", NTRAIN), trLb = readLabels("train-labels-idx1-ubyte", NTRAIN);
const teIm = readImages("t10k-images-idx3-ubyte", NTEST), teLb = readLabels("t10k-labels-idx1-ubyte", NTEST);
console.log(`MNIST: ${trIm.length} train / ${teIm.length} test, retina ${V.N}×${V.N}`);
console.log(`dims: raw ${V.N * V.N}  V1complex ${V.NORI * V.NC * V.NC}  V2 ${4 * V.V2N * V.V2N}`);

const t0 = Date.now();
const feat = ims => ims.map((im, i) => {
  if (i && i % 200 === 0) console.log(`  ...${i}/${ims.length}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return featurise(toRetina(im));
});
console.log("featurising train..."); const TR = feat(trIm);
console.log("featurising test...");  const TE = feat(teIm);

const SPACES = ["raw", "v1", "v2"];
const results = {};
for (const sp of SPACES) {
  const X = TR.map(f => l2(f[sp])), Y = TE.map(f => l2(f[sp]));
  // nearest class centroid
  const dim = X[0].length, cent = Array.from({ length: 10 }, () => new Float64Array(dim)), cnt = new Array(10).fill(0);
  X.forEach((v, i) => { const c = cent[trLb[i]]; for (let d = 0; d < dim; d++) c[d] += v[d]; cnt[trLb[i]]++; });
  const C10 = cent.map(c => l2(c));
  let okC = 0;
  Y.forEach((v, i) => { let b = -1, bs = -Infinity;
    for (let c = 0; c < 10; c++) { const s = dot(v, C10[c]); if (s > bs) { bs = s; b = c; } }
    if (b === teLb[i]) okC++; });
  // k-NN (k = 3, cosine)
  let okK = 0;
  Y.forEach((v, i) => {
    const best = [];
    X.forEach((u, j) => { const s = dot(v, u);
      if (best.length < 3) { best.push([s, trLb[j]]); best.sort((a, b) => a[0] - b[0]); }
      else if (s > best[0][0]) { best[0] = [s, trLb[j]]; best.sort((a, b) => a[0] - b[0]); } });
    const votes = {}; best.forEach(([s, l]) => votes[l] = (votes[l] || 0) + s);
    let b = -1, bs = -Infinity;
    for (const k in votes) if (votes[k] > bs) { bs = votes[k]; b = +k; }
    if (b === teLb[i]) okK++;
  });
  results[sp] = { centroid: +(100 * okC / Y.length).toFixed(1), knn: +(100 * okK / Y.length).toFixed(1), dim };
  console.log(`  ${sp.padEnd(4)} dim ${String(dim).padStart(5)}  centroid ${results[sp].centroid.toFixed(1)}%  kNN ${results[sp].knn.toFixed(1)}%`);
}

fs.mkdirSync(path.join(__dirname, "..", "figures"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "figures", "mnist.json"),
  JSON.stringify({ results, nTrain: trIm.length, nTest: teIm.length,
    N: V.N, NORI: V.NORI, NC: V.NC, V2N: V.V2N }));
console.log("\nwrote figures/mnist.json");
