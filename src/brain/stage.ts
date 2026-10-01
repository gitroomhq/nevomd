/**
 * Runs the finale's stage: measures the page, turns scroll progress into timeline time, and
 * tells the 3D renderer what to draw where. One requestAnimationFrame loop, running only
 * while the finale is on screen.
 *
 * The stage sits at the top of the finale, in the page. The page brings it up the screen; it
 * sticks while the abilities go into the brain; then it lets go, and the page brings Nevo up
 * under the brain, which drops into his head.
 */
import gsap from 'gsap';
import { createSceneRenderer, type SceneRenderer, type Sprite } from './three/renderer';
import { createStoryProgress } from './scroll-progress';
import { buildTimeline, ARRIVE_LENGTH, GATHER_LENGTH, LANDING_LENGTH } from './story-timeline';
import { SCENE, NODES, BODY, BUST, FINALE, STILL_TURNS, ABILITY_OBJECTS } from './layout';

/** Seconds for one idle turn of the brain. */
const IDLE_PERIOD = 16;
/** Extra turns per viewport height scrolled, so scrolling visibly turns the brain. */
const TURNS_PER_SCREEN = 0.45;
/** Animated values ease toward their target over about this long. Scroll itself is never eased. */
const EASE_SECONDS = 0.09;
/** Ink weight on screen, in CSS pixels at the default text size. */
const LINE_CSS = 2.1;
/** Angles the objects rest at when motion is reduced, in turns. */
const RESTING = [0.06, 0.08, 0, 0.04];

const finale = document.querySelector<HTMLElement>('[data-chapter="finale"]');
const stage = document.querySelector<HTMLElement>('[data-stage]');

if (finale && stage) start(finale, stage);

