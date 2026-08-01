"use strict";
/* =====================================================================
   OLIVOCEREBELLAR CIRCUIT, v2 — BASELINE FIRST.

   The previous build (models/olivary-loop.js, withdrawn — see docs/OLIVARY-LOOP-RETRACTION.md)
   reported a tremor result on a healthy baseline that already hummed at 6 Hz more coherently than
   the diseased one. Nothing in this file is allowed to have a lesion parameter until the healthy
   circuit reproduces measured healthy numbers, against an explicit no-rhythm null.

   THE DESIGN FAULT THAT CAUSED IT, and the fix.
   v1 emitted a complex spike on every crossing of the subthreshold phase. With 40 cells all near
   6 Hz, the population CS train THEN HAD to carry a 6 Hz component — coupled or not, healthy or
   not. The rhythm was baked into the spike-generation rule.

   Physiologically that rule is wrong. The olivary subthreshold oscillation GATES spiking: it sets
   the windows in which a cell CAN fire, it does not itself fire the cell. A complex spike needs
   coincident synaptic drive arriving inside a depolarised window (Llinas). So:

       CS  <=  (synaptic input arrives)  AND  (phase is inside the depolarised window)

   With input arriving at random times and cells at scattered phases, the population CS train is
   near-Poisson and the nuclear output has NO rhythm — which is the healthy state, and is what v1
   could not produce.

   And this is where SYNCHRONY DOES WORK, in the project's sense. Coupling aligns the gating windows.
   Aligned windows convert the SAME aperiodic input into a rhythmic population output, without
   changing the per-cell spike rate at all. Synchrony is the variable that converts noise into
   rhythm; it is not decoration.

   NULL CONTROL, built in rather than bolted on: `noOsc` disables phase gating so cells fire as pure
   Poisson processes at the same rate, through the identical Purkinje/DCN filter. Any spectral
   measure must be read against that null, because peak/median on a filtered point process is large
   even with no rhythm present. v1 had no such control and that is why a sharpness of 45 looked
   meaningful when it was not.
   ===================================================================== */

const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function defaults() {
  return {
    dt: 0.001,
    nIO: 60,

    // ---- inferior olive. ANCHORS to measurement, claiming nothing.
    fIO: 6.0,             // subthreshold frequency (Hz); measured range 1-10
    ioSpread: 0.25,       // frequency heterogeneity. Real olivary cells span ~1-10 Hz; v1 used 0.06
                          // (+/-0.36 Hz), ~10x too narrow, which is part of why it hummed.
    ioNoise: 0.45,        // phase noise. Negrello 2019: quasiperiodic ratchet, not a metronome.
    gGap: 0.0,            // gap-junction coupling. ZERO by default: the healthy in-vivo olive is
                          // weakly and intermittently synchronised, so coupling must be EARNED by
                          // the baseline validation, not assumed.

    // complex spikes: input-GATED, not phase-driven. This is the fix.
    inRate: 4.0,          // Hz — synaptic drive arriving at each olivary cell (Poisson)
    gateWidth: 0.25,      // fraction of the cycle that is permissive (depolarised window)
    noOsc: false,         // NULL CONTROL: disable phase gating -> pure Poisson CS at matched rate

    // ---- Purkinje limb
    pcTonic: 1.0,
    pauseTau: 0.035,
    csRef: 1.0,           // Hz, healthy per-cell CS rate — the normalising anchor
    pauseDepth: 0.30,

    // ---- deep cerebellar nuclei
    dcnDrive: 1.0,
    pcW: 0.85,
    dcnTau: 0.020,

    // ---- nucleo-olivary loop. Added ONLY after the baseline validated as quiet.
    shuntTonic: 0.0,      // how much tonic nucleo-olivary tone divides olivary coupling.
                          // g_eff = gGap * (1 + shuntTonic) / (1 + shuntTonic * NO/NOtonic)
                          // so at rest g_eff = gGap exactly, and REMOVING nucleo-olivary drive
                          // raises coupling by at most (1 + shuntTonic). That ceiling is the whole
                          // question: the baseline needs R ~0.12 and a rhythm needs R >~0.4.
    loopDelay: 0.020,
    noLesion: 0.0,        // fraction of nucleo-olivary projection lost (dentato-olivary lesion)
    cfGain: 1.0,          // CF->PC pause gain (the ET cortical lesion)
    loopOn: false,

    seed: 1,
    warmup: 3.0,
    dur: 40.0,
  };
}

