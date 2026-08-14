"""A conductance-based E/I cortical microcircuit, parameterised by lesion.

The network is a standard sparse COBA network (Vogels & Abbott 2005 geometry)
with 80% excitatory / 20% fast-spiking inhibitory cells. It is intentionally
generic: the scientific content is not the network, it is the mapping from a
*named biological lesion* to a *named synaptic parameter*, and from the
resulting activity to an observable that also exists in scalp EEG.

Why conductance-based and not current-based: the aperiodic exponent of the LFP
is set by the ratio and the kinetics of synaptic currents. A current-based
model gets the kinetics right but loses the voltage dependence that makes
inhibitory current shrink as the cell is driven toward E_GABA -- exactly the
effect that separates "fewer GABA receptors" from "slower GABA receptors".

LFP proxy: sum over pyramidal cells of |I_exc| + |I_inh|. This is the proxy
validated against detailed multi-compartment simulations by Mazzoni et al.
(2015, PLoS Comput Biol) and is a far better predictor of the real LFP than
firing rate or membrane potential average.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict

import numpy as np
from brian2 import (NeuronGroup, Synapses, PoissonInput, SpikeMonitor,
                    StateMonitor, Network, defaultclock, prefs,
                    ms, mV, nS, pF, second, Hz)

prefs.codegen.target = "numpy"  # no compiler needed; keeps runs reproducible


@dataclass
class ColumnParams:
    """Biophysical parameters. Defaults are a healthy asynchronous-irregular
    regime; each lesion in `neurosim/experiments` perturbs one or two fields."""

    n_exc: int = 3200
    n_inh: int = 800
    connection_prob: float = 0.02

    # Passive membrane
    c_m: float = 200.0          # pF
    g_leak: float = 10.0        # nS
    e_leak: float = -60.0       # mV
    v_thresh: float = -50.0     # mV
    v_reset: float = -60.0      # mV
    refractory: float = 5.0     # ms

    # Reversal potentials
    e_exc: float = 0.0          # mV  (AMPA)
    e_inh: float = -80.0        # mV  (GABA_A)

    # Synaptic kinetics -- the clinically interesting knobs
    tau_exc: float = 5.0        # ms  AMPA decay
    tau_inh: float = 10.0       # ms  GABA_A decay

    # Synaptic weights
    w_exc: float = 1.62         # nS
    w_inh: float = 9.0          # nS

    # Background drive (thalamic / long-range)
    bg_rate: float = 1.0        # Hz per input synapse; tuned for ~4 Hz output
    bg_n_synapses: int = 100
    bg_weight: float = 1.62     # nS

    # Simulation
    duration: float = 4.0       # s
    dt: float = 0.1             # ms
    lfp_sample_neurons: int = 200
    seed: int = 0

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class ColumnResult:
    lfp: np.ndarray             # LFP proxy, arbitrary units
    lfp_fs: float               # Hz
    rate_exc: float             # mean firing rate, Hz
    rate_inh: float
    exc_spike_times: np.ndarray
    exc_spike_ids: np.ndarray
    population_bins: np.ndarray  # spike counts in 2 ms bins (for avalanches)
    params: dict = field(default_factory=dict)


def simulate_column(p: ColumnParams) -> ColumnResult:
    """Run one column and return an LFP proxy plus spiking summaries."""
    np.random.seed(p.seed)
    defaultclock.dt = p.dt * ms

    eqs = """
    dv/dt = (g_leak*(e_leak - v) + ge*(e_exc - v) + gi*(e_inh - v)) / c_m : volt (unless refractory)
    dge/dt = -ge / tau_exc : siemens
    dgi/dt = -gi / tau_inh : siemens
    i_abs = abs(ge*(e_exc - v)) + abs(gi*(e_inh - v)) : amp
    """

    namespace = {
        "g_leak": p.g_leak * nS,
        "e_leak": p.e_leak * mV,
        "e_exc": p.e_exc * mV,
        "e_inh": p.e_inh * mV,
        "c_m": p.c_m * pF,
        "tau_exc": p.tau_exc * ms,
        "tau_inh": p.tau_inh * ms,
    }

    exc = NeuronGroup(p.n_exc, eqs, threshold="v > v_thresh", reset="v = v_reset",
                      refractory=p.refractory * ms, method="euler",
                      namespace={**namespace, "v_thresh": p.v_thresh * mV,
                                 "v_reset": p.v_reset * mV})
    inh = NeuronGroup(p.n_inh, eqs, threshold="v > v_thresh", reset="v = v_reset",
                      refractory=p.refractory * ms, method="euler",
                      namespace={**namespace, "v_thresh": p.v_thresh * mV,
                                 "v_reset": p.v_reset * mV})

    for grp in (exc, inh):
        grp.v = (p.e_leak + 5.0 * np.random.rand(len(grp))) * mV

    ee = Synapses(exc, exc, on_pre="ge += w", namespace={"w": p.w_exc * nS})
    ei = Synapses(exc, inh, on_pre="ge += w", namespace={"w": p.w_exc * nS})
    ie = Synapses(inh, exc, on_pre="gi += w", namespace={"w": p.w_inh * nS})
    ii = Synapses(inh, inh, on_pre="gi += w", namespace={"w": p.w_inh * nS})
    for syn in (ee, ei, ie, ii):
        syn.connect(p=p.connection_prob)

    bg_exc = PoissonInput(exc, "ge", p.bg_n_synapses, p.bg_rate * Hz,
                          weight=p.bg_weight * nS)
    bg_inh = PoissonInput(inh, "ge", p.bg_n_synapses, p.bg_rate * Hz,
                          weight=p.bg_weight * nS)

    n_lfp = min(p.lfp_sample_neurons, p.n_exc)
    lfp_mon = StateMonitor(exc, "i_abs", record=range(n_lfp))
    spk_exc = SpikeMonitor(exc)
    spk_inh = SpikeMonitor(inh)

    net = Network(exc, inh, ee, ei, ie, ii, bg_exc, bg_inh,
                  lfp_mon, spk_exc, spk_inh)
    net.run(p.duration * second)

    lfp = np.asarray(lfp_mon.i_abs).mean(axis=0)
    lfp_fs = 1000.0 / p.dt

    # Discard the first 500 ms: transient from the arbitrary initial voltages.
    burn = int(0.5 * lfp_fs)
    lfp = lfp[burn:]

    t_exc = np.asarray(spk_exc.t / second)
    keep = t_exc >= 0.5
    t_exc_kept = t_exc[keep]
    bin_edges = np.arange(0.5, p.duration + 1e-9, 0.002)
    pop_bins, _ = np.histogram(t_exc_kept, bins=bin_edges)

    eff_dur = p.duration - 0.5
    return ColumnResult(
        lfp=lfp,
        lfp_fs=lfp_fs,
        rate_exc=float(t_exc_kept.size / (p.n_exc * eff_dur)),
        rate_inh=float(np.sum(np.asarray(spk_inh.t / second) >= 0.5)
                       / (p.n_inh * eff_dur)),
        exc_spike_times=t_exc_kept,
        exc_spike_ids=np.asarray(spk_exc.i)[keep],
        population_bins=pop_bins,
        params=p.as_dict(),
    )
