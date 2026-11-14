import * as THREE from '../vendor/three/three.module.js?v=18026c0';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js?v=18026c0';
import { mergeGeometries, mergeVertices } from '../vendor/three/addons/utils/BufferGeometryUtils.js?v=18026c0';

export { THREE, mergeGeometries };

const HSL = /^hsl\(\s*(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?\s*\)$/;
const INK = 'hsl(28 45% 14% / 1)';
export const EYE_WHITE = 'hsl(0 0% 97% / 1)';
export const PUPIL = 'hsl(240 30% 10% / 1)';

export const opacityOf = css => +(HSL.exec(css)?.[4] ?? 1);

export function colorOf(css) {
  const hsl = HSL.exec(css);
  if (!hsl) return new THREE.Color(css);
  return new THREE.Color().setHSL((((+hsl[1] % 360) + 360) % 360) / 360, hsl[2] / 100, hsl[3] / 100, THREE.SRGBColorSpace);
}


const ramp = new THREE.DataTexture(Uint8Array.from([110, 190, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

const materials = new Map();

function cached(key, make) {
  if (!materials.has(key)) materials.set(key, make());
  return materials.get(key);
}

export const rim = { color: { value: new THREE.Color(0xffffff) }, strength: { value: 0 } };
export const clock = { value: 0 };
export const climber = { value: new THREE.Vector2(-1e4, -1e4) };

const SWAY = `attribute float root;
uniform float clock;
uniform vec2 climber;
vec3 swayed(vec3 p) {
  float rise = min(abs(p.y - root), 32.0), lean = pow(rise, 1.5) * 0.03;
  float gust = sin(clock * 1.5 + p.x * 0.029 + p.z * 0.01) * 0.7 + sin(clock * 2.6 + p.x * 0.013 - p.z * 0.04) * 0.3;
  float gap = p.x - climber.x, near = (1.0 - smoothstep(5.0, 22.0, abs(gap))) * (1.0 - smoothstep(16.0, 30.0, abs(climber.y - mix(root, p.y, 0.5)))) * step(-60.0, p.z);
  float shove = sign(gap) * near * min(rise, 18.0) * 0.6;
  return p + vec3(lean * gust + shove, -abs(shove) * 0.25 * sign(p.y - root), 0.0);
}
`;

const swaying = shader => {
  Object.assign(shader.uniforms, { clock, climber });
  shader.vertexShader = shader.vertexShader.replace('void main() {', `${SWAY}void main() {`).replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = swayed(transformed);');
};

export const lift = { value: 0 };

export function withRim(material, { sway = false, lifted = false } = {}) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { rimColor: rim.color, rimStrength: rim.strength, liftAmount: lift });
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float liftAmount;\nvoid main() {')
      .replace('#include <opaque_fragment>', `outgoingLight += rimColor * rimStrength * smoothstep(0.62, 0.8, 1.0 - saturate(dot(normal, normalize(vViewPosition))));\n${lifted ? 'outgoingLight += diffuseColor.rgb * liftAmount;\n' : ''}#include <opaque_fragment>`);
    if (sway) swaying(shader);
  };
  material.customProgramCacheKey = () => `rim${sway ? '-sway' : ''}${lifted ? '-lift' : ''}`;
  return material;
}

export const toon = (css, { opacity = 1, emissive = 0, sway = false, lifted = false } = {}) => cached(`toon:${css}:${opacity}:${emissive}${sway ? ':sway' : ''}${lifted ? ':lift' : ''}`, () => {
  const color = colorOf(css);
  return withRim(new THREE.MeshToonMaterial({ color, gradientMap: ramp, transparent: opacity < 1, opacity, depthWrite: opacity === 1, emissive: color.clone().multiplyScalar(emissive) }), { sway, lifted });
});

export const glowing = (css, opacity = opacityOf(css)) => cached(`glow:${css}:${opacity}`, () => Object.assign(new THREE.MeshBasicMaterial({ color: colorOf(css), transparent: opacity < 1, opacity, depthWrite: opacity === 1 }), { userData: { bloom: true } }));
export const faded = (css, opacity) => glowing(css, Math.max(0.05, Math.round(opacity * 20) / 20));

export const hull = (css = INK, thickness = 1.4, sway = false) => cached(`hull:${css}:${thickness}${sway ? ':sway' : ''}`, () => new THREE.ShaderMaterial({
  uniforms: { ink: { value: colorOf(css) }, thickness: { value: thickness }, ...(sway ? { clock, climber } : {}) },
  vertexShader: `${sway ? SWAY : ''}uniform float thickness; void main() { vec4 seen = modelViewMatrix * vec4(${sway ? 'swayed(position)' : 'position'}, 1.0); seen.xyz += normalize(normalMatrix * normal) * thickness; gl_Position = projectionMatrix * seen; }`,
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

export function mesh(geometry, material, outline = 1.4, { weld = false, ink = INK, sway = false } = {}) {
  const body = new THREE.Mesh(geometry, material);
  if (!outline) return body;
  body.add(new THREE.Mesh(weld ? smooth(geometry) : geometry, hull(ink, outline, sway)));
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

export function extrude(draw, depth, { bevel = 0, bevelSegments = 2, curveSegments = 12 } = {}) {
  const outline = new THREE.Shape();
  draw(outline);
  return new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments, curveSegments }).translate(0, 0, -depth / 2);
}

export const tube = (points, radius, { closed = false, segments = 24 } = {}) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)), closed), segments, radius, 6, closed);

export const merged = parts => mergeGeometries(parts.filter(Boolean), false);

export function shining(node, css, { power = 1, reach = 160 } = {}) {
  node.userData.emitter = { color: colorOf(css).getHex(), power, reach };
  return node;
}

export function shadowed(node, { cast = true, receive = true } = {}) {
  node.traverse(part => {
    if (!part.isMesh || part.material?.isShaderMaterial || part.material?.userData?.bloom) return;
    part.castShadow = cast;
    part.receiveShadow = receive;
  });
  return node;
}

export function createPainter() {
  const buckets = new Map();
  const painter = {
    add(css, part, { outline = 0, glow = false, opacity = 1, weld = false, root = null } = {}) {
      const sway = root !== null && !glow && !weld, key = `${css}|${outline}|${glow}|${opacity}|${weld}|${sway}`;
      if (sway) part.setAttribute('root', new THREE.BufferAttribute(new Float32Array(part.attributes.position.count).fill(root), 1));
      if (!buckets.has(key)) buckets.set(key, { css, outline, glow, opacity, weld, sway, parts: [] });
      buckets.get(key).parts.push(part);
    },
    rooted: root => ({ add: (css, part, options = {}) => painter.add(css, part, { ...options, root }) }),
    build(group) {
      for (const { css, outline, glow, opacity, weld, sway, parts } of buckets.values()) group.add(mesh(merged(parts), glow ? glowing(css, opacity) : toon(css, { opacity, sway }), outline, { weld, sway }));
      return group;
    },
  };
  return painter;
}


export const sphere = new THREE.SphereGeometry(1, 16, 12);
export const pebble = new THREE.SphereGeometry(1, 7, 5);
export const cone = new THREE.ConeGeometry(1, 1, 10);
export const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
export const box = new THREE.BoxGeometry(1, 1, 1);
export const gem = new THREE.OctahedronGeometry(1);
export const hex = new THREE.CylinderGeometry(1, 1, 1, 6);

export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
