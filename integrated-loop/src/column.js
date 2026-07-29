"use strict";
/* =====================================================================
   COLUMNAR CORTEX, EVERY COLUMN COUPLED TO A THALAMIC NUCLEUS.

   Replaces the flat sheet of `cortex.js` with the canonical column already validated in
   `thalamocortical.js` — but at the level of description assemblies need.

   WHY THIS IS NOT JUST AN IMPORT. `thalamocortical.js` is MEAN-FIELD: one rate per population
   per column. A mean-field population cannot host a sparse assembly, because it has no internal
   structure to be sparse in. `cortex.js` has individual units and no columns. The merge is to
   keep the laminar and thalamic ARCHITECTURE of the former and give each lamina a POPULATION OF
   UNITS instead of a single rate. Full plan and validation gates: docs/COLUMNAR-ARCHITECTURE.md

   THE CIRCUIT, per column c:

       sensory ──► TC[c] ──► L4[c] ──► L23[c] ⇄ L23[c'] (cortico-cortical, plastic)
                    ▲  ▲                 │
                    │  └── RTN[c] ◄──────┼──── L5[c] ◄──┘
                    └───────────────────┴──── L5[c]  (corticothalamic feedback)

   Sensory input enters at the THALAMUS, not at cortex. That is the point of the change: there
   is no route into this cortex that does not pass a relay nucleus and its reticular gate.

   TWO MECHANISMS MAKE THE THALAMUS LOAD-BEARING rather than a named wire, and both are tested:
     • RTN[c] inhibits TC[c] AND ITS NEIGHBOURS, so columns COMPETE for relay throughput. Same
       motif as the TRN gate in the basal-ganglia model and the callosal opponent term in
       parietal.js.
     • L5 → TC and L5 → RTN → TC is a corticothalamic GAIN GATE, the pulvinar formulation
       J_eff = J_direct + δJ·λ(x) given a home in the general architecture.

   Interneurons are scalar pools per lamina per column: they set gain and sparsity and do not
   need to be individually addressable. Excitatory laminae are populations of units.

   API mirrors cortex.js (create/encode/present/run/activeSet/overlap) so migration of a stage
   is mechanical rather than a rewrite.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function cdefaults() {
  return {
    seed: 7,
    NCOL: 64,          // cortical columns
    nTC: 8,            // thalamic relay units per column
    nL4: 16,           // thalamorecipient units per column
    nL23: 64,          // ASSOCIATIVE units per column — assemblies live here
    nL5: 16,           // output units per column
    nStim: 8,

    // ---- feedforward ----
    // A stimulus is TOPOGRAPHIC: it occupies part of the thalamic map, not a uniform sample of
    // all of it. pColStim is the fraction of COLUMNS whose relay sector it drives; pIn is the
    // fraction of relay units it drives WITHIN those columns. Drawing pIn uniformly over every
    // column (the first version of this file) makes every stimulus touch ~82% of columns, and
    // assemblies then cannot be orthogonal — measured in stage 30 before this was fixed.
    pColStim: 0.18,
    pIn: 0.40,         // fraction of relay units driven WITHIN a recruited column
    inDrive: 1.6,      // sensory drive amplitude at the relay
    wTC_L4: 1.10,      // relay → layer 4, topographic and strong (a driver synapse)
    pTC_L4: 0.55,      // connection probability within the column's own relay sector
    wL4_L23: 0.85,     // layer 4 → layer 2/3
    pL4_L23: 0.35,
    // FEEDFORWARD CONVERGENCE ACROSS COLUMNS. ffRadius = 0 confines an L2/3 cell to its own
    // column's layer 4, which is how this file was first written — and it means no cell sees
    // more than one patch of the sensory map at encoding time, since the only cross-column
    // pathway is the recurrent one and that is silent at birth. Stage 31 measured the cost:
    // the representation becomes a patch detector, not a feature detector. Real receptive
    // fields span many columns, so this is a MISSING PATHWAY, not a free parameter.
    ffRadius: 0,       // in columns, on the column lattice (0 = own column only)
    ffSigma: 1.0,      // Gaussian falloff of the convergence with column distance
    wL23_L5: 0.70,     // layer 2/3 → layer 5
    pL23_L5: 0.30,

    // ---- corticothalamic feedback: the gain gate ----
    wL5_TC: 0.45,      // layer 5 → own relay (excitatory feedback)
    wL5_RTN: 0.80,     // layer 5 → reticular sector
    wTC_RTN: 0.60,     // relay collateral → reticular sector
    wRTN_TC: 1.30,     // reticular → relay INHIBITION, own sector
    rtnSpread: 0.55,   // reticular inhibition of NEIGHBOURING sectors — the competition term
    rtnRadius: 2,      // in columns, on the column lattice

    // ---- associative recurrence in layer 2/3 ----
    kRec: 60,          // recurrent inputs per L2/3 cell, held ABSOLUTE at every scale
    recSigma: 0.35,    // cortico-cortical falloff, in units of the column lattice
    // Long-range fraction (a genuine fraction: the two components are normalised separately,
    // the parameterisation stage 24b had to correct in structural.js). Raised from 0.10 because
    // an assembly occupies columns scattered across the lattice, and with only local recurrence
    // the cortico-cortical weights cannot bind them: pattern completion measured 0.39 at 0.10
    // and 0.52 at 0.35. Association fibres are substantially long-range.
    recLong: 0.35,
    wRecInit: 0.0,     // silent at birth; learning builds the assemblies
    wRecMax: 1.2,
    wBudget: 1.3,      // SUBTRACTIVE normalisation cap on total incoming recurrent weight

    // ---- DENDRITIC NONLINEARITY: the reason a cell codes a PATTERN, not an AMOUNT ----
    // A linear cell (d = Σ w·x) fires in proportion to how much drive it gets, so every cell in
    // a strongly driven column rises together and all stimuli recruit the same cells — measured
    // in stage 31 as assemblies overlapping 0.79 across different shapes. Real pyramidal
    // dendrites are not linear: branches act as semi-independent nonlinear subunits, so a cell
    // responds when a SPECIFIC subset of its inputs is co-active on the same branch and not when
    // the same total current arrives spread thinly (Poirazi, Brannon & Mel 2003; Polsky, Mel &
    // Schiller 2004; Larkum 2013). That is what makes a cell a feature detector.
    nBranch: 6,        // dendritic subunits per L2/3 cell
    dendThr: 0.35,     // per-branch threshold: below this a branch contributes almost nothing
    dendGain: 2.2,     // supralinear gain above it
    dendOn: false,     // default off so stages 30 and 31 reproduce unchanged

    // ---- FEEDFORWARD INHIBITION: selection in time, not just normalisation ----
    // The PV pools below track their own lamina's activity, i.e. pure FEEDBACK inhibition, which
    // divides the population by its mean and normalises without picking winners. In cortex the
    // thalamocortical afferent drives PV cells DIRECTLY, so inhibition arrives before the
    // disynaptic cortical excitation and leaves a brief window in which only the most strongly
    // driven cells reach threshold (Pouille & Scanziani 2001; Gabernet et al. 2005; Cruikshank,
    // Lewis & Connors 2007). That feedforward term is a competitive threshold that scales with
    // the input, which is what selection requires.
    ffiTC_PV4: 0.0,    // relay → PV4, feedforward
    ffiL4_PV23: 0.0,   // layer 4 → PV23, feedforward
    tauFFI: 0.002,     // feedforward inhibition is FAST — this is what makes it a window

    // ---- inhibition ----
    // L2/3 feedback inhibition. Set so the associative sparsity matches the flat sheet's
    // 7.2–7.3%: this is the module's own design target (emergent sparsity from feedback
    // inhibition, stage 1's criterion), not an external reference range, so putting the new
    // module in the same operating regime as the one it replaces is calibration, not fitting.
    gPV23: 12.0,
    gPV4: 5.0,         // L4 feedback inhibition
    gSOM: 0.6,         // dendritic inhibition, tracks L5

    // ---- unit dynamics ----
    thr: 0.18, gain: 1.6,
    thrTC: 0.10, gainTC: 1.8,
    tauA: 0.020, tauI: 0.006, dt: 0.001,
    lrRec: 2.5, encReps: 4, actThr: 0.30,

    // ---- BCM METAPLASTICITY: competition between stimuli FOR CELLS ----
    // Plain Hebbian recurrence MERGES correlated patterns, and stage 31 measured it directly:
    // cross-shape assembly overlap 0.28 before learning and 0.63 after. A cell shared by two
    // stimuli is potentiated for both and becomes a bridge that drags one assembly into the
    // other. cortex.js never hit this because its stimuli are random sparse subsets that barely
    // overlap to begin with; natural stimuli are correlated, so the problem is unavoidable here.
    //
    // The biological answer is the sliding modification threshold (Bienenstock, Cooper & Munro
    // 1982): the LTP/LTD crossover point tracks the cell's own recent activity, θ ∝ ⟨a²⟩. A cell
    // that responds to everything raises its threshold and its synapses DEPRESS; a cell that
    // responds selectively keeps potentiating. Promiscuous cells are therefore expelled from
    // assemblies and selective ones retained — pattern separation as metaplasticity rather than
    // as an extra circuit.
    bcmOn: false,      // default off so stages 30 and 31 reproduce unchanged
    bcmTau: 1.0,       // s — θ must integrate across stimuli, not within one presentation
    bcmTarget: 0.35,   // activity scale at which θ sits when a cell fires selectively

    // ---- ablations, for the gates ----
    rtnOn: true,       // false = no reticular gate at all (G2)
    ctOn: true,        // false = no corticothalamic feedback
  };
}

/* columns sit on a 2-D lattice, so "neighbouring sector" and cortico-cortical distance mean
   something. Square lattice, side = ceil(sqrt(NCOL)). */
