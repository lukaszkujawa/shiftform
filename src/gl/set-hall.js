import { WIDTH, TILE } from '../world/level.js?v=3328ffe';
import { playerSize, initialState } from '../world/physics.js?v=3328ffe';
import { buildRules } from '../world/rules.js?v=3328ffe';
import { STALLS, MERCHANT, TRAINER, DICER } from '../world/tunnel.js?v=3328ffe';
import { createAvatar } from '../art/avatar.js?v=3328ffe';
import { roundRect } from '../art/paint.js?v=3328ffe';
import { styleOf } from '../art/hall-styles.js?v=3328ffe';
import { shade, alpha } from '../art/themes.js?v=3328ffe';
import { THREE, toon, mesh, shape, roundBox, placed, merged, sphere, cylinder, createPainter } from './toon.js?v=3328ffe';
import { createHero } from './hero.js?v=3328ffe';
import { painting, label, cutout } from './set-kit.js?v=3328ffe';
import { HALL_LOOKS, C, F, WALL_Z, MARGIN } from './set-hall-styles.js?v=3328ffe';

const LIGHT = 'hsl(40 30% 96% / 1)';
const DARK = 'hsl(235 35% 4% / 1)';
const STALL = { w: 58, h: 30, roof: 62, offset: 20, front: -12, back: -36 };
const KEEPER = { offset: -28, z: -16, near: 90 };
const PROP_Z = -10;
const KEEPER_RULES = buildRules([]);
const KEEPERS = {
  [MERCHANT]: { sign: 'SHOP', outfit: { pattern: 'belly' } },
  [TRAINER]: { sign: 'SKILLS', outfit: { pattern: 'spots' } },
  [DICER]: { sign: 'DICE', color: 'hsl(275 40% 52% / 1)', outfit: { pattern: null, tint: 'hsl(255 12% 42% / 1)', top: 'tophat', glasses: 'shades' } },
};
const COLOR_OF = { [MERCHANT]: 'shop', [TRAINER]: 'gear' };
const GOLD = 'hsl(45 95% 58% / 1)';
const BOARD = 'hsl(28 25% 16% / 1)';
const POUCH = 'hsl(45 90% 55% / 1)';
const STRING = 'hsl(30 60% 30% / 1)';
const POTION = 'hsl(140 70% 55% / 1)';
const CORK = 'hsl(30 40% 45% / 1)';
const DIE = 'hsl(0 0% 96% / 1)';
const PIP = 'hsl(350 70% 40% / 1)';
const PIPS = [[[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
const FACING = [[0, 0], [Math.PI / 2, 0], [0, -Math.PI / 2], [0, Math.PI / 2], [-Math.PI / 2, 0], [0, Math.PI]].map(([rx, ry]) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)));

const box = (x0, y0, x1, y1, z0, z1, r = 1) => placed(roundBox(x1 - x0, y1 - y0, z1 - z0, r, 2), (x0 + x1) / 2, -(y0 + y1) / 2, (z0 + z1) / 2);

function die(size) {
  const body = mesh(shape(`set:die:${size}`, () => roundBox(size, size, size, size * 0.22)), toon(DIE), 0.8);
  const pips = shape(`set:pips:${size}`, () => {
    const parts = [];
    FACING.forEach((facing, face) => {
      const turn = new THREE.Matrix4().makeRotationFromQuaternion(facing.clone().invert());
      for (const [dx, dy] of PIPS[face]) parts.push(placed(sphere, dx * size * 0.26, -dy * size * 0.26, size / 2, { sx: size * 0.1, sy: size * 0.1, sz: size * 0.04 }).applyMatrix4(turn));
    });
    return merged(parts);
  });
  body.add(mesh(pips, toon(PIP), 0));
  return body;
}

const SHELL = { front: 28, back: -48, above: 60, below: 40 };

function surface(key, w, h, paint) {
  const plane = painting(key, w, h, paint, undefined, 2);
  plane.material.transparent = false;
  plane.material.depthWrite = true;
  return plane;
}

const fade = (ctx, y0, y1, from, to, span) => {
  const shading = ctx.createLinearGradient(0, y0, 0, y1);
  shading.addColorStop(0, alpha(DARK, from));
  shading.addColorStop(1, alpha(DARK, to));
  ctx.fillStyle = shading;
  ctx.fillRect(-MARGIN, y0, span, y1 - y0);
};

function shell(hall, style, look, parts) {
  const span = WIDTH + 2 * MARGIN, tall = F - C, key = hall.variant % HALL_LOOKS.length, group = new THREE.Group();
  const wall = surface(`hall-wall:${key}`, span, tall, ctx => {
    ctx.translate(MARGIN, 0);
    ctx.fillStyle = style.wall;
    ctx.fillRect(-MARGIN, 0, span, tall);
    look.wall(ctx);
    fade(ctx, 0, 30, 0.45, 0, span);
    fade(ctx, tall - 34, tall, 0, 0.3, span);
  });
  wall.position.set(WIDTH / 2, -(C + F) / 2, WALL_Z);
  const ceiling = surface(`hall-ceiling:${key}`, span, C + SHELL.above, ctx => {
    ctx.translate(MARGIN, SHELL.above);
    ctx.fillStyle = style.ceiling;
    ctx.fillRect(-MARGIN, -SHELL.above, span, C + SHELL.above);
    for (let row = 0, y = 6; y < C - 20; y += 34, row++) {
      for (let x = (row % 2) * -40 - 80; x < WIDTH + MARGIN; x += 80) {
        roundRect(ctx, x + 4, y, 72, 28, 8);
        ctx.fillStyle = `hsl(0 0% ${row % 3 ? 100 : 0}% / 0.06)`;
        ctx.fill();
      }
    }
    fade(ctx, -SHELL.above, C, 0.55, 0, span);
  });
  ceiling.position.set(WIDTH / 2, -(C - SHELL.above) / 2, SHELL.front + 0.4);
  const ground = surface(`hall-floor:${key}`, span, SHELL.below + TILE, ctx => {
    ctx.translate(MARGIN, 0);
    ctx.fillStyle = style.floor;
    ctx.fillRect(-MARGIN, 0, span, SHELL.below + TILE);
    fade(ctx, 0, SHELL.below + TILE, 0, 0.35, span);
  });
  ground.position.set(WIDTH / 2, -(F + (SHELL.below + TILE) / 2), SHELL.front + 0.4);
  group.add(wall, ceiling, ground);
  parts.add(shade(style.ceiling, -3), box(-MARGIN, -SHELL.above, WIDTH + MARGIN, C, SHELL.back, SHELL.front, 0.5));
  parts.add(style.floor, box(-MARGIN, F - 1.5, WIDTH + MARGIN, F + TILE + SHELL.below, SHELL.back, SHELL.front, 0.5));
  parts.add(style.trim, box(-MARGIN, C - 4, WIDTH + MARGIN, C, SHELL.back, SHELL.front + 2, 1.5), { outline: 1.2 });
  parts.add(style.trim, box(-MARGIN, F - 1.5, WIDTH + MARGIN, F + 3, SHELL.back, SHELL.front + 2, 1.5), { outline: 1.2 });
  parts.add(style.trim, box(-MARGIN, C, WIDTH + MARGIN, C + 5, WALL_Z, WALL_Z + 7, 1.5), { outline: 1.2 });
  parts.add(style.trim, box(-MARGIN, F - 6, WIDTH + MARGIN, F, WALL_Z, WALL_Z + 4, 1), { outline: 1 });
  return group;
}

function stall(parts, group, p, keeper, cx) {
  const left = cx - STALL.w / 2, roof = F - STALL.roof, top = F - STALL.h - 4, sw = (STALL.w + 6) / 4;
  for (const x of [left + 5, left + STALL.w - 5]) for (const z of [STALL.front - 1, STALL.back + 2]) parts.add(p.rockEdge, placed(cylinder, x, -(roof + 10 + (STALL.roof - 10) / 2), z, { sx: 2, sy: STALL.roof - 10, sz: 2 }), { outline: 0.8 });
  parts.add(shade(p.rockDeep, 8), box(left, F - STALL.h, left + STALL.w, F, STALL.back + 2, STALL.front - 2, 4), { outline: 1.3 });
  parts.add(keeper.color, box(left - 3, top, left + STALL.w + 3, top + 5, STALL.back, STALL.front, 1.5), { outline: 1.2 });
  for (let i = 0; i < 4; i++) {
    const x = left - 3 + i * sw, color = i % 2 ? LIGHT : keeper.color;
    parts.add(color, placed(roundBox(sw, 2, 26, 0.8), x + sw / 2, -(roof - 4), (STALL.front + STALL.back) / 2, { rx: Math.atan2(8, 24) }), { outline: 1 });
    const scallop = [[x, roof], [x + sw, roof], [x + sw, roof + 10], ...Array.from({ length: 7 }, (_, k) => { const t = (k + 1) / 8, u = 1 - t; return [u * u * (x + sw) + 2 * u * t * (x + sw / 2) + t * t * x, u * u * (roof + 10) + 2 * u * t * (roof + 16) + t * t * (roof + 10)]; }), [x, roof + 10]];
    parts.add(color, placed(cutout(scallop, 1.6, 0.5), 0, 0, STALL.front + 1), { outline: 0.9, weld: true });
  }
  const sign = label(keeper.sign, 10, keeper.color, 800), plank = sign.geometry.parameters.width + 4;
  parts.add(BOARD, box(cx - plank / 2, roof - 19, cx + plank / 2, roof - 5, STALL.front - 4, STALL.front + 2, 3), { outline: 1 });
  sign.position.set(cx, -(roof - 12), STALL.front + 3);
  group.add(sign);
}

function goods(parts, group, id, cx) {
  const top = F - STALL.h - 4, z = (STALL.front + STALL.back) / 2;
  if (id === MERCHANT) for (let i = 0; i < 3; i++) parts.add(GOLD, placed(cylinder, cx + 10 + (i % 2) * 1.5, -(top - 1.1 - i * 2.6), z, { sx: 6, sy: 2, sz: 6 }), { outline: 0.7 });
  if (id === TRAINER) [[4, 140], [12, 190], [20, 90]].forEach(([dx, hue]) => parts.add(`hsl(${hue} 75% 60% / 1)`, placed(new THREE.OctahedronGeometry(1, 0), cx + dx, -(top - 4.5), z, { sx: 3.5, sy: 4.5, sz: 3.5 }), { outline: 0.7 }));
  if (id === DICER) [[6, 4], [18, 2]].forEach(([dx, face]) => { const cube = die(9); cube.position.set(cx + dx, -(top - 4.5), z); cube.quaternion.copy(FACING[face]); cube.rotation.y += dx * 0.03; group.add(cube); });
}

function tumbler(node) {
  const cube = die(9);
  cube.position.set(13, 11, 0);
  node.add(cube);
  let face = 0, from = FACING[0].clone(), turned = 0;
  return time => {
    const next = Math.floor(time / 600) % 6;
    if (next !== face) { from = cube.quaternion.clone(); face = next; turned = time; }
    cube.quaternion.slerpQuaternions(from, FACING[face], Math.min(1, (time - turned) / 220));
  };
}

function pouch(node) {
  const bag = mesh(roundBox(11, 12, 10, 5), toon(POUCH), 1);
  bag.position.set(13.5, 9, 0);
  const tie = mesh(roundBox(7, 2, 7, 0.8), toon(STRING), 0);
  tie.position.set(13.5, 15, 0);
  const sign = label('$', 7, STRING);
  sign.position.set(13.5, 8, 5.4);
  node.add(bag, tie, sign);
}

function potion(node) {
  const glass = toon(POTION, { emissive: 0.2 });
  const flask = mesh(sphere, glass, 1);
  flask.scale.setScalar(6);
  flask.position.set(12, 9, 0);
  const neck = mesh(cylinder, glass, 1);
  neck.scale.set(2, 6, 2);
  neck.position.set(12, 16, 0);
  const cork = mesh(cylinder, toon(CORK), 0.8);
  cork.scale.set(2.5, 3, 2.5);
  cork.position.set(12, 19.5, 0);
  const shine = mesh(sphere, toon(LIGHT, { emissive: 0.6 }), 0);
  shine.scale.set(1.6, 1.6, 0.6);
  shine.position.set(10, 11, 5.4);
  node.add(flask, neck, cork, shine);
}

const PROPS = { [DICER]: tumbler, [MERCHANT]: pouch, [TRAINER]: potion };

function prop(id, x) {
  const node = new THREE.Group(), spin = PROPS[id](node);
  node.position.set(x, -F, PROP_Z);
  return { node, update(time) { node.position.y = -F + Math.sin(time / 500) * 1.2; spin?.(time); } };
}

function keeperOf(hall, p, keeper, x) {
  const stage = { ...hall, rules: KEEPER_RULES }, { w, h } = playerSize(KEEPER_RULES), hero = createHero(), holder = new THREE.Group();
  const pose = { ...initialState(stage), x: x - w / 2, y: F - h, grounded: true };
  const look = createAvatar('', keeper.outfit);
  holder.position.z = KEEPER.z;
  holder.add(hero.group);
  return {
    node: holder,
    update(time, player) {
      const toward = Math.sign(player.x + w / 2 - x) || 1, near = Math.abs(player.x + w / 2 - x) < KEEPER.near;
      Object.assign(pose, { facing: toward, frame: Math.floor(time / 16) });
      Object.assign(look, { lookX: toward, joy: near ? 1 : 0, sway: Math.sin(time / 700) * 0.3, squash: Math.sin(time / 450) * 0.04 });
      hero.update(stage, pose, look, p);
    },
  };
}

export function buildHall(level, p) {
  const group = new THREE.Group();
  if (!level.hall) return { group, update() {} };
  const style = styleOf(level), look = HALL_LOOKS[level.variant % HALL_LOOKS.length], parts = createPainter();
  group.add(shell(level, style, look, parts));
  const decorate = look.decor({ group, parts });
  const actors = Object.entries(STALLS).map(([id, x]) => {
    const keeper = { ...KEEPERS[id], color: KEEPERS[id].color ?? style[COLOR_OF[id]], outfit: { ...KEEPERS[id].outfit, ...style[id] } };
    stall(parts, group, p, keeper, x + STALL.offset);
    goods(parts, group, id, x + STALL.offset);
    const figure = keeperOf(level, p, keeper, x + KEEPER.offset), thing = prop(id, x + KEEPER.offset);
    group.add(figure.node, thing.node);
    return { figure, thing };
  });
  parts.build(group);
  return {
    group,
    update(state, time) {
      decorate(time);
      for (const { figure, thing } of actors) { figure.update(time, state); thing.update(time); }
    },
  };
}
