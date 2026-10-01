#!/usr/bin/env python3
"""The last section: "Nevo's brain never sleeps". Nevo asleep in his bedroom while his brain,
wide awake at the desk, works on a laptop. Drawn twice by the image model: with the lamp on,
and the same drawing at night with the lights off, where the only light is the laptop's pink
glow. The page shows the first, and when you reach the bottom the lights go off (like the end
of lemonade.com/life); the night one is then brought to life by Seedance (scenery_video.py).

    python3 art/scripts/night_room.py light                  # the room with the lamp on
    python3 art/scripts/night_room.py dark --pick light_1    # the same room at night

References: as in nevo_acts.py (his photo, the sheet drawn from it, Lemonade's hand for the
style only, the site's brain).

Output: art/raw/night/<frame><tag>_<i>.png, with the prompt beside them.
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nevo_acts as na  # noqa: E402

OUT = na.RAW / "night"

# The site's footer colour: the night room's dark is this exactly, so it runs into the footer.
NIGHT = "#202020"

ROOM = (
    "Bedtime in Nevo's bedroom, seen straight from the front like a stage, everything standing on "
    "one floor line. On the far left, a bedside table with a small lamp, switched on. Next to it, a "
    "bed with its headboard on the left, and Nevo fast asleep in it: lying on his back, his head on "
    "the pillow turned a little toward the viewer, eyes closed, a peaceful little smile, the blanket "
    "pulled up to his chest, one arm resting on top of it. To the right of the bed, a small desk "
    "with an open laptop, its screen turned toward us at an angle. Sitting on a little stool at the "
    "desk, the brain, wide awake and busy: it has two thin little arms, drawn as single lines with "
    "small round hands, and it is typing on the laptop, a mug of coffee beside it. On the wall "
    "behind the desk, a window with a crescent moon and a few small stars. Further right, a "
    "bookshelf. The laptop's screen is the pink thing."
)

COMPOSITION = (
    "Composition: a wide, low scene. All of it fits in a horizontal band across the middle of the "
    "image, a little over half the image's height; above and below that band the image is empty "
    "white. From left to right it fills the whole width, nothing cut off by the side edges. Nevo, "
    "in bed, and the brain at its desk are the middle of the picture and are drawn big enough that "
    "his face and the brain's little arms read clearly. One thin dark floor line runs along the "
    "bottom of the band."
)

DARK = (
    "The first attached image is a drawing of a bedroom at bedtime. Draw exactly the same drawing, "
    "with everything the same size, in the same place and in the same pose, the same framing and "
    "the same line style, but at night with the lights off. The lamp is switched off. The whole "
    f"room is in darkness: the background, the wall and the empty space round the room are a flat "
    f"near-black ({NIGHT}); the furniture, the bed, the blanket and Nevo are drawn with dark-grey "
    "flat fills (#2c2c2c to #3a3a3a) and soft mid-grey outlines (#707070), so they can still just "
    "be made out. The only light is the laptop's screen, glowing hot pink (#FF0083): a soft pink "
    "glow spreads from it into the dark, lighting the brain at the desk, its little arms, the mug "
    "and the nearest edges of the desk and the bed in pink, fading out with distance; Nevo's face "
    "catches a faint pink rim. The window shows the crescent moon and stars, pale grey. Nevo is "
    "still fast asleep and the brain is still wide awake, typing. Flat colours, no texture, no "
    "noise, no text. The second attached image is Nevo as we draw him and the third the brain: "
    "keep both looking exactly as they do in the first image."
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("frame", choices=["light", "dark"])
    ap.add_argument("--n", type=int, default=3)
    ap.add_argument("--pick", default="light_1", help="the light room the night one is drawn from")
    ap.add_argument("--tag", default="")
    ap.add_argument("--model", default="chatgpt-image-latest")
    args = ap.parse_args()
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set")

    if args.frame == "light":
        prompt = na.CAST + na.STYLE + na.PINK + ROOM + "\n" + COMPOSITION
        images = [na.PHOTO, na.SHEET, na.STYLE_REF, na.brain_ref()]
    else:
        prompt = DARK
        images = [OUT / f"{args.pick}.png", na.SHEET, na.brain_ref()]

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{args.frame}{args.tag}_prompt.txt").write_text(prompt + "\n")
    for i, data in enumerate(na.edit(images, prompt, args.n, args.model), start=1):
        path = OUT / f"{args.frame}{args.tag}_{i}.png"
        path.write_bytes(data)
        print(f"- {path}")


if __name__ == "__main__":
    main()
