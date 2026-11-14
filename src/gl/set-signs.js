import { TILE, WIDTH } from '../world/level.js?v=18026c0';
import { shopsX, climbX, styleOf } from '../art/signpost.js?v=18026c0';
import { homeOf } from '../world/home.js?v=18026c0';
import { alpha } from '../art/themes.js?v=18026c0';
import { THREE, toon, colorOf, mesh, roundBox, placed, sphere, cone, cylinder, createPainter, glowing } from './toon.js?v=18026c0';
import { label, glow, cutout, strand } from './set-kit.js?v=18026c0';

const SIGN = { post: 60, w: 78, h: 24, tip: 12 };
const UP = { angle: Math.PI / 3, rise: 36 };
const MARQUEE = { w: 96, h: 30, rise: 38, bulb: 2.2, spacing: 8, chase: 140 };
const MARQUEE_LOOK = { pole: 'hsl(240 15% 22% / 1)', face: 'hsl(345 70% 30% / 1)', rim: 'hsl(45 95% 60% / 1)', off: 'hsl(0 0% 30% / 1)', bright: 'hsl(48 100% 88% / 1)', warm: 'hsl(48 100% 70% / 1)' };
const DEPTH = { post: -18, board: -12, plank: 5 };
const FACE = DEPTH.board + DEPTH.plank / 2 + 0.8;
const box = (x0, y0, x1, y1, z, d, r = 0.8) => placed(roundBox(x1 - x0, y1 - y0, d, r, 2), (x0 + x1) / 2, -(y0 + y1) / 2, z);
const ball = (x, y, z, r, squash = 1) => placed(sphere, x, -y, z, { sx: r, sy: r * squash, sz: r });

function arrow(b, grow = 0) {
  const x0 = b.x - grow, x1 = b.x + b.w + grow, y0 = b.y - grow, y1 = b.y + b.h + grow, tip = SIGN.tip + grow * 0.6;
  return b.dir < 0
    ? [[x1, y0], [x0, y0], [x0 - tip, (y0 + y1) / 2], [x0, y1], [x1, y1]]
    : [[x0, y0], [x1, y0], [x1 + tip, (y0 + y1) / 2], [x1, y1], [x0, y1]];
}

