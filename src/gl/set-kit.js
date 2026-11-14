import { THREE, colorOf, opacityOf, shape } from './toon.js';
import { font } from '../art/paint.js';

const PIXELS = 4;
const WHITE = 'hsl(0 0% 100% / 1)';

const canvasTexture = (w, h, paint, pixels = PIXELS) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * pixels);
  canvas.height = Math.ceil(h * pixels);
  const ctx = canvas.getContext('2d');
  ctx.scale(pixels, pixels);
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const flat = (map, css, opacity = opacityOf(css)) => new THREE.MeshBasicMaterial({ map, color: colorOf(css), transparent: true, opacity, depthWrite: false, toneMapped: false });

export function painting(key, w, h, paint, css = WHITE, pixels = PIXELS) {
  const texture = shape(`set:painting:${key}`, () => canvasTexture(w, h, paint, pixels));
  return new THREE.Mesh(shape(`set:plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)), flat(texture, css));
}

export function label(text, size, css = WHITE, weight = 900) {
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font(weight, size);
  const w = Math.ceil(measure.measureText(text).width + size * 0.6), h = Math.ceil(size * 1.5);
  return painting(`${text}:${size}:${weight}`, w, h, ctx => {
    ctx.font = font(weight, size);
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + size * 0.06);
  }, css);
}

const halo = () => shape('set:halo', () => canvasTexture(32, 32, ctx => {
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
}));

export function glow(css, radius, x = 0, y = 0, z = 0) {
  const light = new THREE.Mesh(shape('set:glow', () => new THREE.PlaneGeometry(2, 2)), flat(halo(), css));
  light.scale.setScalar(radius);
  light.position.set(x, y, z);
  light.userData.radius = radius;
  return light;
}

export function extruded(points, depth, bevel = 0.8) {
  const outline = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, -y)));
  const geometry = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

export function tube(points, radius, segments = 24) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, -y, z))), segments, radius, 6, false);
}

export const between = (a, b, t) => a + (b - a) * t;
