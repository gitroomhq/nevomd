#!/usr/bin/env python3
"""Nevo in each ability's section, with the brain: two key frames of him doing that section's
thing with it, drawn by the image model in the site's line style. Seedance then animates from
the first frame to the second (scenery_video.py), and the page scrubs through it with the mouse.

Three steps, each looked at before the next:

    python3 art/scripts/nevo_acts.py sheet                     # Nevo as we draw him, from his photo
    python3 art/scripts/nevo_acts.py first [acts]              # frame A of each act
    python3 art/scripts/nevo_acts.py last scan --pick first_2  # frame B, drawn from the chosen A
    python3 art/scripts/nevo_acts.py before grow --pick last_1 # or A drawn back from a chosen B

References (reference/ is kept out of the repo):
  - reference/nevo-photo-1.png        his photo: the likeness comes from here
  - art/raw/nevo-sheet/<SHEET>        the chosen sheet: how he looks in our lines
  - reference/lemonade-hero-left.png  Lemonade's hand, for the style only
  - src/assets/art/brain-still.png    the site's brain, so the drawn one is the same brain

Output: art/raw/nevo-<act>/<frame><tag>_<i>.png, with the prompt beside them.
"""
import argparse
import base64
import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from pathlib import Path

from openai import OpenAI
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "art/raw"
PREPARED = ROOT / "art/prepared"

PHOTO = ROOT / "reference/nevo-photo-1.png"
STYLE_REF = ROOT / "reference/lemonade-hero-left.png"
BRAIN = ROOT / "src/assets/art/brain-still.png"
# The sheet every scene is drawn from, chosen by eye after `sheet`.
SHEET = RAW / "nevo-sheet/sheet_2.png"

# What he looks like, from the photo, in words: the model keeps a likeness better when it is
# told what to look at. The drawn version of each feature is said too, so it survives the style.
LIKENESS = (
    "a broad face with full cheeks and a wide, strong jaw and chin; thick, almost black hair combed "
    "back from the forehead in one smooth slicked-back sweep with a little height at the front, the "
    "sides cut short (drawn as one flat dark-grey shape with a few thin white lines showing the comb); "
    "thick, dark, straight eyebrows set low over the eyes (two bold dark strokes); dark, slightly "
    "hooded almond-shaped eyes with a calm, confident look; a straight, fairly strong nose with a "
    "rounded tip; full lips, the lower one especially; a short, dense dark beard along the whole "
    "jawline and under the chin, with a thin moustache and a small patch under the lower lip, the "
    "cheeks above the jaw clear (drawn as a flat mid-grey area following the jaw). He wears a "
    "button-up shirt with a collar, flat light grey like washed denim, sleeves rolled up to the "
    "elbows, dark trousers and white sneakers"
)

STYLE = (
    "Draw in exactly the style of the style image, as if by the same illustrator: thin, even "
    "dark-grey outlines (#4A4A4A) with round ends, all the same weight; flat fills only, with no "
    "shading, hatching, gradients or texture; white for surfaces turned to the light and light grey "
    "(#E8E8E8) for surfaces turned away; very pale grey silhouettes behind (#F1F1F1, with thin "
    "outlines only slightly darker) and pale flat clouds. A simple, charming cartoon, not a "
    "caricature, with his head a little large for his body so that his face reads clearly. Pure "
    "white (#FFFFFF) background. No text, letters, numbers or logos."
)
PINK = (
    " Strictly greyscale except one thing, named below, which is flat hot pink (#FF0083) with its "
    "dark outline kept.\n"
)

CAST = (
    "The first attached image is a photo of Nevo: draw exactly this man, so that anyone who knows him "
    f"recognises him at once: {LIKENESS}. The second attached image is Nevo as we draw him: keep his "
    "face, hair, beard and clothes exactly like that. The third attached image shows the drawing "
    "style only: copy nothing that it shows. The fourth attached image is the brain: a rounded white "
    "brain with grey winding fold lines and a small stem underneath, about the size of a football, "
    "drawn in the same line style as everything else; it has no face.\n"
)

FRAME = (
    "Composition: landscape format. One compact scene in the middle of the image, with empty white "
    "space all round it; nothing touches or is cut off by the edges. Nevo is big: his figure fills "
    "most of the height of the image, with his face turned enough toward the viewer to be clearly "
    "seen. Everything in the scene sits close around him. One thin dark ground line runs under the "
    "scene."
)

