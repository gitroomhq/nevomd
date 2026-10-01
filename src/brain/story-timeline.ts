/**
 * The finale (PLAN.md 6.3) as one paused GSAP timeline.
 *
 * GSAP core only. The timeline never sees the scroll: stage.ts sets `timeline.time(t)` from
 * scroll progress, so GSAP has no way to pin, smooth or hijack anything.
 *
 * It animates plain boxes and a few numbers. The boxes say how big the brain is and where
 * each ability object is; stage.ts reads them every frame and has the 3D renderer draw there.
 * It also plays Nevo: his head, his face and the lid on his head.
 *
 * Timeline time:
 *   0..1     arrive: the brain comes up the screen with the four abilities round it
 *   1..2.5   gather: the abilities go into the brain one by one, each lighting its part, and it grows
 *   2.5..5   landing: Nevo comes up to the brain, it drops into his head, and he reacts
 */
import gsap from 'gsap';
import { SCENE, NODES, BUST, HEAD, POSE } from './layout';

export const ARRIVE_LENGTH = 1;
export const GATHER_LENGTH = 1.5;
export const LANDING_LENGTH = 2.5;

/** How far Nevo's features slide across his face for a full turn or tilt of the head, in bust image pixels. */
// Small, so the mouth and moustache stay on the beard drawn on his cheeks.
const SLIDE = { face: { x: 8, y: 5 }, nose: { x: 4, y: 2 }, head: { x: 5, y: 3 } };

