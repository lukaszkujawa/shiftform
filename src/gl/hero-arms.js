import { handOf, hangSide } from '../art/rigging.js?v=7aa3937';
import { playerSize } from '../world/physics.js?v=7aa3937';
import { THREE, mesh, sphere, cylinder } from './toon.js?v=7aa3937';

const DEPTH = 5;
const UP = new THREE.Vector3(0, 1, 0);
const from = new THREE.Vector3(), to = new THREE.Vector3(), along = new THREE.Vector3();

function bone(node, [ax, ay], [bx, by], radius) {
  from.set(ax, -ay, DEPTH);
  to.set(bx, -by, DEPTH);
  along.subVectors(to, from);
  node.position.addVectors(from, to).multiplyScalar(0.5);
  node.scale.set(radius, along.length() + radius, radius);
  node.quaternion.setFromUnitVectors(UP, along.normalize());
}

const midpoint = (a, bend, b) => [(a[0] + 2 * bend[0] + b[0]) / 4, (a[1] + 2 * bend[1] + b[1]) / 4];

export function createArms() {
  const group = new THREE.Group();
  const bones = Array.from({ length: 4 }, () => new THREE.Mesh(cylinder));
  const hands = [3.2, 2.2].map(r => { const hand = mesh(sphere, null, 1); hand.scale.setScalar(r); return hand; });
  group.add(...bones, ...hands);
  group.visible = false;

  return {
    group,
    update(level, s, avatar, { ink, skin, dw, dh }) {
      group.visible = s.rope >= 0;
      if (!group.visible) return;
      const { w, h } = playerSize(level.rules), side = hangSide(level.objects[s.rope]), hand = handOf(level, s), turn = avatar.lean * s.gravDir, cos = Math.cos(turn), sin = Math.sin(turn);
      const point = (x, y) => [s.x + w / 2 + x * cos - y * sin, s.y + h / 2 + (h - dh) / 2 + x * sin + y * cos];
      const reaching = point(side * dw * 0.2, -dh * 0.46), limp = point(-side * dw * 0.46, dh * 0.02), grip = [hand.x, hand.y];
      const elbow = [(reaching[0] + grip[0]) / 2 + side * 3, (reaching[1] + grip[1]) / 2];
      const flail = Math.max(-5, Math.min(5, -s.vx * 0.9)) + Math.sin(s.frame / 7) * 1.5, end = [limp[0] + flail, limp[1] + 9];
      const sag = [limp[0] - side * 3, limp[1] + 5];
      const reachBend = midpoint(reaching, elbow, grip), limpBend = midpoint(limp, sag, end);
      [[reaching, reachBend], [reachBend, grip], [limp, limpBend], [limpBend, end]].forEach(([a, b], k) => { bone(bones[k], a, b, 1.2); bones[k].material = ink; });
      [grip, end].forEach(([x, y], k) => { hands[k].position.set(x, -y, DEPTH); hands[k].material = skin; });
    },
  };
}
