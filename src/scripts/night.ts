/**
 * The last section's movie (components/FinalCta.astro). Nevo lies awake with the lamp on,
 * looking about; when you reach the bottom of the page he falls asleep and the lights go off,
 * and his brain carries on typing in the dark; scroll back up and the lamp comes on and he
 * wakes. As at the end of lemonade.com/life, the page goes dark with the room: the section, and
 * the questions above it, take the room's paper colour frame by frame, down to the page's dark.
 *
 * The movie is four clips, made to meet one another (art/scripts/scenery_video.py): `awake` (a
 * loop), `sleep` (awake to night), `night` (a loop) and `wake` (`sleep` backwards). It is cut to
 * be quick, as falling asleep should be when you have just scrolled down for it:
 *  - `sleep` is entered at the start of his yawn (`enter`), when he faces you. If he is looking
 *    away just then, the loop hurries on until he faces you again (`meets`): under a second.
 *  - The yawn plays a little faster, until the lights are off.
 *  - `wake` is entered just after the lights went off (the night looks the same there), so the
 *    lamp comes on at once.
 * `sleep` and `wake` are the same frames in opposite order: changing your mind half-way swaps
 * one for the other at the same frame.
 *
 * When: he falls asleep when you scroll down to the end (the room ends the page, so that is when
 * all of it is on screen); he wakes when you scroll back up a little (NUDGE of the window) from
 * the furthest down you went, with the room in view. Whatever happens while the room is off
 * screen (a flick back up), nothing is left half-way: the page takes the colours of where you
 * are at once, and the room shows him awake or asleep to match, or the change happening if you
 * come back in time to see it.
 *
 * It only reads where the room is; it never listens to the wheel or touch, and never moves the
 * page. For someone who asked for less motion, the lights simply go off and on (two stills);
 * for less data, they fade, without the videos.
 */

type Name = 'awake' | 'sleep' | 'wake' | 'night';
type Notes = { meets?: number[][]; darkness?: number[]; enter?: number };
type Clip = { name: Name; video: HTMLVideoElement; notes: Notes; ready: boolean };
type RGB = [number, number, number];

/**
 * He falls asleep once all of the room is on screen: its bottom no more than this many pixels
 * below the screen's (rounding). The room ends the page, so that is the very bottom of it.
 */
const SLACK = 4;
/**
 * He wakes when you scroll back up by this share of the screen's height from the furthest down
 * you went, and falls asleep again when you scroll back down as far: a deliberate scroll, not a
 * jiggle. And he is awake, whatever the way you came, once the room is this share of its own
 * height below the screen.
 */
const NUDGE = 0.12;
const BELOW = 0.3;
const FPS = 24;
/** How fast the awake loop plays while he turns back to face you, and the yawn until the lights are off. */
const RUSH = 2;
const YAWN = 1.5;
/** Cross-fades between clips, in ms: where they meet on near enough the same frame, and in the dark. */
const CUT = 180;
const DUSK = 280;
/** The lights going off or on without the videos, in ms. */
const FADE = 700;

const section = document.querySelector<HTMLElement>('[data-night]');
const room = section?.querySelector<HTMLElement>('[data-night-room]');

