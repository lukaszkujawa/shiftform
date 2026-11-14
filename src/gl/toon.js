import * as THREE from '../vendor/three/three.module.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

export { THREE, mergeGeometries };

const HSL = /^hsl\(\s*(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?\s*\)$/;
const INK = 'hsl(28 45% 14% / 1)';

export function colorOf(css) {
  const hsl = HSL.exec(css);
  if (!hsl) return new THREE.Color(css);
  return new THREE.Color().setHSL((((+hsl[1] % 360) + 360) % 360) / 360, hsl[2] / 100, hsl[3] / 100, THREE.SRGBColorSpace);
}

export const opacityOf = css => +(HSL.exec(css)?.[4] ?? 1);

const ramp = new THREE.DataTexture(Uint8Array.from([110, 190, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

const materials = new Map();

function cached(key, make) {
  if (!materials.has(key)) materials.set(key, make());
  return materials.get(key);
}

export const toon = (css, { opacity = 1, emissive = 0 } = {}) => cached(`toon:${css}:${opacity}:${emissive}`, () => {
  const color = colorOf(css);
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp, transparent: opacity < 1, opacity, depthWrite: opacity === 1, emissive: color.clone().multiplyScalar(emissive) });
});

export const glowing = (css, opacity = 1) => cached(`glow:${css}:${opacity}`, () => new THREE.MeshBasicMaterial({ color: colorOf(css), transparent: opacity < 1, opacity, depthWrite: opacity === 1 }));

export const hull = (css = INK, thickness = 1.4) => cached(`hull:${css}:${thickness}`, () => new THREE.ShaderMaterial({
  uniforms: { ink: { value: colorOf(css) }, thickness: { value: thickness } },
  vertexShader: 'uniform float thickness; void main() { vec4 seen = modelViewMatrix * vec4(position, 1.0); seen.xyz += normalize(normalMatrix * normal) * thickness; gl_Position = projectionMatrix * seen; }',
  fragmentShader: 'uniform vec3 ink; void main() { gl_FragColor = vec4(ink, 1.0); }',
  side: THREE.BackSide,
}));

const smoothed = new WeakMap();

function smooth(geometry) {
  if (!smoothed.has(geometry)) {
    const bare = geometry.clone();
    for (const name of Object.keys(bare.attributes)) if (name !== 'position') bare.deleteAttribute(name);
    const welded = mergeVertices(bare, 0.01);
    welded.computeVertexNormals();
    smoothed.set(geometry, welded);
  }
  return smoothed.get(geometry);
}

export function mesh(geometry, material, outline = 1.4, { weld = false, ink = INK } = {}) {
  const body = new THREE.Mesh(geometry, material);
  if (!outline) return body;
  body.add(new THREE.Mesh(weld ? smooth(geometry) : geometry, hull(ink, outline)));
  return body;
}

const shapes = new Map();

export function shape(key, make) {
  if (!shapes.has(key)) shapes.set(key, make());
  return shapes.get(key);
}

export const roundBox = (w, h, d, r = Math.min(w, h, d) * 0.3, segments = 3) => new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2) * 0.999);

export function placed(geometry, x, y, z = 0, { sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0 } = {}) {
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  copy.applyMatrix4(matrix);
  copy.deleteAttribute('uv');
  return copy;
}

export const merged = parts => mergeGeometries(parts.filter(Boolean), false);

export function createPainter() {
  const buckets = new Map();
  return {
    add(css, part, { outline = 0, glow = false, opacity = 1 } = {}) {
      const key = `${css}|${outline}|${glow}|${opacity}`;
      if (!buckets.has(key)) buckets.set(key, { css, outline, glow, opacity, parts: [] });
      buckets.get(key).parts.push(part);
    },
    build(group) {
      for (const { css, outline, glow, opacity, parts } of buckets.values()) group.add(mesh(merged(parts), glow ? glowing(css, opacity) : toon(css, { opacity }), outline));
    },
  };
}


export const sphere = new THREE.SphereGeometry(1, 16, 12);
export const pebble = new THREE.SphereGeometry(1, 7, 5);
export const cone = new THREE.ConeGeometry(1, 1, 10);
export const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);

export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
