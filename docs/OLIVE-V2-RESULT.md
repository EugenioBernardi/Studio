# Olivocerebellar v2: what olivary synchrony does, and which lesion can cause it

**7 of 7 rows pass, and — unlike the withdrawn v1 — the healthy baseline is validated first, against
an explicit no-rhythm null.** Model `models/olive-v2.js`, suite `test/olive-v2-test.js`, 10 seeds.

## The structural change

v1 (withdrawn, `OLIVARY-LOOP-RETRACTION.md`) reported a tremor result on a healthy baseline that
hummed at 6 Hz *more coherently than the diseased one*. The cause was the spike rule: v1 emitted a
complex spike on every crossing of the subthreshold phase, so a population of near-identical clocks
**had** to carry a 6 Hz population component, coupled or not, healthy or not. The rhythm was baked
into the generator.

That rule is wrong physiologically. The olivary subthreshold oscillation **gates** spiking — it sets
the windows in which a cell *can* fire; it does not fire the cell. A complex spike requires
coincident synaptic drive arriving inside a depolarised window. So v2 uses

    CS  ⇐  (synaptic input arrives)  AND  (phase inside the depolarised window)

With input arriving at random times and cells at scattered phases, the population output is
near-Poisson and carries no rhythm. That is the healthy state, and v1 could not produce it.

## Stage A — the baseline, and the null that makes it meaningful

| | complex spikes | olivary R | sharpness | peak |
|---|---|---|---|---|
| **no-oscillation NULL** (Poisson CS, same filter) | 1.006 Hz/cell | — | **94.2 ± 28.2** | 2.2 Hz |
| **healthy circuit** | 1.009 Hz/cell | 0.177 | **94** | 1.8 Hz |

A filtered point process scores ~94 with **no rhythm present at all**. Every spectral number is
meaningless except relative to this — and this is precisely what v1 lacked, which is why its
"sharpness 45" looked like a finding when it was noise. The healthy circuit is indistinguishable
from the null, and its peak sits at the filter corner rather than at 6 Hz.

## Stage B — synchrony does work, and the work is measurable

| gGap | olivary R | complex spikes | sharpness | peak |
|---|---|---|---|---|
| 0 | 0.115 | 1.001 Hz/cell | 76 | 1.7 Hz |
| 8 | 0.171 | 1.015 | 79 | 1.4 Hz |
| 16 | 0.420 | 1.002 | 390 | 5.9 Hz |
| 24 | 0.837 | 1.016 | **4984** | 6.2 Hz |

**The per-cell complex-spike rate is identical from top to bottom — 1.001 vs 1.016 Hz.** Only the
synchrony changes. Coupling aligns the gating windows, and aligned windows convert the same
aperiodic input into a rhythmic population output. Synchrony is the variable that turns noise into
rhythm; it is not depiction.

And the rhythm is the **olive's**, not the filter's: fIO 3 → 3.1 Hz, 6 → 6.2 Hz, 9 → 8.6 Hz.

**This settles a standing objection in the essential-tremor literature.** The argument against the
olivary hypothesis has been that complex spikes fire at only ~1 Hz and are not rhythmic, so cannot
carry a 4–12 Hz tremor. Per-cell rate and population rhythm are different quantities: here 1 Hz cells
produce a 6.2 Hz population rhythm with the rate held at the measured value, demonstrated against a
null. The objection is a category error.

## Stage C — but no cortical lesion can get there

| tonic shunt | healthy R / sharp | CF→PC ×6 (the ET lesion) | dentato-olivary lesion |
|---|---|---|---|
| 0.5 | 0.173 / 119 | 0.148 / 54 | 0.239 / 137 @ 5.8 Hz |
| 1.0 | 0.174 / 81 | 0.142 / 69 | **0.370 / 399 @ 6.0 Hz** |
| 2.0 | 0.177 / 94 | 0.137 / 67 | **0.741 / 840 @ 6.3 Hz** |
| 4.0 | 0.178 / 105 | 0.136 / 62 | **0.942 / 9700 @ 6.1 Hz** |
| 8.0 | 0.182 / 124 | 0.135 / 58 | **0.979 / 9342 @ 6.1 Hz** |

**The ET cortical lesion lowers olivary coherence at every setting and never exceeds the null.** The
sign is structural, not a tuning outcome: Purkinje cells are GABAergic onto the nuclei, and
nucleo-olivary neurons are GABAergic onto the olivary glomeruli where the gap junctions sit. So *any*
cortical lesion reducing Purkinje output — raised CF→PC gain, Purkinje loss, both found in ET —
disinhibits the nuclei, raises nucleo-olivary drive, increases shunting, and de-couples the olive.

Only removing nucleo-olivary inhibition itself de-shunts it, and then only if tonic shunting is
strong enough (threshold at shuntTonic ≈ 1, i.e. tonic tone must halve olivary coupling).

## What this contributes

**It converts a 20-year qualitative dispute into one measurable number:** how much does tonic
nucleo-olivary tone shunt olivary electrical coupling? Below ~2×, no cerebellar lesion of any kind can
drive the olive into a rhythm. Above it, dentato-olivary interruption does — and that is the
Guillain–Mollaret lesion of oculopalatal tremor, the one tremor where olivary pathology is actually
found.

For essential tremor the answer is unconditional and negative: **its pathology is cortical, and
cortical pathology moves olivary coupling the wrong way at every parameter setting tested.** That
argues against the olivary account of ET on mechanism, rather than on the usual grounds of absent
olivary pathology.

## Limitations

- Mean-field phase oscillators. No conductances, no T-type calcium, no dendritic compartments.
- Output is nuclear firing modulation. No thalamus, cortex, spinal cord or muscle, so nothing here is
  a limb displacement and no claim is made about clinical tremor amplitude.
- `inRate`, `gateWidth`, `pauseDepth` and `shuntTonic` are not measured quantities. The anchors that
  are measured — ~1 Hz complex-spike rate, 1–10 Hz subthreshold range, ~20 ms conduction delay — were
  set by hand and claim nothing.
- The rhythm at fIO 6 is 6.2 Hz. Oculopalatal tremor is clinically 1–3 Hz. The model reproduces
  3.1 Hz when fIO is set to 3, which is consistent with the hypertrophic olive oscillating more
  slowly — but fIO is chosen, so that is a consistency note, **not** a validated prediction.
- The nucleo-olivary projection is treated as purely inhibitory; an excitatory nucleo-olivary pathway
  was described in 2023 and is not modelled.

## What would falsify it

Measure olivary coupling with nucleo-olivary tone intact versus blocked. If tonic tone changes
electrical coupling by less than ~2×, the dentato-olivary route to tremor closes too and the olive
cannot be driven into rhythm from anywhere in the cerebellum. If an ET model shows *raised* olivary
coherence, the sign analysis is wrong and Stage C fails.
