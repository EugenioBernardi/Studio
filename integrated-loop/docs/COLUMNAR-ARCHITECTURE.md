# Making the cortex columnar, and coupling every column to a thalamic nucleus

*Plan of record. Written before implementation, so the validation gates are fixed in advance
rather than chosen once the numbers are known.*

---

## 1. The obstacle that has to be named first

The project already contains a validated cortical column: `thalamocortical.js` has 9 cell
classes per column — E2/3, E4, E5, PV, SOM, VIP, NGF, plus TC and RTN per thalamic sector —
laterally coupled across 37 columns as the loop runs it. It is not reused by the associative
cortex, and the reason is not oversight:

> **`thalamocortical.js` is a MEAN-FIELD model. One rate per population per column.
> `cortex.js` has individual units but no columns. A mean-field population cannot host a
> sparse assembly, because it has no internal structure to be sparse in.**

So "make the cortex columnar" cannot be done by importing the existing column. The two modules
are at different levels of description, and merging them by fiat would silently destroy the
assembly machinery every memory result depends on.

**The merge is therefore: keep the laminar and thalamic ARCHITECTURE of `thalamocortical.js`,
but give each lamina a POPULATION OF UNITS rather than a single rate.** That is the one change
that makes both things possible at once.

## 2. What a column is here

Per column `c`, excitatory populations of individual units, plus interneuron pools as scalar
rates (they set gain and sparsity; they do not need to be individually addressable):

| population | role |
|---|---|
| `TC[c]` | thalamic relay — sensory input enters here, **not** at cortex |
| `RTN[c]` | reticular sector — inhibits `TC[c]` **and its neighbours** |
| `L4[c]` | thalamorecipient, topographic, expands the relay input |
| `L23[c]` | **associative — assemblies live here**; recurrent within and across columns, plastic |
| `L5[c]` | output — drives `TC[c]` and `RTN[c]` (corticothalamic feedback) |
| `PV4[c]`, `PV23[c]`, `SOM[c]` | feedback inhibition per lamina; sets sparsity locally |

The associative sheet that `cortex.js` currently provides as `N` flat units becomes
`NCOL × nL23` units. Nothing is added to the count; it is reorganised.

## 3. The thalamus must do work, or it is decoration

The project's first rule forbids drawing in what should be emergent. A thalamic nucleus that
merely relays is a wire with a name. Two mechanisms make it load-bearing, and both already
exist elsewhere in the project under different names:

1. **RTN cross-column inhibition is a COMPETITION mechanism.** `RTN[c]` inhibits `TC[c]` and
   neighbouring sectors, so columns compete for relay throughput. This is the same machinery as
   the TRN gating in the basal-ganglia model and the callosal opponent term in `parietal.js`.
2. **Corticothalamic feedback is a GAIN GATE.** `L5[c] → TC[c]` with `L5[c] → RTN[c] → TC[c]`
   gives the validated pulvinar formulation `J_eff = J_direct + δJ·λ(x)` a home in the general
   architecture rather than as a special-purpose module.

**This is the unifying prediction the change is worth making for:** the parietal competition,
the pulvinar gate and the basal-ganglia TRN gate are currently three separate implementations of
one circuit motif. If a single thalamic nucleus type can serve all three, §8.2 of `OVERVIEW.md`
("the thalamus is four incompatible objects") closes. If it cannot, that is a real negative
result about the motif, and worth more than three more bespoke modules.

## 4. Validation gates, fixed in advance

The change is only permissible if it costs nothing that is already earned. Gates, in order:

- **G1 — assemblies survive columnarisation.** L2/3 assemblies must be sparse (2–10%),
  near-orthogonal at encoding, and pattern-completing, reproducing stage 1. Measured at a cue
  of **0.25**, per stage 26, not the legacy 0.50.
- **G2 — the thalamus is load-bearing.** Lesioning RTN cross-column inhibition must measurably
  change the competition. If sparsity and recall are unchanged with RTN removed, the thalamus is
  decoration and the design has failed its own test.
- **G3 — the laminar structure is load-bearing.** Driving L2/3 directly, bypassing TC→L4, must
  differ from driving through the relay. If not, the laminae are a relabelling.
- **G4 — scale invariance holds**, as it does for the flat sheet across 800 → 10 000.
- **G5 — no regression.** `cortex.js` is untouched and every existing stage still passes until a
  stage is explicitly migrated.

**G2 and G3 are the ones that matter.** G1, G4 and G5 only establish that nothing was broken;
G2 and G3 establish that something was gained. A columnar model that passes G1 and fails G2 and
G3 is strictly worse than the flat sheet — the same behaviour with more parameters — and should
be rejected rather than shipped.

## 5. Migration, and its cost

`cortex.js` is imported by 5 source modules and 16 test stages. It is **not** rewritten in place.
`column.js` is built alongside; stages migrate one at a time, each re-verified against its own
recorded numbers. Any stage whose numbers move is a finding to be reported, not a merge conflict
to be resolved.

Honest cost statement: the validated record — 29 stages — is expressed in terms of the flat
sheet. Migrating it is weeks of re-verification, and until it happens the project has two
cortices. That is the price of the directive, and it is worth paying only if G2 and G3 pass.
