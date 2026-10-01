/**
 * Draws the stage's 3D objects in the site's ink-and-white style, with plain WebGL.
 *
 * One canvas covers the whole scene. Each object (the brain, the four ability objects) is a
 * "sprite": a model drawn into its own square of the canvas, with its own rotation. The
 * stage decides where the squares are; this file only draws.
 *
 * Two passes per object:
 *   1. Outline: back faces pushed outward by a fixed number of pixels and filled with ink.
 *      What shows around the edges is the silhouette line.
 *   2. Fill: white with a light-grey shadow side, plus whatever the part's pattern inks on
 *      (the brain's folds, the rings on the radar dish) and the brain's pink lobes.
 */
import { VERTEX_SIZE, pack } from './geometry';
import { BRAIN, PATTERN, buildModels, type Model, type ModelName } from './models';

export type Sprite = {
  model: ModelName;
  /** Centre and size of the square it is drawn in, in scene units (the scene is 1000 wide). */
  x: number;
  y: number;
  size: number;
  /** How far it has turned, in turns. */
  turns: number;
  /** How far it is tipped toward the viewer (its top coming forward), in radians. */
  tip?: number;
  /** Brain only: how lit each ability's lobe is, 0 to 1. */
  lit?: [number, number, number, number];
};

export interface SceneRenderer {
  /** Match the drawing buffer to the scene's size on screen, in device pixels. */
  resize(devicePixels: number): void;
  /** Draw these sprites, first to last. lineWidth is the ink weight in device pixels. */
  draw(sprites: Sprite[], lineWidth: number): void;
  /** One model alone, as a PNG data URL with a transparent background. */
  snapshot(model: ModelName, turns: number, size: number, lineWidth: number): string;
  destroy(): void;
}

const CAMERA = { eye: [0, 0.86, 5.4], target: [0, -0.04, 0], fovY: 26 };
const CLIP = { near: 1, far: 12 };
/** Depth-buffer distance per model unit, at the distance the models sit from the camera. */
const DEPTH_PER_UNIT = (2 * CLIP.far * CLIP.near) / ((CLIP.far - CLIP.near) * (CAMERA.eye[2] * CAMERA.eye[2]));
/** How far a 'rock' motion swings to each side, in turns. */
const ROCK = 0.085;

/** How much of the folds' own relief shows in the shading: 0 = none, 1 = a shadow on every fold. */
const RELIEF = 0.0;

const v3 = (v: number[]) => `vec3(${v.map((n) => n.toFixed(4)).join(', ')})`;
const f = (n: number) => n.toFixed(4);

// The outline is pushed out along the shading normal, not the surface's own: on the brain
// that is the calm underlying shape, so neighbouring vertices all move the same way and the
// line stays even where the folds crease.
const OUTLINE_VERT = `
attribute vec3 aPos;
attribute vec3 aShade;
uniform mat4 uMVP;
uniform float uWidth;   // outline width as a fraction of the sprite's square
uniform float uSink;    // how far to push the outline back, in depth-buffer units
void main() {
  vec4 clip = uMVP * vec4(aPos, 1.0);
  vec4 tip = uMVP * vec4(aPos + aShade * 0.01, 1.0);
  vec2 dir = tip.xy / tip.w - clip.xy / clip.w;
  float len = length(dir);
  if (len > 1e-7) clip.xy += (dir / len) * uWidth * 2.0 * clip.w;
  clip.z += uSink * clip.w;
  gl_Position = clip;
}`;

const OUTLINE_FRAG = `
precision mediump float;
void main() { gl_FragColor = vec4(0.290, 0.290, 0.290, 1.0); }`;

