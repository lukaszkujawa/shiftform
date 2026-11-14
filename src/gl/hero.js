import { playerSize, FALL_DAMAGE_SPEED } from '../world/physics.js?v=92c407e';
import { TILE, SOLID, ONE_WAY, tileAt } from '../world/level.js?v=92c407e';
import { moodOf } from '../art/avatar.js?v=92c407e';
import { THREE, toon, glowing, mesh, shape, mergeGeometries, roundBox, sphere, cylinder, opacityOf, tube } from './toon.js?v=92c407e';
import { BODY, EYES, MOUTH, part, cluster, mirrored } from './hero-kit.js?v=92c407e';
import { createSkin } from './hero-skin.js?v=92c407e';
import { createWardrobe } from './hero-wardrobe.js?v=92c407e';
import { createArms } from './hero-arms.js?v=92c407e';
import { createLabel } from './hero-label.js?v=92c407e';

const FLIP_FRAMES = 24;
const TALL = BODY.h + 2;
const LOOK = { eye: 'hsl(28 45% 12% / 1)', shine: 'hsl(0 0% 100% / 1)', blush: 'hsl(350 90% 72% / 1)', feet: 'hsl(28 40% 22% / 1)', mouth: 'hsl(350 60% 35% / 1)', tongue: 'hsl(355 80% 68% / 1)' };
const SHADOW_REACH = 10 * TILE;
const SNORE = 90;
const DEPTH_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false });
const SHAPES = {
  torso: () => roundBox(BODY.w, BODY.h, BODY.d, BODY.r),
  arc: () => new THREE.TorusGeometry(1, 0.3, 6, 14, Math.PI),
  bowl: () => new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
  brow: () => roundBox(4.6, 1.6, 1, 0.5),
  canopy: () => new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  antennae: () => mergeGeometries(mirrored(side => tube([[side * 3, -1], [side * 4.4, 3.5], [side * 6, 7]], 0.75))),
  blot: () => new THREE.CircleGeometry(1, 24),
};
const geometry = name => shape(`hero:${name}`, SHAPES[name]);

function groundBelow(level, x, y, g) {
  const col = Math.floor(x / TILE);
  for (let row = Math.floor(y / TILE); Math.abs(row * TILE - y) <= SHADOW_REACH; row += g) {
    const tile = tileAt(level, col, row);
    if (tile === SOLID || (tile === ONE_WAY && g > 0)) return g > 0 ? row * TILE : (row + 1) * TILE;
  }
  return null;
}

function buildFace() {
  const eyes = mirrored(side => {
    const open = cluster([part(sphere, LOOK.eye, { scale: [2, 2.6, 1.2], outline: 0 }), part(sphere, LOOK.shine, { scale: [0.7, 0.75, 0.5], at: [0.7, 0.9, 0.85], outline: 0, name: 'shine' })]);
    const happy = part(geometry('arc'), LOOK.eye, { at: [0, -0.6, 0.6], scale: [1.9, 1.9, 1.9], outline: 0 });
    const brow = part(cylinder, LOOK.eye, { scale: [0.55, 3.6, 0.55], at: [-side * 0.3, 3.6, 0.6], rot: [0, 0, side * 1.1], outline: 0 });
    return { node: cluster([open, happy, brow], { at: [side * EYES.x, EYES.y, EYES.z] }), open, happy, brow };
  });
  const mouths = {
    smile: part(geometry('arc'), LOOK.mouth, { at: [0, 0.6, 0], scale: [1.5, 1.5, 1.5], rot: [0, 0, Math.PI], outline: 0 }),
    grin: cluster([part(geometry('bowl'), LOOK.mouth, { scale: [2.3, 2.2, 0.8], outline: 0 }), part(sphere, LOOK.tongue, { scale: [1.2, 0.7, 0.5], at: [0, -1.4, 0.3], outline: 0 })], { at: [0, 0.4, 0] }),
    oh: part(sphere, LOOK.mouth, { scale: [0.9, 1.4, 0.6], outline: 0 }),
    flat: part(cylinder, LOOK.mouth, { scale: [0.45, 2.6, 0.45], rot: [0, 0, Math.PI / 2], outline: 0 }),
  };
  const mouth = cluster(Object.values(mouths), { at: [MOUTH.x, MOUTH.y, BODY.d / 2 + 0.1] });
  const brows = cluster(mirrored(side => part(geometry('brow'), LOOK.eye, { at: [side * EYES.x, EYES.y + 4.2, EYES.z - 0.4], rot: [0, 0, side * 0.08], outline: 0 })));
  const blush = mirrored(side => part(sphere, LOOK.blush, { scale: [2.4, 1.2, 0.6], at: [side * 7, -1, BODY.d / 2 - 0.3], outline: 0 }));
  return { eyes, mouths, brows, node: cluster([...eyes.map(eye => eye.node), mouth, brows, ...blush]) };
}