function colLayout(NCOL) {
  const side = Math.ceil(Math.sqrt(NCOL)), pos = [];
  for (let c = 0; c < NCOL; c++) pos.push([c % side, Math.floor(c / side)]);
  return { pos, side };
}
const colDist = (pos, a, b) => Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);

function create(opts) {
  const P = Object.assign(cdefaults(), opts || {});
  const rnd = mulberry32(P.seed);
  const NC = P.NCOL;
  const { pos, side } = colLayout(NC);
  const NL23 = NC * P.nL23, NTC = NC * P.nTC, NL4 = NC * P.nL4, NL5 = NC * P.nL5;

  /* ---- stimuli drive THE THALAMUS, not cortex ---- */
  const stim = [], stimCols = [];
  for (let s = 0; s < P.nStim; s++) {
    const v = new Float64Array(NTC), cols = [];
    for (let c = 0; c < NC; c++) if (rnd() < P.pColStim) cols.push(c);
    if (!cols.length) cols.push(Math.floor(rnd() * NC));
    for (const c of cols) {
      for (let t = 0; t < P.nTC; t++) {
        if (rnd() < P.pIn) v[c * P.nTC + t] = P.inDrive * (0.7 + 0.6 * rnd());
      }
    }
    stim.push(v); stimCols.push(Int32Array.from(cols));
  }

  /* ---- TC → L4, within a column's own sector (topographic driver) ---- */
  const l4Idx = [], l4W = [];
  for (let c = 0; c < NC; c++) {
    for (let u = 0; u < P.nL4; u++) {
      const idx = [], w = [];
      for (let t = 0; t < P.nTC; t++) {
        if (rnd() < P.pTC_L4) { idx.push(c * P.nTC + t); w.push(P.wTC_L4 * (0.8 + 0.4 * rnd())); }
      }
      if (!idx.length) { const t = Math.floor(rnd() * P.nTC); idx.push(c * P.nTC + t); w.push(P.wTC_L4); }
      l4Idx.push(Int32Array.from(idx)); l4W.push(Float64Array.from(w));
    }
  }
  /* ---- L4 → L2/3, within the column ---- */
  const ffIdx = [], ffW = [];
  const inv2f2 = 1 / (2 * P.ffSigma * P.ffSigma);
  for (let c = 0; c < NC; c++) {
    // the columns this column's L2/3 cells may draw layer-4 input from
    const src = [];
    for (let k = 0; k < NC; k++) {
      const d = colDist(pos, c, k);
      if (d <= P.ffRadius) src.push([k, Math.exp(-(d * d) * inv2f2)]);
    }
    if (!src.length) src.push([c, 1]);
    for (let u = 0; u < P.nL23; u++) {
      const idx = [], w = [];
      for (const [k, g] of src) {
        for (let t = 0; t < P.nL4; t++) {
          if (rnd() < P.pL4_L23 * g) {
            idx.push(k * P.nL4 + t); w.push(P.wL4_L23 * g * (0.8 + 0.4 * rnd()));
          }
        }
      }
      if (!idx.length) { const t = Math.floor(rnd() * P.nL4); idx.push(c * P.nL4 + t); w.push(P.wL4_L23); }
      ffIdx.push(Int32Array.from(idx)); ffW.push(Float64Array.from(w));
    }
  }
  /* ---- L2/3 → L5, within the column ---- */
  const l5Idx = [];
  for (let c = 0; c < NC; c++) {
    for (let u = 0; u < P.nL5; u++) {
      const idx = [];
      for (let t = 0; t < P.nL23; t++) if (rnd() < P.pL23_L5) idx.push(c * P.nL23 + t);
      if (!idx.length) idx.push(c * P.nL23 + Math.floor(rnd() * P.nL23));
      l5Idx.push(Int32Array.from(idx));
    }
  }

  /* ---- L2/3 ⇄ L2/3, within and ACROSS columns: distance-dependent, plastic.
         The two components are normalised separately so recLong is a genuine long-range
         fraction and recSigma controls locality alone — the parameterisation stage 24b had to
         correct in structural.js, applied correctly here from the start. ---- */
  const preIdx = [], preW = [];
  const cum = new Float64Array(NL23), g = new Float64Array(NL23);
  const inv2s2 = 1 / (2 * P.recSigma * P.recSigma), one = 1 - P.recLong;
  for (let i = 0; i < NL23; i++) {
    const ci = Math.floor(i / P.nL23);
    let gs = 0;
    for (let j = 0; j < NL23; j++) {
      if (j === i) { g[j] = 0; continue; }
      const d = colDist(pos, ci, Math.floor(j / P.nL23));
      g[j] = Math.exp(-(d * d) * inv2s2); gs += g[j];
    }
    const flat = P.recLong / (NL23 - 1);
    let tot = 0;
    for (let j = 0; j < NL23; j++) {
      if (j !== i) tot += (gs > 0 ? one * g[j] / gs : 0) + flat;
      cum[j] = tot;
    }
    const chosen = new Set(), id = [];
    let guard = 0;
    while (id.length < P.kRec && guard++ < P.kRec * 60) {
      const r = rnd() * tot;
      let lo = 0, hi = NL23 - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
      if (lo === i || chosen.has(lo)) continue;
      chosen.add(lo); id.push(lo);
    }
    preIdx.push(Int32Array.from(id));
    preW.push(new Float64Array(id.length).fill(P.wRecInit));
  }

  /* ---- reticular neighbourhood: which sectors each RTN sector inhibits ---- */
  const rtnNb = [];
  for (let c = 0; c < NC; c++) {
    const nb = [];
    for (let k = 0; k < NC; k++) if (k !== c && colDist(pos, c, k) <= P.rtnRadius) nb.push(k);
    rtnNb.push(Int32Array.from(nb));
  }

  return {
    P, rnd, pos, side, NCOL: NC, NL23, NTC, NL4, NL5,
    N: NL23,                              // the associative sheet, for cortex.js compatibility
    stim, stimCols, l4Idx, l4W, ffIdx, ffW, l5Idx, preIdx, preW, rtnNb,
    tc: new Float64Array(NTC), l4: new Float64Array(NL4),
    a: new Float64Array(NL23),            // L2/3 activity — `a` to match cortex.js
    l5: new Float64Array(NL5),
    rtn: new Float64Array(NC),
    pv23: new Float64Array(NC), pv4: new Float64Array(NC), som: new Float64Array(NC),
    ffi23: new Float64Array(NC), ffi4: new Float64Array(NC),
    theta: new Float64Array(NL23).fill(0.35),   // BCM sliding modification threshold
    ext: new Float64Array(NTC),           // external drive arrives at the RELAY
    // Direct injection into L2/3, BYPASSING the relay and layer 4. Exists only so gate G3 can
    // ask whether the laminar route does any work; it is not a physiological pathway.
    extL23: new Float64Array(NL23),
    nx23: new Float64Array(NL23), nxTC: new Float64Array(NTC),
    nx4: new Float64Array(NL4), nx5: new Float64Array(NL5),
    plastic: false, assemblies: [],
  };
}

