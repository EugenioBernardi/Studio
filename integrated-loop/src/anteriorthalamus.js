"use strict";
/* =====================================================================
   THE ANTERIOR THALAMUS AS A PHASE POINTER, NOT A RELAY.

   THE ORPHANED FINDING THIS EXISTS TO EXPLAIN. Frost, Martin, Cafalchio, Islam, Aggleton &
   O'Mara (J Neurosci 2021) lesioned the anterior thalamic nuclei and found that EVERY spatial
   signal in the subiculum — place cells, grid cells AND head-direction cells — disappeared, while
   CA1 place fields were left "largely unaffected" and spatial memory fell to chance. Aggleton &
   O'Mara (Nat Rev Neurosci 2022) argue the anterior thalamus is a core component of episodic
   memory co-equal with the hippocampus, and note that standard models simply leave it out.

   THE PUZZLE, stated sharply. The subiculum's dominant input IS CA1. If CA1's place code is
   intact and the subiculum reads CA1, the subiculum should be fine. It is not. The literature
   currently fills this with a placeholder — anterior thalamic input is said to be "modulatory or
   enabling" — which names the gap rather than closing it. No model closes it.

   THE PROPOSAL. Position is coded in theta PHASE, not only in rate: within each theta cycle the
   hippocampal population sweeps from behind the animal to ahead of it (phase precession; theta
   sequences — Skaggs & McNaughton, Foster & Wilson, Dragoi & Buzsáki). A downstream read-out that
   integrates over a narrow window therefore extracts WHICHEVER POSITION IS REPRESENTED AT THE
   PHASE IT HAPPENS TO LOOK. So a read-out needs two things: the code, and a pointer telling it
   WHEN in the cycle to look.

       CA1 supplies the code. The anterior thalamus supplies the POINTER.

   Remove the pointer and the subiculum samples a different point of the swept sequence every
   cycle. Averaged over cycles its field smears toward uniform: spatial information collapses
   while the code upstream is untouched and the synaptic weights are untouched. Nothing is
   subtracted — the read-out is looking in the wrong place.

   WHY THIS EXPLAINS THE WHOLE LESION AND NOT JUST PART OF IT. A coding failure would remove one
   signal type. A POINTER failure removes every signal that is phase-multiplexed through the same
   read-out — place, grid and head-direction together, which is what Frost et al. observed.

   WHAT IS ASSUMED VERSUS WHAT IS DERIVED, because the difference matters. That CA1 is spared is
   an ANATOMICAL ASSUMPTION, not a result: the anterior thalamus does not project to CA1, so
   nothing here can touch it. The DERIVED result is that the subiculum collapses anyway, on intact
   input, through intact synapses.

   THE MECHANISM CONTROL THAT CAN KILL THIS. If the collapse is really about phase-coded position
   then it must DISAPPEAR when position is not phase-coded. Set `sweep = 0` — rate coding only,
   nothing swept across the cycle — and losing the pointer must cost gain and nothing else. If the
   lesion still abolishes spatial information with sweep = 0, the mechanism is not what is claimed
   here and the account is wrong. Likewise a drive-matched scramble must NOT rescue it: if simply
   restoring total input recovers the code, this is a drive story and not a timing story.
   ===================================================================== */

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = 2 * Math.PI;
/* circular distance on a unit-circumference track */
const dcirc = (a, b) => { let d = Math.abs(a - b) % 1; return d > 0.5 ? 1 - d : d; };
/* circular distance in radians */
const dphase = (a, b) => { let d = Math.abs(a - b) % TAU; return d > Math.PI ? TAU - d : d; };

function defaults() {
  return {
    seed: 1,
    // ---- the track and the sampling grid
    nPos: 48,            // positions sampled around a circular track of unit circumference
    nCycle: 24,          // theta cycles averaged per position (a rate map is an average)
    nPhase: 18,          // phase bins resolved per theta cycle
    // ---- input populations. Each carries ONE variable, all of them phase-multiplexed.
    nIn: 120,            // cells per input population
    sigmaIn: 0.055,      // tuning width (fraction of the track / of the HD circle)
    peakRate: 1.0,
    // ---- THE PHASE CODE. `sweep` is how far the represented variable travels across one theta
    // cycle, as a fraction of the track. Setting it to 0 removes phase coding entirely and is the
    // control that can falsify the whole account.
    sweep: 0.26,
    // ---- the subicular read-out
    nSub: 48,            // read-out cells per population
    kIn: 24,             // input cells each read-out cell samples
    poolSigma: 0.045,    // read-out cells sample inputs with NEARBY tuning, so they inherit one
    windowSigma: 0.62,   // rad — width of the integration window. Narrow ⇒ phase-selective.
    thr: 0.34,           // read-out threshold, applied to the windowed sum
    gain: 1.0,
    // ---- THE POINTER. `kATN` is how tightly the read-out window is locked to the thalamic
    // reference. 1 = perfectly locked; 0 = free-running, which is the lesion.
    kATN: 1.0,
    driveScale: 1.0,     // multiplies the windowed sum — used ONLY to build drive-matched controls
    noise: 0.02,
  };
}