export function buildTimeline(scene: HTMLElement) {
  const one = <T extends Element>(sel: string) => scene.querySelector<T>(sel)!;
  const all = <T extends Element>(sel: string) => [...scene.querySelectorAll<T>(sel)];

  const brain = one<HTMLElement>('[data-brain]');
  const nodes = all<HTMLElement>('[data-node]');
  const busts = all<HTMLElement>('[data-bust]');
  const lid = one<SVGGElement>('[data-lid]');
  const cavity = all<SVGElement>('[data-cavity]');
  const callout = one<HTMLElement>('[data-callout]');
  // Nevo, in layers (Stage.astro): the head turns on the neck, the face slides across the head.
  const heads = all<SVGGElement>('[data-head]');
  const face = one<SVGGElement>('[data-face]');
  const nose = one<SVGGElement>('[data-bust-nose]');
  const eyes = all<SVGGElement>('[data-bust-eye]');
  const brows = all<SVGGElement>('[data-bust-brow]');
  const mouth = one<SVGGElement>('[data-bust-mouth]');
  const oh = one<SVGEllipseElement>('[data-bust-oh]');

  /**
   * Numbers stage.ts reads every frame: how lit each ability's lobe is, how far the brain has
   * dropped from above Nevo's head into it, and how far the abilities have come back out
   * around him at the end.
   */
  const act = { l0: 0, l1: 0, l2: 0, l3: 0, into: 0, halo: 0 };

  /** The offset that puts an ability object at the centre of the brain, behind it. */
  const toBrain = (i: number) => ({ x: SCENE.brain.x - NODES[i].x, y: SCENE.brain.bodyY - NODES[i].y });

  // Starting pose: the brain, smaller, with the four abilities round it, still faint.
  gsap.set(brain, { scale: POSE.arrive, transformOrigin: '50% 50%' });
  nodes.forEach((n) => gsap.set(n, { x: 0, y: 0, scale: 0.6, opacity: 0 }));
  gsap.set(busts, { opacity: 0 });
  gsap.set(lid, { rotation: 0, svgOrigin: BUST.hinge });
  gsap.set(heads, { x: 0, y: 0, rotation: 0, svgOrigin: `${HEAD.pivot.x} ${HEAD.pivot.y}` });
  gsap.set([face, nose], { x: 0, y: 0 });
  gsap.set(face, { svgOrigin: `${HEAD.pivot.x} 430` });
  gsap.set([...eyes, ...brows, mouth, oh], { transformOrigin: '50% 50%' });
  gsap.set(oh, { scale: 0.3, opacity: 0 });
  gsap.set(callout, { opacity: 0, y: 14 });

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

  // --- arrive ---------------------------------------------------------------------------
  // The page brings the stage up the screen. The four abilities from the chapters above
  // appear round the brain, one after another.
  NODES.forEach((_, i) => {
    tl.to(nodes[i], { opacity: 1, scale: 0.8, duration: 0.3, ease: 'power2.out' }, 0.25 + i * 0.12);
  });

  // --- gather ---------------------------------------------------------------------------
  // Stuck to the screen now. Each ability flies into the brain and lights its part of it,
  // then the brain grows big.
  const gather = ARRIVE_LENGTH;
  const g = (part: number) => gather + part * GATHER_LENGTH;
  NODES.forEach((_, i) => {
    const t = g(0.05 + i * 0.13);
    tl.to(nodes[i], { ...toBrain(i), scale: 0.2, duration: 0.3 * GATHER_LENGTH, ease: 'power2.in' }, t);
    tl.to(nodes[i], { opacity: 0, duration: 0.04 * GATHER_LENGTH }, t + 0.27 * GATHER_LENGTH);
    tl.to(act, { [`l${i}`]: 1, duration: 0.12 * GATHER_LENGTH, ease: 'power1.out' }, t + 0.26 * GATHER_LENGTH);
  });
  tl.to(brain, { scale: POSE.big, duration: g(1) - g(0.62), ease: 'power2.inOut' }, g(0.62));
  tl.to(busts, { opacity: 1, duration: 0.05 }, g(0.95));

  // --- landing --------------------------------------------------------------------------
  // The page carries Nevo up the screen. The brain waits in the middle, shrinking to a size
  // that will fit him. He watches it come. His head opens, it drops in, the lid shuts, he
  // shakes it into place, and the abilities come back out around him.
  const landing = gather + GATHER_LENGTH;
  const at = (part: number) => landing + part * LANDING_LENGTH;
  const span = (from: number, to: number) => (to - from) * LANDING_LENGTH;

  /** Turn and tilt the head: yaw and pitch from -1 to 1, roll in degrees. The features slide to match. */
  const look = (from: number, to: number, pose: { yaw?: number; pitch?: number; roll?: number; bob?: number }, ease = 'power2.inOut') => {
    const { yaw = 0, pitch = 0, roll = 0, bob = 0 } = pose;
    const vars = { duration: span(from, to), ease };
    // The far side of a turned face is seen at an angle, so the features close up a little.
    tl.to(face, { x: SLIDE.face.x * yaw, y: -SLIDE.face.y * pitch, scaleX: 1 - 0.05 * Math.abs(yaw), ...vars }, at(from));
    tl.to(nose, { x: SLIDE.nose.x * yaw, y: -SLIDE.nose.y * pitch, ...vars }, at(from));
    tl.to(heads, { x: SLIDE.head.x * yaw, y: bob - SLIDE.head.y * pitch, rotation: roll, ...vars }, at(from));
  };

  tl.to(brain, { scale: POSE.hover, duration: span(0.14, 0.44), ease: 'power2.inOut' }, at(0.14));

  // He sees it: head back, eyes up and wide, eyebrows up, then a round mouth.
  look(0.04, 0.3, { pitch: 1, roll: -2 }, 'power1.inOut');
  tl.to(brows, { y: -9, duration: span(0.06, 0.24), ease: 'power2.out' }, at(0.06));
  tl.to(eyes, { y: -3, scale: 1.12, duration: span(0.06, 0.24), ease: 'power2.out' }, at(0.06));
  tl.to(mouth, { opacity: 0, duration: span(0.22, 0.26) }, at(0.22));
  tl.to(oh, { opacity: 1, scale: 1, duration: span(0.22, 0.3), ease: 'back.out(2)' }, at(0.22));

  // The top of his head opens and the brain drops in.
  tl.to(cavity, { opacity: 1, duration: 0.02 }, at(0.455));
  tl.to(lid, { rotation: -108, duration: span(0.46, 0.56), ease: 'power2.out' }, at(0.46));
  tl.to(act, { into: 1, duration: span(0.56, 0.72), ease: 'power2.in' }, at(0.56));
  tl.to(brain, { scale: POSE.inside, duration: span(0.56, 0.72), ease: 'power2.in' }, at(0.56));
  tl.to(lid, { rotation: 0, duration: span(0.72, 0.79), ease: 'power2.in' }, at(0.72));
  tl.to(cavity, { opacity: 0, duration: 0.02 }, at(0.79));

  // The lid lands: his head dips under it, eyes shut, and comes back up.
  look(0.76, 0.81, { pitch: -0.5, bob: 14 }, 'power2.in');
  tl.to(eyes, { y: 0, scaleX: 1, scaleY: 0.1, duration: span(0.77, 0.8) }, at(0.77));
  tl.to(brows, { y: 3, duration: span(0.77, 0.8) }, at(0.77));
  tl.to(oh, { scale: 0.55, duration: span(0.77, 0.8) }, at(0.77));
  look(0.81, 0.85, { pitch: 0 }, 'power2.out');

  // He shakes it into place: left, right, left, settle. This is where the head reads as round.
  look(0.85, 0.875, { yaw: -1, roll: -2.5 });
  look(0.875, 0.905, { yaw: 1, roll: 2.5 });
  look(0.905, 0.93, { yaw: -0.55, roll: -1.2 });
  look(0.93, 0.955, { yaw: 0, roll: 0 });
  tl.to(eyes, { scaleY: 1, duration: span(0.9, 0.93) }, at(0.9));
  tl.to(oh, { opacity: 0, scale: 0.3, duration: span(0.9, 0.93) }, at(0.9));
  tl.to(mouth, { opacity: 1, duration: span(0.9, 0.93) }, at(0.9));

  // It fits. A wider smile, and the abilities come back out around his head. (He also winks,
  // once, when the landing is done: that one is on a timer, in Stage.astro, so that it is
  // seen however fast the page was scrolled.)
  tl.to(brows, { y: -3, duration: span(0.93, 0.96), ease: 'power1.inOut' }, at(0.93));
  tl.to(mouth, { scaleX: 1.1, y: -1.5, duration: span(0.94, 0.97), ease: 'power1.out' }, at(0.94));
  tl.to(act, { halo: 1, duration: span(0.9, 1), ease: 'power2.out' }, at(0.9));
  tl.to(callout, { opacity: 1, y: 0, duration: span(0.95, 1) }, at(0.95));

  return { timeline: tl, act, gather, landing, length: landing + LANDING_LENGTH };
}
