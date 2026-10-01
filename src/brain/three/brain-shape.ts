/**
 * The brain's measurements, and the shape of the cerebrum before its folds.
 *
 * Kept apart from the models so that `art/scripts/bake-folds.mjs` can import it on its own:
 * the fold pattern is grown on this shape, so the two must agree.
 */
import type { Vec3 } from './geometry';

export const BRAIN = {
  cerebrum: { rx: 0.8, ry: 0.76, rz: 1.0, flatten: 0.66, taper: 0.1 },
  /** How far the folds stand proud of the grooves between them, and how much of a fold's half-width is groove floor. */
  folds: { depth: 0.05, floor: 0.14 },
  fissure: { depth: 0.07, width: 0.07 },
  /**
   * Small, and tucked under the back, where it shows from the side and from behind but not
   * from the front. `cleft` pinches it into two halves; `leaves` is how tightly its lines are packed.
   */
  cerebellum: { c: [0, -0.4, -0.58] as Vec3, r: [0.31, 0.18, 0.26] as Vec3, cleft: 0.16, leaves: 62 },
  /** A short peg under the middle, leaning back a little as it goes down. */
  stem: { top: [0, -0.36, -0.2] as Vec3, bottom: [0, -0.74, -0.28] as Vec3, r: 0.105 },
  /** Where the lobes that light up sit, as directions from the centre, and their angular size. */
  lobes: [
    { dir: [-0.62, 0.42, 0.66] as Vec3, size: 0.46 }, // niche radar: left frontal
    { dir: [0.6, 0.7, -0.08] as Vec3, size: 0.44 }, // hype antenna: right parietal
    { dir: [-0.86, -0.06, -0.3] as Vec3, size: 0.44 }, // tactics board: left temporal
    { dir: [0.52, 0.34, -0.8] as Vec3, size: 0.46 }, // growth engine: right occipital
  ],
};

/**
 * Where a point of the unit sphere lands on the smooth cerebrum, and the outward direction
 * there. An egg: flattened underneath, a little narrower toward the front.
 */
export function egg(x: number, y: number, z: number): { p: Vec3; n: Vec3 } {
  const { rx, ry, rz, flatten, taper } = BRAIN.cerebrum;
  const px = rx * x * (1 - taper * z);
  const py = ry * (y < 0 ? y * flatten : y);
  const pz = rz * z;
  const nx = px / (rx * rx);
  const ny = py / (ry * ry);
  const nz = pz / (rz * rz);
  const l = Math.hypot(nx, ny, nz) || 1;
  return { p: [px, py, pz], n: [nx / l, ny / l, nz / l] };
}
