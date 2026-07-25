"use strict";
/* =====================================================================
   Amygdala — Pavlovian THREAT conditioning (auditory fear learning).

   A neutral CS (tone) paired with an aversive US (shock) acquires the power to
   drive a fear response (freezing); a CS− stays safe. Extinction makes the CS
   safe again — but as NEW inhibitory learning, so the original engram persists
   and fear can return (renewal / spontaneous recovery). This is the amygdala's
   analogue of the cerebellum's supervised learning and the basal ganglia's
   reinforcement learning: associative (Hebbian) learning under a teaching (US)
   signal, with an aversive PREDICTION ERROR (Rescorla–Wagner: a predicted US
   teaches nothing → blocking).

   Circuit:
     CS (auditory thalamus/cortex) + US (nociceptive) → LATERAL AMYGDALA (LA):
       the plasticity site — CS–US convergence potentiates thalamo/cortico-LA
       weights (Hebbian, gated by the US prediction error) so the CS comes to
       evoke LA activity = the fear memory.
     LA → CENTRAL AMYGDALA: CeL-on (SOM+) ⊣ CeL-off (PKCδ+) mutual inhibition;
       fear activates CeL-on → suppresses CeL-off → disinhibits CeM.
     CeM → freezing (PAG) / autonomic / HPA — the fear OUTPUT.
     INTERCALATED cells (ITC), driven by infralimbic mPFC (IL), inhibit CeM →
       EXTINCTION (safety learning). Prelimbic mPFC (PL) sustains fear.

   DUAL CODE (as in the basal-ganglia / cerebellum models): the association and
   the CeL/CeM gating are RATE + plastic weights; the functional SYNCHRONY is the
   LA⟷PL THETA COHERENCE (Seidenbecher 2003; Likhtik 2014) — fear raises the
   coupling → coherence → amplified fear transmission (communication-through-
   coherence); safety (IL) lowers it. Every unit is still a clock.

   Single source of truth: `node models/amygdala.js test`.
   ===================================================================== */

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Amygdala = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const relu = v => (v > 0 ? v : 0);
  const sig = v => 1 / (1 + Math.exp(-v));
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
      dt: 0.005,          // s
      seed: 7,
      nCS: 2,             // CS+ (0) and CS− (1)

      // ---- population sizes (clocks) ----
      nLA: 10, nPL: 8, nIL: 8, nITC: 6, nCon: 6, nCoff: 6, nCeM: 6,
      fTheta: 7.0,        // amygdala/mPFC theta (Hz)
      sigmaF: 0.05,       // clock frequency spread
      thetaNoise: 0.12,

      // ---- LA association ----
      wUS: 1.2,           // US drive onto LA (postsynaptic teaching)
      laGain: 3.6,        // gain of CS·w → LA activity (sigmoid)
      laBias: -2.6,       // LA threshold (silent without drive)
      wLAinit: 0.05,      // initial thalamo/cortico-LA weight (near-naive)

      // ---- central amygdala microcircuit ----
      wLAon: 4.5, conBias: 2.3,      // LA → CeL-on (sigmoid threshold)
      coffTonic: 0.75,               // CeL-off tonic activity (the brake)
      wOnOff: 1.7,                   // CeL-on ⊣ CeL-off
      wOffCeM: 1.25,                 // CeL-off ⊣ CeM (the tonic brake, released by fear)
      cemTonic: 0.10, wOnCeM: 1.05,  // CeM baseline + direct CeL-on drive
      wITCeM: 1.4,                   // ITC ⊣ CeM (extinction inhibition)

      // ---- mPFC / extinction ----
      wPLfear: 2.4,       // PL ← LA (fear drive); PL sustains fear
      wILext: 4.0, ilBias: 2.5,      // IL → ITC (safety drive), expressed in the extinction context
      ilGain: 3.0, ilBias0: 3.0,     // extinction weight → IL activity (silent until safety is learned)

      // ---- theta coherence (functional synchrony) ----
      kThetaBase: 0.2,    // baseline LA⟷PL coupling (low → incoherent at rest)
      kThetaFear: 8.0,    // fear-driven extra coupling → coherence
      cohGate: 0.5,       // how much LA→CeM transmission is amplified by coherence

      // ---- learning ----
      lrLA: 0.35,         // Hebbian LA potentiation rate (on the US prediction error)
      predGain: 0.8,      // how strongly the CS-evoked LA prediction cancels the US teaching
      lrExt: 0.5,         // extinction (safety) learning rate
      lrExtDown: 4.0,     // the US unwrites safety (reinforced trials stay fearful)
      extDecay: 0.0,      // extinction memories are context-gated, not erased
      laDecay: 0.0,       // the fear engram does not passively decay (persists)

      // ---- context ----
      ctx: 1.0,           // 1 = extinction context (IL/ITC expressed); <1 = shifted context → renewal
      tau: 0.08,          // activity/observable smoothing (s)
      tauFreeze: 0.28,    // freezing (behavioural) smoothing (s)
    };
  }

  function create(opts) {
    const P = Object.assign(defaults(), opts || {});
    const rnd = mulberry32(P.seed);
    const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    const pops = {};
    const addPop = (name, n) => {
      const cl = [];
      for (let i = 0; i < n; i++) cl.push({ th: rnd() * TAU, w: TAU * P.fTheta * (1 + P.sigmaF * gauss()) });
      pops[name] = { name, n, cl, act: 0, R: 0, psi: 0 };
    };
    addPop("la", P.nLA); addPop("pl", P.nPL); addPop("il", P.nIL); addPop("itc", P.nITC);
    addPop("con", P.nCon); addPop("coff", P.nCoff); addPop("cem", P.nCeM);

    const wLA = new Float64Array(P.nCS), wExt = new Float64Array(P.nCS);
    for (let i = 0; i < P.nCS; i++) wLA[i] = P.wLAinit;

    return {
      P, rnd, gauss, t: 0, pops, wLA, wExt,
      cs: new Float64Array(P.nCS), us: 0,
      la: 0, pl: 0, il: 0, itc: 0, con: 0, coff: 0, cem: 0,
      pred: 0, usErr: 0, coh: 0, freeze: 0,
    };
  }

  // phase coherence of a population (order parameter), and advance its clocks toward a target
  function popStep(S, p, drive, extraCoupleTo, kCouple) {
    const P = S.P, dt = P.dt;
    let sx = 0, sy = 0; for (const c of p.cl) { sx += Math.cos(c.th); sy += Math.sin(c.th); }
    sx /= p.n; sy /= p.n; p.psi = Math.atan2(sy, sx); p.R = Math.hypot(sx, sy);
    p.act += (dt / P.tau) * (drive - p.act);
    const selfK = 1.2 * p.act;                    // active pop self-synchronises a little
    for (const c of p.cl) {
      let d = c.w + selfK * Math.sin(p.psi - c.th);
      if (extraCoupleTo) d += kCouple * Math.sin(extraCoupleTo.psi - c.th);
      c.th = (c.th + dt * d + Math.sqrt(dt) * P.thetaNoise * S.gauss() + TAU) % TAU;
    }
  }

  function step(S) {
    const P = S.P, dt = P.dt;
    // ---- LA: CS association + US teaching ----
    let csW = 0, csAny = 0;
    for (let i = 0; i < P.nCS; i++) { csW += S.cs[i] * S.wLA[i]; csAny += S.cs[i]; }
    S.pred = csW;                                            // aversive prediction from the CS
    const laDrive = sig(P.laGain * (csW + P.wUS * S.us) + P.laBias);
    // ---- theta coherence LA⟷PL: coupling grows with fear drive ----
    const fearDrive = S.la;                                  // current LA fear activity
    const kth = P.kThetaBase + P.kThetaFear * fearDrive;
    popStep(S, S.pops.la, laDrive, S.pops.pl, kth);
    popStep(S, S.pops.pl, sig(P.wPLfear * S.la - 1.0 + 0.3), S.pops.la, kth);
    S.la = S.pops.la.act; S.pl = S.pops.pl.act;
    S.coh = 0.5 * (S.pops.la.R + S.pops.pl.R);              // LA/PL theta coherence (fear signature)
    // coherence AMPLIFIES the LA→central transmission (communication-through-coherence)
    const laOut = S.la * (1 - P.cohGate + P.cohGate * S.coh);

    // ---- infralimbic mPFC + intercalated cells: extinction / safety ----
    // IL activity grows with the CS-specific safety weight, expressed only in the extinction
    // context; IL drives the ITC cells, whose GABA inhibits the CeM output.
    let extW = 0; for (let i = 0; i < P.nCS; i++) extW += S.cs[i] * S.wExt[i];
    const ilDrive = csAny > 0 ? sig(P.ilGain * (P.ctx * extW) - P.ilBias0) : 0;
    popStep(S, S.pops.il, ilDrive);
    popStep(S, S.pops.itc, sig(P.wILext * S.pops.il.act * P.ctx - P.ilBias));
    S.il = S.pops.il.act; S.itc = S.pops.itc.act;

    // ---- central amygdala microcircuit: CeL-on ⊣ CeL-off → CeM ----
    popStep(S, S.pops.con, sig(P.wLAon * laOut - P.conBias));
    S.con = S.pops.con.act;
    popStep(S, S.pops.coff, relu(P.coffTonic - P.wOnOff * S.con));   // fear (CeL-on) suppresses the brake
    S.coff = S.pops.coff.act;
    const cemDrive = relu(P.cemTonic + P.wOnCeM * S.con - P.wOffCeM * S.coff - P.wITCeM * S.itc);
    popStep(S, S.pops.cem, cemDrive);
    S.cem = S.pops.cem.act;
    S.freeze += (dt / P.tauFreeze) * (S.cem - S.freeze);    // behavioural freezing (slow)

    // ---- plasticity ----
    // LA (fear): Hebbian, gated by the US PREDICTION ERROR (predicted US teaches nothing).
    S.usErr = relu(S.us - P.predGain * S.pred);
    for (let i = 0; i < P.nCS; i++) {
      S.wLA[i] = clamp(S.wLA[i] + dt * (P.lrLA * S.cs[i] * S.usErr) - dt * P.laDecay * S.wLA[i], 0, 3);
      // Extinction (safety): CS evokes fear (la high) but NO US arrives → learn CS-specific safety;
      // when the US DOES arrive it proves the CS is not safe and unwrites that safety. So only
      // genuinely non-reinforced (extinction) trials accumulate safety — paired trials keep it low.
      const safetyUp = S.cs[i] * relu(S.la - 0.2) * (1 - S.us);
      const safetyDown = S.cs[i] * S.us * (S.wExt[i] + 0.3);
      S.wExt[i] = clamp(S.wExt[i] + dt * (P.lrExt * safetyUp - P.lrExtDown * safetyDown), 0, 3);
    }
    S.t += dt;
  }

  function run(S, seconds) { const n = Math.round(seconds / S.P.dt); for (let k = 0; k < n; k++) step(S); }

  // ---- trial helpers ----
  function setCS(S, i, on) { for (let k = 0; k < S.P.nCS; k++) S.cs[k] = 0; if (i >= 0) S.cs[i] = on == null ? 1 : on; }
  // present CS i for `dur` s; deliver US in the last `usDur` s if paired
  function trial(S, i, paired, dur, usDur) {
    dur = dur == null ? 2.0 : dur; usDur = usDur == null ? 0.3 : usDur;
    setCS(S, i, 1);
    run(S, dur - usDur);
    if (paired) S.us = 1;
    run(S, usDur);
    S.us = 0; setCS(S, -1);
    run(S, 1.2);                                  // inter-trial interval
  }
  // measure the response to a CS probe with LEARNING FROZEN (i<0 = rest, no CS)
  function probe(S, i, dur) {
    dur = dur == null ? 2.0 : dur;
    const savedLA = S.P.lrLA, savedExt = S.P.lrExt; S.P.lrLA = 0; S.P.lrExt = 0;
    setCS(S, i, 1); run(S, dur);
    const out = { freeze: S.freeze, coh: S.coh, la: S.la, con: S.con, coff: S.coff, cem: S.cem };
    setCS(S, -1); run(S, 0.8);
    S.P.lrLA = savedLA; S.P.lrExt = savedExt;
    return out;
  }

  function acquire(S, trials) { for (let t = 0; t < trials; t++) { trial(S, 0, true); trial(S, 1, false); } }  // CS+ paired, CS− unpaired
  function extinguish(S, trials) { for (let t = 0; t < trials; t++) trial(S, 0, false); }                       // CS+ alone

  return { create, defaults, step, run, setCS, trial, probe, acquire, extinguish, mulberry32, TAU };
});