function setExt(S, vec) { S.ext.set(vec); }
function clearExt(S) { S.ext.fill(0); S.extL23.fill(0); }
function setExtL23(S, vec) { S.extL23.set(vec); }

function normalizeCell(S, i) {
  const pw = S.preW[i]; if (!pw.length) return;
  let sum = 0; for (let k = 0; k < pw.length; k++) sum += pw[k];
  const excess = sum - S.P.wBudget;
  if (excess <= 0) return;
  const dec = excess / pw.length;
  for (let k = 0; k < pw.length; k++) pw[k] = pw[k] > dec ? pw[k] - dec : 0;
}

function step(S) {
  const P = S.P, dt = P.dt, NC = S.NCOL;

  /* ---- 1. reticular sector: driven by its own relay and by L5, inhibits relays ---- */
  const rtnDrive = new Float64Array(NC);
  if (P.rtnOn) {
    for (let c = 0; c < NC; c++) {
      let tcSum = 0;
      for (let t = 0; t < P.nTC; t++) tcSum += S.tc[c * P.nTC + t];
      let l5Sum = 0;
      for (let u = 0; u < P.nL5; u++) l5Sum += S.l5[c * P.nL5 + u];
      rtnDrive[c] = P.wTC_RTN * tcSum / P.nTC +
                    (P.ctOn ? P.wL5_RTN * l5Sum / P.nL5 : 0);
    }
    for (let c = 0; c < NC; c++) S.rtn[c] += (dt / P.tauI) * (rtnDrive[c] - S.rtn[c]);
  } else S.rtn.fill(0);

  /* the inhibition each relay sector receives: its own sector plus its neighbours.
     The neighbour term is the COMPETITION between columns. */
  const rtnOnTC = new Float64Array(NC);
  for (let c = 0; c < NC; c++) {
    let v = P.wRTN_TC * S.rtn[c];
    const nb = S.rtnNb[c];
    for (let k = 0; k < nb.length; k++) v += P.rtnSpread * P.wRTN_TC * S.rtn[nb[k]] / Math.max(1, nb.length);
    rtnOnTC[c] = v;
  }

  /* ---- 2. thalamic relay: sensory + corticothalamic feedback − reticular ---- */
  for (let c = 0; c < NC; c++) {
    let l5Sum = 0;
    for (let u = 0; u < P.nL5; u++) l5Sum += S.l5[c * P.nL5 + u];
    const fb = P.ctOn ? P.wL5_TC * l5Sum / P.nL5 : 0;
    for (let t = 0; t < P.nTC; t++) {
      const i = c * P.nTC + t;
      const d = S.ext[i] + fb - rtnOnTC[c] - P.thrTC;
      S.nxTC[i] = d > 0 ? clamp(P.gainTC * d, 0, 1.3) : 0;
    }
  }

  /* ---- 3. layer 4: thalamorecipient ---- */
  for (let c = 0; c < NC; c++) {
    for (let u = 0; u < P.nL4; u++) {
      const i = c * P.nL4 + u;
      const idx = S.l4Idx[i], w = S.l4W[i];
      let d = 0;
      for (let k = 0; k < idx.length; k++) d += w[k] * S.tc[idx[k]];
      d -= P.gPV4 * S.pv4[c] + S.ffi4[c] + P.thr;
      S.nx4[i] = d > 0 ? clamp(P.gain * d, 0, 1.3) : 0;
    }
  }

  /* ---- 4. layer 2/3: feedforward from L4 + recurrent cortico-cortical − PV − SOM ---- */
  for (let c = 0; c < NC; c++) {
    const inh = P.gPV23 * S.pv23[c] + P.gSOM * S.som[c] + S.ffi23[c] + P.thr;
    for (let u = 0; u < P.nL23; u++) {
      const i = c * P.nL23 + u;
      const fi = S.ffIdx[i], fw = S.ffW[i];
      let d = 0;
      if (P.dendOn && fi.length >= P.nBranch) {
        // partition the feedforward inputs into dendritic subunits; each branch is thresholded
        // and supralinear, so clustered co-active input counts for far more than the same
        // current spread across branches
        const per = fi.length / P.nBranch;
        for (let b = 0; b < P.nBranch; b++) {
          const lo = Math.floor(b * per), hi = Math.floor((b + 1) * per);
          let bs = 0;
          for (let k = lo; k < hi; k++) bs += fw[k] * S.l4[fi[k]];
          if (bs > P.dendThr) { const e = bs - P.dendThr; d += P.dendGain * e * e; }
        }
      } else {
        for (let k = 0; k < fi.length; k++) d += fw[k] * S.l4[fi[k]];
      }
      const pi = S.preIdx[i], pw = S.preW[i];
      for (let k = 0; k < pi.length; k++) d += pw[k] * S.a[pi[k]];
      d += S.extL23[i];
      d -= inh;
      S.nx23[i] = d > 0 ? clamp(P.gain * d, 0, 1.3) : 0;
    }
  }

  /* ---- 5. layer 5: reads layer 2/3, drives the thalamus ---- */
  for (let c = 0; c < NC; c++) {
    for (let u = 0; u < P.nL5; u++) {
      const i = c * P.nL5 + u;
      const idx = S.l5Idx[i];
      let d = 0;
      for (let k = 0; k < idx.length; k++) d += P.wL23_L5 * S.a[idx[k]];
      d = d / Math.max(1, idx.length) * 4 - P.thr;
      S.nx5[i] = d > 0 ? clamp(P.gain * d, 0, 1.3) : 0;
    }
  }

  /* ---- 6. integrate ---- */
  const kA = dt / P.tauA;
  for (let i = 0; i < S.NTC; i++) S.tc[i] += kA * (S.nxTC[i] - S.tc[i]);
  for (let i = 0; i < S.NL4; i++) S.l4[i] += kA * (S.nx4[i] - S.l4[i]);
  for (let i = 0; i < S.NL23; i++) S.a[i] += kA * (S.nx23[i] - S.a[i]);
  for (let i = 0; i < S.NL5; i++) S.l5[i] += kA * (S.nx5[i] - S.l5[i]);

  /* ---- 7. interneuron pools track their own lamina, per column ---- */
  const kI = dt / P.tauI, kF = dt / P.tauFFI;
  for (let c = 0; c < NC; c++) {
    let m23 = 0; for (let u = 0; u < P.nL23; u++) m23 += S.a[c * P.nL23 + u];
    let m4 = 0; for (let u = 0; u < P.nL4; u++) m4 += S.l4[c * P.nL4 + u];
    let m5 = 0; for (let u = 0; u < P.nL5; u++) m5 += S.l5[c * P.nL5 + u];
    let mtc = 0; for (let t = 0; t < P.nTC; t++) mtc += S.tc[c * P.nTC + t];
    S.pv23[c] += kI * (m23 / P.nL23 - S.pv23[c]);
    S.pv4[c] += kI * (m4 / P.nL4 - S.pv4[c]);
    S.som[c] += kI * (m5 / P.nL5 - S.som[c]);
    // FEEDFORWARD components, on their own fast time constant, tracking the AFFERENT rather
    // than the local population — this is the term that selects instead of normalising
    S.ffi4[c] += kF * (P.ffiTC_PV4 * mtc / P.nTC - S.ffi4[c]);
    S.ffi23[c] += kF * (P.ffiL4_PV23 * m4 / P.nL4 - S.ffi23[c]);
  }

  /* ---- 8. Hebbian plasticity on the cortico-cortical L2/3 recurrence ---- */
  if (S.plastic) {
    const a = S.a;
    if (P.bcmOn) {
      // θ tracks ⟨a²⟩ on a slow time constant, so it integrates ACROSS stimuli
      const kT = dt / P.bcmTau, inv = 1 / (P.bcmTarget * P.bcmTarget);
      for (let i = 0; i < S.NL23; i++) S.theta[i] += kT * (a[i] * a[i] * inv * P.bcmTarget - S.theta[i]);
      for (let i = 0; i < S.NL23; i++) {
        if (a[i] <= 0) continue;
        const pi = S.preIdx[i], pw = S.preW[i];
        // the BCM factor: positive above the cell's own threshold, NEGATIVE below it
        const post = a[i] * (a[i] - S.theta[i]);
        if (post === 0) continue;
        let touched = false;
        for (let k = 0; k < pi.length; k++) {
          const aj = a[pi[k]];
          if (aj > 0) { pw[k] = clamp(pw[k] + P.lrRec * dt * post * aj, 0, P.wRecMax); touched = true; }
        }
        if (touched && post > 0) normalizeCell(S, i);
      }
    } else {
      for (let i = 0; i < S.NL23; i++) {
        if (a[i] < P.actThr) continue;
        const pi = S.preIdx[i], pw = S.preW[i];
        let touched = false;
        for (let k = 0; k < pi.length; k++) {
          const aj = a[pi[k]];
          if (aj > P.actThr) { pw[k] = clamp(pw[k] + P.lrRec * dt * a[i] * aj, 0, P.wRecMax); touched = true; }
        }
        if (touched) normalizeCell(S, i);
      }
    }
  }
}

