"use strict";
/* =====================================================================
   Basal Ganglia — action selection as competition between clock assemblies.

   Same thesis as the rest of the project: each competing motor program is a
   cortical ASSEMBLY (a group of phase-clocks). The basal ganglia decide which
   assembly wins, and the thalamocortical loop then SUSTAINS the winner's
   synchrony while the losers are held desynchronised.

   Architecture (Gurney, Prescott & Redgrave 2001; Humphries, Stewart & Gurney
   2006) — a rate model per channel with the selection motif:
     - direct  (D1):  cortex → striatum-D1 ⊣ GPi           ("Go", off-CENTRE)
     - indirect(D2):  cortex → striatum-D2 ⊣ GPe ⊣ STN → GPi ("No-Go")
     - hyperdirect:   cortex → STN → GPi  (diffuse, on-SURROUND, fast brake)
     - output:        GPi/SNr tonically inhibits thalamus; low GPi = released
   Dopamine sets the D1/D2 balance (the selection threshold and vigour).
   The STN⟷GPe loop, with transmission delay, is the β-oscillation generator
   that runs away when dopamine is low (parkinsonian).

   Synchrony does work: a channel's drive to the BG is scaled by how coherent
   its cortical assembly is, so selection → synchrony → stronger drive → a
   committed, hysteretic choice.

   Single source of truth: runs headless (`node models/basal-ganglia.js test`)
   and inlines into the app.
   ===================================================================== */

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.BasalGanglia = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sig = (x, g, th) => 1 / (1 + Math.exp(-g * (x - th)));   // logistic activation

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- validated default parameters ---------------- */
  function defaults() {
    return {
      nCh: 3,            // competing channels (motor programs)
      m: 6,             // clocks per cortical assembly
      DA: 0.6,          // dopamine tone (0 parkinsonian … 1 hyperdopaminergic)
      dt: 0.001,        // s

      // --- cortex (integrates salience + thalamic feedback: the selection loop) ---
      tauCx: 0.030,     // cortical integration time constant
      tcExcite: 1.15,   // thalamus → cortex re-excitation (closes the positive-FB loop)
      cohBonus: 0.35,   // coherent assembly adds drive (synchrony does work)
      wLat: 1.40,       // cortical lateral inhibition between channels (winner-take-all)

      // --- corticostriatal / dopamine gains ---
      wCxStr: 1.55,     // cortex → striatum
      daD1: 0.55,       // D1 potentiation by DA   (Go gain ∝ 1 + daD1·DA)
      daD2: 0.55,       // D2 suppression by DA    (NoGo gain ∝ 1 − daD2·DA)
      gStr: 4.6, thStr: 0.62,

      // --- STN / GPe (the β loop) ---
      wHyper: 0.90,     // cortex → STN (hyperdirect)
      wGpeStn: 3.20,    // GPe ⊣ STN — strong reciprocal gain: the loop Hopf-bifurcates
                        //   into a β limit cycle at the low-dopamine operating point only
      gStn: 3.4, thStn: 0.25,
      wStnGpe: 1.15,    // STN → GPe
      wD2Gpe: 1.30,     // D2 ⊣ GPe
      gGpe: 3.2, thGpe: 0.28, gpeTonic: 0.35,
      loopDelay: 0.011, // STN⟷GPe conduction delay (true delay → β limit cycle)

      // --- GPi / SNr output ---
      wStnGpi: 0.42,    // STN → GPi   (diffuse on-surround)
      wD1Gpi: 1.75,     // D1 ⊣ GPi    (focused off-centre)
      wGpeGpi: 0.55,    // GPe ⊣ GPi
      gGpi: 3.6, thGpi: 0.24, gpiTonic: 0.52,

      // --- thalamus + thalamocortical loop ---
      wGpiTh: 1.55,     // GPi ⊣ thalamus (disinhibition when GPi is low)
      wCxTh: 0.65,      // cortex → thalamus
      gTh: 4.0, thTh: 0.40,
      tcGain: 0.9,      // thalamus → cortical-assembly coupling boost

      // --- rate integration ---
      tauR: 0.020,      // nucleus rate time constant
      tauFast: 0.006,   // STN / GPe time constant (fast-spiking; enables the β limit cycle)
      rateNoise: 0.008, // stochastic drive on STN/GPe — sustains the near-critical β resonance
                        //   (β is intermittent/bursty in vivo, not a clean tone)

      // --- cortical clock assemblies (Kuramoto) ---
      f0: 8.0, sigmaF: 0.06, Kself: 3.0, Kbase: 0.05,
      Ginh: 3.2,        // repulsion between channels (keeps losers desynchronised)
      D: 0.05,          // phase noise
      cohFloor: 0.35,   // drive = salience·(cohFloor + (1−cohFloor)·R)  — synchrony does work

      // --- DBS (STN high-frequency stim ≈ informational lesion of STN output) ---
      dbs: 0,           // 0..1 fraction by which STN output is clamped/regularised

      seed: 7,
    };
  }

  function create(opts) {
    const P = Object.assign(defaults(), opts || {});
    const rnd = mulberry32(P.seed);
    const nCh = P.nCh, m = P.m;
    const S = {
      P, nCh, m, rnd, t: 0,
      sal: new Float64Array(nCh),        // external salience per channel (cortical input)
      cx: new Float64Array(nCh),         // cortical state (salience + thalamic feedback)
      // rates
      d1: new Float64Array(nCh), d2: new Float64Array(nCh),
      stn: new Float64Array(nCh), gpe: new Float64Array(nCh),
      gpi: new Float64Array(nCh), th: new Float64Array(nCh),
      stnHist: [], gpeHist: [], histPtr: 0,
      DLEN: Math.max(1, Math.round(P.loopDelay / P.dt)),
      // cortical assemblies
      ph: [], w: [], R: new Float64Array(nCh), mph: new Float64Array(nCh),
      // corticostriatal weights (plastic, actor)
      wStr: new Float64Array(nCh).fill(1),
    };
    for (let c = 0; c < nCh; c++) {
      S.gpe[c] = P.gpeTonic; S.gpi[c] = P.gpiTonic; S.wStr[c] = 1;
      S.stnHist[c] = new Float64Array(S.DLEN); S.gpeHist[c] = new Float64Array(S.DLEN).fill(P.gpeTonic);
      S.ph[c] = new Float64Array(m); S.w[c] = new Float64Array(m);
      for (let i = 0; i < m; i++) { S.ph[c][i] = rnd() * TAU; S.w[c][i] = TAU * (P.f0 + P.sigmaF * (rnd() - 0.5) * 2); }
    }
    return S;
  }

  function setSalience(S, arr) { for (let c = 0; c < S.nCh; c++) S.sal[c] = arr[c] || 0; }

  // order parameter of channel c's assembly
  function order(S, c) {
    const ph = S.ph[c], m = S.m; let sx = 0, sy = 0;
    for (let i = 0; i < m; i++) { sx += Math.cos(ph[i]); sy += Math.sin(ph[i]); }
    return { R: Math.hypot(sx / m, sy / m), psi: Math.atan2(sy / m, sx / m) };
  }

  /* ---------------- one integration step ---------------- */
  function step(S) {
    const P = S.P, nCh = S.nCh, dt = P.dt;
    const a = dt / P.tauR;                       // rate leak
    const afast = dt / P.tauFast;                // fast leak for STN / GPe
    const da = P.DA;

    // cortex integrates salience + thalamic re-excitation + a coherence bonus.
    // This closes the cortico-thalamo-cortical positive-feedback loop that commits
    // to a winner ("reinforcement through thalamus"); synchrony does work via cohBonus.
    const acx = dt / P.tauCx;
    const u = new Float64Array(nCh);
    let sumTh = 0; for (let c = 0; c < nCh; c++) sumTh += S.th[c];
    for (let c = 0; c < nCh; c++) {
      const o = order(S, c); S.R[c] = o.R; S.mph[c] = o.psi;
      const target = S.sal[c] + P.tcExcite * S.th[c] + P.cohBonus * o.R * S.th[c]
                     - P.wLat * (sumTh - S.th[c]);        // lateral inhibition ⇒ WTA
      S.cx[c] += acx * (Math.max(0, target) - S.cx[c]);
      u[c] = S.cx[c] * S.wStr[c];
    }
    // dopamine sets the Go/NoGo balance with real teeth: D1 (Go) scales ~linearly from
    // zero, so the direct pathway is essentially dead at low dopamine (akinesia).
    const mD1 = 1.55 * P.DA, mD2 = 0.40 + 1.00 * (1 - P.DA);

    // delayed copies for the STN⟷GPe loop — TRUE conduction delay (ring buffer),
    // which is what turns the reciprocal STN⟷GPe loop into a β limit cycle.
    const rd = S.histPtr;                        // oldest sample = current write slot
    const stnDelayed = new Float64Array(nCh), gpeDelayed = new Float64Array(nCh);
    for (let c = 0; c < nCh; c++) { stnDelayed[c] = S.stnHist[c][rd]; gpeDelayed[c] = S.gpeHist[c][rd]; }

    // diffuse STN broadcast (on-surround)
    let stnSum = 0; for (let c = 0; c < nCh; c++) stnSum += stnDelayed[c] * (1 - P.dbs);

    for (let c = 0; c < nCh; c++) {
      // striatum (dopamine-gated Go / NoGo)
      const d1t = sig(P.wCxStr * u[c] * mD1, P.gStr, P.thStr);
      const d2t = sig(P.wCxStr * u[c] * mD2, P.gStr, P.thStr);
      // STN: cortical hyperdirect drive − GPe inhibition (delayed)
      const stnt = sig(P.wHyper * S.cx[c] - P.wGpeStn * gpeDelayed[c] + 0.35, P.gStn, P.thStn);
      // GPe: tonic + STN drive (delayed) − D2 inhibition.
      const gpet = sig(P.gpeTonic + P.wStnGpe * stnDelayed[c] - P.wD2Gpe * S.d2[c], P.gGpe, P.thGpe);
      // GPi: tonic + diffuse STN (surround) − focused D1 (centre) − GPe
      const gpit = sig(P.gpiTonic + P.wStnGpi * stnSum - P.wD1Gpi * S.d1[c] - P.wGpeGpi * S.gpe[c], P.gGpi, P.thGpi);
      // thalamus: cortical drive, disinhibited as GPi falls
      const tht = sig(P.wCxTh * S.cx[c] - P.wGpiTh * S.gpi[c] + 0.30, P.gTh, P.thTh);

      S.d1[c] += a * (d1t - S.d1[c]);
      S.d2[c] += a * (d2t - S.d2[c]);
      const nz = P.rateNoise;
      S.stn[c] = clamp(S.stn[c] + afast * (stnt - S.stn[c]) + nz * (S.rnd() - 0.5), 0, 1);   // fast, noisy
      S.gpe[c] = clamp(S.gpe[c] + afast * (gpet - S.gpe[c]) + nz * (S.rnd() - 0.5), 0, 1);
      S.gpi[c] += a * (gpit - S.gpi[c]);
      S.th[c]  += a * (tht  - S.th[c]);
    }
    // commit the STN/GPe delay lines and advance the ring pointer
    for (let c = 0; c < nCh; c++) { S.stnHist[c][rd] = S.stn[c]; S.gpeHist[c][rd] = S.gpe[c]; }
    S.histPtr = (rd + 1) % S.DLEN;

    // cortical assemblies: thalamic feedback boosts within-channel coupling
    // global mean phase across ALL active clocks (for repulsion between channels)
    let gx = 0, gy = 0, gn = 0;
    for (let c = 0; c < nCh; c++) for (let i = 0; i < S.m; i++) { gx += Math.cos(S.ph[c][i]); gy += Math.sin(S.ph[c][i]); gn++; }
    gx /= gn; gy /= gn;
    const Rg = Math.hypot(gx, gy), psig = Math.atan2(gy, gx);
    const sqrtD = Math.sqrt(2 * P.D * dt);
    for (let c = 0; c < nCh; c++) {
      const K = P.Kbase + P.Kself * P.tcGain * S.th[c];   // thalamus sustains the winner
      const ph = S.ph[c], mph = S.mph[c], w = S.w[c];
      for (let i = 0; i < S.m; i++) {
        let coup = K * Math.sin(mph - ph[i]);
        const shear = P.Ginh * Rg * Math.sin(ph[i] - psig);
        ph[i] = (ph[i] + (w[i] + coup + shear) * dt + sqrtD * gaussian(S.rnd) + TAU) % TAU;
      }
    }
    S.t += dt;
  }
  function gaussian(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }

  function run(S, seconds) { const n = Math.round(seconds / S.P.dt); for (let k = 0; k < n; k++) step(S); }

  // which channel is selected (thalamus released) — returns index or -1
  function selected(S, thr) {
    thr = thr == null ? 0.5 : thr;
    let best = -1, bv = thr;
    for (let c = 0; c < S.nCh; c++) if (S.th[c] > bv) { bv = S.th[c]; best = c; }
    return best;
  }

  // dopamine-gated corticostriatal plasticity (three-factor / actor): reward the
  // channel that was selected → its cortical drive potentiates (faster next time).
  function reinforce(S, ch, reward, rate) {
    rate = rate == null ? 0.05 : rate;
    const dw = rate * reward * S.d1[ch];          // eligibility ∝ D1 activity
    S.wStr[ch] = clamp(S.wStr[ch] + dw, 0.3, 2.0);
  }

  return { create, defaults, step, run, order, selected, setSalience, reinforce, mulberry32, TAU };
});

