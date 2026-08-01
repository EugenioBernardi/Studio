"use strict";
/* =====================================================================
   ESSENTIAL TREMOR AS AN OLIVOCEREBELLAR LOOP INSTABILITY

   Hypothesis, registered in docs/OLIVARY-LOOP-PREBUILD.md before this file existed: ET is not a
   pacemaker disease. The healthy olivocerebellar loop is NEGATIVE feedback on olivary synchrony —

     olivary coupling ^ -> coherence R ^ -> synchronous climbing-fibre volleys ^
       -> Purkinje complex spike -> PAUSE -> Purkinje output v
       -> PC inhibits DCN, so DCN ^
       -> nucleo-olivary GABA ^ -> SHUNTS the olivary gap junctions -> coupling v

   — product of signs negative, which is why complex spikes sit at ~1 Hz and are not rhythmic in a
   normal animal. A delayed negative-feedback loop does not fail gracefully when its gain rises; it
   OSCILLATES. The climbing-fibre->Purkinje pathology found in ET brains raises the AC gain of the
   pause step. Past a critical gain the loop destabilises and the olive's pre-existing subthreshold
   rhythm becomes a coherent population output. The olive is the RESONANT ELEMENT, not the lesion —
   which is why no olivary pathology is found in ET.

   LEVEL OF DESCRIPTION, stated because the previous line of work in this repo got it wrong: the
   olive is N coupled CLOCKS, and SYNCHRONY DOES WORK — the gap-junction coupling that carries the
   coherence is the same quantity the nucleo-olivary feedback writes to. Dual code as elsewhere in
   this project: olive = oscillator population, Purkinje/DCN limb = rate.

   THE ONE MECHANISTIC ADDITION over the validated models/cerebellum.js olive. There, nucleo-olivary
   input subtracts from olivary DRIVE. Here it also SHUNTS THE COUPLING,

        g_eff = gGap / (1 + shunt * NO)

   which is Llinas's shunting hypothesis — GABAergic nucleo-olivary terminals land in the olivary
   glomeruli where the gap junctions are, and short-circuit them, reducing electrical coupling
   without changing gap-junction conductance. Lefler & Yarom (Neuron 2014) showed cerebellar
   inhibitory input to the olive decreases electrical coupling and blocks subthreshold oscillations.
   This is the load-bearing element: it is what makes the cerebellum able to control olivary
   synchrony, and therefore what makes the loop a loop.

   ANCHORS (set by hand, claiming nothing): olivary subthreshold frequency 6 Hz; healthy per-cell
   complex-spike rate ~1 Hz; loop delay from anatomy. EVERYTHING ELSE MUST EMERGE.
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
    dt: 0.001,              // s
    nIO: 40,                // olivary oscillators

    // ---- inferior olive: the resonant element. ANCHORED, not fitted.
    fIO: 6.0,               // subthreshold oscillation frequency (Hz) — within the measured 1-10 Hz
    ioSpread: 0.06,         // intrinsic-frequency heterogeneity (uncoupled -> desynchronised)
    ioNoise: 0.30,          // phase noise (rad/sqrt(s)). Negrello 2019: the olive is a quasiperiodic
                            // ratchet, not a metronome — variable cycles erase phase memory. Coherence
                            // has to be WON against this, which is what makes P1 able to fail.
    gGap: 5.50,             // gap-junction coupling strength (before shunting).
                            // ARITHMETIC, not tuning: with ioSpread 0.06 at 6 Hz the frequency
                            // spread is sigma_omega = 2.26 rad/s, so the Kuramoto critical coupling
                            // is K_c ~ 1.6*sigma = 3.6 rad/s (measured transition: between 3 and 6).
                            // The first build used 1.60, which after shunting gave g_eff ~0.85 —
                            // five times BELOW threshold, so olivary coherence sat at 1/sqrt(N) =
                            // 0.158 in every condition and synchrony was impossible BY CONSTRUCTION.
                            // At 5.50 the healthy shunted operating point is g_eff ~4.1, i.e. the
                            // olive is poised just at criticality and the loop can move it either way.

    // complex spikes: sparse, phase-locked. pCS is set so the HEALTHY per-cell rate is ~1 Hz, which
    // is an anchor to measurement. The camp-2 objection to the olivary hypothesis is that CS fire at
    // ~1 Hz and cannot carry a 6 Hz tremor; P1 tests whether that is a category error.
    pCS: 0.17,              // P(spike | subthreshold cycle peak) ~ 1/6 -> ~1 Hz at 6 Hz
    csSuppress: 2.0,        // strength with which nucleo-olivary GABA suppresses complex spikes.
                            // The FAST limb of the loop — this is what can destabilise.

    // ---- Purkinje limb (rate)
    pcTonic: 1.0,           // tonic simple-spike output (normalised)
    cfGain: 1.0,            // CF -> PC pause gain. THE LESION PARAMETER.
                            // ET pathology: CF-PC synapses displaced into the outer molecular layer
                            // and onto thin spiny branchlets (Louis/Kuo), GluRd2 pruning deficit
                            // (Pan 2020). Each synchronous volley moves Purkinje output more.
                            // This is an AC (modulation) gain, distinct from pcLoss below.
    pauseTau: 0.035,        // s — complex-spike pause development/recovery
    csRef: 1.0,             // Hz — healthy per-cell complex-spike rate, the normalising anchor
    pauseDepth: 0.30,       // fraction of Purkinje output suppressed at the healthy CS rate
    pcLoss: 0.0,            // fraction of Purkinje cells lost. A DC effect: less tonic output.
                            // Kept separate from cfGain because the P4 dissociation depends on
                            // AC and DC being different paths.

    // ---- deep cerebellar nuclei (rate)
    dcnDrive: 1.0,          // tonic excitatory drive (mossy collaterals)
    pcW: 0.85,              // Purkinje -> DCN inhibition weight
    dcnTau: 0.020,          // s

    // ---- nucleo-olivary limb
    loopDelay: 0.020,       // s — pure axonal CONDUCTION delay round the loop (IO->PC ~5-8 ms,
                            // PC->DCN ~2 ms, DCN->IO ~10 ms). The pre-build arithmetic quoted a
                            // 40-125 ms TOTAL loop lag; setting that here as pure transport
                            // double-counted, because pauseTau (35 ms) and dcnTau (20 ms) contribute
                            // their own phase lag. Total effective lag is ~75 ms -> ~6.7 Hz.
    shunt: 2.2,             // strength with which nucleo-olivary drive shunts the gap junctions
    noTonic: null,          // baseline DCN level the shunt is referenced to (auto-calibrated)
    loopOpen: false,        // P2: freeze nucleo-olivary drive at baseline -> loop opened
    noLesion: 0.0,          // fraction of the nucleo-olivary projection lost. This is the lesion the
                            // loop's SIGN STRUCTURE points to: every cerebellar CORTICAL lesion
                            // raises DCN output and therefore raises shunting, de-coupling the olive.
                            // Only removing nucleo-olivary inhibition itself can de-shunt it. That is
                            // the dentato-olivary (Guillain-Mollaret) lesion of oculopalatal tremor.

    seed: 1,
    warmup: 3.0,            // s discarded before measuring
    dur: 20.0,              // s measured
  };
}

function create(opts) {
  const P = Object.assign(defaults(), opts || {});
  const rnd = mulberry32(P.seed * 7919 + 13);
  const gauss = () => {
    let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };

  const th = new Float64Array(P.nIO), w = new Float64Array(P.nIO);
  for (let i = 0; i < P.nIO; i++) {
    th[i] = rnd() * TAU;
    w[i] = TAU * P.fIO * (1 + P.ioSpread * gauss());
  }

  const nDelay = Math.max(1, Math.round(P.loopDelay / P.dt));
  return {
    P, rnd, gauss, th, w,
    pause: 0, dcn: P.dcnDrive - P.pcW * P.pcTonic, ring: new Float64Array(nDelay), ri: 0, nDelay,
    R: 0, gEff: P.gGap, csCount: 0, t: 0,
  };
}

/* one integration step. Returns the instantaneous population CF volley (fraction of olivary cells
   emitting a complex spike this step) — that is the signal the whole loop rides on. */