const ORNAMENTS = {
  grain: ({ board, b }) => { for (const k of [0.33, 0.66]) board.add('hsl(26 40% 34% / 1)', box(b.x + 6, b.y + b.h * k - 0.5, b.x + b.w - 14, b.y + b.h * k + 0.5, FACE, 0.8, 0.3)); },
  rope: ({ post, s }) => { for (let y = s.floor - 20; y > s.floor - 36; y -= 4.5) post.add('hsl(40 45% 70% / 1)', placed(new THREE.TorusGeometry(4.6, 1.4, 6, 14), s.x, -y, DEPTH.post, { rx: Math.PI / 2 - 0.25 }), { outline: 0.6 }); },
  web: ({ board, b }) => {
    const x = b.x + b.w - 18, y = b.y;
    for (const a of [0.3, 0.8, 1.3]) board.add('hsl(0 0% 90% / 1)', strand([[x, y, FACE + 1], [x + Math.cos(a) * 14, y + Math.sin(a) * 14, FACE + 1]], 0.35, 2));
    board.add('hsl(0 0% 90% / 1)', strand([0.3, 0.8, 1.3].map(a => [x + Math.cos(a) * 8, y + Math.sin(a) * 8, FACE + 1]), 0.3, 6));
  },
  rivets: ({ board, b }) => { for (const [x, y] of [[b.x + 6, b.y + 5], [b.x + 6, b.y + b.h - 5], [b.x + b.w - 18, b.y + 5], [b.x + b.w - 18, b.y + b.h - 5]]) board.add('hsl(210 12% 34% / 1)', ball(x, y, FACE, 1.8, 1), { outline: 0.5 }); },
  hazard: ({ post, s }) => { for (let i = 0; i < 4; i++) post.add(i % 2 ? 'hsl(0 0% 12% / 1)' : 'hsl(48 95% 55% / 1)', placed(cylinder, s.x, -(s.floor - 23 + i * 6), DEPTH.post, { sx: 4.6, sy: 6, sz: 4.6 })); },
  neon: ({ group, b, p }) => { const halo = glow(alpha(p.accent, 0.35), 1, b.x + b.w / 2, -(b.y + b.h / 2), DEPTH.board - 4); halo.scale.set(b.w * 0.8, b.h * 1.6, 1); group.add(halo); },
  chips: ({ board, b }) => { for (const [x, y] of [[b.x + 4, b.y + 3], [b.x + b.w - 22, b.y + b.h - 6]]) board.add('hsl(30 6% 46% / 1)', box(x, y, x + 5, y + 3, FACE, 1.2, 0.4)); },
  shard: ({ post, s, p }) => { post.add(p.accent, placed(new THREE.OctahedronGeometry(1, 0), s.x, -(s.top - 11), DEPTH.post, { sx: 6, sy: 11, sz: 6 }), { outline: 1 }); },
  embers: ({ group, b, p }) => {
    const crack = mesh(strand([[b.x + 8, b.y + 4, FACE + 0.2], [b.x + 16, b.y + 12, FACE + 0.2], [b.x + 12, b.y + b.h - 3, FACE + 0.2]], 0.75, 12), glowing(p.hazard), 0);
    group.add(crack);
    return time => { crack.material.opacity = 0.7 + 0.3 * Math.sin(time / 300); };
  },
  candy: ({ post, s }) => { const tall = s.floor - s.top; post.add('hsl(350 85% 60% / 1)', strand(Array.from({ length: tall + 1 }, (_, k) => [s.x + Math.cos(k * Math.PI / 4) * 4.1, s.floor - k, DEPTH.post + Math.sin(k * Math.PI / 4) * 4.1]), 1.3, tall * 2)); },
  sprinkles: ({ board, b }) => { ['hsl(190 80% 60% / 1)', 'hsl(55 90% 60% / 1)', 'hsl(120 60% 55% / 1)'].forEach((c, i) => board.add(c, placed(roundBox(4, 1.8, 1.8, 0.8), b.x + 10 + i * 18, -(b.y + 4 + (i % 2) * 15), FACE, { rz: (i - 1) * 0.6 }))); },
  bulbs: ({ group, b }) => {
    const lamps = Array.from({ length: 5 }, (_, i) => { const bulb = mesh(sphere, glowing('hsl(0 90% 65% / 1)'), 0.6); bulb.scale.setScalar(2.4); bulb.position.set(b.x + 6 + i * ((b.w - 20) / 4), -(b.y - 2), FACE); group.add(bulb); return bulb; });
    return time => lamps.forEach((bulb, i) => bulb.material.color.setHSL(((i * 70 + time / 20) % 360) / 360, 0.9, 0.65, THREE.SRGBColorSpace));
  },
  snow: ({ board, b }) => {
    board.add('hsl(0 0% 98% / 1)', box(b.x - 2, b.y - 5, b.x + b.w - 8, b.y + 2, DEPTH.board, DEPTH.plank + 3, 3), { outline: 1 });
    for (let i = 0; i < 4; i++) board.add('hsl(195 70% 90% / 1)', placed(cone, b.x + 11 + i * 15, -(b.y + b.h + 3 + (i % 2) * 2), FACE - 1, { sx: 2.4, sy: 6 + (i % 2) * 4, sz: 2.4, rz: Math.PI }), { outline: 0.6 });
  },
  vines: ({ post, s }) => {
    post.add('hsl(120 45% 38% / 1)', strand([[s.x, s.floor, DEPTH.post + 4], [s.x + 5, s.floor - 18, DEPTH.post + 4.5], [s.x - 4, s.floor - 34, DEPTH.post + 4.5], [s.x + 3, s.top + 4, DEPTH.post + 4]], 1, 16), { outline: 0.6 });
    for (const [x, y] of [[s.x + 6, s.floor - 20], [s.x - 6, s.floor - 36]]) post.add('hsl(120 50% 45% / 1)', ball(x, y, DEPTH.post + 5, 3.5, 0.6), { outline: 0.7 });
  },
  petals: ({ group, b }) => {
    const petals = Array.from({ length: 3 }, (_, i) => { const petal = mesh(sphere, toon('hsl(340 75% 82% / 1)'), 0.6); petal.scale.set(2.8, 2, 1.4); petal.position.set(b.x + 10 + i * 22, 0, FACE + 1); group.add(petal); return petal; });
    return time => petals.forEach((petal, i) => { petal.position.y = -(b.y - 6 + Math.sin(time / 500 + i) * 2); petal.rotation.z = Math.sin(time / 700 + i) * 0.5; });
  },
  leaves: ({ group, b }) => {
    const leaves = Array.from({ length: 3 }, () => { const leaf = mesh(sphere, toon('hsl(25 85% 52% / 1)'), 0.6); leaf.scale.set(3, 1.6, 1); group.add(leaf); return leaf; });
    return time => leaves.forEach((leaf, i) => { const y = (time / 30 + i * 20) % 50; leaf.position.set(-18 + i * 16 + Math.sin(y / 8) * 4, -(b.y - 10 + y), FACE + 2); leaf.rotation.z = Math.sin(y / 6) * 0.8; });
  },
  grass: ({ post, s }) => { for (const dx of [-9, -5, 5, 9]) post.add('hsl(45 55% 55% / 1)', placed(cone, s.x + dx * 1.2, -(s.floor - 5), DEPTH.post + 4, { sx: 1.4, sy: 11, sz: 1.4, rz: -dx * 0.03 }), { outline: 0.5 }); },
  cap: ({ post, s }) => {
    post.add('hsl(355 70% 52% / 1)', placed(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), s.x, -(s.top + 2), DEPTH.post, { sx: 16, sy: 12, sz: 12 }), { outline: 1.2 });
    for (const [dx, dz] of [[-7, 6], [2, 8], [9, 4]]) post.add('hsl(0 0% 96% / 1)', ball(s.x + dx, s.top - 5 + Math.abs(dx) * 0.4, DEPTH.post + dz, 2.2, 0.8));
  },
  honey: ({ group, b }) => {
    const drip = mesh(roundBox(5, 1, 3, 1.2), toon('hsl(42 95% 55% / 1)', { emissive: 0.2 }), 0.6);
    group.add(drip);
    return time => { const length = 4 + (time / 120) % 8; drip.scale.y = length; drip.position.set(b.x + 16.5, -(b.y + b.h - 2 + length / 2), FACE - 1); };
  },
  sketch: ({ board, b, p }) => { board.add(p.ink, placed(cutout(arrow(b, 0.6), 1, 0), 1.5, 1.5, DEPTH.board - DEPTH.plank / 2 - 1.5)); },
  spine: ({ board, b }) => { for (const k of [0.18, 0.82]) board.add('hsl(45 80% 60% / 1)', box(b.x + 3, b.y + b.h * k - 1, b.x + b.w - 11, b.y + b.h * k + 1, FACE, 1, 0.4)); },
  lantern: ({ group, b }) => {
    const swing = new THREE.Group(), x = b.x + b.w / 2 - 4;
    swing.position.set(x, -(b.y + b.h), FACE - 2);
    const cord = mesh(cylinder, toon('hsl(45 80% 55% / 1)'), 0);
    cord.scale.set(0.5, 8, 0.5);
    cord.position.y = -4;
    const body = mesh(roundBox(12, 14, 12, 5), toon('hsl(5 85% 55% / 1)', { emissive: 0.35 }), 1);
    body.position.y = -15;
    swing.add(cord, body, glow('hsl(45 100% 70% / 0.35)', 12, 0, -15, 7));
    group.add(swing);
    return time => { swing.rotation.z = -Math.sin(time / 700) * 0.12; };
  },
  clouds: ({ post, s }) => { for (const [dx, r] of [[-12, 8], [0, 11], [12, 8]]) post.add('hsl(0 0% 99% / 1)', ball(s.x + dx, s.floor - 4, DEPTH.post + 3, r, 0.75), { outline: 1 }); },
  bubbles: ({ group, s }) => {
    const bubbles = Array.from({ length: 3 }, (_, i) => { const bubble = mesh(sphere, toon('hsl(190 80% 85% / 1)', { opacity: 0.55, emissive: 0.3 }), 0.5); bubble.scale.setScalar(2 + i * 0.6); group.add(bubble); return bubble; });
    return time => bubbles.forEach((bubble, i) => { const y = (time / 25 + i * 22) % 60; bubble.position.set(s.x + 10 + Math.sin(y / 9 + i) * 3, -(s.floor - 10 - y), DEPTH.post + 6); });
  },
};
const POST_ORNAMENTS = new Set(['rope', 'hazard', 'candy', 'vines', 'grass', 'cap', 'shard', 'clouds', 'bubbles']);

