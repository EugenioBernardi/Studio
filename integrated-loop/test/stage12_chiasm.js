"use strict";
/* Stage-12 — LOCALISATION. Six lesion sites along the bilateral visual pathway, each read out
   as a pair of clinical perimetry charts. The test is not "does vision degrade" but "does the
   PATTERN of loss identify the lesion site", which is what visual-field testing is for.

   The distinctions below are impossible without two retinas and a real chiasm — with a single
   retina every one of these collapses into "some of the field is missing".

     optic nerve            monocular blindness, other eye normal
     chiasm                 BITEMPORAL hemianopia — the two eyes lose OPPOSITE field halves,
                            the only defect that is non-congruous by construction
     optic tract            homonymous hemianopia — the SAME half lost in both eyes
     Meyer's loop           superior quadrantanopia ("pie in the sky"), inferior field spared
     parietal radiation     inferior quadrantanopia, superior field spared
     occipital + sparing    homonymous hemianopia with the macula preserved
*/

const P = require("../src/visualpathway.js");
let pass = 0, fail = 0;
const f = (x, d = 2) => (x >= 0 ? " " : "") + x.toFixed(d);
const ok = (n, c, d) => (c ? (pass++, console.log("  PASS  " + n + "   " + (d || "")))
                            : (fail++, console.log("  FAIL  " + n + "   " + (d || ""))));
const G = 12;
const out = {};

const quad = (uPred, vPred) => (u, v) => uPred(u) && vPred(v);
const LEFT = u => u < 0.5, RIGHT = u => u >= 0.5;
const SUP = v => v < 0.5, INF = v => v >= 0.5;
const ALL = () => true;

function report(name, les) {
  const ch = P.chartPair(les, G);
  out[name] = ch;
  const L = ch.L, R = ch.R;
  const s = (c, up, vp) => f(P.region(c, quad(up, vp || ALL)));
  console.log(`  ${name}`);
  console.log(`     left eye : left field ${s(L, LEFT)}  right field ${s(L, RIGHT)}` +
              `      right eye: left field ${s(R, LEFT)}  right field ${s(R, RIGHT)}`);
  return { L, R, reg: (c, up, vp) => P.region(c, quad(up, vp || ALL)) };
}

console.log("\n== intact ==");
{
  const r = report("intact", null);
  ok("both eyes see both fields", r.reg(r.L, LEFT) > 0.6 && r.reg(r.L, RIGHT) > 0.6 &&
     r.reg(r.R, LEFT) > 0.6 && r.reg(r.R, RIGHT) > 0.6, "");
}

console.log("\n== prechiasmal: optic nerve ==");
{
  const r = report("left optic nerve", { site: "opticNerve", side: "L" });
  ok("the affected eye is blind", r.reg(r.L, ALL) < 0.05, "left eye " + f(r.reg(r.L, ALL)));
  ok("the other eye is completely normal", r.reg(r.R, ALL) > 0.6, "right eye " + f(r.reg(r.R, ALL)));
}

console.log("\n== chiasm: the crossing fibres ==");
{
  const r = report("chiasm", { site: "chiasm" });
  // nasal retina sees the TEMPORAL field: left eye loses its LEFT field, right eye its RIGHT
  const lLost = r.reg(r.L, LEFT), lKept = r.reg(r.L, RIGHT);
  const rLost = r.reg(r.R, RIGHT), rKept = r.reg(r.R, LEFT);
  ok("left eye loses its temporal (left) field", lLost < 0.1 && lKept > 0.6, f(lLost) + " vs " + f(lKept));
  ok("right eye loses its temporal (right) field", rLost < 0.1 && rKept > 0.6, f(rLost) + " vs " + f(rKept));
  ok("BITEMPORAL: the two eyes lose OPPOSITE halves (non-congruous)",
     lLost < 0.1 && rLost < 0.1 && lKept > 0.6 && rKept > 0.6,
     "left eye loses left, right eye loses right — only possible with a chiasm");
}

console.log("\n== retrochiasmal: optic tract ==");
{
  const r = report("right optic tract", { site: "opticTract", side: "R" });
  const lLeft = r.reg(r.L, LEFT), rLeft = r.reg(r.R, LEFT);
  const lRight = r.reg(r.L, RIGHT), rRight = r.reg(r.R, RIGHT);
  ok("both eyes lose the SAME (left) field — homonymous", lLeft < 0.1 && rLeft < 0.1,
     "left eye " + f(lLeft) + ", right eye " + f(rLeft));
  ok("the right field is spared in both eyes", lRight > 0.6 && rRight > 0.6,
     f(lRight) + " / " + f(rRight));
}

console.log("\n== radiations: Meyer's loop vs parietal ==");
{
  const m = report("right Meyer's loop", { site: "meyer", side: "R" });
  const mSup = m.reg(m.L, LEFT, SUP), mInf = m.reg(m.L, LEFT, INF);
  ok("temporal lesion → SUPERIOR quadrant lost (\"pie in the sky\")", mSup < 0.1 && mInf > 0.5,
     "superior " + f(mSup) + " vs inferior " + f(mInf));

  const q = report("right parietal radiation", { site: "parietal", side: "R" });
  const qSup = q.reg(q.L, LEFT, SUP), qInf = q.reg(q.L, LEFT, INF);
  ok("parietal lesion → INFERIOR quadrant lost", qInf < 0.1 && qSup > 0.5,
     "inferior " + f(qInf) + " vs superior " + f(qSup));
  ok("the two radiations give OPPOSITE quadrants", (mSup < 0.1 && qInf < 0.1) && (mInf > 0.5 && qSup > 0.5),
     "Meyer superior / parietal inferior");
}

console.log("\n== occipital, with and without macular sparing ==");
{
  const a = report("right occipital", { site: "occipital", side: "R" });
  const b = report("right occipital, macula spared", { site: "occipital", side: "R", macularSparing: true });
  // the fovea STRADDLES the vertical meridian, so foveal sensitivity must be measured inside
  // the AFFECTED hemifield — averaging across the meridian mixes in the intact side and makes
  // an unspared macula look preserved (measured: 0.69 instead of 0.04)
  const fov = (c) => P.region(c, (u, v) => LEFT(u) && Math.hypot(u - 0.5, v - 0.5) < 0.16);
  const perL = (c) => P.region(c, (u, v) => LEFT(u) && Math.hypot(u - 0.5, v - 0.5) > 0.3);
  console.log("     fovea: plain " + f(fov(a.L)) + "  ·  spared " + f(fov(b.L)) +
              "      blind periphery: plain " + f(perL(a.L)) + "  ·  spared " + f(perL(b.L)));
  ok("plain occipital lesion takes the macula too", fov(a.L) < 0.4, "= " + f(fov(a.L)));
  ok("macular sparing preserves the fovea", fov(b.L) > 0.6, "= " + f(fov(b.L)));
  ok("…while the peripheral hemifield stays blind", perL(b.L) < 0.1, "= " + f(perL(b.L)));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====\n");
require("fs").writeFileSync(require("path").join(__dirname, "..", "figures", "chiasm.json"),
  JSON.stringify({ G, charts: out }));
process.exit(fail ? 1 : 0);
