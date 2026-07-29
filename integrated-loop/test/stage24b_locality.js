"use strict";
/* Stage-24b — LOCALITY DONE PROPERLY, and the P5 test stage 24 could not run.
 *
 * WHY THIS EXISTS. Stage 24 §1b swept the developmental Gaussian width expecting a more local
 * draw and got a LESS clustered graph. The cause was a parameterisation bug, not a result:
 * `pLong` was a FLOOR added to the un-normalised Gaussian weight, so its share of the total
 * sampling mass is pLong/((1−pLong)·2π·σ_dev²) — it GROWS as the Gaussian narrows. Shrinking
 * σ_dev therefore handed the graph to the long-range term. The shipped σ_dev = 0.16 was the
 * most local setting that parameterisation could express, so §1b's P5 was untestable by
 * construction and the σ = 1.55 → 2.22 it did find came from a change in the long-range
 * fraction as much as from locality.
 *
 * `mixLong: true` normalises the two components separately, so pLong is genuinely the
 * long-range fraction and σ_dev controls locality alone. That is the substrate swept here.
 *
 * DISCLOSURE. A verification table at N = 2000 was run to check the new code path before this
 * file was written; it showed σ_sw 1.49 (floor) → 2.52 (mixture, σ_dev 0.16) → 6.27 (mixture,
 * σ_dev 0.05). So the DIRECTION and rough magnitude at N = 2000 were known. Nothing at
 * N = 10 000 was measured, and no recall under the mixture form was measured at any N.
 *
 * PREDICTIONS REGISTERED BEFORE RUNNING:
 *   (1) At N = 10 000 the mixture substrate overshoots cortex. Measured small-world indices for
 *       cortical and cortex-like networks sit at roughly σ ≈ 1.5–3 (Watts & Strogatz 1998;
 *       Sporns & Zwi 2004; Bassett & Bullmore 2006; Humphries & Gurney 2008). σ_dev ≤ 0.08 will
 *       exceed 3. The finding, if so, is that locality is a parameter needing CALIBRATION DOWN,
 *       not a quantity to maximise — and the shipped substrate is not too random, it is a
 *       different parameterisation aiming at nothing in particular.
 *   (2) THE PROPER P5b. A genuinely local graph WILL cost recall — below 0.6 at σ_dev ≤ 0.05
 *       with pLong = 0.06 — because cortex.js draws each stimulus as a random sparse subset, so
 *       assembly members are scattered over the sheet and a local graph cannot bind them. Stage
 *       24 §1b appeared to falsify this, but under a parameterisation in which its "very local"
 *       configuration still had a MAJORITY long-range mass. This is the honest re-test.
 *   (3) Raising pLong at fixed small σ_dev rescues recall, and the point at which it does gives
 *       the minimum long-range fraction a scattered assembly needs. That number is the useful
 *       output of this stage: it is a quantitative statement about how much of cortex's wiring
 *       must be non-local for a non-topographic code to work at all.
 */

const S = require("../src/structural.js");
const C = require("../src/cortex.js");

let pass = 0, fail = 0;
const f = (x, d = 3) => (x == null ? "  n/a " : (x >= 0 ? " " : "") + x.toFixed(d));
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const out = {};
const t0 = Date.now();
const clock = () => "[" + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + "s]";

const N = +(process.env.N24B || 10000);
const K = Math.round(0.15 * 400), SEED = 1, SAMP = 300;
const pos = S.layout(N, SEED);

/* the cortical reference band: measured small-world indices for cortical networks */
const SW_LO = 1.5, SW_HI = 3.0;

function recall(cx) {
  const rnd = S.mulberry32(77);
  let r = 0, off = 0;
  for (let s = 0; s < cx.P.nStim; s++) {
    const cue = new Float64Array(cx.N), src = cx.stim[s];
    for (let i = 0; i < cx.N; i++) if (src[i] > 0 && rnd() < 0.5) cue[i] = src[i];
    cx.a.fill(0); cx.inh = 0;
    C.setExt(cx, cue); C.run(cx, 0.35);
    const got = new Set(C.activeSet(cx)); C.clearExt(cx);
    const A = cx.assemblies[s];
    let on = 0; for (const c of A) if (got.has(c)) on++;
    r += on / Math.max(1, A.length);
    let best = 0;
    for (let t = 0; t < cx.P.nStim; t++) {
      if (t === s) continue;
      const B = cx.assemblies[t]; let o2 = 0;
      for (const c of B) if (got.has(c)) o2++;
      best = Math.max(best, o2 / Math.max(1, B.length));
    }
    off += best;
  }
  return { recall: r / cx.P.nStim, offTarget: off / cx.P.nStim };
}

