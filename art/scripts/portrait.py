#!/usr/bin/env python3
"""Draws Nevo's bust in the site's line style from a reference photo.

The generate-image skill's script is text-only, so a likeness needs the image edit
endpoint with the photo as its reference. Nevo supplied the photo for this purpose.

    python3 art/scripts/portrait.py [reference/nevo-photo-1.png] [--n 2]
"""
import argparse
import base64
import os
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]

PROMPT = (
    "Redraw the man in this photo as a flat monoline vector illustration: a front-facing "
    "head-and-shoulders bust, looking straight at the viewer with a relaxed closed-mouth smile. "
    "Uniform thin dark-grey outlines (#4A4A4A) with round caps and joins, the same line weight "
    "everywhere. White fills for the skin and the shirt. Flat light-grey shading shapes (#EEEEEE) "
    "with no outline. Keep what makes him recognisable, simplified: dark hair swept back and up "
    "from the forehead, short on the sides, drawn as one solid dark-grey (#4A4A4A) shape; thick "
    "dark eyebrows; a short trimmed beard and moustache drawn as flat light-grey shading along "
    "the jaw and upper lip; a collared button-up shirt. Simple dot-and-line facial features, "
    "friendly, not a caricature. The WHOLE head must be visible, including the very top of the "
    "hair, with clear empty space above the head. No pink, no colour other than dark grey, white "
    "and light grey. No gradients, no textures, no drop shadows, no text. Transparent background, "
    "bust centered, cut off cleanly at the chest."
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("photo", nargs="?", default=str(ROOT / "reference/nevo-photo-1.png"))
    ap.add_argument("--n", type=int, default=2)
    ap.add_argument("--model", default="chatgpt-image-latest")
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set")

    out = ROOT / "art/raw/nevo-bust"
    out.mkdir(parents=True, exist_ok=True)
    (out / "prompt.txt").write_text(PROMPT + "\n")

    client = OpenAI()
    with open(args.photo, "rb") as photo:
        result = client.images.edit(
            model=args.model,
            image=photo,
            prompt=PROMPT,
            size="1024x1024",
            quality="high",
            background="transparent",
            n=args.n,
        )
    for i, item in enumerate(result.data, start=1):
        path = out / f"generated_{i}.png"
        path.write_bytes(base64.b64decode(item.b64_json))
        print(f"- {path}")


if __name__ == "__main__":
    main()
