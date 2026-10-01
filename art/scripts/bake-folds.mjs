/**
 * Grows the brain's fold pattern and writes it to src/brain/three/folds.ts.
 *
 *   node art/scripts/bake-folds.mjs [--seed=7] [--width=0.22] [--rounds=70]
 *
 * The folds of a brain are a labyrinth: winding ridges of even width that fork and stop.
 * No tidy formula draws one, so this grows one the way animal coats grow their stripes
 * (a Turing pattern): every point looks at its close neighbourhood and at a wider one, and
 * moves toward whichever it agrees with. The result is one number per vertex of a sphere.
 * Its sign says which fold the vertex belongs to, and the line where it crosses zero is the
 * groove between two folds.
 *
 * It runs on the real shape of the cerebrum, so folds come out the same width everywhere,
 * and it keeps the two halves mirror images, which puts a groove down the middle.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { icosphere } from '../../src/brain/three/geometry.ts';
import { egg } from '../../src/brain/three/brain-shape.ts';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};

const LEVEL = 5; // the sphere the pattern is stored on; the model refines it once more
const SEED = arg('seed', 7);
const WIDTH = arg('width', 0.22); // width of one fold, in model units (the brain is about 1.6 wide)
const ROUNDS = arg('rounds', 70);
const STEP = arg('step', 0.12);
const SOFTEN = arg('soften', 1); // final blur, as a multiple of the close neighbourhood

// --- the mesh ---------------------------------------------------------------------------------

const sphere = icosphere(LEVEL);
const N = sphere.pos.length / 3;
const P = new Float64Array(N * 3);
for (let i = 0; i < N; i++) P.set(egg(sphere.pos[i * 3], sphere.pos[i * 3 + 1], sphere.pos[i * 3 + 2]).p, i * 3);

// Each vertex's mirror image across x = 0.
const key = (x, y, z) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
const byPlace = new Map();
for (let i = 0; i < N; i++) byPlace.set(key(sphere.pos[i * 3], sphere.pos[i * 3 + 1], sphere.pos[i * 3 + 2]), i);
const mirror = new Int32Array(N);
for (let i = 0; i < N; i++) {
  const m = byPlace.get(key(-sphere.pos[i * 3], sphere.pos[i * 3 + 1], sphere.pos[i * 3 + 2]));
  if (m === undefined) throw new Error('the sphere is not mirror-symmetric');
  mirror[i] = m;
}

// Diffusion on the surface: cotangent weights, so it spreads evenly whatever the triangles' shape.
const weights = new Map();
const area = new Float64Array(N);
const at = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const addWeight = (a, b, w) => {
  const k = a < b ? a * N + b : b * N + a;
  weights.set(k, (weights.get(k) ?? 0) + w);
};
for (let f = 0; f < sphere.idx.length; f += 3) {
  const tri = [sphere.idx[f], sphere.idx[f + 1], sphere.idx[f + 2]];
  const pts = tri.map(at);
  const twice = Math.hypot(...cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  for (let c = 0; c < 3; c++) {
    const [o, a, b] = [c, (c + 1) % 3, (c + 2) % 3];
    const cot = dot(sub(pts[a], pts[o]), sub(pts[b], pts[o])) / twice;
    addWeight(tri[a], tri[b], Math.max(cot, 0.05) / 2);
    area[tri[c]] += twice / 6;
  }
}
const start = new Int32Array(N + 1);
for (const k of weights.keys()) {
  start[Math.floor(k / N) + 1]++;
  start[(k % N) + 1]++;
}
for (let i = 0; i < N; i++) start[i + 1] += start[i];
const fill = start.slice(0, N);
const other = new Int32Array(start[N]);
const weight = new Float64Array(start[N]);
for (const [k, w] of weights) {
  const [a, b] = [Math.floor(k / N), k % N];
  other[fill[a]] = b;
  weight[fill[a]++] = w / area[a];
  other[fill[b]] = a;
  weight[fill[b]++] = w / area[b];
}
let stiffest = 0;
for (let i = 0; i < N; i++) {
  let sum = 0;
  for (let e = start[i]; e < start[i + 1]; e++) sum += weight[e];
  stiffest = Math.max(stiffest, sum);
}
const DT = 0.45 / stiffest;

/** Blur `u` until it has spread by a bell curve of width `sigma` (model units). */
function blur(u, sigma) {
  const steps = Math.max(1, Math.round((sigma * sigma) / 2 / DT));
  let a = Float64Array.from(u);
  let b = new Float64Array(N);
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < N; i++) {
      let flow = 0;
      for (let e = start[i]; e < start[i + 1]; e++) flow += weight[e] * (a[other[e]] - a[i]);
      b[i] = a[i] + DT * flow;
    }
    [a, b] = [b, a];
  }
  return a;
}

// --- growing the pattern ----------------------------------------------------------------------

// A small seeded generator, so the same seed always grows the same brain.
let state = SEED >>> 0;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const mirrored = (u) => {
  for (let i = 0; i < N; i++) {
    const m = mirror[i];
    if (m < i) continue;
    const v = m === i ? 0 : (u[i] - u[m]) / 2;
    u[i] = v;
    if (m !== i) u[m] = -v;
  }
  return u;
};

// A fold and the groove-to-groove distance: the two neighbourhoods are tuned so the pattern's
// preferred wavelength is two fold widths.
const near = (2 * WIDTH) / 6.54;
const far = near * 2;

let u = mirrored(Float64Array.from({ length: N }, () => random() * 2 - 1));
for (let round = 0; round < ROUNDS; round++) {
  const close = blur(u, near);
  const wide = blur(close, Math.sqrt(far * far - near * near));
  for (let i = 0; i < N; i++) u[i] = Math.max(-1, Math.min(1, u[i] + STEP * Math.sign(close[i] - wide[i])));
  mirrored(u);
}

// Soften the hard-edged result into rounded folds, and scale it so a fold's crest is about 1.
u = mirrored(blur(u, near * SOFTEN));
const sizes = Array.from(u, Math.abs).sort((a, b) => a - b);
const crest = sizes[Math.floor(N * 0.9)];
const bytes = Buffer.alloc(N);
for (let i = 0; i < N; i++) bytes.writeInt8(Math.round(Math.max(-1, Math.min(1, u[i] / crest)) * 127), i);

const out = fileURLToPath(new URL('../../src/brain/three/folds.ts', import.meta.url));
writeFileSync(
  out,
  `/**
 * The brain's fold pattern: one signed byte per vertex of a level-${LEVEL} icosphere, in base64.
 * Generated by art/scripts/bake-folds.mjs (seed ${SEED}, fold width ${WIDTH}, ${ROUNDS} rounds). Do not edit.
 */
export const FOLDS = {
  level: ${LEVEL},
  data: '${bytes.toString('base64')}',
};
`,
);
console.log(`folds: ${N} vertices, ${Math.round((sigmaSteps(far) * ROUNDS) / 1000)}k diffusion steps, wrote ${out}`);

function sigmaSteps(sigma) {
  return Math.round((sigma * sigma) / 2 / DT);
}
