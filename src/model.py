"""CORnet-S with stage-wise lesioning.

CORnet-S is used because its four blocks are explicitly labelled V1, V2, V4 and
IT and were designed to map onto the primate ventral stream. That makes "where
is the damage" a question about level in the visual hierarchy rather than about
arbitrary network depth, which is what the clinical contrast requires.

A lesion is applied to the output of one stage, so everything downstream sees
the corrupted signal, as it would after damage at an intermediate cortical
stage. Because stages upstream of the lesion are unaffected, their activations
are computed once and reused across the whole lesion grid.
"""

import numpy as np
import torch
import torch.nn as nn

from cornet_s import CORnet_S

STAGES = ["V1", "V2", "V4", "IT"]


def load_cornet_s(weights_path, device="cpu"):
    model = CORnet_S()
    model = nn.DataParallel(model)  # checkpoint was saved from a DataParallel model
    ckpt = torch.load(weights_path, map_location="cpu", weights_only=False)
    model.load_state_dict(ckpt["state_dict"])
    model = model.module.to(device).eval()
    for p in model.parameters():
        p.requires_grad_(False)
    return model


def infer_channels(model, stage):
    for m in reversed(list(getattr(model, stage).modules())):
        if isinstance(m, nn.Conv2d):
            return m.out_channels
        if isinstance(m, nn.BatchNorm2d):
            return m.num_features
    raise RuntimeError(f"cannot infer channel count for {stage}")


class Lesion:
    """A graded lesion applied to the output of one ventral-stream stage.

    'ablation' silences a random fixed subset of feature channels, standing in
    for loss of cortical units; the subset is drawn once and held fixed, so the
    lesion is a property of the model rather than of the trial. 'noise' adds
    Gaussian noise scaled to the stage's own activation scale, standing in for
    degraded signalling in surviving tissue.
    """

    def __init__(self, stage, kind, severity, n_channels, seed=0):
        self.stage, self.kind, self.severity = stage, kind, severity
        # Nested across severity: one channel ordering is drawn per seed and
        # increasing severity silences a prefix of it, so a severity curve is a
        # single lesion getting worse rather than a series of unrelated lesions.
        # Degeneration removes further units; it does not reshuffle which ones.
        rng = np.random.default_rng(seed)
        order = rng.permutation(n_channels)
        n_kill = int(round(severity * n_channels))
        self.dead = torch.from_numpy(
            np.isin(np.arange(n_channels), order[:n_kill]))
        self.seed = seed

    def apply(self, act):
        if self.severity == 0:
            return act
        if self.kind == "ablation":
            out = act.clone()
            out[:, self.dead] = 0.0
            return out
        if self.kind == "noise":
            g = torch.Generator().manual_seed(self.seed)
            scale = act.std().item() * self.severity
            return act + torch.randn(act.shape, generator=g) * scale
        raise ValueError(f"unknown lesion kind {self.kind}")


@torch.no_grad()
def stage_inputs(model, x):
    """Return {stage: input to that stage} plus the intact IT output."""
    cache, a = {}, x
    for s in STAGES:
        cache[s] = a
        a = getattr(model, s)(a)
    return cache, a


@torch.no_grad()
def forward_from(model, stage, act_in, lesion=None):
    """Run from `stage` to the top of IT, optionally lesioning `stage`'s output."""
    a = getattr(model, stage)(act_in)
    if lesion is not None:
        a = lesion.apply(a)
    for s in STAGES[STAGES.index(stage) + 1:]:
        a = getattr(model, s)(a)
    return a


def pool(act, center_frac=0.72):
    """Average-pool over a central window of the feature map.

    Reading out from the whole map blends flanking letters into the target and
    turns the crowding condition into a pooling artefact rather than a
    perceptual effect. Restricting the readout to the central field matches the
    clinical situation, where the target is foveated, while leaving units with
    large receptive fields free to register interference from the flankers --
    which is what crowding actually is.
    """
    if center_frac >= 1.0:
        return act.mean(dim=(2, 3)).numpy()
    h = act.shape[-1]
    k = max(1, int(round(h * center_frac)))
    o = (h - k) // 2
    return act[:, :, o:o + k, o:o + k].mean(dim=(2, 3)).numpy()


class GainLesion:
    """Multiplicative channel gain dysregulation at a stage output.

    This replaces the additive-noise lesion of the first experiment, which was
    uninformative: independent noise at each spatial position is averaged away
    by the pooled readout, so the lesion had almost no behavioural effect. A
    per-channel gain is constant across space and therefore survives pooling.
    It models surviving-but-dysregulated tissue rather than outright unit loss.
    Severity is the standard deviation of the log gain.
    """

    kind = "gain"

    def __init__(self, stage, severity, n_channels, seed=0):
        self.stage, self.severity = stage, severity
        g = torch.Generator().manual_seed(seed)
        self.gain = torch.exp(torch.randn(n_channels, generator=g) * severity)

    def apply(self, act):
        if self.severity == 0:
            return act
        return act * self.gain[None, :, None, None]


class DecayLesion:
    """Random deletion of individual synaptic weights within a stage.

    This is the lesion model used by the existing in-silico neurodegeneration
    literature, included here so that any conclusion about deficit shape can be
    tested for dependence on the lesion model rather than assumed to generalise
    from channel ablation. Because CORnet blocks are recurrent, a deleted weight
    is absent at every timestep, as a lost synapse would be.

    The lesion mutates the model, so `apply_weights` and `restore` must bracket
    the forward passes that use it.
    """

    kind = "decay"

    def __init__(self, model, stage, severity, seed=0):
        self.stage, self.severity = stage, severity
        self.convs = [m for m in getattr(model, stage).modules()
                      if isinstance(m, nn.Conv2d)]
        self.origin = [c.weight.data.clone() for c in self.convs]
        rng = np.random.default_rng(seed)
        self.masks = [torch.from_numpy(
            (rng.random(tuple(c.weight.shape)) >= severity).astype(np.float32))
            for c in self.convs]

    def apply_weights(self):
        for c, w, m in zip(self.convs, self.origin, self.masks):
            c.weight.data = w * m

    def restore(self):
        for c, w in zip(self.convs, self.origin):
            c.weight.data = w.clone()

    def apply(self, act):  # damage lives in the weights, not the activations
        return act