/* Three input populations, each phase-multiplexing a different variable. `kind` only labels which
   variable is being swept; the machinery is identical, which is the point — one read-out failure
   should take all three down together. */
function createModel(opts) {
  const P = Object.assign(defaults(), opts || {});
  const rnd = mulberry32(P.seed);
  const pops = {};
  for (const kind of ["place", "grid", "hd"]) {
    // input tuning centres, evenly tiled with jitter
    const centre = new Float64Array(P.nIn);
    for (let i = 0; i < P.nIn; i++) centre[i] = (i + 0.5) / P.nIn + (rnd() - 0.5) * 0.3 / P.nIn;
    // each input cell has a preferred theta phase. With a sweep, phase and represented position
    // are yoked; the preferred phase is where that cell's variable is represented.
    const prefPhase = new Float64Array(P.nIn);
    for (let i = 0; i < P.nIn; i++) prefPhase[i] = rnd() * TAU;

    // read-out cells: each samples kIn inputs with tuning near its own preferred centre, so it
    // inherits a field from the population it reads. Weights are fixed and never modified — the
    // lesion below changes no synapse.
    const subCentre = new Float64Array(P.nSub);
    const idx = [], wt = [], psiOffset = new Float64Array(P.nSub);
    for (let j = 0; j < P.nSub; j++) {
      subCentre[j] = (j + 0.5) / P.nSub;
      psiOffset[j] = rnd() * TAU;             // this cell's preferred read-out phase
      const id = [], w = [];
      // sample without replacement, weighted by tuning proximity
      const cand = [];
      for (let i = 0; i < P.nIn; i++)
        cand.push([i, Math.exp(-(dcirc(centre[i], subCentre[j]) ** 2) / (2 * P.poolSigma ** 2)) + 1e-9]);
      let tot = cand.reduce((s, c) => s + c[1], 0);
      const taken = new Set();
      for (let n = 0; n < P.kIn && taken.size < P.nIn; n++) {
        let r = rnd() * tot, pick = -1;
        for (const c of cand) { if (taken.has(c[0])) continue; r -= c[1]; if (r <= 0) { pick = c[0]; break; } }
        if (pick < 0) { for (const c of cand) if (!taken.has(c[0])) { pick = c[0]; break; } }
        if (pick < 0) break;
        taken.add(pick); tot -= cand[pick][1];
        id.push(pick); w.push(0.6 + 0.8 * rnd());
      }
      // normalise so every read-out cell has the same total afferent weight — this removes weight
      // magnitude as an explanation for anything that follows
      const s = w.reduce((a, b) => a + b, 0) || 1;
      idx.push(Int32Array.from(id)); wt.push(Float64Array.from(w.map(x => x / s * P.kIn)));
    }
    pops[kind] = { centre, prefPhase, subCentre, idx, wt, psiOffset };
  }
  return { P, rnd, pops };
}

/* What variable value does the population represent at phase `ph`, when the animal is at `x`?
   The sweep runs from behind the animal to ahead of it across the cycle. */
function representedAt(P, x, ph) {
  if (P.sweep === 0) return x;
  return x + P.sweep * (ph / TAU - 0.5);
}

/* input population firing rates at true position x and theta phase ph */
function inputRates(M, kind, x, ph) {
  const P = M.P, pop = M.pops[kind], r = new Float64Array(P.nIn);
  const xr = representedAt(P, x, ph);
  for (let i = 0; i < P.nIn; i++) {
    // spatial tuning about the REPRESENTED position, gated by the cell's preferred theta phase
    const ds = dcirc(pop.centre[i], xr);
    const spatial = Math.exp(-(ds * ds) / (2 * P.sigmaIn ** 2));
    const dp = dphase(pop.prefPhase[i], ph);
    const phaseGate = 0.35 + 0.65 * Math.exp(-(dp * dp) / (2 * 1.0 ** 2));
    r[i] = P.peakRate * spatial * phaseGate;
  }
  return r;
}

