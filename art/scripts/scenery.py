#!/usr/bin/env python3
"""The page's drawings in Lemonade's hand: the hero's two scenes (a robot lab on the left of
the brain and a launch site on the right, the way Lemonade's hero has a street either side
of its headline), and one scene for each of the four abilities.

The drawings have to match Lemonade's hand, which words alone do not pin down, so each one
is drawn with a crop of Lemonade's own hero as a STYLE reference (reference/, which is kept
out of the repo). The subject is ours: nothing of theirs is copied.

One folder of candidates per side under art/raw/. The pick of each side then has the things
near the brain taken out of it (scenery_clear.py) and is made into a video (scenery_video.py).

    python3 art/scripts/scenery.py              # both sides
    python3 art/scripts/scenery.py scene-left --n 3
"""
import argparse
import base64
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]

STYLE = (
    "Use the attached image ONLY as a style reference. Do not copy anything it shows: no house, "
    "no car, no cat, no person, no dog, no bench, no tree from it. Draw a brand-new illustration "
    "of a different subject in exactly the same drawing style, as if by the same illustrator for "
    "the same website:\n"
    "- thin, even dark-grey outlines (#4A4A4A) with round ends, all the same weight; here and there "
    "a line is broken by a small deliberate gap or a short dash;\n"
    "- flat fills only: white for faces turned to the light, light grey (#E8E8E8) for faces turned "
    "away, and slanted light-grey reflection stripes on glass;\n"
    "- buildings and large objects in a gentle three-quarter view, showing a front face and a "
    "shaded side face;\n"
    "- behind the main drawing, a second layer of very pale grey silhouettes (#F1F1F1, with thin "
    "outlines only slightly darker, never dark) and pale flat clouds;\n"
    "- rounded white bushes, like small clouds, at the foot of the buildings;\n"
    "- characters are simple and charming, with two dot eyes and a small smile.\n"
    "Strictly greyscale: no colour anywhere. Pure white (#FFFFFF) background. No text, letters, "
    "numbers or logos. No frame or border.\n"
)

VIGNETTE = (
    "Composition: landscape format, one small scene in the middle of the image with generous "
    "empty white space all round it, nothing touching or cut off by the edges. One thin dark ground "
    "line runs under the scene, and everything stands on it. The same friendly robot appears in "
    "every scene of this set: a rounded boxy head with two dot eyes and a small smile, one short "
    "antenna, a boxy body and jointed arms."
)

LAYOUT = (
    "Composition: landscape format. One thin dark ground line runs straight across the whole width "
    "of the image, close to the bottom edge, and everything stands on it. "
)

