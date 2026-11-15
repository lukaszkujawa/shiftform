import { THREE, clock, colorOf } from './toon.js?v=3328ffe';

const NOISE = `float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float caustic(vec2 p, float t) {
  vec2 q = p + vec2(sin(p.y * 0.9 + t), cos(p.x * 0.8 - t * 0.8)) * 0.6;
  float a = abs(sin(q.x + sin(q.y * 1.3 + t * 0.7))), b = abs(sin(q.y * 1.1 + sin(q.x * 0.9 - t * 0.6)));
  return pow(1.0 - min(a, b), 7.0);
}
`;

const WAVE = `uniform float surface;
float wave(float x, float z) { return (sin(x * 0.07 + clock * 3.6) * 1.3 + sin(x * 0.17 - clock * 2.5 + z * 0.08) * 0.6) * surface; }
`;

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};
const tone = css => ({ value: colorOf(css) });

function shaded({ uniforms = {}, vertex = 'vec3 shaped(vec3 p) { return p; }', fragment, ...options }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), clock, ...uniforms },
    vertexShader: `uniform float clock;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
#include <fog_pars_vertex>
${vertex}
void main() {
  vec3 p = shaped(position);
  vLocal = p;
  vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  vNormal = normal;
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform float clock;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
#include <fog_pars_fragment>
${NOISE}
${fragment}
void main() {
  gl_FragColor = shade();
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    fog: true,
    transparent: true,
    depthWrite: false,
    ...options,
  });
}

export const waterMaterial = (w, sink, surface, [left, right]) => shaded({
  uniforms: { shallow: tone('hsl(192 85% 62% / 1)'), deep: tone('hsl(214 75% 34% / 1)'), foam: tone('hsl(190 100% 94% / 1)'), halfWidth: { value: w / 2 }, sink: { value: sink }, surface: { value: +surface }, walls: { value: new THREE.Vector2(+left, +right) } },
  vertex: `${WAVE}vec3 shaped(vec3 p) { return p.y > -0.01 ? p + vec3(0.0, wave((modelMatrix * vec4(p, 1.0)).x, p.z), 0.0) : p; }`,
  fragment: `${WAVE}uniform vec3 shallow, deep, foam;
uniform float halfWidth, sink;
uniform vec2 walls;
float wall(float x) { return x < 0.0 ? walls.x : walls.y; }
vec4 shade() {
  if (vNormal.y < -0.5 || (vNormal.y > 0.5 && surface < 0.5)) discard;
  float below = wave(vWorld.x, vLocal.z) - vLocal.y, depth = sink + below, lit = 1.0 - smoothstep(0.0, 140.0, depth);
  if (abs(vNormal.x) > 0.5 && wall(vNormal.x) < 0.5) discard;
  if (abs(vNormal.x) > 0.5) {
    float seam = 1.0 - smoothstep(0.0, 3.0, min(abs(vLocal.z - 31.0), abs(vLocal.z + 31.0)));
    return vec4(mix(mix(deep, shallow, lit) * 0.72, foam, seam * 0.7), mix(0.42, 0.7, 1.0 - lit) + seam * 0.3);
  }
  if (vNormal.y > 0.5) {
    float glint = smoothstep(0.7, 0.9, noise(vec2(vWorld.x * 0.1 + clock * 0.9, vLocal.z * 0.22 - clock * 0.6)));
    return vec4(mix(shallow, foam, 0.3 + glint * 0.6), 0.35 + glint * 0.4);
  }
  vec3 colour = mix(deep, shallow, lit) + foam * caustic(vec2(vWorld.x, vLocal.y - sink + vLocal.z * 0.3) * 0.085, clock * 1.4) * (0.15 + 0.4 * lit);
  float froth = noise(vec2(vWorld.x * 0.18 - clock * 1.4, clock * 1.7));
  float lip = surface * (1.0 - smoothstep(1.4 + froth * 1.6, 3.2 + froth * 2.0, below));
  float cling = surface * wall(vLocal.x) * (1.0 - smoothstep(1.0, 3.5 + froth * 2.0, halfWidth - abs(vLocal.x))) * (1.0 - smoothstep(6.0, 30.0, below + froth * 10.0));
  float white = max(lip, cling), edge = wall(vLocal.x) * (1.0 - smoothstep(0.0, 1.6, halfWidth - abs(vLocal.x)));
  return vec4(mix(colour, foam, max(white, edge * 0.8)), max(mix(0.28, 0.55, 1.0 - lit), max(white, edge * 0.85)));
}`,
});

export const lavaMaterial = (hot, core, crust) => once(`lava:${hot}:${core}:${crust}`, () => Object.assign(shaded({
  uniforms: { hot: tone(hot), core: tone(core), crust: tone(crust) },
  fragment: `uniform vec3 hot, core, crust;
vec4 shade() {
  vec2 q = vec2(vLocal.x * 0.07 - clock * 0.32, vLocal.y * 0.14 + vLocal.z * 0.06);
  float flow = noise(q) * 0.62 + noise(q * 2.6 + vec2(clock * 0.25, -clock * 0.4)) * 0.38;
  float vein = 1.0 - smoothstep(0.015, 0.06, abs(flow - 0.5)), plate = smoothstep(0.5, 0.58, flow);
  vec3 colour = mix(mix(hot, crust, plate * 0.9), core, vein);
  return vec4(colour * (0.88 + 0.12 * sin(clock * 3.1 + vLocal.x * 0.06)), 1.0);
}`,
  transparent: false,
  depthWrite: true,
}), { userData: { bloom: true } }));

export const shimmerMaterial = css => once(`shimmer:${css}`, () => shaded({
  uniforms: { tint: tone(css) },
  fragment: `uniform vec3 tint;
