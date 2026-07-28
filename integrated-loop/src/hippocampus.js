"use strict";
/* =====================================================================
   Hippocampal formation — human cell ratios, structured (non-random) connectivity.

   FIELDS (human stereology: West & Gundersen 1990; Šimić 1997; Harding 1998;
   EC layer II from Gómez-Isla 1996). Ratios to CA3 = 1:
     DG 5.6 · CA3 1 · CA1 5.5 · subiculum 1.7 · EC LII 0.24
   Note the human signature: CA1 ≈ 5.5× CA3 (rat ≈ 1.6×) — the expansion is at the
   OUTPUT/comparator stage, not the attractor stage.

   ENTORHINAL is split superficial/deep, and lateral/medial — the real loop, not a wire:
     LEC/MEC layer II  → DG + CA3        ("what" / "where" input streams)
     LEC/MEC layer III → CA1 (temporoammonic, distal dendrites)
     CA1 + subiculum   → EC deep (V/VI)  → neocortex   (output)

   PATHWAYS (in-degrees scaled from anatomy; convergence-preserving so cost is O(N)):
     EC II  → DG      perforant, LEC→outer / MEC→middle molecular layer
     EC II  → CA3     direct perforant (cue-driven completion route)
     DG     → CA3     mossy fibres: FEW, STRONG, LAMELLAR (narrow septotemporal)
     CA3    → CA3     recurrent: BROAD septotemporal spread
     CA3    → CA1     Schaffer, transverse map INVERTED (Ishizuka 1990)
     EC III → CA1     temporoammonic: MEC→proximal CA1, LEC→distal CA1
     CA1    → Sub     transverse map inverted again
     CA1/Sub→ EC deep → neocortex (plastic; carries reinstatement)

   STRUCTURE, not Erdős–Rényi. Every cell has transverse t∈[0,1] (proximodistal) and
   longitudinal l∈[0,1] (septotemporal) coordinates; connection probability is a
   topographic Gaussian kernel with pathway-specific widths and target mapping. Weights
   are LOGNORMAL (Song 2005; Buzsáki & Mizuseki 2014). In-degree is then normalised to the
   anatomical target — so the kernel decides WHO connects and normalisation decides HOW
   MANY, keeping the model structured, scale-invariant, and linear in cost.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function hdefaults() {
  return {
    seed: 101,
    // sizes at human ratios (CA3 = 480 sets the rest). At CA3 240 the ~15-cell indices
    // are small-number noisy: worst-seed reinstatement 0.72 vs 0.81 here — scale fixed the cause.
    // EC is sized as the INTERFACE to the whole neocortex, not only by hippocampal ratio:
    // layer II is ~0.65×10⁶ cells in absolute terms, and a ratio-only EC (60 cells here) is a
    // bottleneck that no downstream plasticity can undo (verified: recall 0.76→0.82, cross 0.12→0.08).
    NEC2: 300, NEC3: 300, NECd: 800,
    NDG: 2700, NCA3: 480, NCA1: 2640, NSUB: 800,
    // target in-degrees per pathway (anatomically ordered: mossy fewest, recurrent/Schaffer most)
    kPPdg: 30, kPPca3: 25, kMF: 12, kRec: 100, kSch: 60, kTA: 20, kSub: 50, kSubEcd: 30, kCa1Ecd: 40,
    // pathway weights (mean of the lognormal)
    wPPdg: 1.30, wPPca3: 0.55, wMF: 6.0, wSch: 0.55, wTA: 0.30, wSub: 0.55,
    wCE: 0.9,                    // cortex → EC superficial
    lnSigma: 0.6,                // lognormal weight spread
    // per-field feedback inhibition gains — tuned so each field hits its anatomical sparsity
    // (EC ~15%, DG ~3% sparsest/most-separated, CA3 ~6%, CA1 ~10%, subiculum ~15%)
    gEC: 29.1, gDG: 377.0, gCA3: 202.4, gCA1: 46.0, gSUB: 32.5, gECd: 29.1,
    gCA3rep: 4.0,                // CA3 inhibition during ripple replay
    // thresholds / gains
    thr: 0.14, gain: 1.5,
    tauA: 0.020, tauI: 0.006, dt: 0.001,
    taGate: 0.45,                // temporoammonic GATES rather than drives (distal dendrite)
    // plasticity
    lrBind: 3.0, lrRec3: 3.0, lrAsym: 0.9, asymBack: 0.35, seqGain: 1.0,
    wRecMax3: 1.4, wBudget3: 2.0, wBindMax: 1.6, wBudgetBind: 2.2,
    actThr: 0.30, ach: 1.0,
    tauAdaptUp: 0.015, tauAdaptDn: 0.280, adaptGain3: 0.6,
  };
}

/* ---- coordinates: tile each field on a transverse × longitudinal sheet ---- */
function coords(N) {
  const nT = Math.max(1, Math.round(Math.sqrt(N))), nL = Math.ceil(N / nT);
  const t = new Float64Array(N), l = new Float64Array(N);
  for (let i = 0; i < N; i++) { t[i] = ((i % nT) + 0.5) / nT; l[i] = (Math.floor(i / nT) + 0.5) / nL; }
  return { t, l };
}

