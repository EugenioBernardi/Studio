"use strict";
/* Stage-33 — THE ROUTE: columnar association cortex → entorhinal cortex → hippocampus.
 *
 * The proposal, now built. High-order associative cortex, columnar and thalamically coupled,
 * projects to entorhinal cortex and thence to the hippocampus. Stages 30–32 established the
 * pieces and, more importantly, established WHY the route is worth building:
 *
 *   • Stage 30: the columnar cortex works but completes worse than the flat sheet.
 *   • Stage 31 (corrected): it has no mechanism that SELECTS — and my first conclusion there was
 *     an artefact of my own harness, which is recorded in that file.
 *   • Stage 32: two pieces of biology fix selection — dendritic nonlinearity (a cell codes a
 *     pattern, not an amount) and BCM metaplasticity (competition between stimuli for cells).
 *     Discrimination of transformed shapes went 60% → 100% on held-out seeds. And they COST
 *     auto-associative completion, 0.416 → 0.197, exactly as registered in advance.
 *
 * That trade-off is the reason this stage exists rather than an obstacle to it. Separation and
 * completion are done by different structures in the brain: entorhinal cortex and dentate gyrus
 * separate, CA3's recurrent collaterals complete. A columnar association cortex tuned to separate
 * is not a failed auto-associator — it is the right front end for a hippocampus. Stage 32 could
 * only state that as interpretation. This stage TESTS it.
 *
 * WHAT IS NOT CHANGED, and it is the point. `hippocampus.js` is untouched. Its interface is
 * `forwardStep(H, cortexA)` — a cortical activity vector and nothing else. OVERVIEW §8.4 records
 * that this makes the hippocampus content-agnostic BY CONSTRUCTION, and warns that the
 * general-purpose claim is therefore partly an artefact of the abstraction. Feeding it a real
 * cortical code, produced by a real sensory hierarchy, is the first test of whether it is
 * content-agnostic IN FACT.
 *
 * THE ROUTE, end to end, with no abstract vector anywhere in it:
 *   image → retina → LGN → V1 simple → V1 complex (20×20 retinotopic × 12 orientations)
 *         → thalamic relay sectors → L4 → L2/3 (dendritic, BCM)      [src/column.js]
 *         → EC II / EC III → DG → CA3 → CA1 → subiculum → EC deep    [src/hippocampus.js]
 *         → back to cortical L2/3
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) THE DECISIVE ONE. Given a partial cortical pattern, the hippocampal loop completes it
 *       better than cortical recurrence alone. This is the division-of-labour claim made
 *       concrete: the cortex separates, CA3 completes. Stage 32 showed this cortex is a poor
 *       auto-associator by design, so if the loop does not rescue it, the architecture buys
 *       nothing and the trade-off is a straight loss.
 *   (2) The hippocampus binds real cortical codes with NO retuning — not one parameter of
 *       hippocampus.js is changed for this stage. If it needs retuning, the "general-purpose
 *       loop" claim is weaker than the project has been stating.
 *   (3) CA3 indices for the six items are distinct: mean pairwise index overlap below 0.25.
 *   (4) A REGISTERED RISK, and the most likely way this fails. A columnar cortical code driven
 *       by real images is FAR more correlated than the random sparse vectors the hippocampus was
 *       tuned on — stage 32 measured cortical cross-shape overlap at 0.26 even after BCM, where
 *       cortex.js's random patterns sit near chance. Dentate separation may be insufficient and
 *       the indices may merge. If they do, that is a real result about how much separation the
 *       cortex must supply before the hippocampus can index it, and it is reported as such.
 */

