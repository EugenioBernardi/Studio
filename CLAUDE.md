# Metastable Brain — project memory

Interactive, **numerically validated** neural circuit simulators. Every model is a real
dynamical system rendered as coupled "little clocks"; nothing is a scripted animation.

Author context: neurology resident, computational/translational neuroscience. Pitch
everything at expert level — no hedging, no simplification of the neuroscience.

---

## 1. Non-negotiable method

**Simulate first, draw second.** For every mechanism:

1. Write a headless Node prototype. Print numbers. Tune against explicit numeric targets.
2. Only then build rendering.
3. **Re-verify the shipped app reproduces the headless numbers.** This has caught real
   divergence twice.
4. Nothing that should be emergent may be scripted.
5. Report failures honestly. A negative result with a mechanism is worth more than a
   positive one without.

**Statistical discipline.** A +10% effect at 50 trials became +1.8% ± 6.4 (z=0.28) at
110. Replicate before believing. Do not sweep parameters until something crosses
significance — that is p-hacking and it nearly happened here.

---

## 2. Test-harness traps (all cost real time; do not repeat)

- **jsdom double execution.** jsdom already runs inline `<script>`. Do NOT also `eval` it
  — you get two model instances, DOM handlers on one and debug hooks on the other.
  Use `beforeParse` to install stubs. Write the harness once, reuse it.
- **try/catch hides errors from `window.onerror`.** Override `console.error` too, or
  failures inside `catch` blocks are invisible to the harness.
- **Test across playback speeds.** A detector windowed in *frames* rather than simulated
  time behaved correctly at speed 1.0 and produced constant false positives at 0.08x.
  Anything measured in frames must be tested at several speeds.
- **Stub `matchMedia`, `getBoundingClientRect`, `getContext`, `requestAnimationFrame`,
  `performance.now`** so simulated time is fully under test control.
- Stale duplicated literals: an app reset list hardcoded `som:1` after the validated
  default became 0.35, silently applying 3x too much inhibition. **Reset from
  `defaults()`, never from a copied literal.**

---

## 3. Files

| file | what it is |
|------|-----------|
| `VALIDATION.md` | thalamocortical/epilepsy validation record — all parameters and numbers |
| `VISION-VALIDATION.md` | ventral + dorsal stream validation record |
| `HIGHER-ORDER-THALAMUS.md` | pulvinar literature review + 4 experiments (mostly negative) |
| `hex-model.js` | 19-column hexagonal thalamocortical sheet (validated) |
| `tc-model.js` | earlier 3-column version |
| `ventral-model.js` | retina→LGN→V1→V2→shape |
| `motion-model.js` | V1 direction energy → V3 → V5/MT |
| `pulvinar-gate-model.js` | transthalamic gate, Jaramillo/Wang formulation |
| `overlap-model.js` | overlapping-figure stimuli + adjustable-RF V2 |
| `models/kuramoto-assembly.js` | **the project thesis as a model**: clocks, assemblies-as-synchrony, LTP/LTD as coupling plasticity (validated; runs headless) |
| `docs/ASSEMBLY-VALIDATION.md` | Kuramoto-assembly validation record — equations, parameters, 14 checks, seed sweep |
| `build/build-kuramoto-assembly.py` | inlines the assembly model into its app template |
| `*.html` | single-file apps (model inlined; edit the build script, not the HTML) |
| `claude-code-brief.md` | expandable-simulator spec **+ validated parameter blocks for chronotaxis (§6.1), basal ganglia (§6.2) and hippocampus (§6.3)** |

**Model source availability.** The thalamocortical and vision models have standalone
`.js` files. The three earliest apps (`metastable-chronotaxis`, `hippocampus-index-replay`,
`basal-ganglia-selection`) have the model **inlined in the HTML**, intertwined with the
renderer. If you need to modify one, the first task is extracting the model into a `.js`
and re-verifying it reproduces the numbers in §4 — do not edit the inlined copy blind.

Apps are built by Python scripts that inline the model into an HTML template. **Patch the
build script and the HTML together**, or the next rebuild silently reverts the fix.

---

## 4. State of each model

