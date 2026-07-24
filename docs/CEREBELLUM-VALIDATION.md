# Cerebellum — validation record (VOR adaptation, adaptive filter + oscillator olive)

Model source: `models/cerebellum.js` (single source of truth; `node models/cerebellum.js test`,
inlined into `apps/cerebellum.html` by `build/build-cerebellum.py`).

The cerebellum as **supervised motor learning**, on the canonical oculomotor paradigm —
**vestibulo-ocular reflex (VOR) gain adaptation**. The head rotates; the eyes must
counter-rotate to hold gaze. **Retinal slip** (residual image motion) is the error; the
**inferior olive** reports it as **climbing-fibre complex spikes**, which drive LTD at coincident
parallel-fibre→Purkinje synapses (Marr–Albus–Ito). Over trials the Purkinje output learns to
cancel the slip and the VOR gain adapts toward whatever the visual world demands.

## 1. Principle

The cerebellar cortex is an **adaptive filter** (Fujita 1982; Dean & Porrill 2010). Granule cells
expand the mossy-fibre input into a high-dimensional temporal/phase **basis** `{PF_k}`; one
Purkinje cell reads a weighted sum `Σ w_k·PF_k`; the climbing fibre supplies the error. The
covariance/decorrelation rule

    Δw_k ∝ −(CF − CF0)·PF_k

is LTD when the complex-spike **excess over the spontaneous baseline** coincides with
parallel-fibre activity, LTP when it is below baseline. This drives the error into
**decorrelation** with the granule basis — i.e. it minimises retinal slip within the span of the
basis. No target trajectory is supplied; the olive supplies only the scalar error.

**Dual code (as in the basal-ganglia model).** The **inferior olive is a genuine oscillator
population** — gap-junction-coupled subthreshold ~6 Hz oscillators — and its **synchrony does real
work**: it organises the timing of complex spikes. The cortical microcircuit
(granule/Purkinje/DCN) is **rate + plastic weights**. Every unit is still a clock for the
visualisation, but only the olive's synchrony is functional.

**One subtlety worth stating (it cost real time).** With only ~12 olive neurons, gap-junction
synchrony makes the population complex spike nearly all-or-none, so the *sampled* CS count is
bursty. The **teaching signal reads the graded complex-spike *probability*** (the effective rate
integrated over trials), not the noisy sample — the sampled spikes are kept only for the
visualisation. Without this split the weights random-walk on baseline jitter (learning drifts even
with no error). This is biologically fair: the effective teaching signal is the CS rate, not one
sample.

## 2. Circuit (complete)

    mossy fibres (vestibular head velocity + its quadrature)
      → GRANULE cells (24): rectified, phase-tiled temporal basis; GOLGI feedback inhibition
        sparsifies it (divisive) → parallel fibres
      → PURKINJE cell: SS = tonic + Σ w_k·PF_k − MLI feedforward inhibition; sole cortical
        output, GABAergic onto the deep nucleus. The weights w_k are the learning site.
      → DEEP CEREBELLAR NUCLEUS: tonic − Purkinje inhibition = the output that modulates the
        brain-stem VOR and drives the eyes.
    INFERIOR OLIVE (12): gap-junction-coupled oscillators. Retinal slip depolarises them; a
      complex spike fires when the drive meets the depolarising phase. DCN inhibits IO
      (NUCLEO-OLIVARY feedback) — the loop that regulates the teaching signal.

Eye velocity `= −(g0·head) − kEye·(DCN − DCN0)`; retinal slip `= eye + demand·head`. The
brain-stem supplies the fixed reflex `g0 = 1`; the cerebellum learns the residual gain the visual
world demands (magnifying goggles `demand > 1`, minifying `< 1`).

## 3. Validated results — `10/10` headless, robust `12/12` seeds

| # | check | result |
|---|-------|--------|
| 1 | baseline (demand 1) | gain ≈ 1.0; granule code sparse (~46% active, thresholded) |
| 2 | **VOR gain-UP** (demand 1.6) | gain 1.0 → ~1.45–1.5; residual slip halved (0.44 → ~0.15) |
| 3 | **VOR gain-DOWN** (demand 0.5) | gain 1.0 → ~0.6 |
| 4 | **climbing fibre necessary** | inferior-olive lesion → no adaptation (Δgain ≈ 0) |
| 5 | **olivary gap-junction synchrony** | coherence R 0.23 (uncoupled) → 0.86 (coupled) |
| 6 | nucleo-olivary feedback gates learning | mean learned gain lower **with** the loop than without |
| 7 | **savings** | washes out to baseline, then re-adapts in ¼ the trials |

**Seed sweep (12 seeds):** baseline gain ≈ 1.0 **12/12**; VOR gain-UP **12/12** (gains 1.34–1.70);
VOR gain-DOWN **12/12** (gains 0.53–0.75); inferior-olive lesion → no learning **12/12**;
gap-junction synchrony **12/12**; savings on re-adaptation **12/12**. The nucleo-olivary gating
effect is a *population-level* regulation (small per seed) and is reported as a mean over seeds.

## 4. Design decisions worth not re-deriving (each cost real tuning)

- **The teaching signal is the GRADED complex-spike probability, not the sampled spikes.** A
  synchronised 12-neuron olive spikes nearly all-or-none; reading the sample makes the weights
  random-walk on baseline noise. Read the graded probability; keep the sample for the display.
- **Auto-calibrate the spontaneous CS rate `cf0`.** The teaching signal is `CF − cf0`, so `cf0`
  must be the *true* drive-free baseline (measured at build time). A hand-set baseline biases the
  error and the gain drifts even with no slip.
- **The olive membrane is centred at 0** (`oscAmp·cosθ + drive`), so positive slip *adds* complex
  spikes and negative slip *removes* them — a **signed** teaching signal from a single microzone
  (bidirectional gain-up / gain-down). A rectified-only olive can only learn one direction.
- **The "CF lesion" removes the WHOLE olive** (slip drive *and* nucleo-olivary loop). Zeroing only
  the slip input leaves the nucleo-olivary loop as a spurious internal drive that learns on noise.
- **Olivary heterogeneity + strong coupling for synchrony.** A tight frequency spread keeps the
  *uncoupled* olive partly coherent over a short window (false negative); measure R over a long
  window and contrast against strong gap coupling.
- **Nucleo-olivary feedback gates, it does not sharpen.** Its honest role is negative feedback
  that returns the CS toward baseline and self-limits learning (Bengtsson & Hesslow) — a
  population-level effect, small per seed. Do not claim it lowers steady-state slip; it slightly
  raises it (the gating trade-off).

## 5. Open threads

- **Cerebellar timing.** The granule layer here is a *phase* basis for a periodic stimulus. A
  proper **temporal** basis (granule cells with a spread of response latencies) would let the same
  circuit learn *timed* responses (eyeblink conditioning, timed saccades) — the structural bridge
  to the metastable-chronotaxis timing thread.
- **Saccade adaptation** (discrete dysmetria → intrasaccadic error) as a second task on the same
  circuit.
- Single Purkinje microzone; no basket/stellate temporal detail, no multiple zones with distinct
  climbing-fibre error fields.
