# Retraction of the olivocerebellar loop-instability result

Reported, then withdrawn on follow-up within the same session. The withdrawal came from a check I
should have run before reporting, not from new information.

## What was claimed

That the olivocerebellar loop has two failure modes — a fast rate limb whose instability produces
essential tremor without olivary synchrony, and a slow synchrony limb whose failure produces
oculopalatal tremor — separated cleanly by gap-junction block (102 % of the ET-type tremor retained,
43 % of the nucleo-olivary one).

## What killed it

**The healthy model oscillates more coherently than the diseased one.** Spectral sharpness
(peak/median power, 1–20 Hz, 40 s traces):

| configuration | healthy | CF lesion ×6 |
|---|---|---|
| spread 0.06, gGap 5.5 | **232** @ 6.0 Hz | 77 @ 5.8 Hz |
| spread 0.30, gGap 24.4 | **173** @ 6.0 Hz | 83 @ 6.3 Hz |
| spread 0.50, gGap 40.7 | **217** @ 5.8 Hz | 78 @ 6.3 Hz |

A healthy cerebellar nucleus does not carry a 6 Hz peak two orders of magnitude above its noise
floor. What the model called "tremor" was a ×3.5 **power** increase in an always-present rhythm whose
**coherence actually falls** with the lesion. That is not tremor.

Three further checks confirmed there is no configuration that rescues it:

1. **Sub-critical coupling does not quiet the baseline.** At gGap 1.0, five times below K_c ≈ 3.6,
   healthy sharpness is still 56 @ 5.0 Hz. The rhythm comes from frequency *homogeneity* — 40 cells
   all near 6 Hz, each emitting complex spikes locked to its own cycle, sum to a 6 Hz population
   modulation whether or not they are coupled.
2. **Heterogeneity does not quiet it either.** With spread 0.5 (cells spanning 3–9 Hz) *and*
   sub-critical coupling — the only configuration with a genuinely physiological olive — healthy
   sharpness is still 44.5.
3. **The peak frequency is not stable across conditions** in that configuration: 2.7 Hz healthy,
   5.8 Hz at CF ×6, 3.6 Hz at CF ×12, 3.1 Hz with the nucleo-olivary lesion. P5's "9 % frequency
   invariance" was an artefact of the homogeneous configuration, where everything locked to 6 Hz
   regardless of lesion.

I also cannot trust the sharpness metric in absolute terms: peak/median over a spectrum with a
strong low-frequency slope is large even for filtered shot noise, and I never ran a flat-spectrum
control. The comparison *between* conditions is still valid, and it is the comparison that kills the
claim.

**Separately: the oculopalatal arm had the wrong frequency and I reported it anyway.** Oculopalatal
tremor is clinically 1–3 Hz. The nucleo-olivary lesion produced 7.5 Hz. I described that arm as
corresponding to OPT without checking it against the clinical number.

## What survives

One thing, and it is the reason the hypothesis fails rather than a consolation:

**No cerebellar cortical lesion can produce olivary hypersynchrony.** Purkinje cells are GABAergic
onto the nuclei, and nucleo-olivary neurons are GABAergic onto the olivary glomeruli where the gap
junctions sit. So *any* cortical lesion that reduces Purkinje output — raised CF→PC gain, Purkinje
loss, both of which are found in ET — disinhibits the nuclei, raises nucleo-olivary drive, increases
shunting, and **de-couples** the olive. Measured: coherence 0.300 → 0.227 under the CF lesion, and
0.300 → 0.671 only when nucleo-olivary inhibition is itself removed. This held across every coupling
strength and every frequency spread tested.

That is a structural fact about the circuit's signs, not a tuning outcome, and it says something the
essential-tremor literature does not: an olivary-hypersynchrony account of ET requires a lesion of
the nucleo-olivary pathway, which is not the pathology ET has. It argues against the olivary camp on
mechanism rather than on absence of evidence.

## The methodological lesson, since this is the third in a row

The failure mode was the same shape as the previous two: I built the model, ran the registered
suite, and reported — and only afterwards asked whether the *control condition* was physiologically
sensible. A registered prediction suite says nothing if the baseline is wrong, because every row is
a comparison against it.

Add to the pre-build protocol: **state what the healthy/control condition must look like, in
measurable terms, and verify it before running any comparison.** Here that single question — "does a
healthy cerebellar nucleus have a sharp 6 Hz peak?" — was answerable in one line and would have
stopped the whole run.