function step(S) {
  const P = S.P, dt = P.dt, N = P.nIO;

  // ---- olivary mean field: this is the synchrony, and it is what the loop reads and writes
  let sx = 0, sy = 0;
  for (let i = 0; i < N; i++) { sx += Math.cos(S.th[i]); sy += Math.sin(S.th[i]); }
  sx /= N; sy /= N;
  const R = Math.hypot(sx, sy), psi = Math.atan2(sy, sx);
  S.R = R;

  // ---- nucleo-olivary drive, delayed. THE LOOP.
  const noRaw = S.ring[S.ri];
  const no = (P.loopOpen ? S.noTonic : noRaw) * (1 - P.noLesion);          // P2: freeze at baseline = open the loop

  // Llinas shunt: nucleo-olivary input short-circuits the gap junctions. Referenced to the ABSOLUTE
  // nucleo-olivary rate, not to a positive deviation from baseline — there is tonic nucleo-olivary
  // activity holding the olive partially de-coupled (Lefler & Yarom 2014), and modulation around
  // that tone moves coupling BOTH ways. Rectifying at baseline made the shunt one-sided and inert.
  const gEff = P.gGap / (1 + P.shunt * Math.max(0, no));
  S.gEff = gEff;
  const noDev = no - S.noTonic;

  // ---- olivary phases: coupled clocks
  const sqdt = Math.sqrt(dt);
  let volley = 0;
  for (let i = 0; i < N; i++) {
    const prev = S.th[i];
    S.th[i] += dt * (S.w[i] + gEff * R * Math.sin(psi - prev)) + P.ioNoise * sqdt * S.gauss();
    // complex spike on the depolarising peak of the subthreshold cycle (phase wrap through 0)
    if (Math.floor(S.th[i] / TAU) > Math.floor(prev / TAU)) {
      // net depolarisation: nucleo-olivary inhibition also suppresses spiking, as in cerebellum.js
      // Nucleo-olivary GABA does TWO things, both established, and they act on different timescales.
      // (1) it shunts the gap junctions -> less SYNCHRONY (slow: the order parameter takes many
      //     cycles to move, so this limb has almost no gain at tremor frequency);
      // (2) it hyperpolarises olivary neurons -> fewer COMPLEX SPIKES (fast: this limb is limited
      //     only by the pause and DCN time constants, both tens of ms).
      // The first build gave limb (2) a token weight and the loop merely regulated. That was a
      // modelling error, not a tuning choice: the instability can only ride a variable fast enough
      // to accumulate 180 deg of phase lag within the loop delay, and coherence is not that variable.
      const p = P.pCS * Math.exp(-P.csSuppress * noDev);
      if (S.rnd() < p) { volley++; S.csCount++; }
    }
  }
  volley /= N;

  // ---- Purkinje limb: the complex spike causes a PAUSE. cfGain is the AC lesion parameter.
  // `volley` is a per-step FRACTION, so it must be converted to a population CS RATE and normalised
  // to the healthy anchor before it can drive anything. Without that the pause sat at ~0.001 and the
  // loop could not move — a units error, not a tuning choice.
  const pcAvail = 1 - P.pcLoss;
  const csDrive = (volley / dt) / P.csRef;                 // ~1.0 in health, dimensionless
  S.pause += (dt / P.pauseTau) * (P.cfGain * P.pauseDepth * csDrive - S.pause);
  const pc = Math.max(0, (P.pcTonic - S.pause) * pcAvail);

  // ---- DCN: inhibited by Purkinje
  S.dcn += (dt / P.dcnTau) * ((P.dcnDrive - P.pcW * pc) - S.dcn);

  // ---- write DCN into the delay line: this is the nucleo-olivary signal one loop-delay from now
  S.ring[S.ri] = S.dcn;
  S.ri = (S.ri + 1) % S.nDelay;

  S.t += dt;
  return { volley, pc, dcn: S.dcn, R, gEff };
}

