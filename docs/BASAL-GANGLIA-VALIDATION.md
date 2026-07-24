# Basal Ganglia — validation record (oscillator model)

Model source: `models/basal-ganglia.js` (single source of truth; `node models/basal-ganglia.js test`,
inlined into `apps/basal-ganglia.html` by `build/build-basal-ganglia.py`).

**This replaces the earlier rate model** (which the author rejected: neurons weren't clocks,
selection was 62 ms fast, and a single D1/D2/GPi node couldn't carry corticostriatal /
thalamocortical complexity). Here the basal ganglia are a **mean-field oscillator network**:
selection *is* synchrony.

## 1. Principle

Every neuron is a clock (phase θ + activity a). A population transmits its **coherent mean
field** `Z = (1/n)Σ aⱼe^{iθⱼ}` — so an incoherent or silent population sends nothing:
**synchrony gates transmission**. Selection is not a firing-rate winner; it is *which cortical
channel's cortico-striato-pallido-thalamo-cortical loop LOCKS INTO A COHERENT ASSEMBLY*.

- **Assembly populations** (cortex, thalamus) express selection through coherence; they
  transmit via the coherent mean field.
- **Relay populations** (D1, D2, GPe, STN, GPi, FSI, TRN) gate by **activity** (rate) — the
  biologically correct code for pallidal inhibition — except the STN⟷GPe loop, whose β
  *synchrony* is itself the pathology.
- **Cortex cannot self-lock** (`ctxKbase = 0`): the thalamocortical loop is *required*, so the
  BG genuinely gate selection. GPi's tonic activity desynchronises/silences its thalamic
  sector; D1 "Go" (gain ∝ dopamine) withdraws that clamp for the winner; the STN surround
  (rate) keeps rivals jammed; cortical lateral inhibition on activity makes the winner
  **salience-ordered** rather than a locking race.

## 2. Anatomy (richer, per the author's critique)

Per channel (×4): cortex (8), D1 (6), D2 (6), GPe (12), STN (14), GPi (5), thalamus (6),
TRN (5), plus a gap-junction-coupled **fast-spiking interneuron** pool (5) delivering
feed-forward inhibition to the MSNs (the real corticostriatal competition). **TRN** is the
inhibitory shell on the thalamocortical loop. Theta-band loop (~6 Hz); STN/GPe are β-band
(~20 Hz) with a true 10 ms conduction delay.

## 3. Validated results — `7/7` headless

1. **Healthy selection** (DA 0.6, salience 0.9/0.6/0.5/0.4): channel 0's cortical assembly
   locks (**R ≈ 1.0**), every other channel stays incoherent (mf ≈ 0). Selection unfolds over
   ~0.5–0.9 s (watchable, not 62 ms).
2. **Winner-take-all:** two near-equal competitors → exactly one locks.
3. **Parkinsonian akinesia** (DA 0.05): **no** cortical assembly locks — the thalamus is
   clamped, cortex can only reach the incoherent "candidate" level.
4. **β hypersynchrony:** the STN⟷GPe loop crosses into coherent β **only** at low dopamine —
   STN coherence ≈ 0.1 healthy → ≈ 0.7–0.8 parkinsonian.
5. **STN-DBS** injects desynchronising drive to STN, breaks the β coherence, relaxes the
   surround, and **restores selection** under low dopamine.
6. (headless suite also covers reinforcement via `reinforce()` — dopamine-gated corticostriatal
   `wStr`.)

**Robustness (10 seeds):** healthy selects the correct (highest-salience) channel with
R > 0.85 in **10/10**; low dopamine is akinetic in **10/10**; STN β is higher in the
parkinsonian state in **10/10** (margin > 0.3 in 9/10 — the one shortfall is finite-size
noise, not an inversion).

## 4. Design decisions worth not re-deriving (each cost real tuning)

- **Transmission = activity·(0.5 + 0.5·R).** Requiring full synchrony to transmit *anything*
  deadlocks the loop (it can't bootstrap). Activity carries the signal; synchrony *amplifies*
  the winner (commitment). Selection and β are then read from coherence.
- **The "desync" repulsion sign is load-bearing.** `d += Ginh·sin(θ−ψ)` pushes clocks apart
  (correct); the opposite sign silently *synchronises* everything and lets cortex lock with no
  thalamic input (akinesia disappears). This was a real bug.
- **`ctxKbase = 0`.** With low frequency spread (needed for reliable locking), any nonzero
  cortical self-coupling lets cortex slowly self-lock over ~1 s even with the thalamus clamped
  → false selection at low dopamine. Cortex must be *unable* to lock without the loop.
- **Lateral inhibition on ACTIVITY, not coherence.** Coherence-based WTA only engages *after*
  something locks → a noise race that picks the wrong (lower-salience) winner. Activity is
  salience-ordered from t = 0, so the right channel wins.
- **Relay nuclei have NO self-assembly coupling and a larger frequency spread.** Otherwise STN
  self-synchronises in health and β stops being dopamine-specific; its synchrony must come only
  from the DA-gated STN⟷GPe loop.
- **Low-pass the STN surround.** The β oscillation of STN activity would otherwise open
  periodic release windows and break akinesia.
- **Measure β by time-averaged coherence.** Instantaneous R of a finite population is noisy;
  a healthy *transient* during bootstrap is not the steady state.

## 5. Open threads

- The actor (`wStr`) learns, but there is no phasic-dopamine **critic** (TD error) closing the
  RL loop.
- No action sequencing / chunking; TRN and GPe are single prototypic pools (no
  arkypallidal "stop" pathway yet).
- Wiring the selected cortical assembly into a thalamocortical *sequence* (the chronotaxis
  thread) is future work.