**Kuramoto Assembly** (`apps/kuramoto-assembly.html`, model `models/kuramoto-assembly.js`) —
the canonical statement of the project thesis, and the first model where **synchrony does
work**: the coupling that carries the synchrony is the same quantity the plasticity reads
and writes. 24 phase-clocks; assembly = a set locked in synchrony; `dK_ij ∝ cos(θ_j−θ_i)−c0`
so co-phase → LTP, anti-phase → LTD; subtractive synaptic competition (limited budget);
feedback-inhibition **repulsion** from the global mean caps runaway synchrony. Encode/retrieve
gated (plasticity on/off), as ACh gates the hippocampus.
Validated (14/14 headless, robust over 10 seeds): driving 6 clocks co-phasic writes an
assembly at **R 0.996±0.002** while the background stays at **0.097±0.072**; partial cue
(2 of 6, frozen weights) completes to **R 0.997±0.002**; the LTD/LTP rule is exact
(co→Kmax, anti→0); two assemblies coexist at distinct phases (≈179°) with cross-K ≈ 0;
an assembly survives 15 s of disuse and still recalls.
Three things not to remove: **subtractive** (not multiplicative) normalisation — it is what
makes membership crisp; **repulsive** feedback inhibition — the sign matters, `+` desyncs and
is what makes assemblies selective; and the **rotating** stimulus — a static phase cannot
entrain a rotating clock. Open: retroactive interference is real (a new engram weakens an old
one); fixed assembly size; no asymmetric/STDP (β-offset) rule yet — that would write *directed*
assemblies (sequences), the bridge to replay and chronotaxis. Full record: `docs/ASSEMBLY-VALIDATION.md`.

