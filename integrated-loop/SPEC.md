# The loop: sensory cortex ⇄ entorhinal ⇄ hippocampus — encode · replay · consolidate

**What this integrates (established mechanisms, one circuit — not a new-biology claim).** A
sequence of sensory stimuli forms cortical assemblies; the hippocampus binds an index to each
and stores their order; during low-ACh sharp-wave-ripple states the hippocampus **replays** the
sequence and, through the entorhinal back-projection, **reinstates the cortical assemblies in the
encoded order, time-compressed**; replay-driven co-activation strengthens **cortico-cortical**
associations so that, after enough replay, the **cortex recalls the sequence without the
hippocampus** — a systems-consolidation gradient. Every one of these is a textbook mechanism;
the point of this spec is that they run *together* in one coupled circuit, each interface
principled, and each italicised phenomenon reproduces a specific **published** experimental
number. The deliverable is an interactive, testable synthesis — a tools/methods contribution.

## Principled interfaces (not glue)

The shared currency is the **assembly** (a sparse co-active set). The index binds the *active
cortical assembly*; replay drives that same assembly back. The entorhinal cortex is the literal
anatomical hub and carries traffic both ways. No hand-tuned semantic adapters.

    sensory drive → NEOCORTEX (recurrent, plastic Wcc) ⇄ ENTORHINAL (EC) ⇄ hippocampus
                    assembly A_i          bridge          DG→CA3 index I_i (+ asymmetric order)
    encode (high ACh, theta):  A_i → EC → DG → CA3 index; bind I_i↔A_i; CA3 asym links store order
    replay (low ACh, SWR):     CA3 ripple walks I_1→I_2→…; each I_k → EC → reinstates A_k in cortex
    consolidate:               replay co-activates A_k,A_{k+1} → Hebbian Wcc → cortex learns the chain

## Scale (why more neurons)

The 18-cell toy floors sparsity at 17%. Real sparse coding, replay sequences, and consolidation
statistics need scale: **neocortex 400 (+inh), EC 150, DG 500, CA3 240, CA1 180**, with real
feedback/feed-forward inhibitory pools (PV/SOM) setting sparsity — not k-WTA shortcuts.

## Validation targets — from real data

| # | phenomenon | target | source |
|---|-----------|--------|--------|
| 1 | replay preserves encoded order | Spearman ρ(replay, encode) ≥ 0.8 | Lee & Wilson 2002; Davidson et al. 2009 |
| 2 | time compression | replay ≈ 15–20× faster than encoding | Lee & Wilson 2002; Davidson 2009 (~20×) |
| 3 | cortex lags hippocampus in replay | peak cross-corr lag ≈ 10–40 ms, HPC leads | Ji & Wilson 2007 |
| 4 | forward **and** reverse replay | both occur | Diba & Buzsáki 2007; Foster & Wilson 2006 |
| 5 | **consolidation gradient** | HPC lesion abolishes *recent* recall, spares *remote* (post-replay) | Kim & Fanselow 1992; Frankland & Bontempi 2005 |
| 6 | ripple band | 150–250 Hz during SWR | Buzsáki 2015 |
| 7 | cortical sparsity | assemblies 2–10 % active, orthogonal across stimuli | Barth & Poulet 2012 |

Targets **1, 2, 5** are the ones that show the *integration* works end to end — that a single
coupled circuit reproduces the encoded order, the compression, and the consolidation gradient
together, each matching its published number. Build order: cortex assemblies (7) → encode+bind →
replay+reinstatement (1,2,3,4,6) → consolidation gradient (5). Validate each before the next;
replicate across seeds.