/* auto-calibrate the baseline the shunt is referenced to: run the loop OPEN with the healthy
   parameters and take the mean DCN. Referencing to a hand-set constant would silently make the
   shunt a fitted disease parameter. */
function calibrateTonic(opts) {
  const S = create(Object.assign({}, opts, { cfGain: 1.0, pcLoss: 0.0, seed: (opts && opts.seed) || 1 }));
  S.noTonic = 0; S.P.loopOpen = false;
  // first pass with no shunt reference (noDev clamps at >=0, so shunt is inert while noTonic=0
  // only if dcn<=0; instead run with shunt disabled outright)
  const g = S.P.shunt; S.P.shunt = 0;
  let acc = 0, n = 0;
  const nWarm = Math.round(1.5 / S.P.dt), nRun = Math.round(3.0 / S.P.dt);
  for (let k = 0; k < nWarm; k++) step(S);
  for (let k = 0; k < nRun; k++) { const o = step(S); acc += o.dcn; n++; }
  S.P.shunt = g;
  return acc / n;
}

/* Goertzel power at frequency f for a real series (mean removed by caller). */
function goertzel(x, f, fs) {
  const k = TAU * f / fs, c = 2 * Math.cos(k);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < x.length; i++) { s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
  return (s1 * s1 + s2 * s2 - c * s1 * s2) / (x.length * x.length);
}

