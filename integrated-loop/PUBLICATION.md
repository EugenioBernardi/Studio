# Publishability assessment

*Written after stage 26. Covers the whole project, not just the integrated loop. The purpose is
to say what could be submitted, to where, and what specifically blocks each — not to be
encouraging.*

---

## 0. The one-paragraph verdict

**Nothing here is submittable today, and the three candidate papers are blocked by three
different things.** The strongest *scientific* unit is not any of the positive results — it is
the structural-plasticity failure sequence (stages 21–26), because it is a registered,
replicated, mechanistically diagnosed negative result about a rule the field has a working
alternative to. It needs exactly one more experiment to be publishable. The strongest
*content* is the clinical-localisation work (stages 12–18), and it is blocked by the fact that
every behavioural readout in the project sits outside its published range. The resource paper
is blocked by files that do not exist in the repository.

---

## 1. Candidate A — the structural-plasticity negative result

**This is the nearest to publishable, and the failure is why, not despite.**

### The arc, as it would be written

A distance-dependent developmental substrate plus activity-dependent prune-and-rewire, under a
fixed per-cell synapse budget, was asked to move a cortical recurrent graph toward measured
cortical network statistics. It does not, and four successive diagnoses were needed to say why —
each one registered in advance, each one wrong in an informative way:

| stage | diagnosis offered | verdict |
|---|---|---|
| 21 | the convergence-preserving rule `pRec·400/N` saturates path length | **wrong** — the rule does what it was designed to do |
| 22 | N is too small; density is 13.8% | **half right** — density falls 13.8→4.9→1.19%, σ barely moves |
| 23 | the rule is *starved* of co-activity (56% of cells have any partner) | **wrong, and inverted** — see 25 |
| 24 | the kernel `local(d)·(1+b·co)` makes distance a **gate**, not a prior | **wrong** — see 25 |
| 25 | the additive kernel `local(d)+b·co` will free it | **wrong, and destructive**: σ 1.55 → **1.26** |

The final, quantitative diagnosis: with homeostasis giving 100% participation and ~10% of cells
active per step, a cell has ~5340 co-active partners of 10 000, and **raw co-occurrence counts
are dominated by chance**. Two cells each active a tenth of the time co-occur every ~10 steps by
coincidence; over 600 sampled steps essentially every pair co-occurs. So the co-activity term is
close to a *uniform offset*, which is inert when multiplied into a distance kernel and
*randomising* when added to one. **The rule was never starved. It was swamped.**

### Where this sits in the literature — and the experiment that is missing

The field's established structural-plasticity rule is **not co-activity-driven**. Butz &
van Ooyen's homeostatic structural plasticity grows and retracts axonal and dendritic elements
to maintain a **firing-rate set-point**, combined with a short-range-favouring growth process:

- Butz M, Wörgötter F, van Ooyen A. *A model for cortical rewiring following deafferentation and
  focal stroke.* Front Comput Neurosci (2009). doi:10.3389/neuro.10.010.2009
- Butz M, van Ooyen A. *Homeostatic structural plasticity increases the efficiency of small-world
  networks.* Front Synaptic Neurosci (2014). doi:10.3389/fnsyn.2014.00007
- Butz M, Steenbuck ID, van Ooyen A. *Homeostatic structural plasticity can account for topology
  changes following deafferentation and focal stroke.* Front Neuroanat (2014).
  doi:10.3389/fnana.2014.00115

The 2014 title is almost the claim this project failed to make. Meanwhile, Hebbian structural
rules *can* reshape global topology in simpler settings:

- Damicelli F, Hilgetag CC, Hütt M-T, Messé A. *Modular topology emerges from plasticity in a
  minimalistic excitable network model.* Chaos (2017). doi:10.1063/1.4979561

**So the paper cannot be written until the Butz–van Ooyen rule is run in this same network, at
this same scale.** Without it the first reviewer asks why the standard rule was not used, and
the answer "we tried a different one and it failed" is not a paper. With it, the result is a
clean comparative claim — *co-activity-driven structural plasticity fails where homeostatic
structural plasticity succeeds, in the same network, at the same scale, and here is the
chance-correction arithmetic that explains why* — and that is publishable whichever way it lands.
The homeostatic machinery already exists (`src/homeostasis.js`); it currently adapts a threshold
and would need to adapt synapse *number*.

A second, independent contribution rides along: **stage 26's measurement finding.** Completion
was tested throughout the project with a 50% cue, and the recurrent contribution peaks at 25%
(gap 0.528 vs 0.417). The strong cue compresses the top of the range — at σ_dev 0.03 both cues
read the same gap (0.318/0.319), but at σ_dev 0.20 the sensitive cue reads 0.528 against 0.417.
This is a generalisable methods point about auto-associative recall benchmarks.

### Venue

eNeuro (which has an explicit Negative Results section), PLOS Computational Biology, or Network
Neuroscience. **Realistic timeline: one experiment away.**

---

