import { lurkerOf, BLAST_RADIUS, BITE_RISE } from '../world/lurkers.js?v=7aa3937';
import { lookOf } from '../art/monsters.js?v=7aa3937';
import { blink } from '../art/life-kit.js?v=7aa3937';
import { tint } from '../art/themes.js?v=7aa3937';
import { THREE, toon, glowing, mesh, shape, roundBox, placed, merged, sphere, pebble, cone, cylinder, EYE_WHITE, faded, PUPIL, colorOf } from './toon.js?v=7aa3937';
import { ALERT, lathe, extruded, createFace, createSight } from './cast-kit.js?v=7aa3937';
import { part, sized } from './kit.js?v=7aa3937';

const BONE = 'hsl(40 40% 84% / 1)';
const SHINE = 'hsl(0 0% 100% / 1)';
const GAZE_RANGE = 260;
const TURN = -0.35;
const VANISHING = new Set(['wraith', 'swooper']);

const coloursOf = (p, look) => {
  const fill = tint(p.hazard, look.hue, look.light);
  return { fill, shade: tint(fill, 0, -14), line: tint(fill, 0, -34) };
};

function gaze(o, m, player) {
  const dx = player.x - (m.x + o.w / 2), dy = player.y - (m.y + o.h / 2), dist = Math.hypot(dx, dy);
  return dist < GAZE_RANGE && dist > 1 ? { x: dx / dist, y: dy / dist } : { x: m.dir, y: 0.1 };
}

const facing = (aim, dir) => ({ x: aim.x * dir, y: aim.y });

function gleam(x, y, z, r = 1.6) {
  const spot = sized(new THREE.Mesh(pebble, faded(SHINE, 0.6)), r, r, r * 0.5);
  spot.position.set(x, y, z);
  return spot;
}

function spots(look, css, x, y, w, h, z) {
  const group = new THREE.Group();
  if (look.spots) for (const m of look.marks) group.add(part(pebble, css, [m.r, m.r, 0.8], [x + m.x * w, y - m.y * h, z]));
  if (look.stripes) for (let k = -1; k <= 1; k++) group.add(part(shape('stripe', () => roundBox(3, 1, 1, 0.4)), css, [1, h * 0.3, 1], [x + k * w * 0.3, y - h * 0.25, z]));
  return group;
}

