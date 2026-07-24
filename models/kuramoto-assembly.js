"use strict";
/* =====================================================================
   Kuramoto Assembly Model — synchrony as the substrate, plasticity as
   the strengthening/weakening of that synchrony.

   Thesis (project core):
     - every principal neuron is a clock  θ_i  with intrinsic rate ω_i
     - an assembly is a set of clocks that run in synchrony
     - LTP = a coupling that grows when two clocks are co-phasic
     - LTD = a coupling that shrinks when two clocks are anti-phasic
     - the coupling is what binds an assembly, so synchrony *does work*:
       it gates the plasticity that in turn defends the synchrony.

   Dynamics (per neuron):
     dθ_i/dt = ω_i + Σ_j K_ij · sin(θ_j - θ_i) + F_i·sin(Φ_i - θ_i) + √(2D)·ξ

   Plasticity (per ordered pair, bounded 0..Kmax):
     dK_ij/dt = η · ( cos(θ_j - θ_i) - c0 ) · gate_ij  -  λ·(K_ij - K_floor)
       cos(Δφ) > c0  → potentiation (fire together → wire together)
       cos(Δφ) < c0  → depression   (fire apart   → unwire)
     λ is slow homeostatic forgetting toward a small floor.

   This file is the SINGLE SOURCE OF TRUTH for the model. It runs headless
   (`node kuramoto-assembly.js test`) and is inlined verbatim into the app.
   ===================================================================== */

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.KuramotoAssembly = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // deterministic RNG (mulberry32) — same convention as the other models
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Box-Muller normal from a uniform generator
  function normalFrom(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  /* ---------------- validated default parameters ---------------- */
  function defaults() {
    return {
      N: 24,             // number of clocks
      f0: 8.0,           // mean intrinsic rate (Hz) — theta band
      sigmaF: 0.06,      // intrinsic-rate spread (Hz). near-homogeneous ⇒ assemblies lock at
                         //   ~zero phase lag (tight synchrony, R≈1); the plasticity rule reads
                         //   cos(Δφ), so zero-lag locking is what protects a stored assembly
      Kmax: 2.6,         // ceiling on a single coupling
      Ktot: 7.5,         // ceiling on TOTAL incoming coupling per neuron (synaptic budget)
      Kfloor: 0.03,      // homeostatic resting coupling (a weak synapse)
      Kinit: 0.03,       // initial coupling on every allowed pair — sub-critical background
      eta: 1.2,          // plasticity rate (1/s) at full mismatch
      c0: 0.55,          // LTP/LTD threshold on cos(Δφ): only tight synchrony potentiates
      lambda: 0.05,      // homeostatic forgetting rate (1/s)
      D: 0.030,          // phase noise power — keeps the background desynchronised
      Fdrive: 16.0,      // stimulus forcing gain — strong enough to lock the group tightly
      fStim: 8.0,        // stimulus rhythm (Hz) — a rotating reference the clocks entrain to
      Ginh: 3.5,         // feedback inhibition: coherence-proportional REPULSION from the global
                         //   mean phase. Destabilises runaway global synchrony, so a strongly
                         //   coupled assembly cannot entrain the whole net and the background
                         //   stays scattered. This is what makes assemblies SELECTIVE.
      pgate: 1.0,        // connectivity: fraction of ordered pairs that MAY form a synapse (1 = all-to-all)
      dt: 0.001,         // integration step (s)
      seed: 7,
    };
  }

  /* ---------------- construction ---------------- */
  function create(opts) {
    const P = Object.assign(defaults(), opts || {});
    const N = P.N;
    const rnd = mulberry32(P.seed);

    const S = {
      P, N, rnd,
      t: 0,
      stimPhase: 0,                   // rotating stimulus reference (advances at ωStim)
      th: new Float64Array(N),        // phases
      om: new Float64Array(N),        // intrinsic angular rates (rad/s)
      K: [],                          // K[i][j] plastic coupling (j → i)
      gate: [],                       // structural mask (1 = synapse may exist)
      F: new Float64Array(N),         // per-neuron stimulus gain (0 unless driven)
      Phi: new Float64Array(N),       // per-neuron stimulus phase OFFSET from the reference
    };
    for (let i = 0; i < N; i++) {
      S.th[i] = rnd() * TAU;
      S.om[i] = TAU * (P.f0 + P.sigmaF * normalFrom(rnd));
      S.K[i] = new Float64Array(N);
      S.gate[i] = new Float64Array(N);
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        if (rnd() < P.pgate) { S.gate[i][j] = 1; S.K[i][j] = P.Kinit; }  // sparse substrate
      }
    }
    return S;
  }

  /* ---------------- one integration step ---------------- */
  // learn=false freezes the coupling matrix (recall/probe without writing).
  function step(S, learn) {
    const { P, N } = S;
    const dt = P.dt;
    const th = S.th, om = S.om, K = S.K, gate = S.gate, F = S.F, Phi = S.Phi;
    const dth = new Float64Array(N);
    const sqrtD = Math.sqrt(2 * P.D * dt);

    // advance the rotating stimulus reference
    S.stimPhase = (S.stimPhase + TAU * P.fStim * dt) % TAU;
    const sp = S.stimPhase;

    // global order parameter (drives feedback inhibition / shear)
    let gx = 0, gy = 0;
    for (let i = 0; i < N; i++) { gx += Math.cos(th[i]); gy += Math.sin(th[i]); }
    gx /= N; gy /= N;
    const Rg = Math.hypot(gx, gy), psig = Math.atan2(gy, gx);
    const shearGain = P.Ginh * Rg;

    // phase update
    for (let i = 0; i < N; i++) {
      let coup = 0;
      const Ki = K[i], ti = th[i];
      for (let j = 0; j < N; j++) {
        const k = Ki[j];
        if (k !== 0) coup += k * Math.sin(th[j] - ti);
      }
      let drive = 0;
      if (F[i] > 0) drive = F[i] * Math.sin(sp + Phi[i] - ti);   // lock to reference + offset
      const shear = shearGain * Math.sin(ti - psig);              // REPEL from the global mean:
      dth[i] = (om[i] + coup + drive + shear) * dt + sqrtD * normalFrom(S.rnd);  // destabilises global sync
    }
    for (let i = 0; i < N; i++) {
      let v = th[i] + dth[i];
      v %= TAU; if (v < 0) v += TAU;
      th[i] = v;
    }

    // plasticity (co-phase Hebbian on the coupling that carries the synchrony)
    if (learn) {
      const eta = P.eta, c0 = P.c0, lam = P.lambda, Kmax = P.Kmax, Kf = P.Kfloor;
      const Ktot = P.Ktot;
      for (let i = 0; i < N; i++) {
        const Ki = K[i], gi = gate[i], ti = th[i];
        let sum = 0;
        for (let j = 0; j < N; j++) {
          if (!gi[j]) continue;
          const cosd = Math.cos(th[j] - ti);
          let k = Ki[j] + dt * (eta * (cosd - c0) - lam * (Ki[j] - Kf));
          k = clamp(k, 0, Kmax);
          Ki[j] = k; sum += k;
        }
        // synaptic competition: SUBTRACTIVE normalisation (Miller & MacKay 1994).
        // Over-budget rows shed a uniform amount from every synapse, floored at 0 —
        // this is competitive: weak links are driven to zero, strong links keep the
        // budget (winner-take-all), unlike multiplicative scaling which preserves
        // proportions and lets the background keep stealing resources.
        if (sum > Ktot) {
          let active = 0;
          for (let j = 0; j < N; j++) if (Ki[j] > 0) active++;
          const dec = (sum - Ktot) / (active || 1);
          for (let j = 0; j < N; j++) if (Ki[j] > 0) Ki[j] = Math.max(0, Ki[j] - dec);
        }
      }
    }
    S.t += dt;
  }

  /* ---------------- observables ---------------- */
  // global order parameter over a subset (default = all)
  function order(S, idx) {
    const N = S.N, th = S.th;
    let sx = 0, sy = 0, n = 0;
    if (idx) {
      for (const i of idx) { sx += Math.cos(th[i]); sy += Math.sin(th[i]); n++; }
    } else {
      for (let i = 0; i < N; i++) { sx += Math.cos(th[i]); sy += Math.sin(th[i]); n++; }
    }
    if (!n) return { R: 0, psi: 0 };
    return { R: Math.hypot(sx / n, sy / n), psi: Math.atan2(sy / n, sx / n) };
  }
  // mean coupling within a group (both directions, ordered pairs i≠j)
  function meanK(S, group) {
    let s = 0, n = 0;
    for (const i of group) for (const j of group) {
      if (i === j) continue; s += S.K[i][j]; n++;
    }
    return n ? s / n : 0;
  }
  // mean coupling from group A to everything outside A
  function meanKcross(S, A) {
    const inA = new Set(A);
    let s = 0, n = 0;
    for (const i of A) for (let j = 0; j < S.N; j++) {
      if (inA.has(j)) continue; s += S.K[i][j]; n++;
    }
    return n ? s / n : 0;
  }

  /* ---------------- stimulus helpers ---------------- */
  function drive(S, idx, phase, gain) {
    for (const i of idx) { S.F[i] = gain == null ? S.P.Fdrive : gain; S.Phi[i] = phase; }
  }
  function clearDrive(S) { S.F.fill(0); }
  // run for `seconds`, optionally learning; returns nothing (mutates S)
  function run(S, seconds, learn) {
    const steps = Math.round(seconds / S.P.dt);
    for (let s = 0; s < steps; s++) step(S, learn);
  }

  return { create, defaults, step, run, order, meanK, meanKcross, drive, clearDrive, mulberry32, TAU };
});