/* ---- lognormal weight with prescribed mean ---- */
function lognorm(rnd, mean, sigma) {
  let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean * Math.exp(sigma * z - sigma * sigma / 2);
}

/* ---- structured projection: topographic Gaussian kernel + fixed in-degree ----
   opts: { map }  t_target(t_post) — 'id' | 'inv' | number (fixed band centre)
         { sT, sL } kernel widths;  { kOf }  optional per-post in-degree modulation
         { preStream, want } restrict presynaptic pool to a stream label            */
function project(rnd, post, pre, K, w0, o) {
  o = o || {};
  const sT = o.sT == null ? 0.25 : o.sT, sL = o.sL == null ? 0.30 : o.sL;
  const idx = [], wt = [];
  const pool = [];
  for (let j = 0; j < pre.N; j++) {
    if (o.preStream && o.preStream[j] !== o.want) continue;
    pool.push(j);
  }
  for (let i = 0; i < post.N; i++) {
    // topographic target on the transverse axis
    let tT;
    if (o.map === "inv") tT = 1 - post.t[i];
    else if (typeof o.map === "number") tT = o.map;
    else tT = post.t[i];
    // kernel over the (possibly stream-restricted) presynaptic pool
    const p = new Float64Array(pool.length); let tot = 0;
    for (let a = 0; a < pool.length; a++) {
      const j = pool[a];
      const dt = pre.t[j] - tT, dl = pre.l[j] - post.l[i];
      const v = Math.exp(-(dt * dt) / (2 * sT * sT)) * Math.exp(-(dl * dl) / (2 * sL * sL));
      p[a] = v; tot += v;
    }
    let k = o.kOf ? Math.max(1, Math.round(K * o.kOf(post.t[i]))) : K;
    k = Math.min(k, pool.length);
    // sample k distinct presynaptic cells ∝ kernel (roulette without replacement)
    const chosen = new Set(), id = [], w = [];
    let guard = 0;
    while (id.length < k && guard++ < k * 40 && tot > 0) {
      let r = rnd() * tot, a = 0;
      while (a < pool.length - 1 && (r -= p[a]) > 0) a++;
      if (chosen.has(a)) continue;
      chosen.add(a); id.push(pool[a]); w.push(lognorm(rnd, w0, o.lnSigma == null ? 0.6 : o.lnSigma));
    }
    idx.push(Int32Array.from(id)); wt.push(Float64Array.from(w));
  }
  return { idx, wt };
}

