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
      betaFloor: 0.30,   // healthy STN coherence floor — only β ABOVE this enslaves the thalamus
      betaThal: 6.0,     // strength of β capture of the thalamocortical loop (antikinetic)

      // projection weights (mean-field transmission)
      wCtxD2: 1.10,      // cortex → striatal D2 (NoGo); D1 is goal-driven, not cortex-driven
      wCtxStn: 1.10,     // cortex → STN (hyperdirect)
      wCtxTh: 0.55,      // cortex → thalamus
      wThCtx: 2.60,      // thalamus → cortex (closes loop)
      wD1Gpi: 1.90,      // D1 ⊣ GPi (focused Go)
      wD2Gpe: 1.00,      // D2 ⊣ GPe
      wGpeStn: 1.30,     // GPe ⊣ STN
      wGpeGpi: 0.95,     // GPe ⊣ GPi
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
      extCtx: 0.05, extGpe: 0.58, extGpi: 0.60, extStn: 0.30, extThal: 0.26,
      extFsi: 0.10, extTrn: 0.20, extMsn: 0.0, extD2: 0.58,

      // dopamine gain on striatum (Go ∝ DA, NoGo ∝ 1−DA)
      daD1: 1.55, daD2base: 0.45, daD2: 1.05,

      // ---- goals / stimuli and corticostriatal learning (the actor) ----
      nGoal: 4,          // external stimuli/goals
      restFluct: 0.22,   // resting cortical fluctuation (plans idle & compete, none escapes)
      goalCtx: 0.16,     // a set goal drives ALL plans as candidates (nonspecific "prepare")
      goalSpec: 0.72,    // learned goal→plan drive to CORTEX (steers which plan wins the WTA)
      goalStr: 2.70,     // goal → striatal-D1 drive, gated by the LEARNED weight W[plan][goal]
      Wmax: 1.6, Winit: 0.20,   // corticostriatal weight range / init (near-uniform ⇒ exploration)
      lr: 0.38,          // dopamine-gated learning rate
      explore: 0.24,     // exploration drive on D1 (lets an unlearned goal try different plans)
      tauExpl: 0.6,      // exploration offsets drift on this timescale (s)
      adaptGain: 0.60,    // cortical spike-frequency adaptation — lets a selection RELEASE / switch
      tauAdapt: 0.6,     // adaptation timescale (s): a plan can hold ~1 s then yields
      degen: 0.0,        // striatal (D2 / indirect-pathway MSN) degeneration → chorea
      choreaDisinh: 0.45, // degen collapses the surround → cortical WTA is overwhelmed (overflow)
      choreaKick: 3.2,    // degen makes a HELD (escaped) plan self-terminate on fatigue → switching
      choreaHold: 0.35,   // fatigue only bites above this adaptation (a plan must ESCAPE first)
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
      // ASSEMBLY pops (cortex, thalamus) carry the selection as SYNCHRONY — their transmission
      // and the loop that closes on them scale with coherence. RELAY pops (D1/D2/GPe/STN/GPi/
      // FSI/TRN) are RATE coders: pallidal gating is a firing-rate/disinhibition code, not a
      // synchrony code (the healthy striatum is decorrelated). The one place relay SYNCHRONY is
      // functional is pathological — the STN⟷GPe β loop — and it is handled explicitly there.
      const assembly = name.startsWith("ctx") || name.startsWith("thal");
      pops[name] = { name, ch, n, cl, type, assembly,
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

    // learned corticostriatal weights W[plan][goal] — near-uniform at birth (⇒ exploration),
    // shaped by dopamine reward into a one goal → one plan mapping.
    const W = [];
    for (let p = 0; p < nCh; p++) { W[p] = new Float64Array(P.nGoal);
      for (let g = 0; g < P.nGoal; g++) W[p][g] = P.Winit + 0.03 * (rnd() - 0.5); }

    const S = {
      P, nCh, rnd, gauss, t: 0, pops,
      sal: new Float64Array(nCh),          // optional manual bias (0 by default)
      goal: new Float64Array(P.nGoal),     // active goal(s)
      W,                                    // corticostriatal associative weights
      adapt: new Float64Array(nCh),        // per-plan spike-frequency adaptation
      expl: new Float64Array(nCh),         // slowly-drifting exploration offsets
      explClock: 0,
      // STN/GPe delay ring buffers (store mean-field out+psi per pop)
      hist: {}, DLEN: Math.max(1, Math.round(P.loopDelay / P.dt)), hp: 0,
      surrSm: 0, betaSm: 0,
    };
    for (let p = 0; p < nCh; p++) S.expl[p] = rnd();
    for (let c = 0; c < nCh; c++) {
      S.hist["stn" + c] = { x: new Float64Array(S.DLEN), y: new Float64Array(S.DLEN) };
      S.hist["gpe" + c] = { x: new Float64Array(S.DLEN), y: new Float64Array(S.DLEN) };
    }
    meanFields(S);
    return S;
  }

  function setSalience(S, arr) { for (let c = 0; c < S.nCh; c++) S.sal[c] = arr[c] || 0; }

  // set the active goal (stimulus). One-hot by default; pass on=false to clear.
  // A fresh goal presentation re-rolls the exploration offsets (a new attempt).
  function setGoal(S, g, on) {
    on = on == null ? true : on;
    for (let k = 0; k < S.P.nGoal; k++) S.goal[k] = 0;
    if (on && g != null && g >= 0) S.goal[g] = 1;
    for (let p = 0; p < S.nCh; p++) S.expl[p] = S.rnd();
  }
  function clearGoals(S) { for (let k = 0; k < S.P.nGoal; k++) S.goal[k] = 0; }

  // compute mean field Z_P = (1/n)Σ a e^{iθ} for every population
  function meanFields(S) {
    for (const k in S.pops) {
      const p = S.pops[k]; let x = 0, y = 0, ax = 0;
      for (const c of p.cl) { x += c.a * Math.cos(c.th); y += c.a * Math.sin(c.th); ax += c.a; }
      x /= p.n; y /= p.n; p.Zx = x; p.Zy = y; p.act = ax / p.n;
      p.mf = Math.hypot(x, y);                   // coherent mean field |Z|
      p.psi = Math.atan2(y, x);
      p.R = p.act > 1e-3 ? p.mf / p.act : 0;     // coherence among active clocks
      // TRANSMISSION IS DUAL-CODED. Assembly pops (cortex/thalamus): activity carries the
      // signal and synchrony AMPLIFIES it — a locked assembly drives its targets harder
      // (commitment), and the thalamocortical loop only closes when coherence is high, so
      // SELECTION IS SYNCHRONY. Relay pops: PURE RATE — pallidal disinhibition is a firing-rate
      // code, and forcing synchrony into it would misrepresent the biology.
      p.out = p.assembly ? p.act * (0.5 + 0.5 * p.R) : p.act;
    }
  }

  const G = S => S.pops;

  /* ---------------- one integration step ---------------- */
  function step(S) {
    const P = S.P, nCh = S.nCh, dt = P.dt, pops = S.pops;
    meanFields(S);
    const DA = P.DA;
    const mD1 = Math.max(0, 1.6 * (DA - 0.12));      // Go gain: hard zero below DA≈0.12 (akinesia)
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
    // Pathological β ENSLAVES THE THALAMUS: a coherent β volley in the pallido-thalamic output
    // entrains the thalamocortical relay and prevents it from forming a stable assembly. This
    // acts DOWNSTREAM of GPi, so even a channel whose D1-Go has withdrawn its GPi clamp cannot
    // select while β is high — this is WHY β is antikinetic (synchrony, not rate). Only β ABOVE
    // a healthy floor bites (health untouched); DBS breaks the coherence → the loop is freed.
    const betaExcess = Math.max(0, S.betaSm - P.betaFloor);
    const betaThalClamp = P.betaThal * betaExcess * (1 - P.dbs);

    // lateral competition uses ACTIVITY (salience-ordered from the outset), plus a
    // coherence term (a locked winner clamps harder). Activity-first makes the winner
    // salience-determined rather than a locking race.
    let ctxSumAct = 0, ctxSumMf = 0;
    for (let c = 0; c < nCh; c++) { ctxSumAct += pops["ctx" + c].act; ctxSumMf += pops["ctx" + c].mf; }

    // a goal (stimulus) drives ALL plans as candidates (nonspecific "prepare to act");
    // the LEARNED weight W[plan][goal] steers which plan's D1 actually escapes.
    let goalSum = 0; for (let g = 0; g < P.nGoal; g++) goalSum += S.goal[g];
    const goalW = new Float64Array(nCh);
    for (let c = 0; c < nCh; c++) { let s = 0; for (let g = 0; g < P.nGoal; g++) s += S.goal[g] * S.W[c][g]; goalW[c] = s; }

    // accumulate phase/activity deltas
    const upd = [];
    for (let c = 0; c < nCh; c++) {
      const CTX = pops["ctx" + c], D1 = pops["d1" + c], D2 = pops["d2" + c],
            GPE = pops["gpe" + c], STN = pops["stn" + c], GPI = pops["gpi" + c],
            TH = pops["thal" + c], TRN = pops["trn" + c], FSI = pops["fsi" + c];

      // ---- excitatory / inhibitory drives ----
      // CORTEX: resting fluctuation + nonspecific goal drive + thalamic loop − lateral
      // competition − spike-frequency ADAPTATION (adaptation lets a selection release/switch).
      // spike-frequency adaptation fatigues a held plan two ways: it drains cortical
      // ACTIVITY (so it releases when the goal is withdrawn) and loosens the assembly
      // COUPLING (so a competing goal can displace the incumbent). No permanent lock.
      // HUNTINGTON / chorea: indirect-pathway (D2 MSN) loss collapses the surround, so the
      // excess disinhibited thalamocortical drive OVERFLOWS cortical competition. Two degen-gated
      // effects (both exactly zero in health): the lateral surround weakens (rivals leak through),
      // and a held plan self-terminates once fatigue accrues (so selection cannot be maintained →
      // continuous involuntary switching). Nothing here is scripted — degen tunes an instability.
      const ctxExc = P.extCtx + P.restFluct + S.sal[c] + P.goalCtx * goalSum + P.goalSpec * goalW[c]
                     + P.wThCtx * TH.out - P.adaptGain * S.adapt[c]
                     - P.choreaKick * P.degen * Math.max(0, S.adapt[c] - P.choreaHold);
      const ctxInh = (P.wLatA * (ctxSumAct - CTX.act) + P.wLat * (ctxSumMf - CTX.mf))
                     * (1 - P.choreaDisinh * P.degen);   // WTA, weakened by surround loss
      const ctxK = P.ctxKbase + P.ctxKloop * TH.out;
      pushUpd(upd, CTX, ctxExc, ctxInh, [[TH, P.wThCtx]], P, ctxK, S);
      // adaptation builds while this plan is coherent (selected), decays otherwise
      S.adapt[c] += (dt / P.tauAdapt) * (CTX.mf - S.adapt[c]);

      // FSI: driven by cortex, tonically active, gap-junction coherent
      pushUpd(upd, FSI, P.extFsi + P.wCtxFsi * CTX.out, 0, [[CTX, P.wCtxFsi]], P, 0, S);

      // STRIATUM D1 (Go): cortical drive + the LEARNED goal→plan drive + exploration, all
      // DA-gated; minus FSI feed-forward inhibition. This is where the goal selects a plan.
      // D1 (Go) is driven PURELY by the learned goal→plan weight (corticostriatal), DA-gated
      // + exploration. It carries no drive from the plan's own cortex, so a plan releases the
      // moment its goal is withdrawn (GPi re-clamps) — the key to switching without getting stuck.
      const d1goal = P.goalStr * goalW[c] + P.explore * (goalSum > 0.05 ? S.expl[c] : 0);
      pushUpd(upd, D1, mD1 * d1goal, P.wFsiMsn * FSI.act, [], P, null, S);
      // D2 (NoGo / indirect): tonic + cortical, scaled by (1−degen). Losing indirect-pathway
      // MSNs (degen) removes this tonic brake → disinhibition → chorea.
      const d2gain = (1 - P.degen);
      pushUpd(upd, D2, d2gain * (P.extD2 + P.wCtxD2 * mD2 * CTX.out),
              P.wFsiMsn * FSI.act, [[CTX, P.wCtxD2 * mD2 * d2gain]], P, null, S);

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

      // THALAMUS: cortex drive − GPi clamp − TRN − β enslavement; assembly self-coupling
      // (synchronises when released). betaThalClamp is the pathological β capturing the loop.
      pushUpd(upd, TH, P.extThal + P.wCtxTh * CTX.out,
              P.wGpiTh * GPI.act + P.wTrnTh * TRN.act + betaThalClamp,
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

  // dopamine-gated corticostriatal learning: reward strengthens the association between
  // the ACTIVE goal(s) and the currently-selected plan, and mildly weakens its rivals for
  // that goal — so each goal converges onto one plan (three-factor / actor rule).
  function reinforceGoal(S, reward, rate) {
    const P = S.P; rate = rate == null ? P.lr : rate;
    const sel = selected(S); if (sel < 0) return;
    for (let g = 0; g < P.nGoal; g++) {
      if (S.goal[g] < 0.05) continue;
      const elig = S.pops["d1" + sel].act;            // eligibility ∝ the winner's D1 firing
      S.W[sel][g] = clamp(S.W[sel][g] + rate * reward * elig * (P.Wmax - S.W[sel][g]), 0, P.Wmax);
      for (let p = 0; p < S.nCh; p++) if (p !== sel)
        S.W[p][g] = clamp(S.W[p][g] - 0.5 * rate * reward * S.W[p][g], 0, P.Wmax);
    }
  }
  // back-compat shim (old single-channel API)
  function reinforce(S, ch, reward, rate) { reinforceGoal(S, reward, rate); }

  return { create, defaults, step, run, meanFields, setSalience, setGoal, clearGoals,
           selected, ctxR, ctxOut, betaCoh, reinforce, reinforceGoal, mulberry32, TAU };
});

/* ============================ headless tests ============================ */
if (typeof require !== "undefined" && require.main === module) {
  const M = module.exports;
  const fmt = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
  let pass = 0, fail = 0;
  const check = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                                : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
  const outs = S => "[" + [0,1,2,3].map(c => fmt(M.ctxOut(S,c))).join(" ") + "]";
  const distinctSel = (S, secs) => { const seen=new Set(); const n=Math.round(secs/S.P.dt);
    for(let k=0;k<n;k++){M.step(S); if(k%40===0){const s=M.selected(S); if(s>=0)seen.add(s);}} return seen; };
  // train a goal by presenting it and rewarding whatever gets selected, repeatedly
  function trainGoal(S, g, trials){
    let last=-1;
    for(let t=0;t<trials;t++){
      M.setGoal(S,g); M.run(S,0.9);
      const sel=M.selected(S); if(sel>=0){ M.reinforceGoal(S,1.0); last=sel; }
      M.clearGoals(S); M.run(S,0.4);
    }
    return last;
  }

  console.log("\n[1] Rest (goal off): plans fluctuate, none escapes the cortex");
  {
    const S = M.create({ DA:0.6 });
    M.run(S, 1.5);
    console.log("      ctx mf=" + outs(S) + "  selected=" + M.selected(S));
    check("nothing selected at rest", M.selected(S) === -1, "sel=" + M.selected(S));
  }

  console.log("\n[2] A learned goal selects its associated plan");
  {
    const S = M.create({ DA:0.6 });
    S.W[2][0] = S.P.Wmax; for(let p=0;p<4;p++) if(p!==2) S.W[p][0]=0.1;   // goal0 → plan2
    M.setGoal(S,0); M.run(S,1.2);
    console.log("      ctx mf=" + outs(S) + "  selected=" + M.selected(S));
    check("goal 0 selects its plan (2)", M.selected(S) === 2, "sel=" + M.selected(S));
    check("winner is coherent", M.ctxR(S,2) > 0.8, "R=" + fmt(M.ctxR(S,2)));
  }

  console.log("\n[3] Learning: reward shapes a stable goal→plan association");
  {
    const S = M.create({ DA:0.6 });
    const learned = trainGoal(S, 0, 7);
    // present goal 0 twice more and check it consistently evokes the same plan
    M.setGoal(S,0); M.run(S,1.0); const a=M.selected(S);
    M.clearGoals(S); M.run(S,0.4);
    M.setGoal(S,0); M.run(S,1.0); const b=M.selected(S);
    const Wg = [0,1,2,3].map(p=>S.W[p][0]);
    console.log("      learned plan≈" + learned + "  recall=" + a + "," + b + "  W[·][0]=[" + Wg.map(x=>fmt(x)).join(" ") + "]");
    check("goal 0 evokes a consistent plan", a >= 0 && a === b, "a=" + a + " b=" + b);
    check("its corticostriatal weight dominates", Math.max(...Wg) > 2.2 * (Wg.reduce((s,x)=>s+x,0)-Math.max(...Wg))/3 + 0.01, "W=[" + Wg.map(x=>fmt(x)).join(" ") + "]");
  }

  console.log("\n[4] Release: removing the goal releases the selection (not stuck)");
  {
    const S = M.create({ DA:0.6 });
    S.W[1][0]=S.P.Wmax; M.setGoal(S,0); M.run(S,1.2);
    const during = M.selected(S);
    M.clearGoals(S); M.run(S,1.6);
    const after = M.selected(S);
    console.log("      during=" + during + "  after goal off=" + after);
    check("selected while goal present", during === 1, "sel=" + during);
    check("released after goal removed", after === -1, "sel=" + after);
  }

  console.log("\n[5] Switching goals switches the plan — no dopamine change needed");
  {
    const S = M.create({ DA:0.6 });
    S.W[0][0]=S.P.Wmax; S.W[3][1]=S.P.Wmax;                    // goal0→plan0, goal1→plan3
    M.setGoal(S,0); M.run(S,1.2); const s0=M.selected(S);
    M.setGoal(S,1); M.run(S,1.6); const s1=M.selected(S);
    console.log("      goal0→" + s0 + "   then goal1→" + s1);
    check("goal 0 → plan 0", s0 === 0, "sel=" + s0);
    check("goal 1 → plan 3 (switched)", s1 === 3, "sel=" + s1);
  }

  console.log("\n[6] Hypodopaminergic: a goal cannot be tagged — hypokinesia/rigidity");
  {
    const S = M.create({ DA:0.05 });
    S.W[2][0]=S.P.Wmax; M.setGoal(S,0); M.run(S,1.5);
    console.log("      ctx mf=" + outs(S) + "  selected=" + M.selected(S));
    check("no plan can be selected (akinesia)", M.selected(S) === -1, "sel=" + M.selected(S));
  }

  console.log("\n[7] Striatal (D2/indirect) degeneration → erratic selection (chorea)");
  {
    const S = M.create({ DA:0.6, degen:0.9 });
    const seen = distinctSel(S, 4.0);     // no goal set — plans escape involuntarily
    console.log("      distinct plans that escaped at rest = " + seen.size + " {" + [...seen].join(",") + "}");
    check("multiple plans escape involuntarily (chorea)", seen.size >= 2, "n=" + seen.size);
    // healthy control: rest should stay quiet
    const H = M.create({ DA:0.6, degen:0 });
    const seenH = distinctSel(H, 4.0);
    check("healthy rest stays quiet", seenH.size === 0, "n=" + seenH.size);
  }

  console.log("\n[8] β hypersynchrony (low DA) and STN-DBS rescue");
  {
    const H = M.create({ DA:0.6 }); S_setGoalLearned(H,2,0); M.run(H,1.8); const bH=M.betaCoh(H);
    const Plo = M.create({ DA:0.05 }); S_setGoalLearned(Plo,2,0); M.run(Plo,1.8); const bP=M.betaCoh(Plo);
    console.log("      STN β: healthy=" + fmt(bH) + "  parkinsonian=" + fmt(bP));
    check("β higher when DA is low", bP > bH + 0.25, "Δ=" + fmt(bP-bH));
    // moderate PD: β ENSLAVES the thalamocortical loop → akinetic even with the goal tagged;
    // DBS breaks the β coherence and restores selection (it does NOT replace dopamine).
    const Poff = M.create({ DA:0.25 }); S_setGoalLearned(Poff,2,0); M.run(Poff,2.2);
    const D = M.create({ DA:0.25, dbs:0.85 }); S_setGoalLearned(D,2,0); M.run(D,2.2);
    console.log("      moderate PD  untreated sel=" + M.selected(Poff) + " (β=" + fmt(M.betaCoh(Poff))
                + ")   +DBS sel=" + M.selected(D) + " (β=" + fmt(M.betaCoh(D)) + ")");
    check("untreated moderate PD is akinetic (β blocks selection)", M.selected(Poff) === -1, "sel=" + M.selected(Poff));
    check("STN-DBS restores selection (β desync, not DA)", M.selected(D) === 2, "sel=" + M.selected(D));
  }
  function S_setGoalLearned(S, plan, goal){ S.W[plan][goal]=S.P.Wmax; for(let p=0;p<4;p++) if(p!==plan) S.W[p][goal]=0.1; M.setGoal(S,goal); }

  console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
  process.exit(fail ? 1 : 0);
}
