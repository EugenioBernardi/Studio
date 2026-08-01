# WITHDRAWN — see the retraction at the top

# Result: the olivocerebellar loop has two failure modes, and essential tremor is not the synchrony one

> ## RETRACTION
>
> **The headline finding below does not survive its own follow-up check and is withdrawn.** The
> conclusions about "two failure modes", the gap-junction dissociation (P3), and the frequency
> invariance (P5) all rest on a healthy baseline that is wrong. Details in
> `OLIVARY-LOOP-RETRACTION.md`. What survives is the sign analysis, and it is a negative result:
> **no cerebellar cortical lesion can produce olivary hypersynchrony**, because every one of them
> raises nucleo-olivary drive and therefore de-couples the olive. That is robust across coupling
> regimes and heterogeneities and it is the reason the hypothesis fails.


**4 of 5 registered rows pass. The row that fails is the informative one**, and it changes the
conclusion from the hypothesis as registered in `OLIVARY-LOOP-PREBUILD.md` into a sharper claim.

Model `models/olivary-loop.js`, tests `test/olivary-loop-test.js`, 12 seeds per condition.

## What was asked

Essential tremor's mechanism is disputed between two camps, both feedforward: the olive is a
pacemaker driving the cortex, or the olive is irrelevant and the cerebellar cortex oscillates on its
own. The registered hypothesis was that neither is right because the nucleo-olivary pathway closes
the loop: cerebellar cortical pathology raises loop gain, the loop destabilises, and the olive's
subthreshold rhythm becomes a coherent output. The olive as **resonant element**, not lesion.

## Results

| condition | olivary coherence R | complex spikes/cell | peak | tremor power |
|---|---|---|---|---|
| healthy | 0.300 | 0.94 Hz | 5.8 Hz | 2.0e-3 |
| CF→PC gain ×6 (the ET lesion) | **0.227** ↓ | **0.53 Hz** ↓ | 5.5 Hz | **6.9e-3 (×3.5)** |
| Purkinje loss 60 % | 0.221 | 0.47 Hz | 3.0 Hz | 1.0e-4 (×0.05) |
| nucleo-olivary −90 % (dentato-olivary lesion) | **0.671** ↑ | **2.04 Hz** ↑ | 7.5 Hz | 4.7e-3 |

| row | registered claim | outcome |
|---|---|---|
| P1 | ~1 Hz per-cell spiking coexists with a 4–12 Hz population rhythm | **PASS** — 0.53 Hz per cell, 5.5 Hz population peak |
| P2 | opening the loop abolishes the tremor | **PASS** — 66 % power reduction with the full lesion present |
| P3 | removing gap junctions abolishes the tremor | **FAIL** — 102 % of tremor power retained |
| P4 | CF-gain lesion → tremor; Purkinje loss → no tremor | **PASS** — ×3.5 vs ×0.05 |
| P5 | frequency invariant, amplitude scales with lesion | **PASS** — 9 % frequency variation across an 8× lesion range, 3.8× amplitude |

## The finding

**The loop's sign structure permits olivary hypersynchrony from exactly one lesion, and it is not a
cortical one.** Every cerebellar cortical lesion — raised CF→PC gain, Purkinje loss — reduces
Purkinje output, which disinhibits the nuclei, which *increases* nucleo-olivary drive, which
*increases* shunting of the olivary gap junctions and **de-couples** the olive. Coherence falls from
0.300 to 0.227. Only removing nucleo-olivary inhibition itself de-shunts the olive: coherence rises
to 0.671 and per-cell complex-spike rate doubles.

That lesion is anatomically specific — interruption of the dentato-olivary pathway, the
Guillain–Mollaret triangle lesion of **oculopalatal tremor**, which is also the one tremor where
olivary pathology (hypertrophic olivary degeneration) is actually found.

So the circuit has **two distinct failure modes**, and P3 separates them cleanly:

- **rate-limb instability** — raised CF→PC gain destabilises the fast loop (complex-spike rate →
  Purkinje pause → nuclear disinhibition → nucleo-olivary suppression of complex spikes). Produces a
  4–12 Hz output oscillation with olivary coherence *falling*. **Gap junctions contribute nothing:
  removing them retains 102 % of the tremor.**
- **synchrony-limb failure** — losing nucleo-olivary inhibition de-shunts the gap junctions and the
  olive synchronises. **Gap junctions carry it: removing them removes 57 % of the tremor.**