const star = (points, outer, inner) => path => {
  for (let k = 0; k <= points * 2; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / points, r = k % 2 ? inner : outer;
    path[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
};

function legPairs(css, size, xs, zs, y) {
  const foot = shape(`leg:${size}`, () => roundBox(...size, 1.6));
  return xs.flatMap(x => zs.map(z => Object.assign(part(foot, css, [1, 1, 1], [x, y, z], 0.8), { userData: { side: Math.sign(x), rest: y } })));
}
const stepLegs = (legs, stride) => { for (const leg of legs) leg.position.y = leg.userData.rest - leg.userData.side * stride * 0.6; };

function squashed(o, c) {
  const node = new THREE.Group();
  node.add(sized(new THREE.Mesh(sphere, toon(c.fill, { opacity: 0.6 })), o.w * 0.65, 3.5, o.w * 0.35));
  const bar = shape('cross-bar', () => roundBox(5.6, 1.2, 1.2, 0.5));
  for (const side of [-1, 1]) for (const turn of [-1, 1]) node.add(part(bar, PUPIL, [1, 1, 1], [side * 5, -1, o.w * 0.33]).rotateZ(turn * Math.PI / 4));
  return node;
}

const dropShape = () => lathe('drop', () => [[0, 0], [1, 0], ...Array.from({ length: 9 }, (_, k) => { const s = (k + 1) / 9; return [1 - s * s, -(1.4 * s - 0.4 * s * s)]; })]);

function faller(o, look, c) {
  const node = new THREE.Group(), drop = part(dropShape(), c.fill, [1, 1, 1], [0, 0, 0], 1.2), face = createFace(2, 2.4 * look.eyeSize);
  const shine = gleam(-4, -5, 8), puddle = part(sphere, c.shade, [1, 3, 1]);
  node.add(drop, face.node, shine, puddle);
  return {
    node,
    update({ m, t, aim }) {
      node.position.set(m.x + o.w / 2, -m.y, 0);
      const splat = m.mode === 'splat';
      drop.visible = !splat;
      puddle.visible = splat;
      if (splat) {
        const spread = o.w * 0.8 * Math.max(0.2, 1 - m.age / 90);
        puddle.scale.set(spread, 3, spread * 0.5);
        puddle.position.set(0, -(o.h - 2), 0);
        face.node.visible = shine.visible = false;
        return;
      }
      const grown = m.mode === 'regrow' ? m.age / 120 : 1, falling = m.mode === 'fall', jolt = m.mode === 'shake' ? Math.sin(m.age * 2.2) * 2.5 : 0;
      const tall = (falling ? o.h + 6 : o.h) * grown, wide = (falling ? 8 : 11) * grown;
      drop.scale.set(wide, tall, wide * 0.85);
      drop.position.x = jolt;
      face.node.visible = shine.visible = grown >= 1;
      face.node.position.set(jolt, -7, wide * 0.72);
      shine.position.set(jolt - 4, -5, wide * 0.7);
      const awake = m.mode !== 'idle';
      face.update(aim, awake || Math.abs(Math.sin(t * 0.7)) > 0.92 ? 1 : 0.12, awake);
    },
  };
}

function hound(o, look, c) {
  const node = new THREE.Group(), turn = new THREE.Group(), body = new THREE.Group(), upper = new THREE.Group();
  node.add(turn);
  turn.add(body);
  body.rotation.y = TURN;
  body.add(upper);
  upper.add(part(roundBox(22, 10, 12, 4.5), c.fill, [1, 1, 1], [-3, 9.5, 0], 1.2));
  upper.add(part(sphere, c.fill, [6.5, 6, 6], [8, 13, 0.5], 1.2));
  upper.add(part(roundBox(7, 5, 7, 2.2), c.fill, [1, 1, 1], [13, 11, 0.5], 1));
  upper.add(part(pebble, PUPIL, [1.5, 1.3, 1.3], [16.4, 12, 1.5]));
  for (const z of [-2.5, 2.5]) upper.add(part(cone, c.shade, [2.6, 7, 2], [6 + z * 0.4, 20.5, z], 0.8).rotateZ(-0.3));
  upper.add(part(cone, c.fill, [2, 8, 2], [-15, 15, 0], 0.8).rotateZ(0.9));
  upper.add(spots(look, c.shade, -3, 10, o.w * 0.8, o.h * 0.5, 6));
  const fangs = new THREE.Group();
  for (const x of [11, 14]) fangs.add(part(cone, EYE_WHITE, [1.3, 3.5, 1.3], [x, 7, 3]).rotateZ(Math.PI));
  upper.add(fangs);
  const face = createFace(1, 2.4 * look.eyeSize);
  face.node.position.set(7.5, 13, 5.6);
  upper.add(face.node);
  const legs = legPairs(c.shade, [4, 5, 4], [-8, 8], [-4, 4], 2.5);
  body.add(...legs);
  return {
    node,
    update({ m, t, aim, open }) {
      const chase = m.mode === 'chase';
      node.position.set(m.x + o.w / 2, -(m.y + o.h), 0);
      turn.scale.x = m.dir;
      upper.position.y = chase ? 0 : -2;
      fangs.visible = chase;
      stepLegs(legs, chase ? Math.sin(t * 24) * 3 : 0);
      face.update(facing(aim, m.dir), m.mode === 'idle' ? 0.15 : open, chase);
    },
  };
}

const bulbShape = () => lathe('bulb', () => [
  ...Array.from({ length: 6 }, (_, k) => { const a = (k / 5) * Math.PI / 2; return [Math.sin(a), 0.2 + 0.8 * Math.cos(a)]; }),
  ...Array.from({ length: 6 }, (_, k) => { const s = (k + 1) / 6, u = 1 - s; return [u * u + 2 * u * s * 0.8, u * u * 0.2 - 2 * u * s * 0.4 - s * s]; }),
]);

const batWing = path => {
  path.moveTo(0, 2); path.lineTo(14, 8);
  path.quadraticCurveTo(11, 4, 9, 0.5); path.quadraticCurveTo(6, 0, 4.5, -2.5); path.quadraticCurveTo(2, -2, 0, -4);
  path.closePath();
};

function swooper(o, look, c) {
  const node = new THREE.Group(), body = new THREE.Group(), sight = createSight();
  node.add(body, sight.node);
  body.add(part(bulbShape(), c.fill, [8, 9, 7], [0, 0, 0], 1.2));
  for (const side of [-1, 1]) body.add(part(cone, c.fill, [2.2, 6, 2], [side * 3.5, 9.5, 0], 0.8).rotateZ(-side * 0.35));
  const wings = [-1, 1].map(side => {
    const wing = new THREE.Group();
    wing.add(part(extruded('bat-wing', batWing, 1.2, 0.5), c.shade, [1, 1, 1], [0, 0, 0], 1));
    wing.position.set(side * 4, 0, -2);
    wing.userData.side = side;
    body.add(wing);
    return wing;
  });
  body.add(part(cone, ALERT, [2, 4, 1.6], [0, -3, 6.4], 0.6).rotateZ(Math.PI));
  const face = createFace(2, 2 * look.eyeSize, { spread: 0.95 });
  face.node.position.set(0, 3, 6.2);
  body.add(face.node);
  return {
    node,
    update({ m, t, aim, open }) {
      const cx = m.x + o.w / 2, cy = m.y + o.h / 2;
      body.position.set(cx, -cy, 0);
      const spread = m.mode === 'idle' ? 0.35 : m.mode === 'dive' ? 0.75 : 1, flap = m.mode === 'dive' ? 0 : Math.sin(t * 16) * 5 * spread;
      for (const wing of wings) {
        wing.scale.x = wing.userData.side * spread;
        wing.rotation.z = wing.userData.side * Math.atan2(flap, 14);
      }
      face.update(aim, m.mode === 'idle' ? 0.15 : open, m.mode !== 'idle');
      if (m.mode === 'aim' && m.aim) sight.show({ x: cx, y: cy }, { x: m.aim.x + o.w / 2, y: m.aim.y + o.h / 2 }, m.age / 28);
      else sight.hide();
    },
  };
}

const JAW_GAPE = 11;
const jawOf = rise => path => {
  path.moveTo(3, 0); path.quadraticCurveTo(JAW_GAPE + 10, rise / 2, 2, rise); path.lineTo(JAW_GAPE * 0.6, rise / 2);
  path.closePath();
};

function snapper(o, look, c) {
  const node = new THREE.Group(), jaws = new THREE.Group(), rise = BITE_RISE + o.h, face = createFace(2, 2.2 * look.eyeSize, { spread: 1.2 });
  node.add(jaws, face.node);
  const sides = [-1, 1].map(side => {
    const jaw = new THREE.Group(), teeth = shape(`snapper-teeth:${rise}:${side}`, () => merged([1, 2, 3].map(k => placed(cone, JAW_GAPE * 0.4, (rise * k) / 4 + side * 3, 2.5, { sx: 3, sy: 7.5, sz: 2.4, rz: Math.PI / 2 }))));
    jaw.add(part(extruded(`snapper-jaw:${rise}`, jawOf(rise), 7, 1), c.fill, [1, 1, 1], [0, 0, 0], 1.2), mesh(teeth, toon(EYE_WHITE), 0.6));
    jaw.userData.side = side;
    jaws.add(jaw);
    return jaw;
  });
  return {
    node,
    update({ m, aim, open }) {
      node.position.set(m.x + o.w / 2, -(m.y + o.h), 0);
      const biting = m.mode === 'bite';
      jaws.visible = biting;
      face.node.visible = !biting;
      if (biting) {
        const gape = 8 + Math.abs(Math.sin(m.age * 0.5)) * 6;
        for (const jaw of sides) jaw.scale.x = (jaw.userData.side * gape) / JAW_GAPE;
        return;
      }
      face.node.position.set(0, m.mode === 'tell' ? 7 : 3, 0);
      face.update(aim, open, m.mode === 'tell');
    },
  };
}

const fuseCord = () => shape('bomb-fuse', () => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(2, 9, 0), new THREE.Vector3(7, 17, 0), new THREE.Vector3(3, 21, 0)), 10, 1, 5));

