/**
 * Plays Nevo's scene in each ability section with the scroll instead of a clock.
 *
 * Each scene is a short video from a first key frame to a last one, and where the scene is on
 * the screen is where the video is: it starts once the picture is nearly all on screen and
 * has played out by the time the picture is in the middle of the screen, so the whole
 * movement happens in view and the end is seen whole, well before it scrolls off the top.
 * Scroll back up and it runs backwards; land in the middle and it is in the middle.
 *
 * It only reads where the page is; it never listens to the wheel or to touch, and never
 * changes the scroll. Videos load when their section comes near the screen, and not at all for
 * someone who has asked for less motion or less data: the first frame, a still, stays.
 */

type Scene = {
  el: HTMLElement;
  video: HTMLVideoElement;
  near: boolean;
  ready: boolean;
  seeking: boolean;
  /** The moment shown, in seconds, eased toward where the scroll says. */
  shown: number;
};

/** How quickly the shown moment follows the scroll, in seconds. */
const FOLLOW = 0.12;
/** How much of the picture is on screen when its scene starts. */
const ENTER = 0.85;
/**
 * Where the picture's middle is when its scene has played out, as a part of the screen's
 * height from its top: the middle of the screen. (It used to end with the picture's top near
 * the top of the screen, and the end was cut off as soon as you scrolled on.)
 */
const END_MIDDLE = 0.5;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

const scenes: Scene[] =
  calm || saving
    ? []
    : [...document.querySelectorAll<HTMLElement>('[data-act]')].flatMap((el) => {
        const video = el.querySelector<HTMLVideoElement>('[data-act-video]');
        return video ? [{ el, video, near: false, ready: false, seeking: false, shown: 0 }] : [];
      });

if (scenes.length) {
  let raf = 0;
  let last = performance.now();

  const load = (s: Scene) => {
    const v = s.video;
    v.src = v.dataset.src!;
    v.preload = 'auto';
    v.addEventListener('seeked', () => {
      s.seeking = false;
      schedule();
    });
    // A muted video may play without asking; playing it once, then pausing, makes every
    // browser (Safari included) decode it, so it can be moved to any moment after that.
    v.addEventListener(
      'loadeddata',
      () => {
        v.play()
          .catch(() => {})
          .finally(() => {
            v.pause();
            s.ready = true;
            s.el.classList.add('is-live');
            schedule();
          });
      },
      { once: true },
    );
    v.load();
  };

  const watcher = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const s = scenes.find((x) => x.el === entry.target);
        if (!s) continue;
        s.near = entry.isIntersecting;
        if (s.near && !s.video.src) load(s);
      }
      schedule();
    },
    { rootMargin: '50% 0px' },
  );
  scenes.forEach((s) => watcher.observe(s.el));

  /** Where the scene should be, from 0 (its first frame) to 1 (its last), from where it is on screen. */
  function wanted(s: Scene): number {
    const box = s.el.getBoundingClientRect();
    const view = window.innerHeight;
    // Its bottom edge, where the scene starts and where it ends.
    const from = view + box.height * (1 - ENTER);
    const to = view * END_MIDDLE + box.height / 2;
    return clamp01((from - box.bottom) / Math.max(1, from - to));
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    let busy = false;
    for (const s of scenes) {
      if (!s.near || !s.ready) continue;
      const length = s.video.duration;
      if (!Number.isFinite(length) || length <= 0) continue;
      const target = wanted(s) * (length - 0.04);
      s.shown += (target - s.shown) * (1 - Math.exp(-dt / FOLLOW));
      if (Math.abs(target - s.shown) < 0.004) s.shown = target;
      // One seek at a time; the next goes out when this one has landed.
      if (!s.seeking && Math.abs(s.video.currentTime - s.shown) > 1 / 48) {
        s.seeking = true;
        s.video.currentTime = s.shown;
      }
      if (s.shown !== target || s.seeking) busy = true;
    }
    if (busy) schedule();
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Passive, and they only note that something moved; the frame does the work.
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}