/* THE READ-OUT. One theta cycle at position x. `psiRef` is the thalamic reference phase for this
   cycle. Each read-out cell integrates its inputs through a window centred on its own preferred
   phase relative to that reference; with kATN < 1 the reference is followed only partially and the
   window wanders. NOTHING here is subtracted when the pointer is lost — only its timing changes. */
function readOutCycle(M, kind, x, psiRef, jitter, raw) {
  const P = M.P, pop = M.pops[kind], out = new Float64Array(P.nSub);
  // precompute input rates on the phase grid for this cycle
  const grid = [];
  for (let p = 0; p < P.nPhase; p++) grid.push(inputRates(M, kind, x, (p + 0.5) / P.nPhase * TAU));
  for (let j = 0; j < P.nSub; j++) {
    // Where this cell looks. The reference defines the phase ORIGIN, so an intact pointer puts the
    // window at the same theta phase every cycle. kATN scales the width of a circular jitter added
    // to that: at 1 the window is exact, at 0 it is uniform over the whole cycle, which is the
    // lesion. Phases are circular, so the jitter is ADDED and wrapped — interpolating toward a
    // fixed value would shrink every cell's window onto the origin instead of dispersing it.
    const psi = psiRef + pop.psiOffset[j] + (1 - P.kATN) * jitter[j];
    let sum = 0, wnorm = 0;
    for (let p = 0; p < P.nPhase; p++) {
      const ph = (p + 0.5) / P.nPhase * TAU;
      const dp = dphase(ph, psi);
      const win = Math.exp(-(dp * dp) / (2 * P.windowSigma ** 2));
      wnorm += win;
      const r = grid[p], id = pop.idx[j], w = pop.wt[j];
      let s = 0;
      for (let k = 0; k < id.length; k++) s += w[k] * r[id[k]];
      sum += win * s / Math.max(1, id.length);
    }
    const drive = P.driveScale * sum / Math.max(1e-9, wnorm);
    out[j] = raw ? drive : (drive > P.thr ? P.gain * (drive - P.thr) : 0);
  }
  return out;
}

/* rate map: read-out response averaged over cycles, for every sampled position */
function rateMap(M, kind, seedOffset) {
  const P = M.P, rnd = mulberry32((P.seed * 7919 + (seedOffset || 0)) | 0);
  const map = [];
  for (let xi = 0; xi < P.nPos; xi++) {
    const x = (xi + 0.5) / P.nPos;
    const acc = new Float64Array(P.nSub);
    for (let c = 0; c < P.nCycle; c++) {
      const psiRef = 0;                               // the thalamic reference IS the phase origin
      const jitter = new Float64Array(P.nSub);
      for (let j = 0; j < P.nSub; j++) jitter[j] = (rnd() - 0.5) * TAU;
      const o = readOutCycle(M, kind, x, psiRef, jitter);
      for (let j = 0; j < P.nSub; j++) acc[j] += o[j] + P.noise * (rnd() - 0.5);
    }
    for (let j = 0; j < P.nSub; j++) acc[j] = Math.max(0, acc[j] / P.nCycle);
    map.push(acc);
  }
  return map;                                         // map[position][cell]
}

/* the same measurement applied to the INPUT population, so the two can be compared on one scale */
function inputRateMap(M, kind) {
  const P = M.P, map = [];
  for (let xi = 0; xi < P.nPos; xi++) {
    const x = (xi + 0.5) / P.nPos;
    const acc = new Float64Array(P.nIn);
    for (let p = 0; p < P.nPhase; p++) {
      const r = inputRates(M, kind, x, (p + 0.5) / P.nPhase * TAU);
      for (let i = 0; i < P.nIn; i++) acc[i] += r[i] / P.nPhase;
    }
    map.push(acc);
  }
  return map;
}

/* Skaggs spatial information, bits per spike, with a uniform occupancy prior:
     I = Σ_x p(x) (λ_x/λ) log2(λ_x/λ)
   Zero for a cell whose rate does not depend on position, whatever its mean rate — which is why it
   is the right measure here: the lesion is predicted to preserve drive and destroy dependence. */
function spatialInfo(map) {
  const nPos = map.length, nCell = map[0].length, out = new Float64Array(nCell);
  for (let j = 0; j < nCell; j++) {
    let mean = 0;
    for (let x = 0; x < nPos; x++) mean += map[x][j] / nPos;
    if (mean <= 1e-12) { out[j] = 0; continue; }
    let I = 0;
    for (let x = 0; x < nPos; x++) {
      const l = map[x][j] / mean;
      if (l > 1e-12) I += (1 / nPos) * l * Math.log2(l);
    }
    out[j] = I;
  }
  return out;
}

