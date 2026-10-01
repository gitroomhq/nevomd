#!/usr/bin/env python3
"""Gives each of the page's drawings its one touch of pink, the way every Lemonade drawing has
a little of their colour in it.

Done by the image model, not by hand: the drawing goes back as the reference, with a sentence
naming the one thing to colour and asking for everything else to stay as it is.

    python3 art/scripts/scenery_pink.py                  # all six
    python3 art/scripts/scenery_pink.py chapter-hypes --n 2

Output: art/raw/<scene>/pink_<i>.png. The one to use is named in scenery_video.py.
"""
import argparse
import base64
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "art/raw"

KEEP = (
    " Only that is coloured: flat hot pink (#FF0083) fills inside the existing outlines, with the "
    "dark outlines kept as they are and any light-grey shading on it becoming a slightly darker "
    "pink. Everything else in the drawing stays exactly as it is: the same lines, shapes, positions, "
    "line weight, pale background layer and framing, still in grey on pure white paper. Nothing "
    "else turns pink, nothing is added, removed or redrawn."
)

# The drawing each one starts from, and the one thing in it that turns pink.
SCENES = {
    "scene-left": dict(
        source="scene-left/cleared_2.png",
        prompt="In this drawing, colour the satellite dish on the roof of the lab hot pink." + KEEP,
    ),
    "scene-right": dict(
        source="scene-right/cleared_1.png",
        prompt="In this drawing, colour the rocket's nose cone and its fins hot pink." + KEEP,
    ),
    "chapter-niches": dict(
        source="chapter-niches/generated_1.png",
        prompt=(
            "In this drawing, colour the single circled dot on the round radar screen, the one the "
            "robot is pointing at, hot pink, with its circle."
        )
        + KEEP,
    ),
    "chapter-hypes": dict(
        source="chapter-hypes/generated_1.png",
        prompt="In this drawing, colour the surfboard the robot is standing on hot pink." + KEEP,
    ),
    "chapter-tactics": dict(
        source="chapter-tactics/generated_1.png",
        prompt="In this drawing, colour the bullseye target drawn on the whiteboard hot pink." + KEEP,
    ),
    "chapter-growth": dict(
        source="chapter-growth/generated_2.png",
        prompt="In this drawing, colour the petals of the flower on top of the tallest plant hot pink." + KEEP,
    ),
}


def paint(name: str, n: int, model: str) -> tuple[str, list[Path]]:
    spec = SCENES[name]
    (RAW / name / "pink_prompt.txt").write_text(spec["prompt"] + "\n")
    with open(RAW / spec["source"], "rb") as source:
        result = OpenAI().images.edit(
            model=model,
            image=source,
            prompt=spec["prompt"],
            size="1536x1024",
            quality="high",
            background="opaque",
            n=n,
        )
    paths = []
    for i, item in enumerate(result.data, start=1):
        path = RAW / name / f"pink_{i}.png"
        path.write_bytes(base64.b64decode(item.b64_json))
        paths.append(path)
    return name, paths


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", default=list(SCENES))
    ap.add_argument("--n", type=int, default=2)
    ap.add_argument("--model", default="chatgpt-image-latest")
    args = ap.parse_args()
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set")
    unknown = [n for n in args.names if n not in SCENES]
    if unknown:
        raise SystemExit(f"unknown scene(s): {', '.join(unknown)}")
    with ThreadPoolExecutor(max_workers=6) as pool:
        for name, paths in pool.map(lambda n: paint(n, args.n, args.model), args.names):
            print(name)
            for p in paths:
                print(f"- {p}")


if __name__ == "__main__":
    main()