vec4 shade() {
  float ripple = 0.5 + 0.5 * sin(vUv.y * 9.0 - clock * 4.0 + sin(vUv.x * 7.0 + clock * 1.3) * 1.4);
  float fade = (1.0 - vUv.y) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
  return vec4(tint, ripple * ripple * fade * 0.14);
}`,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
}));

const EDGES = {
  water: `float froth = noise(vec2(x * 0.11 - clock * 1.3, clock * 0.8)), core = 1.0 - smoothstep(0.12 + froth * 0.3, 0.5 + froth * 0.35, abs(across));
  float sparkle = step(0.86, noise(vec2(x * 0.45, clock * 3.0))) * core;
  return vec4(mix(base, bright, core * 0.8 + sparkle), core * 0.95);`,
  ash: `float flicker = noise(vec2(x * 0.05 + clock * 0.4, clock * 1.8)), core = exp(-across * across * 6.0) * (0.6 + 0.4 * flicker);
  float spark = step(0.93, hash(vec2(floor(x * 0.2), floor(clock * 5.0)))) * exp(-across * across * 3.0);
  return vec4(mix(base, bright, clamp(core * flicker * 1.3 + spark, 0.0, 1.0)), clamp(core + spark, 0.0, 1.0));`,
  fog: `float wisp = noise(vec2(x * 0.025 - clock * 0.35, across * 1.4 + clock * 0.25)) * 0.7 + noise(vec2(x * 0.07 + clock * 0.5, across * 2.0)) * 0.3;
  return vec4(mix(base, bright, wisp), exp(-across * across * 2.6) * (0.15 + 0.4 * wisp));`,
  void: `float crackle = noise(vec2(x * 0.22, clock * 7.0)), pulse = pow(fract(x * 0.0035 - clock * 0.4), 12.0);
  float core = exp(-pow(across * (5.0 - crackle * 2.5), 2.0));
  return vec4(mix(base, bright, clamp(core * 0.6 + pulse, 0.0, 1.0)), clamp(core * (0.55 + 0.45 * crackle) + pulse * exp(-across * across * 3.0), 0.0, 1.0));`,
  growth: `float cell = floor(x / 9.0), blink = step(0.55, hash(vec2(cell, 3.0))) * (0.5 + 0.5 * sin(clock * 2.4 + cell * 1.7));
  float bud = exp(-(pow(fract(x / 9.0) - 0.5, 2.0) * 50.0 + across * across * 9.0)) * blink, vine = exp(-across * across * 14.0);
  return vec4(mix(base, bright, bud), max(vine * 0.9, bud));`,
  sand: `float band = exp(-across * across * 5.0), grain = step(0.88, hash(floor(vec2(x * 0.45, across * 5.0)) + floor(clock * 7.0))) * band;
  float ripple = 0.75 + 0.25 * sin(x * 0.12 - clock * 1.5);
  return vec4(mix(base, bright, grain), clamp(band * 0.7 * ripple + grain, 0.0, 1.0));`,
};

export const edgeMaterial = (kind, base, bright, width) => once(`edge:${kind}:${base}:${bright}`, () => Object.assign(shaded({
  uniforms: { base: tone(base), bright: tone(bright), span: { value: width } },
  fragment: `uniform vec3 base, bright;
uniform float span;
vec4 shade() {
  float x = vUv.x * span, across = vUv.y * 2.0 - 1.0;
  ${EDGES[kind]}
}`,
  side: THREE.DoubleSide,
}), { userData: { bloom: true } }));

const BODIES = {
  water: 'caustic(spot * 0.05, clock * 1.2) * 0.16',
  ash: 'noise(spot * vec2(0.012, 0.02) + vec2(clock * 0.1, clock * 0.25)) * noise(spot * vec2(0.03, 0.05) - vec2(0.0, clock * 0.4)) * 0.2',
  fog: 'noise(spot * vec2(0.012, 0.03) + vec2(clock * 0.2, 0.0)) * 0.25',
  void: 'step(0.99, hash(floor(spot * 0.2))) * smoothstep(0.45, 0.1, length(fract(spot * 0.2) - 0.5)) * (0.5 + 0.5 * sin(clock * 3.0 + hash(floor(spot * 0.2) + 7.0) * 30.0))',
  growth: 'noise(spot * 0.04 + vec2(0.0, clock * 0.15)) * 0.12',
  sand: 'smoothstep(0.2, 1.0, sin(spot.x * 0.08 + spot.y * 0.25 + sin(spot.x * 0.02) * 3.0 - clock * 0.6)) * 0.1',
};

export function floodBody(material, kind, css) {
  const sheen = tone(css);
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { clock, sheen });
    shader.vertexShader = shader.vertexShader.replace('void main() {', 'varying vec2 spot;\nvoid main() {\nspot = position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform float clock;\nuniform vec3 sheen;\nvarying vec2 spot;\n${NOISE}void main() {`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat glint = ${BODIES[kind]};\ndiffuseColor.rgb = mix(diffuseColor.rgb, sheen, glint);\ndiffuseColor.a = max(diffuseColor.a, diffuseColor.a * (1.0 + glint));`);
  };
  material.customProgramCacheKey = () => `flood:${kind}`;
  return material;
}
