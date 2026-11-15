import { overlaps } from '../world/level.js?v=3328ffe';
import { THREE, glowing, shape, sphere } from './toon.js?v=3328ffe';

const AIR = 'hsl(190 80% 94% / 1)';
const WATER = 'hsl(190 90% 88% / 1)';
const DEPTH = 34;
const SPEED = { air: 230, water: 110 };
const SWOOSH = { length: 46, width: 2.6, bend: 5 };

const swoosh = () => shape('wind-swoosh', () => {
  const ribbon = new THREE.PlaneGeometry(1, 1, 24, 1), at = ribbon.attributes.position;
  for (let k = 0; k < at.count; k++) {
    const u = at.getX(k) + 0.5, taper = Math.sin(Math.PI * u) ** 0.8;
    at.setXYZ(k, (u - 0.5) * SWOOSH.length, at.getY(k) * SWOOSH.width * taper + Math.sin(u * Math.PI * 2) * SWOOSH.bend, 0);
  }
  ribbon.computeVertexNormals();
  return ribbon;
});

const submerged = (o, level) => level.objects.some(w => w.type === 'water' && overlaps(o.x + o.w / 2 - 2, o.y + o.h / 2 - 2, 4, 4, w));

function swarm(geometry, material, count) {
  const instanced = new THREE.InstancedMesh(geometry, material, count);
  instanced.frustumCulled = false;
  return instanced;
}

export function createCurrent(o, level) {
  const vertical = o.ay !== 0, flow = vertical ? Math.sign(o.ay) : Math.sign(o.ax), wet = submerged(o, level);
  const along = vertical ? o.h : o.w, across = vertical ? o.w : o.h, css = wet ? WATER : AIR, speed = wet ? SPEED.water : SPEED.air;
  const node = new THREE.Group(), turn = new THREE.Group();
  turn.rotation.z = vertical ? (flow < 0 ? Math.PI / 2 : -Math.PI / 2) : flow < 0 ? Math.PI : 0;
  node.position.set(o.x + o.w / 2, -(o.y + o.h / 2), -4);
  node.add(turn);
  const material = glowing(css, wet ? 0.35 : 0.6);
  material.side = THREE.DoubleSide;
  const lines = swarm(swoosh(), material, Math.max(3, Math.ceil((along * across) / (wet ? 3200 : 1800))));
  const bubbles = wet ? swarm(sphere, glowing(css, 0.7), Math.ceil((along * across) / 700)) : null;
  const zone = new THREE.Mesh(new THREE.BoxGeometry(along, across, DEPTH), glowing(css, wet ? 0.03 : 0.05));
  turn.add(zone, lines, ...(bubbles ? [bubbles] : []));
  const seed = (k, n) => ({ a: (k * 97.13) % along, c: ((k * 53.7) % across) - across / 2, z: ((k * 31.3) % DEPTH) - DEPTH / 2, pace: 0.75 + ((k * 13.1) % 5) / 10, phase: k * 1.7, n });
  const pose = new THREE.Object3D();
  const place = (mesh, count, shaped, t) => {
    for (let k = 0; k < count; k++) {
      const s = seed(k, count), a = ((s.a + t * speed * s.pace) % (along + SWOOSH.length)) - (along + SWOOSH.length) / 2;
      const fade = Math.max(0, Math.min(1, (along / 2 - Math.abs(a)) / 20));
      pose.position.set(a, s.c + Math.sin(t * 2.2 + s.phase) * (wet ? 3 : 4), s.z);
      shaped(pose, fade, k);
      pose.updateMatrix();
      mesh.setMatrixAt(k, pose.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return {
    node,
    update(state, time) {
      const t = time / 1000;
      place(lines, lines.count, (pose, fade, k) => { pose.scale.set(fade * (0.8 + (k % 3) * 0.25), fade, 1); pose.rotation.set(0, 0, 0); }, t);
      if (bubbles) place(bubbles, bubbles.count, (pose, fade, k) => pose.scale.setScalar((1.1 + (k % 3) * 0.5) * fade), t * 0.8);
    },
  };
}
