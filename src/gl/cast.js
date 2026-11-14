import { playerSize, shieldsUp } from '../world/physics.js';
import { ITEM_COLORS } from '../art/icons.js';
import { THREE, toon, mesh, shape, placed, merged, sphere, cone, cylinder, faded } from './toon.js';
import { createFire } from './fire.js';

const SHAFT = 'hsl(28 45% 14% / 1)';
const BUBBLE = 'hsl(210 90% 75% / 1)';
const FLAME = 'hsl(15 100% 55% / 1)';
const FLAME_CORE = 'hsl(45 100% 70% / 1)';

const shaftShape = () => shape('arrow-shaft', () => placed(cylinder, 0, 0, 0, { sx: 1, sy: 14, sz: 1, rz: Math.PI / 2 }));
const headShape = () => shape('arrow-head', () => merged([
  placed(cone, 8, 0, 0, { sx: 3.5, sy: 6, sz: 3.5, rz: -Math.PI / 2 }),
  ...[-1, 1].map(side => placed(cone, -6, side * 1.8, 0, { sx: 1.6, sy: 4, sz: 0.6, rz: Math.PI / 2 + side * 0.5 })),
]));

function createQuiver(group) {
  const pool = [];
  const arrowAt = k => {
    if (!pool[k]) {
      const arrow = new THREE.Group();
      arrow.add(mesh(shaftShape(), toon(SHAFT), 0.6), mesh(headShape(), toon(ITEM_COLORS.bow, { emissive: 0.2 }), 0.8));
      group.add(arrow);
      pool[k] = arrow;
    }
    return pool[k];
  };
  return flying => {
    flying.forEach((a, k) => {
      const arrow = arrowAt(k);
      arrow.visible = true;
      arrow.position.set(a.x + a.w / 2, -(a.y + a.h / 2), 2);
      arrow.rotation.z = -Math.atan2(a.vy, a.vx);
    });
    for (let k = flying.length; k < pool.length; k++) pool[k].visible = false;
  };
}

function createJet(group) {
  const jet = new THREE.Group(), flame = createFire(12, 26, { hot: 'hsl(190 100% 92% / 1)', warm: FLAME_CORE, cool: FLAME });
  flame.rotation.z = Math.PI;
  jet.add(flame);
  group.add(jet);
  return (state, time, w, h) => {
    jet.visible = !!state.jetting;
    if (!jet.visible) return;
    jet.position.set(state.x + w / 2, -(state.gravDir > 0 ? state.y + h : state.y), 0);
    jet.scale.set(1, state.gravDir, 1);
  };
}

function createBubble(group, level) {
  const { w, h } = playerSize(level.rules), reach = Math.max(w, h) * 0.85;
  const bubble = new THREE.Group(), ring = new THREE.Mesh(shape(`shield-ring:${reach}`, () => new THREE.TorusGeometry(reach, 1, 6, 40)), faded(BUBBLE, 1));
  const shell = new THREE.Mesh(sphere, faded(BUBBLE, 1));
  shell.scale.setScalar(reach);
  bubble.add(shell, ring);
  group.add(bubble);
  return (state, time) => {
    const shielded = state.shield || shieldsUp(level.rules, state) > 0;
    bubble.visible = shielded || state.invuln > 0;
    if (!bubble.visible) return;
    const strength = shielded ? 0.55 + Math.sin(time / 200) * 0.15 : state.invuln % 10 < 5 ? 0.6 : 0.1;
    bubble.position.set(state.x + w / 2, -(state.y + h / 2), 0);
    ring.material = faded(BUBBLE, strength);
    shell.material = faded(BUBBLE, strength * 0.3);
  };
}

export function build(level) {
  const group = new THREE.Group(), arrows = new THREE.Group(), powers = new THREE.Group();
  group.add(arrows, powers);
  const quiver = createQuiver(arrows), jet = createJet(powers), bubble = createBubble(powers, level);
  return {
    group,
    update(state, time, level, view, current) {
      arrows.visible = current;
      powers.visible = current && !state.dead;
      if (current) quiver(state.flying);
      if (!powers.visible) return;
      const { w, h } = playerSize(level.rules);
      jet(state, time, w, h);
      bubble(state, time);
    },
  };
}
