#!/usr/bin/env python3
"""Brings the page's drawings to life with Seedance.

  - The hero's two scenes become loops that start and end on the same drawing.
  - Nevo's four scenes, one per ability section (nevo_acts.py), go from a first key frame to a
    last one, and are encoded for scrubbing: the page plays them with the mouse, not a clock.

Steps, run one at a time. Only `animate` costs money.

    python3 art/scripts/scenery_video.py frame [names]     # picks -> art/prepared/<name>.png
    python3 art/scripts/scenery_video.py still [names]     # -> src/assets/scenery/<name>.webp (no video)
    python3 art/scripts/scenery_video.py animate [names]   # Seedance -> art/video/<name>.<quality>.raw.mp4
    python3 art/scripts/scenery_video.py finish [names]    # -> src/assets/scenery/<name>.{mp4,webp}

frame    Takes the drawing of each scene (picked from scenery.py's candidates; the hero's two
         cleared by scenery_clear.py; each given its touch of pink by scenery_pink.py), makes
         its background pure white, trims it to the drawing, and sets it on a 16:9 frame with
         its feet along the bottom.
still    Writes the frame as the still the page shows, trimmed to the drawing. Enough on its
         own for a page with no video; `finish` replaces it with the video's own first frame.
animate  Uploads the frame with the Postiz CLI (Seedance needs a public URL), asks Seedance 2.0
         for a video from that picture to its last frame (or back to itself, for a loop), waits,
         and downloads it. Needs EVOLINK_API_KEY and a logged-in `postiz`. Options: --quality, --duration.
         At 1080p a second costs about $0.50, so five seconds of one scene is about $2.50.
         A task that was paid for is remembered (art/video/tasks.json): run it again and it
         picks the same task up instead of buying another.
finish   Trims the video to the drawing, takes the sound off, makes the paper pure white
         again, and writes the small files the page loads: an MP4 and the still it starts from.
         Videos for scrubbing get a keyframe every few frames, so any moment can be shown at once,
         and can be cut to the part where something happens (a scene's `span`, in seconds).
"""
import argparse
import hashlib
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "art/raw"
PREPARED = ROOT / "art/prepared"
VIDEO = ROOT / "art/video"
OUT = ROOT / "src/assets/scenery"

API = "https://api.evolink.ai"

# What Seedance is asked to do. The rule for all: a locked camera and small movements.
STILL = (
    "Flat 2D line-art animation that keeps the exact drawing style of the image: thin dark-grey "
    "outlines, white and light-grey flat fills, pale grey silhouettes behind. The camera is locked: "
    "no zoom, no pan, no shake. The white background stays pure white and completely still. The "
    "buildings, the ground line and the pale silhouettes do not move or change. Nothing new appears, "
    "nothing disappears, no colour is added, no shadows or lighting change. Only these small, gentle "
    "movements happen: "
)
LOOP = " Every movement is small and calm, and by the end everything is back exactly where it started, so the video loops."
# The night room with the lamp on (the last section's clips).
NIGHT_LIT = (
    "Flat 2D line-art animation of a bedroom at bedtime that keeps the exact drawing style and "
    "colours of the image: thin dark-grey outlines, white and light-grey flat fills, the hot-pink "
    "laptop screen. The camera is locked: no zoom, no pan, no shake. The lamp stays on and the light "
    "does not change. The room, the furniture, the window and the white background do not move or "
    "change, and nothing new appears. "
)
# Nevo's scenes are one deliberate movement, from the first frame to the last.
ACT = (
    "Flat 2D line-art animation that keeps the exact drawing style of the two images: thin dark-grey "
    "outlines, white and light-grey flat fills, pale grey silhouettes behind, the same hot-pink "
    "details. The camera is locked: no zoom, no pan, no shake. The white background stays pure white. "
    "Nothing new appears and no colour is added. Nevo looks the same throughout, and so does the "
    "brain: white, with grey fold lines. The motion is one smooth, continuous movement from the first "
    "image to the second, at an even pace from start to end, with no pauses, no cuts and no going back: "
)

