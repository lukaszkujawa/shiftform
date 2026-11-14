import { overlaps } from '../world/level.js';
import { THREE, clock, colorOf, glowing, sphere } from './toon.js';

const AIR = 'hsl(190 85% 92% / 1)';
const WATER = 'hsl(190 90% 88% / 1)';
const DEPTH = 34;
const SPEED = { air: 260, water: 120 };

const FLOW_VERTEX = `varying vec3 vLocal;
void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FLOW_FRAGMENT = `uniform float clock;
uniform vec3 tint;
uniform vec2 size;
uniform float speed;
uniform float strength;
varying vec3 vLocal;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 p = vLocal.xy;
  float along = p.x, across = p.y + sin(along * 0.03 - clock * 2.0) * 4.0;
  float lanes = noise(vec2(across * 0.12, vLocal.z * 0.1)) * 0.6 + noise(vec2(across * 0.31, vLocal.z * 0.2 + 7.0)) * 0.4;
  float drift = noise(vec2(along * 0.018 - clock * speed * 0.004, across * 0.09));
  float streak = smoothstep(0.62, 0.92, lanes * 0.55 + drift * 0.75);
  vec2 edge = smoothstep(vec2(0.0), vec2(14.0), size * 0.5 - abs(p));
  float fade = edge.x * edge.y;
  gl_FragColor = vec4(tint, (0.04 + streak * 0.36) * fade * strength);
}`;

function flowMaterial(css, size, speed) {
  return new THREE.ShaderMaterial({
    uniforms: { clock, tint: { value: colorOf(css) }, size: { value: size }, speed: { value: speed }, strength: { value: 1 } },
    vertexShader: FLOW_VERTEX,
    fragmentShader: FLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const submerged = (o, level) => level.objects.some(w => w.type === 'water' && overlaps(o.x + o.w / 2 - 2, o.y + o.h / 2 - 2, 4, 4, w));

export function createCurrent(o, level) {
  const vertical = o.ay !== 0, flow = vertical ? Math.sign(o.ay) : Math.sign(o.ax), wet = submerged(o, level);
  const along = vertical ? o.h : o.w, across = vertical ? o.w : o.h, css = wet ? WATER : AIR, speed = wet ? SPEED.water : SPEED.air;
  const node = new THREE.Group(), turn = new THREE.Group();
  turn.rotation.z = vertical ? (flow < 0 ? Math.PI / 2 : -Math.PI / 2) : flow < 0 ? Math.PI : 0;
  node.position.set(o.x + o.w / 2, -(o.y + o.h / 2), -4);
  node.add(turn);
  for (const z of [-DEPTH / 3, 0, DEPTH / 3]) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(along, across), flowMaterial(css, new THREE.Vector2(along, across), speed));
    sheet.position.z = z;
    turn.add(sheet);
  }
  const count = Math.ceil((along * across) / (wet ? 900 : 1300));
  const bits = new THREE.InstancedMesh(sphere, glowing(css, wet ? 0.75 : 0.55), count);
  bits.frustumCulled = false;
  turn.add(bits);
  const seeds = Array.from({ length: count }, (_, k) => ({ a: (k * 97.13) % along, c: ((k * 53.7) % across) - across / 2, z: ((k * 31.3) % DEPTH) - DEPTH / 2, pace: 0.7 + ((k * 13.1) % 6) / 10, phase: k * 1.7 }));
  const pose = new THREE.Object3D();
  return {
    node,
    update(state, time) {
      const t = time / 1000;
      seeds.forEach((seed, k) => {
        const a = ((seed.a + t * speed * seed.pace) % along) - along / 2, fade = Math.min(1, (along / 2 - Math.abs(a)) / 16);
        pose.position.set(a, seed.c + Math.sin(t * 3 + seed.phase) * (wet ? 3 : 5), seed.z);
        if (wet) pose.scale.setScalar(1.2 + (k % 3) * 0.6 * fade);
        else pose.scale.set(9 * fade, 0.55 * fade, 0.55 * fade);
        pose.updateMatrix();
        bits.setMatrixAt(k, pose.matrix);
      });
      bits.instanceMatrix.needsUpdate = true;
    },
  };
}
