import { WIDTH, HEIGHT } from '../world/level.js?v=c6062ce';
import { altitudeTint } from '../art/ambience.js?v=c6062ce';
import { THREE, colorOf, rim } from './toon.js?v=c6062ce';

const SHADOW_REACH = { x: WIDTH * 0.75, y: HEIGHT * 0.75 };
const SUN_OFFSET = new THREE.Vector3(-300, 560, 640);
const DAY = { sun: 0xfff1d6, sky: 0xeaf6ff, ground: 0x7a6a50 };
const NIGHT = { sun: 0xa9bcff, sky: 0x6f7fb8, ground: 0x2a2440 };

const LAMPS = 6;
const LUMEN = 110;
const LAMP_LIFT = 26;
const LAMP_RANGE = 700;

const brightness = css => colorOf(css).getHSL({}).l;

function shown(node) {
  for (let n = node; n; n = n.parent) if (!n.visible) return false;
  return true;
}

function skyTexture(top, bottom, tint) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  for (const [from, to] of [[top, bottom], [tint.top, tint.bottom]]) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLighting(scene) {
  const sun = new THREE.DirectionalLight(DAY.sun, 2.2), hemisphere = new THREE.HemisphereLight(DAY.sky, DAY.ground, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -SHADOW_REACH.x, right: SHADOW_REACH.x, top: SHADOW_REACH.y, bottom: -SHADOW_REACH.y, near: 100, far: 2400 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target, hemisphere);
  scene.fog = new THREE.Fog(0xffffff, 1);
  const lamps = Array.from({ length: LAMPS }, () => new THREE.PointLight(0xffffff, 0, 100, 1));
  scene.add(...lamps);
  const spots = Array.from({ length: 64 }, () => new THREE.Vector3());
  let painted = null;

  return {
    mood(palette, altitude, near, far) {
      const tint = altitudeTint(Math.round(altitude / 10) * 10), faint = css => css.replace(/\/ ([\d.]+)\)$/, (_, a) => `/ ${a * 0.5})`), key = `${palette.bgTop}|${palette.bgBottom}|${tint.top}`;
      if (key === painted) return;
      painted = key;
      scene.background?.dispose();
      scene.background = skyTexture(palette.bgTop, palette.bgBottom, { top: faint(tint.top), bottom: faint(tint.bottom) });
      const night = THREE.MathUtils.clamp(1 - (brightness(palette.bgTop) + brightness(palette.bgBottom)) * 1.4, 0, 1);
      const sky = colorOf(palette.bgTop), haze = colorOf(palette.bgBottom).lerp(sky, 0.45);
      sun.color.set(DAY.sun).lerp(new THREE.Color(NIGHT.sun), night).lerp(colorOf(palette.bgBottom), 0.18);
      sun.intensity = 2.3 - night * 0.8;
      hemisphere.color.set(DAY.sky).lerp(new THREE.Color(NIGHT.sky), night).lerp(sky, 0.3);
      hemisphere.groundColor.set(DAY.ground).lerp(new THREE.Color(NIGHT.ground), night).lerp(colorOf(palette.rock), 0.3);
      hemisphere.intensity = 1.6 - night * 0.45;
      rim.color.value.copy(haze).lerp(new THREE.Color(0xffffff), 0.35 - night * 0.2);
      rim.strength.value = 0.28 + night * 0.25;
      Object.assign(scene.fog, { near, far });
      scene.fog.color.copy(haze);
    },
    follow(aim, emitters) {
      sun.position.copy(aim).add(SUN_OFFSET);
      sun.target.position.copy(aim);
      const near = emitters.filter(shown).slice(0, spots.length).map((node, k) => ({ node, at: node.getWorldPosition(spots[k]) }))
        .filter(({ at }) => Math.abs(at.y - aim.y) < LAMP_RANGE).sort((a, b) => a.at.distanceToSquared(aim) - b.at.distanceToSquared(aim));
      lamps.forEach((lamp, k) => {
        const lit = near[k];
        lamp.intensity = lit ? lit.node.userData.emitter.power * LUMEN : 0;
        if (!lit) return;
        lamp.color.setHex(lit.node.userData.emitter.color);
        lamp.distance = lit.node.userData.emitter.reach;
        lamp.position.copy(lit.at).setZ(lit.at.z + LAMP_LIFT);
      });
    },
  };
}
