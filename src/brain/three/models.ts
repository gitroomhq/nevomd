/**
 * The five 3D objects on the stage: the brain, and one object per ability.
 *
 * Object space: x = left/right, y = up, z = toward the viewer. Every model fits inside a
 * sphere of radius about 1.15, so they can share one camera.
 */
import { BRAIN, egg } from './brain-shape';
import { FOLDS } from './folds';
import { ball, box, icosphere, lathe, merge, move, prism, rotate, scale, torus, tube, type Geo, type Vec3 } from './geometry';

export { BRAIN };

export const WHITE: Vec3 = [1, 1, 1];
export const INK: Vec3 = [0.29, 0.29, 0.29];
export const PINK: Vec3 = [1, 0, 0.514];
export const GREY: Vec3 = [0.86, 0.86, 0.86];

/** What the fragment shader draws on a part's surface. */
export const PATTERN = { none: 0, folds: 1, leaves: 2, rings: 3 } as const;

export type Part = {
  geo: Geo;
  color: Vec3;
  pattern?: number;
  /** Flat facets instead of smooth shading: for boxes, fins and other hard-edged parts. */
  flat?: boolean;
  /** Set to false for small marks that are already ink, which need no outline of their own. */
  outline?: boolean;
  /**
   * Push the outline this far back (model units). Anything of the part's own surface within
   * that distance then hides it, so a lumpy part keeps the line around its silhouette without
   * a second, ragged line along every dip in it.
   */
  sink?: number;
  /** No shading: the colour is used as is. */
  unlit?: boolean;
  /** Always faces the camera instead of turning with the rest of the object. */
  billboard?: boolean;
};

export type Model = {
  parts: Part[];
  /** 'turn' spins all the way round. 'rock' swings from side to side, for things with a face. */
  motion: 'turn' | 'rock';
  /** A fixed lean, in degrees, applied after the spin. */
  tilt?: { x?: number; z?: number };
  /** How fast it moves relative to the brain. */
  rate: number;
};

// --- the brain ------------------------------------------------------------------------------

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Reshape a unit sphere, vertex by vertex. `shape` returns the new position and the pattern coordinate. */
function sculpt(level: number, shape: (x: number, y: number, z: number) => { p: Vec3; q: Vec3 }): Geo {
  const g = icosphere(level);
  g.dir = [...g.pos];
  for (let i = 0; i < g.pos.length; i += 3) {
    const s = shape(g.pos[i], g.pos[i + 1], g.pos[i + 2]);
    g.pos[i] = s.p[0];
    g.pos[i + 1] = s.p[1];
    g.pos[i + 2] = s.p[2];
    g.pat[i] = s.q[0];
    g.pat[i + 1] = s.q[1];
    g.pat[i + 2] = s.q[2];
  }
  return g;
}

/**
 * The baked fold pattern, carried from the sphere it was grown on to a sphere one level
 * finer: vertices the two share keep their value, each new one takes the mean of the two it
 * sits between, and a little smoothing rounds off the corners that leaves.
 */
function foldPattern(g: Geo): Float32Array {
  const raw = atob(FOLDS.data);
  const n = g.pos.length / 3;
  const coarse = raw.length;
  const near: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < g.idx.length; i += 3) {
    for (let k = 0; k < 3; k++) near[g.idx[i + k]].push(g.idx[i + ((k + 1) % 3)]);
  }
  let u = new Float32Array(n);
  for (let i = 0; i < coarse; i++) u[i] = ((raw.charCodeAt(i) << 24) >> 24) / 127;
  for (let i = coarse; i < n; i++) {
    const parents = near[i].filter((j) => j < coarse);
    u[i] = parents.reduce((sum, j) => sum + u[j], 0) / (parents.length || 1);
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const j of near[i]) sum += u[j];
      next[i] = 0.5 * u[i] + (0.5 * sum) / near[i].length;
    }
    u = next;
  }
  return u;
}

function cerebrum(): Geo {
  const g = icosphere(FOLDS.level + 1);
  const pattern = foldPattern(g);
  g.dir = [...g.pos];
  g.val = pattern;
  g.shade = [];
  for (let i = 0; i < g.pos.length; i += 3) {
    const y = g.pos[i + 1];
    const { p, n } = egg(g.pos[i], y, g.pos[i + 2]);
    // A fold is an arc in section. The pattern runs like a sine wave from groove to groove,
    // so its arcsine is how far across the fold this vertex is: 0 in the groove, 1 on the crest.
    // The groove has a narrow flat floor for the ink line to sit on; a knife-edge crease
    // would zigzag from triangle to triangle and chew the line up.
    const across = (2 / Math.PI) * Math.asin(Math.min(1, Math.abs(pattern[i / 3])));
    const up = Math.max(0, (across - BRAIN.folds.floor) / (1 - BRAIN.folds.floor));
    const fold = BRAIN.folds.depth * (1 - (1 - up) ** 2);
    // The fissure between the hemispheres, fading out underneath.
    const cleft = BRAIN.fissure.depth * Math.exp(-((p[0] / BRAIN.fissure.width) ** 2)) * smoothstep(-0.34, -0.08, y);
    const lift = fold - cleft;
    for (let k = 0; k < 3; k++) {
      g.pos[i + k] = p[k] + n[k] * lift;
      g.pat[i + k] = p[k];
    }
    g.shade.push(...n);
  }
  return g;
}