**Basal Ganglia — goal-directed selection** (`apps/basal-ganglia.html`, model `models/basal-ganglia.js`) —
a **mean-field oscillator network** (rebuilt from a rejected rate model — the author wanted true
clocks, a watchable timescale, real corticostriatal/thalamocortical structure). Selection is now
**goal-directed and learned**, fixing the earlier "stuck" model (once locked, only a hypodopaminergic
state could switch it — biologically wrong). Motor plans idle as competing cortical assemblies; a
*goal* (stimulus) makes them compete; dopamine **tags** the plan whose learned corticostriatal weight
`W[plan][goal]` wins; reward (three-factor rule) shapes those weights so each goal evokes its own
plan. **Removing the goal releases** the plan, **changing the goal switches** it — no dopamine change
needed (D1 is goal-driven with NO term from its own cortex — that is the fix). **DUAL CODE, stated
explicitly:** assembly pops (cortex/thalamus) carry selection as **synchrony** (`out = act·(0.5+0.5R)`;
the loop closes only when coherent); relay pops (D1/D2/GPe/STN/GPi/FSI/TRN) are **pure rate**
(`out = act`) — pallidal gating is disinhibition, not synchrony, and the healthy striatum is
decorrelated. The one functional relay synchrony is **pathological β** (STN⟷GPe). Cortex **cannot
self-lock** (`ctxKbase = 0`). Three disease states, all emergent: **akinesia** (low DA — no plan can
be tagged); **chorea** (indirect-pathway D2-MSN degeneration slider `degen` → surround collapses,
held plans self-terminate on fatigue → continuous involuntary breakthrough of *different* plans);
**parkinsonian β** — the delayed STN⟷GPe loop locks into β HYPERSYNCHRONY at low DA, and coherent β
**enslaves the thalamus** (downstream of GPi, so D1-Go can't bypass it) → moderate-PD akinesia that
**STN-DBS rescues by desynchronising** (not by restoring DA). Validated **15/15 headless, robust
12/12 seeds** (selection, akinesia, chorea ≥2 plans, DBS rescue, β higher in PD — all 12/12).
Watchable: selection unfolds over ~0.5–0.9 s. Things not to re-derive (see
`docs/BASAL-GANGLIA-VALIDATION.md`): the **dual code**; **D1 goal-driven not cortex-driven** (else
stuck); transmission `act·(0.5+0.5R)` on assemblies (pure-synchrony deadlocks bootstrap); the
**desync repulsion sign** (`+` apart; `−` silently synchronises → no akinesia); **ctxKbase = 0**;
lateral inhibition on **activity** not coherence; relay nuclei **no self-coupling + larger spread**
(else β isn't DA-specific); **low-pass the STN surround**; **chorea fatigue gated above an escape
threshold** (else nothing escapes); **β clamps the thalamus, not the surround** (surround only jams
rivals — the winner's D1 bypasses it). Open (next plausibility upgrades): **striosome/matrix** split
(striosome = critic → emergent phasic DA/RPE) and **cholinergic TANs** (pause gates plasticity;
ACh↔DA balance). The deprioritised inlined `basal-ganglia-selection.html` is unrelated and untouched.

**Metastable Chronotaxis** (`metastable-chronotaxis.html`) — 15-clock cortical pool;
assemblies are *dynamic coalitions* drawn from it, not fixed boxes. Kuramoto coupling
K=11, γ 2.6 Hz. Basal ganglia composes the next coalition (carry-over + recency-penalised
recruitment); cerebellum runs a two-process timing correction (phase gain α 0.8, period
gain β 0.9, tolerance 0.35 rad, refractory 0.55 s); thalamus phase-resets; hippocampus
indexes and replays.
Validated: timing error **|ε| ≈ 9–10 ms tuned vs 74–97 ms lesioned**. Assembly dwell time
**10.8 / 11.0 / 11.0 s intact vs 7.5 / 7.3 / 7.4 s cerebellum-lesioned** across repeat
runs (non-overlapping; ≈2.1× isolated, ≈1.5× in-app because the transition sequence adds
fixed overhead). Sleep consolidation real but modest: 10.5 → 11.6 s.
Key dissociation to preserve: **coherence (R, defended by coupling) and isochrony (ε,
defended by the cerebellum) come apart.** Parameters: `claude-code-brief.md` §6.1.

**Hippocampus — index & replay** (`hippocampus-index-replay.html`) — full trisynaptic
circuit (EC 14, DG 20, CA3 18, CA2 6, CA1 16, Sub 8) with PV/SOM per field, hilar mossy
cells, and medial septum/DBB.
Validated: **theta power 0.93 intact / 0.13 septal lesion / 0.94 restored**. PV titration
**100% → 17% CA3 active (R 0.94); 60% → 50%; 30% → 100% active with R 0.98 = seizure**.
Six bound indices came out **fully orthogonal** (no shared cells). Replay walks the
encoded route across successive ripples, with within-ripple chaining via asymmetric
weights.
Three things that must not be removed: the **diffuse recurrent collateral substrate**
(without it seizure is structurally impossible, not merely absent), **mossy-fibre
detonator index selection**, and the **ACh-dependent encode/retrieve switch**.
Gaps: no theta phase precession; CA3 sparsity floors at 17% because 3 of 18 cells is
already 17%. Parameters: `claude-code-brief.md` §6.3.

**Basal ganglia** (`basal-ganglia-selection.html`) — **deprioritised at the author's
request.** Fully validated and left in place: healthy selects one channel at 80 ms,
parkinsonian fails with β 0.64, DBS rescues at 128 ms, and the β-suppression /
motor-benefit dissociation is emergent. Do not spend effort here unless asked.
Parameters: `claude-code-brief.md` §6.2.

**Corticothalamic model of epilepsy** — the largest model in the project. Three versions,
all runnable; **use `thalamocortical-3d.html`**, the other two are superseded:

| file | geometry | status |
|------|----------|--------|
| `thalamocortical-3d.html` | 19 columns, hex centre + 2 rings, oblique view | **current** |
| `hex-thalamocortical.html` | 7 columns, hex centre + 1 ring, flat | superseded |
| `thalamocortical-epileptogenesis.html` | 3 columns in a ring | first build |

Model source: **`hex-model.js`** (standalone, matches the 19-column app).
Full record: **`VALIDATION.md`** — 6 updates, architecture through bug fixes.

171 populations, 1359 connections. Nine cell classes per column — E2/3, E4, E5, PV,
SOM, VIP, NGF, plus TC and RTN per thalamic sector. Second-order PSP kernels
(Jansen-Rit / Suffczynski class), dt 0.5 ms. Conductances: **T-type Ca²⁺** with
de-inactivation variable h, **I_h** with Ca-dependent activation shift, **burst-gated
GABA-B** cascade, spike-frequency adaptation, synaptic depression, NMDA voltage
dependence. LFP = synaptic currents onto pyramidal dendrites.

*Physiological repertoire.* Wake = persistent Up state with gamma (peak 16–32 Hz);
NREM 2/3 = slow oscillation, delta 92–97%, ~73% Down-state occupancy. **The switch is
mechanistic: ACh blocks spike-frequency adaptation, which is why cortex cannot
slow-oscillate in wake.** One Down→Up transition *is* a K-complex.

*The central result — spindles and spike-wave are the same circuit.* In the isolated
TC–RTN loop, thalamic GABA-B alone flips it:

| GABA-B | burst rate |
|--------|-----------|
| 0–8 | **15.7 Hz** (sleep spindle) |
| 12–34 | **1.8–2.5 Hz** (spike-wave) |

The transition is **abrupt** between 8 and 12, not graded. This reproduces Destexhe's
account of absence seizures. GABA-B release requires burst-level presynaptic firing,
which is what makes it burst-dependent rather than tonic.

*Epileptogenesis axes.* PV loss, recurrent sprouting, KCC2 loss (depolarising GABA),
thalamic GABA-B, T-type gain — all sliders. KCC2 loss gives **×15.7 LFP amplitude**
ictal discharges. **Focal seizure with intact surround**: focus saturates at 0.99 with
zero Down states while the ring continues a normal slow oscillation at 0.18.

*Emergent capability.* VIP→SOM→pyramidal disinhibition works quantitatively: VIP drive
0→6 takes VIP 0.07→0.57, suppresses SOM 0.50→0.21 and releases E2/3 0.60→0.83. This
only appeared after fixing the interneuron physiology (below).

*Not working, with diagnosis.* **Propagation** — the focus enters tonic depolarising
block, and constant drive is absorbed by neighbouring feedforward inhibition; real
recruitment needs paroxysmal *bursting*, so give the focus adaptation/depression so it
cycles rather than latching. **Discrete waxing/waning spindle events.** **In-network
spike-wave** — RTN never reaches GABA-B release threshold at the corticothalamic gain
that keeps wake desynchronised; needs *state-dependent* gain.

*Three fixes worth not re-deriving.* (1) **E→SOM synapses facilitate, they do not
depress** (Reyes 1998; Silberberg & Markram 2007) — uniform depression left SOM, VIP and
NGF silent at ~0.07 while PV sat at 0.19. (2) VIP needs cholinergic drive, NGF needs
layer-1 matrix input. (3) Lateral weights **must be normalised by neighbour count**, or
the outer ring is systematically hypoexcitable — with normalisation the edge effect is
0.004–0.013.

**Ventral stream** (`visual-cortex-streams.html`) — 100% shape classification over 216
conditions; graceful noise degradation (100% → chance at noise 1.2); scale- and
rotation-invariant. V2 angle cells discriminate via corner angle (90° square, 60°
triangle, orientation entropy ≈1.0 circle).

**Dorsal stream** — Adelson–Bergen motion energy. MT direction error **1.4°** mean.
Reproduces the aperture problem (bar locks to perpendicular, closed shape recovers true
direction). No speed tuning, no MST/optic flow.

**Higher-order thalamus** — four experiments, all negative. Read
`HIGHER-ORDER-THALAMUS.md` before touching this; the failure modes are characterised.
The **pulvinar app** (`apps/visual-cortex-pulvinar.html`) is the ventral+dorsal streams
model plus two transthalamic routes that *do* work as demonstrations: a ventral gain gate
`J_eff(x)=J_direct+δJ·λ(x)` (Jaramillo/Mejias/Wang 2019) and a dorsal **tectopulvinar /
blindsight** route (retina→SC→pulvinar→MT) that recovers motion direction with V1 lesioned.

**Auditory cortex** (`apps/auditory-cortex.html`) — the visual STRF machinery re-cast onto a
frequency×time cochleagram: ERB-spaced constant-Q cochlea → lateral suppression → MGv → A1
oriented Gabors where **orientation = FM sweep direction** (Shamma ripple/modulation
framework) → belt harmonic-template pitch. Classifies tone / harmonic / noise / up- and
down-sweep / AM. Same clocks, different axes. (Note: tone vs harmonic complex is not
resolved at 40 channels — a known limit.)

---

## 5. Bugs found (diagnostic patterns worth remembering)

- **Uniform 180° error** in every direction estimate = sign convention, not broken
  computation. (Temporal filter was `[0.5,0,-0.5]` = past−future.)
- **All shapes giving identical features** = Gabor kernel truncated. Kernel must cover
  `max(σ, σ/γ)`, not σ. Selectivity was 2.06× → 10.5× after fixing.
- **Detector firing on healthy states** = window measured in frames, not simulated time.
- **A criterion with no possible true positives** — I left a spike-wave detector running
  after documenting that spike-wave doesn't express. It only ever fired false.

---

## 6. Open threads (with predictions stated in advance)

1. **Feature-specific pulvinar gate**: `λ(x,θ)` instead of `λ(x)`. Predict **zero**
   benefit for separated figures, **positive** benefit in the partial-to-full overlap
   range where spatial gating failed. Spatial gating has a resolution floor at object
   size — verified, no gate size helps with overlap.
2. **Seizure propagation**: give the focus adaptation/depression so it *bursts* rather
   than saturating. Tonic output is absorbed by neighbouring inhibition.
3. **Theta phase precession** — the one substantive gap in the otherwise-complete
   hippocampal model, and the structural bridge to metastable chronotaxis: precession is
   how a behavioural sequence is compressed into one theta cycle so STDP can write the
   asymmetric weights replay later reads out.
4. **CA3 sparsity floor**: 17% because 3 cells of 18 is already 17%. Scale to CA3 ≥ 60,
   DG ≥ 120 and re-tune.
5. **MST / optic flow and MT speed tuning.**

---

## 7. Conventions

Dark instrument aesthetic, not a textbook diagram. Space Grotesk for labels, IBM Plex
Mono for all numbers. Function-coded colour, consistent across models. Synaptic terminals
encode transmitter (arrow = glutamate, bar = GABA, diamond = neuromodulator). Every
number on screen must be computed — no decorative values. Prefers-reduced-motion and
keyboard focus respected.

**Every principal neuron is a clock**: disc sized/brightened by sin(φ), a phase hand, and
a rim tick at the reference-beat phase. Population coherence shown as a halo. Where
possible synchrony should *do* work (gate coupling), not just depict it — in the vision
models it is currently depiction only, which is a known gap.