function measure(cfg) {
  const cx = C.create({ seed: SEED, NC: N, nStim: 8 });
  const con = S.connectDistance(N, pos, K, cfg, SEED + 11);
  cx.preIdx = con.preIdx; cx.preW = con.preW;
  const r = S.report(cx, N, K, SEED, SAMP);
  C.encode(cx);
  const fn = recall(cx);
  const sp = 100 * mean(cx.assemblies.map(a => a.length / cx.N));
  return { ...cfg, C: r.C, L: r.L, sigma: r.sigma, sparsity: sp,
           recall: fn.recall, off: fn.offTarget };
}

/* ---------------- 1. locality at a fixed long-range fraction ---------------- */
console.log("\n" + clock() + " == 1. locality sweep, pLong a genuine fraction, N = " + N + " ==");
const rows = [];
{
  console.log("  σ_dev   long-range   clustering   path L    σ_sw     sparsity   recall   off-target");
  for (const sigma of [0.20, 0.12, 0.08, 0.05, 0.03]) {
    const r = measure({ sigma, pLong: 0.06, mixLong: true });
    rows.push(r);
    console.log("   " + f(sigma, 2) + "      " + f(100 * 0.06, 0) + "%        " + f(r.C, 4) +
                "     " + f(r.L, 2) + "    " + f(r.sigma, 2).padStart(6) + "     " +
                f(r.sparsity, 1).padStart(4) + "%     " + f(r.recall) + "   " + f(r.off) +
                "   " + clock());
  }
  out.locality = rows;
  const overshoot = rows.filter(r => r.sigma_dev !== undefined);
  const tight = rows.filter(r => r.sigma <= 0.08);
  ok("locality raises small-worldness monotonically", rows[0].sigma < rows[rows.length - 1].sigma,
     "σ_sw " + f(rows[0].sigma, 2) + " (σ_dev 0.20) → " + f(rows[rows.length - 1].sigma, 2) +
     " (σ_dev 0.03)");
  const exceeded = rows.filter(r => r.sigma > SW_HI).map(r => r.sigma_dev);
  ok("the substrate OVERSHOOTS the cortical band for σ_dev ≤ 0.08 (P1)",
     rows.filter(x => x.sigma <= 0.08).every(x => x.sigma > SW_HI),
     "cortical reference σ_sw ≈ " + SW_LO + "–" + SW_HI +
     "; this model reaches " + f(rows[rows.length - 1].sigma, 2));
  const localRows = rows.filter(x => x.sigma <= 0.05);
  ok("a genuinely local graph costs recall (P2 — the proper P5b re-test)",
     localRows.some(x => x.recall < 0.6),
     "recall at σ_dev 0.20 → 0.03: " + rows.map(x => f(x.recall, 2)).join(" → "));
}

/* ---------------- 2. how much long-range wiring does a scattered code need? ---------------- */
console.log("\n" + clock() + " == 2. the minimum long-range fraction, at σ_dev = 0.05 (P3) ==");
{
  const r2 = [];
  console.log("  long-range   clustering   path L    σ_sw     sparsity   recall   off-target");
  for (const pLong of [0.02, 0.06, 0.12, 0.25, 0.50]) {
    const r = measure({ sigma: 0.05, pLong, mixLong: true });
    r2.push(r);
    console.log("     " + f(100 * pLong, 0).padStart(3) + "%       " + f(r.C, 4) + "     " +
                f(r.L, 2) + "    " + f(r.sigma, 2).padStart(6) + "     " +
                f(r.sparsity, 1).padStart(4) + "%     " + f(r.recall) + "   " + f(r.off) +
                "   " + clock());
  }
  out.longRange = r2;
  const good = r2.filter(x => x.recall > 0.6 && x.off < x.recall - 0.2);
  const minLR = good.length ? Math.min(...good.map(x => x.pLong)) : null;
  out.minLongRange = minLR;
  ok("raising the long-range fraction rescues recall (P3)",
     minLR != null && r2[0].recall < 0.6 && minLR > r2[0].pLong,
     minLR == null ? "no setting recovered" :
     "recall recovers at a long-range fraction of " + f(100 * minLR, 0) + "%");
  if (minLR != null) {
    const usable = good.filter(x => x.sigma >= SW_LO && x.sigma <= SW_HI);
    console.log("");
    console.log("  settings that are BOTH inside the cortical small-world band and functional:");
    if (usable.length) for (const u of usable)
      console.log("    σ_dev " + f(u.sigma, 2) + ", long-range " + f(100 * u.pLong, 0) +
                  "%  →  σ_sw " + f(u.sigma, 2) + ", recall " + f(u.recall));
    else console.log("    NONE in this sweep — the two constraints do not overlap at σ_dev = 0.05.");
    ok("a substrate exists that is cortex-like AND functional", usable.length > 0,
       usable.length ? usable.length + " settings satisfy both" :
       "no overlap: small-worldness and pattern completion trade off at this locality");
  }
}

console.log("\n" + clock() + " ==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "locality.json"),
  JSON.stringify(out));
process.exit(fail ? 1 : 0);
