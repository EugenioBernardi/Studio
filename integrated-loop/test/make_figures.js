"use strict";
/* Generate figure data from the validated models. Everything here is COMPUTED —
   no decorative values. Writes JSON to figures/data.json for the report page. */
const fs = require("fs"), path = require("path");
const V = require("../src/vision.js");
const L = require("../src/loop.js");
const K = require("../src/consolidate.js");
const { C, H } = L;

const out = {};
const ORDER = [0, 1, 2, 3, 4, 5];

/* ---------------- 1. vision: stimuli, V1/V2 stages, shape signature ---------------- */
{
  const shapes = ["square", "triangle", "circle"];
  out.vision = { N: V.N, NC: V.NC, V2N: V.V2N, shapes: [] };
  for (const k of shapes) {
    const r = V.pipeline(k, {});
    // downsample the retina image for compact transport
    const img = Array.from(r.img, x => +x.toFixed(3));
    // V1 complex: max over orientations at each location (energy map)
    const cx = new Float64Array(V.NC * V.NC);
    for (let o = 0; o < V.NORI; o++) for (let i = 0; i < V.NC * V.NC; i++) cx[i] = Math.max(cx[i], r.C[o][i]);
    out.vision.shapes.push({
      kind: k, img,
      v1: Array.from(cx, x => +x.toFixed(3)),
      d90: Array.from(r.V.D90, x => +x.toFixed(3)),
      d60: Array.from(r.V.D60, x => +x.toFixed(3)),
      corner90: +r.f.corner90.toFixed(4), corner60: +r.f.corner60.toFixed(4),
      entropy: +r.f.entropy.toFixed(4), label: r.dec.label,
    });
  }
  // classification accuracy over the condition grid
  let ok = 0, tot = 0;
  for (const k of V.DEC) for (const size of [0.40, 0.52, 0.64]) for (const rot of [0, 0.4, 0.9]) for (const cx of [-0.06, 0, 0.06]) {
    if (V.pipeline(k, { size, rot, cx }).dec.label === k) ok++; tot++;
  }
  out.vision.accuracy = +(100 * ok / tot).toFixed(1);
  out.vision.nConditions = tot;
}

/* ---------------- 2. dorsal: MT direction tuning + error ---------------- */
{
  const dirs = [], tuning = [], errs = [];
  for (let d = 0; d < 8; d++) {
    const dir = d * Math.PI / 4;
    const frames = V.motionSequence("square", { size: 0.42 }, { type: "translate", dir, speed: 0.5 });
    const M = V.mt(V.motionEnergy(frames).E);
    dirs.push(+(dir * 180 / Math.PI).toFixed(0));
    const tot = M.P.reduce((a, b) => a + b, 0) || 1;
    tuning.push(Array.from(M.P, x => +(x / tot).toFixed(4)));
    let e = Math.abs(M.dir - dir); e = Math.min(e, 2 * Math.PI - e);
    errs.push(+(e * 180 / Math.PI).toFixed(1));
  }
  out.mt = { dirs, tuning, errs, nDir: V.NDIR,
    median: +errs.slice().sort((a, b) => a - b)[Math.floor(errs.length / 2)].toFixed(1),
    mean: +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(1) };
}

/* ---------------- 3. hippocampus: sparsity + separation gradient ---------------- */
{
  const cortex = C.create({ seed: 1, NC: 800, nStim: 8 }); C.encode(cortex);
  const hpc = H.createHPC({ seed: 107, NC: cortex.N }); hpc.P.ach = 1.0;
  const fields = [["ec2", "EC II"], ["dg", "DG"], ["ca3", "CA3"], ["ca1", "CA1"], ["sub", "Sub"]];
  const pats = {}; fields.forEach(([f]) => pats[f] = []);
  for (let s = 0; s < 6; s++) {
    cortex.a.fill(0); cortex.inh = 0;
    C.setExt(cortex, cortex.stim[s]); C.run(cortex, 0.35);
    for (const [f] of fields) hpc[f].fill(0);
    hpc.iEC2 = hpc.iEC3 = hpc.iDG = hpc.iCA3 = hpc.iCA1 = hpc.iSUB = 0;
    for (let t = 0; t < 80; t++) H.forwardStep(hpc, cortex.a);
    for (const [f] of fields) pats[f].push(H.activeSet(hpc[f], 0.3));
  }
  C.clearExt(cortex);
  out.fields = fields.map(([f, name]) => {
    const P = pats[f], N = hpc[f].length;
    const sz = P.reduce((a, x) => a + x.length, 0) / P.length;
    let o = 0, n = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const b = new Set(P[j]); let c = 0; for (const x of P[i]) if (b.has(x)) c++; o += c; n++;
    }
    return { name, N, active: +(100 * sz / N).toFixed(1), overlap: +(100 * (o / n) / Math.max(1, sz)).toFixed(1) };
  });
}

/* ---------------- 4. replay: forward + reverse rasters ---------------- */
{
  const cortex = C.create({ seed: 2, NC: 800, nStim: 8 }); C.encode(cortex);
  const hpc = H.createHPC({ seed: 114, NC: cortex.N }); hpc.plastic = true;
  L.encodeSequence(cortex, hpc, ORDER);
  const enc = {}; ORDER.forEach((s, k) => enc[k] = k);
  const F = L.replaySequencePaced(cortex, hpc, {});
  const R = L.replaySequencePaced(cortex, hpc, { reverse: true });
  const T_ENC = 0.43;
  const span = F.times[F.times.length - 1] - F.times[0];
  out.replay = {
    forward: { seq: F.seq, times: F.times, rho: +L.spearman(F.seq, enc).rho.toFixed(2) },
    reverse: { seq: R.seq, times: R.times, rho: +L.spearman(R.seq, enc).rho.toFixed(2) },
    compression: +(((F.seq.length - 1) * T_ENC * 1000) / span).toFixed(1),
    encodeMsPerItem: T_ENC * 1000,
  };
}

/* ---------------- 5. consolidation gradient: cortical recall vs replay events -------- */
{
  const pts = [0, 2, 4, 6, 10, 16, 24, 34];
  const seeds = [1, 2, 3];
  const curves = [];
  for (const seed of seeds) {
    const cortex = C.create({ seed, NC: 800, nStim: 8 }); C.encode(cortex);
    const hpc = H.createHPC({ seed: 100 + seed * 7, NC: cortex.N }); hpc.plastic = true;
    L.encodeSequence(cortex, hpc, ORDER);
    const assemblies = hpc.indices.map(x => x.cortex);
    const enc = {}; ORDER.forEach((s, k) => enc[k] = k);
    const cons = K.createConsolidation(cortex);
    const row = [];
    for (const target of pts) {
      K.consolidate(cortex, hpc, cons, target - cons.events, { order: ORDER });
      row.push(+L.spearman(K.corticalRecall(cortex, cons, assemblies, {}), enc).rho.toFixed(2));
    }
    curves.push(row);
  }
  const mean = pts.map((_, i) => +(curves.reduce((a, r) => a + r[i], 0) / curves.length).toFixed(2));
  out.consolidation = { events: pts, curves, mean, seeds };
}

const dir = path.join(__dirname, "..", "figures");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(out));
console.log("wrote figures/data.json");
console.log("  vision accuracy", out.vision.accuracy + "%,",
            "MT median", out.mt.median + "°,",
            "replay fwd ρ", out.replay.forward.rho, "rev ρ", out.replay.reverse.rho,
            ", compression", out.replay.compression + "×");
console.log("  consolidation mean ρ:", out.consolidation.mean.join(" "));