This adjudicates the dispute in a way neither camp states. Camp 1 is right that the olive is
necessary — P2 shows opening the loop removes two-thirds of the tremor even with the full cortical
lesion in place. Camp 2 is right that olivary hypersynchrony is not the ET mechanism, and the
long-standing "complex spikes are only ~1 Hz" objection turns out to be doubly telling: P1 shows the
objection is a category error *as an argument about population rhythms*, but the model then finds
that ET-type tremor does not need synchrony anyway. **In the ET arm the per-cell complex-spike rate
falls to 0.53 Hz — the model predicts complex-spike rate goes DOWN in ET and UP in oculopalatal
tremor.** That is an opposite-direction, measurable prediction pair.

P5 is the strongest emergent row: nothing ties tremor frequency to lesion magnitude, and frequency
moves 9 % while amplitude moves 3.8× — matching the clinical observation that ET amplitude
progresses while frequency stays stable.

## What the frequency actually depends on

Not registered, but it decides what the olive contributes:

| olivary frequency | loop delay | output peak |
|---|---|---|
| 4 Hz | 20 ms | 4.00 Hz |
| 6 Hz | 20 ms | 5.46 Hz |
| 9 Hz | 20 ms | 3.93 Hz |
| 6 Hz | 10 / 40 / 60 ms | 5.07 / 4.69 / 3.96 Hz |

The output follows the olive at 4 and 6 Hz but not at 9. The loop has a passband set by its delay
and time constants; the olive supplies the rhythm; tremor frequency is where the two overlap. That
is a mechanistic reason why tremor sits at 4–12 Hz rather than anywhere else.

## Errors found and corrected during the build, both by arithmetic

1. **Units.** The climbing-fibre volley is a per-step fraction (~0.001), so the Purkinje pause sat at
   0.001 and the loop could not move. It had to be converted to a population rate and normalised to
   the healthy anchor.
2. **Coupling below threshold.** With `ioSpread` 0.06 at 6 Hz the frequency spread is σ = 2.26 rad/s,
   so the Kuramoto critical coupling is K_c ≈ 3.6 rad/s (measured transition between 3 and 6). The
   first build used `gGap` 1.60, giving a shunted operating point of ~0.85 — **five times below
   threshold, so olivary coherence sat at 1/√40 = 0.158 in every condition and synchrony was
   impossible by construction.** An entire suite ran and reported before this was caught. The
   pre-build arithmetic covered frequency but not coupling; it should have covered both.
3. **Delay double-counting.** `loopDelay` was set to the 40–125 ms *total* loop lag quoted from
   anatomy, while `pauseTau` (35 ms) and `dcnTau` (20 ms) added their own lag on top. Corrected to
   the pure conduction delay (~20 ms), total effective lag ~75 ms.

## Limitations, stated plainly

- The tremor-band rhythm is present in health too (4–12 Hz fraction 0.64 healthy vs 0.65 lesioned).
  The lesion **amplifies an always-present rhythm ×3.5**; it does not create a de-novo oscillation.
  Calling that "instability" overstates it — it is gain, not bifurcation.
- Mean-field Kuramoto phases, not conductance-based cells. No T-type calcium, no dendritic
  compartments — the same envelope-abstraction limit that bit the previous line of work in this repo.
- The output is nuclear firing modulation. There is no thalamus, motor cortex, spinal cord or muscle,
  so "tremor power" is not a limb displacement and the model cannot speak to tremor amplitude in
  clinical units.
- `shunt`, `csSuppress`, `pauseDepth` and `cfGain` are not measured quantities. The anchors that are
  measured — 6 Hz olivary rhythm, ~1 Hz healthy complex-spike rate, ~20 ms conduction delay — were
  set by hand and claim nothing.
- The nucleo-olivary projection is treated as purely inhibitory. An excitatory nucleo-olivary
  pathway was described in 2023; it is not in this model and would change the sign analysis.

## What would falsify this

Record complex spikes in an ET model and in a dentato-olivary lesion model. **This predicts opposite
directions: rate and coherence down in ET, up in oculopalatal tremor.** If ET shows olivary
hypersynchrony, the rate-limb account is wrong. If blocking olivary gap junctions abolishes ET-type
tremor, P3's failure was a model artefact rather than a finding.
