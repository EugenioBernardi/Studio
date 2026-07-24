# Studio — Metastable Brain

Interactive, **numerically validated** neural circuit simulators. Every model is a real
dynamical system rendered as coupled "little clocks" — nothing is a scripted animation.
See [`CLAUDE.md`](CLAUDE.md) for the full project memory and method.

## Layout

| path | what |
|------|------|
| `apps/` | single-file interactive apps (open any `.html` in a browser) |
| `models/` | standalone, headless-runnable model sources (the single source of truth) |
| `docs/` | validation records |
| `build/` | scripts that inline a model into its app template |

## Apps

- **`apps/kuramoto-assembly.html`** — *Assemblies · Synchrony as Memory.* The project thesis
  as a model: neurons are clocks, an assembly is a set running in synchrony, and LTP/LTD are
  the strengthening/weakening of the coupling that carries that synchrony. Encode a memory by
  driving its clocks together (Hebbian LTP), then recall it from a partial cue at frozen
  weights. Validated in [`docs/ASSEMBLY-VALIDATION.md`](docs/ASSEMBLY-VALIDATION.md).
- `apps/thalamocortical-3d.html` — 19-column thalamocortical sheet; sleep rhythms, spindles,
  and the spindle→spike-wave switch.
- `apps/hippocampus-index-replay.html` — trisynaptic circuit: sparse indexing, sharp-wave
  ripples, replay, and the interneuron brake on runaway synchrony.
- `apps/visual-cortex-streams.html` / `apps/ventral-stream-shapes.html` — retina → LGN → V1 →
  V2 form recognition and the V3 → V5/MT motion pathway.

## Method (non-negotiable)

Simulate first, draw second. Every mechanism is prototyped headless, tuned against explicit
numeric targets, and then re-verified in the shipped app. To check the assembly model:

```sh
node models/kuramoto-assembly.js test      # 14 headless checks
python3 build/build-kuramoto-assembly.py   # rebuild the app from the model + template
```

The app also runs a self-check on load (`[verify]` in the console) proving it reproduces the
headless numbers.