function reset(S) {
  S.tc.fill(0); S.l4.fill(0); S.a.fill(0); S.l5.fill(0);
  S.rtn.fill(0); S.pv23.fill(0); S.pv4.fill(0); S.som.fill(0);
  S.ffi23.fill(0); S.ffi4.fill(0);
}
function run(S, seconds) { const n = Math.round(seconds / S.P.dt); for (let k = 0; k < n; k++) step(S); }

function activeSet(S, thr) {
  thr = thr == null ? S.P.actThr : thr;
  const set = []; for (let i = 0; i < S.NL23; i++) if (S.a[i] > thr) set.push(i);
  return set;
}
function activeFrac(S, thr) { return activeSet(S, thr).length / S.NL23; }
/* which columns are recruited, and how many — the quantity a flat sheet cannot report */
function activeColumns(S, thr) {
  thr = thr == null ? S.P.actThr : thr;
  const per = new Int32Array(S.NCOL);
  for (let i = 0; i < S.NL23; i++) if (S.a[i] > thr) per[Math.floor(i / S.P.nL23)]++;
  let n = 0; for (let c = 0; c < S.NCOL; c++) if (per[c] > 0) n++;
  return { per, nActive: n, frac: n / S.NCOL };
}

function present(S, sIdx, frac, dur, doReset) {
  frac = frac == null ? 1 : frac; dur = dur == null ? 0.35 : dur;
  if (doReset) reset(S);
  const v = S.stim[sIdx], cue = new Float64Array(S.NTC);
  if (frac >= 1) cue.set(v);
  else for (let i = 0; i < S.NTC; i++) if (v[i] > 0 && S.rnd() < frac) cue[i] = v[i];
  setExt(S, cue); run(S, dur);
  const set = activeSet(S);
  clearExt(S); run(S, 0.12);
  return set;
}

function encode(S, dur) {
  dur = dur == null ? 0.35 : dur;
  for (let r = 0; r < S.P.encReps; r++) {
    for (let s = 0; s < S.P.nStim; s++) { S.plastic = true; present(S, s, 1, dur, true); S.plastic = false; }
  }
  S.assemblies = [];
  for (let s = 0; s < S.P.nStim; s++) S.assemblies.push(present(S, s, 1, dur, true));
}

const overlap = (a, b) => { const sb = new Set(b); let c = 0; for (const x of a) if (sb.has(x)) c++; return c; };

module.exports = { create, cdefaults, step, run, reset, present, encode, setExt, clearExt, setExtL23,
  activeSet, activeFrac, activeColumns, overlap, normalizeCell, colLayout, colDist, mulberry32 };
