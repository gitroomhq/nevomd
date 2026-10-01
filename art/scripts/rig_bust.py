#!/usr/bin/env python3
"""Turns the traced portrait into a rig the page can animate.

Input:  art/traced/nevo-bust.svg   (Vectorizer.AI, production mode; see PLAN.md section 8)
Output: src/assets/art/nevo-bust.svg   the whole drawing, for plain <img> use
        src/assets/art/nevo-rig.json   the same drawing in parts:
            base      everything that does not move on its own, as one string of <path> tags.
                      Two of them carry an id so the page can reuse them: #nb-skin, the
                      outline of the face's skin (the moving features are clipped to it), and
                      #nb-shadow, the shadow under the chin (the neck needs a second copy).
            features  eyes, brows, nose, moustache, mouth and chin, each a string of <path> tags

The trace comes back as a flat list of paths. The features are found by where they sit in
the drawing, not by their index, so a re-trace does not break the rig. Stage.astro builds
the layers from these parts: a torso that stays put, a head that turns on the neck, and a
face whose features slide across the head when it turns, which is what makes it look round.

    python3 art/scripts/rig_bust.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art/traced/nevo-bust.svg"
OUT = ROOT / "src/assets/art"

INK = "#4a4a4a"
WHITE = "#ffffff"
# The trace keeps the drawing's greys (five of them, darkest first). Its darkest is the line,
# and becomes the site's ink; the rest stay as traced, which is where the hair's strands and
# the beard's texture live. (The first trace snapped everything to three colours and lost them.)
RECOLOUR = {"#646464": INK}

# Where each feature sits, in the drawing's 1024-pixel coordinates: (x0, y0, x1, y1).
# A path belongs to the first feature whose box holds its centre and whose limits it meets.
ANY = None
FEATURES = {
    "browL": dict(box=(365, 280, 492, 318), fills=ANY, min_width=8),
    "browR": dict(box=(522, 280, 648, 318), fills=ANY, min_width=8),
    "eyeL": dict(box=(385, 310, 495, 352), fills=ANY, max_height=40),
    "eyeR": dict(box=(530, 310, 635, 352), fills=ANY, max_height=40),
    "nose": dict(box=(458, 385, 562, 440), fills=ANY, max_width=110),
    "mouth": dict(box=(432, 468, 592, 512), fills=ANY, max_width=170, max_height=40),
    "chin": dict(box=(462, 505, 560, 535), fills=ANY, max_width=100),
    # The moustache only: the stubble along the jaw stays with the head's outline.
    "moustache": dict(box=(422, 430, 604, 470), fills=ANY, max_width=190, min_x=418, max_x=608),
}
# The big white shape of the face, and the shadow under the chin.
SKIN = dict(box=(440, 300, 580, 470), fill=WHITE, min_width=250)
SHADOW = dict(box=(450, 590, 570, 640), fill="#c9c9c9", min_width=90)


def points(d: str) -> tuple[list[float], list[float]]:
    """The x and y of every point a path passes through or bends towards (absolute commands).
    An arc's first five numbers are its radii, rotation and flags, not a point."""
    xs, ys = [], []
    for cmd, args in re.findall(r"([MLCQAZ])([^MLCQAZ]*)", d):
        nums = [float(v) for v in re.findall(r"-?\d+\.?\d*", args)]
        if cmd == "A":
            nums = [v for i in range(0, len(nums), 7) for v in nums[i + 5 : i + 7]]
        xs += nums[0::2]
        ys += nums[1::2]
    return xs, ys


def parse(svg: str) -> list[dict]:
    paths = []
    for attrs in re.findall(r"<path([^>]*)/>", svg, flags=re.S):
        # Vectorizer's gap fillers: hairline strokes that hide seams between shapes. On a
        # rig whose features move they would be left behind, so they go.
        if "stroke=" in attrs:
            continue
        fill = re.search(r'fill="([^"]+)"', attrs).group(1).lower()
        fill = RECOLOUR.get(fill, fill)
        d = re.search(r'\bd="([^"]+)"', attrs, flags=re.S).group(1)
        xs, ys = points(d)
        paths.append(dict(fill=fill, d=compact(d), x0=min(xs), y0=min(ys), x1=max(xs), y1=max(ys)))
    return paths


def compact(d: str) -> str:
    """Round to one decimal and drop the padding: about a third of the size for no visible change."""
    d = re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.1f}".rstrip("0").rstrip("."), d)
    d = re.sub(r"\s+", " ", d).strip()
    return re.sub(r" ?([MLCQZ]) ?", r"\1", d)


def inside(p: dict, box: tuple) -> bool:
    cx, cy = (p["x0"] + p["x1"]) / 2, (p["y0"] + p["y1"]) / 2
    return box[0] <= cx <= box[2] and box[1] <= cy <= box[3]


def feature_of(p: dict) -> str | None:
    w, h = p["x1"] - p["x0"], p["y1"] - p["y0"]
    for name, rule in FEATURES.items():
        if not inside(p, rule["box"]) or (rule["fills"] is not None and p["fill"] not in rule["fills"]):
            continue
        if w < rule.get("min_width", 0) or w > rule.get("max_width", 1e9) or h > rule.get("max_height", 1e9):
            continue
        if p["x0"] < rule.get("min_x", -1e9) or p["x1"] > rule.get("max_x", 1e9):
            continue
        return name
    return None


def one(paths: list[dict], rule: dict, what: str) -> dict:
    hits = [p for p in paths if p["fill"] == rule["fill"] and inside(p, rule["box"]) and p["x1"] - p["x0"] >= rule["min_width"]]
    if len(hits) != 1:
        raise SystemExit(f"expected one path for {what}, found {len(hits)}. Check its box against the trace.")
    return hits[0]


def tag(p: dict) -> str:
    name = f' id="{p["id"]}"' if "id" in p else ""
    return f'<path{name} fill="{p["fill"]}" d="{p["d"]}"/>'


def main() -> None:
    paths = parse(SRC.read_text())
    groups: dict[str, list[dict]] = {name: [] for name in FEATURES}
    base: list[dict] = []
    for p in paths:
        name = feature_of(p)
        (groups[name] if name else base).append(p)

    missing = [name for name, members in groups.items() if not members]
    if missing:
        raise SystemExit(f"could not find: {', '.join(missing)}. Check the boxes in FEATURES against the trace.")

    whole = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">'
        + "".join(tag(p) for p in paths)
        + "</svg>"
    )
    one(base, SKIN, "the face's skin")["id"] = "nb-skin"
    one(base, SHADOW, "the shadow under the chin")["id"] = "nb-shadow"
    rig = {
        "base": "".join(tag(p) for p in base),
        "features": {name: "".join(tag(p) for p in members) for name, members in groups.items()},
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "nevo-rig.json").write_text(json.dumps(rig, separators=(",", ":")))
    (OUT / "nevo-bust.svg").write_text(whole)
    for stale in ("nevo-bust.face.svg", "nevo-bust.lid.svg"):
        (OUT / stale).unlink(missing_ok=True)

    print(f"base      {len(base)} path(s)")
    for name, members in groups.items():
        boxes = ", ".join(f'{p["fill"]} {p["x0"]:.0f}-{p["x1"]:.0f}×{p["y0"]:.0f}-{p["y1"]:.0f}' for p in members)
        print(f"{name:9} {len(members)} path(s): {boxes}")
    for f in ("nevo-bust.svg", "nevo-rig.json"):
        print(f"{f:22} {(OUT / f).stat().st_size / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
