/**
 * A small modelling kit: enough to build the brain and the four ability objects in code,
 * so the page downloads no model files. Everything is triangles with shared vertices;
 * normals are computed once per part in `pack()`.
 */

export type Vec3 = [number, number, number];

/** Triangles, plus a few optional extras per vertex that shaders can draw with. */
export type Geo = {
  pos: number[];
  idx: number[];
  /** Pattern coordinate. Defaults to the position at the time the vertex is created. */
  pat: number[];
  /** Direction from the object's centre, used by the brain's lobes. Defaults to `pat`. */
  dir?: number[];
  /** One number per vertex. The brain's fold pattern: the ink goes where it crosses zero. */
  val?: ArrayLike<number>;
  /**
   * Normals to shade with, if not the surface's own. The brain supplies the normals of its
   * smooth underlying shape, so its shadow is one calm area instead of a shadow on every fold.
   */
  shade?: number[];
};

const TAU = Math.PI * 2;

const empty = (): Geo => ({ pos: [], idx: [], pat: [] });

function vertex(g: Geo, x: number, y: number, z: number): number {
  g.pos.push(x, y, z);
  g.pat.push(x, y, z);
  return g.pos.length / 3 - 1;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A sphere made of near-equal triangles: an icosahedron, subdivided `level` times. */
export function icosphere(level: number): Geo {
  const t = (1 + Math.sqrt(5)) / 2;
  const g = empty();
  const add = (x: number, y: number, z: number) => {
    const l = Math.hypot(x, y, z);
    return vertex(g, x / l, y / l, z / l);
  };
  [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].forEach(([x, y, z]) => add(x, y, z));
  let faces = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
    1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
    4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ];
  for (let l = 0; l < level; l++) {
    const cache = new Map<number, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      let m = cache.get(key);
      if (m === undefined) {
        m = add(g.pos[a * 3] + g.pos[b * 3], g.pos[a * 3 + 1] + g.pos[b * 3 + 1], g.pos[a * 3 + 2] + g.pos[b * 3 + 2]);
        cache.set(key, m);
      }
      return m;
    };
    const next: number[] = [];
    for (let i = 0; i < faces.length; i += 3) {
      const [a, b, c] = [faces[i], faces[i + 1], faces[i + 2]];
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    faces = next;
  }
  g.idx = faces;
  return g;
}

/** A ball: an icosphere scaled and moved. */
export function ball(radius: number, centre: Vec3 = [0, 0, 0], level = 2): Geo {
  return move(scale(icosphere(level), [radius, radius, radius]), centre);
}

/**
 * A surface of revolution about the y axis. `profile` is a list of [radius, y] points.
 * The surface faces to the LEFT of the direction the profile is drawn in, so a profile
 * drawn from the top of an object down its outside faces outward. A radius of 0 closes
 * the surface with a single point.
 */
export function lathe(profile: [number, number][], segments = 40): Geo {
  const g = empty();
  const rings = profile.map(([r, y]) => {
    if (r < 1e-6) return [vertex(g, 0, y, 0)];
    const ring: number[] = [];
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * TAU;
      ring.push(vertex(g, r * Math.cos(a), y, r * Math.sin(a)));
    }
    return ring;
  });
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    if (A.length === 1 && B.length === 1) continue;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      if (A.length === 1) g.idx.push(A[0], B[s1], B[s]);
      else if (B.length === 1) g.idx.push(A[s], A[s1], B[0]);
      else g.idx.push(A[s], A[s1], B[s], A[s1], B[s1], B[s]);
    }
  }
  return g;
}

/** A round bar from a to b, optionally tapering. Both ends are closed. */
export function tube(a: Vec3, b: Vec3, ra: number, rb = ra, segments = 12): Geo {
  const w = norm(sub(a, b)); // the local "up": a is the top
  const len = Math.hypot(...sub(a, b));
  const helper: Vec3 = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(helper, w));
  const v = cross(u, w);
  const g = lathe(
    [
      [0, len],
      [ra, len],
      [rb, 0],
      [0, 0],
    ],
    segments,
  );
  for (let i = 0; i < g.pos.length; i += 3) {
    const [x, y, z] = [g.pos[i], g.pos[i + 1], g.pos[i + 2]];
    g.pos[i] = b[0] + x * u[0] + y * w[0] + z * v[0];
    g.pos[i + 1] = b[1] + x * u[1] + y * w[1] + z * v[1];
    g.pos[i + 2] = b[2] + x * u[2] + y * w[2] + z * v[2];
  }
  g.pat = [...g.pos];
  return g;
}

/**
 * A ring, or part of one, lying in the xy plane around the z axis.
 * R is the ring's radius, r the thickness of the bar. Angles are in radians from +x.
 */
export function torus(R: number, r: number, from = 0, to = TAU, segments = 48, barSegments = 10): Geo {
  const g = empty();
  const full = Math.abs(to - from - TAU) < 1e-6;
  const steps = full ? segments : segments + 1;
  const at = (i: number, j: number) => (i % steps) * barSegments + (j % barSegments);
  for (let i = 0; i < steps; i++) {
    const phi = from + ((to - from) * i) / segments;
    const [cx, cy] = [Math.cos(phi), Math.sin(phi)];
    for (let j = 0; j < barSegments; j++) {
      const th = (j / barSegments) * TAU;
      const k = R + r * Math.cos(th);
      vertex(g, k * cx, k * cy, r * Math.sin(th));
    }
  }
  const spans = full ? segments : segments;
  for (let i = 0; i < spans; i++) {
    for (let j = 0; j < barSegments; j++) {
      const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)];
      g.idx.push(a, b, c, b, d, c);
    }
  }
  if (!full) {
    // Flat caps on the two open ends.
    for (const [i, flip] of [[0, false], [segments, true]] as [number, boolean][]) {
      const phi = from + ((to - from) * i) / segments;
      const c = vertex(g, R * Math.cos(phi), R * Math.sin(phi), 0);
      for (let j = 0; j < barSegments; j++) {
        const [p, q] = [at(i, j), at(i, j + 1)];
        // The start cap faces back along the ring, the end cap forward.
        if (flip) g.idx.push(c, q, p);
        else g.idx.push(c, p, q);
      }
    }
  }
  return g;
}