function cerebellum(): Geo {
  const { c, r, cleft } = BRAIN.cerebellum;
  return sculpt(4, (x, y, z) => {
    // Pinched in along the middle, more so toward the back, so it reads as two halves.
    const pinch = 1 - cleft * Math.exp(-((x / 0.22) ** 2)) * smoothstep(0.4, -0.6, z);
    const q: Vec3 = [c[0] + r[0] * x, c[1] + r[1] * y * pinch, c[2] + r[2] * z * pinch];
    return { p: q, q };
  });
}

function stem(): Geo {
  const { top, bottom, r } = BRAIN.stem;
  const length = Math.hypot(top[0] - bottom[0], top[1] - bottom[1], top[2] - bottom[2]);
  // A peg with a rounded end: a quarter circle closes the bottom.
  const profile: [number, number][] = [[r * 1.15, length]];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    profile.push([r * Math.cos(a), r - r * Math.sin(a)]);
  }
  const g = lathe(profile, 20);
  const lean = (Math.atan2(top[2] - bottom[2], top[1] - bottom[1]) * 180) / Math.PI;
  return move(rotate(g, 'x', lean), bottom);
}

function brain(): Model {
  return {
    motion: 'turn',
    rate: 1,
    parts: [
      { geo: cerebrum(), color: WHITE, pattern: PATTERN.folds },
      { geo: cerebellum(), color: WHITE, pattern: PATTERN.leaves },
      { geo: stem(), color: WHITE },
    ],
  };
}

// --- niche radar: a dish on a stand, with one pink blip at its focus ---------------------------

function radar(): Model {
  const dish = lathe(
    [
      [0, 0.06],
      [0.2, 0.085],
      [0.4, 0.16],
      [0.56, 0.27],
      [0.6, 0.315],
      [0.625, 0.3],
      [0.44, 0.13],
      [0.22, 0.03],
      [0, 0],
    ],
    48,
  );
  const feed = tube([0, 0.5, 0], [0, 0.06, 0], 0.022, 0.03, 8);
  const blip = ball(0.085, [0, 0.54, 0]);
  const aim = (g: Geo) => move(rotate(g, 'x', 52), [0, 0.02, 0.02], false);
  return {
    motion: 'turn',
    rate: 0.9,
    parts: [
      { geo: aim(dish), color: WHITE, pattern: PATTERN.rings },
      { geo: aim(feed), color: GREY },
      { geo: aim(blip), color: PINK },
      { geo: ball(0.12, [0, -0.04, -0.02]), color: WHITE },
      { geo: tube([0, -0.06, -0.02], [0, -0.74, 0], 0.06, 0.085, 14), color: WHITE },
      {
        geo: lathe(
          [
            [0, -0.72],
            [0.4, -0.72],
            [0.44, -0.78],
            [0.44, -0.84],
            [0, -0.84],
          ],
          40,
        ),
        color: WHITE,
      },
    ],
  };
}

// --- hype antenna: a small lattice mast with three pink signal arcs ------------------------------

function antenna(): Model {
  const top: Vec3 = [0, 0.3, 0];
  const legs: Geo[] = [];
  const braces: Geo[] = [];
  const foot = (i: number, t: number): Vec3 => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const r = 0.36 * (1 - t) + 0.035 * t;
    return [r * Math.cos(a), -0.8 + t * 1.1, r * Math.sin(a)];
  };
  for (let i = 0; i < 3; i++) {
    legs.push(tube(foot(i, 1), foot(i, 0), 0.026, 0.04, 8));
    for (const t of [0.2, 0.47, 0.72]) braces.push(tube(foot(i, t), foot((i + 1) % 3, t), 0.02, 0.02, 6));
    // One diagonal per bay keeps it reading as a lattice from every side.
    braces.push(tube(foot(i, 0.2), foot((i + 1) % 3, 0.47), 0.016, 0.016, 6));
  }
  const arcs = [0.24, 0.4, 0.56].map((r) =>
    move(torus(r, 0.036, (42 * Math.PI) / 180, (138 * Math.PI) / 180, 28, 8), [top[0], top[1] + 0.06, top[2]]),
  );
  return {
    motion: 'turn',
    rate: 0.8,
    parts: [
      { geo: merge(...legs, ...braces), color: WHITE },
      { geo: ball(0.09, [0, top[1] + 0.06, 0]), color: WHITE },
      {
        geo: lathe(
          [
            [0, -0.78],
            [0.48, -0.78],
            [0.52, -0.83],
            [0.52, -0.88],
            [0, -0.88],
          ],
          40,
        ),
        color: WHITE,
      },
      { geo: merge(...arcs), color: PINK, billboard: true },
    ],
  };
}