function start(finale: HTMLElement, stage: HTMLElement) {
  const scene = stage.querySelector<HTMLElement>('[data-scene]')!;
  const brain = stage.querySelector<HTMLElement>('[data-brain]')!;
  const nodes = [...stage.querySelectorAll<HTMLElement>('[data-node]')];
  const canvas = stage.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const stageBox = finale.querySelector<HTMLElement>('[data-sticky]')!;
  const nevoSlot = finale.querySelector<HTMLElement>('[data-nevo-slot]')!;
  /** Nevo's face: where his head is on screen, for looking at the pointer. */
  const faceBox = stage.querySelector<SVGGraphicsElement>('[data-face]')!;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const { timeline, act, landing: landingStart, length } = buildTimeline(scene);
  const progress = createStoryProgress({ stage: stageBox });

  // No WebGL: the stage shows Nevo without the brain. The text is unaffected.
  const renderer: SceneRenderer | null = createSceneRenderer(canvas);

  /** Scene scale: pixels per scene unit. */
  let k = 1;
  /** Device pixels per scene unit in the canvas's drawing buffer. */
  let bufferScale = 1;
  /** The page's text size relative to the default 16px: the ink scales with it. */
  let rem = 1;
  /** How far below his place in the scene Nevo stands, in scene units. */
  let nevoY = 0;
  /** Scene units the brain comes down during the landing to stay where it is on screen. */
  let drop = 0;

  /**
   * Measures the page and tells the scene (through CSS variables) how big it is and where Nevo
   * stands. Runs on load and when sizes change, never on scroll.
   */
  function layout() {
    const height = stageBox.clientHeight;
    const font = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    rem = font / 16;

    // Story.astro sizes Nevo's place in the page from the same unit as the scene.
    k = nevoSlot.offsetHeight / FINALE.slot || 1;
    // Nevo's hair starts just below the bottom edge of the stage.
    const gap = 0.5 * font;
    nevoY = SCENE.size / 2 + (height / 2 + gap) / k - BUST.hairTop;
    // The landing starts with the stage's middle at the screen's middle, and lasts until the
    // page has carried his hair up to where it stays.
    const view = document.documentElement.clientHeight;
    const landingDistance = height / 2 + view / 2 + gap - FINALE.restAt * view;
    drop = landingDistance / k;

    scene.style.setProperty('--k', k.toFixed(4));
    scene.style.setProperty('--nevo-y', nevoY.toFixed(1));

    // The buffer is sized for the scene on screen, capped at 2x: sharp without drawing four
    // times the pixels on a phone.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wanted = SCENE.size * k * dpr;
    renderer?.resize(wanted);
    bufferScale = Math.min(wanted, 2048) / SCENE.size;

    progress.measure(landingDistance);
    schedule();
  }

  // --- the loop -------------------------------------------------------------------------
  let raf = 0;
  let last = performance.now();
  let idleTurns = 0;
  let shown = -1; // timeline time currently displayed; -1 = nothing yet
  let target = 0; // where the scroll says it should be
  let onScreen = false;
  let canvasShift = 0;
  /** Where the mouse is, if there is one. Nevo looks at it. */
  let pointer: { x: number; y: number } | null = null;
  let look = { x: 0, y: 0 };

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const smoothstep = (a: number, b: number, v: number) => {
    const t = clamp01((v - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const read = (el: Element, prop: string) => Number(gsap.getProperty(el, prop));

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(1, Math.max(0, (now - last) / 1000));
    last = now;
    const still = reducedMotion.matches;

    const p = progress.read();
    const sum = (on: (v: number) => number) => on(p.arrive) * ARRIVE_LENGTH + on(p.gather) * GATHER_LENGTH + on(p.landing) * LANDING_LENGTH;
    // Reduced motion: no scrubbing. Each step is simply on or off.
    target = still ? sum((v) => (v >= 0.5 ? 1 : 0)) : sum((v) => v);
    target = Math.max(0, Math.min(length, target));

    if (shown < 0 || still) shown = target;
    else {
      shown += (target - shown) * (1 - Math.exp(-dt / EASE_SECONDS));
      if (Math.abs(target - shown) < 0.0005) shown = target;
    }
    timeline.time(shown);
    /** 0..1 through the landing, eased like everything else the timeline shows. */
    const landing = clamp01((shown - landingStart) / LANDING_LENGTH);
    const nevoOnStage = shown > landingStart - 0.2;
    scene.classList.toggle('has-bust', nevoOnStage);
    scene.classList.toggle('is-done', landing > 0.985);
    if (nevoOnStage && !still) lookAtPointer();

    // The brain turns on its own and a little more with the scroll. It comes to rest as it
    // settles into the head. Capped so nothing lurches after a long frame or a tab switch.
    const spin = 1 - smoothstep(0.4, 0.62, landing);
    if (!still) idleTurns += (Math.min(dt, 0.1) / IDLE_PERIOD) * spin;
    const scrollTurns = still ? 0 : Math.max(0, p.scrolled) * TURNS_PER_SCREEN;

    if (renderer) {
      // Where the cerebrum's centre is, in scene units: in the middle of the stage while it
      // arrives and gathers; during the landing it stays where it is on screen while the page
      // (and the scene with it) carries Nevo up, then it hovers over his head and drops in.
      // Staying put follows the page itself, which carries on after the landing has played;
      // with less motion, the landing is all or nothing and so is this.
      const scale = read(brain, 'scaleX');
      const offCentre = (BODY.v - 0.5) * SCENE.brain.size * scale;
      const waiting = SCENE.size / 2 + (still ? landing : p.carried) * drop;
      const hovering = nevoY + FINALE.hover;
      // His head arrives under the brain by itself and the brain rides above it from there.
      // If it has not by the time the lid is due to open (a very tall or narrow window), the
      // brain goes to it.
      const lifted = mix(Math.min(waiting, hovering), hovering, smoothstep(0.26, 0.44, landing));
      const bodyY = mix(lifted, nevoY + FINALE.inside, act.into);

      // The canvas is one scene square. During the landing the action moves below the scene,
      // so the canvas goes with it.
      const shift = Math.max(0, bodyY - SCENE.size / 2);
      if (Math.abs(shift - canvasShift) > 0.05) {
        canvasShift = shift;
        canvas.style.transform = shift ? `translateY(${shift.toFixed(1)}px)` : '';
      }

      // The timeline moved the boxes; draw each 3D object in its box. Ability objects first,
      // so they go in behind the brain.
      const sprites: Sprite[] = [];
      nodes.forEach((el, i) => {
        if (read(el, 'opacity') < 0.02) return;
        sprites.push({
          model: ABILITY_OBJECTS[i],
          x: NODES[i].x + read(el, 'x'),
          y: NODES[i].y + read(el, 'y') - shift,
          size: SCENE.icon * read(el, 'scaleX'),
          turns: still ? RESTING[i] : idleTurns * 1.7 + i * 0.27,
        });
      });
      // At the very end the abilities come back out, around Nevo's head.
      if (act.halo > 0.01) {
        FINALE.halo.forEach((spot, i) => {
          sprites.push({
            model: ABILITY_OBJECTS[i],
            x: mix(BUST.opening.x, spot.x, act.halo),
            y: nevoY + mix(BUST.opening.y, spot.y, act.halo) - shift,
            size: SCENE.icon * FINALE.haloScale * act.halo,
            turns: still ? RESTING[i] : idleTurns * 1.7 + i * 0.27,
          });
        });
      }
      sprites.push({
        model: 'brain',
        x: SCENE.brain.x,
        y: bodyY - offCentre - shift,
        size: SCENE.brain.size * scale,
        turns: STILL_TURNS + idleTurns + scrollTurns,
        lit: [act.l0, act.l1, act.l2, act.l3],
      });

      // The scene is scaled by CSS, so the line is drawn thicker or thinner in the buffer to
      // come out the same weight on screen.
      renderer.draw(sprites, (LINE_CSS * rem * bufferScale) / k);
    }

    // Keep going while there is something to animate: the idle spin while the finale is on
    // screen, and the easing until it has caught up, even if the finale has just left it.
    if (!document.hidden && (shown !== target || (onScreen && !still))) schedule();
  }

  /**
   * Turns Nevo's head toward the pointer: two numbers from -1 to 1 that the stage's CSS turns
   * into a lean of the head and a slide of the face. It reads one box and writes two
   * variables, and only when the answer has changed.
   */
  function lookAtPointer() {
    let x = 0;
    let y = 0;
    if (pointer) {
      const box = faceBox.getBoundingClientRect();
      if (box.bottom > 0 && box.top < window.innerHeight) {
        const reach = Math.max(window.innerWidth, window.innerHeight) * 0.3;
        x = Math.max(-1, Math.min(1, (pointer.x - (box.left + box.width / 2)) / reach));
        y = Math.max(-1, Math.min(1, (pointer.y - (box.top + box.height / 2)) / reach));
      }
    }
    if (Math.abs(x - look.x) < 0.01 && Math.abs(y - look.y) < 0.01) return;
    look = { x, y };
    scene.style.setProperty('--look-x', x.toFixed(2));
    scene.style.setProperty('--look-y', y.toFixed(2));
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // A mouse only: a finger on a touch screen is scrolling, not pointing. Passive, and it only
  // stores the position; the loop does the rest.
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse') pointer = { x: e.clientX, y: e.clientY };
    },
    { passive: true },
  );
  // Out of the window: a pointerout with nothing on the other side.
  window.addEventListener(
    'pointerout',
    (e) => {
      if (!e.relatedTarget) pointer = null;
    },
    { passive: true },
  );

  // Passive, and it only asks for a frame. It never reads or writes layout.
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    schedule();
  });
  reducedMotion.addEventListener('change', schedule);

  // Runs while the finale is anywhere near the screen, a screen ahead of time so the first
  // frame is ready when it arrives.
  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      last = performance.now();
      if (onScreen) schedule();
    },
    { rootMargin: '100% 0px' },
  ).observe(finale);

  // Sizes change when the window does, and when fonts or images finish loading.
  const ro = new ResizeObserver(layout);
  ro.observe(stageBox);
  ro.observe(document.body);
  layout();

  if (import.meta.env.DEV) {
    // For the tests and the screenshot script: where the finale's parts start and end, and
    // what the stage is showing right now.
    (window as unknown as { __stage: unknown }).__stage = {
      marks: progress.marks,
      // Only the numbers: GSAP keeps its own bookkeeping on the object it animates.
      state: () => ({ time: shown, l0: act.l0, l1: act.l1, l2: act.l2, l3: act.l3, into: act.into, halo: act.halo }),
      /** True once the eased time has caught up with where the scroll says it should be. */
      settled: () => shown === target,
    };
  }
}
