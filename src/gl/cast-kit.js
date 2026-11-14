import { THREE, toon, glowing, mesh, shape, roundBox, sphere } from './toon.js';

export const EYE_WHITE = 'hsl(0 0% 97% / 1)';
export const INK = 'hsl(240 30% 10% / 1)';
export const ALERT = 'hsl(45 100% 60% / 1)';

export function part(geometry, css, scale, at = [0, 0, 0], outline = 0) {
  const piece = mesh(geometry, toon(css), outline);
  piece.scale.set(...scale);
  piece.position.set(...at);
  return piece;
}

export function sized(node, x, y = x, z = y) {
  node.scale.set(x, y, z);
  return node;
}

export const faded = (css, opacity) => glowing(css, Math.max(0.05, Math.round(opacity * 20) / 20));

export const lathe = (key, profile, segments = 14) => shape(`lathe:${key}`, () => new THREE.LatheGeometry(profile().reverse().map(([x, y]) => new THREE.Vector2(x, y)), segments));

export const extruded = (key, outline, depth, bevel = 1) => shape(`extrude:${key}`, () => {
  const path = new THREE.Shape();
  outline(path);
  return new THREE.ExtrudeGeometry(path, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -depth / 2);
});

export function createFace(count, size, { spread = 1, pupil = 0.5 } = {}) {
  const node = new THREE.Group(), brow = shape('brow', () => roundBox(2.1, 1, 1, 0.4));
  const eyes = Array.from({ length: count }, (_, k) => {
    const socket = new THREE.Group(), side = k < (count - 1) / 2 || count === 1 ? -1 : 1;
    socket.position.set((k - (count - 1) / 2) * size * 2.3 * spread, count === 3 && k === 1 ? size * 0.9 : 0, 0);
    const white = part(sphere, EYE_WHITE, [size, size, size * 0.6], [0, 0, 0], 0.6);
    const iris = part(sphere, INK, [size * pupil, size * pupil, size * 0.25], [0, 0, size * 0.5]);
    const frown = part(brow, INK, [size, 1.4, size * 0.5], [0, size * 1.05, size * 0.45]);
    frown.rotation.z = side * 0.25;
    socket.add(white, iris, frown);
    node.add(socket);
    return { white, iris, frown };
  });
  return {
    node,
    update(aim, open, angry) {
      for (const { white, iris, frown } of eyes) {
        white.scale.y = Math.max(0.25, size * open);
        iris.visible = open > 0.3;
        iris.position.set(aim.x * size * 0.45, -aim.y * size * 0.35, size * 0.5);
        frown.visible = angry;
      }
    },
  };
}

const SIGHT_PITCH = 8;
const SIGHT_DASHES = 64;

export function createSight() {
  const dash = shape('sight-dash', () => new THREE.CylinderGeometry(0.8, 0.8, SIGHT_PITCH / 2, 6).rotateZ(Math.PI / 2));
  const node = new THREE.InstancedMesh(dash, faded(ALERT, 1), SIGHT_DASHES);
  node.frustumCulled = false;
  const at = new THREE.Matrix4(), turn = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), spot = new THREE.Vector3();
  return {
    node,
    show(from, to, strength) {
      const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
      node.visible = length > 1;
      if (!node.visible) return;
      turn.setFromAxisAngle(spot.set(0, 0, 1), Math.atan2(-dy, dx));
      node.count = Math.min(SIGHT_DASHES, Math.floor(length / SIGHT_PITCH));
      for (let k = 0; k < node.count; k++) {
        const along = (k * SIGHT_PITCH + SIGHT_PITCH / 4) / length;
        node.setMatrixAt(k, at.compose(spot.set(from.x + dx * along, -(from.y + dy * along), 3), turn, one));
      }
      node.instanceMatrix.needsUpdate = true;
      node.material = faded(ALERT, 0.25 + 0.6 * Math.min(1, strength));
    },
    hide() { node.visible = false; },
  };
}