# Each scene: its drawing, what moves in it, and whether it is a vignette (a small scene with
# white all round it, trimmed on every side) or a hero scene (trimmed top and bottom only,
# so it keeps its full width and stands on the bottom edge of the hero).
SCENES = {
    "scene-left": dict(
        pick="scene-left/pink_1.png",
        vignette=False,
        motion=STILL
        + "the robot sitting at the desk inside the lab types on its laptop and nods its head slightly, and "
        "its antenna sways; small bubbles rise from the glass flask on the desk; the satellite dish on "
        "the roof turns slowly; one pale cloud drifts very slowly."
        + LOOP,
    ),
    "scene-right": dict(
        pick="scene-right/pink_1.png",
        vignette=False,
        motion=STILL
        + "the rocket is warming up its engines: small round clouds of white smoke billow gently out from "
        "under the rocket's three engine nozzles, at the foot of the rocket on the launch pad, spread a "
        "little along the pad and fade away, again and again. The smoke comes only from under the rocket. "
        "The rocket itself, the tower, the cabin and the ladder do not move. In the pale background, the "
        "satellite dish, the observatory dome and the hills are completely still and have no smoke; the "
        "small stars twinkle gently and the pale clouds drift very slowly."
        + LOOP,
    ),
    # Nevo's scenes, each with the brain: from the first key frame to the last, played by the mouse.
    "nevo-scan": dict(
        pick="nevo-scan/firstb_1.png",
        last="nevo-scan/lastb_2.png",
        vignette=True,
        scrub=True,
        motion=ACT
        + "Nevo, holding the brain up high in one hand, sweeps it smoothly from the left of the picture "
        "across to the right, turning from the hips up, and the three pink radar arcs coming off the "
        "brain turn with it; as they reach the lone cottage on the right, his small frown becomes a "
        "smile. His feet stay planted on the hill. The town, the cottage and the hills stay still.",
    ),
    "nevo-surf": dict(
        pick="nevo-surf/first_2.png",
        last="nevo-surf/lastb_2.png",
        vignette=True,
        scrub=True,
        motion=ACT
        + "The wave behind Nevo rises and begins to curl over; Nevo picks the brain up from the front of "
        "the pink surfboard and pops up from sitting into a low surfing crouch, riding along the face of "
        "the wave, holding the brain out to the side, grinning. The beach and the palm trees far away "
        "stay still.",
    ),
    "nevo-coach": dict(
        pick="nevo-coach/firstb_1.png",
        # Not last_2: its dashed trail started at the whiteboard, and Seedance sent the brain
        # there first, then juggled it back.
        last="nevo-coach/lastb_2.png",
        vignette=True,
        scrub=True,
        # The kick is over in the first two seconds; the rest is Nevo holding his cheer. For the
        # mouse, the whole width of the section is the kick.
        span=(0, 3.0),
        # Given the cheering last frame too, Seedance cut to it twice instead of moving there;
        # with only the first frame, the words carry it to the end in one take.
        open_end=True,
        # The first take had a hard cut 1.4 s in (brain back at the net, Nevo jumped to his
        # cheer): the words now ask for one continuous shot, paced over the whole clip.
        motion=ACT
        + "One single continuous shot with no cuts, no jumps and no scene changes: every frame "
        "follows smoothly from the one before. "
        "Nevo kicks the brain once, like a football, with the foot that is drawn back: in the first "
        "second his leg swings forward and strikes it, and the brain flies to the RIGHT in one smooth, "
        "low arc and into the pink net of the goal, which bulges as it lands at the end. The brain only "
        "ever moves right, toward the goal: it never goes left, never bounces and is not touched again. "
        "As it flies, Nevo follows through, his kicking leg high, and throws both arms up, cheering. "
        "Over the last seconds he moves smoothly from the follow-through into the final cheering pose, "
        "and the brain settles into the net. The brain stays the same size as it flies, low over the grass, never toward the camera. Nevo stays the same size throughout. The whiteboard, the easel and the goal stay where they are.",
    ),
    "nevo-grow": dict(
        pick="nevo-grow/before_1.png",
        last="nevo-grow/lastd_3.png",
        vignette=True,
        scrub=True,
        motion=ACT
        + "Drops fall from the pink watering can, and the small brain in the pot grows: its stem rises "
        "straight up out of the pot, its leaves stepping up like a rising chart, and the brain at the top "
        "gets bigger as it rises, staying white; Nevo, still kneeling, leans back to look up at it, "
        "delighted, still holding the watering can. The pot stays where it is.",
    ),
    # The last section (night_room.py, scripts/night.ts): one movie in clips that the page plays
    # one after another, each starting on the frame the one before it ends on, so no hand-over
    # shows. Nevo lies awake with the lamp on, looking about (night-awake, a loop); when you
    # reach the bottom of the page he falls asleep and the lights go off (night-sleep); then the
    # night (night-loop, a loop), his brain still typing. Scroll back up and night-sleep plays
    # backwards: the lamp comes on and he opens his eyes. All of it is Seedance, from the one
    # drawing (night/light_2.png, Nevo asleep with the lamp on), each clip referencing the frames
    # of the others:
    #   night-out    the lights going off, from the drawing: its last frame is the night (N).
    #   night-wake   Nevo waking with the lamp on, from the drawing: its last frame is him awake (A).
    #   night-awake  a loop on A.
    #   night-sleep  from A to N.
    #   night-loop   a loop on N.
    # The image model's own night drawing moved things about; Seedance keeps every line in place.
    "night-out": dict(
        pick="night/light_2.png",
        vignette=False,
        open_end=True,
        # Only its last frame is used (the night), and the page does not show it.
        fade_paper=(32, 32, 32),
        only_pink=True,
        motion=(
            "Flat 2D line-art animation of a bedroom at bedtime. The camera is locked: no zoom, no pan, "
            "no shake, and nothing in the room moves, changes shape or changes size. In the first second, "
            "the lamp on the bedside table switches off and the whole room falls into darkness: the white "
            "background, the wall and every white or light-grey surface turn near-black and very dark "
            "grey, and the drawing's lines stay faintly visible in mid grey. The laptop's pink screen keeps "
            "glowing, now the only light in the room: a soft hot-pink glow spreads from it into the dark, "
            "lighting the brain at the desk, its little arms and the coffee mug in pink, fading out with "
            "distance. For the rest of the video the room stays dark like that, calm and still: the brain "
            "keeps typing, Nevo sleeps, breathing slowly. No new objects, no text."
        ),
    ),
    "night-wake": dict(
        pick="night/light_2.png",
        vignette=False,
        open_end=True,
        # Only its last frame is used (Nevo awake), and the page does not show it.
        motion=(
            NIGHT_LIT
            + "Only this happens: the little z's above Nevo's head fade away, and Nevo, lying in bed with "
            "his head on the pillow, opens his eyes and wakes up, calm and relaxed, and looks at the "
            "viewer with a slight smile. He stays lying where he is, under the blanket. The brain at the "
            "desk keeps typing on the laptop. By the end Nevo is awake, eyes open, looking at the viewer."
        ),
    ),
    "night-awake": dict(
        # The same drawing, so the same box as every other clip of the room.
        pick="night/light_2.png",
        vignette=False,
        from_video="night-wake",
        only_pink=True,
        # When he faces the viewer, as he does at the frame night-sleep is entered at (its
        # `enter`): the page hands over to it then, and hurries the loop on while he looks away.
        # Compared on his head and shoulders: rows, then columns, of the trimmed picture.
        meets=("night-sleep", (100, 520, 120, 800)),
        motion=(
            NIGHT_LIT
            + "Only these small movements happen: Nevo lies awake in bed, his head on the pillow, eyes "
            "open; he looks around a little, his eyes and head turning slowly toward the window, back to "
            "the viewer, toward the brain at the desk, and back to the viewer, blinking now and then. The "
            "brain at the desk types busily on the laptop, its little arms moving."
        )
        + LOOP,
    ),
    "night-sleep": dict(
        pick="night/light_2.png",
        vignette=False,
        from_video="night-wake",
        to_video="night-out",
        # Its paper goes from white to the footer's dark; how dark it is, frame by frame, is
        # written beside it (night-sleep.json) for the page to darken in step.
        fade_paper=(32, 32, 32),
        only_pink=True,
        # Played backwards when you scroll up, and turned round mid-way if you change your mind,
        # so it is also written reversed, with a keyframe every few frames.
        reverse_copy=True,
        seekable=True,
        # The page enters it here, at the start of the yawn: before that he only smiles, as he
        # does in night-awake, and you would wait through it.
        enter=6,
        motion=(
            "Flat 2D line-art animation of a bedroom at bedtime. The camera is locked: no zoom, no pan, "
            "no shake, and nothing in the room moves, changes shape or changes size. First Nevo, lying "
            "awake in bed with his head on the pillow, yawns, closes his eyes and falls asleep, his head "
            "sinking a little into the pillow, and small z's float up above his head. Then the lamp on "
            "the bedside table switches off and the whole room falls into darkness: the white background "
            "and every white or light-grey surface turn near-black and very dark grey, the drawing's "
            "lines stay faintly visible in mid grey, and the laptop's pink screen keeps glowing, now the "
            "only light in the room, lighting the brain and the coffee mug in pink. The brain keeps "
            "typing on the laptop the whole time. For the last second the room stays dark and calm. No "
            "new objects, no text."
        ),
    ),
    # The night, a loop on the last frame of night-out: the brain never stops working.
    "night-loop": dict(
        pick="night/light_2.png",
        vignette=False,
        from_video="night-out",
        paper=(32, 32, 32),
        # Seedance gave the night a bluish tint and the window a blue sky: the site is grey and
        # one pink, so every other colour goes grey.
        only_pink=True,
        motion=(
            "Flat 2D line-art animation of a dark bedroom at night that keeps the exact drawing style and "
            "colours of the image: a near-black background, dark-grey shapes with faint mid-grey lines, and "
            "the hot-pink glow of the laptop's screen. The camera is locked: no zoom, no pan, no shake. The "
            "room, the furniture, the window and the near-black background do not move or change, nothing "
            "new appears, and no light comes on. Only these small movements happen: the brain at the desk "
            "types busily on the laptop, its little arms moving; the pink glow of the screen flickers softly "
            "as it works; Nevo sleeps, breathing slowly under the blanket; the little z's above his head "
            "float up gently and fade."
        )
        + LOOP,
    ),
}