ASSETS = {
    "scene-left": dict(
        reference="lemonade-hero-left.png",
        prompt=STYLE + (
            "Subject: a small robotics lab on the edge of a town, seen from the street. At the far "
            "left stands a two-storey lab building in three-quarter view, with a flat roof carrying a "
            "satellite dish and a thin antenna, a round window upstairs, and a wide open roller door "
            "at street level. Just inside the open door is a workbench with a computer monitor, a "
            "desk lamp and two glass flasks. A friendly robot stands at the bench assembling a small "
            "gadget with a screwdriver: it has a rounded boxy head with two dot eyes and a small "
            "smile, one short antenna, a boxy body and jointed arms. To the right of the building, "
            "out in the open, a small wheeled delivery robot carries a cardboard box, and beyond it "
            "sits a toolbox on the ground. Pale silhouettes behind: taller lab buildings, a radio "
            "telescope dish, a water tower, and clouds.\n"
        ) + LAYOUT + (
            "The lab building fills the left half of the image and reaches almost to the top. The "
            "right half holds only the low things, so the upper right of the image is empty white."
        ),
    ),
    "scene-right": dict(
        reference="lemonade-hero-right.png",
        prompt=STYLE + (
            "Subject: a small rocket launch site on the edge of a town. At the far right stands a "
            "launch tower in three-quarter view, a simple lattice gantry, with a chunky friendly "
            "rocket standing beside it on a low launch pad, a ladder leaning on the tower, and a small "
            "control cabin with a window and a door at its foot. To the left, out in the open, a "
            "friendly robot sits on a wooden crate, holding a megaphone up to its face and pointing "
            "it to the left: it has a rounded boxy head with two dot eyes and a small smile, one short "
            "antenna, a boxy body and jointed arms. At the far left a small robot dog sits on the "
            "ground, looking up at the robot. Pale silhouettes behind: an observatory dome, a large "
            "satellite dish, low hills, a ringed planet, a crescent moon, a few small stars, and "
            "clouds.\n"
        ) + LAYOUT + (
            "The tower and the rocket fill the right half of the image and reach almost to the top. "
            "The left half holds only the low things, so the upper left of the image is empty white."
        ),
    ),
    # One scene per ability, shown beside its text and brought to life like the hero's.
    "chapter-niches": dict(
        reference="lemonade-hero-left.png",
        prompt=STYLE + (
            "Subject: finding the audience nobody is serving. A small radar station on a quiet hill: "
            "a big radar dish on a lattice stand, and beside it the friendly robot sitting at a little "
            "desk with a round radar screen on it. The screen shows a crowded cluster of small dots on "
            "one side and, far from them in an empty corner, one single dot with a circle drawn round "
            "it; the robot points at that one dot. Pale silhouettes behind: a crowded little town far "
            "away on the left, empty rolling hills on the right, a few clouds.\n"
        ) + VIGNETTE,
    ),
    "chapter-hypes": dict(
        reference="lemonade-hero-right.png",
        prompt=STYLE + (
            "Subject: catching the wave before it gets crowded. The friendly robot rides a surfboard "
            "on a big curling wave, right at its start, the only one on it. Far away on the beach at the "
            "right, a crowd of small robots with surfboards is only now running toward the water. The "
            "wave is drawn with thin lines, white with light-grey shading. Pale silhouettes behind: a "
            "pier, two palm trees, a few clouds.\n"
        ) + VIGNETTE,
    ),
    "chapter-tactics": dict(
        reference="lemonade-hero-left.png",
        prompt=STYLE + (
            "Subject: knowing which plays work this year. The friendly robot, as a coach with a whistle, "
            "stands beside a big whiteboard on an easel and points at a play drawn on it: a few crosses "
            "and circles and curved arrows leading to a target. Two smaller robots sit on a bench in "
            "front of it, one taking notes on a clipboard. Pale silhouettes behind: a sports field with "
            "goal posts, a scoreboard, a few clouds.\n"
        ) + VIGNETTE,
    ),
    "chapter-growth": dict(
        reference="lemonade-hero-right.png",
        prompt=STYLE + (
            "Subject: growing the number without more traffic. The friendly robot, as a gardener, waters "
            "a row of five potted plants on a low wooden bench with a watering can. Each plant is taller "
            "than the one before it, so together they look like a bar chart going up, and the last and "
            "tallest one has a small flower on top. Pale silhouettes behind: the frame of a greenhouse, "
            "shelves with pots, a few clouds.\n"
        ) + VIGNETTE,
    ),
}


def run(name: str, n: int, model: str) -> tuple[str, list[Path]]:
    spec = ASSETS[name]
    out = ROOT / "art/raw" / name
    out.mkdir(parents=True, exist_ok=True)
    (out / "prompt.txt").write_text(spec["prompt"] + "\n")
    client = OpenAI()
    with open(ROOT / "reference" / spec["reference"], "rb") as ref:
        result = client.images.edit(
            model=model,
            image=ref,
            prompt=spec["prompt"],
            size="1536x1024",
            quality="high",
            background="opaque",
            n=n,
        )
    paths = []
    for i, item in enumerate(result.data, start=1):
        path = out / f"generated_{i}.png"
        path.write_bytes(base64.b64decode(item.b64_json))
        paths.append(path)
    return name, paths


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", default=list(ASSETS))
    ap.add_argument("--n", type=int, default=2)
    ap.add_argument("--model", default="chatgpt-image-latest")
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set")
    unknown = [n for n in args.names if n not in ASSETS]
    if unknown:
        raise SystemExit(f"unknown asset(s): {', '.join(unknown)}")

    with ThreadPoolExecutor(max_workers=4) as pool:
        for name, paths in pool.map(lambda n: run(n, args.n, args.model), args.names):
            print(name)
            for p in paths:
                print(f"- {p}")


if __name__ == "__main__":
    main()