function createHPC(opts) {
  const P = Object.assign(hdefaults(), opts || {});
  const rnd = mulberry32(P.seed);
  const NCcx = opts && opts.NC ? opts.NC : 800;

  // fields with coordinates
  const F = {};
  const mk = N => Object.assign({ N }, coords(N));
  F.ec2 = mk(P.NEC2); F.ec3 = mk(P.NEC3); F.ecd = mk(P.NECd);
  F.dg = mk(P.NDG); F.ca3 = mk(P.NCA3); F.ca1 = mk(P.NCA1); F.sub = mk(P.NSUB);
  // EC stream labels: 0 = LEC ("what", ventral), 1 = MEC ("where", dorsal)
  const streamII = new Int8Array(P.NEC2), streamIII = new Int8Array(P.NEC3);
  for (let i = 0; i < P.NEC2; i++) streamII[i] = i < P.NEC2 / 2 ? 0 : 1;
  for (let i = 0; i < P.NEC3; i++) streamIII[i] = i < P.NEC3 / 2 ? 0 : 1;

  // cortex is split into ventral ("what") and dorsal ("where") halves; vision fills these later
  const cx = mk(NCcx);
  const ventral = opts && opts.ventralIdx ? opts.ventralIdx : null;
  const cxStream = new Int8Array(NCcx);
  for (let i = 0; i < NCcx; i++) cxStream[i] = ventral ? (ventral.has(i) ? 0 : 1) : (i < NCcx / 2 ? 0 : 1);

  // --- cortex → EC superficial, stream-respecting (ventral→LEC, dorsal→MEC) ---
  const Wce2 = project(rnd, F.ec2, cx, 40, P.wCE, { sT: 0.35, sL: 0.35, lnSigma: P.lnSigma });
  const Wce3 = project(rnd, F.ec3, cx, 40, P.wCE, { sT: 0.35, sL: 0.35, lnSigma: P.lnSigma });

  // --- EC II → DG (perforant); LEC→outer / MEC→middle molecular layer ---
  const Wed = project(rnd, F.dg, F.ec2, P.kPPdg, P.wPPdg, { sT: 0.30, sL: 0.20, lnSigma: P.lnSigma });
  // --- EC II → CA3 (direct perforant: the cue-driven completion route) ---
  const Wec3 = project(rnd, F.ca3, F.ec2, P.kPPca3, P.wPPca3, { sT: 0.30, sL: 0.25, lnSigma: P.lnSigma });
  // --- DG → CA3 mossy fibres: few, strong, LAMELLAR, biased to proximal CA3 (CA3c/b) ---
  const Wdc = project(rnd, F.ca3, F.dg, P.kMF, P.wMF, {
    sT: 0.10, sL: 0.05, lnSigma: P.lnSigma,
    kOf: t => 0.5 + 1.0 * Math.exp(-(t * t) / (2 * 0.35 * 0.35)),   // proximal bias
  });
  // --- CA3 → CA1 Schaffer: transverse map INVERTED (proximal CA3 → distal CA1) ---
  const Wc31 = project(rnd, F.ca1, F.ca3, P.kSch, P.wSch, { map: "inv", sT: 0.25, sL: 0.30, lnSigma: P.lnSigma });
  // --- EC III → CA1 temporoammonic: MEC→proximal CA1, LEC→distal CA1 ---
  const WtaM = project(rnd, F.ca1, F.ec3, Math.round(P.kTA / 2), P.wTA,
    { map: 0.25, sT: 0.20, sL: 0.30, preStream: streamIII, want: 1, lnSigma: P.lnSigma });
  const WtaL = project(rnd, F.ca1, F.ec3, Math.round(P.kTA / 2), P.wTA,
    { map: 0.75, sT: 0.20, sL: 0.30, preStream: streamIII, want: 0, lnSigma: P.lnSigma });
  // --- CA1 → subiculum: transverse map inverted again ---
  const Wc1s = project(rnd, F.sub, F.ca1, P.kSub, P.wSub, { map: "inv", sT: 0.20, sL: 0.25, lnSigma: P.lnSigma });

  // --- CA3 recurrent: BROAD septotemporal spread; plastic, starts silent ---
  const Rca3 = project(rnd, F.ca3, F.ca3, P.kRec, 0, { sT: 0.35, sL: 0.50 });
  for (let i = 0; i < P.NCA3; i++) Rca3.wt[i].fill(0);
  const Rseq = project(rnd, F.ca3, F.ca3, P.kRec, 0, { sT: 0.35, sL: 0.50 });
  for (let i = 0; i < P.NCA3; i++) Rseq.wt[i].fill(0);

  // --- output path: Sub → EC deep is STRUCTURAL; EC deep → neocortex is the PLASTIC stage
  // that carries reinstatement. (One plastic stage, not two: subicular→entorhinal projections
  // are fixed anatomy, and it avoids a chicken-and-egg where EC deep can never activate.)
  const Wse = project(rnd, F.ecd, F.sub, P.kSubEcd, P.wSub, { sT: 0.30, sL: 0.30, lnSigma: P.lnSigma });
  // CA1 → EC deep DIRECT, in parallel with the subicular route (Amaral): CA1 is the better-
  // separated field, so this is what keeps distinct memories distinct at the output stage.
  const Wc1d = project(rnd, F.ecd, F.ca1, P.kCa1Ecd, P.wSub, { sT: 0.30, sL: 0.30, lnSigma: P.lnSigma });
  const Wec = { idx: [], wt: [] };
  for (let i = 0; i < NCcx; i++) { Wec.idx.push(null); Wec.wt.push(new Float64Array(P.NECd)); }

  return {
    P, rnd, NC: NCcx, F, streamII, streamIII, cxStream,
    Wce2, Wce3, Wed, Wec3, Wdc, Wc31, WtaM, WtaL, Wc1s, Rca3, Rseq, Wse, Wc1d, Wec,
    ec2: new Float64Array(P.NEC2), ec3: new Float64Array(P.NEC3), ecd: new Float64Array(P.NECd),
    dg: new Float64Array(P.NDG), ca3: new Float64Array(P.NCA3),
    ca1: new Float64Array(P.NCA1), sub: new Float64Array(P.NSUB),
    adapt3: new Float64Array(P.NCA3),
    iEC2: 0, iEC3: 0, iECd: 0, iDG: 0, iCA3: 0, iCA1: 0, iSUB: 0,
    ecReinstate: new Float64Array(NCcx),
    indices: [], plastic: false,
  };
}