function bomber(o, look, c) {
  const node = new THREE.Group(), bomb = new THREE.Group(), r = o.w / 2;
  const shell = mesh(sphere, toon(c.fill), 1.2), blast = new THREE.Mesh(sphere, faded(ALERT, 1)), ring = new THREE.Mesh(shape('blast-ring', () => new THREE.TorusGeometry(1, 0.035, 6, 40)), faded(c.fill, 1));
  shell.scale.setScalar(r);
  node.add(bomb, blast, ring);
  bomb.add(shell, gleam(-4, 5, r * 0.85, 2));
  bomb.add(part(cylinder, c.line, [3, 3, 3], [2, r - 0.5, 0], 0.8));
  bomb.add(mesh(fuseCord(), toon(c.line), 0.6));
  const spark = new THREE.Group();
  spark.add(new THREE.Mesh(extruded('spark', star(4, 1, 0.35), 0.6, 0), glowing(ALERT)), sized(new THREE.Mesh(pebble, glowing(SHINE)), 0.4));
  spark.position.set(3, 22, 0);
  bomb.add(spark);
  const face = createFace(2, 2.3 * look.eyeSize);
  face.node.position.set(0, 0, r * 0.82);
  bomb.add(face.node);
  const legs = legPairs(c.shade, [5, 4, 5], [-5, 5], [0], -r + 1.5);
  node.add(...legs);
  return {
    node,
    update({ m, t, time, aim, open }) {
      const cx = m.x + o.w / 2, cy = m.y + o.h / 2, blasting = m.mode === 'blast';
      node.visible = m.mode !== 'gone';
      node.position.set(cx, -cy, 0);
      bomb.visible = !blasting;
      for (const leg of legs) leg.visible = !blasting;
      blast.visible = ring.visible = blasting;
      if (blasting) {
        const k = m.age / 10, reach = BLAST_RADIUS * (0.5 + k * 0.5);
        blast.scale.set(reach, reach, reach * 0.5);
        blast.material = faded(ALERT, 0.8 * (1 - k));
        ring.scale.setScalar(reach);
        ring.material = faded(c.fill, 1 - k);
        return;
      }
      const lit = m.mode === 'fuse', hot = lit && Math.floor(m.age / 5) % 2 === 0;
      bomb.scale.setScalar(lit ? 1 + (m.age / 42) * 0.25 : 1);
      shell.material = toon(hot ? ALERT : c.fill);
      spark.visible = m.mode !== 'idle';
      spark.scale.setScalar(2 + Math.sin(time / 40));
      spark.rotation.z = time / 60;
      stepLegs(legs, m.mode === 'walk' ? Math.sin(t * 18) * 2.5 : 0);
      face.update(aim, m.mode === 'idle' ? 0.2 : open, lit);
    },
  };
}