// --- tactics board: a clipboard with a play drawn on it, the arrow in pink -----------------------

function tactics(): Model {
  const z = 0.062; // marks sit just proud of the paper
  const cross = (x: number, y: number) =>
    merge(
      move(rotate(box(0.2, 0.04, 0.012), 'z', 45), [x, y, z]),
      move(rotate(box(0.2, 0.04, 0.012), 'z', -45), [x, y, z]),
    );
  const nought = (x: number, y: number) => move(torus(0.075, 0.018, 0, Math.PI * 2, 24, 6), [x, y, z]);

  // The play: an arc from lower left sweeping up to the right, ending in an arrowhead.
  const R = 0.46;
  const centre: Vec3 = [0.3, -0.34, z];
  const from = (100 * Math.PI) / 180;
  const to = (172 * Math.PI) / 180;
  const arc = move(torus(R, 0.026, from, to, 24, 6), centre);
  const tip: [number, number] = [centre[0] + R * Math.cos(from), centre[1] + R * Math.sin(from)];
  const head = move(
    rotate(
      prism(
        [
          [0.11, 0],
          [-0.05, 0.085],
          [-0.05, -0.085],
        ],
        0.03,
      ),
      'z',
      8,
    ),
    [tip[0] + 0.03, tip[1], z],
  );

  return {
    motion: 'rock',
    rate: 1.1,
    tilt: { x: -8 },
    parts: [
      { geo: box(1.02, 1.32, 0.07), color: WHITE, flat: true },
      { geo: move(box(0.86, 1.08, 0.03), [0, -0.06, 0.04]), color: WHITE, flat: true },
      { geo: move(box(0.42, 0.16, 0.11), [0, 0.62, 0.035]), color: GREY, flat: true },
      { geo: move(torus(0.075, 0.022, 0, Math.PI * 2, 24, 6), [0, 0.75, 0.02]), color: GREY },
      {
        geo: merge(cross(-0.27, 0.16), cross(0.28, 0.3), cross(0.27, -0.4), nought(-0.04, 0.34), nought(-0.28, -0.37)),
        color: INK,
        unlit: true,
        outline: false,
      },
      { geo: merge(arc, head), color: PINK, unlit: true, outline: false },
    ],
  };
}

// --- growth engine: a rocket with a pink flame -----------------------------------------------------

function rocket(): Model {
  const body = lathe(
    [
      [0, 1.02],
      [0.07, 0.97],
      [0.17, 0.85],
      [0.26, 0.64],
      [0.315, 0.38],
      [0.33, 0.1],
      [0.32, -0.2],
      [0.285, -0.42],
      [0.235, -0.56],
      [0, -0.56],
    ],
    40,
  );
  const nozzle = lathe(
    [
      [0, -0.54],
      [0.17, -0.54],
      [0.225, -0.7],
      [0, -0.7],
    ],
    28,
  );
  const flame = lathe(
    [
      [0, -0.68],
      [0.17, -0.7],
      [0.24, -0.86],
      [0.18, -1.08],
      [0.07, -1.27],
      [0, -1.4],
    ],
    28,
  );
  const fin = () =>
    prism(
      [
        [0.24, -0.58],
        [0.62, -0.82],
        [0.64, -0.6],
        [0.29, -0.1],
      ],
      0.07,
    );
  const fins = [0, 120, 240].map((a) => rotate(fin(), 'y', a));
  const rim = (a: number) => rotate(move(torus(0.12, 0.036, 0, Math.PI * 2, 28, 8), [0, 0.3, 0.31]), 'y', a);
  const glass = (a: number) =>
    rotate(move(rotate(lathe([[0, 0.03], [0.1, 0.03], [0.1, 0], [0, 0]], 24), 'x', 90), [0, 0.3, 0.3]), 'y', a);
  const all = (g: Geo) => scale(move(g, [0, 0.14, 0]), [0.8, 0.8, 0.8]);
  return {
    motion: 'turn',
    rate: 1.3,
    tilt: { z: -24, x: 6 },
    parts: [
      { geo: all(body), color: WHITE },
      { geo: all(merge(...fins)), color: WHITE, flat: true },
      { geo: all(nozzle), color: GREY },
      { geo: all(merge(rim(30), rim(210))), color: WHITE },
      { geo: all(merge(glass(30), glass(210))), color: GREY, outline: false },
      { geo: all(flame), color: PINK },
    ],
  };
}

export type ModelName = 'brain' | 'radar' | 'antenna' | 'tactics' | 'rocket';

export const buildModels = (): Record<ModelName, Model> => ({
  brain: brain(),
  radar: radar(),
  antenna: antenna(),
  tactics: tactics(),
  rocket: rocket(),
});