/* field width: fraction of the track above half the cell's peak. Broadening is the specific
   signature a POINTER failure predicts and a gain reduction does not. */
function fieldWidth(map) {
  const nPos = map.length, nCell = map[0].length, out = new Float64Array(nCell);
  for (let j = 0; j < nCell; j++) {
    let peak = 0;
    for (let x = 0; x < nPos; x++) peak = Math.max(peak, map[x][j]);
    if (peak <= 1e-12) { out[j] = NaN; continue; }
    let n = 0;
    for (let x = 0; x < nPos; x++) if (map[x][j] >= 0.5 * peak) n++;
    out[j] = n / nPos;
  }
  return out;
}

/* Population decoding, CROSS-VALIDATED. Templates come from one independent set of cycles and the
   probes from another; scoring a position against a template set that contains its own map returns
   zero error for any map whatever, including pure noise, which is what the first version of this
   function did. Reported as mean circular error in track fractions; chance is 0.25 on a circular
   track, and a decoder given noise must land there. */
function decodeError(mapTemplate, mapProbe) {
  const nPos = mapProbe.length, nCell = mapProbe[0].length;
  let err = 0;
  for (let x = 0; x < nPos; x++) {
    let best = -Infinity, arg = 0;
    for (let y = 0; y < nPos; y++) {
      let dot = 0, na = 0, nb = 0;
      for (let j = 0; j < nCell; j++) {
        dot += mapProbe[x][j] * mapTemplate[y][j];
        na += mapProbe[x][j] ** 2; nb += mapTemplate[y][j] ** 2;
      }
      const c = na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
      if (c > best) { best = c; arg = y; }
    }
    err += dcirc((x + 0.5) / nPos, (arg + 0.5) / nPos);
  }
  return err / nPos;
}

/* AUTO-CALIBRATED THRESHOLD, and it matters that it is calibrated ONCE. The read-out threshold is
   set so that the INTACT model has a target active fraction, then held FIXED for every lesioned and
   control condition. Re-calibrating per condition would let the threshold absorb the lesion and
   hide it; calibrating on the intact case only means any collapse downstream is the pointer's doing
   and not the threshold's. Same discipline as the cerebellum model's cf0. */
function calibrateThreshold(M, kind, targetActive) {
  const P = M.P, want = targetActive == null ? 0.15 : targetActive;
  const rnd = mulberry32(31337 + P.seed);
  const kSave = P.kATN; P.kATN = 1.0;                 // calibrate on an INTACT pointer
  const drives = [];
  for (let xi = 0; xi < P.nPos; xi += 2) {
    const x = (xi + 0.5) / P.nPos;
    for (let c = 0; c < 4; c++) {
      const jitter = new Float64Array(P.nSub);
      for (let j = 0; j < P.nSub; j++) jitter[j] = (rnd() - 0.5) * TAU;
      const o = readOutCycle(M, kind, x, 0, jitter, true);
      for (let j = 0; j < P.nSub; j++) drives.push(o[j]);
    }
  }
  P.kATN = kSave;
  drives.sort((a, b) => a - b);
  P.thr = drives[Math.min(drives.length - 1, Math.floor((1 - want) * drives.length))];
  return P.thr;
}

const meanOf = a => { let s = 0, n = 0; for (const v of a) if (Number.isFinite(v)) { s += v; n++; } return n ? s / n : NaN; };
/* mean drive reaching the read-out, before threshold — the quantity a drive-matched control
   equalises, so that timing is the only thing left differing between conditions */
function meanDrive(M, kind) {
  const P = M.P, rnd = mulberry32(4242 + P.seed);
  let s = 0, n = 0;
  for (let xi = 0; xi < P.nPos; xi += 4) {
    const x = (xi + 0.5) / P.nPos;
    for (let c = 0; c < 6; c++) {
      const jitter = new Float64Array(P.nSub);
      for (let j = 0; j < P.nSub; j++) jitter[j] = (rnd() - 0.5) * TAU;
      const o = readOutCycle(M, kind, x, 0, jitter, true);        // raw drive, before threshold
      for (let j = 0; j < P.nSub; j++) { s += o[j]; n++; }
    }
  }
  return s / Math.max(1, n);
}

module.exports = { defaults, createModel, inputRates, inputRateMap, readOutCycle, rateMap,
  spatialInfo, fieldWidth, decodeError, calibrateThreshold, meanDrive, representedAt, mulberry32, meanOf,
  dcirc, dphase };
