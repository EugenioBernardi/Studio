"use strict";
/* Can the front-end be made better? Test the diagnosis that it is over-tuned to the 3-shape
   task: single scale, very elongated (gamma 0.30), long wavelength, strong cross-orientation
   divisive normalisation. Digits are fine, curved, short strokes.

   Each config is evaluated with the SAME readout (L2 + cosine k-NN) so the comparison
   isolates the front-end. Raw pixels are the honest baseline to beat. */
const fs = require("fs"), path = require("path");
const V = require("../src/vision.js");
const DATA = path.join(__dirname, "..", "data");

function readImages(f, n) {
  const b = fs.readFileSync(path.join(DATA, f));
  const count = b.readUInt32BE(4), rows = b.readUInt32BE(8), cols = b.readUInt32BE(12);
  n = Math.min(n, count); const out = [];
  for (let i = 0; i < n; i++) { const a = new Float64Array(rows * cols);
    for (let j = 0; j < rows * cols; j++) a[j] = b[16 + i * rows * cols + j] / 255;
    out.push({ a, rows, cols }); }
  return out;
}
const readLabels = (f, n) => { const b = fs.readFileSync(path.join(DATA, f));
  n = Math.min(n, b.readUInt32BE(4)); return Array.from({ length: n }, (_, i) => b[8 + i]); };

function toRetina(im) {
  const N = V.N, out = new Float64Array(N * N), pad = 0.12, s = 1 - 2 * pad;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = ((x + 0.5) / N - pad) / s * im.cols - 0.5, v = ((y + 0.5) / N - pad) / s * im.rows - 0.5;
    if (u < 0 || v < 0 || u > im.cols - 1 || v > im.rows - 1) continue;
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const x1 = Math.min(im.cols - 1, x0 + 1), y1 = Math.min(im.rows - 1, y0 + 1);
    out[y * N + x] = im.a[y0 * im.cols + x0] * (1 - fx) * (1 - fy) + im.a[y0 * im.cols + x1] * fx * (1 - fy)
                   + im.a[y1 * im.cols + x0] * (1 - fx) * fy + im.a[y1 * im.cols + x1] * fx * fy;
  }
  return out;
}
const l2 = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1;
  const o = new Float64Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

function knn(X, xl, Y, yl, k) {
  let ok = 0;
  Y.forEach((v, i) => {
    const best = [];
    X.forEach((u, j) => { const s = dot(v, u);
      if (best.length < k) { best.push([s, xl[j]]); best.sort((a, b) => a[0] - b[0]); }
      else if (s > best[0][0]) { best[0] = [s, xl[j]]; best.sort((a, b) => a[0] - b[0]); } });
    const vt = {}; best.forEach(([s, l]) => vt[l] = (vt[l] || 0) + s);
    let b = -1, bs = -Infinity; for (const q in vt) if (vt[q] > bs) { bs = vt[q]; b = +q; }
    if (b === yl[i]) ok++;
  });
  return 100 * ok / Y.length;
}

const NTRAIN = +(process.env.NTRAIN || 400), NTEST = +(process.env.NTEST || 200);
const trIm = readImages("train-images-idx3-ubyte", NTRAIN).map(toRetina);
const trLb = readLabels("train-labels-idx1-ubyte", NTRAIN);
const teIm = readImages("t10k-images-idx3-ubyte", NTEST).map(toRetina);
const teLb = readLabels("t10k-labels-idx1-ubyte", NTEST);
console.log(`MNIST ${trIm.length} train / ${teIm.length} test\n`);

// baseline: raw pixels
const rawAcc = knn(trIm.map(l2), trLb, teIm.map(l2), teLb, 3);
console.log(`raw pixels                                     kNN ${rawAcc.toFixed(1)}%   <- baseline to beat\n`);

// V1 complex features for a given set of Gabor scales + normalisation
function v1feat(img, scales, norm) {
  const L = V.lgn(V.retina(img));
  const parts = [];
  for (const g of scales) {
    V.rebuildGabors(g);
    const C = V.v1complex(V.v1simple(L), { pw: 2, norm });
    const a = new Float64Array(V.NORI * V.NC * V.NC);
    for (let o = 0; o < V.NORI; o++) a.set(C[o], o * V.NC * V.NC);
    parts.push(a);
  }
  const out = new Float64Array(parts.length * parts[0].length);
  parts.forEach((p, i) => out.set(p, i * p.length));
  return out;
}

const CONFIGS = [
  { name: "as-shipped  σ3 λ4 γ0.30 (shape-tuned)", scales: [{ sigma: 3, lambda: 4, gamma: 0.30 }], norm: 0.35 },
  { name: "rounder     σ2 λ4 γ0.60",               scales: [{ sigma: 2, lambda: 4, gamma: 0.60 }], norm: 0.35 },
  { name: "fine        σ1.5 λ3 γ0.60",             scales: [{ sigma: 1.5, lambda: 3, gamma: 0.60 }], norm: 0.35 },
  { name: "multi-scale fine+rounder",              scales: [{ sigma: 1.5, lambda: 3, gamma: 0.60 }, { sigma: 2.5, lambda: 5, gamma: 0.60 }], norm: 0.35 },
  { name: "multi-scale + weak divisive norm",      scales: [{ sigma: 1.5, lambda: 3, gamma: 0.60 }, { sigma: 2.5, lambda: 5, gamma: 0.60 }], norm: 0.03 },
];

const out = { raw: +rawAcc.toFixed(1), configs: [] };
for (const cfg of CONFIGS) {
  const t = Date.now();
  const X = trIm.map(im => l2(v1feat(im, cfg.scales, cfg.norm)));
  const Y = teIm.map(im => l2(v1feat(im, cfg.scales, cfg.norm)));
  const acc = knn(X, trLb, Y, teLb, 3);
  const flag = acc > rawAcc ? "  <- beats raw pixels" : "";
  console.log(`${cfg.name.padEnd(46)} kNN ${acc.toFixed(1)}%  dim ${X[0].length}  (${((Date.now() - t) / 1000).toFixed(0)}s)${flag}`);
  out.configs.push({ name: cfg.name, acc: +acc.toFixed(1), dim: X[0].length });
}
V.rebuildGabors({ sigma: 3, lambda: 4, gamma: 0.30 });   // restore the validated shape-task settings
fs.writeFileSync(path.join(__dirname, "..", "figures", "mnist_sweep.json"),
  JSON.stringify({ ...out, nTrain: trIm.length, nTest: teIm.length }));
console.log("\nwrote figures/mnist_sweep.json");
