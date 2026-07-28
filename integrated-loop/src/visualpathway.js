"use strict";
/* =====================================================================
   Bilateral visual pathway with a real optic chiasm.

   Until now "hemianopia" was modelled by masking half of one retina — which is a RETINAL
   lesion, not a hemianopia. A homonymous hemianopia is defined by the crossing: it is a
   retrochiasmal lesion that costs the same hemifield in BOTH eyes. Without two retinas and a
   chiasm the classical defects are indistinguishable, and visual-field testing stops being a
   localising tool.

   OPTICS AND CROSSING (worked through, because it is easy to get backwards):
     The lens inverts, so a point in the LEFT visual field lands on the RIGHT side of each
     retina. For the LEFT eye that side is NASAL (the nose lies to its right); for the RIGHT
     eye the same side is TEMPORAL. Nasal fibres cross at the chiasm, temporal fibres do not.
     Therefore  LEFT field → left-eye NASAL (crossed) + right-eye TEMPORAL (uncrossed)
                           → RIGHT optic tract → RIGHT LGN → RIGHT V1.
     The right hemisphere sees the left world, via one crossed and one uncrossed input.

   RADIATIONS: inferior retinal fibres (which carry the SUPERIOR visual field) sweep forward
   through the temporal lobe as MEYER'S LOOP; superior retinal fibres (INFERIOR field) run
   through the parietal lobe. This is why a temporal lesion gives "pie in the sky".

   Lesion any site and the field charts for the two eyes come out as they do in clinic.
   ===================================================================== */

const V = require("./vision.js");
const N = V.N;

const EYES = ["L", "R"];
const SIDES = ["L", "R"];                       // hemispheres

/* Which fibre class carries field point (x,y) from a given eye?
   x < N/2 is the LEFT visual field. */
const isLeftField = x => x < N / 2;
function fibre(eye, x) {
  const left = isLeftField(x);
  // left field lands nasally in the left eye, temporally in the right eye
  const nasal = (eye === "L") ? left : !left;
  return { nasal, crosses: nasal, hemisphere: left ? "R" : "L" };
}
/* superior visual field (small y) is carried by INFERIOR retina → Meyer's loop (temporal lobe) */
const isSuperiorField = y => y < N / 2;
const radiation = y => (isSuperiorField(y) ? "meyer" : "parietal");

/* ---- lesion specification ----
   { site: 'opticNerve'|'chiasm'|'opticTract'|'meyer'|'parietal'|'occipital',
     side: 'L'|'R'        (eye for opticNerve, hemisphere otherwise)
     macularSparing: bool (occipital only) }                                        */
function blocked(les, eye, x, y) {
  if (!les) return false;
  const fb = fibre(eye, x);
  const foveal = Math.hypot(x - N / 2, y - N / 2) < N * 0.13;
  switch (les.site) {
    case "opticNerve":  return eye === les.side;                       // whole eye
    case "chiasm":      return fb.nasal;                               // crossing fibres, both eyes
    case "opticTract":  return fb.hemisphere === les.side;             // everything to one hemisphere
    case "meyer":       return fb.hemisphere === les.side && radiation(y) === "meyer";
    case "parietal":    return fb.hemisphere === les.side && radiation(y) === "parietal";
    case "occipital":   return fb.hemisphere === les.side && !(les.macularSparing && foveal);
    default: return false;
  }
}

/* Project a visual-field image onto one eye's retina, applying the lesion.
   (The optics are already baked into the field↔retina correspondence above, so the image is
   used in field coordinates throughout — what matters here is which fibres survive.) */
function eyeInput(img, eye, les) {
  const o = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    o[y * N + x] = blocked(les, eye, x, y) ? 0 : img[y * N + x];
  return o;
}

/* What reaches a hemisphere: the contralateral hemifield, pooled over BOTH eyes
   (one crossed, one uncrossed) — this is where binocular convergence happens. */
function hemisphereInput(img, side, les) {
  const o = new Float64Array(N * N);
  for (const eye of EYES) {
    const e = eyeInput(img, eye, les);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (fibre(eye, x).hemisphere !== side) continue;
      o[y * N + x] = Math.max(o[y * N + x], e[y * N + x]);
    }
  }
  return o;
}

/* ---- perimetry: sensitivity map for ONE eye (the clinical chart) ---- */
function perimetry(eye, les, G) {
  G = G || 12;
  const map = [];
  for (let gy = 0; gy < G; gy++) { const row = [];
    for (let gx = 0; gx < G; gx++) {
      const img = new Float64Array(N * N);
      const cx = (gx + 0.5) * N / G, cy = (gy + 0.5) * N / G, r = N * 0.045;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
        if (Math.hypot(x - cx, y - cy) <= r) img[y * N + x] = 1;
      const seen = eyeInput(img, eye, les);
      const L = V.lgn(V.retina(seen));
      let e = 0; for (let i = 0; i < N * N; i++) e += Math.abs(L.signed[i]);
      row.push(e);
    }
    map.push(row);
  }
  return map;
}
/* normalise a pair of charts against the intact response */
function chartPair(les, G) {
  const base = Math.max(...perimetry("L", null, G).flat()) || 1;
  const out = {};
  for (const eye of EYES) out[eye] = perimetry(eye, les, G).map(r => r.map(v => v / base));
  return out;
}

/* mean sensitivity over a predicate region of a chart */
function region(chart, pred) {
  let s = 0, n = 0, G = chart.length;
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++)
    if (pred(gx / G, gy / G)) { s += chart[gy][gx]; n++; }
  return n ? s / n : 0;
}
const LEFTF = u => u < 0.5, RIGHTF = u => u >= 0.5;
const R = { leftField: (u) => LEFTF(u), rightField: (u) => RIGHTF(u) };

module.exports = { N, EYES, SIDES, fibre, radiation, isLeftField, isSuperiorField,
  blocked, eyeInput, hemisphereInput, perimetry, chartPair, region, LEFTF, RIGHTF };