function sign(level, p, theme, { x, dir, text, angle = 0, overlap = SIGN.w / 2, rise = 0 }) {
  const style = styleOf(theme), floor = (level.rows - 1) * TILE, top = floor - SIGN.post - rise, joint = top + 6 + SIGN.h / 2 + rise / 2;
  const b = { x: dir > 0 ? -overlap : overlap - SIGN.w, y: -SIGN.h / 2, w: SIGN.w, h: SIGN.h, dir };
  const s = { x, floor, top };
  const group = new THREE.Group(), tilted = new THREE.Group(), post = createPainter(), board = createPainter();
  tilted.position.set(x, -joint, 0);
  tilted.rotation.z = -(angle + (style.tilt ?? 0) * dir);
  group.add(tilted);
  post.add(style.post, placed(roundBox(8, floor - top, 8, 3.5, 2), x, -(floor + top) / 2, DEPTH.post), { outline: 1.3 });
  board.add(style.board, placed(cutout(arrow(b), DEPTH.plank), 0, 0, DEPTH.board), { outline: 1.3, weld: true });
  const rim = placed(cutout(arrow(b, 2), DEPTH.plank - 1), 0, 0, DEPTH.board - 0.8);
  if (style.edge) board.add(style.edge, rim);
  else tilted.add(mesh(rim, style.ornaments.includes('neon') ? glowing(p.accent) : toon(p.ink), 0));
  const kit = { post, board, b, s, p };
  const animations = style.ornaments.map(name => ORNAMENTS[name](POST_ORNAMENTS.has(name) ? { ...kit, group } : { ...kit, group: tilted })).filter(Boolean);
  const words = label(text, 12, style.text ?? (style.edge === null && style.ornaments.includes('neon') ? p.accent : p.ink));
  words.position.set(b.x + b.w / 2 + dir * 4, -(b.y + b.h / 2 + 1), FACE + 1);
  tilted.add(words);
  post.build(group);
  board.build(tilted);
  return { group, update: time => animations.forEach(animate => animate(time)) };
}