# The frame handed to Seedance: 16:9, which it returns at 1080p without cropping, and which
# puts the most pixels across a drawing that is wider than it is tall.
FRAME = (1920, 1080)
# White margin kept under the drawing in the frame, so the ground line is not on the very
# edge of the video while it is made. `finish` trims it off again, with the white round it.
UNDER = 16
# White kept round a vignette's ink, in pixels of the picked drawing. Its pale layer may be cut
# by this; the page fades the edges of the box, so the cut never shows as a line.
MARGIN = (84, 44)


def only_pink(rgb: np.ndarray) -> np.ndarray:
    """Every colour but the site's pink turned to its own grey; the pink, and what is near it, kept."""
    a = rgb.astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    top, low = a.max(axis=2), a.min(axis=2)
    spread = np.maximum(top - low, 1e-3)
    hue = np.where(top == r, ((g - b) / spread) % 6, np.where(top == g, (b - r) / spread + 2, (r - g) / spread + 4)) * 60
    # The pink is at 329°: kept within 30° of that, fading to grey by 50°.
    away = np.abs((hue - 329 + 180) % 360 - 180)
    keep = np.clip((50 - away) / 20, 0, 1)[..., None]
    grey = (0.2126 * r + 0.7152 * g + 0.0722 * b)[..., None]
    return np.clip(grey + (a - grey) * keep, 0, 255)


