#!/usr/bin/env python3
"""Turns the picked raw drawings into the files the site loads.

This is the raster stand-in used for the look test. Once the style is approved the same
picks go through Vectorizer.AI in production mode and the SVGs replace these files.

What it does:
  - snaps each drawing to the site palette (ink #4A4A4A, white, light grey, pink #FF0083)
  - fills enclosed transparent areas with white, so drawings read on the grey bands

The brain and the four ability objects are not drawings any more: they are 3D models built
in code (src/brain/three/). The still image of the brain is captured from that renderer by
tests/capture-still.mjs.

    python3 art/scripts/prepare.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "art/raw"
OUT = ROOT / "src/assets/art"
PREPARED = ROOT / "art/prepared"

INK = np.array([74, 74, 74], dtype=np.float32)       # #4A4A4A
PINK = np.array([255, 0, 131], dtype=np.float32)     # #FF0083


# Which generation of each drawing is used.
PICKS = {
    "mark": "brain-full/generated_2.png",   # the small brain in the nav and the chat bubbles
    "bust": "nevo-bust/v2_3.png",            # Nevo (v1 was generated_2.png), for the finale and "How it works"
}


def exterior_mask(alpha: np.ndarray, close_bottom: bool = False) -> np.ndarray:
    """True where a transparent pixel is connected to the image border."""
    h, w = alpha.shape
    solid = (alpha > 0.5).astype(np.uint8) * 255
    canvas = Image.new("L", (w + 2, h + 2), 0)
    canvas.paste(Image.fromarray(solid), (1, 1))
    if close_bottom:
        # A bust is cut off at the chest, so its outline is open underneath. Close it with
        # a line dropped from the outer end of each shoulder and one along the bottom edge,
        # so the torso counts as "inside" and gets filled.
        cols = np.nonzero(solid.any(axis=0))[0]
        x0, x1 = int(cols.min()), int(cols.max())
        y0 = int(np.nonzero(solid[:, x0])[0].max())
        y1 = int(np.nonzero(solid[:, x1])[0].max())
        d = ImageDraw.Draw(canvas)
        d.line([(x0 + 1, y0 + 1), (x0 + 1, h)], fill=255, width=2)
        d.line([(x1 + 1, y1 + 1), (x1 + 1, h)], fill=255, width=2)
        d.line([(x0 + 1, h), (x1 + 1, h)], fill=255, width=2)
    ImageDraw.floodfill(canvas, (0, 0), 128)
    return np.asarray(canvas)[1:-1, 1:-1] == 128


def snap(path: Path, fill_inside: bool = True, close_bottom: bool = False) -> Image.Image:
    """Palette-snap a drawing and, optionally, fill its enclosed transparent areas white."""
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)
    rgb, alpha = im[..., :3], im[..., 3] / 255.0
    h, w = alpha.shape

    # --- colour: pink stays pink, everything else becomes a grey between ink and white
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    pinkness = np.clip((r - g - 40) / 150.0, 0, 1) * (r > 140) * (b > g)
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    opaque = alpha > 0.8
    grey_px = opaque & (pinkness < 0.1)
    line_level = np.percentile(lum[grey_px], 3) if grey_px.any() else 60.0
    t = np.clip((lum - line_level) / (255.0 - line_level), 0, 1)[..., None]
    grey = INK + t * (255.0 - INK)
    p = pinkness[..., None]
    out_rgb = grey * (1 - p) + (255.0 * (1 - p) + PINK * p) * p

    # --- alpha: keep the soft outer edge, make everything inside opaque over white
    out_a = alpha.copy()
    if fill_inside:
        ext = exterior_mask(alpha, close_bottom)
        near_ext = np.asarray(Image.fromarray((ext * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
        inside = ~near_ext
        a = alpha[..., None]
        out_rgb = np.where(inside[..., None], out_rgb * a + 255.0 * (1 - a), out_rgb)
        out_a = np.where(inside, 1.0, alpha)

    # Fully transparent pixels still carry whatever colour the model left there. Make them
    # white so nothing dark can bleed in when the image is filtered or scaled.
    out_rgb = np.where((out_a <= 0)[..., None], 255.0, out_rgb)
    out = np.dstack([out_rgb, out_a * 255.0]).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def crop_square(im: Image.Image, margin: float, size: int) -> tuple[Image.Image, tuple[float, float, float]]:
    """Crop to the drawing's bounds as a centred square. Returns the image and (x0, y0, side)."""
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 20)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    side = max(x1 - x0, y1 - y0) * (1 + margin)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box = (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2)
    out = im.crop(tuple(int(round(v)) for v in box)).resize((size, size), Image.LANCZOS)
    return out, (box[0], box[1], side)


def build() -> None:
    # Shown at 36 to 40 px, so 128 px covers high-density screens with room to spare.
    mark, _ = crop_square(snap(RAW / PICKS["mark"]), margin=0.06, size=128)
    mark.save(OUT / "brain-mark.png")
    # The portrait is not shipped as a PNG: this file is what gets traced
    # (Vectorizer.AI, then rig_bust.py turns the trace into the animated rig).
    PREPARED.mkdir(parents=True, exist_ok=True)
    bust = snap(RAW / PICKS["bust"], close_bottom=True)
    bust.save(PREPARED / "nevo-bust.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    build()
    for p in sorted(OUT.iterdir()):
        print(f"{p.name:22} {p.stat().st_size / 1024:7.1f} KB")
