# Amygdala — validation record (Pavlovian threat conditioning)

Model source: `models/amygdala.js` (single source of truth; `node models/amygdala.js test`,
inlined into `apps/amygdala.html` by `build/build-amygdala.py`).

The amygdala as the hub of **Pavlovian fear/threat learning**. A neutral CS (tone) paired with an
aversive US (shock) acquires the power to drive **freezing**; a CS− stays safe; **extinction**
makes the CS safe again — as *new inhibitory learning*, so the original engram persists and fear
can **return**. This completes a trio of learning systems: basal ganglia = reinforcement (appetitive
RPE), cerebellum = supervised error, amygdala = **associative threat learning under an aversive
prediction error**.

## 1. Principle

Associative (Hebbian) CS–US learning at the **lateral amygdala (LA)**, gated by an aversive
**prediction error** (Rescorla–Wagner): a US that the CS already predicts teaches nothing
(blocking / saturation). The LA engram drives the **central amygdala** output; **extinction** is a
separate, context-gated *safety* memory (infralimbic mPFC → intercalated cells ⊣ CeM) layered on
top — it does not erase the engram.

**Dual code (as in the basal-ganglia / cerebellum models).** The association and the CeL/CeM
gating are **rate + plastic weights**; the functional **synchrony** is the **LA⟷PL theta
coherence** (Seidenbecher 2003; Likhtik 2014) — fear raises the LA–PL coupling → coherence →
**amplifies** the LA→central transmission (communication-through-coherence); safety lowers it. Every
unit is a theta clock.

## 2. Circuit

    CS (auditory thalamus/cortex) + US (nociceptive)
      → LATERAL AMYGDALA (LA): plasticity site. CS–US convergence potentiates the thalamo/cortico-LA
        weight w_LA (Hebbian, gated by the US prediction error) → the CS comes to evoke LA activity.
      → CENTRAL AMYGDALA: CeL-on (SOM+) ⊣ CeL-off (PKCδ+) mutual inhibition. Fear drives CeL-on →
        suppresses the tonically-active CeL-off brake → DISINHIBITS CeM.
      → CeM: the fear OUTPUT → freezing (PAG) / autonomic / HPA.
    INFRALIMBIC mPFC (IL) → INTERCALATED cells (ITC) ⊣ CeM: the extinction / safety pathway,
      expressed only in the extinction context. PRELIMBIC mPFC (PL) sustains fear and carries the
      LA⟷PL theta coherence.

Learning: `Δw_LA ∝ CS · relu(US − predGain·prediction)` (Hebbian on the aversive prediction error);
`Δw_ext ∝ CS · relu(LA − θ) · (1 − US)` up on non-reinforced trials, and the US *unwrites* safety
(`−lrExtDown · CS · US`) so only genuinely unpaired trials accumulate it. The fear engram `w_LA`
never passively decays; the safety memory `w_ext` is context-gated (`ctx`).

## 3. Validated results — `12/12` headless, robust `12/12` seeds

| # | check | result |
|---|-------|--------|
| 1 | acquisition + discrimination | CS+ freezing 0.00 → **0.60**; CS− stays **0.001** |
| 2 | **US prediction error** | US teaching error 0.88 → **0.35** as the CS comes to predict the US (blocking) |
| 3 | **CeL-on ⊣ CeL-off → CeM** | fear: on 0.61 / off 0 / CeM 0.61; rest: on 0.11 / off 0.56 / CeM 0 |
| 4 | **extinction** | CS+ alone → freezing 0.60 → **0**; **engram w_LA 0.88 unchanged**; safety w_ext grows |
| 5 | **return of fear (renewal)** | context shift → freezing **0.62** returns; engram intact |
| 6 | **theta coherence** | LA⟷PL coherence **0.91 (fear)** vs **0.56 (safe)** |

**Seed sweep (12 seeds):** acquisition **12/12**; CS− discrimination **12/12**; US prediction error
**12/12**; extinction lowers fear **12/12**; LA engram persists **12/12**; renewal **12/12**; fear
theta coherence **12/12**.

## 4. Design decisions worth not re-deriving (each cost real tuning)

- **Dopamine-style aversive PREDICTION ERROR, not raw US.** LA learns on `relu(US − predGain·pred)`.
  A predicted US teaches nothing → the weight self-limits (blocking), exactly like the striosome
  critic's RPE and the cerebellum's decorrelation. Feeding the raw US never saturates.
- **The US must UNWRITE safety.** The CS is present with no US for most of *every* trial (including
  paired ones), so a naive safety rule accumulates extinction even during acquisition and
  pre-inhibits CeM. Gating: the US drives `w_ext` down hard (`lrExtDown`), so only genuinely
  non-reinforced trials build safety. Without this, acquisition can't express fear.
- **Extinction is NEW learning, layered on an intact engram.** `w_LA` never decays; `w_ext` +
  IL/ITC inhibition is context-gated. This is what makes renewal / spontaneous recovery fall out
  for free — remove the context and the untouched engram drives fear again. Erasing `w_LA` would
  reproduce extinction but *not* the return of fear.
- **ITC baseline near zero.** IL must be silent until safety is learned (`ilBias0` high), or the
  tonic ITC inhibition eats into the fear CeM output and acquisition looks weak.
- **Measure the fear state with LEARNING FROZEN.** Within-session extinction is fast; a 2 s CS
  probe with plasticity on already lowers CeM. Freeze `lr` during any read-out (the `probe`).
- **Coherence AMPLIFIES transmission, fear RAISES coupling.** `laOut = LA·(1−cohGate+cohGate·coh)`
  and `k_theta = base + fear·kThetaFear`. Low baseline coupling + phase noise keeps the pair
  incoherent at rest; fear locks them. Synchrony does real work (gates fear), not just depiction.

## 5. Open threads

- **Reinstatement** (a US alone after extinction returns fear) and **spontaneous recovery** (over
  time) — both fall out of the intact-engram / context-gated-safety structure; not yet tested.
- **CS− as active safety signal** (conditioned inhibition), and second-order conditioning.
- **BLA fear vs extinction neurons** (Herry 2008) as explicit sub-populations; here extinction lives
  in the IL→ITC weight rather than a BA cell class.
- Wiring the CS representation from the cortical/auditory models, and the context from the
  hippocampus (the entorhinal→hippocampus thread) — the amygdala's context input is currently a
  scalar `ctx`.