function charger(o, look, c) {
  const node = new THREE.Group(), turn = new THREE.Group(), body = new THREE.Group();
  node.add(turn);
  turn.add(body);
  body.rotation.y = TURN;
  body.add(part(roundBox(30, 16, 18, 6), c.fill, [1, 1, 1], [0, 0, 0], 1.3));
  body.add(part(roundBox(9, 10, 14, 4), c.shade, [1, 1, 1], [13, -2, 0], 1.1));
  body.add(part(cone, BONE, [3.6, 12.5, 3.6], [15, 10, 2], 1).rotateZ(-0.73));
  body.add(part(cone, BONE, [2.2, 6, 2.2], [9, 10, 2], 0.8).rotateZ(-0.4));
  for (const z of [-5.5, 5.5]) body.add(part(cone, c.shade, [2.4, 5, 1.8], [2, 9.5, z], 0.8).rotateZ(0.35));
  body.add(part(cone, c.line, [1.4, 6, 1.4], [-16.5, 2, 0], 0.6).rotateZ(1.1));
  body.add(spots(look, c.shade, -4, 4, o.w * 0.5, o.h * 0.4, 9.2));
  const face = createFace(1, 2.6 * look.eyeSize);
  face.node.position.set(8, 1, 9.3);
  body.add(face.node);
  const legs = legPairs(c.shade, [5, 6, 5], [-10, 10], [-5, 5], -8.5);
  body.add(...legs);
  const dizzy = Array.from({ length: 3 }, () => {
    const twinkle = mesh(extruded('dizzy-star', star(5, 2.4, 1.1), 1, 0.3), toon(ALERT, { emissive: 0.4 }), 0.6);
    node.add(twinkle);
    return twinkle;
  });
  return {
    node,
    update({ m, t, time, aim, open }) {
      const stun = m.mode === 'stun';
      node.position.set(m.x + o.w / 2, -(m.y + o.h / 2), 0);
      turn.scale.x = m.dir;
      stepLegs(legs, m.mode === 'charge' ? Math.sin(t * 28) * 3 : m.mode === 'paw' ? Math.sin(t * 18) * 2 : 0);
      dizzy.forEach((twinkle, k) => {
        const a = time / 200 + (k * Math.PI * 2) / 3;
        twinkle.visible = stun;
        twinkle.position.set(Math.cos(a) * 10, 13, Math.sin(a) * 10);
        twinkle.rotation.z = time / 150;
      });
      face.update(facing(aim, m.dir), stun ? 0.2 : open, !stun);
    },
  };
}