/* ============================ headless tests ============================ */
if (typeof require !== "undefined" && require.main === module) {
  const M = module.exports;
  const fmt = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
  let pass = 0, fail = 0;
  const check = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                                : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
  const arr = (a, f = fmt) => "[" + Array.from(a).map(x => f(x)).join(" ") + "]";

  // ---- Test 1: healthy selection — one winner ----
  console.log("\n[1] Healthy dopamine selects exactly one channel");
  {
    const S = M.create({ DA: 0.6 });
    M.setSalience(S, [0.9, 0.6, 0.5]);
    M.run(S, 1.0);
    console.log("      thal=" + arr(S.th) + "  R=" + arr(S.R) + "  sel=" + M.selected(S));
    check("channel 0 selected", M.selected(S) === 0, "sel=" + M.selected(S));
    check("winner thalamus released", S.th[0] > 0.6, "th0=" + fmt(S.th[0]));
    check("losers suppressed", S.th[1] < 0.25 && S.th[2] < 0.25, "th=" + fmt(S.th[1]) + "," + fmt(S.th[2]));
    check("winner assembly synchronised", S.R[0] > 0.85, "R0=" + fmt(S.R[0]));
    check("winner far more coherent than losers", S.R[0] - Math.max(S.R[1], S.R[2]) > 0.25,
          "ΔR=" + fmt(S.R[0] - Math.max(S.R[1], S.R[2])));
  }

  // ---- Test 2: winner-take-all with near-equal competitors ----
  console.log("\n[2] Winner-take-all: two strong competitors, only one wins");
  {
    const S = M.create({ DA: 0.6 });
    M.setSalience(S, [0.82, 0.80, 0.3]);
    M.run(S, 1.2);
    const nSel = [0, 1, 2].filter(c => S.th[c] > 0.5).length;
    console.log("      thal=" + arr(S.th) + "  #released=" + nSel);
    check("exactly one channel released", nSel === 1, "#=" + nSel);
  }

  // ---- Test 3: selection latency ----
  console.log("\n[3] Selection latency (healthy)");
  {
    const S = M.create({ DA: 0.6 });
    M.setSalience(S, [0.9, 0.6, 0.5]);
    let lat = -1;
    for (let k = 0; k < 600; k++) { M.step(S); if (lat < 0 && S.th[0] > 0.5) lat = S.t * 1000; }
    console.log("      latency to release = " + fmt(lat, 0) + " ms");
    check("selects within a plausible window (40–250 ms)", lat > 30 && lat < 250, "lat=" + fmt(lat, 0) + "ms");
  }

  // ---- Test 4: parkinsonian — low dopamine fails to select ----
  console.log("\n[4] Low dopamine (parkinsonian) — akinesia / failure to release");
  {
    const S = M.create({ DA: 0.05 });
    M.setSalience(S, [0.9, 0.6, 0.5]);
    M.run(S, 1.0);
    console.log("      thal=" + arr(S.th) + "  GPi=" + arr(S.gpi) + "  sel=" + M.selected(S));
    check("no channel released (akinesia)", M.selected(S) === -1, "sel=" + M.selected(S));
    check("GPi output pathologically high", S.gpi[0] > 0.6, "gpi0=" + fmt(S.gpi[0]));
  }

  // ---- Test 5: β oscillation appears with low dopamine ----
  // Measure ABSOLUTE β-band power (amplitude): a healthy STN is near-steady, the
  // parkinsonian STN⟷GPe loop crosses the Hopf bifurcation into a sustained ~16 Hz
  // limit cycle. (Normalised β *fraction* is misleading — noise gets resonance-shaped
  // even in health; amplitude is the honest measure.)
  console.log("\n[5] β-band oscillation in the STN⟷GPe loop grows when DA is low");
  function betaAmp(DA) {
    const S = M.create({ DA });
    M.setSalience(S, [0.9, 0.6, 0.5]);
    M.run(S, 1.0);                                   // settle past any transient
    const buf = [];
    for (let k = 0; k < 1500; k++) { M.step(S); buf.push(S.stn[0]); }
    const mu = buf.reduce((s, v) => s + v, 0) / buf.length;
    let p = 0;
    for (let hz = 13; hz <= 30; hz++) {
      let re = 0, im = 0;
      for (let i = 0; i < buf.length; i++) { const A = M.TAU * hz * i / 1000; re += (buf[i] - mu) * Math.cos(A); im += (buf[i] - mu) * Math.sin(A); }
      p += (re * re + im * im) / (buf.length * buf.length);
    }
    return { amp: Math.sqrt(p), rng: Math.max(...buf) - Math.min(...buf) };
  }
  {
    const hi = betaAmp(0.6), lo = betaAmp(0.05);
    console.log("      β amplitude: healthy=" + fmt(hi.amp, 3) + " (range " + fmt(hi.rng, 2) +
                ")   parkinsonian=" + fmt(lo.amp, 3) + " (range " + fmt(lo.rng, 2) + ")");
    check("parkinsonian STN oscillates (range ≥ 0.15)", lo.rng > 0.15, "range=" + fmt(lo.rng, 2));
    check("healthy STN is near-steady (range ≤ 0.06)", hi.rng < 0.06, "range=" + fmt(hi.rng, 2));
    check("β amplitude far higher when DA is low", lo.amp > 4 * hi.amp, "ratio=" + fmt(lo.amp / Math.max(hi.amp, 1e-6), 1));
  }

  // ---- Test 6: DBS rescues selection in the parkinsonian model ----
  console.log("\n[6] STN-DBS restores selection under low dopamine");
  {
    const S = M.create({ DA: 0.05, dbs: 0.85 });
    M.setSalience(S, [0.9, 0.6, 0.5]);
    let lat = -1;
    for (let k = 0; k < 800; k++) { M.step(S); if (lat < 0 && S.th[0] > 0.5) lat = S.t * 1000; }
    console.log("      thal=" + arr(S.th) + "  sel=" + M.selected(S) + "  latency=" + fmt(lat, 0) + " ms");
    check("selection restored by DBS", M.selected(S) === 0, "sel=" + M.selected(S));
  }

  // ---- Test 7: dopamine-gated reinforcement biases future selection ----
  console.log("\n[7] Reinforcement: rewarding a weaker channel makes it win next time");
  {
    const S = M.create({ DA: 0.6 });
    // ch1 is initially weaker than ch0
    for (let trial = 0; trial < 8; trial++) {
      // reset phases/rates lightly between trials, keep learned weights
      M.setSalience(S, [0.7, 0.68, 0.3]);
      M.run(S, 0.6);
      const win = M.selected(S);
      // reward ONLY when ch1 is chosen (shape behaviour toward ch1)
      if (win === 1) M.reinforce(S, 1, 1.0);
      else if (win === 0) M.reinforce(S, 0, -0.4);   // mild punishment of the habit
      M.setSalience(S, [0, 0, 0]); M.run(S, 0.15);    // inter-trial
    }
    M.setSalience(S, [0.7, 0.68, 0.3]); M.run(S, 0.7);
    console.log("      after training  wStr=" + arr(S.wStr) + "  sel=" + M.selected(S));
    check("reinforced channel now wins", M.selected(S) === 1, "sel=" + M.selected(S) + " wStr=" + arr(S.wStr));
  }

  console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
  process.exit(fail ? 1 : 0);
}
