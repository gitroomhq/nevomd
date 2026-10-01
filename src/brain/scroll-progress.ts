/**
 * Turns the scroll position into the finale's progress. It only ever READS the scroll
 * position: there are no wheel or touch listeners here or anywhere else (PLAN.md 6.1), so the
 * page scrolls exactly as the browser scrolls it.
 *
 * Progress is a pure function of scroll position. Scroll up and it runs backwards; land in
 * the middle of the page and it is already right.
 *
 * The finale's stage is in the page and scrolls with it. Its parts, one after the other:
 *   arrive   the stage comes up from the bottom of the screen, the four abilities round the brain
 *   gather   still coming up: the abilities go into the brain, which grows
 *   landing  the middle of the stage has reached the middle of the screen. From here the brain
 *            is held there while the page carries Nevo up to it, and it drops into his head
 */

export type StoryProgress = {
  arrive: number;
  gather: number;
  /** How far the landing has played: the brain dropping in and Nevo reacting. */
  landing: number;
  /** How far the page has carried Nevo up, over the landing's whole scrolling. */
  carried: number;
  /** How far the page has scrolled, in viewport heights: the brain turns a little with it. */
  scrolled: number;
};

/** Where each part starts, in screen heights before the stage's middle meets the screen's. */
const ARRIVE = { from: 0.9, to: 0.55 };
const GATHER = { from: 0.55, to: 0 };
/**
 * The share of the landing's scrolling in which it plays out: about two thirds. The brain
 * drops in and Nevo reacts while he is still low on the screen, so it is all done (the wink
 * too) quickly, with his face and the label over his head on screen; for the rest he rises to
 * the middle with nothing left to happen, whole on screen by the end. Any lower and his face
 * is below the bottom of the screen as the brain drops in.
 */
const PLAY = 0.65;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createStoryProgress(opts: { stage: HTMLElement }) {
  const { stage } = opts;

  let view = 1;
  /** The scroll position at which the stage's middle is at the screen's middle. */
  let hold = 0;
  let landingDistance = 1;

  /** Reads layout once. Called on load and whenever sizes change, never while scrolling. */
  function measure(landing = landingDistance) {
    const top = stage.getBoundingClientRect().top + window.scrollY;
    view = Math.max(1, document.documentElement.clientHeight);
    hold = top + stage.offsetHeight / 2 - view / 2;
    landingDistance = Math.max(1, landing);
  }

  const between = (sy: number, from: number, to: number) => clamp01((sy - (hold - from * view)) / ((from - to) * view));

  function read(): StoryProgress {
    const sy = window.scrollY;
    const carried = clamp01((sy - hold) / landingDistance);
    return {
      arrive: between(sy, ARRIVE.from, ARRIVE.to),
      gather: between(sy, GATHER.from, GATHER.to),
      landing: clamp01(carried / PLAY),
      carried,
      scrolled: sy / view,
    };
  }

  measure();
  return {
    measure,
    read,
    /** Scroll positions of the finale's parts, for the tests and the screenshot script. */
    marks: () => ({
      arriveFrom: hold - ARRIVE.from * view,
      gatherFrom: hold - GATHER.from * view,
      gatherTo: hold,
      landingFrom: hold,
      /** Where the landing has played out: the brain is in and Nevo has reacted. */
      landingPlayed: hold + landingDistance * PLAY,
      /** Where the page has brought Nevo to the middle of the screen. */
      landingTo: hold + landingDistance,
    }),
  };
}