/* spectrum of a signal over a frequency grid; returns peak frequency, peak power, and band power */
function spectrum(x, fs, fLo, fHi, dF) {
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  const y = x.map(v => v - mu);
  let best = { f: NaN, p: -1 }, band = 0, nB = 0;
  for (let f = fLo; f <= fHi + 1e-9; f += dF) {
    const p = goertzel(y, f, fs);
    if (p > best.p) best = { f, p };
    band += p; nB++;
  }
  return { peakF: best.f, peakP: best.p, bandP: band / nB };
}

/* run one condition and measure everything the registered predictions need */
function run(opts) {
  const P0 = Object.assign(defaults(), opts || {});
  const noTonic = (opts && opts.noTonic != null) ? opts.noTonic : calibrateTonic(opts);
  const S = create(Object.assign({}, opts, { noTonic }));
  S.noTonic = noTonic;

  const nWarm = Math.round(P0.warmup / P0.dt), nRun = Math.round(P0.dur / P0.dt);
  for (let k = 0; k < nWarm; k++) step(S);

  S.csCount = 0;
  const dcnTrace = new Array(nRun), volTrace = new Array(nRun);
  let rAcc = 0, gAcc = 0;
  for (let k = 0; k < nRun; k++) {
    const o = step(S);
    dcnTrace[k] = o.dcn; volTrace[k] = o.volley;
    rAcc += o.R; gAcc += o.gEff;
  }

  const fs = 1 / P0.dt;
  // 1-20 Hz at 0.1 Hz resolution: wide enough that a non-olivary instability frequency shows up
  const specDcn = spectrum(dcnTrace, fs, 1, 20, 0.1);
  const specVol = spectrum(volTrace, fs, 1, 20, 0.1);

  // tremor power = spectral power in the clinical ET band, relative to total 1-20 Hz
  const tremorBand = (() => {
    const mu = dcnTrace.reduce((a, b) => a + b, 0) / nRun;
    const y = dcnTrace.map(v => v - mu);
    let inB = 0, all = 0;
    for (let f = 1; f <= 20 + 1e-9; f += 0.1) { const p = goertzel(y, f, fs); all += p; if (f >= 4 && f <= 12) inB += p; }
    return { frac: all > 0 ? inB / all : 0, abs: inB };
  })();

  return {
    ioR: rAcc / nRun,
    gEff: gAcc / nRun,
    csRatePerCell: S.csCount / (P0.nIO * P0.dur),     // Hz per olivary cell — the P1 quantity
    dcnPeakF: specDcn.peakF, dcnPeakP: specDcn.peakP,
    volPeakF: specVol.peakF, volPeakP: specVol.peakP,
    tremorFrac: tremorBand.frac, tremorAbs: tremorBand.abs,
    noTonic,
  };
}

module.exports = { defaults, create, step, run, spectrum, calibrateTonic, mulberry32, TAU };
