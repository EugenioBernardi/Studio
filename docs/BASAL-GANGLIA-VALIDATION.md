# Basal Ganglia — validation record (oscillator model, goal-directed selection)

Model source: `models/basal-ganglia.js` (single source of truth; `node models/basal-ganglia.js test`,
inlined into `apps/basal-ganglia.html` by `build/build-basal-ganglia.py`).

**This replaces the earlier rate model** (rejected: neurons weren't clocks, selection was 62 ms
fast, a single D1/D2/GPi node couldn't carry corticostriatal / thalamocortical complexity) **and
supersedes the first salience-driven oscillator version** (which got "stuck": once a channel
locked, the only way to switch was to induce a hypodopaminergic state — biologically wrong).

Here selection is **goal-directed and learned**: motor plans idle as competing cortical
assemblies, a *goal* (stimulus) makes them compete, dopamine *tags* the plan whose learned
corticostriatal weight wins, and reward shapes those weights so each goal comes to evoke its own
plan. Removing the goal releases the plan; changing the goal switches it — **no dopamine change
required**. Dopamine loss causes akinesia; indirect-pathway degeneration causes chorea. The
striatal mosaic is an **actor–critic**: the *matrix* selects (actor) and the *striosome* predicts
reward and shapes the dopamine (critic), so the phasic dopamine is an emergent
**reward-prediction error**.

## 1. Principle — a DUAL CODE, stated explicitly

Every neuron is a clock (phase θ + activity a). But the two codes of the basal ganglia are kept
distinct, because that is the biology:

- **Assembly populations (cortex, thalamus) — SYNCHRONY.** Selection *is* a coherent
  cortico-thalamo-cortical assembly. Their transmission is `act·(0.5+0.5·R)` (synchrony
  amplifies → commitment), and the thalamocortical loop only closes when coherence is high, so a
  plan is "selected" exactly when its cortical assembly LOCKS. `mf = act·R` is the selection
  readout.
- **Relay populations (D1, D2, GPe, STN, GPi, FSI, TRN) — RATE.** Pallidal gating is
  firing-rate disinhibition, not synchrony; the healthy striatum is *decorrelated*. These
  populations transmit **pure activity** (`out = act`). Forcing synchrony into striato-pallidal
  transmission would misrepresent the biology.
- **The one place relay synchrony is functional is PATHOLOGICAL:** the STN⟷GPe β loop. Its
  coherence is the disease signal, and — crucially — coherent β **enslaves the thalamus**
  (below), which is *why* β is antikinetic. Synchrony here does causal work, in the pathological
  direction.

So the "little clocks" earn their place at the two ends (the assembly readout and the β
pathology) and are honest rate-meters in the middle. Keeping the visualization is justified; what
a clock *means* differs by structure (a selecting GPi neuron goes **dim** — a rate drop — it does
not phase-lock).

## 2. Circuit

Per channel (×4, one motor plan each): cortex (8), D1 MSN (6), D2 MSN (6), GPe (12), STN (14),
GPi (5), thalamus (6), TRN (5), plus a gap-junction-coupled **FSI** pool (5) delivering
feed-forward inhibition to the MSNs (the real corticostriatal competition). Theta-band
cortico-striato-pallido-thalamo-cortical loop (~6 Hz); STN/GPe are β-band (~20 Hz) with a true
10 ms conduction delay. **Cortex cannot self-lock** (`ctxKbase = 0`): the thalamocortical loop is
required, so the BG genuinely gate selection.

**Pathways.** Direct (D1 ⊣ GPi = focused Go), indirect (D2 ⊣ GPe ⊣ STN → GPi = No-Go brake),
hyperdirect (cortex → STN → GPi = fast diffuse hold). GPi's tonic output clamps its thalamic
sector; D1 Go (gain ∝ dopamine) withdraws that clamp for the tagged plan; the diffuse STN
on-surround jams rivals; cortical lateral inhibition on activity makes the competition
salience/goal-ordered.

**Goals & learning — MATRIX = actor, STRIOSOME = critic.** A goal drives all plans
nonspecifically ("prepare to act"); the learned **matrix** weight `W[plan][goal]` steers which
plan's **D1** is driven hard enough to escape. D1 carries **no drive from its own cortex** — it is
purely goal×weight (+ exploration), DA-gated — so a plan releases the instant its goal is withdrawn
(GPi re-clamps). The **striosome** holds a value estimate `V[goal]` (expected reward) and projects
to SNc, so the dopamine actually released is `phasicDA = reward − V` — a **reward-prediction
error**, not the raw reward. The matrix (actor) learns a three-factor rule on that RPE-gated
dopamine: `W[sel][g] += lr·rpe·D1_sel·(Wmax−W)`, rivals decay on positive RPE; the critic updates
`V[g] += lrV·rpe`. Each goal converges onto one plan, and the teaching signal shrinks as the cue
is learned.

## 3. Validated results — `20/20` headless, robust `12/12` seeds

| # | check | result |
|---|-------|--------|
| 1 | rest, no goal | nothing escapes the cortex (`sel = −1`) |
| 2 | a learned goal selects its plan | `sel = 2`, winner coherent `R = 0.99` |
| 3 | reward shapes a stable goal→plan map | consistent recall; matrix weight dominates |
| 4 | **release** — remove goal | selection drops (`sel = −1`), not stuck |
| 5 | **switch** — change goal | plan switches (goal0→0, goal1→3), no DA change |
| 6 | hypodopaminergic (DA 0.05) | no plan can be tagged — akinesia/rigidity |
| 7 | indirect-pathway degeneration (degen 0.9) | ≥2 distinct plans escape involuntarily = **chorea**; healthy rest stays quiet |
| 8 | β + STN-DBS | β higher at low DA (Δ 0.34); untreated moderate PD akinetic; **DBS restores selection** |
| 9 | striosome critic — RPE | first reward `DA ≈ 1.0`; burst shrinks to `≈ 0.05` as learned; `V → 0.97` |
| 10 | prediction / omission | fully-predicted reward `DA ≈ 0`; **omitted** expected reward `DA ≈ −1.0` (dip) |

**Seed sweep (12 seeds):** healthy selects the learned plan **12/12**; severe-low-DA akinesia
**12/12**; chorea ≥2 plans **12/12** (sizes mostly 2, occasionally 3); healthy rest quiet
**12/12**; moderate-PD untreated akinetic **12/12**; DBS restores selection **12/12**; β higher in
PD **12/12**; RPE burst shrinks with learning **12/12**; omission → negative dip **12/12**.

### 3.1 Chorea is emergent, not scripted

Indirect-pathway (D2 MSN) loss is a single slider, `degen`. It (a) removes the tonic D2 brake so
GPe is disinhibited → GPi falls globally → thalamus is released; and (b) two degen-gated terms
(both **exactly zero in health**) reproduce the *continuous, flowing* breakthrough that defines
chorea: the lateral **surround weakens** (`choreaDisinh` — rivals leak through the overwhelmed
cortical WTA), and a **held plan self-terminates** once fatigue accrues (`choreaKick`, gated above
an escape threshold `choreaHold` so a plan must genuinely escape first). The result is a real
movement fragment escaping to `mf ≈ 0.8`, collapsing on fatigue, and a *different* plan escaping
next — no goal, no dopamine change, no scripted sequence. Trace (degen 0.9): ch3→0.86 → collapse →
ch2→0.75 → collapse → ch3→0.88 …

### 3.2 DBS rescue works because β enslaves the thalamus

The earlier model *measured* β but β did not **block** selection, so there was no regime for DBS
to rescue. The fix is the correct mechanism: coherent β in the pallido-thalamic output **entrains
the thalamic relay and prevents a stable assembly** (`betaThal`, gated above a healthy floor
`betaFloor` so health is untouched). This acts **downstream of GPi**, so even a channel whose
D1-Go has withdrawn its GPi clamp cannot select while β is high. Consequently:

- **DA 0.25 untreated** — β ≈ 0.43 enslaves the loop → akinetic (`sel = −1`), even with the plan
  correctly tagged. This is a *β-driven* akinesia, distinct from the loss-of-Go akinesia at DA 0.05.
- **DA 0.25 + DBS** — DBS desynchronises STN, β falls, the loop is freed → `sel = 2` restored.
  DBS does **not** restore dopamine; it removes the synchrony. Exactly the clinical picture.
- **DA 0.16** — Go too weak; DBS cannot rescue (it can't replace dopamine). Severe PD.
- **DA 0.35** — β below floor; moves regardless. Mild PD.

### 3.3 The striosome makes phasic dopamine an emergent RPE

The teaching signal is no longer handed in. Across eight rewarded trials the released phasic
dopamine falls `[1.00, 0.55, 0.30, 0.17, 0.09, 0.05, …]` as the striosomal value climbs to
`V ≈ 0.97` — Schultz's **dopamine transfer**: the burst moves off the (now-predicted) reward. A
fully-predicted reward evokes `DA ≈ 0.01`; an **omitted** expected reward drives `DA ≈ −1.0`, the
canonical negative-error dip that unlearns. This is the same RPE curve on every seed (the value
recursion is deterministic); the only cross-seed variability was whether an *unlearned* cue's
exploration escaped in the training window, fixed by a modest `explore` bump — the critic itself is
seed-invariant. This closes the RL loop the earlier model left open.

## 4. Design decisions worth not re-deriving (each cost real tuning)

- **Dual code (§1).** Assembly pops synchrony-amplify (`act·(0.5+0.5R)`); relays are pure rate
  (`out = act`). Requiring full synchrony to transmit *anything* deadlocks the loop; coding
  striato-pallidal gating as synchrony misrepresents the biology.
- **D1 is goal-driven, not cortex-driven.** D1 = `goalStr·W[plan][goal] + exploration`, DA-gated,
  with **no** term from the plan's own cortex. This is what fixes "stuck": removing the goal drops
  D1 → GPi re-clamps → release. A cortex→D1 term re-creates a self-sustaining lock.
- **`ctxKbase = 0`.** Cortex must be unable to lock without the loop, or it self-locks over ~1 s
  even with the thalamus clamped → false selection at low dopamine.
- **The "desync" repulsion sign is load-bearing.** `d += Ginh·sin(θ−ψ)` pushes clocks apart; the
  opposite sign silently *synchronises* everything and akinesia disappears. Real bug, twice.
- **Lateral inhibition on ACTIVITY, not coherence.** Coherence-WTA only engages *after* something
  locks → a noise race picks the wrong winner. Activity is salience/goal-ordered from t = 0.
- **Relay nuclei have NO self-assembly coupling and a larger frequency spread.** Otherwise STN
  self-synchronises in health and β stops being dopamine-specific; its synchrony must come only
  from the DA-gated STN⟷GPe loop.
- **Low-pass the STN surround.** The β oscillation of STN activity would otherwise open periodic
  release windows and break akinesia.
- **Measure β by time-averaged coherence.** Instantaneous R of a finite population is noisy; a
  healthy *transient* during bootstrap is not the steady state.
- **Chorea fatigue must be gated above an escape threshold** (`choreaHold`). Fatigue proportional
  to raw adaptation suppresses a plan *during buildup* → nothing ever escapes (subthreshold
  wobble). Gate it so only a plan that has genuinely escaped is torn down.
- **β must act on the thalamus, not the diffuse surround, to block selection.** Potentiating the
  STN on-surround only jams *rivals*; the winner's own D1 bypasses it. Only a downstream thalamic
  clamp blocks the selected channel — which is what makes DBS rescue meaningful.

## 5. Design decisions worth not re-deriving (critic)

- **Dopamine is the RPE, not the reward.** The actor learns on `reward − V`, not `reward`. This is
  what makes the burst shrink with learning and makes omission a negative teaching signal; feeding
  raw reward gives a burst that never adapts and no dip.
- **Value saturates the actor.** Because the actor step is RPE-gated, `W` grows less each trial as
  `V` rises (converges to ~0.7, still dominating rivals at 0.1). This is a feature — no runaway —
  but it means the actor learning rate `lr` had to rise (0.38 → 0.55) to reach dominance before the
  RPE closes.
- **Exploration must reliably escape an unlearned cue.** With a near-uniform `W`, the symmetry is
  broken only by the exploration offsets; too little `explore` and some seeds never escape (nothing
  to reward). `explore = 0.30` gives a first escape on all 12 seeds without destabilising selection.

## 6. Open threads

- **Cholinergic interneurons (TANs).** The TAN pause gates DA-dependent plasticity and the
  ACh↔DA balance (PD, dystonia, anticholinergic benefit). ACh would become the third factor on
  the learning rule (gating *when* the RPE writes) and modulate effective DA — the same "ACh gates
  encode/retrieve" knob used in the hippocampus and assembly models. **Next plausibility upgrade.**
- No action sequencing / chunking; TRN and GPe are single prototypic pools (no arkypallidal
  "stop" pathway yet). Wiring the selected assembly into a thalamocortical *sequence* (the
  chronotaxis thread) is future work.
