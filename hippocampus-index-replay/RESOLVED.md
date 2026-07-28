# Extraction-fidelity issues — resolved

Both issues from the original `ISSUES.md` are closed. No dynamics constant was changed (the guard
rail held); the fixes were an omitted observable and two driver conditions.

## Issue 1 — the model had no LFP observable — RESOLVED

The LFP lived in the reference viewer's step loop and was dropped in extraction. It is now
model-owned:

```js
// src/model.js, inside step()
const rip = inSWR ? 0.35 * Math.sin(TAU * 180 * tt) : 0;
lfp.push(F.CA1.mean - 0.35 * F.CA1.PV + rip);
```

`M.thetaPower()` returns the band(5–12 Hz)/total(2–40 Hz) power ratio via a direct DFT of the LFP
ring buffer; `M.lfp()` returns the current sample; `record()` captures both.

Result: theta power **0.95 intact / 0.13 septal lesion / 0.94 restored** — the reference figure,
reproduced (acceptance ≥0.70 / ≤0.40 / ≥0.70, effect ≥0.40, all met).

## Issue 2 — PV 30% did not produce runaway — RESOLVED

The runaway was real but the headless driver missed three conditions the viewer supplies. Diagnosed
by reading the reference dynamics directly (not by retuning):

1. **ACh gate.** `rec *= achRec = 1 − achK·ACh`. In `explore` (high ACh) recurrent transmission is
   suppressed by design (Hasselmo). Runaway is only possible in a **low-ACh** state (`quiet`/`sleep`).
2. **Ignition.** The diffuse collaterals are subcritical from rest; the field needs a seed —
   a cued or SWR-replayed index — to start.
3. **Window.** The recurrent loop needs seconds, not 900 ms.

With those, PV 30% gives **0.94 active, R 1.00, seizure**; PV 100% stays sparse (0.19). The
self-sustaining seizure is carried by the learned weights, so it is **impossible with `recG = 0`**
(ignite → release → decays to 0.00). Test protocols encode these conditions explicitly.

## Definition of done

- [x] `npm test` reports **12 / 12**.
- [x] README "Status of numeric reproduction" table updated; "Known issues" removed.
- [ ] Tag `v1.0.0`; mint a Zenodo DOI against the tag; add the DOI to `CITATION.cff`. *(release step — needs the repo pushed to its own GitHub remote)*
- [ ] Deposit in ModelDB. *(submission step)*
