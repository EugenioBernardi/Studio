# Candidate hypotheses, vetted for novelty BEFORE building

*The correction from `ANTERIOR-THALAMUS.md`: novelty was the binding constraint in three of four
cases and cost minutes to check against weeks to implement. So this file exists before any code.
Each candidate is scored on the three criteria in order, and the novelty check is recorded with
what was searched — including for the candidates where the check has NOT yet been done, which are
marked as such rather than presented as vetted.*

---

## 1. Accelerated long-term forgetting as hijacked consolidation — **RECOMMENDED**

### The orphaned finding

**Accelerated long-term forgetting (ALF).** Normal memory up to ~30–60 minutes after learning, then
an abnormally steep loss over the following hours to weeks. Standard neuropsychology, which tests
at 30 minutes, reports these patients as *normal*.

Mameniškienė et al., *Brain Sci* 2020 ([10.3390/brainsci10120945](https://doi.org/10.3390/brainsci10120945)),
reviewing 51 group studies: ALF "is likely a disorder of late memory consolidation", has
"contradictory associations with seizures, epileptiform activity, imaging data, sleep, and
antiepileptic medication", and "further research is needed to explore the mechanisms of cellular
impairment in ALF". **A review explicitly naming the mechanism as unknown.**

### The mechanism that is measured but not modelled

Gelinas, Khodagholy, Thesen, Devinsky & Buzsáki, *Nat Med* 2016
([10.1038/nm.4084](https://doi.org/10.1038/nm.4084)): hippocampal interictal epileptiform
discharges (IEDs) correlate with impaired consolidation and are "precisely coordinated with spindle
oscillations in the prefrontal cortex during NREM sleep. **This coordination surpasses the normal
physiological ripple-spindle coupling and is accompanied by decreased ripple occurrence.**" They
conclude IEDs impair memory "via the **misappropriation of physiological mechanisms** for
hippocampal-cortical coupling". Confirmed in four human subjects with focal epilepsy.

So IEDs do not merely add noise — they **out-compete physiological ripples for the coupling
channel**. That is a mechanism-level claim, measured in rats and humans, with no model attached.

### 2026 UPDATE — the mechanism is worse than "blocking", and this sharpens the hypothesis

Uehara, Barcelon, Shigeto, Mukaino, Okadome, Mukae, Sakata, Murai, Tobimatsu, Isobe & Kira,
*Clin Neurophysiol Pract*, April 2026 ([10.1016/j.cnp.2026.04.005](https://doi.org/10.1016/j.cnp.2026.04.005)).
Ten TLE patients, simultaneous intracranial and scalp EEG during NREM. Hippocampal IEDs:

- **induced** frontal spindles 0.4–0.8 s after the discharge,
- **increased** slow-oscillation incidence within ±0.4 s across regions,
- and — the decisive number — **"phase consistency and amplitude modulation of spindle-SO coupling
  were HIGHER for IED-coupled than for uncoupled spindles"**.

Their keyword list includes *accelerated long-term forgetting*. So IEDs do not degrade the coupling
machinery; they **drive it harder than physiology does**. The channel is not blocked — it is fired
with the wrong payload.

### The hypothesis, revised in light of that

**IED-driven coupling events are structurally intact and semantically empty.** The slow
oscillation–spindle machinery fires, with *better* phase consistency than physiological events, but
carries no valid hippocampal replay. The hippocampal trace then decays at its normal rate (**hence
normal recall at 30 minutes**) while little accrues cortically (**hence catastrophic loss at
days**).

**The prediction that makes this worth modelling — an inverted biomarker.** Because IED burden
*raises* spindle density and *raises* SO–spindle coupling strength while *lowering* retention, the
standard consolidation biomarkers are not merely insensitive in epilepsy, they point the wrong way.
The valid measure is the **fraction of coupling events that carry replay**, not the strength of the
coupling. This is a direct, quantitative explanation for the "contradictory associations" the 2020
review reports, and it is testable on intracranial datasets that already exist.

### The three criteria

1. **Biological plausibility — high.** Every component is measured: IED–spindle coordination,
   reduced ripple occurrence, impaired consolidation, in both rat and human.
2. **Novelty — checked, including 2020–2026, and clear.** Computational models of ALF: two hits,
   neither mechanistic — Bianco et al. 2023, a statistical-learning model of auditory sequence
   memory that explicitly *contrasts* itself with verbal ALF
   ([10.1016/j.crneur.2023.100115](https://doi.org/10.1016/j.crneur.2023.100115)), and O'Connor
   et al. 2020, event-based *staging* with ALF as a measure not a mechanism
   ([10.1186/s13195-020-00695-2](https://doi.org/10.1186/s13195-020-00695-2)). A 2020–2026 search
   for *computational model + epilepsy + memory consolidation + replay* returns **zero results**.
   A 2020–2026 search for *ALF + sleep spindles + epilepsy* returns exactly **one** paper — Uehara
   2026 above, which is empirical. The field is active (180 ALF papers since 2021) and entirely
   experimental. **The modelling gap is wide open and is getting more, not less, interesting.**
3. **Clinical relevance — strong in epilepsy, promising but NOT established in Alzheimer's.**
   (a) Epilepsy: ALF is missed by standard 30-minute testing, so it is systematically
   underdiagnosed; and the inverted-biomarker prediction above bears directly on how sleep EEG is
   read in these patients. (b) Alzheimer's: O'Connor et al. found ALF was the first cognitive
   change detectable in familial AD mutation carriers, "up to 10 years before estimated symptom
   onset". **Temper this.** Horakova, Fendrych Mazancova & Vyhnalek, *Neurosci Biobehav Rev*, April
   2026 ([10.1016/j.neubiorev.2026.106701](https://doi.org/10.1016/j.neubiorev.2026.106701)) review
   exactly these paradigms and conclude that "none currently fulfills the criteria for routine
   clinical implementation", with the strongest evidence going to the Memory Binding Test and the
   Loewenstein-Acevedo scales rather than to accelerated forgetting. An earlier draft of this file
   called the AD case "unusually strong and doubled"; that overstated it. The epilepsy case is the
   solid one and the AD case is a plausible extension, not a second pillar.

### Why this one is buildable here, and the trap to avoid

It runs on machinery already validated in this repo: `hippocampus.js` (ripples, replay),
`consolidate.js` (cortico-cortical transfer), `night.js`. Nothing needs inventing.

**The trap, and it is stage 41's trap exactly.** "Fewer writes → less cortical weight" is
arithmetic, not a finding — stage 41 retracted a whole line for exactly that. So the trivial claim
(block consolidation, get late forgetting) must not be reported as a result. The non-trivial,
falsifiable claims are:

- **C1 (the phenomenon must EMERGE, not be assumed).** The crossover — indistinguishable at 30 min,
  severely impaired at 1 week — must fall out of the interaction between a decaying hippocampal
  trace and an accruing cortical one, with the short-delay normality *derived*, not imposed.
- **C2 (the discriminating control, pre-specified).** Hold IED **rate** exactly constant and vary
  only their **coupling** to ripples. If matched-rate/uncoupled IEDs are harmless and
  matched-rate/ripple-coupled IEDs produce ALF, the claim stands. If rate alone does the work, it
  is a drive story and the hypothesis is dead. *This is the control stage 41 lacked, built in from
  the start.*
- **C3 (resolves the literature).** Across simulated cohorts, correlation of ALF severity with IED
  rate should be weak and unstable, while correlation with coupling fraction is strong — the
  quantitative explanation for "contradictory associations".
- **C4 (dose).** Reproduce the timescale, not just the direction: normal at 30 min is a specific
  quantitative target, not a sign.

---

## 2. The dentate/CA3 hyperactivity paradox — **partly occupied**

Bakker, Albert, Krauss, Speck & Gallagher, *Neuroimage Clin* 2015
([10.1016/j.nicl.2015.02.009](https://doi.org/10.1016/j.nicl.2015.02.009)): in amnestic MCI, DG/CA3
is **hyper**active, and *reducing* activity with low-dose levetiracetam **improves** memory —
62.5 mg and 125 mg BID work, **250 mg does not**.

- **Plausibility** high; **clinical relevance** very high (an actual therapeutic window).
- **Novelty — partly occupied.** The paper already advances the computational interpretation:
  hyperactivity reflects a shift toward CA3 pattern completion at the expense of DG pattern
  separation. That account is stated, so restating it is not a contribution.
- **What is genuinely unexplained: the inverted U.** Why does more suppression stop helping and
  start hurting? That is a specific, quantitative, unmodelled feature and a real target. Weaker
  than candidate 1 only because the surrounding framework is already built.

---

## 3–5. Not yet checked — listed so they are not mistaken for vetted

- **Transient global amnesia.** Punctate CA1 lesions, complete anterograde amnesia, full recovery in
  hours. Striking and probably unmodelled — **novelty not yet searched.**
- **Spindle deficit in schizophrenia** (Manoach/Stickgold; TRN dysfunction). Overlaps the
  **retracted** stage 38–41 line; would need care that the retracted confound is not reintroduced.
  **Novelty not yet searched.**
- **The residual subiculum question** from `ANTERIOR-THALAMUS.md`: why subicular place cells died
  with CA1 intact. Best remaining discriminator is whether surviving subicular cells are the least
  directionally tuned — but that needs the animals' data, not a simulation.

---

## Recommendation

**Candidate 1.** It is the only one where a review names the mechanism as unknown, a Nature Medicine
paper supplies a measured mechanism with no model attached, the machinery already exists and is
validated here, the clinical payoff is large and independently doubled by the Alzheimer's finding,
and the discriminating control (C2) can be specified before a line of code is written.