def whiten(im: Image.Image) -> np.ndarray:
    """The drawing as an array, with its paper stretched to pure white."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    # The paper is the most common value near white. Scale so it lands on 255.
    paper = np.percentile(a.min(axis=2), 50)
    if paper >= 235:
        a = np.clip(a * (255.0 / paper), 0, 255)
    return a


def box(a: np.ndarray, vignette: bool) -> tuple[int, int, int, int]:
    """The part of a drawing to keep, as (top, bottom, left, right), inclusive."""
    lum = a.mean(axis=2)
    drawn = lum < 235  # anything, even the pale layer
    inked = lum < 150
    rows = np.nonzero(drawn.any(axis=1))[0]
    top, bottom = max(0, int(rows.min()) - 12), int(np.nonzero(inked.any(axis=1))[0].max())
    left, right = 0, a.shape[1] - 1
    if vignette:
        # Trimmed to its ink: the scene itself, not the pale layer, fills the box. The ground
        # line runs the width of the picture, so it does not count.
        cols = np.nonzero(inked[: bottom - 14].any(axis=0))[0]
        ink_top = int(np.nonzero(inked.any(axis=1))[0].min())
        top = max(0, ink_top - MARGIN[1])
        left, right = max(0, int(cols.min()) - MARGIN[0]), min(a.shape[1] - 1, int(cols.max()) + MARGIN[0])
    return top, bottom, left, right


def fit(name: str, which: str = "pick") -> tuple[Image.Image, int, int]:
    """One of the scene's drawings, trimmed and scaled to the frame, and where it goes in the frame.

    A scene with a last frame is trimmed to what the two drawings cover together, so that the
    first and the last line up exactly.
    """
    spec = SCENES[name]
    pictures = {k: whiten(Image.open(RAW / spec[k])) for k in ("pick", "last") if k in spec}
    boxes = [box(a, spec["vignette"]) for a in pictures.values()]
    top, bottom = min(b[0] for b in boxes), max(b[1] for b in boxes)
    left, right = min(b[2] for b in boxes), max(b[3] for b in boxes)
    a = pictures[which]
    drawing = Image.fromarray(a[top : bottom + 1, left : right + 1].round().astype(np.uint8))
    scale = min(FRAME[0] / drawing.width, (FRAME[1] - UNDER) / drawing.height)
    size = (round(drawing.width * scale), round(drawing.height * scale))
    return drawing.resize(size, Image.LANCZOS), (FRAME[0] - size[0]) // 2, FRAME[1] - UNDER - size[1]


def last_frame_of(source: str, target: Path, quality: str) -> None:
    """The last frame of another scene's video, which is already laid out in the frame: taken as
    it is, at full size."""
    src = VIDEO / f"{source}.{quality}.raw.mp4"
    if not src.exists():
        raise SystemExit(f"animate {source} first")
    # Every frame from 0.3 s before the end is written to the same file: the last one stays.
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-sseof", "-0.3", "-i", str(src), "-update", "1", str(target)], check=True)
    with Image.open(target) as im:
        if im.size != FRAME:
            im.resize(FRAME, Image.LANCZOS).save(target)


def frame(names: list[str], quality: str = "1080p") -> None:
    PREPARED.mkdir(parents=True, exist_ok=True)
    for name in names:
        spec = SCENES[name]
        if spec.get("from_video"):
            # A clip that starts where another ends, and may end where a third does.
            last_frame_of(spec["from_video"], PREPARED / f"{name}.png", quality)
            if spec.get("to_video"):
                last_frame_of(spec["to_video"], PREPARED / f"{name}.last.png", quality)
            print(f"{name}: from the last frame of {spec['from_video']}" + (f" to the last frame of {spec['to_video']}" if spec.get("to_video") else ""))
            continue
        for which, suffix in (("pick", ""), ("last", ".last")):
            if which not in SCENES[name]:
                continue
            drawing, left, top = fit(name, which)
            out = Image.new("RGB", FRAME, "white")
            out.paste(drawing, (left, top))
            out.save(PREPARED / f"{name}{suffix}.png")
        print(f"{name}: drawing {drawing.width}×{drawing.height} at ({left}, {top}) in a {FRAME[0]}×{FRAME[1]} frame")


def still(names: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in names:
        drawing, left, top = fit(name)
        im = Image.open(PREPARED / f"{name}.png").crop((left, top, left + drawing.width, top + drawing.height))
        target = OUT / f"{name}.webp"
        im.save(target, "WEBP", quality=88, method=6)
        print(f"{name}: {im.width}×{im.height} (ratio {im.width / im.height:.4f}), {target.stat().st_size / 1024:.0f} KB")


def call(method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {os.environ['EVOLINK_API_KEY']}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read())


def public_url(path: Path) -> str:
    """A public address for the frame: Seedance fetches its pictures, it does not take uploads.

    The Postiz CLI puts the file in the account's media library and prints where it is. The
    address is remembered by the file's contents, so the same frame is only uploaded once.
    """
    seen_file = VIDEO / "uploads.json"
    seen = json.loads(seen_file.read_text()) if seen_file.exists() else {}
    digest = hashlib.sha1(path.read_bytes()).hexdigest()
    if digest not in seen:
        out = subprocess.run(["postiz", "upload", str(path)], capture_output=True, text=True, check=True).stdout
        # The CLI prints a line of its own before the JSON.
        seen[digest] = json.loads(out[out.index("{") :])["path"]
        seen_file.write_text(json.dumps(seen, indent=2) + "\n")
    return seen[digest]


def fetch(url: str, target: Path) -> None:
    """Download with curl: the file host turns away Python's own user agent."""
    subprocess.run(["curl", "-sSL", "--fail", "-m", "600", "-A", "Mozilla/5.0", "-o", str(target), url], check=True)


