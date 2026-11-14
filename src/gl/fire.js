import { THREE, clock, colorOf } from './toon.js?v=18026c0';

const FLAME_VERTEX = `varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = fract(dot(modelMatrix[3].xyz, vec3(0.0123, 0.0371, 0.0517)));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FLAME_FRAGMENT = `uniform float clock;
uniform vec3 hot;
uniform vec3 warm;
uniform vec3 cool;
uniform float strength;
varying vec2 vUv;
varying float vSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int k = 0; k < 4; k++) { sum += noise(p) * amp; p = p * 2.03 + 17.1; amp *= 0.5; }
  return sum;
}
void main() {
  float t = clock * 2.6 + vSeed * 40.0, y = vUv.y;
  vec2 p = vec2((vUv.x - 0.5) * 2.0, y);
  p.x += (fbm(vec2(y * 2.5 - t * 0.6, vSeed * 9.0)) - 0.5) * 0.55 * y;
  float rise = fbm(vec2(p.x * 2.6, y * 3.2 - t * 1.8));
  float width = mix(0.95, 0.04, pow(y, 0.85));
  float body = 1.0 - smoothstep(width * 0.35, width, abs(p.x));
  float heat = body * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.45, 1.0, y + (rise - 0.5) * 0.9));
  heat *= 0.75 + rise * 0.6;
  if (heat < 0.04) discard;
  vec3 colour = mix(cool, warm, smoothstep(0.12, 0.6, heat));
  colour = mix(colour, hot, smoothstep(0.8, 1.05, heat));
  gl_FragColor = vec4(colour * 0.82, smoothstep(0.04, 0.32, heat) * strength);
  #include <colorspace_fragment>
}`;

const palettes = new Map();
const plane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);

export const FIRE = { hot: 'hsl(52 100% 90% / 1)', warm: 'hsl(36 100% 58% / 1)', cool: 'hsl(8 95% 48% / 1)' };

export function flameMaterial({ hot = FIRE.hot, warm = FIRE.warm, cool = FIRE.cool } = {}) {
  const key = `${hot}|${warm}|${cool}`;
  if (!palettes.has(key)) palettes.set(key, Object.assign(new THREE.ShaderMaterial({
    uniforms: { clock, hot: { value: colorOf(hot) }, warm: { value: colorOf(warm) }, cool: { value: colorOf(cool) }, strength: { value: 1 } },
    vertexShader: FLAME_VERTEX,
    fragmentShader: FLAME_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), { userData: { bloom: true } }));
  return palettes.get(key);
}

export function createFire(width, height, colours) {
  const fire = new THREE.Group();
  for (const [scale, z] of [[1, 0], [0.62, 0.6]]) {
    const sheet = new THREE.Mesh(plane, flameMaterial(colours));
    sheet.scale.set(width * scale, height * (0.55 + scale * 0.45), 1);
    sheet.position.z = z;
    sheet.renderOrder = 2;
    fire.add(sheet);
  }
  return fire;
}
