"""Synthetic analogues of clinical visual-perception tests.

The battery is built around letter identification, which is the format used by
several of the tests neurologists actually administer in suspected posterior
cortical atrophy (notably VOSP Incomplete Letters). Each condition applies one
perturbation to an otherwise canonical letter, so that conditions differ in the
demand they place on the visual system rather than in the response required.

Conditions fall into two families, which carry the study's central contrast:

  signal degradation  fragmented, low_contrast, noise, crowded
      The form is present but the evidence for it is impoverished or corrupted.
      Clinically, this is the apperceptive profile.

  transformation      rotated, sheared
      The evidence is clean but the form is presented outside its canonical
      pose, so identification requires view-invariant representation.
"""

import glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont

IMG_SIZE = 224
LETTERS = list("AEFHKNPRTX")
CONDITIONS = ["canonical", "fragmented", "low_contrast", "noise", "crowded", "rotated", "sheared"]

# Degradation-family vs transformation-family conditions (excluding canonical).
DEGRADATION = ["fragmented", "low_contrast", "noise", "crowded"]
TRANSFORMATION = ["rotated", "sheared"]

_FONT_PATTERNS = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
]


def available_fonts():
    fonts = [p for p in _FONT_PATTERNS if glob.glob(p)]
    if not fonts:
        fonts = sorted(glob.glob("/usr/share/fonts/**/*.ttf", recursive=True))[:4]
    if not fonts:
        raise RuntimeError("no TrueType fonts available for stimulus generation")
    return fonts


FONTS = available_fonts()


def _render_letter(letter, font_path, size, rotation=0.0, shear=0.0):
    """Render one letter as a float array in [0, 1]; 0 is ink, 1 is background."""
    pad = IMG_SIZE * 2
    img = Image.new("L", (pad, pad), 255)
    font = ImageFont.truetype(font_path, size)
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), letter, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((pad // 2 - w / 2 - bbox[0], pad // 2 - h / 2 - bbox[1]), letter, fill=0, font=font)

    if shear:
        img = img.transform(
            (pad, pad), Image.AFFINE,
            (1, shear, -shear * pad / 2, 0, 1, 0),
            resample=Image.BICUBIC, fillcolor=255,
        )
    if rotation:
        img = img.rotate(rotation, resample=Image.BICUBIC, fillcolor=255)

    left = (pad - IMG_SIZE) // 2
    img = img.crop((left, left, left + IMG_SIZE, left + IMG_SIZE))
    return np.asarray(img, dtype=np.float32) / 255.0


def _fragment(arr, rng, n_patches=7, radius=11):
    """Erase circular patches of ink: the Incomplete Letters analogue.

    Patches are centred on ink pixels so that erasure removes signal rather
    than empty background, which keeps difficulty stable across letters.
    """
    ink_y, ink_x = np.where(arr < 0.5)
    if len(ink_y) == 0:
        return arr
    out = arr.copy()
    yy, xx = np.mgrid[0:IMG_SIZE, 0:IMG_SIZE]
    idx = rng.choice(len(ink_y), size=min(n_patches, len(ink_y)), replace=False)
    for i in idx:
        mask = (yy - ink_y[i]) ** 2 + (xx - ink_x[i]) ** 2 <= radius ** 2
        out[mask] = 1.0
    return out


def _crowd(letter, font_path, size, rng):
    """Flank the target with two distractor letters at close spacing."""
    target = _render_letter(letter, font_path, size)
    flankers = [l for l in LETTERS if l != letter]
    left, right = rng.choice(flankers, size=2, replace=False)
    offset = int(size * 0.62)
    out = target.copy()
    for flank, sign in ((left, -1), (right, +1)):
        f = _render_letter(flank, font_path, size)
        shifted = np.ones_like(f)
        if sign < 0:
            shifted[:, : IMG_SIZE - offset] = f[:, offset:]
        else:
            shifted[:, offset:] = f[:, : IMG_SIZE - offset]
        out = np.minimum(out, shifted)
    return out


def make_stimulus(letter, condition, rng, font_path=None, size=None):
    """Return one stimulus as a float array in [0, 1], shape (224, 224)."""
    font_path = font_path or FONTS[rng.integers(len(FONTS))]
    size = size or int(rng.integers(96, 132))

    if condition == "crowded":
        arr = _crowd(letter, font_path, size, rng)
    elif condition == "rotated":
        # Rotation well outside the upright range: identity must survive a pose
        # change rather than a loss of signal.
        rot = rng.uniform(50, 130) * rng.choice([-1, 1])
        arr = _render_letter(letter, font_path, size, rotation=rot)
    elif condition == "sheared":
        # Strong shear, minimal rotation: a second transformation condition that
        # is geometrically independent of rotation, so that the transformation
        # family does not rest on a single manipulation.
        sh = rng.uniform(0.75, 1.25) * rng.choice([-1, 1])
        arr = _render_letter(letter, font_path, size, rotation=rng.uniform(-10, 10), shear=sh)
    else:
        # Small jitter everywhere so the probe cannot exploit exact position.
        arr = _render_letter(letter, font_path, size,
                             rotation=rng.uniform(-8, 8), shear=rng.uniform(-0.08, 0.08))

    if condition == "fragmented":
        arr = _fragment(arr, rng)
    elif condition == "low_contrast":
        # Compress toward mid-grey; ink and background stay ordered.
        contrast = 0.12
        arr = 0.5 + (arr - 0.5) * contrast
    elif condition == "noise":
        arr = np.clip(arr + rng.normal(0, 0.55, arr.shape), 0, 1)

    return arr.astype(np.float32)


def build_dataset(n_per_class_per_condition=40, conditions=None, seed=0):
    """Generate the full battery.

    Returns (images, labels, conds) where images is (N, 224, 224) float32.
    """
    conditions = conditions or CONDITIONS
    rng = np.random.default_rng(seed)
    images, labels, conds = [], [], []
    for cond in conditions:
        for li, letter in enumerate(LETTERS):
            for _ in range(n_per_class_per_condition):
                images.append(make_stimulus(letter, cond, rng))
                labels.append(li)
                conds.append(cond)
    return np.stack(images), np.array(labels), np.array(conds)


def to_model_input(images):
    """Grayscale [0,1] -> ImageNet-normalised RGB tensor input, shape (N,3,224,224)."""
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)
    x = np.repeat(images[:, None, :, :], 3, axis=1)
    return (x - mean) / std
