"use strict";
/* =====================================================================
   Cerebellum — supervised motor learning as an ADAPTIVE FILTER, with the
   inferior olive as a gap-junction-coupled OSCILLATOR population.

   Task: vestibulo-ocular reflex (VOR) gain adaptation — the canonical
   cerebellar oculomotor learning paradigm. The head rotates; the eyes must
   counter-rotate to hold gaze. RETINAL SLIP (residual image motion) is the
   error. The inferior olive reports it as CLIMBING-FIBRE complex spikes, which
   drive LTD at coincident parallel-fibre→Purkinje synapses (Marr–Albus–Ito).
   Over trials the Purkinje output learns to cancel the slip → the VOR gain
   adapts toward whatever the visual world demands (e.g. magnifying goggles).

   Circuit (complete):
     mossy fibres (vestibular head velocity + its quadrature)
       → GRANULE cells: expansion recoding into a temporal/phase BASIS,
         sparsified by GOLGI feedback inhibition; their axons are PARALLEL FIBRES
       → PURKINJE cell: simple-spike rate = tonic + Σ w_k·PF_k − MLI inhibition;
         the sole cortical output, GABAergic onto the deep nuclei. The weights
         w_k are the site of learning.
       → DEEP / VESTIBULAR NUCLEUS (the flocculus target): tonic − Purkinje inhibition = the
         cerebellar output. It does NOT reach muscle directly — it modulates the brain-stem VOR
         via oculomotor MOTONEURONS → extraocular muscle → eye (the relay the app draws).
     INFERIOR OLIVE (IO): gap-junction-coupled oscillators (subthreshold ~6 Hz).
       Retinal slip depolarises them; a complex spike fires when the drive meets
       the depolarising phase. DCN inhibits IO (NUCLEO-OLIVARY feedback) — the
       loop that regulates the teaching signal and stops runaway learning.

   DUAL CODE (as in the basal-ganglia model): the IO is a genuine oscillator
   population — gap-junction SYNCHRONY organises complex-spike timing, so synchrony
   does real work there. The cortical microcircuit (granule/Purkinje/DCN) is rate +
   plastic weights. Every unit is still a clock for the visualisation.

   Learning rule (adaptive-filter decorrelation / covariance):
     Δw_k ∝ −(CF − CF0)·PF_k   — LTD when the error (complex-spike excess) coincides
   with parallel-fibre activity, LTP when it is below baseline. This drives the
   error into decorrelation with the granule basis, i.e. minimises retinal slip
   within the span of the basis. `node models/cerebellum.js test`.
   ===================================================================== */

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Cerebellum = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const relu = v => (v > 0 ? v : 0);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function defaults() {
    return {
      dt: 0.001,          // s (1 ms)
      seed: 7,

      // ---- task: sinusoidal head rotation (VOR) ----
      fHead: 0.5,         // head rotation frequency (Hz)
      headAmp: 1.0,       // head velocity amplitude (normalised)
      g0: 1.0,            // brain-stem (direct) VOR gain — cerebellum learns the residual
      demand: 1.0,        // required gain G* (1 normal; >1 magnifying, <1 minifying goggles)

      // ---- population sizes ----
      nGr: 60,            // granule cells (parallel-fibre basis) — a large, richer basis
      nIO: 12,            // inferior-olive oscillators

      // ---- granule / Purkinje / DCN ----
      grThresh: 0.20,     // granule firing threshold (with Golgi → sparse code)
      golgi: 0.70,        // Golgi feedback-inhibition strength (divisive sparsification)
      pcTonic: 0.60,      // Purkinje tonic simple-spike level
      mli: 0.35,          // molecular-layer interneuron feedforward inhibition (∝ pooled PF)
      wInit: 0.0,         // initial PF→PC weights (learn from zero residual)
      wPcDcn: 1.30,       // Purkinje → DCN inhibition
      dcnTonic: 1.00,     // DCN tonic drive
      kEye: 1.00,         // DCN modulation → eye-velocity gain

      // ---- inferior olive (oscillator) ----
      fIO: 6.0,           // subthreshold oscillation frequency (Hz)
      ioSpread: 0.03,     // olivary intrinsic-frequency heterogeneity (uncoupled → desynchronised)
      gGap: 0.90,         // gap-junction coupling (→ synchrony)
      ioNoise: 0.015,     // phase noise
      cfTau: 0.12,        // climbing-fibre smoothing (s) — long enough to reject baseline CS noise
      oscAmp: 0.5,        // subthreshold oscillation amplitude
      csGain: 2.4,        // slip → olivary depolarisation gain
      csThresh: 0.42,     // complex-spike threshold (on oscAmp·cosθ + drive); baseline ~1 Hz
      csMargin: 0.18,     // soft-threshold width for the GRADED complex-spike probability
      nucleoOlive: 0.55,  // DCN → IO inhibition (nucleo-olivary feedback)

      // ---- display ----
      gainTau: 2.0,       // EWMA time constant (s) for the live VOR-gain estimate

      // ---- plasticity ----
      lrLTD: 0.055,       // climbing-fibre-gated LTD/LTP rate (adaptive-filter β)
      wDecay: 0.00004,    // slow weight decay (homeostatic, small)
      wMax: 3.0,
    };
  }

  function create(opts) {
    const P = Object.assign(defaults(), opts || {});
    const rnd = mulberry32(P.seed);
    const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

    // granule basis: each granule mixes head velocity + its quadrature with a random
    // gain/phase, is rectified and thresholded → a sparse phase-tiled temporal basis.
    const gr = [];
    for (let k = 0; k < P.nGr; k++) {
      const ph = TAU * (k + 0.5) / P.nGr + 0.15 * gauss();   // tile the phase circle
      gr.push({ a: Math.cos(ph), b: Math.sin(ph), act: 0 });
    }
    // one Purkinje microzone: PF→PC weights (the learned filter)
    const w = new Float64Array(P.nGr);
    for (let k = 0; k < P.nGr; k++) w[k] = P.wInit;

    // inferior olive: coupled oscillators
    const io = [];
    for (let i = 0; i < P.nIO; i++)
      io.push({ th: rnd() * TAU, w: TAU * P.fIO * (1 + P.ioSpread * gauss()), cs: 0, v: 0 });

    // calibrate the SPONTANEOUS complex-spike rate (drive = 0): this is the reference the
    // teaching signal is signed against, so err = 0 when there is no retinal slip.
    const cf0 = calibrateCf0(P, io.map(o => ({ th: o.th, w: o.w })), gauss);

    const S = {
      P, rnd, gauss, t: 0,
      gr, w, io, cf0,
      // observ / running state
      head: 0, headDot: 0, eye: 0, slip: 0,
      pc: P.pcTonic, dcn: P.dcnTonic, cf: cf0, ioR: 0, csRate: 0,
      grActive: 0,
      // live (EWMA) VOR gain / slip estimators for display — do not perturb state like measure()
      ehAvg: 0, hhAvg: 0, ssAvg: 0, gainEst: P.g0, slipEst: 0,
    };
    return S;
  }

  // baseline complex-spike rate with no slip drive — the signed-error reference
  function calibrateCf0(P, io, gauss) {
    const dt = P.dt, n = Math.round(3.0 / dt); let acc = 0, cnt = 0;
    for (let k = 0; k < n; k++) {
      let sx = 0, sy = 0; for (const o of io) { sx += Math.cos(o.th); sy += Math.sin(o.th); }
      sx /= io.length; sy /= io.length; const psi = Math.atan2(sy, sx), R = Math.hypot(sx, sy);
      let csProb = 0;
      for (const o of io) {
        o.th = (o.th + dt * (o.w + P.gGap * R * Math.sin(psi - o.th)) + Math.sqrt(dt) * P.ioNoise * gauss() + TAU) % TAU;
        csProb += clamp((P.oscAmp * Math.cos(o.th) - P.csThresh + P.csMargin) / (2 * P.csMargin), 0, 1);
      }
      if (k > n * 0.2) { acc += csProb / io.length; cnt++; }
    }
    return acc / cnt;
  }

  function setDemand(S, g) { S.P.demand = g; }

  // one integration step
  function step(S) {
    const P = S.P, dt = P.dt;
    const w = TAU * P.fHead;
    // head velocity (vestibular) and its quadrature (acceleration/efference copy)
    const head = P.headAmp * Math.sin(w * S.t);
    const headDot = P.headAmp * Math.cos(w * S.t);      // quadrature (∝ derivative / ω)
    S.head = head; S.headDot = headDot;

    // ---- granule layer: rectified phase-tiled basis, Golgi divisive sparsification ----
    let rawSum = 0;
    for (const g of S.gr) { g.raw = relu(g.a * head + g.b * headDot - P.grThresh); rawSum += g.raw; }
    const golgi = 1 + P.golgi * (rawSum / P.nGr);        // feedback inhibition ∝ mean activity
    let nAct = 0, pfPool = 0;
    for (const g of S.gr) { g.act = g.raw / golgi; if (g.act > 0.02) nAct++; pfPool += g.act; }
    S.grActive = nAct / P.nGr;

    // ---- Purkinje cell: tonic + Σ w·PF − MLI feedforward inhibition ----
    let pfDrive = 0;
    for (let k = 0; k < P.nGr; k++) pfDrive += S.w[k] * S.gr[k].act;
    const pc = clamp(P.pcTonic + pfDrive - P.mli * pfPool / P.nGr, 0, 3);
    S.pc = pc;

    // ---- DCN: tonic − Purkinje inhibition = cerebellar output ----
    const dcn = P.dcnTonic - P.wPcDcn * (pc - P.pcTonic);
    S.dcn = dcn;

    // ---- eye velocity: brain-stem reflex + cerebellar modulation ----
    // eye = −(g0·head) − kEye·(dcn−dcnTonic).  Retinal slip = eye + demand·head.
    const eye = -(P.g0 * head) - P.kEye * (dcn - P.dcnTonic);
    S.eye = eye;
    const slip = eye + P.demand * head;                  // residual image velocity (error)
    S.slip = slip;
    // live VOR-gain / slip estimate (EWMA regression of eye on head) for the display
    const ga = dt / P.gainTau;
    S.ehAvg += ga * (eye * head - S.ehAvg);
    S.hhAvg += ga * (head * head - S.hhAvg);
    S.ssAvg += ga * (slip * slip - S.ssAvg);
    if (S.hhAvg > 1e-6) { S.gainEst = -S.ehAvg / S.hhAvg; S.slipEst = Math.sqrt(Math.max(0, S.ssAvg) / S.hhAvg); }

    // ---- inferior olive: coupled oscillators, slip depolarises, DCN inhibits ----
    // mean field for gap-junction coupling
    let sx = 0, sy = 0;
    for (const o of S.io) { sx += Math.cos(o.th); sy += Math.sin(o.th); }
    sx /= P.nIO; sy /= P.nIO;
    const psi = Math.atan2(sy, sx), R = Math.hypot(sx, sy);
    S.ioR = R;
    const drive = P.csGain * slip - P.nucleoOlive * (dcn - P.dcnTonic);   // signed error − nucleo-olivary
    let cs = 0, csProb = 0;
    for (const o of S.io) {
      o.th = (o.th + dt * (o.w + P.gGap * R * Math.sin(psi - o.th)) + Math.sqrt(dt) * P.ioNoise * S.gauss() + TAU) % TAU;
      // membrane = subthreshold oscillation (peaks at phase 0) + slip drive; centred at 0 so
      // positive slip ADDS complex spikes and negative slip removes them → a signed teaching signal
      o.v = P.oscAmp * Math.cos(o.th) + drive;
      o.cs = o.v > P.csThresh ? 1 : 0;                   // sampled complex spike (for display)
      cs += o.cs;
      csProb += clamp((o.v - P.csThresh + P.csMargin) / (2 * P.csMargin), 0, 1);  // graded probability
    }
    S.csRate = cs / P.nIO;                                // sampled fraction (bursty — for the viz)
    // climbing-fibre TEACHING signal reads the GRADED complex-spike probability (the effective
    // rate integrated over trials), not the noisy all-or-none sample — so no error ⇒ no drift.
    S.cf += (dt / P.cfTau) * (csProb / P.nIO - S.cf);

    // ---- plasticity: CF-gated LTD/LTP at PF→PC (adaptive-filter decorrelation) ----
    const err = S.cf - S.cf0;                            // signed error (probability excess over baseline)
    for (let k = 0; k < P.nGr; k++) {
      let dw = -P.lrLTD * err * S.gr[k].act - P.wDecay * S.w[k];
      S.w[k] = clamp(S.w[k] + dw, -P.wMax, P.wMax);
    }

    S.t += dt;
  }

  function run(S, seconds) { const n = Math.round(seconds / S.P.dt); for (let k = 0; k < n; k++) step(S); }

  // ---- observables: measure VOR gain and slip over a probe window (no learning) ----
  // gain = −⟨eye·head⟩/⟨head²⟩ ; slipRMS = √⟨slip²⟩ / √⟨head²⟩
  function measure(S, seconds) {
    const P = S.P, dt = P.dt, n = Math.round(seconds / dt);
    const savedLR = P.lrLTD; P.lrLTD = 0;                 // freeze weights while probing
    let eh = 0, hh = 0, ss = 0, cs = 0;
    for (let k = 0; k < n; k++) {
      step(S);
      eh += S.eye * S.head; hh += S.head * S.head; ss += S.slip * S.slip; cs += S.csRate;
    }
    P.lrLTD = savedLR;
    return { gain: hh > 1e-9 ? -eh / hh : 0, slipRMS: Math.sqrt(ss / n) / (Math.sqrt(hh / n) || 1),
             csRate: cs / n };
  }

  // train for a number of head cycles at the current demand
  function train(S, cycles) { run(S, cycles / S.P.fHead); }

  const gain = S => measure(S, 4 / S.P.fHead).gain;

  return { create, defaults, step, run, train, measure, setDemand, gain, mulberry32, TAU };
});