/* ============================ headless tests ============================ */
if (typeof require !== "undefined" && require.main === module) {
  const M = module.exports;
  const fmt = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
  let pass = 0, fail = 0;
  const check = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                                : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));

  console.log("\n[1] Acquisition + discrimination (CS+ paired, CS− unpaired)");
  {
    const S = M.create({});
    const f0 = M.probe(S, 0).freeze;
    M.acquire(S, 14);
    const fp = M.probe(S, 0).freeze, fm = M.probe(S, 1).freeze;
    console.log("      freezing  CS+ before=" + fmt(f0) + "  after=" + fmt(fp) + "   CS−=" + fmt(fm) + "   wLA=[" + fmt(S.wLA[0]) + "," + fmt(S.wLA[1]) + "]");
    check("CS+ acquires fear", fp > 0.5 && fp > f0 + 0.35, "fp=" + fmt(fp));
    check("CS− stays safe (discrimination)", fm < 0.25, "fm=" + fmt(fm));
  }

  console.log("\n[2] US prediction error — a predicted US stops teaching (saturation/blocking)");
  {
    const S = M.create({});
    const errs = [];
    for (let t = 0; t < 12; t++) { M.setCS(S, 0, 1); M.run(S, 1.7); S.us = 1; M.run(S, 0.3); errs.push(S.usErr); S.us = 0; M.setCS(S, -1); M.run(S, 1.0); }
    console.log("      US teaching error over trials: [" + errs.map(x => fmt(x, 2)).join(" ") + "]");
    check("US error is large early", errs[0] > 0.5, "e0=" + fmt(errs[0]));
    check("US error shrinks as the CS predicts the US", errs[errs.length - 1] < errs[0] - 0.4, "eN=" + fmt(errs[errs.length - 1]));
  }

  console.log("\n[3] CeL-on ⊣ CeL-off → CeM gating during fear");
  {
    const S = M.create({}); M.acquire(S, 14);
    const f = M.probe(S, 0), r = M.probe(S, -1);      // fear CS vs rest, learning frozen
    console.log("      fear CS:  CeL-on=" + fmt(f.con) + " CeL-off=" + fmt(f.coff) + " CeM=" + fmt(f.cem) + "   |  rest: on=" + fmt(r.con) + " off=" + fmt(r.coff) + " CeM=" + fmt(r.cem));
    check("fear activates CeL-on", f.con > r.con + 0.2, "Δon=" + fmt(f.con - r.con));
    check("CeL-on suppresses CeL-off", f.coff < r.coff - 0.1, "off=" + fmt(f.coff));
    check("CeM (output) is released by fear", f.cem > r.cem + 0.2, "Δcem=" + fmt(f.cem - r.cem));
  }

  console.log("\n[4] Extinction — CS+ alone lowers freezing, but the LA engram PERSISTS");
  {
    const S = M.create({}); M.acquire(S, 14);
    const wEngram = S.wLA[0];
    const fAcq = M.probe(S, 0).freeze;
    M.extinguish(S, 24);
    const fExt = M.probe(S, 0).freeze;
    console.log("      freezing acq=" + fmt(fAcq) + " → extinguished=" + fmt(fExt) + "   wLA engram " + fmt(wEngram) + " → " + fmt(S.wLA[0]) + "   wExt=" + fmt(S.wExt[0]));
    check("extinction lowers freezing", fExt < fAcq - 0.3, "fExt=" + fmt(fExt));
    check("the LA fear engram is not erased", S.wLA[0] > wEngram - 0.05, "wLA=" + fmt(S.wLA[0]));
    check("extinction is new (safety) learning", S.wExt[0] > 0.3, "wExt=" + fmt(S.wExt[0]));
  }

  console.log("\n[5] Return of fear — a context shift renews the extinguished response");
  {
    const S = M.create({}); M.acquire(S, 14); M.extinguish(S, 24);
    const fExt = M.probe(S, 0).freeze;
    S.P.ctx = 0.0;                                  // shift out of the extinction context
    const fRen = M.probe(S, 0).freeze;
    console.log("      extinguished=" + fmt(fExt) + "  → context shift → renewed=" + fmt(fRen) + "  (engram wLA=" + fmt(S.wLA[0]) + ")");
    check("fear returns outside the extinction context", fRen > fExt + 0.3, "fRen=" + fmt(fRen));
  }

  console.log("\n[6] Theta coherence — LA⟷PL synchrony is higher during fear than safety");
  {
    const S = M.create({}); M.acquire(S, 14);
    const cP = M.probe(S, 0, 3.0).coh, cM = M.probe(S, 1, 3.0).coh;
    console.log("      LA⟷PL coherence  CS+ (fear)=" + fmt(cP) + "   CS− (safe)=" + fmt(cM));
    check("fear raises LA⟷PL theta coherence", cP > cM + 0.15, "Δ=" + fmt(cP - cM));
  }

  console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
  process.exit(fail ? 1 : 0);
}
