"use strict";
/* =====================================================================
   Basal Ganglia — action selection as an EMERGENT SYNCHRONY phenomenon.

   Every neuron is a clock (phase θ + activity a). A population transmits its
   mean field  Z_P = (1/n) Σ aⱼ e^{iθⱼ}  — so an incoherent or silent population
   sends nothing: SYNCHRONY GATES TRANSMISSION. Selection is not a firing-rate
   winner; it is which cortical channel's cortico-striato-pallido-thalamo-cortical
   loop LOCKS INTO A COHERENT ASSEMBLY.

   Mechanism (all of it expressed in synchrony/activity of clock populations):
     - GPi/SNr is tonically active and its GABA output DESYNCHRONISES + silences
       its thalamic sector — a jammed thalamus cannot reinforce cortex.
     - D1 "Go" (gain ∝ dopamine) inhibits GPi → withdraws the clamp → that
       thalamus synchronises → drives cortex → the cortical assembly locks in
       (the cortico-thalamo-cortical positive-feedback loop). = SELECTED.
     - STN (hyperdirect + STN→GPi diffuse) raises GPi output on the OTHER
       channels → keeps their thalamus jammed = on-surround No-Go.
     - Striatal fast-spiking interneurons (gap-junction-coupled → their own
       coherent fast clock) deliver feed-forward inhibition to all MSNs: the
       real substrate of corticostriatal competition (winner-take-all).
     - The thalamic reticular nucleus (TRN) is the inhibitory shell shaping the
       thalamocortical loop.
     - The reciprocal STN⟷GPe loop (β-band clocks + conduction delay) locks into
       β-band HYPERSYNCHRONY at the low-dopamine operating point; that coherent
       β output clamps thalamus and jams selection (parkinsonism). DBS injects
       desynchronising input to STN → breaks the β coherence → rescues.

   Single source of truth: runs headless (`node models/basal-ganglia.js test`)
   and inlines into the app. Timescales are real (theta loop ~6 Hz, β ~20 Hz);
   selection unfolds over a few hundred ms.
   ===================================================================== */

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.BasalGanglia = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
      nCh: 4,            // competing motor programs
      DA: 0.6,           // dopamine (0 parkinsonian … 1 hyperdopaminergic)
      dbs: 0,            // STN-DBS desynchronising drive (0..1)
      dt: 0.0005,        // s (0.5 ms) — β needs sub-ms-ish resolution
      seed: 7,

      // population sizes (clocks)
      nCtx: 8, nMsn: 6, nGpe: 12, nStn: 14, nGpi: 5, nThal: 6, nFsi: 5, nTrn: 5,

      // intrinsic rhythms (Hz)
      fCtx: 6.0, fMsn: 6.0, fThal: 6.0, fTrn: 6.0,   // theta loop
      fGpe: 20.0, fStn: 20.0, fGpi: 20.0, fFsi: 40.0, // fast (β / γ)
      sigmaF: 0.015,     // relative rate spread (assembly pops: cortex/thalamus/striatum)
      sigmaFfast: 0.09,  // spread for relay pops (STN/GPe/…): incoherent unless the β loop locks them

      // activity (rate) dynamics
      tauA: 0.020,       // activity time constant (s)
      tauAfast: 0.008,   // GPe/STN/FSI activity time constant

      // within-population assembly coupling (synchrony formation)
      Kself: 6.5,        // pulls a population's clocks together ∝ its own coherence
      ctxKbase: 0.0,     // cortex CANNOT self-lock — the thalamocortical loop is REQUIRED
                         //   (cortex is only a partly-coherent CANDIDATE without the loop)
      ctxKloop: 15.0,    // extra coupling supplied by thalamic feedback: the loop must close
                         //   for a cortical assembly to LOCK (so the BG genuinely gates selection)
      Ginh: 1.0,         // repulsion cap on runaway coherence (feedback inhibition)
      D: 0.025,          // phase noise
      betaCoup: 16.0,     // STN⟷GPe reciprocal coupling (β synchrony generator)
      loopDelay: 0.010,  // STN⟷GPe conduction delay (s)

      // projection weights (mean-field transmission)
      wCtxMsn: 1.35,     // cortex → striatum (D1/D2)
      wCtxStn: 1.10,     // cortex → STN (hyperdirect)
      wCtxTh: 0.55,      // cortex → thalamus
      wThCtx: 2.60,      // thalamus → cortex (closes loop)
      wD1Gpi: 1.90,      // D1 ⊣ GPi (focused Go)
      wD2Gpe: 1.55,      // D2 ⊣ GPe
      wGpeStn: 1.30,     // GPe ⊣ STN
      wGpeGpi: 0.65,     // GPe ⊣ GPi
      wStnGpi: 1.30,     // STN → GPi diffuse (on-surround)
      wStnGpe: 1.20,     // STN → GPe
      wGpiTh: 1.70,      // GPi ⊣ thalamus (the clamp)
      wFsiMsn: 0.45,     // FSI ⊣ MSN (feed-forward competition)
      wCtxFsi: 1.15,     // cortex → FSI
      wLat: 0.90,        // cortical lateral inhibition on coherence (winner clamps rivals)
      wLatA: 0.90,       // lateral inhibition on ACTIVITY (salience-ordered competition)
      wTrnTh: 0.45,      // TRN ⊣ thalamus
      wThTrn: 1.00,      // thalamus → TRN

      // tonic external drive (sets baseline firing)
      extCtx: 0.05, extGpe: 0.62, extGpi: 0.30, extStn: 0.30, extThal: 0.45,
      extFsi: 0.10, extTrn: 0.20, extMsn: 0.0,

      // dopamine gain on striatum (Go ∝ DA, NoGo ∝ 1−DA)
      daD1: 1.55, daD2base: 0.45, daD2: 1.05,

      // corticostriatal plasticity (actor)
      wStr: null,        // per-channel learned gain (filled at create)
    };
  }

  function create(opts) {
    const P = Object.assign(defaults(), opts || {});
    const rnd = mulberry32(P.seed);
    const nCh = P.nCh;
    const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

    // build populations
    const pops = {};
    function addPop(name, ch, n, fHz, type, fast) {
      const cl = [];
      // each clock has its OWN intrinsic rate (detuning) — so a population only stays
      // coherent when coupling beats the spread; without it, it desynchronises
      for (let i = 0; i < n; i++) cl.push({ th: rnd() * TAU, a: type === "tonic" ? 0.5 : 0.05,
                                            w: TAU * fHz * (1 + (fast ? P.sigmaFfast : P.sigmaF) * gauss()) });
      pops[name] = { name, ch, n, cl, type,
                     Zx: 0, Zy: 0, out: 0, act: 0, R: 0, psi: 0, fast: !!fast };
    }
    const perCh = [
      ["ctx", P.nCtx, P.fCtx, "e", false],
      ["d1", P.nMsn, P.fMsn, "e", false],
      ["d2", P.nMsn, P.fMsn, "e", false],
      ["gpe", P.nGpe, P.fGpe, "tonic", true],
      ["stn", P.nStn, P.fStn, "e", true],
      ["gpi", P.nGpi, P.fGpi, "tonic", true],
      ["thal", P.nThal, P.fThal, "e", false],
      ["trn", P.nTrn, P.fTrn, "tonic", true],
    ];
    for (let c = 0; c < nCh; c++) for (const [nm, n, f, ty, fa] of perCh) addPop(nm + c, c, n, f, ty, fa);
    // FSI: one shared striatal interneuron pool per channel (gap-junction coupled → coherent)
    for (let c = 0; c < nCh; c++) addPop("fsi" + c, c, P.nFsi, P.fFsi, "tonic", true);

    if (!P.wStr) P.wStr = new Float64Array(nCh).fill(1);

    const S = {
      P, nCh, rnd, gauss, t: 0, pops,
      sal: new Float64Array(nCh),
      // STN/GPe delay ring buffers (store mean-field out+psi per pop)
      hist: {}, DLEN: Math.max(1, Math.round(P.loopDelay / P.dt)), hp: 0,
      surrSm: 0, betaSm: 0,
    };
    for (let c = 0; c < nCh; c++) {
      S.hist["stn" + c] = { x: new Float64Array(S.DLEN), y: new Float64Array(S.DLEN) };
      S.hist["gpe" + c] = { x: new Float64Array(S.DLEN), y: new Float64Array(S.DLEN) };
    }
    meanFields(S);
    return S;
  }

  function setSalience(S, arr) { for (let c = 0; c < S.nCh; c++) S.sal[c] = arr[c] || 0; }

  // compute mean field Z_P = (1/n)Σ a e^{iθ} for every population
  function meanFields(S) {
    for (const k in S.pops) {
      const p = S.pops[k]; let x = 0, y = 0, ax = 0;
      for (const c of p.cl) { x += c.a * Math.cos(c.th); y += c.a * Math.sin(c.th); ax += c.a; }
      x /= p.n; y /= p.n; p.Zx = x; p.Zy = y; p.act = ax / p.n;
      p.mf = Math.hypot(x, y);                   // coherent mean field |Z|
      p.psi = Math.atan2(y, x);
      p.R = p.act > 1e-3 ? p.mf / p.act : 0;     // coherence among active clocks
      // transmission: activity carries it, synchrony amplifies (so a locked assembly
      // drives its targets harder → commitment), but sync is not REQUIRED to bootstrap
      p.out = p.act * (0.5 + 0.5 * p.R);
    }
  }

  const G = S => S.pops;

  /* ---------------- one integration step ---------------- */
  function step(S) {
    const P = S.P, nCh = S.nCh, dt = P.dt, pops = S.pops;
    meanFields(S);
    const DA = P.DA;
    const mD1 = P.daD1 * DA;                         // Go gain (through origin)
    const mD2 = P.daD2base + P.daD2 * (1 - DA);      // NoGo gain

    // delayed STN/GPe mean fields (true conduction delay)
    const rd = S.hp;
    const dOut = {}, dPsi = {};
    for (let c = 0; c < nCh; c++) for (const nm of ["stn", "gpe"]) {
      const h = S.hist[nm + c]; const x = h.x[rd], y = h.y[rd];
      dOut[nm + c] = Math.hypot(x, y); dPsi[nm + c] = Math.atan2(y, x);
    }
    // diffuse STN broadcast (on-surround) — rate-coded, attenuated by DBS
    let stnRaw = 0;
    for (let c = 0; c < nCh; c++) stnRaw += pops["stn" + c].act;
    stnRaw /= nCh;
    S.surrSm += (dt / 0.030) * (stnRaw - S.surrSm);   // low-pass: β oscillation must not unclamp
    const stnBroadcast = S.surrSm * (1 - P.dbs);

    // lateral competition uses ACTIVITY (salience-ordered from the outset), plus a
    // coherence term (a locked winner clamps harder). Activity-first makes the winner
    // salience-determined rather than a locking race.
    let ctxSumAct = 0, ctxSumMf = 0;
    for (let c = 0; c < nCh; c++) { ctxSumAct += pops["ctx" + c].act; ctxSumMf += pops["ctx" + c].mf; }

    // accumulate phase/activity deltas
    const upd = [];
    for (let c = 0; c < nCh; c++) {
      const CTX = pops["ctx" + c], D1 = pops["d1" + c], D2 = pops["d2" + c],
            GPE = pops["gpe" + c], STN = pops["stn" + c], GPI = pops["gpi" + c],
            TH = pops["thal" + c], TRN = pops["trn" + c], FSI = pops["fsi" + c];

      // ---- excitatory / inhibitory drives (mean-field magnitudes) ----
      // CORTEX: salience + thalamic drive − lateral competition; assembly self-coupling
      const ctxExc = P.extCtx + S.sal[c] * P.wStr[c] + P.wThCtx * TH.out;
      const ctxInh = P.wLatA * (ctxSumAct - CTX.act) + P.wLat * (ctxSumMf - CTX.mf);   // WTA
      const ctxK = P.ctxKbase + P.ctxKloop * TH.out; // assembly locks only when the loop closes
      pushUpd(upd, CTX, ctxExc, ctxInh, [[TH, P.wThCtx]], P, ctxK, S);

      // FSI: driven by cortex, tonically active, gap-junction coherent
      pushUpd(upd, FSI, P.extFsi + P.wCtxFsi * CTX.out, 0, [[CTX, P.wCtxFsi]], P, 0, S);

      // STRIATUM D1/D2: cortex drive (DA-gated) − FSI feed-forward inhibition
      pushUpd(upd, D1, P.extMsn + P.wCtxMsn * mD1 * CTX.out, P.wFsiMsn * FSI.act, [[CTX, P.wCtxMsn * mD1]], P, null, S);
      pushUpd(upd, D2, P.extMsn + P.wCtxMsn * mD2 * CTX.out, P.wFsiMsn * FSI.act, [[CTX, P.wCtxMsn * mD2]], P, null, S);

      // β loop gain rises as dopamine falls: the STN⟷GPe loop crosses into coherent
      // β-band hypersynchrony only in the parkinsonian regime.
      const betaK = P.betaCoup * Math.max(0, (1 - DA) - 0.40) * 2.4;
      // GPe: activity = tonic + STN − D2; β PHASE coupling to the DELAYED STN mean field
      pushUpdBeta(upd, GPE, P.extGpe + P.wStnGpe * STN.act, P.wD2Gpe * D2.act,
                  dPsi["stn" + c], betaK, P, 0, S);
      // STN: activity = tonic + cortex(hyperdirect) − GPe; β PHASE coupling to DELAYED GPe
      pushUpdBeta(upd, STN, P.extStn + P.wCtxStn * CTX.out, P.wGpeStn * GPE.act,
                  dPsi["gpe" + c], betaK, P, P.dbs, S);

      // GPi: tonic + STN surround − D1 − GPe   (output that clamps thalamus) — relay, no self-sync
      pushUpd(upd, GPI, P.extGpi + P.wStnGpi * stnBroadcast, P.wD1Gpi * D1.act + P.wGpeGpi * GPE.act,
              [], P, 0, S);

      // TRN: thalamic drive, tonic — relay
      pushUpd(upd, TRN, P.extTrn + P.wThTrn * TH.act, 0, [[TH, P.wThTrn]], P, 0, S);

      // THALAMUS: cortex drive − GPi clamp − TRN; assembly self-coupling (synchronises when released)
      pushUpd(upd, TH, P.extThal + P.wCtxTh * CTX.out, P.wGpiTh * GPI.act + P.wTrnTh * TRN.act,
              [[CTX, P.wCtxTh]], P, null, S);
    }

    // apply updates
    for (const u of upd) {
      const p = u.pop;
      const tauA = p.fast ? P.tauAfast : P.tauA;
      for (let i = 0; i < p.n; i++) {
        const cl = p.cl[i];
        cl.a = clamp(cl.a + dt / tauA * (u.aTarget - cl.a), 0, 1);
        cl.th = (cl.th + u.dth[i] + TAU) % TAU;
      }
    }

    // write STN/GPe mean fields into delay lines
    meanFields(S);
    for (let c = 0; c < nCh; c++) for (const nm of ["stn", "gpe"]) {
      const p = pops[nm + c], h = S.hist[nm + c];
      h.x[rd] = p.Zx; h.y[rd] = p.Zy;
    }
    // running (time-averaged) STN β coherence — instantaneous R of a finite pop is noisy
    { let sc = 0, sa = 0; for (let c = 0; c < nCh; c++) { const p = pops["stn" + c]; sc += p.act * p.R; sa += p.act; }
      const inst = sa > 1e-3 ? sc / sa : 0; S.betaSm += (dt / 0.12) * (inst - S.betaSm); }
    S.hp = (rd + 1) % S.DLEN;
    S.t += dt;
  }

  // generic population update: excitatory drive builds activity, inhibition suppresses it;
  // active clocks synchronise via own coherence (assembly) + excitatory afferents; a global
  // repulsion caps runaway coherence; inhibition also adds phase desynchronisation.
  function pushUpd(upd, p, exc, inh, excProj, P, selfK, S) {
    const aTarget = clamp(exc - inh, 0, 1.3);
    const dt = P.dt;
    const dth = new Float64Array(p.n);
    const Kself = (selfK == null ? P.Kself : selfK) * p.out;   // assembly pull ∝ own coherence
    const desync = P.Ginh * p.out + 1.4 * inh;     // repulsion: feedback-inhibition + afferent GABA
    for (let i = 0; i < p.n; i++) {
      const cl = p.cl[i]; let d = cl.w;
      d += Kself * Math.sin(p.psi - cl.th);
      for (const [q, w] of excProj) d += w * q.out * Math.sin(q.psi - cl.th);
      d += desync * Math.sin(cl.th - p.psi);        // repulsion: push AWAY from own mean (desynchronise)
      dth[i] = d * dt + Math.sqrt(2 * P.D * dt) * S.gauss();
    }
    upd.push({ pop: p, aTarget, dth });
  }
  // β-loop populations: reciprocal delayed coupling to their partner can lock them into
  // coherent β; DBS adds desynchronising jitter.
  function pushUpdBeta(upd, p, exc, inh, partnerPsi, betaK, P, dbs, S) {
    const aTarget = clamp(exc - inh, 0, 1.3);
    const dt = P.dt; dbs = dbs || 0;
    const dth = new Float64Array(p.n);
    const beta = betaK;                              // DA-gated reciprocal coupling (β generator)
    const desync = P.Ginh * 0.6 * p.out + dbs * 9.0; // DBS strongly desynchronises
    // NB: no self-assembly coupling here — STN/GPe are relays, their synchrony comes
    // ONLY from the DA-gated reciprocal loop, so β is specific to the low-dopamine state.
    for (let i = 0; i < p.n; i++) {
      const cl = p.cl[i]; let d = cl.w;
      d += beta * Math.sin(partnerPsi - cl.th);      // entrain to delayed partner → β lock
      d += desync * Math.sin(cl.th - p.psi);
      dth[i] = d * dt + Math.sqrt(2 * P.D * dt) * S.gauss();
    }
    upd.push({ pop: p, aTarget, dth });
  }

  function run(S, seconds) { const n = Math.round(seconds / S.P.dt); for (let k = 0; k < n; k++) step(S); }

  // observables. Selection lives in the COHERENT MEAN FIELD mf = act·R: a channel is
  // selected only when its cortical assembly is both active AND locked (synchronised).
  const ctxR = (S, c) => S.pops["ctx" + c].R;
  const ctxOut = (S, c) => S.pops["ctx" + c].mf;
  function selected(S, thr) {
    thr = thr == null ? 0.45 : thr;
    let best = -1, bv = thr;
    for (let c = 0; c < S.nCh; c++) { const o = S.pops["ctx" + c].mf; if (o > bv) { bv = o; best = c; } }
    return best;
  }
  // β coherence in STN, ACTIVITY-WEIGHTED (only active STN populations count)
  function betaCoh(S) { return S.betaSm; }

  function reinforce(S, ch, reward, rate) {
    rate = rate == null ? 0.06 : rate;
    S.P.wStr[ch] = clamp(S.P.wStr[ch] + rate * reward * S.pops["d1" + ch].out, 0.3, 2.2);
  }

  return { create, defaults, step, run, meanFields, setSalience, selected, ctxR, ctxOut, betaCoh, reinforce, mulberry32, TAU };
});

