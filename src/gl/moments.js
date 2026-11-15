import { HEIGHT, levelIndex } from '../world/level.js?v=3328ffe';
import { playerSize } from '../world/physics.js?v=3328ffe';
import { COIN_COLOR, REFILL_COLOR } from '../art/icons.js?v=3328ffe';
import { THREE, toon, glowing, faded, mesh, shape, pebble, colorOf } from './toon.js?v=3328ffe';
import { createHero } from './hero.js?v=3328ffe';

const LANDING = { dust: 4.5, kick: 7, kickMs: 220, dustMs: 420 };
const POP_MS = 420;
const FLASH_MS = 420;
const TUMBLE_MS = 760;
const BEAM_MS = 700;
const REVEAL_MS = 2300;
const PUNCH_MS = 700;
const SPARKS = 8;

const ease = t => t * t * (3 - 2 * t);
const bell = t => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));

function pool(make) {
  const idle = [];
  return {
    take() { return idle.pop() ?? make(); },
    give(node) { node.visible = false; idle.push(node); },
  };
}

export function createMoments(scene) {
  const live = [], flash = new THREE.PointLight(0xffffff, 0, 220, 1);
  scene.add(flash);
  const ring = shape('moment-ring', () => new THREE.TorusGeometry(1, 0.16, 6, 28).rotateX(Math.PI / 2));
  const coin = shape('moment-coin', () => new THREE.CylinderGeometry(7, 7, 2.6, 24).rotateX(Math.PI / 2));
  const beam = shape('moment-beam', () => new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0));
  const added = node => { scene.add(node); return node; };
  const rings = pool(() => added(new THREE.Mesh(ring)));
  const puffs = pool(() => added(new THREE.Mesh(pebble)));
  const coins = pool(() => added(mesh(coin, toon(COIN_COLOR, { emissive: 0.35 }), 1)));
  const beams = pool(() => added(new THREE.Mesh(beam)));
  const fallen = createHero();
  fallen.group.visible = false;
  scene.add(fallen.group);
  let was = null, airborne = 0, kick = { at: -1e9, size: 0 }, reveal = -1e9, punch = -1e9, lit = { at: -1e9, color: 0xffffff, power: 0, x: 0, y: 0 }, tumble = null;

  const spawn = (node, born, life, animate, store) => live.push({ node, born, life, animate, store });

  function dust(x, y, time, palette, impact) {
    const size = Math.min(1.6, impact / 8);
    const wave = rings.take();
    wave.material = faded(palette.dim, 0.5);
    spawn(wave, time, LANDING.dustMs, (node, t) => {
      node.visible = true;
      node.position.set(x, -y, 4);
      node.scale.setScalar((8 + 26 * ease(t)) * size);
      node.material = faded(palette.dim, 0.55 * (1 - t));
    }, rings);
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1, reach = (10 + k * 4) * size, puff = puffs.take();
      spawn(puff, time, LANDING.dustMs, (node, t) => {
        node.visible = true;
        node.position.set(x + side * reach * ease(t), -(y - 3 - 6 * bell(t)), 6 - k);
        node.scale.setScalar((3 + k * 0.4) * size * (1 - t * 0.6));
        node.material = toon(palette.dim, { opacity: Math.round((1 - t) * 10) / 10 || 0.1 });
      }, puffs);
    }
  }

  function sparkle(x, y, time, css, count = SPARKS, reach = 26) {
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * Math.PI * 2, spark = puffs.take();
      spark.material = glowing(css);
      spawn(spark, time, POP_MS, (node, t) => {
        node.visible = true;
        node.position.set(x + Math.cos(angle) * reach * ease(t), -(y + Math.sin(angle) * reach * ease(t)), 8);
        node.scale.setScalar(2.2 * (1 - t));
      }, puffs);
    }
  }

  function pop(o, time) {
    const x = o.x + o.w / 2, y = o.y + o.h / 2, token = coins.take();
    spawn(token, time, POP_MS, (node, t) => {
      node.visible = true;
      node.position.set(x, -(y - 22 * ease(t)), 6);
      node.rotation.y = t * 14;
      node.scale.setScalar(t < 0.35 ? 1 + t : 1.35 * (1 - (t - 0.35) / 0.65));
    }, coins);
    sparkle(x, y, time, COIN_COLOR);
    light(time, COIN_COLOR, 0.6, x, y);
  }

  function light(time, css, power, x, y) {
    lit = { at: time, color: colorOf(css).getHex(), power, x, y };
  }

  function respawn(x, y, time, palette) {
    const shaft = beams.take();
    shaft.material = faded(palette.accent, 0.5);
    spawn(shaft, time, BEAM_MS, (node, t) => {
      node.visible = true;
      node.position.set(x, -(y + 18), 0);
      node.scale.set(14 * (1 - t * 0.5), 420 * ease(Math.min(1, t * 3)), 14 * (1 - t * 0.5));
      node.material = faded(palette.accent, 0.5 * (1 - t));
    }, beams);
    sparkle(x, y, time, palette.accentLight ?? palette.accent, 10, 34);
    light(time, palette.accent, 1.2, x, y);
  }

  function notice(view, palette, time) {
    const { state: s, level } = view, { w, h } = playerSize(level.rules), x = s.x + w / 2, feet = s.gravDir > 0 ? s.y + h : s.y;
    if (!s.grounded) airborne = Math.max(airborne, Math.abs(s.vy));
    if (!was || was.level !== level) return;
    if (s.grounded && !was.grounded && !s.dead) {
      if (airborne > LANDING.dust) dust(x, feet, time, palette, airborne);
      if (airborne > LANDING.kick) kick = { at: time, size: Math.min(7, airborne * 0.5) };
    }
    if (s.grounded) airborne = 0;
    const gained = s.coins & ~was.coins;
    if (gained) for (const o of levelIndex(level).coins) if (gained & (1 << o.slot)) pop(o, time);
    if (s.spent & ~was.spent) { light(time, REFILL_COLOR, 1.1, x, s.y + h / 2); sparkle(x, s.y + h / 2, time, REFILL_COLOR, 6, 20); }
    if (s.dashTimer > 0 && !(was.dashTimer > 0)) light(time, palette.accent, 0.9, x, s.y + h / 2);
    const fresh = (view.touched ?? []).filter(id => !was.touched.includes(id));
    for (const id of fresh) {
      const flag = level.objects[id];
      if (!flag) continue;
      light(time, palette.accent, 1.5, flag.x + 8, flag.y + 10);
      sparkle(flag.x + 8, flag.y + 10, time, palette.accent, 12, 40);
    }
    if (s.dead && !was.dead) {
      punch = time;
      tumble = { at: time, x, y: s.y + h / 2, side: s.facing || 1, state: { ...was.state, dead: false, x: -w / 2, y: -h / 2 } };
    }
    if (!s.dead && was.dead) respawn(x, feet, time, palette);
  }

  return {
    update(view, palette, time) {
      if (view.biomeIndex !== was?.biome && was && view.biomeIndex > was.biome) reveal = time;
      notice(view, palette, time);
      was = { level: view.level, biome: view.biomeIndex, grounded: view.state.grounded, coins: view.state.coins, spent: view.state.spent, dashTimer: view.state.dashTimer, dead: view.state.dead, touched: [...(view.touched ?? [])], state: view.state };
      for (let i = live.length - 1; i >= 0; i--) {
        const item = live[i], t = (time - item.born) / item.life;
        if (t >= 1 || t < 0) { item.store.give(item.node); live.splice(i, 1); continue; }
        item.animate(item.node, t);
      }
      const glow = Math.max(0, 1 - (time - lit.at) / FLASH_MS);
      flash.intensity = glow * lit.power * 110;
      flash.color.setHex(lit.color);
      flash.position.set(lit.x, -lit.y, 30);
      fallen.group.visible = !!tumble && time - tumble.at < TUMBLE_MS;
      if (fallen.group.visible) {
        const t = (time - tumble.at) / TUMBLE_MS;
        fallen.update(view.level, tumble.state, view.avatar, palette);
        fallen.group.position.set(tumble.x + tumble.side * 30 * t, -(tumble.y - 46 * Math.sin(Math.PI * t * 0.9) + 60 * t * t), 6);
        fallen.group.rotation.z = -tumble.side * t * Math.PI * 3;
        fallen.group.scale.setScalar(1 - ease(t) * 0.9);
      }
    },
    camera(time) {
      const dip = Math.max(0, 1 - (time - kick.at) / LANDING.kickMs);
      return {
        dip: kick.size * dip * dip,
        punch: bell((time - punch) / PUNCH_MS),
        reveal: bell((time - reveal) / REVEAL_MS),
        lift: HEIGHT * 0.3,
      };
    },
  };
}