/* ============================ headless tests ============================ */
if (typeof require !== "undefined" && require.main === module) {
  const M = module.exports;
  const fmt = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
  let pass = 0, fail = 0;
  const check = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                                : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));

  console.log("\n[1] Baseline: gain ≈ g0, low complex-spike rate, sparse granule code");
  {
    const S = M.create({ demand: 1.0 });
    M.train(S, 4);
    const m = M.measure(S, 8);
    console.log("      gain=" + fmt(m.gain) + "  slipRMS=" + fmt(m.slipRMS) + "  CS=" + fmt(m.csRate) + "  grActive=" + fmt(S.grActive));
    check("baseline gain ≈ 1.0", Math.abs(m.gain - 1.0) < 0.12, "gain=" + fmt(m.gain));
    check("granule code is sparse (<50% active)", S.grActive < 0.5, "act=" + fmt(S.grActive));
  }

  console.log("\n[2] VOR gain-UP adaptation (magnifying goggles, demand 1.6)");
  {
    const S = M.create({ demand: 1.6 });
    const before = M.measure(S, 4).gain;
    M.train(S, 120);
    const after = M.measure(S, 4);
    console.log("      gain " + fmt(before) + " → " + fmt(after.gain) + "   slipRMS " + fmt(after.slipRMS));
    check("gain increases toward the demand", after.gain > before + 0.25, "Δ=" + fmt(after.gain - before));
    check("residual slip is reduced", after.slipRMS < 0.35, "slip=" + fmt(after.slipRMS));
  }

  console.log("\n[3] VOR gain-DOWN adaptation (minifying goggles, demand 0.5)");
  {
    const S = M.create({ demand: 0.5 });
    const before = M.measure(S, 4).gain;
    M.train(S, 120);
    const after = M.measure(S, 4).gain;
    console.log("      gain " + fmt(before) + " → " + fmt(after));
    check("gain decreases toward the demand", after < before - 0.20, "Δ=" + fmt(after - before));
  }

  console.log("\n[4] Climbing fibre is necessary (lesion IO → no learning)");
  {
    // lesion the whole inferior olive: no slip drive AND no nucleo-olivary loop → no teaching signal
    const S = M.create({ demand: 1.6, csGain: 0, nucleoOlive: 0 });
    const before = M.measure(S, 4).gain;
    M.train(S, 120);
    const after = M.measure(S, 4).gain;
    console.log("      gain " + fmt(before) + " → " + fmt(after) + " (IO lesioned)");
    check("no adaptation without the climbing fibre", Math.abs(after - before) < 0.08, "Δ=" + fmt(after - before));
  }

  console.log("\n[5] Inferior-olive gap-junction synchrony");
  {
    const uncoupled = M.create({ gGap: 0.0 }); let ru = 0, n = 0;
    const coupled = M.create({ gGap: 2.6 }); let rc = 0;
    for (let k = 0; k < 10000; k++) { M.step(uncoupled); M.step(coupled); if (k > 2000) { ru += uncoupled.ioR; rc += coupled.ioR; n++; } }
    ru /= n; rc /= n;
    console.log("      olivary coherence R: uncoupled=" + fmt(ru) + "  gap-coupled=" + fmt(rc));
    check("gap junctions synchronise the olive", rc > ru + 0.25, "Δ=" + fmt(rc - ru));
  }

  console.log("\n[6] Nucleo-olivary feedback GATES learning (regulates the teaching signal)");
  {
    // DCN → IO is INHIBITORY negative feedback: as the nuclei build their response, it drives
    // the olivary error signal back toward baseline, gating plasticity BEFORE the slip is fully
    // nulled (Bengtsson & Hesslow). The effect is a population-level regulation — small per seed,
    // so we test it as a mean over seeds: without the loop, gain-up runs further.
    let sumWith = 0, sumNo = 0, ns = 8;
    for (let s = 1; s <= ns; s++) {
      const withFb = M.create({ seed: s, demand: 1.6, nucleoOlive: 0.55 }); M.train(withFb, 120);
      const noFb   = M.create({ seed: s, demand: 1.6, nucleoOlive: 0.0 });  M.train(noFb, 120);
      sumWith += M.measure(withFb, 4).gain; sumNo += M.measure(noFb, 4).gain;
    }
    const mWith = sumWith / ns, mNo = sumNo / ns;
    console.log("      mean learned gain (demand 1.6):  with feedback=" + fmt(mWith) + "  without=" + fmt(mNo));
    check("nucleo-olivary feedback gates learning (less complete)", mNo > mWith + 0.03, "Δ=" + fmt(mNo - mWith));
  }

  console.log("\n[7] Savings: re-adaptation after washout is faster");
  {
    const S = M.create({ demand: 1.6 });
    M.train(S, 120); const learned = M.measure(S, 4).gain;
    M.setDemand(S, 1.0); M.train(S, 120); const washed = M.measure(S, 4).gain;   // washout
    M.setDemand(S, 1.6); M.train(S, 30);  const relearn = M.measure(S, 4).gain;  // brief re-train
    console.log("      learned=" + fmt(learned) + "  washed=" + fmt(washed) + "  relearn(30cyc)=" + fmt(relearn));
    check("washes out toward baseline", washed < learned - 0.2, "washed=" + fmt(washed));
    check("re-adapts quickly (savings)", relearn > washed + 0.2, "Δ=" + fmt(relearn - washed));
  }

  console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
  process.exit(fail ? 1 : 0);
}
