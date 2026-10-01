#!/usr/bin/env python3
"""Takes things out of the two picked scenes: what Nevo crossed out on the page.

The scenes are best when the big thing (the lab, the rocket) is at the outer end and the end
nearest the brain is nearly empty. So the small things that stood there are removed: the
delivery robot and the toolbox on the left, the robot on its crate and the dog on the right.

Nothing clever: the picked drawing goes back to the image model as the reference, with a
sentence saying what to take out and to leave the rest alone.

    python3 art/scripts/scenery_clear.py              # both
    python3 art/scripts/scenery_clear.py scene-left --n 2

Output: art/raw/<scene>/cleared_<i>.png. The one to use is named in scenery_video.py.
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
    " Keep everything else in the drawing exactly as it is: the same lines, the same shapes, the "
    "same positions, the same line weight, the same pale grey layer behind, the same framing. Do "
    "not redraw, restyle, move or add anything. Strictly greyscale, pure white paper."
)

SCENES = {
    "scene-left": dict(
        source="scene-left/generated_1.png",
        prompt=(
            "Remove two things from the right side of this drawing: the small wheeled delivery robot "
            "carrying a cardboard box, and the open toolbox with the tools and pebbles around it. "
            "Where they stood there is now nothing: only the dark ground line running straight on, "
            "empty white paper above it, and the pale bushes of the background carrying on behind."
        )
        + KEEP,
    ),
    "scene-right": dict(
        source="scene-right/generated_1.png",
        prompt=(
            "Remove these things from the left side of this drawing: the robot sitting on the wooden "
            "crate with its megaphone, the crate, the white bushes around the crate, the small dog, "
            "and the loose ground marks under them. Where they were there is now nothing: only empty "
            "white paper at ground level, with the pale clouds, the pale hills and the pale "
            "observatory dome of the background carrying on behind."
        )
        + KEEP,
    ),
}


def clear(name: str, n: int, model: str) -> tuple[str, list[Path]]:
    spec = SCENES[name]
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
        path = RAW / name / f"cleared_{i}.png"
        path.write_bytes(base64.b64decode(item.b64_json))
        paths.append(path)
    return name, paths


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", default=list(SCENES))
    ap.add_argument("--n", type=int, default=1)
    ap.add_argument("--model", default="chatgpt-image-latest")
    args = ap.parse_args()
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set")
    with ThreadPoolExecutor(max_workers=2) as pool:
        for name, paths in pool.map(lambda n: clear(n, args.n, args.model), args.names):
            print(name)
            for p in paths:
                print(f"- {p}")


if __name__ == "__main__":
    main()
