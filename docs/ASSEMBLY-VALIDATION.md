# Kuramoto Assembly — validation record

Model source: `models/kuramoto-assembly.js` (single source of truth; runs headless via
`node models/kuramoto-assembly.js test`, and is inlined verbatim into
`apps/kuramoto-assembly.html`).

This is the canonical statement of the project's central metaphor: **every principal
neuron is a clock; an assembly is a set of clocks running in synchrony; LTP and LTD are
the strengthening and weakening of that synchrony.** Unlike the vision models, here
synchrony *does work* — the coupling that carries the synchrony is the same quantity the
plasticity reads and writes.

## 1. Equations

Per neuron `i` (phase θ, intrinsic angular rate ω):

```
dθ_i/dt = ω_i + Σ_j K_ij·sin(θ_j − θ_i) + F_i·sin(Φ_stim + φ_i − θ_i) + G·R·sin(θ_i − ψ) + √(2D)·ξ
```

- `Σ_j K_ij·sin(θ_j − θ_i)` — Kuramoto coupling, plastic weights `K_ij`.
- `F_i·sin(Φ_stim + φ_i − θ_i)` — a **rotating** rhythmic stimulus (fixed-phase forcing
  cannot entrain a clock rotating at 2π·8 Hz; the drive must rotate — this was a real bug).
- `G·R·sin(θ_i − ψ)` — **feedback inhibition**: coherence-proportional *repulsion* from
  the global mean phase (`R`, `ψ` = global order parameter). Destabilises runaway global
  synchrony. Sign matters: `+` repels (desynchronises); `−` would attract (the wrong way).

Per ordered pair (bounded `0 ≤ K_ij ≤ Kmax`):

```
dK_ij/dt = η·(cos(θ_j − θ_i) − c0) − λ·(K_ij − K_floor)      [potentiate if cos Δφ > c0]
```

then **subtractive synaptic competition** per postsynaptic neuron: if `Σ_j K_ij > Ktot`,
shed a uniform amount from every synapse (floored at 0). Subtractive (not multiplicative)
normalisation is essential — it is genuinely competitive, driving losing synapses to zero
and letting the assembly keep the budget (Miller & MacKay 1994). Multiplicative scaling
preserves proportions and lets the background permanently steal budget.

Plasticity is gated by an **encode/retrieve switch**: ON during encoding, OFF during
recall (recall is a fast readout at fixed weights; plasticity is slow). This is the same
logic as the ACh encode/retrieve switch in the hippocampus model.

## 2. Validated parameters (seed 7, dt 0.5 ms → here dt 1 ms)

| param | value | role |
|-------|-------|------|
| N | 24 | clocks |
| f0 / sigmaF | 8.0 / 0.06 Hz | near-homogeneous rates ⇒ assemblies lock at ~zero lag (tight, R≈1) |
| Kmax / Ktot | 2.6 / 7.5 | per-synapse ceiling / per-neuron incoming budget |
| Kfloor / Kinit | 0.03 / 0.03 | resting/initial coupling (sub-critical background) |
| eta / c0 / lambda | 1.2 / 0.55 / 0.05 | plasticity rate / LTP-LTD threshold / homeostatic decay |
| D | 0.030 | phase noise |
| Fdrive / fStim | 16.0 / 8.0 Hz | stimulus gain / rhythm |
| **Ginh** | **3.5** | feedback-inhibition repulsion (the selectivity mechanism) |
| pgate | 1.0 | all-to-all substrate (sparsity available as a knob) |

## 3. Validated results — `14/14` headless checks pass

1. **Bare Kuramoto transition** (plasticity off, Ginh 0): R **0.39** (weak coupling) →
   **0.996** (strong). Sanity check on the coupling.
2. **LTP writes a synchronous assembly.** Drive 6 clocks co-phasic → assembly **R 0.999**
   while background **R 0.054** (Δ 0.945). Assembly coupling 4.2× its projection to
   background.
3. **Pattern completion.** Scramble all phases, cue **2 of 6** (weights frozen) → assembly
   **R 0.996**, global **R 0.001**. Auto-associative recall from a partial cue.
4. **LTD/LTP rule in isolation.** Two clocks clamped by a dominant drive: co-phase →
   **K 2.60** (Kmax), anti-phase → **K 0.00**. The rule is exactly co-phase-potentiating,
   anti-phase-depressing.
5. **Two assemblies coexist.** Both stay coherent (**R 0.998, 0.998**), mutually decoupled
   (cross-K 0.00), and the repulsion pushes them to **distinct phases (≈179°, anti-phase)**.
6. **Retention.** After **15 s of disuse** (undriven, learning on) the assembly still
   recalls: **R 0.996**, global **R 0.002**.

**Robustness (10 seeds):** encode R(assembly) **0.996 ± 0.002**, R(background)
**0.097 ± 0.072**; recall R(assembly) **0.997 ± 0.002**, R(global) **0.098 ± 0.075**.
All seeds pass. Not a lucky seed.

## 4. Design decisions worth not re-deriving (each cost real tuning time)

- **The stimulus must rotate.** A static target phase cannot entrain a clock rotating at
  ω = 2π·8 Hz; `sin(Φ − θ)` averages to zero over a cycle. Early "it works" runs were an
  artefact of super-critical baseline coupling synchronising everything anyway.
- **The core tradeoff of plain excitatory Hebbian-Kuramoto:** weak coupling → assemblies
  *splay* (detuned members lock at nonzero phase lag → cos Δφ falls below c0 → the rule
  tears them down) and decay; strong coupling → a single assembly *recruits the whole
  network* (global synchrony). Neither parameter alone escapes this.
- **Two mechanisms resolve it, and both are needed:**
  1. *Subtractive synaptic competition* (limited budget) — makes membership crisp and
     stops the background stealing coupling. Multiplicative normalisation does **not**
     work (preserves proportions).
  2. *Feedback-inhibition repulsion* — caps global coherence, so a strong assembly cannot
     entrain the background. This is the same PV-shear idea as the hippocampus model, and
     it is what finally made assemblies **selective** rather than merging.
- **Near-homogeneous frequencies + inhibition beats heterogeneous frequencies.** With the
  repulsion keeping the background scattered, detuning is no longer needed to enforce
  incoherence — so rates can be made near-homogeneous, which lets assemblies lock at
  ~zero phase lag (R≈1, tight visible synchrony) instead of splaying (R≈0.6).
- **Recall must read frozen weights.** Testing recall with plasticity on is wrong: a
  briefly-scrambled assembly gets punished by its own learning rule before it can
  re-form. Encode/retrieve gating (ACh-like) is both correct and necessary.
- **Assertions test function, not magnitude.** Under a synaptic budget the per-link K
  equilibrates near Ktot/(assembly size − 1) ≈ 1.3, *not* near Kmax — Kmax binds only a
  single isolated synapse. Asserting `K > 0.8·Kmax` for a 6-cell assembly contradicts the
  budget mechanism. The checks assert coherence, frozen-weight recall, and selectivity.

## 5. Known limitations / open threads

- **Retroactive interference is real here:** training a second assembly weakens a
  previously-stored one somewhat (K(G1) drifts below K(G2)); it survives and still
  recalls, but this is a genuine memory phenomenon, not fully tuned away.
- Assemblies are cued at a **fixed size (6)**; the model does not yet self-select assembly
  size from stimulus statistics.
- **Asymmetric (STDP-like) plasticity** — a phase offset β in the rule,
  `sin(θ_j − θ_i + β)` — would write *directed* assemblies (sequences), the structural
  bridge to replay and to the metastable-chronotaxis model. Not yet built.