/** A box centred on the origin. */
export function box(w: number, h: number, d: number): Geo {
  const g = empty();
  const [x, y, z] = [w / 2, h / 2, d / 2];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1]) vertex(g, sx * x, sy * y, sz * z);
  // Vertex numbering: bit 0 = +x, bit 1 = +y, bit 2 = +z.
  g.idx.push(
    4, 5, 7, 4, 7, 6, // front (+z)
    1, 0, 2, 1, 2, 3, // back (-z)
    5, 1, 3, 5, 3, 7, // right (+x)
    0, 4, 6, 0, 6, 2, // left (-x)
    6, 7, 3, 6, 3, 2, // top (+y)
    0, 1, 5, 0, 5, 4, // bottom (-y)
  );
  return g;
}

/** A flat shape in the xy plane, given as a convex, counter-clockwise outline, made `depth` thick. */
export function prism(outline: [number, number][], depth: number): Geo {
  const g = empty();
  const n = outline.length;
  for (const [x, y] of outline) vertex(g, x, y, depth / 2);
  for (const [x, y] of outline) vertex(g, x, y, -depth / 2);
  for (let i = 1; i < n - 1; i++) {
    g.idx.push(0, i, i + 1); // front
    g.idx.push(n, n + i + 1, n + i); // back
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    g.idx.push(i, n + i, n + j, i, n + j, j);
  }
  return g;
}

// --- moving things around -------------------------------------------------------------------

export function move(g: Geo, by: Vec3, movePattern = true): Geo {
  for (let i = 0; i < g.pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      g.pos[i + k] += by[k];
      if (movePattern) g.pat[i + k] += by[k];
    }
  }
  return g;
}

export function scale(g: Geo, by: Vec3): Geo {
  for (let i = 0; i < g.pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      g.pos[i + k] *= by[k];
      g.pat[i + k] *= by[k];
    }
  }
  return g;
}

/** Rotate about an axis by an angle in degrees. The pattern coordinate stays as it was. */
export function rotate(g: Geo, axis: 'x' | 'y' | 'z', degrees: number): Geo {
  const a = (degrees * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  for (let i = 0; i < g.pos.length; i += 3) {
    const [x, y, z] = [g.pos[i], g.pos[i + 1], g.pos[i + 2]];
    if (axis === 'x') [g.pos[i + 1], g.pos[i + 2]] = [y * c - z * s, y * s + z * c];
    else if (axis === 'y') [g.pos[i], g.pos[i + 2]] = [x * c + z * s, -x * s + z * c];
    else [g.pos[i], g.pos[i + 1]] = [x * c - y * s, x * s + y * c];
  }
  return g;
}

export function merge(...parts: Geo[]): Geo {
  const g = empty();
  for (const p of parts) {
    const offset = g.pos.length / 3;
    g.pos.push(...p.pos);
    g.pat.push(...p.pat);
    for (const i of p.idx) g.idx.push(i + offset);
  }
  return g;
}

/** Floats per vertex in `pack()`'s output. */
export const VERTEX_SIZE = 16;

/**
 * Interleaved vertex data for the GPU: position, normal, pattern coordinate, direction,
 * shading normal and the pattern value (16 floats per vertex), with smooth normals averaged
 * from the faces around each vertex.
 */
export function pack(g: Geo): { data: Float32Array; indices: Uint16Array } {
  const n = g.pos.length / 3;
  if (n > 65535) throw new Error(`mesh too large for 16-bit indices: ${n} vertices`);
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < g.idx.length; i += 3) {
    const [a, b, c] = [g.idx[i] * 3, g.idx[i + 1] * 3, g.idx[i + 2] * 3];
    const u: Vec3 = [g.pos[b] - g.pos[a], g.pos[b + 1] - g.pos[a + 1], g.pos[b + 2] - g.pos[a + 2]];
    const v: Vec3 = [g.pos[c] - g.pos[a], g.pos[c + 1] - g.pos[a + 1], g.pos[c + 2] - g.pos[a + 2]];
    const f = cross(u, v); // length is twice the face's area, so big faces count for more
    for (const k of [a, b, c]) {
      nor[k] += f[0];
      nor[k + 1] += f[1];
      nor[k + 2] += f[2];
    }
  }
  const dir = g.dir ?? g.pat;
  const data = new Float32Array(n * VERTEX_SIZE);
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1;
    const o = i * VERTEX_SIZE;
    for (let k = 0; k < 3; k++) {
      data[o + k] = g.pos[i * 3 + k];
      data[o + 3 + k] = nor[i * 3 + k] / l;
      data[o + 6 + k] = g.pat[i * 3 + k];
      data[o + 9 + k] = dir[i * 3 + k];
      data[o + 12 + k] = g.shade ? g.shade[i * 3 + k] : nor[i * 3 + k] / l;
    }
    data[o + 15] = g.val ? g.val[i] : 0;
  }
  return { data, indices: new Uint16Array(g.idx) };
}