/* ---- dynamics ---- */
function fieldStep(H, arr, inputFn, g, key) {
  const P = H.P, N = arr.length, dt = P.dt;
  let sum = 0; const nx = new Float64Array(N);
  const inh = H[key];
  for (let i = 0; i < N; i++) {
    const drive = inputFn(i) - P.thr - g * inh;
    nx[i] = drive > 0 ? clamp(P.gain * drive, 0, 1.3) : 0;
  }
  for (let i = 0; i < N; i++) { arr[i] += (dt / P.tauA) * (nx[i] - arr[i]); sum += arr[i]; }
  H[key] += (dt / P.tauI) * (sum / N - H[key]);
}
const dot = (proj, i, src) => { const id = proj.idx[i], w = proj.wt[i]; let s = 0;
  for (let k = 0; k < id.length; k++) s += w[k] * src[id[k]]; return s; };
const dotDense = (proj, i, src) => { const w = proj.wt[i]; let s = 0;
  for (let j = 0; j < w.length; j++) s += w[j] * src[j]; return s; };

// FORWARD: cortex → EC II/III → DG + CA3 → CA1 (Schaffer + temporoammonic) → subiculum
function forwardStep(H, cortexA) {
  const P = H.P;
  fieldStep(H, H.ec2, i => dot(H.Wce2, i, cortexA), P.gEC, "iEC2");
  fieldStep(H, H.ec3, i => dot(H.Wce3, i, cortexA), P.gEC, "iEC3");
  fieldStep(H, H.dg, i => dot(H.Wed, i, H.ec2), P.gDG, "iDG");
  const achRec = 1 - 0.85 * P.ach;             // recurrence gated off while encoding (Hasselmo)
  fieldStep(H, H.ca3, i => dot(H.Wdc, i, H.dg) + dot(H.Wec3, i, H.ec2)
                          + achRec * dot(H.Rca3, i, H.ca3), P.gCA3, "iCA3");
  // CA1: Schaffer drives (proximal dendrites); temporoammonic GATES (distal dendrites)
  fieldStep(H, H.ca1, i => {
    const sch = dot(H.Wc31, i, H.ca3);
    const ta = dot(H.WtaM, i, H.ec3) + dot(H.WtaL, i, H.ec3);
    return sch + P.taGate * ta;
  }, P.gCA1, "iCA1");
  fieldStep(H, H.sub, i => dot(H.Wc1s, i, H.ca1), P.gSUB, "iSUB");
  // the loop is closed during encoding too: subiculum → EC deep is active, giving EC deep the
  // pattern that the plastic EC-deep → neocortex stage binds to the active cortical assembly
  fieldStep(H, H.ecd, i => dot(H.Wse, i, H.sub) + dot(H.Wc1d, i, H.ca1), P.gECd, "iECd");
}

