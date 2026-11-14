import { alpha, shade } from '../art/themes.js';
import { signalPalette } from '../art/object-art.js';
import { THREE, toon, mesh, roundBox, placed, merged } from './toon.js';

export function inked(p, o) {
  if (o.gate) return { ...p, accent: p.ink, accentSoft: alpha(p.ink, 0.25), accentDeep: p.ink, accentLight: shade(p.ink, 30) };
  if (!o.bit) return p;
  const signal = signalPalette(p, o.bit);
  return { ...signal, accentLight: shade(signal.accent, 16) };
}

export function flexible(rings, radius, material, outline = 1.2, sides = 7) {
  const geometry = new THREE.BufferGeometry(), count = rings * sides;
  const position = new THREE.BufferAttribute(new Float32Array(count * 3), 3), normal = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  normal.setUsage(THREE.DynamicDrawUsage);
  const index = [];
  for (let r = 0; r < rings - 1; r++) for (let s = 0; s < sides; s++) {
    const a = r * sides + s, b = r * sides + ((s + 1) % sides), c = a + sides, d = b + sides;
    index.push(a, b, c, b, d, c);
  }
  geometry.setIndex(index);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', normal);
  const node = mesh(geometry, material, outline);
  node.traverse(part => { part.frustumCulled = false; });
  const xs = new Float32Array(rings), ys = new Float32Array(rings);
  function trace(z = 0) {
    for (let r = 0; r < rings; r++) {
      const a = Math.max(0, r - 1), b = Math.min(rings - 1, r + 1);
      let tx = xs[b] - xs[a], ty = ys[b] - ys[a];
      const length = Math.hypot(tx, ty) || 1;
      tx /= length; ty /= length;
      for (let s = 0; s < sides; s++) {
        const angle = (s / sides) * Math.PI * 2, c = Math.cos(angle), n = Math.sin(angle), i = (r * sides + s) * 3;
        const nx = -ty * c, ny = tx * c;
        normal.array[i] = nx; normal.array[i + 1] = ny; normal.array[i + 2] = n;
        position.array[i] = xs[r] + nx * radius; position.array[i + 1] = ys[r] + ny * radius; position.array[i + 2] = z + n * radius;
      }
    }
    position.needsUpdate = normal.needsUpdate = true;
  }
  return { node, xs, ys, rings, trace };
}

export function smoothInto(line, points) {
  const last = points.length - 1, steps = (line.rings - 1) / last;
  for (let r = 0; r < line.rings; r++) {
    const f = r / steps, k = Math.min(last - 1, Math.floor(f)), t = f - k;
    const p0 = points[Math.max(0, k - 1)], p1 = points[k], p2 = points[k + 1], p3 = points[Math.min(last, k + 2)];
    const t2 = t * t, t3 = t2 * t;
    const spline = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
    line.xs[r] = spline(p0.x, p1.x, p2.x, p3.x);
    line.ys[r] = -spline(p0.y, p1.y, p2.y, p3.y);
  }
}

export function bendInto(line, fromX, fromY, viaX, viaY, toX, toY) {
  for (let r = 0; r < line.rings; r++) {
    const t = r / (line.rings - 1), u = 1 - t;
    line.xs[r] = u * u * fromX + 2 * u * t * viaX + t * t * toX;
    line.ys[r] = -(u * u * fromY + 2 * u * t * viaY + t * t * toY);
  }
}

export const bright = (css, opacity = 1) => toon(css, { opacity, emissive: 0.35 });

export function dashedFrame(w, h, dash, gap) {
  const parts = [], edge = (length, place) => { for (let a = 0; a < length; a += dash + gap) place(a + Math.min(dash, length - a) / 2, Math.min(dash, length - a)); };
  edge(w, (a, d) => parts.push(placed(roundBox(d, 1.8, 1.8, 0.6), a - w / 2, h / 2, 0), placed(roundBox(d, 1.8, 1.8, 0.6), a - w / 2, -h / 2, 0)));
  edge(h, (a, d) => parts.push(placed(roundBox(1.8, d, 1.8, 0.6), -w / 2, a - h / 2, 0), placed(roundBox(1.8, d, 1.8, 0.6), w / 2, a - h / 2, 0)));
  return merged(parts);
}
