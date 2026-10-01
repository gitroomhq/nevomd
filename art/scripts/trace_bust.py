#!/usr/bin/env python3
"""Traces Nevo's portrait with Vectorizer.AI and checks the trace against the drawing.

The first trace lost detail: the hair's strands, the beard's texture and the shirt's seams
went flat. So every trace is rendered back to pixels and compared with the drawing it came
from, over the whole picture and over each part of the face, and a side-by-side with the
difference is written for a person to look at. Test mode is free (watermarked): tune there,
then buy the one production trace.

    python3 art/scripts/trace_bust.py test [--colors N] [--tag NAME]
    python3 art/scripts/trace_bust.py production [--colors N]

Input:  art/prepared/nevo-bust.png  (prepare.py)
Output: art/traced/tries/<tag>.svg, <tag>.compare.png and a score; production writes
        art/traced/nevo-bust.svg, which rig_bust.py reads.
"""
import argparse
import base64
import os
import subprocess
import urllib.request
import uuid
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art/prepared/nevo-bust.png"
TRIES = ROOT / "art/traced/tries"

# Regions of the 1024-pixel drawing where losing detail would cost the likeness.
REGIONS = {
    "hair": (270, 50, 650, 230),
    "eyes+brows": (330, 280, 610, 345),
    "nose": (420, 340, 520, 430),
    "beard+mouth": (320, 400, 620, 590),
    "shirt": (0, 540, 1024, 1024),
}


def vectorize(mode: str, colors: int) -> bytes:
    fields = {
        "mode": mode,
        "output.file_format": "svg",
        "output.svg.version": "svg_1_1",
        # Paths stacked on one another, not cut out of each other: rig_bust.py lifts
        # features off the face, and stacked shapes leave no holes behind them.
        "output.shape_stacking": "stacked",
        "output.group_by": "none",
        "processing.max_colors": str(colors),
    }
    boundary = uuid.uuid4().hex
    body = b""
    for k, v in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body += (
        f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="bust.png"\r\n'
        "Content-Type: image/png\r\n\r\n"
    ).encode() + SRC.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    auth = base64.b64encode(f"{os.environ['VECTORIZER_AI_API_ID']}:{os.environ['VECTORIZER_AI_API_SECRET']}".encode()).decode()
    req = urllib.request.Request(
        "https://api.vectorizer.ai/api/v1/vectorize",
        data=body,
        headers={"Authorization": f"Basic {auth}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        return res.read()


def on_white(im: Image.Image) -> np.ndarray:
    im = im.convert("RGBA")
    bg = Image.new("RGBA", im.size, "white")
    return np.asarray(Image.alpha_composite(bg, im).convert("L")).astype(np.float32)


def compare(svg_path: Path, tag: str) -> None:
    png = svg_path.with_suffix(".png")
    subprocess.run(["rsvg-convert", "-w", "1024", "-h", "1024", "-o", str(png), str(svg_path)], check=True)
    a, b = on_white(Image.open(SRC)), on_white(Image.open(png))
    diff = np.abs(a - b)
    print(f"{tag}: {svg_path.stat().st_size / 1024:.0f} KB, {svg_path.read_text().count('<path')} paths")
    print(f"  whole picture: mean error {diff.mean():.2f}, pixels off by >40: {(diff > 40).mean() * 100:.2f}%")
    for name, (x0, y0, x1, y1) in REGIONS.items():
        d = diff[y0:y1, x0:x1]
        print(f"  {name:12} mean error {d.mean():5.2f}, off by >40: {(d > 40).mean() * 100:5.2f}%")
    heat = np.stack([np.full_like(diff, 255), 255 - diff, 255 - diff], -1).clip(0, 255).astype(np.uint8)
    row = np.concatenate([np.stack([a] * 3, -1), np.stack([b] * 3, -1), heat], 1).astype(np.uint8)
    Image.fromarray(row).save(TRIES / f"{tag}.compare.png")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["test", "preview", "production"])
    ap.add_argument("--colors", type=int, default=0, help="0 lets Vectorizer choose")
    ap.add_argument("--tag")
    args = ap.parse_args()
    TRIES.mkdir(parents=True, exist_ok=True)
    tag = args.tag or f"{args.mode}-c{args.colors}"
    svg = vectorize(args.mode, args.colors)
    path = TRIES / f"{tag}.svg"
    path.write_bytes(svg)
    if args.mode == "production":
        (ROOT / "art/traced/nevo-bust.svg").write_bytes(svg)
    compare(path, tag)


if __name__ == "__main__":
    main()