// BACKWARD (output): CA3 → CA1 → subiculum → EC deep → neocortex reinstatement
function backwardStep(H) {
  const P = H.P;
  fieldStep(H, H.ca1, i => dot(H.Wc31, i, H.ca3), P.gCA1, "iCA1");
  fieldStep(H, H.sub, i => dot(H.Wc1s, i, H.ca1), P.gSUB, "iSUB");
  fieldStep(H, H.ecd, i => dot(H.Wse, i, H.sub) + dot(H.Wc1d, i, H.ca1), P.gECd, "iECd");
  for (let i = 0; i < H.NC; i++) H.ecReinstate[i] = dotDense(H.Wec, i, H.ecd);
}

// REPLAY: CA3 recurrent + directed transitions, with adaptation; then the output pass
function replayStep(H) {
  const P = H.P, ca3 = H.ca3, N = ca3.length, dt = P.dt;
  const achRec = 1 - 0.85 * P.ach;
  let sum = 0; const nx = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const auto = dot(H.Rca3, i, ca3), seq = dot(H.Rseq, i, ca3);
    const drive = achRec * auto + P.seqGain * seq - P.thr - P.gCA3rep * H.iCA3 - P.adaptGain3 * H.adapt3[i];
    nx[i] = drive > 0 ? clamp(P.gain * drive, 0, 1.3) : 0;
  }
  for (let i = 0; i < N; i++) {
    ca3[i] += (dt / P.tauA) * (nx[i] - ca3[i]); sum += ca3[i];
    const tau = ca3[i] > H.adapt3[i] ? P.tauAdaptUp : P.tauAdaptDn;
    H.adapt3[i] += (dt / tau) * (ca3[i] - H.adapt3[i]);
  }
  H.iCA3 += (dt / P.tauI) * (sum / N - H.iCA3);
  backwardStep(H);
}

function activeSet(arr, thr) { const s = []; for (let i = 0; i < arr.length; i++) if (arr[i] > thr) s.push(i); return s; }

function normSparse(wt, budget) {
  for (let pass = 0; pass < 6; pass++) {
    let s = 0, nz = 0;
    for (let k = 0; k < wt.length; k++) if (wt[k] > 0) { s += wt[k]; nz++; }
    const ex = s - budget;
    if (ex <= 1e-9 || nz === 0) return;
    const d = ex / nz; let clipped = false;
    for (let k = 0; k < wt.length; k++) if (wt[k] > 0) {
      if (wt[k] > d) wt[k] -= d; else { wt[k] = 0; clipped = true; }
    }
    if (!clipped) return;
  }
}

/* ---- lesions: anatomically specific damage, for the pathology suite ----
   A cell is silenced by zeroing its INCOMING structural weights — it then never crosses
   threshold and cannot contribute downstream, which is what a lost neuron does. Returns the
   set of silenced indices so a lesion can be reported and reproduced. */
const INPUTS = {
  ec2: ["Wce2"], ec3: ["Wce3"], dg: ["Wed"],
  ca3: ["Wdc", "Wec3", "Rca3", "Rseq"],
  ca1: ["Wc31", "WtaM", "WtaL"],
  sub: ["Wc1s"], ecd: ["Wse", "Wc1d"],
};
function lesionField(H, field, frac, seed) {
  const N = H[field].length, rnd = mulberry32(seed == null ? 9091 : seed);
  const dead = [];
  for (let i = 0; i < N; i++) if (rnd() < frac) dead.push(i);
  for (const proj of INPUTS[field] || []) {
    const P = H[proj]; if (!P) continue;
    for (const i of dead) if (P.wt[i]) P.wt[i].fill(0);
  }
  H.lesions = H.lesions || {}; H.lesions[field] = dead.length / N;
  return dead;
}

/* diffuse recurrent sprouting (mossy-fibre / associational reorganisation in TLE):
   raise the CA3 recurrent weight budget and scale existing weights up. */
function sprout(H, gain) {
  H.P.wBudget3 *= gain; H.P.wRecMax3 *= gain;
  for (let i = 0; i < H.P.NCA3; i++) for (let k = 0; k < H.Rca3.wt[i].length; k++) H.Rca3.wt[i][k] *= gain;
}

module.exports = { lesionField, sprout, createHPC, hdefaults, forwardStep, backwardStep, replayStep,
  fieldStep, activeSet, normSparse, mulberry32, dot, dotDense, project, coords, lognorm };
