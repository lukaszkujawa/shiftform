import { THREE, toon, mesh, mergeGeometries } from './toon.js';
import { mergeVertices } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

export const BODY = { w: 20, h: 24, d: 16, r: 7 };
export const CROWN = BODY.h / 2 - 1;
export const EYES = { x: 3.6, y: 3, z: BODY.d / 2 + 0.2 };
export const MOUTH = { x: 0, y: -2.5 };
export const NECK = -5.8;

export const HUE = {
  gold: 'hsl(48 95% 60% / 1)', white: 'hsl(0 0% 98% / 1)', red: 'hsl(355 80% 55% / 1)', pink: 'hsl(340 85% 78% / 1)', brown: 'hsl(28 50% 38% / 1)',
  straw: 'hsl(42 70% 66% / 1)', steel: 'hsl(210 10% 70% / 1)', ivory: 'hsl(40 40% 92% / 1)', purple: 'hsl(270 55% 45% / 1)', blue: 'hsl(215 70% 50% / 1)',
  hair: 'hsl(25 45% 30% / 1)', stem: 'hsl(120 45% 35% / 1)', sprout: 'hsl(110 60% 50% / 1)', hardhat: 'hsl(48 100% 55% / 1)', bulb: 'hsl(52 100% 68% / 1)',
};
export const PETALS = ['hsl(340 85% 70% / 1)', 'hsl(48 95% 65% / 1)', 'hsl(200 85% 70% / 1)', 'hsl(280 70% 75% / 1)'];

const BLANK = toon('hsl(0 0% 100% / 1)');

export function part(geometry, color, { at = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], outline = 1, glow = false, weld = false, name = '' } = {}) {
  const piece = mesh(geometry, BLANK, outline, { weld });
  piece.position.set(...at);
  piece.scale.set(...scale);
  piece.rotation.set(...rot);
  piece.name = name;
  Object.assign(piece.userData, { color, glow });
  return piece;
}

export function cluster(parts, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], name = '' } = {}) {
  const node = new THREE.Group();
  node.add(...parts.filter(Boolean));
  node.position.set(...at);
  node.rotation.set(...rot);
  node.scale.set(...scale);
  node.name = name;
  return node;
}

export const mirrored = make => [-1, 1].map(side => make(side));

export function surfaceZ(x, y) {
  const ex = Math.max(0, Math.abs(x) - (BODY.w / 2 - BODY.r)), ey = Math.max(0, Math.abs(y) - (BODY.h / 2 - BODY.r));
  return BODY.d / 2 - BODY.r + Math.sqrt(Math.max(0, BODY.r ** 2 - ex * ex - ey * ey));
}

export const onSkin = (x, y, lift = 0.6) => [x, y, surfaceZ(x, y) + lift];

function refine(geometry, most) {
  let points = [], at = (geometry.index ? geometry.toNonIndexed() : geometry).attributes.position, longest = 0;
  for (let k = 0; k < at.count; k++) points.push(new THREE.Vector3().fromBufferAttribute(at, k));
  for (let k = 0; k < points.length; k += 3) longest = Math.max(longest, points[k].distanceTo(points[k + 1]), points[k + 1].distanceTo(points[k + 2]), points[k + 2].distanceTo(points[k]));
  for (; longest > most; longest /= 2) {
    const finer = [];
    for (let k = 0; k < points.length; k += 3) {
      const [a, b, c] = points.slice(k, k + 3), ab = a.clone().lerp(b, 0.5), bc = b.clone().lerp(c, 0.5), ca = c.clone().lerp(a, 0.5);
      finer.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    points = finer;
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

export function hug(geometry, lift = 0.6) {
  const fine = mergeVertices(refine(geometry, 1.6)), at = fine.attributes.position;
  for (let k = 0; k < at.count; k++) at.setZ(k, surfaceZ(at.getX(k), at.getY(k)) + lift + at.getZ(k));
  fine.computeVertexNormals();
  return fine;
}

export function bezier([ax, ay], [cx, cy], [bx, by], steps = 8) {
  return Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps, u = 1 - t;
    return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by];
  });
}

export const curve = points => new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)));

export const tube = (points, radius, { closed = false, segments = 24 } = {}) => new THREE.TubeGeometry(closed ? new THREE.CatmullRomCurve3(curve(points).points, true) : curve(points), segments, radius, 6, closed);

export function horn(points, radius, tip = 0.15, segments = 20) {
  const path = curve(points), geometry = new THREE.TubeGeometry(path, segments, radius, 10), at = geometry.attributes.position, ring = 11;
  const centre = new THREE.Vector3(), point = new THREE.Vector3();
  for (let k = 0; k < at.count; k++) {
    const step = Math.floor(k / ring), taper = 1 - (1 - tip) * (step / segments);
    path.getPointAt(step / segments, centre);
    point.fromBufferAttribute(at, k).sub(centre).multiplyScalar(taper).add(centre);
    at.setXYZ(k, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function slab(draw, depth = 1.2, bevel = 0.4) {
  const outline = new THREE.Shape();
  draw(outline);
  return new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12 }).translate(0, 0, -depth / 2);
}

export function rim(draw, radius = 0.55) {
  const outline = new THREE.Shape();
  draw(outline);
  return tube(outline.getPoints(10).map(({ x, y }) => [x, y]), radius, { closed: true, segments: 48 });
}

export function roundedRect(path, x, y, w, h, r) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

export function star(path, x, y, r) {
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r * 0.45 : r;
    path[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  return path;
}

export function heart(path, x, y, r) {
  path.moveTo(x, y - r);
  path.bezierCurveTo(x - r * 1.6, y + r * 0.2, x - r * 0.6, y + r * 1.4, x, y + r * 0.4);
  path.bezierCurveTo(x + r * 0.6, y + r * 1.4, x + r * 1.6, y + r * 0.2, x, y - r);
  return path;
}

export function band(y, height, gap = 0.6) {
  const ey = Math.max(0, Math.abs(y) - (BODY.h / 2 - BODY.r)), r = Math.sqrt(Math.max(1, BODY.r ** 2 - ey * ey)) + gap;
  const hx = BODY.w / 2 - BODY.r + r, hz = BODY.d / 2 - BODY.r + r;
  const outline = roundedRect(new THREE.Shape(), -hx, -hz, hx * 2, hz * 2, r);
  return new THREE.ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 8 }).rotateX(Math.PI / 2).translate(0, y + height / 2, 0);
}

export function daisy(petal, r) {
  const petals = Array.from({ length: 5 }, (_, k) => {
    const a = (k * Math.PI * 2) / 5;
    return new THREE.SphereGeometry(r * 0.75, 8, 6).scale(1, 1, 0.5).translate(Math.cos(a) * r, Math.sin(a) * r, 0);
  });
  return cluster([part(mergeGeometries(petals), petal, { outline: 0.8 }), part(new THREE.SphereGeometry(r * 0.6, 8, 6).scale(1, 1, 0.7), HUE.gold, { at: [0, 0, r * 0.3], outline: 0 })]);
}