if (section && room) {
  const root = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

  const clips = {} as Record<Name, Clip>;
  for (const video of room.querySelectorAll<HTMLVideoElement>('video[data-clip]')) {
    const name = video.dataset.clip as Name;
    clips[name] = { name, video, notes: JSON.parse(video.dataset.notes ?? '{}'), ready: false };
  }
  const darkness = clips.sleep?.notes.darkness ?? [];
  const meets = clips.awake?.notes.meets ?? [];
  /** Where `sleep` is entered, and where `wake` is: three frames after the lights are fully off. */
  const enterSleep = clips.sleep?.notes.enter ?? 0;
  const enterWake = Math.max(0, darkness.length - 1 - (darkness.indexOf(1) + 3)) / FPS;
  /** Whether the movie plays here, or only the two stills. */
  let movie = !calm && !saving && !!(clips.awake && clips.sleep && clips.wake && clips.night) && darkness.length > 0;

  // --- the page's colours, from 0 (lights on) to 1 (off) ------------------------------------

  const hex = (v: string): RGB => {
    let h = v.trim().replace('#', '');
    // The built CSS shortens colours where it can (#ffffff to #fff), and #fff read as six digits
    // is blue: each of the three digits stands for two.
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const token = (name: string) => hex(getComputedStyle(root).getPropertyValue(name));
  // From the page's own colours to its dark.
  const paper = [token('--bg'), token('--dark')];
  const ink = [token('--ink'), hex('#ffffff')];
  const muted = [token('--ink-muted'), hex('#bdbdbd')];
  const mix = ([a, b]: RGB[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;

  let dark = 0;
  /** Darkens the page as far as the room is dark: the section, its text, and the questions above. */
  const paint = (d: number) => {
    d = Math.round(Math.max(0, Math.min(1, d)) * 1000) / 1000;
    if (d === dark) return;
    dark = d;
    if (d === 0) {
      for (const p of ['--night', '--night-paper', '--night-ink', '--night-muted']) root.style.removeProperty(p);
      return;
    }
    root.style.setProperty('--night', String(d));
    root.style.setProperty('--night-paper', mix(paper, d));
    root.style.setProperty('--night-ink', mix(ink, d));
    root.style.setProperty('--night-muted', mix(muted, d));
  };

  // --- where you are ------------------------------------------------------------------------

  let target: 'lit' | 'dark' = 'lit';
  let onScreen = false;
  let check = 0;
  /** The furthest down you have been since he fell asleep, and the furthest up since he woke. */
  let lowest = 0;
  let highest = Infinity;
  let first = true;

  const look = () => {
    check = 0;
    const { top, bottom, height } = room.getBoundingClientRect();
    const view = window.innerHeight;
    const y = window.scrollY;
    const was = target;
    // Measured here, with everything else, so that what is on screen and where you are never
    // disagree for a frame (an IntersectionObserver reports a frame late).
    const seen = bottom > 0 && top < view;
    const moved = seen !== onScreen;
    onScreen = seen;
    if (target === 'lit') {
      highest = Math.min(highest, y);
      // At the end, having come down to it (or the page opened there).
      if (bottom <= view + SLACK && (first || y >= highest + view * NUDGE)) target = 'dark';
    } else {
      lowest = Math.max(lowest, y);
      // Back up a little, with the room in view; or the room well below the screen, however you got there.
      if ((y <= lowest - view * NUDGE && bottom > 0 && top < view) || bottom > view + height * BELOW) target = 'lit';
    }
    first = false;
    if (target !== was) {
      if (target === 'dark') lowest = y;
      else highest = y;
      section.classList.toggle('is-dark', target === 'dark');
    }
    if (target !== was || moved) sync();
  };
  const schedule = () => {
    if (!check) check = requestAnimationFrame(look);
  };

  // --- without the videos: the two stills, the dark one shown as far as the page is dark -----

  let tween = 0;
  let tweenTo = -1;
  /**
   * The page and the room as they are where you are, without the movie: the clips put away, the
   * still for awake or asleep, the colours to match. Faded, if the room is in view and motion is
   * welcome; at once, if not.
   */
  const still = () => {
    putAway();
    const to = target === 'dark' ? 1 : 0;
    if (to === tweenTo && tween) return;
    cancelAnimationFrame(tween);
    tween = 0;
    tweenTo = to;
    if (calm || !onScreen || dark === to) return paint(to);
    const from = dark;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / FADE);
      paint(from + (to - from) * (k * k * (3 - 2 * k)));
      tween = k < 1 ? requestAnimationFrame(step) : 0;
      // The videos may have come in while it faded: they take over once it is done.
      if (!tween && movie) sync();
    };
    tween = requestAnimationFrame(step);
  };

  // --- the movie ----------------------------------------------------------------------------

  /** The clip on top, and one being brought in. */
  let shown: Clip | null = null;
  let starting: Clip | null = null;
  /** Whether the awake loop is hurrying on to a moment when he faces you. */
  let hurrying = false;
  let layer = 1;

  /** Every clip stopped and hidden, so the stills show; the next one to play starts afresh. */
  function putAway() {
    if (!shown && !starting) return;
    shown = null;
    starting = null;
    hurrying = false;
    for (const { video } of Object.values(clips)) {
      video.pause();
      video.playbackRate = 1;
      video.classList.remove('is-shown');
    }
  }

  /** Calls back once the video has put a frame on screen. */
  const onFrame = (v: HTMLVideoElement, then: () => void) => {
    if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(() => then());
    else v.addEventListener('playing', () => requestAnimationFrame(() => then()), { once: true });
  };

  /** Brings a clip in on top, from `at` seconds, fading over the one before it. */
  const start = (clip: Clip, at: number, fade: number) => {
    starting = clip;
    const v = clip.video;
    v.playbackRate = clip.name === 'sleep' ? YAWN : 1;
    const go = () => {
      if (starting !== clip) return;
      v.play().catch(() => {
        // It will not play here after all: the stills, from now on.
        if (starting !== clip) return;
        starting = null;
        movie = false;
        sync();
      });
      onFrame(v, () => {
        if (starting !== clip) return v.pause();
        starting = null;
        v.style.transitionDuration = `${fade}ms`;
        v.style.zIndex = String(++layer);
        v.classList.add('is-shown');
        const before = shown;
        shown = clip;
        if (before && before !== clip) {
          window.setTimeout(() => {
            if (shown === before) return;
            before.video.classList.remove('is-shown');
            before.video.pause();
            before.video.playbackRate = 1;
          }, fade + 60);
        }
        follow(clip);
        sync();
      });
    };
    if (Math.abs(v.currentTime - at) > 0.5 / FPS) {
      v.addEventListener('seeked', go, { once: true });
      v.currentTime = at;
    } else go();
  };

  /**
   * While the lights go off or on, the page darkens or lightens with the frame on screen; and
   * the yawn, sped up, slows to its own pace once the lights are off.
   */
  const follow = (clip: Clip) => {
    if (clip.name === 'awake' || clip.name === 'night') return paint(clip.name === 'night' ? 1 : 0);
    const v = clip.video;
    const at = (time: number) => {
      const i = Math.max(0, Math.min(darkness.length - 1, Math.round(time * FPS)));
      const d = clip.name === 'sleep' ? darkness[i] : darkness[darkness.length - 1 - i];
      paint(d);
      if (clip.name === 'sleep' && d >= 1 && v.playbackRate !== 1) v.playbackRate = 1;
    };
    at(v.currentTime);
    if ('requestVideoFrameCallback' in v) {
      const each = (_: number, frame: VideoFrameCallbackMetadata) => {
        if (shown !== clip) return;
        at(frame.mediaTime);
        if (!v.ended) v.requestVideoFrameCallback(each);
      };
      v.requestVideoFrameCallback(each);
    } else {
      const each = () => {
        if (shown !== clip) return;
        at(v.currentTime);
        if (!v.ended) requestAnimationFrame(each);
      };
      requestAnimationFrame(each);
    }
  };

  /** Whether he faces you in the awake loop at this moment, as he does where `sleep` is entered. */
  const facing = (t: number) => meets.some(([from, to]) => t >= from && t < to);

  /** Falls asleep: now if he faces you, or as soon as he does, the loop hurrying until then. */
  const fallAsleep = () => {
    const loop = clips.awake;
    const v = loop.video;
    if (facing(v.currentTime)) return start(clips.sleep, enterSleep, CUT);
    if (hurrying) return;
    hurrying = true;
    v.playbackRate = RUSH;
    const watch = () => {
      if (!hurrying) return;
      if (shown !== loop || target !== 'dark') {
        hurrying = false;
        v.playbackRate = 1;
        return;
      }
      if (facing(v.currentTime)) {
        hurrying = false;
        v.playbackRate = 1;
        return start(clips.sleep, enterSleep, CUT);
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  };

  /**
   * Turns round half-way: the same frame of the clip running the other way. Never earlier than
   * the clip's own entry, though: turned round in the dark after the lights went off, waking
   * would otherwise sit through the dark frames before the lamp comes on (they all look the
   * same, so skipping them does not show).
   */
  const swap = (to: Clip) => {
    const from = shown!.video;
    const entry = to === clips.wake ? enterWake : enterSleep;
    start(to, Math.max(entry, from.duration - from.currentTime), CUT);
  };

  function sync() {
    if (!movie) return still();
    const rest = target === 'dark' ? clips.night : clips.awake;
    if (!onScreen) {
      // Off screen nothing plays, and nothing is left half-way: the page is where you are, at once.
      if (starting || (shown && shown !== rest)) return still();
      shown?.video.pause();
      return paint(target === 'dark' ? 1 : 0);
    }
    if (tween || starting) return;
    if (!shown) {
      // Nothing playing: from the still on screen (asleep or awake, as the page's colours are),
      // the change to where you are if there is one to see, or else the loop for where you are.
      // Each starts on that still's frame, or as near as makes no difference.
      const asleep = dark >= 0.5;
      if (asleep === (target === 'dark')) {
        if (!rest.ready) return still();
        paint(asleep ? 1 : 0);
        return start(rest, 0, CUT);
      }
      const change = target === 'dark' ? clips.sleep : clips.wake;
      if (!change.ready) return still();
      return start(change, target === 'dark' ? enterSleep : enterWake, CUT);
    }
    if (shown.video.paused && !shown.video.ended) shown.video.play().catch(() => {});
    // On to the clip that goes where you are; the stills, faded, if it cannot play yet.
    const name = shown.name;
    if (target === 'dark') {
      if (name === 'awake') clips.sleep.ready ? fallAsleep() : still();
      else if (name === 'wake') clips.sleep.ready ? swap(clips.sleep) : still();
    } else {
      if (name === 'night') clips.wake.ready ? start(clips.wake, enterWake, DUSK) : still();
      else if (name === 'sleep') clips.wake.ready ? swap(clips.wake) : still();
    }
  }

  function load(clip: Clip) {
    const { video } = clip;
    if (video.src) return;
    video.src = video.dataset.src!;
    video.preload = 'auto';
    video.load();
  }

  if (movie) {
    for (const clip of Object.values(clips)) {
      clip.video.addEventListener(
        'canplay',
        () => {
          clip.ready = true;
          sync();
        },
        { once: true },
      );
    }
    // The lights went off, or on: on to the loop that follows.
    clips.sleep.video.addEventListener('ended', () => shown === clips.sleep && !starting && start(clips.night, 0, CUT));
    clips.wake.video.addEventListener('ended', () => shown === clips.wake && !starting && start(clips.awake, 0, CUT));
    // Loaded when the room is a screen away, all four, so each is ready when it is wanted;
    // played while it is on screen.
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) Object.values(clips).forEach(load);
      },
      { rootMargin: '100% 0px' },
    ).observe(room);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  look();

  if (import.meta.env.DEV) {
    // For the tests: which clip is on screen, and how dark the page is.
    (window as unknown as { __night: unknown }).__night = { state: () => ({ shown: shown?.name ?? null, dark, target, movie }) };
  }
}