ACTS = {
    # Finds the audience nobody is serving. The mouse, across: where he points the brain.
    "scan": dict(
        first=(
            "Nevo stands on a small grassy hill, seen from the knees up, holding the brain up high at "
            "arm's length out to the LEFT of the picture, like a radar, scanning the land with it. Three "
            "curved radar arcs spread out from the LEFT side of the brain, toward a crowded little town "
            "of pale buildings on the left of the picture; nothing comes off its right side. He looks "
            "at the town with a small frown: it is crowded. On the right of the picture, empty rolling "
            "hills with one small lone cottage on them. The three radar arcs are the pink thing."
        ),
        last=(
            "Nevo has swung the brain up and over to the RIGHT side of the picture: he now holds it up "
            "high at arm's length out to the right, in the empty sky above the small lone cottage on "
            "the hills, and the three pink radar arcs come off its right side toward the cottage. He "
            "has turned his head and shoulders to the right with it and smiles: he has found it. He is "
            "exactly the same size and in the same place, still seen from the knees up. The hill, the "
            "town on the left, the cottage, the hills and the clouds stay exactly as they are in the "
            "first image."
        ),
    ),
    # Catches hypes early. The mouse, across: the wave rises and he stands up on it.
    "surf": dict(
        first=(
            "Nevo sits astride a surfboard on calm water, in three-quarter view, legs in the water, "
            "turned toward the viewer. The brain sits on the front of the board in front of him, riding "
            "along like a surfing dog. Behind them on the left, a smooth wave is just beginning to rise, "
            "and Nevo looks back over his shoulder at it. Far away on the right, a pale beach with two "
            "palm trees. The surfboard is the pink thing."
        ),
        last=(
            "The wave behind has risen higher and begins to curl over at the top, still drawn with the "
            "same few clean lines and flat pale fill as in the first image, and still inside the "
            "picture. Nevo has popped up from sitting into a low surfing crouch on the pink surfboard, "
            "knees deeply bent, riding along the face of the wave; he has picked up the brain and holds "
            "it out to the side in one hand like a trophy, the other arm out for balance, with a big "
            "grin. He crouches low: his head is no higher than it was. The beach and the palm trees far "
            "away do not move."
        ),
    ),
    # Knows which tactics work. The mouse, across: the kick, and the brain flying into the goal.
    "coach": dict(
        first=(
            "From left to right: on the far left, a whiteboard on an easel with a play drawn on it: a "
            "few X's and O's and one dashed curved arrow sweeping right. Next to it, Nevo, in "
            "three-quarter view, facing RIGHT, toward the goal. Just to the right of his feet, between "
            "him and the goal, the brain rests on the grass like a football. On the far right, a small "
            "football goal whose net is the pink thing. He is about to kick the brain to the right, "
            "into the goal: his kicking leg is drawn back behind him, his arms are out for balance and "
            "his eyes are on the brain, focused."
        ),
        last=(
            "Nevo has kicked the brain: it is in the back of the pink net of the goal on the right, the "
            "net bulging. Nevo follows through, his kicking leg high, both arms up, cheering, turned a "
            "little toward the viewer. He is on the same spot. Nothing is drawn in the air: no dashed "
            "lines, arrows or motion lines (a trail would tell the animation which way the brain went). "
            "The whiteboard, the play drawn on it, the easel and the goal stay exactly as they are in "
            "the first image."
        ),
    ),
    # Grows the number without more traffic. The mouse, up: the brain grows.
    "grow": dict(
        first=(
            "Nevo kneels on one knee beside a flower pot on the ground, in three-quarter view, and "
            "tilts a watering can over it, a few drops falling. Out of the pot grows a small brain, "
            "the size of an apple, on a short stem with two leaves, like a seedling. Pale silhouettes "
            "behind: the frame of a small greenhouse and a shelf of pots. The watering can is the pink "
            "thing."
        ),
        last=(
            "The small brain has grown: its stem rises straight up out of the pot into the empty space "
            "above it, its leaves stepping up it like the bars of a rising chart, and the brain at its "
            "top is big now, as big as Nevo's head and level with his face, white with grey fold lines "
            "exactly like the small one (it is not pink: the watering can is the only pink thing). The "
            "pot does not move and is the same size: it stays exactly where it is in the first image. "
            "Nevo is copied unchanged from the first image, the same size, in the same place, kneeling "
            "in the same pose with the pink watering can in the same hand; only his head turns to look "
            "at the big brain, delighted."
        ),
        # Drawn back from the last frame (`before`): the model shrinks Nevo to make room for the
        # grown plant whenever it draws forward, but has no reason to when the plant gets smaller.
        before=(
            "The brain is only a seedling again: a small brain the size of an apple on a short stem with "
            "two leaves, low in the same pot, which stays exactly where it is and the same size. The "
            "space above the pot is empty. Nevo, the same size, in the same place and in the same "
            "kneeling pose, tilts the pink watering can over the pot, a few drops falling onto the "
            "seedling, and looks at the viewer with a calm, confident smile."
        ),
    ),
}