const canopy = () => cluster([
  part(cylinder, 'ink', { scale: [1, 14, 1], at: [0, 7, 0], outline: 0 }),
  part(geometry('canopy'), 'accent', { scale: [18, 12, 18], at: [0, 13, 0], weld: true }),
  part(sphere, 'accent', { scale: [1.6, 1.6, 1.6], at: [0, 25.5, 0] }),
]);

const antennae = () => cluster([
  part(geometry('antennae'), 'ink', { outline: 0 }),
  ...mirrored(side => part(sphere, 'ink', { scale: [1.3, 1.3, 1.3], at: [side * 6, 7, 0], outline: 0 })),
]);

export function createHero({ opacity = 1, shadow = opacity === 1 } = {}) {
  const translucent = opacity < 1;
  const group = new THREE.Group(), root = new THREE.Group(), lean = new THREE.Group(), stand = new THREE.Group(), body = new THREE.Group();
  const crown = new THREE.Group(), faceWear = new THREE.Group(), chestWear = new THREE.Group();
  const paint = (css, glow) => (glow ? glowing(css, opacityOf(css) * opacity) : toon(css, { opacity: opacityOf(css) * opacity }));
  const skin = createSkin(opacity);
  const blot = shadow ? new THREE.Mesh(geometry('blot'), new THREE.MeshBasicMaterial({ color: 0x2a1a0c, transparent: true, depthWrite: false })) : null;
  group.add(root);
  if (blot) group.add(blot);
  root.add(lean);
  lean.add(stand);
  stand.add(body, crown);
  const torso = mesh(geometry('torso'), skin.plain, 1.3);
  const face = buildFace();
  face.node.add(faceWear);
  body.add(torso, face.node, chestWear);
  body.position.y = 1.5;
  const feet = mirrored(() => part(sphere, LOOK.feet, { scale: [3.4, 2.4, 4.4] }));
  const paws = mirrored(side => { const paw = mesh(sphere, skin.plain, 1); paw.scale.setScalar(2.6); paw.userData.side = side; return paw; });
  stand.add(...feet);
  body.add(...paws);
  const glider = canopy(), feelers = antennae();
  stand.add(glider, feelers);
  const snore = createLabel(700, 16), counter = createLabel('bold', 12);
  group.add(snore.sprite, counter.sprite);
  const wardrobe = createWardrobe({ crown, face: faceWear, chest: chestWear }, finish);
  const arms = createArms();
  group.add(arms.group);
  const mouths = Object.entries(face.mouths);
  let colors = null;

  function finish(node) {
    const twins = [];
    node.traverse(piece => {
      piece.layers.mask = group.layers.mask;
      if (!translucent || !piece.isMesh || piece.userData.twin) return;
      if (piece.material?.isShaderMaterial) piece.visible = false;
      else if (opacityOf(piece.userData.color ?? '') === 1) twins.push(piece);
    });
    for (const piece of twins) {
      const twin = new THREE.Mesh(piece.geometry, DEPTH_ONLY);
      twin.userData.twin = true;
      twin.layers.mask = group.layers.mask;
      piece.add(twin);
    }
  }

  function dye(node, palette) {
    node.traverse(piece => { if (piece.userData.color) piece.material = paint(palette[piece.userData.color] ?? piece.userData.color, piece.userData.glow); });
  }

  for (const node of [face.node, ...feet]) dye(node, {});
  finish(group);

  function update(level, s, avatar, p) {
    const r = level.rules, { w, h } = playerSize(r);
    group.visible = !s.dead && s.barrel < 0;
    if (!group.visible) return;
    const size = w / BODY.w, g = s.gravDir, facing = s.facing;
    if (blot) {
      const ground = groundBelow(level, s.x + w / 2, g > 0 ? s.y + h : s.y, g);
      blot.visible = ground !== null;
      if (blot.visible) {
        const near = 1 - Math.abs(ground - (g > 0 ? s.y + h : s.y)) / SHADOW_REACH;
        blot.position.set(s.x + w / 2, -ground + g * 0.6, 0);
        blot.rotation.x = -g * Math.PI / 2;
        blot.scale.set(w * (0.35 + 0.35 * near), 7 * (0.35 + 0.35 * near), 1);
        blot.material.opacity = 0.35 * near;
      }
    }
    const stretch = Math.min(1.35, Math.max(0.6, 1 + Math.abs(s.vy) * 0.015 + avatar.squash));
    const dw = w / stretch, dh = h * stretch, wide = BODY.w / stretch, high = TALL * stretch;
    root.position.set(s.x + w / 2 + (avatar.pressed * (w - dw)) / 2, -(s.y + h / 2), 0);
    root.scale.set(size, size * g, size);
    const flip = (s.frame - s.flipFrame) / FLIP_FRAMES;
    root.rotation.z = flip >= 0 && flip < 1 && !s.grounded ? -(1 - (1 - flip) ** 2) * Math.PI * 2 * facing : 0;
    const hanging = s.rope >= 0 && !s.grounded, pivot = hanging ? 0 : -high / 2;
    lean.position.y = ((avatar.headBumped ? -1 : 1) * TALL * (stretch - 1)) / 2 + pivot;
    lean.rotation.z = -avatar.lean * g;
    stand.position.y = -pivot;
    stand.rotation.y = s.climbing ? Math.PI : facing * 0.5 + avatar.lookX * 0.15;
    body.scale.set(1 / stretch, stretch, 1 / stretch);
    const shattering = r.fallDamage && s.vy * g >= FALL_DAMAGE_SPEED - 0.6;
    const base = shattering ? p.hazard : avatar.tint ?? p.player;
    torso.material = skin.wear(base, p, avatar, shattering, s.charge || 0);
    const dressed = wardrobe.dress(avatar, r.size >= 1), tint = `${p.accent}|${p.playerInk}|${p.player}|${base}`;
    if (dressed || tint !== colors) {
      colors = tint;
      const palette = { accent: p.accent, ink: p.playerInk, player: p.player, base };
      for (const node of [glider, feelers, ...wardrobe.worn.map(item => item.node)]) dye(node, palette);
    }
    crown.position.y = high / 2 - 1;
    crown.scale.set(facing / stretch, 1 / stretch, 1 / stretch);
    crown.rotation.z = -avatar.sway * g * (avatar.hat ? 0.5 : 1);
    faceWear.scale.x = chestWear.scale.x = facing;
    wardrobe.animate({ frame: s.frame, sway: avatar.sway * g });
    glider.visible = !!r.glide && s.jumpHeld && !s.grounded && s.vy * g > 0;
    glider.position.y = feelers.position.y = high / 2;
    glider.scale.setScalar(1 / size);
    feelers.visible = r.size < 1;
    feelers.scale.setScalar(1 / size);
    face.brows.visible = r.size > 1;
    const mood = moodOf(avatar, s);
    const shut = mood !== 'joy' && (avatar.blink > 0 || mood === 'asleep'), scared = mood === 'scared' ? 1.35 : 1;
    for (const eye of face.eyes) {
      eye.open.visible = mood !== 'joy';
      eye.happy.visible = mood === 'joy';
      eye.brow.visible = mood === 'focus' && !shut;
      eye.open.scale.set(scared, scared * (shut ? 0.15 : mood === 'drowsy' ? 0.5 : 1), 1);
      eye.open.position.y = mood === 'drowsy' ? -0.6 : 0;
      eye.open.getObjectByName('shine').visible = !shut && mood !== 'focus' && mood !== 'drowsy';
    }
    face.node.position.set(avatar.lookX * 1.2, -avatar.lookY * g * 1.2, 0);
    const mouth = mood === 'joy' ? 'grin' : mood === 'scared' || mood === 'asleep' ? 'oh' : mood === 'focus' ? 'flat' : 'smile';
    for (const [name, node] of mouths) node.visible = name === mouth;
    face.mouths.oh.scale.y = mood === 'scared' ? 1.4 : 0.7;
    const walking = s.grounded || s.climbing;
    feet.forEach((foot, k) => {
      const side = k ? 1 : -1, lift = walking ? Math.max(0, Math.sin(avatar.stride + (side > 0 ? Math.PI : 0))) * 3 : 2;
      foot.position.set(side * wide * (walking ? 0.24 : 0.16), -high / 2 + 2.4 + lift, 1);
    });
    paws.forEach(paw => {
      const side = paw.userData.side, swing = walking ? Math.sin(avatar.stride + (side > 0 ? 0 : Math.PI)) * 2 : 0;
      paw.visible = s.rope < 0;
      paw.position.set(side * (BODY.w / 2 + 1.5), s.climbing ? 10 : !s.grounded ? 3 : -2 + swing * 0.5, swing);
    });
    arms.update(level, s, avatar, { ink: paint(p.playerInk), skin: skin.plain, dw, dh });
    if (mood === 'asleep') {
      const t = (avatar.still % SNORE) / SNORE;
      snore.show('z', p.text, s.x + w / 2 + 8 + t * 10, (g > 0 ? s.y : s.y + h + 20) - 14 - t * 18, { opacity: (1 - t) * opacity, scale: (10 + t * 6) / 16 });
    } else snore.hide();
    if (r.jumpBudget) counter.show(`${r.jumpBudget - s.jumpsUsed}`, p.text, s.x + w / 2, (g > 0 ? s.y : s.y + h + 14) - 6, { opacity });
    else counter.hide();
  }

  return { group, update };
}
