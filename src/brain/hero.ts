/**
 * The brain in the hero: drawn live over its still image, turning slowly on its own and a
 * little more as the page scrolls. The canvas is part of the page like anything else, so it
 * scrolls away with the hero; it only draws while it is on screen.
 *
 * It can be picked up with a mouse: drag it sideways to spin it (flick it and it coasts on), up
 * or down to tip it toward you or away; let go and it sits back up and carries on turning. With
 * a finger it cannot: on a touch screen a swipe over it is the page's, like a swipe anywhere
 * else, so nobody trying to scroll gets caught on it.
 */
import { createSceneRenderer } from './three/renderer';
import { STILL_TURNS } from './layout';

/** Seconds for one idle turn. */
const IDLE_PERIOD = 16;
/** Extra turns per viewport height scrolled, so scrolling visibly turns the brain. */
const TURNS_PER_SCREEN = 0.45;
/** Ink weight on screen, in CSS pixels at the default text size (16px). */
const LINE_CSS = 2.1;
/** Turns for a drag across the whole drawing square: about half a turn across the brain itself. */
const DRAG_TURNS = 0.8;
/** Radians of tip for a drag down the whole drawing square, and the most it tips either way. */
const DRAG_TIP = 2.2;
const TIP_MAX = 0.6;
/** Seconds for a flick's extra speed to fall to a third, and the fastest a flick can spin it (turns a second). */
const COAST = 0.8;
const SPIN_MAX = 2.5;
/** Seconds for a tipped brain to come most of the way back up. */
const SETTLE = 0.35;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const slot = document.querySelector<HTMLElement>('[data-hero-brain]');
const canvas = slot?.querySelector<HTMLCanvasElement>('canvas');
if (slot && canvas) start(slot, canvas);

function start(slot: HTMLElement, canvas: HTMLCanvasElement) {
  const renderer = createSceneRenderer(canvas, ['brain']);
  // No WebGL: the still image stays, which is the same drawing standing still.
  if (!renderer) return;

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0;
  let last = performance.now();
  let idle = 0;
  let onScreen = true;
  /** Device pixels per CSS pixel in the drawing buffer, and the ink weight in device pixels. */
  let line = 1;

  /** Turns added by dragging and flicking; a flick's speed still to come, in turns a second; the tip. */
  let spun = 0;
  let spin = 0;
  let tip = 0;
  /** The pointer holding the brain, where it was last, and when. */
  let hold: { id: number; x: number; y: number; t: number } | null = null;

  function layout() {
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer!.resize(width * dpr);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
    line = LINE_CSS * rem * (canvas.width / width);
    schedule();
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const still = calm.matches;
    // While held, it goes only where the hand takes it. Let go, it coasts and sits back up;
    // for someone who asked for less motion it just stays where it was put.
    if (!hold && !still) {
      idle += dt / IDLE_PERIOD;
      spun += spin * dt;
      spin *= Math.exp(-dt / COAST);
      if (Math.abs(spin) < 0.002) spin = 0;
      tip *= Math.exp(-dt / SETTLE);
      if (Math.abs(tip) < 0.001) tip = 0;
    }
    const scrolled = still ? 0 : (Math.max(0, window.scrollY) / window.innerHeight) * TURNS_PER_SCREEN;
    renderer!.draw([{ model: 'brain', x: 500, y: 500, size: 1000, turns: STILL_TURNS + idle + scrolled + spun, tip }], line);
    slot.classList.add('is-live');
    if (onScreen && !document.hidden && !still) schedule();
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Picking it up. Pointer events only: a touch that moves up or down is the page's (the
  // canvas allows vertical panning), and nothing here listens to the wheel.
  canvas.addEventListener('pointerdown', (e) => {
    // A mouse only: a finger or a pen on a touch screen is scrolling the page.
    if (hold || e.pointerType !== 'mouse' || e.button !== 0 || !slot.classList.contains('is-live')) return;
    // Dragging the brain should not select the text the mouse passes over.
    e.preventDefault();
    hold = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
    spin = 0;
    canvas.setPointerCapture(e.pointerId);
    slot.classList.add('is-held');
    schedule();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!hold || e.pointerId !== hold.id) return;
    const size = canvas.getBoundingClientRect().width;
    const turned = ((e.clientX - hold.x) / size) * DRAG_TURNS;
    const seconds = Math.max(0.004, (e.timeStamp - hold.t) / 1000);
    spun += turned;
    // The speed of the last few moves, for a flick.
    spin = spin * 0.5 + (turned / seconds) * 0.5;
    tip = clamp(tip + ((e.clientY - hold.y) / size) * DRAG_TIP, -TIP_MAX, TIP_MAX);
    hold = { id: hold.id, x: e.clientX, y: e.clientY, t: e.timeStamp };
    schedule();
  });

  const letGo = (e: PointerEvent) => {
    if (!hold || e.pointerId !== hold.id) return;
    // Held still before letting go: no flick.
    spin = e.timeStamp - hold.t > 90 ? 0 : clamp(spin, -SPIN_MAX, SPIN_MAX);
    hold = null;
    slot.classList.remove('is-held');
    last = performance.now();
    schedule();
  };
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);

  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    schedule();
  });
  calm.addEventListener('change', schedule);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    last = performance.now();
    if (onScreen) schedule();
  }).observe(canvas);
  new ResizeObserver(layout).observe(canvas);
  layout();

  if (import.meta.env.DEV) {
    // Used by tests/capture-still.mjs: the still image is one frame of this, at the same weight.
    // The tests read where the brain is turned and tipped.
    (window as unknown as { __hero: unknown }).__hero = {
      snapshot: (size: number) => renderer.snapshot('brain', STILL_TURNS, size, line * (size / canvas.width)),
      pose: () => ({ spun, tip, held: hold !== null }),
    };
  }
}