function create(opts) {
  const P = Object.assign(defaults(), opts || {});
  const rnd = mulberry32(P.seed * 7919 + 13);
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

  const th = new Float64Array(P.nIO), w = new Float64Array(P.nIO);
  for (let i = 0; i < P.nIO; i++) {
    th[i] = rnd() * TAU;
    w[i] = TAU * P.fIO * (1 + P.ioSpread * gauss());
  }
  const nD = Math.max(1, Math.round(P.loopDelay / P.dt));
  const dcn0 = P.dcnDrive - P.pcW * (P.pcTonic - P.pauseDepth);
  const ring = new Float64Array(nD); ring.fill(dcn0);
  return { P, rnd, gauss, th, w, pause: P.pauseDepth, dcn: dcn0, R: 0, csCount: 0,
           ring, ri: 0, nD, dcn0 };
}

function step(S) {
  const P = S.P, dt = P.dt, N = P.nIO, sq = Math.sqrt(dt);

  let sx = 0, sy = 0;
  for (let i = 0; i < N; i++) { sx += Math.cos(S.th[i]); sy += Math.sin(S.th[i]); }
  sx /= N; sy /= N;
  const R = Math.hypot(sx, sy), psi = Math.atan2(sy, sx);
  S.R = R;

  // nucleo-olivary shunt of the gap junctions, referenced so that at rest g_eff == gGap
  let gEff = P.gGap;
  if (P.loopOn && P.shuntTonic > 0) {
    const no = S.ring[S.ri] * (1 - P.noLesion);
    gEff = P.gGap * (1 + P.shuntTonic) / (1 + P.shuntTonic * Math.max(1e-6, no / S.dcn0));
  }
  S.gEff = gEff;

  const pIn = P.inRate * dt;             // P(synaptic input this step, per cell)
  let volley = 0;
  for (let i = 0; i < N; i++) {
    S.th[i] += dt * (S.w[i] + gEff * R * Math.sin(psi - S.th[i])) + P.ioNoise * sq * S.gauss();
    if (S.rnd() < pIn) {
      // the oscillation GATES: a spike only follows input arriving in the depolarised window.
      // In the null (noOsc) the gate is always open but the rate is matched by gateWidth.
      const ph = ((S.th[i] % TAU) + TAU) % TAU;
      const open = P.noOsc ? (S.rnd() < P.gateWidth) : (ph < TAU * P.gateWidth);
      if (open) { volley++; S.csCount++; }
    }
  }
  volley /= N;

  // pause is a LEAKY low-pass of the normalised CS drive. The leak term matters: without it the
  // pause integrates monotonically, the nuclear trace becomes a deterministic ramp, and every
  // spectral measure collapses to the same value with zero variance across seeds. That zero
  // variance is the tell — a stochastic simulation cannot produce it.
  const csDrive = (volley / dt) / P.csRef;
  S.pause += (dt / P.pauseTau) * (P.cfGain * P.pauseDepth * csDrive - S.pause);
  const pc = Math.max(0, P.pcTonic - S.pause);
  S.dcn += (dt / P.dcnTau) * ((P.dcnDrive - P.pcW * pc) - S.dcn);
  S.ring[S.ri] = S.dcn; S.ri = (S.ri + 1) % S.nD;

  return { volley, pc, dcn: S.dcn, R, gEff };
}

function goertzel(x, f, fs) {
  const k = TAU * f / fs, c = 2 * Math.cos(k);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < x.length; i++) { s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
  return (s1 * s1 + s2 * s2 - c * s1 * s2) / (x.length * x.length);
}

/* spectral sharpness of the nuclear output: peak power / median power over 1-20 Hz.
   MUST be read against the noOsc null — on a filtered point process this is large regardless. */
function measure(opts) {
  const P = Object.assign(defaults(), opts || {});
  const S = create(P);
  const nW = Math.round(P.warmup / P.dt), nR = Math.round(P.dur / P.dt);
  for (let k = 0; k < nW; k++) step(S);
  S.csCount = 0;
  const tr = new Array(nR); let rAcc = 0, gAcc = 0;
  for (let k = 0; k < nR; k++) { const o = step(S); tr[k] = o.dcn; rAcc += o.R; gAcc += o.gEff; }

  const mu = tr.reduce((a, b) => a + b, 0) / nR, y = tr.map(v => v - mu);
  const fs = 1 / P.dt, ps = [];
  for (let f = 1; f <= 20.0001; f += 0.05) ps.push([f, goertzel(y, f, fs)]);
  const sorted = ps.map(p => p[1]).slice().sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  let best = ps[0]; for (const p of ps) if (p[1] > best[1]) best = p;
  let band = 0, tot = 0;
  for (const [f, p] of ps) { tot += p; if (f >= 4 && f <= 12) band += p; }

  return {
    ioR: rAcc / nR, gEff: gAcc / nR,
    csRate: S.csCount / (P.nIO * P.dur),
    sharpness: best[1] / med,
    peakF: best[0],
    bandFrac: band / tot,
    power: tot,
  };
}

module.exports = { defaults, create, step, measure, goertzel, mulberry32, TAU };