/* ============================ headless tests ============================ */
if (typeof require !== "undefined" && require.main === module) {
  const M = module.exports;
  const fmt = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
  let pass = 0, fail = 0;
  const check = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                                : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
  const outs = S => "[" + [0, 1, 2, 3].map(c => fmt(M.ctxOut(S, c))).join(" ") + "]";

  console.log("\n[1] Healthy dopamine: exactly one cortical assembly synchronises");
  {
    const S = M.create({ DA: 0.6 });
    M.setSalience(S, [0.9, 0.6, 0.5, 0.4]);
    M.run(S, 1.2);
    console.log("      ctx out=" + outs(S) + "  sel=" + M.selected(S));
    check("channel 0 selected", M.selected(S) === 0, "sel=" + M.selected(S));
    check("winner coherent+active", M.ctxOut(S, 0) > 0.55 && M.ctxR(S, 0) > 0.75, "out=" + fmt(M.ctxOut(S,0)) + " R=" + fmt(M.ctxR(S,0)));
    check("others not selected", [1,2,3].every(c => M.ctxOut(S,c) < 0.35), "outs=" + outs(S));
  }

  console.log("\n[2] Winner-take-all with two near-equal competitors");
  {
    const S = M.create({ DA: 0.6 });
    M.setSalience(S, [0.82, 0.80, 0.4, 0.3]);
    M.run(S, 1.4);
    const n = [0,1,2,3].filter(c => M.ctxOut(S,c) > 0.55).length;
    console.log("      ctx out=" + outs(S) + "  #selected=" + n);
    check("exactly one selected", n === 1, "#=" + n);
  }

  console.log("\n[3] Parkinsonian (low DA): akinesia — nothing synchronises");
  {
    const S = M.create({ DA: 0.05 });
    M.setSalience(S, [0.9, 0.6, 0.5, 0.4]);
    M.run(S, 1.2);
    console.log("      ctx out=" + outs(S) + "  sel=" + M.selected(S) + "  βcoh=" + fmt(M.betaCoh(S)));
    check("no channel selected (akinesia)", M.selected(S) === -1, "sel=" + M.selected(S));
  }

  console.log("\n[4] β hypersynchrony in STN grows when dopamine is low");
  {
    // let selection settle first, THEN average β (a healthy transient during bootstrap
    // is not the steady state)
    const H = M.create({ DA: 0.6 }); M.setSalience(H, [0.9,0.6,0.5,0.4]); M.run(H, 1.8);
    const Plo = M.create({ DA: 0.05 }); M.setSalience(Plo, [0.9,0.6,0.5,0.4]); M.run(Plo, 1.8);
    const bH = M.betaCoh(H), bP = M.betaCoh(Plo);
    console.log("      STN coherence: healthy=" + fmt(bH) + "  parkinsonian=" + fmt(bP));
    check("STN β coherence higher when DA low", bP > bH + 0.25, "Δ=" + fmt(bP - bH));
  }

  console.log("\n[5] STN-DBS desynchronises the loop and rescues selection");
  {
    const S = M.create({ DA: 0.05, dbs: 0.8 });
    M.setSalience(S, [0.9, 0.6, 0.5, 0.4]);
    M.run(S, 1.6);
    console.log("      ctx out=" + outs(S) + "  sel=" + M.selected(S) + "  βcoh=" + fmt(M.betaCoh(S)));
    check("selection restored by DBS", M.selected(S) === 0, "sel=" + M.selected(S));
  }

  console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
  process.exit(fail ? 1 : 0);
}