const stalkShape = () => lathe('sniper-stalk', () => [...Array.from({ length: 8 }, (_, k) => { const s = 1 - k / 7, u = 1 - s; return [u * u * 11 + 2 * u * s * 3 + s * s * 2, 2 * u * s * 8 + s * s * 15]; }), [0, 0]]);

function sniper(o, look, c) {
  const node = new THREE.Group(), stalk = new THREE.Group(), eye = new THREE.Group(), sight = createSight(), bolt = new THREE.Group();
  node.add(stalk, sight.node, bolt);
  stalk.add(part(stalkShape(), c.fill, [1, 1, 1], [0, 0, 0], 1.2), eye);
  eye.position.y = 15;
  eye.add(part(sphere, EYE_WHITE, [7.5, 7.5, 7.5], [0, 0, 0], 1.1));
  const iris = part(sphere, c.fill, [3.6, 3.6, 1.2], [0, 0, 7.1]);
  eye.add(iris, part(sphere, PUPIL, [1.8, 1.8, 0.8], [0, 0, 8]), gleam(-2.5, 2.5, 7.4, 1.2));
  const halo = new THREE.Mesh(pebble, faded(ALERT, 0.4));
  bolt.add(halo, sized(new THREE.Mesh(sphere, glowing(ALERT)), 4.5));
  return {
    node,
    update({ m, time, player }) {
      const cx = m.x + o.w / 2, eyeAt = { x: cx, y: m.y + 7 }, aiming = m.mode === 'aim', target = aiming && m.aim ? m.aim : player;
      stalk.position.set(cx, -(m.y + o.h), 0);
      const dx = target.x - eyeAt.x, dy = target.y - eyeAt.y, d = Math.hypot(dx, dy) || 1;
      eye.rotation.set((dy / d) * 0.42, (dx / d) * 0.42, 0);
      iris.material = toon(aiming && m.age > 40 ? ALERT : c.fill);
      if (aiming && m.aim) sight.show(eyeAt, m.aim, m.age / 55);
      else sight.hide();
      bolt.visible = !!m.bolt;
      if (!m.bolt) return;
      bolt.position.set(m.bolt.x + 5, -(m.bolt.y + 5), 2);
      halo.scale.setScalar(8 + Math.sin(time / 50));
    },
  };
}

const ghostShape = () => lathe('ghost', () => {
  const dome = new THREE.CubicBezierCurve(new THREE.Vector2(-11, -26), new THREE.Vector2(-11, 5), new THREE.Vector2(11, 5), new THREE.Vector2(11, -26)).getPoints(24).slice(12);
  return [...dome.map(v => [v.x, v.y]), [7, -27], [0, -25]];
}, 18);