const FILL_VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aPattern;
attribute vec3 aDir;
attribute vec3 aShade;
attribute float aValue;
uniform mat4 uMVP;
uniform mat4 uMV;
varying vec3 vPattern;
varying vec3 vDir;
varying vec3 vView;
varying vec3 vNormal;   // the surface's own normal
varying vec3 vShade;    // the normal to shade with
varying float vValue;
void main() {
  vPattern = aPattern;
  vDir = aDir;
  vValue = aValue;
  vView = (uMV * vec4(aPos, 1.0)).xyz;
  vNormal = mat3(uMV) * aNormal;
  vShade = mat3(uMV) * aShade;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const FILL_FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vPattern;
varying vec3 vDir;
varying vec3 vView;
varying vec3 vNormal;
varying vec3 vShade;
varying float vValue;
uniform vec3 uColor;
uniform float uPattern;  // ${PATTERN.none} none, ${PATTERN.folds} brain folds, ${PATTERN.leaves} cerebellum leaves, ${PATTERN.rings} rings
uniform float uFlat;     // 1 = facet shading
uniform float uUnlit;    // 1 = no shading
uniform vec4 uLit;       // brain: how lit each ability's lobe is
uniform float uLine;     // ink weight in pixels

const vec3 INK = vec3(0.290);
const vec3 PINK = vec3(1.0, 0.0, 0.514);
// A lit lobe: a pale pink wash with its folds drawn in the darker pink, not a solid patch.
const vec3 PINK_WASH = vec3(1.0, 0.80, 0.90);
const vec3 PINK_INK = vec3(0.859, 0.0, 0.439);
const vec3 LIGHT = vec3(-0.42, 0.72, 0.55);
const float SHADE = 0.885;

// How fast g changes from one pixel to the next. Large where a surface is seen edge-on.
float slope(float g) {
  return length(vec2(dFdx(g), dFdy(g)));
}

// How far this pixel is from the zero line of g, in pixels.
float pixelsFrom(float g) {
  return abs(g) / (slope(g) + 1e-5);
}

float inked(float px, float width) {
  return 1.0 - smoothstep(width * 0.5 - 0.7, width * 0.5 + 0.7, px);
}

float lobe(vec3 centre, float size, float phase) {
  vec3 c = normalize(centre);
  vec3 d = normalize(vDir);
  float ang = acos(clamp(dot(d, c), -1.0, 1.0));
  // A slightly wobbly edge, so the patch is not a perfect circle.
  vec3 side = normalize(cross(c, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(side, c);
  float a = atan(dot(d, up), dot(d, side));
  float edge = size * (1.0 + 0.10 * sin(3.0 * a + phase) + 0.05 * sin(5.0 * a - phase));
  float aa = fwidth(ang) * 1.2;
  return 1.0 - smoothstep(edge - aa, edge + aa, ang);
}

void main() {
  float g = 1.0;
  float line = 0.0;

  if (uPattern > 0.5 && uPattern < 1.5) {
    // The grooves between the folds: where the baked pattern changes sign. A groove seen
    // nearly edge-on is left to the outline pass, which draws the fold in front of it.
    g = vValue;
    line = inked(pixelsFrom(g), uLine) * (1.0 - smoothstep(0.10, 0.24, slope(g)));
    // The fissure between the hemispheres gets a firmer line.
    float top = smoothstep(-0.34, -0.10, vDir.y);
    line = max(line, top * inked(pixelsFrom(vPattern.x), uLine * 1.2));
  } else if (uPattern > 1.5 && uPattern < 2.5) {
    // Cerebellum: a few level lines, gently bowed.
    g = sin(${f(BRAIN.cerebellum.leaves)} * (vPattern.y - (${f(BRAIN.cerebellum.c[1])})) + 1.2 * cos(4.0 * vPattern.x) + 0.6);
    line = inked(pixelsFrom(g), uLine * 0.8) * (1.0 - smoothstep(0.35, 0.8, slope(g)));
  } else if (uPattern > 2.5) {
    float rho = length(vPattern.xz);
    g = sin(rho * 15.708);
    line = inked(pixelsFrom(g), uLine * 0.9) * step(0.1, rho) * step(rho, 0.5) * (1.0 - smoothstep(0.35, 0.8, slope(g)));
  }

  // Two flat tones: white, and one grey on the side away from the light.
  vec3 n = uFlat > 0.5 ? normalize(cross(dFdx(vView), dFdy(vView))) : normalize(mix(vShade, vNormal, ${f(RELIEF)}));
  float lit = smoothstep(0.07, 0.13, dot(n, normalize(LIGHT)));

  vec3 fill = uColor;
  float pink = 0.0;
  if (uPattern > 0.5 && uPattern < 1.5) {
    pink = max(pink, uLit.x * lobe(${v3(BRAIN.lobes[0].dir)}, ${f(BRAIN.lobes[0].size)}, 0.4));
    pink = max(pink, uLit.y * lobe(${v3(BRAIN.lobes[1].dir)}, ${f(BRAIN.lobes[1].size)}, 2.1));
    pink = max(pink, uLit.z * lobe(${v3(BRAIN.lobes[2].dir)}, ${f(BRAIN.lobes[2].size)}, 3.7));
    pink = max(pink, uLit.w * lobe(${v3(BRAIN.lobes[3].dir)}, ${f(BRAIN.lobes[3].size)}, 5.2));
    fill = mix(fill, PINK_WASH, pink);
  }
  vec3 col = mix(fill * SHADE, fill, max(lit, uUnlit));
  col = mix(col, mix(INK, PINK_INK, pink), line);
  gl_FragColor = vec4(col, 1.0);
}`;

/** The vertex layout `pack()` writes: attribute name and how many floats it takes, in order. */
const ATTRIBUTES: [string, number][] = [
  ['aPos', 3],
  ['aNormal', 3],
  ['aPattern', 3],
  ['aDir', 3],
  ['aShade', 3],
  ['aValue', 1],
];

// --- small matrix helpers (column-major, as WebGL wants) --------------------------------------

type Mat4 = Float32Array;

function perspective(fovYDeg: number, near: number, far: number): Mat4 {
  const t = 1 / Math.tan((fovYDeg * Math.PI) / 360);
  const m = new Float32Array(16);
  m[0] = t;
  m[5] = t;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

function lookAt(eye: number[], target: number[]): Mat4 {
  let [zx, zy, zz] = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
  const zl = Math.hypot(zx, zy, zz);
  [zx, zy, zz] = [zx / zl, zy / zl, zz / zl];
  // right = up × z, with up = (0, 1, 0)
  let [xx, xz] = [zz, -zx];
  const xl = Math.hypot(xx, xz);
  [xx, xz] = [xx / xl, xz / xl];
  const [yx, yy, yz] = [zy * xz, zz * xx - zx * xz, -zy * xx];
  return new Float32Array([
    xx, yx, zx, 0,
    0, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1,
  ]);
}

function rotation(axis: 'x' | 'y' | 'z', radians: number): Mat4 {
  const [c, s] = [Math.cos(radians), Math.sin(radians)];
  if (axis === 'x') return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  if (axis === 'y') return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

// --- the renderer -----------------------------------------------------------------------------

/**
 * The models, built and packed once for the whole page: several canvases can draw them
 * without building a 40,000-vertex brain each.
 */
let library: { models: Record<ModelName, Model>; packed: Record<ModelName, ReturnType<typeof pack>[]> } | null = null;

function getLibrary() {
  if (!library) {
    const models = buildModels();
    const packed = Object.fromEntries(
      (Object.keys(models) as ModelName[]).map((name) => [name, models[name].parts.map((part) => pack(part.geo))]),
    ) as Record<ModelName, ReturnType<typeof pack>[]>;
    library = { models, packed };
  }
  return library;
}

/** `only` limits the models uploaded to this canvas, for canvases that draw one object. */
export function createSceneRenderer(canvas: HTMLCanvasElement, only?: ModelName[]): SceneRenderer | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true });
  if (!gl || !gl.getExtension('OES_standard_derivatives')) return null;

  const program = (vert: string, frag: string) => {
    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed');
      return shader;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    // The same attribute slots in both programs, so one buffer setup serves both.
    ATTRIBUTES.forEach(([name], i) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed');
    return p;
  };

  let outline: WebGLProgram;
  let fill: WebGLProgram;
  try {
    outline = program(OUTLINE_VERT, OUTLINE_FRAG);
    fill = program(FILL_VERT, FILL_FRAG);
  } catch (err) {
    console.warn('[stage] WebGL shaders failed, keeping the still image.', err);
    return null;
  }

  // Upload the models this canvas draws.
  const { models, packed } = getLibrary();
  const buffers: WebGLBuffer[] = [];
  const uploaded = Object.fromEntries(
    (only ?? (Object.keys(models) as ModelName[])).map((name) => [
      name,
      {
        model: models[name],
        parts: models[name].parts.map((part, i) => {
          const { data, indices } = packed[name][i];
          const vbo = gl.createBuffer()!;
          gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          const ibo = gl.createBuffer()!;
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
          buffers.push(vbo, ibo);
          return { part, vbo, ibo, count: indices.length };
        }),
      },
    ]),
  ) as Record<ModelName, { model: Model; parts: { part: Model['parts'][number]; vbo: WebGLBuffer; ibo: WebGLBuffer; count: number }[] }>;

  const bind = (p: { vbo: WebGLBuffer; ibo: WebGLBuffer }) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, p.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.ibo);
    let offset = 0;
    ATTRIBUTES.forEach(([, size], i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, VERTEX_SIZE * 4, offset);
      offset += size * 4;
    });
  };

  const u = {
    outlineMVP: gl.getUniformLocation(outline, 'uMVP'),
    outlineWidth: gl.getUniformLocation(outline, 'uWidth'),
    outlineSink: gl.getUniformLocation(outline, 'uSink'),
    mvp: gl.getUniformLocation(fill, 'uMVP'),
    mv: gl.getUniformLocation(fill, 'uMV'),
    color: gl.getUniformLocation(fill, 'uColor'),
    pattern: gl.getUniformLocation(fill, 'uPattern'),
    flat: gl.getUniformLocation(fill, 'uFlat'),
    unlit: gl.getUniformLocation(fill, 'uUnlit'),
    lit: gl.getUniformLocation(fill, 'uLit'),
    line: gl.getUniformLocation(fill, 'uLine'),
  };

  const projection = perspective(CAMERA.fovY, CLIP.near, CLIP.far);
  const view = lookAt(CAMERA.eye, CAMERA.target);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.SCISSOR_TEST);
  gl.clearColor(0, 0, 0, 0);

  /** Draw one model into the square (x, y, size), given in device pixels from the top left. */
  function drawModel(sprite: Sprite, x: number, y: number, size: number, lineWidth: number) {
    const entry = uploaded[sprite.model];
    if (!entry) return;
    const { model } = entry;
    const s = Math.round(size);
    const vx = Math.round(x);
    const vy = Math.round(canvas.height - y - size);
    gl.viewport(vx, vy, s, s);
    gl.scissor(vx, vy, s, s);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    const turns = sprite.turns * model.rate;
    const angle = model.motion === 'rock' ? Math.sin(turns * Math.PI * 2) * ROCK * Math.PI * 2 : (turns - Math.floor(turns)) * Math.PI * 2;
    // Tipped about the screen's own horizontal, before the model's lean and its turn.
    let lean = sprite.tip ? multiply(view, rotation('x', sprite.tip)) : view;
    if (model.tilt?.z) lean = multiply(lean, rotation('z', (model.tilt.z * Math.PI) / 180));
    if (model.tilt?.x) lean = multiply(lean, rotation('x', (model.tilt.x * Math.PI) / 180));
    const turning = multiply(lean, rotation('y', angle));
    const mvFor = (billboard?: boolean) => (billboard ? lean : turning);

    // 1. Outline: back faces, pushed out.
    gl.useProgram(outline);
    gl.cullFace(gl.FRONT);
    gl.uniform1f(u.outlineWidth, lineWidth / s);
    for (const p of entry.parts) {
      if (p.part.outline === false) continue;
      bind(p);
      gl.uniform1f(u.outlineSink, (p.part.sink ?? 0) * DEPTH_PER_UNIT);
      gl.uniformMatrix4fv(u.outlineMVP, false, multiply(projection, mvFor(p.part.billboard)));
      gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_SHORT, 0);
    }

    // 2. Fill.
    gl.useProgram(fill);
    gl.cullFace(gl.BACK);
    const lit = sprite.lit ?? [0, 0, 0, 0];
    gl.uniform4f(u.lit, lit[0], lit[1], lit[2], lit[3]);
    gl.uniform1f(u.line, lineWidth * 0.95);
    for (const p of entry.parts) {
      bind(p);
      const mv = mvFor(p.part.billboard);
      gl.uniformMatrix4fv(u.mv, false, mv);
      gl.uniformMatrix4fv(u.mvp, false, multiply(projection, mv));
      gl.uniform3f(u.color, p.part.color[0], p.part.color[1], p.part.color[2]);
      gl.uniform1f(u.pattern, p.part.pattern ?? PATTERN.none);
      gl.uniform1f(u.flat, p.part.flat ? 1 : 0);
      gl.uniform1f(u.unlit, p.part.unlit ? 1 : 0);
      gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_SHORT, 0);
    }
  }

  function clearAll() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.scissor(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  return {
    resize(devicePixels) {
      const size = Math.max(64, Math.min(2048, Math.round(devicePixels)));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
    },
    draw(sprites, lineWidth) {
      clearAll();
      const k = canvas.width / 1000; // device pixels per scene unit
      for (const sp of sprites) {
        if (sp.size <= 0.5) continue;
        drawModel(sp, (sp.x - sp.size / 2) * k, (sp.y - sp.size / 2) * k, sp.size * k, lineWidth);
      }
    },
    snapshot(model, turns, size, lineWidth) {
      const previous = canvas.width;
      canvas.width = size;
      canvas.height = size;
      clearAll();
      drawModel({ model, x: 0, y: 0, size: 0, turns }, 0, 0, size, lineWidth);
      const url = canvas.toDataURL('image/png');
      canvas.width = previous;
      canvas.height = previous;
      return url;
    },
    destroy() {
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteProgram(outline);
      gl.deleteProgram(fill);
    },
  };
}