## 2. Candidate B — clinical localisation as one circuit

**The strongest content, and the most clearly blocked.**

Stages 12–18 do something genuinely uncommon: one model, unretuned, reproduces six chiasmal
lesion sites with per-eye perimetry; the neglect *band* in lesion severity with extinction
surviving symmetric coverage; paradoxical relief of neglect by a second contralateral lesion;
material-specific memory with a 6/6-seed crossover and H.M. in one table; diencephalic amnesia
via Papez; blindsight and akinetopsia. For a neurology audience the appeal is that these are not
seven models — they are seven lesions of one model.

### The blocker, stated plainly

**Everything structural is in range; everything behavioural is out** (stage 17: 8/16). Line
bisection reads 50.6% of the half-line against a human 5–25%. Pseudoneglect has the *wrong sign*.
MST LDI 0.89 against 0.25–0.55. MT direction error 0.0° against a human floor of 1–15° — which is
worse than a large error, because it is below what a human can do.

The diagnosis is already recorded and is correct: the behavioural readouts are internal
instruments with arbitrary thresholds and scales that were never asked to land anywhere real. For
a clinical-facing paper that is fatal, because the entire claim is that the model behaves like a
patient. **This needs the readouts re-expressed in the units the clinical literature uses**, and
that is real work, not a rescaling — a bisection score must come from a simulated line-marking
act, not from a centre-of-mass proxy.

Second blocker: the stage-17 reference ranges are marked **PROVISIONAL** — recorded from the
literature but never checked against primary sources. Every calibration claim in any paper rests
on them.

### Venue

eNeuro, Journal of Neuroscience Methods, or a clinical-neuroscience education venue.
**Realistic timeline: months, gated on the instrument work.**

---

## 3. Candidate C — the resource/tools paper

The pitch would be: a dependency-free, single-file-per-app, numerically validated set of
interactive circuit simulators spanning thalamocortical sleep and epilepsy, vision, audition,
basal ganglia, cerebellum, amygdala, hippocampus and an integrated memory loop — every claim
registered in advance with pass/fail, negative results kept red on purpose.

### The blocker

**A resource paper can only describe what a reader can download.** `CLAUDE.md` already records
that the following are absent from the working tree: `hex-model.js`, `tc-model.js`,
`ventral-model.js`, `motion-model.js`, `pulvinar-gate-model.js`, `overlap-model.js`,
`VALIDATION.md`, `VISION-VALIDATION.md`, `HIGHER-ORDER-THALAMUS.md`, `claude-code-brief.md`, and
four HTML apps. The epilepsy/spike-wave results, the chronotaxis timing results and the
higher-order-thalamus negative results are therefore **unshippable**. Either they are restored or
those sections come out.

### Venue

eLife Tools and Resources, PLOS Computational Biology Software, Neuroinformatics.
**Realistic timeline: gated on file restoration, which is an archaeology problem, not science.**

---

## 4. What to do next, in order

1. **Stage 27 — the Butz–van Ooyen homeostatic structural rule**, in this network at N = 10 000,
   against the co-activity rule as the comparison arm. This is the single highest-value
   experiment in the project right now: it completes Candidate A, it is bounded, and the
   machinery is half-built. Register in advance that if the homeostatic rule *also* fails to move
   σ, the conclusion is about this network's regime (rate-coded, 60 inputs/cell, 7% sparsity),
   not about structural plasticity.

2. **Verify the 16 stage-17 reference ranges against primary sources.** Bounded, unglamorous,
   and it gates every calibration sentence in every candidate paper. Until it is done the honest
   word remains **calibrated, not validated**.

3. **Re-express the behavioural readouts in clinical units.** Bisection, cancellation, MST
   LDI/REC, MT direction error. This unblocks Candidate B and would likely move several of the
   8 out-of-range quantities without any tuning of the *model* — the instruments are what is
   wrong.

4. **Re-run the completion benchmarks at a cue of 0.25.** Stage 26 showed the standard measure
   sits off the peak of its own sensitivity curve. Earlier results are not invalidated, but any
   number that will appear in a paper should be measured where the measure can see.

5. **Path integration.** The largest scientific gap and the one that gates every spatial claim.
   Until a recurrent attractor maintains position from velocity, every "place field" in this
   project is a boundary-and-landmark tuning curve seen from the wrong side — recorded honestly
   in stage 23 and re-confirmed in stage 24, and it must not be written up as place coding.

---

## 5. The thing that is genuinely strong, and should be said

The project's method — *register the prediction, run headless, report the failure, diagnose the
mechanism, and refuse to sweep parameters until something crosses significance* — has now caught,
in this session alone: a parameterisation whose name meant the opposite of its effect; a control
that differed from its treatment in learning as well as structure; a function probe that
overwrote the weights it was about to measure; a benchmark reading off the flat part of its own
sensitivity curve; and three of my own predictions falsified, one of them twice.

That discipline is the most publishable thing here, and it is worth foregrounding in whichever
paper goes first.