function bulbsAround(m) {
  const spots = [], perimeter = 2 * (m.w + m.h), count = Math.floor(perimeter / MARQUEE.spacing);
  for (let i = 0; i < count; i++) {
    let d = (i / count) * perimeter;
    if (d < m.w) spots.push([m.x + d, m.y]);
    else if ((d -= m.w) < m.h) spots.push([m.x + m.w, m.y + d]);
    else if ((d -= m.h) < m.w) spots.push([m.x + m.w - d, m.y + m.h]);
    else spots.push([m.x, m.y + m.h - (d - m.w)]);
  }
  return spots;
}

function marquee(x, top) {
  const m = { x: x - MARQUEE.w / 2, y: top - MARQUEE.rise, w: MARQUEE.w, h: MARQUEE.h }, z = DEPTH.board - 2;
  const group = new THREE.Group(), parts = createPainter();
  parts.add(MARQUEE_LOOK.pole, placed(roundBox(6, MARQUEE.rise - m.h + 4, 6, 2.5), x, -(top - (MARQUEE.rise - m.h) / 2), DEPTH.post), { outline: 1 });
  parts.add(MARQUEE_LOOK.rim, placed(roundBox(m.w + 4, m.h + 4, 6, 6), x, -(m.y + m.h / 2), z - 1), { outline: 1.3 });
  parts.add(MARQUEE_LOOK.face, placed(roundBox(m.w - 2, m.h - 2, 6, 5), x, -(m.y + m.h / 2), z + 0.6));
  parts.build(group);
  const bulbs = bulbsAround(m).map(([bx, by]) => {
    const bulb = mesh(sphere, glowing(MARQUEE_LOOK.off), 0.5), halo = glow('hsl(0 100% 65% / 0.3)', MARQUEE.bulb * 2.6, bx, -by, z + 3.2);
    bulb.scale.setScalar(MARQUEE.bulb);
    bulb.position.set(bx, -by, z + 3.4);
    group.add(halo, bulb);
    return { bulb, halo };
  });
  const words = label('FREE SKILL', 13, MARQUEE_LOOK.bright);
  words.position.set(x, -(m.y + m.h / 2 + 1), z + 4.2);
  group.add(words);
  const off = colorOf(MARQUEE_LOOK.off), bright = colorOf(MARQUEE_LOOK.bright), warm = colorOf(MARQUEE_LOOK.warm);
  return {
    group,
    update(time) {
      const step = Math.floor(time / MARQUEE.chase);
      bulbs.forEach(({ bulb, halo }, i) => {
        const on = (i + step) % 3 !== 0, hue = ((i * 47 + step * 30) % 360) / 360;
        halo.visible = on;
        if (on) { bulb.material.color.setHSL(hue, 1, 0.7, THREE.SRGBColorSpace); halo.material.color.setHSL(hue, 1, 0.65, THREE.SRGBColorSpace); }
        else bulb.material.color.copy(off);
      });
      words.material.color.copy(step % 6 < 3 ? bright : warm);
    },
  };
}

export function buildSignposts(level, p, theme) {
  const group = new THREE.Group();
  if (level.hall || level.custom) return { group, update() {} };
  const x = shopsX(level), shops = sign(level, p, theme, { x, dir: x < WIDTH / 2 ? -1 : 1, text: 'SHOPS' }), free = marquee(x, (level.rows - 1) * TILE - SIGN.post);
  group.add(shops.group, free.group);
  return {
    group,
    update(state, time, level, view, current) {
      shops.update(time);
      free.group.visible = current && !!view.freeSkill;
      if (free.group.visible) free.update(time);
    },
  };
}

export function buildClimbSign(level, p, theme) {
  const group = new THREE.Group();
  if (!homeOf(level)) return { group, update() {} };
  const { x, side } = climbX(level), climb = sign(level, p, theme, { x, dir: side, text: 'CLIMB', angle: -side * UP.angle, rise: UP.rise });
  group.add(climb.group);
  return { group, update: (state, time) => climb.update(time) };
}