SHEET_PROMPT = (
    "The first attached image is a photo of a man, Nevo. Draw a character sheet of exactly this man, "
    f"so that anyone who knows him recognises him at once: {LIKENESS}. On the left, a large "
    "head-and-shoulders portrait of him in three-quarter view, as in the photo, taking up half the "
    "picture; on the right, him standing full length, facing the viewer, arms relaxed, with a "
    "friendly, calm look and a slight closed-mouth smile. The second attached image shows the "
    "drawing style only: copy nothing that it shows. "
    + STYLE
    + " Strictly greyscale."
)

def keep(which: str) -> str:
    """The prompt for a key frame drawn from another: `which` is "the next key frame" or "the key
    frame before it"."""
    return (
        f"The first attached image is a key frame of an animation. Draw {which} in the same "
        "animation: the same drawing, the same place, the same framing (the camera does not move: do "
        "not zoom out, and nothing is drawn smaller to make room), the same size and position of "
        "everything that does not move, the same pink thing, and exactly the same style: the same "
        "thin outlines and flat fills, with no more detail, texture or shading than there. Nevo is "
        f"the same size and looks exactly as he does there ({LIKENESS}; the second attached image is "
        "Nevo as we draw him and the third a photo of him). The brain looks exactly as it does there: "
        "white, with grey fold lines. Only this changes: "
    )


def brain_ref() -> Path:
    """The site's brain on white paper, cropped close: the model reads transparency as black."""
    out = PREPARED / "brain-ref.png"
    if not out.exists():
        im = Image.open(BRAIN).convert("RGBA")
        paper = Image.new("RGBA", im.size, "white")
        paper.alpha_composite(im)
        left, top, right, bottom = im.getchannel("A").getbbox()
        pad = 64
        paper.crop((left - pad, top - pad, right + pad, bottom + pad)).convert("RGB").save(out)
    return out


def edit(images: list[Path], prompt: str, n: int, model: str) -> list[bytes]:
    with ExitStack() as stack:
        files = [stack.enter_context(open(p, "rb")) for p in images]
        result = OpenAI().images.edit(
            model=model,
            image=files,
            prompt=prompt,
            size="1536x1024",
            quality="high",
            background="opaque",
            n=n,
        )
    return [base64.b64decode(item.b64_json) for item in result.data]


def draw(act: str, frame: str, n: int, model: str, pick: str, tag: str) -> tuple[str, list[Path]]:
    if frame == "sheet":
        out = RAW / "nevo-sheet"
        prompt = SHEET_PROMPT
        images = [PHOTO, STYLE_REF]
    else:
        out = RAW / f"nevo-{act}"
        spec = ACTS[act]
        if frame == "first":
            prompt = CAST + STYLE + PINK + spec["first"] + "\n" + FRAME
            images = [PHOTO, SHEET, STYLE_REF, brain_ref()]
        elif frame == "last":
            prompt = keep("the next key frame") + spec["last"]
            images = [out / f"{pick}.png", SHEET, PHOTO]
        else:
            prompt = keep("the key frame before it") + spec["before"]
            images = [out / f"{pick}.png", SHEET, PHOTO]
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{frame}{tag}_prompt.txt").write_text(prompt + "\n")
    paths = []
    for i, data in enumerate(edit(images, prompt, n, model), start=1):
        path = out / f"{frame}{tag}_{i}.png"
        path.write_bytes(data)
        paths.append(path)
    return act, paths


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("frame", choices=["sheet", "first", "last", "before"])
    ap.add_argument("acts", nargs="*", default=list(ACTS))
    ap.add_argument("--n", type=int, default=2)
    ap.add_argument("--pick", default="first_1", help="the frame a last frame (or, for `before`, a first frame) is drawn from")
    ap.add_argument("--tag", default="", help="kept in the file names, so a second try does not overwrite the first")
    ap.add_argument("--model", default="chatgpt-image-latest")
    args = ap.parse_args()
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set")
    names = ["sheet"] if args.frame == "sheet" else args.acts
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = pool.map(lambda a: draw(a, args.frame, args.n, args.model, args.pick, args.tag), names)
        for act, paths in jobs:
            print(act)
            for p in paths:
                print(f"- {p}")


if __name__ == "__main__":
    main()