const ECTOPLASM = {
  vertexShader: 'varying vec3 vNormalView; varying vec3 vView; void main() { vec4 seen = modelViewMatrix * vec4(position, 1.0); vNormalView = normalize(normalMatrix * normal); vView = -seen.xyz; gl_Position = projectionMatrix * seen; }',
  fragmentShader: 'uniform vec3 tone; uniform float presence; varying vec3 vNormalView; varying vec3 vView; void main() { float rim = pow(clamp(1.0 - abs(dot(normalize(vNormalView), normalize(vView))), 0.0, 1.0), 2.2); vec3 colour = mix(tone * 0.9, vec3(1.0), rim * 0.55); gl_FragColor = vec4(colour, (0.16 + rim * 0.8) * presence); }',
};
const ectoplasm = new Map();
const GHOST_DEPTH = new THREE.MeshBasicMaterial({ colorWrite: false });
const ghostly = (css, presence) => {
  const key = `${css}|${presence}`;
  if (!ectoplasm.has(key)) ectoplasm.set(key, new THREE.ShaderMaterial({ ...ECTOPLASM, uniforms: { tone: { value: colorOf(css) }, presence: { value: presence } }, transparent: true, depthWrite: false }));
  return ectoplasm.get(key);
};

function wraith(o, look, c) {
  const node = new THREE.Group(), veil = tint(c.fill, 0, 34), face = createFace(2, 2.6 * look.eyeSize);
  const skin = presence => ghostly(veil, presence);
  const shroud = new THREE.Mesh(ghostShape(), skin(1));
  const hem = Array.from({ length: 12 }, (_, k) => {
    const a = (k / 12) * Math.PI * 2, lobe = new THREE.Mesh(sphere, shroud.material);
    lobe.scale.set(3.1, 4.4, 3.1);
    lobe.userData = { k, x: Math.sin(a) * 8.6, z: Math.cos(a) * 8.6 };
    return lobe;
  });
  const hands = [-1, 1].map(side => part(sphere, c.line, [4.5, 3.4, 2], [side * 4.5, -9, 10.8]));
  const mouth = part(sphere, PUPIL, [3, 3.5, 1], [0, -16, 10.2]);
  face.node.position.set(0, -9, 10);
  const masks = [shroud, ...hem].map(piece => Object.assign(new THREE.Mesh(piece.geometry, GHOST_DEPTH), { userData: piece.userData }));
  masks[0].scale.copy(shroud.scale);
  for (const [k, lobe] of hem.entries()) masks[k + 1].scale.copy(lobe.scale);
  node.add(shroud, ...hem, ...masks, ...hands, mouth, face.node);
  return {
    node,
    update({ m, t, time, aim }) {
      const shy = m.mode === 'shy', hunt = m.mode === 'hunt';
      node.position.set(m.x + o.w / 2 + Math.sin(time / 500) * 2, -m.y, 0);
      shroud.material = skin(shy ? 0.55 : 1);
      for (const lobe of hem) {
        lobe.material = shroud.material;
        lobe.position.set(lobe.userData.x, -25 + Math.sin(t * 5 + lobe.userData.k * 0.9) * 2.2, lobe.userData.z);
      }
      hem.forEach((lobe, k) => masks[k + 1].position.copy(lobe.position));
      for (const hand of hands) hand.visible = shy;
      face.node.visible = !shy;
      mouth.visible = hunt;
      mouth.scale.y = 3.5 + Math.sin(t * 4);
      face.update(aim, 1, hunt);
    },
  };
}

const KINDS = { faller, hound, swooper, snapper, bomber, charger, sniper, wraith };

export function lurker(o, p) {
  const look = lookOf(o), kind = KINDS[o.kind](o, look, coloursOf(p, look)), corpse = squashed(o, coloursOf(p, look));
  const node = new THREE.Group();
  node.add(kind.node, corpse);
  return {
    node,
    update(state, time, level, view) {
      const m = lurkerOf(o, state), t = (time / 1000) * look.tempo + look.phase;
      kind.node.visible = !m.dead;
      corpse.visible = m.dead && !VANISHING.has(o.kind);
      if (m.dead) {
        corpse.position.set(m.x + o.w / 2, -(m.y + o.h - 2), 0);
        return;
      }
      kind.update({ m, t, time, aim: gaze(o, m, view.player), open: blink(t, look.phase), player: view.player });
    },
  };
}