def animate(names: list[str], quality: str, duration: int) -> None:
    if not os.environ.get("EVOLINK_API_KEY"):
        raise SystemExit("EVOLINK_API_KEY is not set")
    VIDEO.mkdir(parents=True, exist_ok=True)
    book_file = VIDEO / "tasks.json"
    book = json.loads(book_file.read_text()) if book_file.exists() else {}
    waiting = {}
    for name in names:
        frame_file = PREPARED / f"{name}.png"
        # A loop ends on its first picture; one of Nevo's scenes, or a clip that ends where
        # another does, on its own last frame.
        has_last = "last" in SCENES[name] or "to_video" in SCENES[name]
        last_file = PREPARED / f"{name}.last.png" if has_last else frame_file
        motion = SCENES[name]["motion"]
        # A task is the same task if it has the same pictures, the same words and the same settings.
        order = {
            "frame": hashlib.sha1(frame_file.read_bytes()).hexdigest(),
            "last": hashlib.sha1(last_file.read_bytes()).hexdigest(),
            "prompt": motion,
            "duration": duration,
            "quality": quality,
        }
        key = f"{name}.{quality}"
        known = book.get(key)
        if known and all(known.get(k) == v for k, v in order.items()):
            print(f"{name}: already ordered, task {known['id']}")
        else:
            url = public_url(frame_file)
            # The first frame and the last: the same picture twice, for a loop. A scene with an
            # open end gets only its first, and goes where the words take it.
            urls = [url] if SCENES[name].get("open_end") else [url, public_url(last_file)]
            print(f"{name}: frames at {' and '.join(urls)}")
            task = call(
                "POST",
                "/v1/videos/generations",
                {
                    "model": "seedance-2.0-image-to-video",
                    "prompt": motion,
                    "image_urls": urls,
                    "duration": duration,
                    "quality": quality,
                    "aspect_ratio": "16:9",
                    "generate_audio": False,
                },
            )
            book[key] = {**order, "id": task["id"]}
            book_file.write_text(json.dumps(book, indent=2) + "\n")
            print(f"{name}: task {task['id']}", flush=True)
        waiting[name] = book[key]["id"]

    while waiting:
        for name, task_id in list(waiting.items()):
            state = call("GET", f"/v1/tasks/{task_id}")
            print(f"{name}: {state.get('status')} {state.get('progress')}%", flush=True)
            if state.get("status") == "completed":
                target = VIDEO / f"{name}.{quality}.raw.mp4"
                fetch(state["results"][0], target)
                cost = (state.get("usage") or {}).get("cost") or {}
                print(f"{name}: saved {target} (${cost.get('usd', '?')})", flush=True)
                del waiting[name]
            elif state.get("status") == "failed":
                print(f"{name}: FAILED {json.dumps(state.get('error'))}", flush=True)
                del waiting[name]
        if waiting:
            time.sleep(10)


