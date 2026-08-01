# Pre-build: essential tremor as an olivocerebellar loop instability

Written **before** any code, per `integrated-loop/docs/PRE-BUILD-PROTOCOL.md`, with two steps that
protocol was missing and that cost the previous two models: (a) the **arithmetic check** that the
mechanism class can produce the required signs and magnitudes at all, and (b) an explicit statement
of the **level of description**.

---

## 1. The gap

Essential tremor is the commonest movement disorder, and its mechanism is actively disputed. The
field is split into two camps, and a 2025 point–counterpoint pair states the split plainly
("Is the Inferior Olive Central to Essential Tremor: Yes" vs "The Olivary Hypothesis of Essential
Tremor: Time to Lay this Model to Rest?").

**Camp 1 — the olive is the pacemaker.** Olivary neurons have intrinsic 1–10 Hz subthreshold
oscillations and are electrically coupled; harmaline produces tremor by driving them.

**Camp 2 — the olive is irrelevant.** ET brains show *no olivary pathology*. They show cerebellar
cortical pathology: climbing-fibre→Purkinje synapses displaced into the outer molecular layer and
onto thin spiny branchlets, torpedoes, Purkinje loss. And the killer quantitative objection:
**complex spikes fire at ~1 Hz and are neither rhythmic nor coherent with a 4–12 Hz tremor.**

Both camps are **feedforward**. Camp 1 has the olive drive the cortex; camp 2 has the cortex
oscillate by itself (Pan et al. 2020 showed GluRδ2-dependent CF pruning deficits produce cerebellar
oscillations and tremor).

But the olivocerebellar system is not feedforward. The **nucleo-olivary pathway** closes it, and it
does something specific: GABAergic nucleo-olivary terminals land in the olivary glomeruli *where the
gap junctions are*, and **shunt** them — reducing electrical coupling without changing gap-junction
conductance (Llinás's shunting hypothesis; Lefler & Yarom, Neuron 2014, showed cerebellar inhibitory
input to the olive decreases electrical coupling and blocks subthreshold oscillations). So the
cerebellum **controls olivary synchrony directly**.

The gap: **nobody has asked whether that loop is what converts a cerebellar cortical lesion into a
sustained circuit-wide tremor, or what the loop gain must be for it to happen.** The one closely
related model — Shaikh, Zee & Optican's account of *oculopalatal* tremor (Brain 2010) — required
**inferior olivary hypertrophy**, a structural change in the olive. ET has no such change. So the
question is sharp and unanswered: *can an olivary tremor rhythm arise with a completely normal
olive, driven entirely from the cerebellar side?*

## 2. The hypothesis

**Essential tremor is a loop instability, not a pacemaker disease.**

The healthy olivocerebellar loop is **negative feedback** on olivary synchrony:

| step | sign |
|---|---|
| olivary coupling ↑ → olivary coherence R ↑ | + |
| R ↑ → climbing-fibre volleys become synchronous | + |
| synchronous CF volley → Purkinje complex spike → **pause** → PC output ↓ | − |
| PC ⊣ DCN, so PC ↓ → DCN ↑ | − |
| DCN → nucleo-olivary GABA ↑ → **shunts gap junctions** → coupling ↓ | − |

Product of signs around the loop: **negative**. The healthy loop actively suppresses olivary
synchrony — which is exactly why complex spikes are ~1 Hz and *not* rhythmic in a normal animal.

A delayed negative-feedback loop does not fail gracefully when its gain rises. It **oscillates**. The
CF→PC pathology found in ET brains — more synapses, displaced onto thin branchlets and the outer
molecular layer — raises the *AC gain* of the second step: each synchronous volley moves Purkinje
output more. Past a critical gain the loop destabilises, olivary coherence rises instead of being
suppressed, and the olive's pre-existing ~6 Hz subthreshold rhythm becomes a coherent population
output that propagates to the nuclei and out to the periphery.

**No olivary pathology is required — which is why none is found.** The olive is the resonant element,
not the lesion.

## 3. Arithmetic check — BEFORE code

The last model failed two rows that were decidable on paper. Doing that first this time.

**(a) Can the frequency come out right?** A loop with pure transport delay τ becomes unstable where
its phase lag reaches 180°, i.e. at f = 1/(2τ). Olivocerebellar loop lag — CF conduction, PC pause
development, DCN integration, nucleo-olivary conduction — is of order 40–125 ms. That gives
**f = 4.0 – 12.5 Hz**. The clinical ET band is **4–12 Hz**. The mechanism class produces the right
frequency from anatomy alone, with nothing fitted. ✅

**(b) Can 1 Hz cells make a 6 Hz population rhythm?** Yes, and trivially, *if* they are phase-locked:
N cells each firing on ~1 of every 6 cycles of a shared 6 Hz subthreshold oscillation, all at the
same phase, give a population volley train at 6 Hz with per-cell rate 1 Hz. The camp-2 objection
conflates per-cell rate with population rhythm. **This is a category error, and it is checkable.** ✅
The real risk is not arithmetic but dynamics: Negrello et al. (PLoS CB 2019) showed the olive behaves
as a "quasiperiodic ratchet" whose variable cycle lengths erase long-term phase dependencies — so
sustained coherence is genuinely hard to get, and this test can fail. Good.

**(c) Is the loop sign right for a dissociation?** CF→PC gain acts on the **AC** (modulation) path;
Purkinje **loss** acts on the **DC** path (less tonic PC output → tonically disinhibited DCN →
tonically *high* nucleo-olivary drive → chronically *de-coupled* olive). These are separable and
opposite in their effect on coherence. So the model can in principle produce tremor from one lesion
and non-tremulous incoordination from the other. ✅

All three checks pass on paper. Building is justified.

## 4. Level of description — stated explicitly

Phase oscillators, not event accounting. The inferior olive is **N coupled clocks** with intrinsic
frequencies and a mean field; **synchrony does work** — the gap-junction coupling that carries the
coherence is the same quantity the nucleo-olivary feedback writes to. This is the project's standard
dual code: the olive is the oscillator population, the Purkinje/DCN limb is rate.

Built on the validated `models/cerebellum.js` olive (12 gap-junction-coupled phase oscillators,
6 Hz, graded complex-spike probability, nucleo-olivary feedback). **One mechanistic addition:** in
that model nucleo-olivary input subtracts from olivary *drive*; here it also **shunts the coupling**,
`g_eff = gGap / (1 + shunt·NO)`, which is the Llinás/Lefler–Yarom mechanism and the load-bearing
element of the hypothesis.

## 5. Registered predictions and kill criteria — fixed before running

| | prediction | kill criterion |
|---|---|---|
| **P1** | In the tremor state, mean per-cell complex-spike rate stays ≈1 Hz while the *population* CF output has a 4–12 Hz spectral peak | if a 4–12 Hz population rhythm requires per-cell CS > 2 Hz, the olivary account fails on its own terms — report it |
| **P2** | Opening the loop (nucleo-olivary drive frozen at baseline) abolishes tremor **even with the full CF→PC lesion present** | if tremor persists with the loop open, this is a feedforward cortical oscillation, the loop adds nothing, hypothesis dead |
| **P3** | Setting olivary gap-junction coupling to zero abolishes tremor | *constraint*, not a prediction — matches Marshall & Lang (2006), who showed gap-junction block reduces complex-spike synchrony and rhythmicity |
| **P4** | CF→PC gain ↑ → tremor; Purkinje **loss** → no tremor, with degraded complex-spike timing instead | if both lesions give tremor, or neither does, the loop does not discriminate syndromes and the model has no clinical content |
| **P5** | Tremor **frequency** is set by the olivary subthreshold rhythm and is near-invariant to lesion magnitude; **amplitude** scales with it | if frequency tracks lesion magnitude strongly, that contradicts the clinical observation that ET amplitude progresses while frequency stays stable |

**What is fitted and what must emerge**, stated now: the olivary frequency (6 Hz) and the healthy
per-cell CS rate (~1 Hz) are **anchors to measurement**, set by hand, claiming nothing. The loop
delay is taken from anatomy, not fitted. Everything in P1–P5 — whether the loop destabilises at all,
at what frequency, in which direction, and with what dissociation — must **emerge**.

P5 is the one to watch: nothing in the model ties tremor frequency to the olivary frequency by
construction. If the instability frequency is set by the loop delay instead, P5 fails and the
"olive as resonant element" claim goes with it.
