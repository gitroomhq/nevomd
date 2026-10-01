#!/usr/bin/env python3
"""Phase 0 style probe.

Generates the first set of illustrations in parallel with the generate-image skill's
script, one folder per asset under art/raw/. Run from anywhere:

    python3 art/scripts/probe.py            # every asset
    python3 art/scripts/probe.py brain-shell node-radar
"""
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEN = Path.home() / ".claude/skills/generate-image/scripts/generate_image.py"

# The style recipe from PLAN.md section 8. Every prompt starts with it so the set matches.
STYLE = (
    "Flat monoline vector illustration. Uniform thin dark-grey outlines (#4A4A4A) with round "
    "caps and joins, the same line weight everywhere. White fills. Flat light-grey shading "
    "shapes (#EEEEEE) with no outline. No gradients, no textures, no drop shadows, no text or "
    "letters. Simple friendly geometric forms. Transparent background, subject centered with "
    "a 10% margin. "
)

ASSETS = {
    "brain-full": dict(
        size="1024x1024", background="transparent", n=2,
        prompt=STYLE + (
            "Subject: a human brain seen from the side (lateral view of one hemisphere): a rounded "
            "cerebrum whose folds are drawn as a few calm, soft, curving squiggle lines, with a "
            "small brain stem at the bottom. Cute and simplified, not anatomical. No pink: only "
            "dark-grey lines, white and light grey."
        ),
    ),
    "brain-shell": dict(
        size="1024x1024", background="transparent", n=3,
        prompt=STYLE + (
            "Subject: the EMPTY outline of a cartoon brain seen from the side. Draw only the outer "
            "contour: a rounded blob whose edge is made of soft bumpy scallops, like the silhouette "
            "of a brain, with a small brain stem poking out at the bottom. The inside of the shape "
            "is completely blank plain white: NO interior lines, NO folds, NO squiggles, nothing "
            "drawn inside. Add one flat light-grey crescent of shading hugging the inside of the "
            "lower-right edge. No pink."
        ),
    ),
    "brain-surface": dict(
        size="1536x1024", background="opaque", n=2,
        prompt=(
            "Flat seamless pattern that fills the entire image from edge to edge, with no border and "
            "no margin: the folds of a brain's surface (gyri and sulci) drawn as a maze of soft, "
            "rounded, winding squiggle lines, like brain coral or a labyrinth. Uniform thin dark-grey "
            "lines (#4A4A4A) with round caps, the same line weight everywhere, on a pure white "
            "(#FFFFFF) background. Completely flat and top-down: no perspective, no shading, no "
            "fills, no gradients, no objects, no text. Even, medium density with generous white "
            "space between the lines. The lines run off all four edges of the image."
        ),
    ),
    "node-radar": dict(
        size="1024x1024", background="transparent", n=2,
        prompt=STYLE + (
            "Subject: a single small object, icon-like: a round radar screen on a short stand, with "
            "two concentric rings and one sweep line. Exactly one small hot-pink (#FF0083) detail: "
            "a single blip dot on the radar screen."
        ),
    ),
    "node-antenna": dict(
        size="1024x1024", background="transparent", n=2,
        prompt=STYLE + (
            "Subject: a single small object, icon-like: a simple radio antenna mast on a tiny base, "
            "with three curved signal arcs radiating from its tip. Exactly one hot-pink (#FF0083) "
            "detail: the three signal arcs are hot pink."
        ),
    ),
    "node-tactics": dict(
        size="1024x1024", background="transparent", n=2,
        prompt=STYLE + (
            "Subject: a single small object, icon-like: a coach's tactics clipboard showing a play, "
            "with two small X marks, two small O marks and one curved arrow. Exactly one hot-pink "
            "(#FF0083) detail: the curved arrow is hot pink."
        ),
    ),
    "node-rocket": dict(
        size="1024x1024", background="transparent", n=2,
        prompt=STYLE + (
            "Subject: a single small object, icon-like: a small chunky rocket flying upward at a "
            "slight angle, with one round window and two fins. Exactly one hot-pink (#FF0083) "
            "detail: the flame at its tail is hot pink."
        ),
    ),
}


def run(name: str) -> tuple[str, int, str]:
    spec = ASSETS[name]
    out = ROOT / "art/raw" / name
    out.mkdir(parents=True, exist_ok=True)
    (out / "prompt.txt").write_text(spec["prompt"] + "\n")
    cmd = [
        sys.executable, str(GEN),
        "--prompt", spec["prompt"],
        "--size", spec["size"],
        "--quality", "high",
        "--background", spec["background"],
        "--n", str(spec["n"]),
        "--output-dir", str(out),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return name, r.returncode, (r.stdout + r.stderr).strip()[-500:]


def main() -> None:
    names = sys.argv[1:] or list(ASSETS)
    unknown = [n for n in names if n not in ASSETS]
    if unknown:
        sys.exit(f"unknown asset(s): {', '.join(unknown)}")
    with ThreadPoolExecutor(max_workers=4) as pool:
        for name, code, tail in pool.map(run, names):
            print(f"[{'ok' if code == 0 else 'FAILED'}] {name}\n{tail}\n", flush=True)


if __name__ == "__main__":
    main()