def meeting(clip: Path, other: str, region: tuple[int, int, int, int]) -> list[list[float]]:
    """When a loop can hand over to another clip at the frame that clip is entered at: the
    stretches of the loop, in seconds, where it is closer to that frame (in `region`: top, bottom,
    left, right) than half way between its closest and its furthest."""

    def grey(src: Path) -> np.ndarray:
        out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
        probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(src)], capture_output=True, text=True, check=True).stdout)["streams"][0]
        return np.frombuffer(out, np.uint8).reshape(-1, probe["height"], probe["width"]).astype(np.float32)

    top, bottom, left, right = region
    there = grey(OUT / f"{other}.mp4")[SCENES[other]["enter"]][top:bottom, left:right]
    gap = np.array([np.abs(f[top:bottom, left:right] - there).mean() for f in grey(clip)])
    lo, hi = np.percentile(gap, 10), np.percentile(gap, 90)
    near = gap <= lo + 0.5 * (hi - lo)
    ranges, start = [], None
    for i, ok in enumerate([*near, False]):
        if ok and start is None:
            start = i
        elif not ok and start is not None:
            ranges.append([round(start / 24, 3), round(i / 24, 3)])
            start = None
    return ranges


def finish(names: list[str], quality: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in names:
        src = VIDEO / f"{name}.{quality}.raw.mp4"
        if not src.exists():
            print(f"{name}: no {src.name}, skipped")
            continue
        probe = json.loads(
            subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(src)],
                capture_output=True, text=True, check=True,
            ).stdout
        )["streams"][0]
        w, h = probe["width"], probe["height"]
        # Trim to the drawing, as it was placed in the frame. Even sizes only: H.264 needs them.
        drawing, left, top = fit(name)
        kx, ky = w / FRAME[0], h / FRAME[1]
        x0, y0 = int(left * kx) // 2 * 2, int(top * ky) // 2 * 2
        cw, ch = int(drawing.width * kx) // 2 * 2, int(drawing.height * ky) // 2 * 2
        crop = f"crop={cw}:{ch}:{x0}:{y0}"

        spec = SCENES[name]
        span = spec.get("span")
        cut = ["-ss", str(span[0]), "-t", str(span[1] - span[0])] if span else []
        greyed = only_pink if spec.get("only_pink") else (lambda rgb: rgb.astype(np.float32))

        def frames():
            """The video's frames, trimmed to the drawing and greyed if they should be."""
            decode = subprocess.Popen(
                ["ffmpeg", "-v", "error", *cut, "-i", str(src), "-vf", crop, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                stdout=subprocess.PIPE,
            )
            size = cw * ch * 3
            while len(data := decode.stdout.read(size)) == size:
                yield greyed(np.frombuffer(data, np.uint8).reshape(ch, cw, 3))
            decode.wait()

        # First pass, at a quarter of the size: how light each frame's paper is (the paper is
        # most of the picture, so its median).
        papers = [float(np.percentile(a[::4, ::4].mean(axis=2), 50)) for a in frames()]
        paper = papers[0]

        darkness = None
        if spec.get("fade_paper"):
            # The lights going off: each frame's paper is set somewhere between white (lit) and
            # the page's dark (off), as far along as the frame is between the first frame's paper
            # and the last's. The page darkens in step, from the same numbers.
            to = np.array(spec["fade_paper"], np.float32)
            d = np.clip((papers[0] - np.array(papers)) / max(papers[0] - papers[-1], 1), 0, 1)
            # Never lighter again once dark, fully dark from where it is all but there, and fully
            # lit until it is plainly darker (the paper of a lit frame wobbles by a percent or two).
            d = np.maximum.accumulate(d)
            darkness = np.where(d > 0.97, 1.0, np.where(d < 0.03, 0.0, d)).round(3)
            levels = [(p, 255 + (to - 255) * k) for p, k in zip(papers, darkness)]
        elif spec.get("paper"):
            # A night scene: its paper is near-black, and it should be exactly the page's dark
            # (the footer's), so the picture runs into it.
            to = np.array(spec["paper"], np.float32)
            levels = [(paper, to)] * len(papers)
        else:
            # The video comes back with paper that is not quite white: stretched so that it, and
            # the noise just under it, land on white.
            levels = [(paper - 2, np.array([255, 255, 255], np.float32))] * len(papers)

        def fix(a: np.ndarray, level: tuple) -> np.ndarray:
            """Moves the levels so the paper lands where it should; what is lighter keeps its
            light, what is darker stays darker."""
            p, t = level
            lighter = t + (a - p) * ((255 - t) / max(255 - p, 1))
            darker = a * (t / max(p, 1))
            return np.clip(np.where(a >= p, lighter, darker), 0, 255).round().astype(np.uint8)

        target = OUT / f"{name}.mp4"
        # For scrubbing: at most 1120 wide (the page shows them at 704 CSS pixels at most), a
        # keyframe every 8 frames and no B-frames, so the browser can show any moment after
        # decoding at most seven frames. About 1 MB for five seconds. A clip that the page may
        # jump into the middle of (only when you change your mind) gets a keyframe every second.
        scrub = spec.get("scrub", False)
        filters = "scale='min(1120,iw)':-2,format=yuv420p" if scrub else "format=yuv420p"
        keys = ["-g", "8", "-bf", "0", "-crf", "29"] if scrub else (["-g", "24", "-bf", "0", "-crf", "28"] if spec.get("seekable") else ["-crf", "26"])
        raw_in = ["-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{cw}x{ch}", "-r", "24", "-i", "-"]
        encode = subprocess.Popen(
            ["ffmpeg", "-y", "-v", "error", *raw_in, "-an", "-vf", filters, "-c:v", "libx264", "-preset", "slow", *keys, "-movflags", "+faststart", str(target)],
            stdin=subprocess.PIPE,
        )
        # The same frames, lossless, for the reversed copy.
        lossless = VIDEO / f"{name}.lossless.mkv"
        keep = subprocess.Popen(["ffmpeg", "-y", "-v", "error", *raw_in, "-c:v", "libx264", "-qp", "0", "-preset", "ultrafast", str(lossless)], stdin=subprocess.PIPE) if spec.get("reverse_copy") else None
        still_rgb = None
        for a, level in zip(frames(), levels):
            out = fix(a, level)
            still_rgb = out if still_rgb is None else still_rgb
            encode.stdin.write(out.tobytes())
            if keep:
                keep.stdin.write(out.tobytes())
        encode.stdin.close()
        encode.wait()
        if keep:
            keep.stdin.close()
            keep.wait()
            subprocess.run(
                ["ffmpeg", "-y", "-v", "error", "-i", str(lossless), "-an", "-vf", "reverse,format=yuv420p", "-c:v", "libx264", "-preset", "slow", *keys, "-movflags", "+faststart", str(OUT / f"{name}.rev.mp4")],
                check=True,
            )
            lossless.unlink()
        # The still is the video's own first frame, fixed the same way, so the hand-over from
        # one to the other cannot be seen.
        still_file = OUT / f"{name}.webp"
        Image.fromarray(still_rgb).save(still_file, "WEBP", quality=88, method=6)

        notes = {}
        if darkness is not None:
            notes["darkness"] = darkness.tolist()
        if spec.get("enter") is not None:
            notes["enter"] = round(spec["enter"] / 24, 3)
        if spec.get("meets"):
            notes["meets"] = meeting(target, *spec["meets"])
        if notes:
            (OUT / f"{name}.json").write_text(json.dumps({"fps": 24, **notes}) + "\n")
        print(f"{name}: {cw}×{ch}, paper was {paper:.0f}, {target.stat().st_size / 1024:.0f} KB video, {still_file.stat().st_size / 1024:.0f} KB still" + (f", meets {notes['meets']}" if "meets" in notes else ""))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["frame", "still", "animate", "finish"])
    ap.add_argument("names", nargs="*", default=list(SCENES))
    ap.add_argument("--quality", default="1080p", choices=["480p", "720p", "1080p"])
    ap.add_argument("--duration", type=int, default=5)
    args = ap.parse_args()
    unknown = [n for n in args.names if n not in SCENES]
    if unknown:
        raise SystemExit(f"unknown scene(s): {', '.join(unknown)}")
    if args.step == "frame":
        frame(args.names, args.quality)
    elif args.step == "still":
        still(args.names)
    elif args.step == "animate":
        animate(args.names, args.quality, args.duration)
    else:
        finish(args.names, args.quality)


if __name__ == "__main__":
    main()