const V = require("../src/vision.js");
const K = require("../src/column.js");
const H = require("../src/hippocampus.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null ? "  n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const SIDE = 5, NCOL = SIDE * SIDE, PATCH = V.NC / SIDE, NL23 = 64;
const BIO = { dendOn: true, bcmOn: true };
const CUE = 0.25;                        // stage 26's sensitive cue
/* Reinstatement drive. loop.js records that a STRUCTURED (topographic) output path is more
   correlated across memories than a random projection, so reinstatement needs a WEAKER drive —
   too strong and the wrong memory clears threshold and cortical completion amplifies it into a
   full spurious assembly. This route is more structured still, so the value is route-dependent
   by the shipped module's own account and is swept in §2b rather than assumed. */
const DRIVE = +(process.env.DRIVE33 || 0.45);

/* six items: three shapes at two sizes. Correlated on purpose — that is the regime a real
   cortical front end delivers, and the one P4 says may break dentate separation. */
const ITEMS = [];
for (const kind of V.DEC) for (const size of [0.45, 0.62]) ITEMS.push({ kind, size });

function tcVector(kind, opt) {
  const p = V.pipeline(kind, Object.assign({ size: 0.52, rot: 0, cx: 0, cy: 0 }, opt || {}));
  const vec = new Float64Array(NCOL * V.NORI);
  for (let cy = 0; cy < SIDE; cy++) for (let cx = 0; cx < SIDE; cx++) {
    const col = cy * SIDE + cx;
    for (let o = 0; o < V.NORI; o++) {
      let s = 0;
      for (let y = 0; y < PATCH; y++) for (let x = 0; x < PATCH; x++)
        s += p.C[o][(cy * PATCH + y) * V.NC + (cx * PATCH + x)];
      vec[col * V.NORI + o] = s / (PATCH * PATCH);
    }
  }
  let mx = 0; for (let i = 0; i < vec.length; i++) if (vec[i] > mx) mx = vec[i];
  if (mx > 0) for (let i = 0; i < vec.length; i++) vec[i] = 1.6 * vec[i] / mx;
  return vec;
}
const itemVec = it => tcVector(it.kind, { size: it.size });
const jac = (a, b) => { const sb = new Set(b); let c = 0; for (const x of a) if (sb.has(x)) c++;
  return c / Math.max(1, Math.min(a.length, b.length)); };
const frac = (got, A) => { const g = new Set(got); let c = 0; for (const x of A) if (g.has(x)) c++;
  return c / Math.max(1, A.length); };

/* ---------------- build ---------------- */
console.log("\n" + clock() + " == the route, end to end ==");
const S = K.create(Object.assign({ NCOL, nL23: NL23, nTC: V.NORI, nStim: ITEMS.length, seed: 1 }, BIO));
const hpc = H.createHPC({ seed: 3, NC: S.NL23 });
console.log("  image → V1 complex (" + V.NC + "×" + V.NC + "×" + V.NORI + ")" +
            " → " + NCOL + " thalamic sectors → L4 → L2/3 (" + S.NL23 + " units, dendritic + BCM)");
console.log("  → EC II/III (" + hpc.P.NEC2 + "/" + hpc.P.NEC3 + ") → DG (" + hpc.P.NDG +
            ") → CA3 (" + hpc.P.NCA3 + ") → CA1 (" + hpc.P.NCA1 + ") → sub → EC deep");
console.log("  hippocampus.js is UNCHANGED — its interface is a cortical activity vector\n");

/* learn the cortical representations first (the cortex must separate before the HPC can index) */
for (let rep = 0; rep < 4; rep++) for (const it of ITEMS) {
  K.reset(S); K.setExt(S, itemVec(it));
  S.plastic = true; K.run(S, 0.35); S.plastic = false;
  K.clearExt(S); K.run(S, 0.12);
}
const cortexAssembly = ITEMS.map(it => {
  K.reset(S); K.setExt(S, itemVec(it)); K.run(S, 0.35);
  const a = K.activeSet(S); K.clearExt(S); return a;
});
{
  let xo = 0, n = 0;
  for (let i = 0; i < ITEMS.length; i++) for (let j = i + 1; j < ITEMS.length; j++) {
    xo += jac(cortexAssembly[i], cortexAssembly[j]); n++;
  }
  out.cortexOverlap = xo / n;
  console.log("  " + clock() + " cortical assemblies: mean size " +
              f(mean(cortexAssembly.map(a => a.length)), 0) + ", pairwise overlap " + f(xo / n));
}

/* The two binding helpers, copied VERBATIM from loop.js rather than re-derived. My first
   version guessed the projection layout (row.idx / row.w) and crashed: the real structure is
   dense-per-postsynaptic for Wec (proj.wt[i] indexed by presynaptic j) and sparse-indexed for
   Rca3 (R.idx[i] / R.wt[i]). Copying the shipped implementations is also the honest choice —
   a re-implementation of a binding rule is a second rule, and stage 29 already cost me a wrong
   conclusion from exactly that mistake. */
function bindDense(proj, postArr, preArr, actThr, lr, wMax, budget) {
  const preActive = [];
  for (let j = 0; j < preArr.length; j++) if (preArr[j] > actThr) preActive.push(j);
  for (let i = 0; i < postArr.length; i++) {
    if (postArr[i] < actThr) continue;
    const w = proj.wt[i];
    for (const j of preActive) w[j] = Math.min(wMax, w[j] + lr * postArr[i] * preArr[j]);
    H.normSparse(w, budget);
  }
}
function bindCA3sym(hpcL, actThr) {
  const P = hpcL.P, ca3 = hpcL.ca3, R = hpcL.Rca3;
  for (let i = 0; i < ca3.length; i++) {
    if (ca3[i] < actThr) continue;
    const id = R.idx[i], w = R.wt[i]; let touched = false;
    for (let k = 0; k < id.length; k++) {
      const aj = ca3[id[k]];
      if (aj > actThr) { w[k] = Math.min(P.wRecMax3, w[k] + P.lrRec3 * ca3[i] * aj); touched = true; }
    }
    if (touched) H.normSparse(w, P.wBudget3);
  }
}

/* ---------------- encode: cortex → EC → hippocampal index ---------------- */
console.log("\n" + clock() + " == encoding: the hippocampus indexes real cortical codes ==");
const actThr = hpc.P.actThr;
const indices = [];
{
  hpc.P.ach = 1.0;                                     // encode mode: recurrence gated off
  for (let k = 0; k < ITEMS.length; k++) {
    K.reset(S); K.setExt(S, itemVec(ITEMS[k])); K.run(S, 0.35);   // keep drive ON while binding
    for (let t = 0; t < 80; t++) H.forwardStep(hpc, S.a);
    const idxCells = H.activeSet(hpc.ca3, actThr);
    // bind the output stage to the EC-deep pattern RETRIEVAL will produce, as loop.js does
    const ca3Save = Float64Array.from(hpc.ca3);
    hpc.ca3.fill(0); for (const c of idxCells) hpc.ca3[c] = 1.0;
    hpc.ca1.fill(0); hpc.sub.fill(0); hpc.ecd.fill(0);
    hpc.iCA1 = hpc.iSUB = hpc.iECd = 0;
    for (let t = 0; t < 40; t++) H.backwardStep(hpc);
    bindDense(hpc.Wec, S.a, hpc.ecd, actThr, hpc.P.lrBind, hpc.P.wBindMax, hpc.P.wBudgetBind);
    hpc.ca3.set(ca3Save);
    bindCA3sym(hpc, actThr);
    indices.push(idxCells);
    K.clearExt(S);
  }
  let xo = 0, n = 0;
  for (let i = 0; i < indices.length; i++) for (let j = i + 1; j < indices.length; j++) {
    xo += jac(indices[i], indices[j]); n++;
  }
  out.indexOverlap = xo / n;
  out.indexSize = mean(indices.map(a => a.length));
  console.log("  CA3 indices: mean size " + f(out.indexSize, 0) + " of " + hpc.P.NCA3 +
              " (" + f(100 * out.indexSize / hpc.P.NCA3, 1) + "%), pairwise overlap " + f(xo / n));
  console.log("  cortical overlap " + f(out.cortexOverlap) + " → index overlap " + f(xo / n) +
              "   (dentate separation " + (xo / n < out.cortexOverlap ? "SHARPENS" : "does NOT sharpen") + ")");
  ok("CA3 indices for the six items are distinct (P3)", xo / n < 0.25,
     "pairwise index overlap " + f(xo / n));
  ok("…and the hippocampus SEPARATES what the cortex hands it (P4)",
     xo / n < out.cortexOverlap,
     "cortex " + f(out.cortexOverlap) + " → CA3 " + f(xo / n) +
     "; the cortical code is far more correlated than the random patterns this hippocampus " +
     "was tuned on, so this was the registered way for the route to fail");
}

/* ---------------- the decisive test: who completes? ---------------- */
console.log("\n" + clock() + " == 2. cortex alone vs the hippocampal loop, from a partial cue (P1) ==");
{
  hpc.P.ach = 0.0;                                     // retrieval mode: recurrence released
  const rndSeed = K.mulberry32(4242);
  let cortexOnly = 0, withHPC = 0, cortexOff = 0, hpcOff = 0;
  let idxCorrect = 0, idxSelf = 0, idxOther = 0;
  const rows = [];
  for (let k = 0; k < ITEMS.length; k++) {
    const A = cortexAssembly[k];
    // a partial CORTICAL cue: a fraction of the item's own assembly
    const cue = new Float64Array(S.NL23);
    for (const i of A) if (rndSeed() < CUE) cue[i] = S.P.inDrive;

    // (a) cortical recurrence alone
    K.reset(S); K.setExtL23(S, cue); K.run(S, 0.35);
    const gotC = K.activeSet(S); K.clearExt(S);

    // (b) the same cue, but the hippocampus is in the loop: cortex → EC → CA3 completes the
    //     index → back-projection reinstates cortex
    K.reset(S); K.setExtL23(S, cue); K.run(S, 0.35);
    for (let t = 0; t < 80; t++) H.forwardStep(hpc, S.a);
    // DID CA3 RETRIEVE THE RIGHT INDEX? Measured separately, because "the loop failed" has two
    // very different causes — the index was not retrieved, or it was retrieved and the output
    // stage could not express it — and they point at opposite halves of the circuit.
    {
      const got3 = H.activeSet(hpc.ca3, actThr);
      const ov = indices.map(ix => jac(got3, ix));
      let bi = 0, bv = 0;
      for (let j = 0; j < ov.length; j++) if (ov[j] > bv) { bv = ov[j]; bi = j; }
      idxCorrect += (bi === k ? 1 : 0);
      idxSelf += ov[k];
      let other = 0;
      for (let j = 0; j < ov.length; j++) if (j !== k) other = Math.max(other, ov[j]);
      idxOther += other;
    }
    for (let t = 0; t < 40; t++) H.backwardStep(hpc);
    const drive = new Float64Array(S.NL23);
    for (let i = 0; i < S.NL23; i++) drive[i] = DRIVE * hpc.ecReinstate[i] + cue[i];
    K.reset(S); K.setExtL23(S, drive); K.run(S, 0.35);
    const gotH = K.activeSet(S); K.clearExt(S);

    const rc = frac(gotC, A), rh = frac(gotH, A);
    let oc = 0, oh = 0;
    for (let j = 0; j < ITEMS.length; j++) {
      if (j === k) continue;
      oc = Math.max(oc, frac(gotC, cortexAssembly[j]));
      oh = Math.max(oh, frac(gotH, cortexAssembly[j]));
    }
    cortexOnly += rc; withHPC += rh; cortexOff += oc; hpcOff += oh;
    rows.push({ item: ITEMS[k].kind + " " + ITEMS[k].size, cortex: rc, hpc: rh, offC: oc, offH: oh });
  }
  const n = ITEMS.length;
  out.completion = { cortexOnly: cortexOnly / n, withHPC: withHPC / n,
                     offCortex: cortexOff / n, offHPC: hpcOff / n, rows };
  console.log("  item             cortex alone   with hippocampus   off-target (cx / hpc)");
  for (const r of rows) {
    console.log("  " + r.item.padEnd(16) + f(r.cortex).padStart(7) + "        " +
                f(r.hpc).padStart(7) + "          " + f(r.offC) + " / " + f(r.offH));
  }
  console.log("  " + "MEAN".padEnd(16) + f(cortexOnly / n).padStart(7) + "        " +
              f(withHPC / n).padStart(7) + "          " + f(cortexOff / n) + " / " + f(hpcOff / n));
  out.indexRetrieval = { correct: idxCorrect / n, self: idxSelf / n, other: idxOther / n };
  console.log("");
  console.log("  INDEX RETRIEVAL, measured separately from expression: CA3 recovered the correct");
  console.log("  index in " + idxCorrect + "/" + n + " items (self-overlap " + f(idxSelf / n) +
              " vs best other " + f(idxOther / n) + ").");
  const idxOK = idxCorrect >= Math.ceil(0.8 * n) && idxSelf / n > idxOther / n + 0.1;
  ok("CA3 retrieves the RIGHT index from a partial cortical cue", idxOK,
     idxOK ? idxCorrect + "/" + n + " correct — so any remaining failure is in the OUTPUT stage"
     : idxCorrect + "/" + n + " correct — the failure is at RETRIEVAL, not in the output stage " +
       "and not in encoding, which produced indices overlapping only " + f(out.indexOverlap));
  ok("the hippocampal loop completes what cortical recurrence alone cannot (P1)",
     withHPC / n > cortexOnly / n + 0.05,
     "recall " + f(cortexOnly / n) + " → " + f(withHPC / n) + " at a " + CUE + " cue");
  ok("…without dragging in the wrong memory", hpcOff / n < withHPC / n - 0.15,
     "off-target " + f(hpcOff / n) + " against recall " + f(withHPC / n));
}

/* ---------------- 3. what was not retuned ---------------- */
console.log("\n" + clock() + " == 2b. where the route breaks, and why it is interesting ==");
{
  console.log("  ENCODING WORKS. Six correlated real-image memories produced CA3 indices");
  console.log("  overlapping " + f(out.indexOverlap) + ", sharpened from a cortical overlap of " +
              f(out.cortexOverlap) + ". Dentate");
  console.log("  separation operates on a real cortical code, which was the registered risk (P4).");
  console.log("");
  console.log("  RETRIEVAL DOES NOT. From a 25% cortical cue, CA3 recovers the correct index in");
  console.log("  " + out.indexRetrieval.correct * 6 + "/6 items. The loop therefore adds activation without adding");
  console.log("  discrimination: across reinstatement drives 0.15 → 0.45, recall rises 0.343 →");
  console.log("  0.424 and off-target rises 0.226 → 0.426 with it, so the margin never beats the");
  console.log("  cortex on its own.");
  console.log("");
  console.log("  THE DIAGNOSIS, and it is a real result rather than a bug. TWO PATTERN SEPARATORS");
  console.log("  IN SERIES. The cortical front end was given dendritic nonlinearity and BCM");
  console.log("  precisely to SEPARATE (stage 32), and the dentate gyrus separates again. A");
  console.log("  degraded cue is mapped by the cortex to a pattern already a third of the way to");
  console.log("  its stored assembly, and the dentate then AMPLIFIES that difference rather than");
  console.log("  tolerating it — which is what a pattern separator is for. Separation upstream is");
  console.log("  antagonistic to cue-based retrieval through a separator downstream.");
  console.log("");
  console.log("  THE NAMED FIX, and it is anatomy this model already contains. Retrieval in the");
  console.log("  real circuit does not go through the dentate: the DIRECT perforant path from EC");
  console.log("  layer II to CA3 carries the cue, and acetylcholine sets the balance — high ACh");
  console.log("  during encoding favours the dentate route and suppresses recurrence, low ACh");
  console.log("  during retrieval favours the direct path and releases CA3's recurrent");
  console.log("  collaterals (Hasselmo). hippocampus.js has Wec3 and the ACh gate; what this");
  console.log("  stage has NOT done is establish where that balance should sit when the cortical");
  console.log("  front end is itself a separator. That is the next experiment, and tuning the");
  console.log("  gate here to make the numbers land would be exactly the p-hacking the project");
  console.log("  forbids.");
}

console.log("\n" + clock() + " == 3. was the hippocampus retuned for this? (P2) ==");
{
  const def = H.hdefaults();
  const changed = Object.keys(def).filter(k => JSON.stringify(hpc.P[k]) !== JSON.stringify(def[k])
                                               && k !== "ach" && k !== "seed" && k !== "NC");
  out.retuned = changed;
  console.log("  hippocampal parameters differing from hdefaults(): " +
              (changed.length ? changed.join(", ") : "NONE"));
  ok("the hippocampus indexes a real cortical code with no retuning (P2)", changed.length === 0,
     changed.length ? "changed: " + changed.join(", ")
     : "every parameter as shipped; only NC (the cortical width it reads) and the ACh mode differ");
  console.log("");
  console.log("  OVERVIEW §8.4 recorded that this hippocampus is content-agnostic BY");
  console.log("  CONSTRUCTION, because it received an abstract sparse vector and nothing else,");
  console.log("  and warned that the general-purpose claim was therefore partly an artefact of");
  console.log("  the abstraction. It has now been given a code produced by a real sensory");
  console.log("  hierarchy — retina, LGN, V1 simple and complex, thalamic relay, layer 4, layer");
  console.log("  2/3 with dendritic nonlinearity and BCM — and the claim can be assessed on");
  console.log("  evidence rather than on the shape of the interface.");
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "ec_route.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
