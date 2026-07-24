# Basal Ganglia — validation record

Model source: `models/basal-ganglia.js` (single source of truth; `node models/basal-ganglia.js test`,
inlined into `apps/basal-ganglia.html` by `build/build-basal-ganglia.py`).

Action selection cast in the project's clock/assembly idiom: each competing motor program is a
cortical **assembly** of phase-clocks; the basal ganglia release exactly one, and the
thalamocortical loop **sustains the winner's synchrony**. Synchrony does work — a channel's
drive to the striatum is scaled by its assembly coherence, so selection → synchrony →
commitment.

## 1. Architecture

A rate model per channel (Gurney/Prescott/Redgrave 2001; Humphries/Stewart/Gurney 2006) with the
canonical selection motif, plus the cortico-thalamo-cortical positive-feedback loop:

- **direct (D1, Go):** cortex → striatum-D1 ⊣ GPi — *focused, off-centre*
- **indirect (D2, No-Go):** cortex → striatum-D2 ⊣ GPe ⊣ STN → GPi
- **hyperdirect:** cortex → STN → GPi — *diffuse, on-surround* (fast brake)
- **output:** GPi/SNr tonically inhibits thalamus; low GPi = released
- **loop:** thalamus re-excites its cortical assembly (commit) + cortical lateral inhibition (WTA)
- **dopamine:** D1 gain ∝ DA (Go), D2 gain ∝ (1−DA) (No-Go) — the selection threshold/vigour
- **β generator:** the reciprocal STN⟷GPe loop with a **true conduction delay** Hopf-bifurcates
  into a sustained ~16 Hz limit cycle at the low-dopamine operating point (a little rate noise
  keeps the near-critical resonance alive, as β is bursty in vivo)

## 2. Validated results — `14/14` headless, robust over 8 seeds

1. **Healthy selection** (DA 0.6, salience 0.9/0.6/0.5): channel 0 released
   (**thal 1.00 / 0.01 / 0.01**), its assembly synchronised (**R 0.86–0.98**), losers desync.
2. **Winner-take-all:** two near-equal competitors (0.82 vs 0.80) → **exactly one** released.
3. **Latency:** first release at **~62 ms** (physiological).
4. **Parkinsonian akinesia** (DA 0.05): **nothing** released; GPi pathologically high on every
   channel (**~0.92**).
5. **β oscillation:** parkinsonian STN oscillates (peak-to-peak **0.33**, ~16 Hz) while the
   healthy STN is near-steady (**0.03**) — β amplitude **≈ 42× higher** at low dopamine.
6. **STN-DBS** (informational lesion of STN output) **restores selection** under low dopamine.
7. **Dopamine-gated reinforcement:** rewarding a weaker channel over trials raises its
   corticostriatal weight until it **wins** (actor / three-factor rule).

Seed sweep (8 seeds): healthy always selects the correct channel with R > 0.85; low dopamine
always akinetic; β always far higher in the parkinsonian state.

## 3. Key dissociations & design notes (worth not re-deriving)

- **β-suppression vs motor benefit are separable** — DBS quenches the on-surround (STN output)
  to restore selection; the β amplitude and the selection deficit are set by different parts of
  the loop.
- **The positive-feedback loop needs a brake.** Cortico-thalamo-cortical re-excitation is what
  commits to a winner, but without **cortical lateral inhibition** every channel self-amplifies
  and all release. WTA requires both.
- **Dopamine must gate D1 through the origin** (Go gain ∝ DA, not `1 + k·DA`). Otherwise the
  positive-feedback loop inflates cortical drive enough that even weak D1 releases the winner,
  and akinesia never appears.
- **β is a limit cycle, not a damped ring.** A first-order lag on the STN⟷GPe loop only *damps*;
  a **true delay** plus fast STN/GPe time constants is required, and the operating point must
  cross the Hopf bifurcation specifically at low dopamine (healthy stays below it). Measure β by
  **amplitude**, not normalised fraction — noise gets resonance-shaped even in health.

## 4. Open threads

- Selection is fixed at one grain; no sequencing/chunking of actions yet (no striatal
  "start/stop" or SNr gating of sequences).
- The actor learns; there is no explicit **critic** (no TD-error dopamine signal driving the
  reward). Adding a critic would make dopamine phasic and close the RL loop.
- Cerebellar timing and thalamic phase-reset (the chronotaxis threads) are separate models;
  wiring the BG winner into a thalamocortical sequence is future work.