/* ============================ headless tests ============================ */
if (typeof require !== "undefined" && require.main === module) {
  const M = module.exports;
  const fmt = (x, d = 3) => (x >= 0 ? " " : "") + x.toFixed(d);
  let pass = 0, fail = 0;
  function check(name, cond, detail) {
    (cond ? (pass++, console.log("  PASS  " + name + "   " + (detail || "")))
          : (fail++, console.log("  FAIL  " + name + "   " + (detail || ""))));
  }

  // ---- Test 1: bare Kuramoto transition (plasticity off) --------------
  console.log("\n[1] Kuramoto transition without plasticity");
  function uniform(S, k) { for (let i = 0; i < S.N; i++) for (let j = 0; j < S.N; j++) if (i !== j) S.K[i][j] = k; }
  {
    const S = M.create({ sigmaF: 0.8, D: 0.004, Ginh: 0 });   // Ginh 0 to see the bare transition
    uniform(S, 0.05); M.run(S, 6, false);
    const Rlo = M.order(S).R;
    const S2 = M.create({ sigmaF: 0.8, D: 0.004, Ginh: 0 });
    uniform(S2, 2.2); M.run(S2, 6, false);
    const Rhi = M.order(S2).R;
    console.log("      R(weak coupling)=" + fmt(Rlo) + "   R(strong coupling)=" + fmt(Rhi));
    check("incoherent below critical", Rlo < 0.45, "R=" + fmt(Rlo));
    check("coherent above critical", Rhi > 0.90, "R=" + fmt(Rhi));
  }

  // ---- Test 2: Hebbian engram — drive a group into synchrony ----------
  // Encoding runs with plasticity ON. The claim is that the assembly ends up
  // TIGHTLY SYNCHRONISED (the visual/functional truth) and its coupling stands
  // out from the background it projects to.
  console.log("\n[2] LTP: driving a group co-phasic writes a synchronous assembly");
  const A = [0, 1, 2, 3, 4, 5];
  let trained;
  {
    const S = M.create();
    const kA0 = M.meanK(S, A);
    M.drive(S, A, 0.0);            // common phase forcing → co-phase
    M.run(S, 9, true);
    M.clearDrive(S);
    M.run(S, 1.0, true);          // let it settle undriven, still learning
    const kA = M.meanK(S, A), kX = M.meanKcross(S, A);
    const RA = M.order(S, A).R, RG = M.order(S).R;
    console.log("      within-A K: " + fmt(kA0) + " → " + fmt(kA) + "   A→rest K=" + fmt(kX) +
                "   contrast=" + fmt(kA / Math.max(kX, 1e-6), 1) + "×   R(A)=" + fmt(RA) + " R(all)=" + fmt(RG));
    check("assembly is tightly synchronised", RA > 0.9, "R(A)=" + fmt(RA));
    check("background stays incoherent", RA - RG > 0.35, "Δ=" + fmt(RA - RG));
    check("assembly coupling exceeds its projection to background", kA > 2 * kX, "ratio=" + fmt(kA / Math.max(kX, 1e-6), 1));
    trained = S;
  }

  // ---- Test 3: pattern completion — cue part, recall whole -----------
  // Recall is a FAST readout at FIXED weights (plasticity is slow; encode/retrieve
  // are gated, as ACh does in the hippocampus model). So learning is OFF here.
  console.log("\n[3] Recall: cue a fraction of A, the rest completes (weights frozen)");
  {
    const S = trained;
    // scramble phases so recall must be driven by learned coupling, not residual sync
    for (let i = 0; i < S.N; i++) S.th[i] = S.rnd() * M.TAU;
    M.run(S, 1.0, false);
    const Rbefore = M.order(S, A).R;
    M.drive(S, [0, 1], 0.0);      // cue only 2 of the 6 (lock them to the reference)
    M.run(S, 1.5, false);
    M.clearDrive(S);
    M.run(S, 0.5, false);
    const Rafter = M.order(S, A).R;
    const Rglobal = M.order(S).R;
    console.log("      R(A) scrambled=" + fmt(Rbefore) + " → cued=" + fmt(Rafter) + "   R(global)=" + fmt(Rglobal));
    check("assembly re-synchronises from partial cue", Rafter > 0.85, "R(A)=" + fmt(Rafter));
    check("recall is selective (assembly ≫ global)", Rafter - Rglobal > 0.3, "Δ=" + fmt(Rafter - Rglobal));
  }

  // ---- Test 4: LTD rule in isolation — anti-phase pair unwires --------
  // Isolate the plasticity rule from network attractor stability: two clocks,
  // clamped by a dominant drive (F ≫ coupling) so their phase relation is
  // externally imposed. Co-phase → stays potentiated; anti-phase → decays.
  console.log("\n[4] LTD/LTP rule (2 clocks clamped by dominant drive)");
  {
    function pair(offsetB) {
      const S = M.create({ N: 2 });
      S.K[0][1] = S.P.Kmax; S.K[1][0] = S.P.Kmax;   // start bound
      M.drive(S, [0], 0.0, 30); M.drive(S, [1], offsetB, 30);
      M.run(S, 6, true);
      return S.K[0][1];
    }
    const kCo = pair(0.0), kAnti = pair(Math.PI);
    console.log("      co-phase K=" + fmt(kCo) + "   anti-phase K=" + fmt(kAnti) + "   (Kmax=" + M.create({N:2}).P.Kmax + ")");
    check("co-phase pair stays potentiated (LTP)", kCo > 0.9 * 2.6, "K=" + fmt(kCo));
    check("anti-phase pair is depressed (LTD)", kAnti < 0.2 * 2.6, "K=" + fmt(kAnti));
  }

  // ---- Test 5: two assemblies coexist and recall independently -------
  console.log("\n[5] Two assemblies: distinct engrams, each recalled selectively");
  {
    const S = M.create({ N: 24 });
    const G1 = [0, 1, 2, 3, 4, 5], G2 = [12, 13, 14, 15, 16, 17];
    M.drive(S, G1, 0.0); M.run(S, 9, true); M.clearDrive(S);
    M.drive(S, G2, Math.PI); M.run(S, 9, true); M.clearDrive(S);
    let cs = 0, cn = 0;
    for (const i of G1) for (const j of G2) { cs += S.K[i][j] + S.K[j][i]; cn += 2; }
    const kcross = cs / cn, k1 = M.meanK(S, G1), k2 = M.meanK(S, G2);
    // both assemblies are stable engrams; the claim is they occupy DISTINCT phases
    // (the repulsion pushes coexisting clusters apart) — not that one goes silent.
    for (let i = 0; i < S.N; i++) S.th[i] = S.rnd() * M.TAU;
    M.run(S, 1.5, false);
    const R1 = M.order(S, G1).R, R2 = M.order(S, G2).R;
    const p1 = M.order(S, G1).psi, p2 = M.order(S, G2).psi;
    let dphi = Math.abs(p1 - p2) % M.TAU; if (dphi > Math.PI) dphi = M.TAU - dphi;
    console.log("      K(G1)=" + fmt(k1) + " K(G2)=" + fmt(k2) + " K(G1↔G2)=" + fmt(kcross) +
                "   R(G1)=" + fmt(R1) + " R(G2)=" + fmt(R2) + "   phase gap=" + fmt(dphi * 180 / Math.PI, 0) + "°");
    check("assemblies mutually decoupled", kcross < 0.25 * Math.min(k1, k2), "K=" + fmt(kcross));
    check("both assemblies stay coherent", R1 > 0.85 && R2 > 0.85, "R=" + fmt(R1) + "," + fmt(R2));
    check("assemblies occupy distinct phases (>60°)", dphi > Math.PI / 3, "gap=" + fmt(dphi * 180 / Math.PI, 0) + "°");
  }

  // ---- Test 6: an unrehearsed assembly survives, and forgetting is graceful
  console.log("\n[6] Retention: a stored assembly survives disuse (weights frozen readout)");
  {
    const S = M.create();
    M.drive(S, A, 0.0); M.run(S, 9, true); M.clearDrive(S);
    M.run(S, 15, true);                                   // 15 s of undriven life, learning ON
    const kSurv = M.meanK(S, A);
    for (let i = 0; i < S.N; i++) S.th[i] = S.rnd() * M.TAU;
    M.run(S, 1.0, false); M.drive(S, [0, 1], 0.0); M.run(S, 1.5, false); M.clearDrive(S); M.run(S, 0.5, false);
    const RA = M.order(S, A).R, RG = M.order(S).R;
    console.log("      after 15 s disuse: K(A)=" + fmt(kSurv) + "   recall R(A)=" + fmt(RA) + " R(global)=" + fmt(RG));
    check("assembly still recalls after disuse", RA > 0.85, "R(A)=" + fmt(RA));
    check("recall still selective", RA - RG > 0.3, "Δ=" + fmt(RA - RG));
  }

  console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
  process.exit(fail ? 1 : 0);
}
