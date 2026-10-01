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
    "head-and-shoulders bust, looking straight at the viewer, calm and confident, mouth closed, "
    "the faintest smile. It must be a clear likeness of THIS man, not a generic handsome face. "
    "Uniform thin dark-grey outlines (#4A4A4A) with round caps and joins, the same line weight "
    "everywhere. White fills for the skin and the shirt. Flat light-grey shading shapes (#EEEEEE) "
    "with no outline. Keep exactly what makes him recognisable: black hair combed straight back "
    "and slightly to the side, sleek and close to the head with a little volume on top, short "
    "faded sides, drawn as one solid dark-grey (#4A4A4A) shape; a wide, square jaw and a broad "
    "face; thick, straight, dark eyebrows set low over dark, almond-shaped eyes with heavy "
    "lids; a straight nose with a broad tip; full lips, the lower lip full; a short, dense "
    "boxed beard that follows the whole jawline and chin and joins a moustache, drawn as a "
    "solid mid-grey (#9A9A9A) shape with no outline; a fairly thick neck; an open-collared "
    "button-up shirt. The WHOLE head must be visible, including the very top of the "
    "hair, with clear empty space above the head. No pink, no colour other than greys "
    "and white. No gradients, no textures, no drop shadows, no text. Transparent background, "
    "bust centered, cut off cleanly at the chest."
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("photo", nargs="?", default=str(ROOT / "reference/nevo-photo-2.png"))
    ap.add_argument("--prefix", default="generated")
    ap.add_argument("--n", type=int, default=2)
    ap.add_argument("--model", default="chatgpt-image-latest")
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set")

    out = ROOT / "art/raw/nevo-bust"
    out.mkdir(parents=True, exist_ok=True)
    (out / "prompt.txt").write_text(PROMPT + "\n") if args.prefix == "generated" else (out / f"{args.prefix}_prompt.txt").write_text(PROMPT + "\n")

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
        path = out / f"{args.prefix}_{i}.png"
        path.write_bytes(base64.b64decode(item.b64_json))
        print(f"- {path}")


if __name__ == "__main__":
    main()
