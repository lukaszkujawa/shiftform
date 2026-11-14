import { playerSize } from '../world/physics.js';
import { THREE, toon, glowing, mesh, roundBox, sphere, shape, mergeGeometries } from './toon.js';
import { BODY, roundedRect, tube } from './hero-kit.js';

const TALL = BODY.h - 1;
const DASH = 4, GAP = 3;

const dashes = () => shape('figure:architect-dashes', () => {
  const outline = roundedRect(new THREE.Shape(), -BODY.w / 2, -TALL / 2, BODY.w, TALL, BODY.r), length = outline.getLength(), count = Math.floor(length / (DASH + GAP));
  return mergeGeometries(Array.from({ length: count }, (_, k) => {
    const points = [0, 0.5, 1].map(f => outline.getPointAt(((k * length) / count + f * DASH) / length));
    return tube(points.map(({ x, y }) => [x, y, BODY.d / 2 + 0.4]), 0.75, { segments: 4 });
  }));
});

export function createArchitect(palette) {
  const group = new THREE.Group(), body = new THREE.Group();
  group.add(body);
  body.add(
    mesh(shape('figure:architect-shell', () => roundBox(BODY.w, TALL, BODY.d, BODY.r)), toon(palette.accent, { opacity: 0.22 }), 0),
    mesh(dashes(), glowing(palette.accent, 0.75), 0),
  );
  const eyes = [-1, 1].map(side => {
    const eye = mesh(sphere, glowing(palette.accent), 0);
    eye.scale.set(1.8, 1.8, 1);
    body.add(eye);
    return { eye, side };
  });

  return {
    group,
    update(level, s, time) {
      const { w, h } = playerSize(level.rules), size = w / BODY.w, bob = Math.sin(time / 180) * 1.5;
      group.position.set(s.x + w / 2, -(s.y + h / 2), 0);
      group.scale.set(size, size * s.gravDir, size);
      body.position.y = 1.5 - bob / size;
      for (const { eye, side } of eyes) eye.position.set(s.facing * BODY.w * 0.14 + side * BODY.w * 0.15, (BODY.h + 2) * 0.2 - 1.5, BODY.d / 2 + 0.6);
    },
  };
}
