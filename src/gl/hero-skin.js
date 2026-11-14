import { drawPattern } from '../art/outfit-art.js';
import { THREE, toon, colorOf } from './toon.js';
import { BODY } from './hero-kit.js';

const PIXELS = 6;
const TALL = BODY.h + 2;
const PATTERN_PASSES = 2;
const WRAPPING = new Set(['stripes', 'zigzag', 'half', 'checks']);
const CRACKS = [[[-0.3, -0.5], [-0.05, -0.1], [-0.25, 0.2], [0, 0.5]], [[0.35, -0.3], [0.1, 0], [0.3, 0.3]]];

function drawCracks(ctx, p) {
  ctx.strokeStyle = p.playerInk;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.beginPath();
  for (const line of CRACKS) line.forEach(([x, y], k) => ctx[k ? 'lineTo' : 'moveTo'](x * BODY.w, y * TALL));
  ctx.stroke();
}

export function createSkin(opacity) {
  const plain = toon('hsl(0 0% 100% / 1)', { opacity }).clone();
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  canvas.width = BODY.w * PIXELS;
  canvas.height = (TALL - 3) * PIXELS;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const printed = plain.clone();
  printed.map = texture;
  const front = [plain, plain, plain, plain, printed, plain], around = [printed, printed, plain, plain, printed, printed];
  const shown = { key: null, look: plain };
  let glow = -1;

  function print(base, p, avatar, cracked) {
    ctx.setTransform(PIXELS, 0, 0, PIXELS, (BODY.w / 2) * PIXELS, (TALL / 2) * PIXELS);
    ctx.fillStyle = base;
    ctx.fillRect(-BODY.w, -TALL, BODY.w * 2, TALL * 2);
    if (cracked) drawCracks(ctx, p);
    else for (let pass = 0; pass < PATTERN_PASSES; pass++) drawPattern(ctx, p, avatar, BODY.w, TALL);
    texture.needsUpdate = true;
  }

  return {
    plain,
    wear(base, p, avatar, cracked, charge) {
      const pattern = cracked ? 'cracks' : avatar.pattern, key = `${base}|${p.playerInk}|${pattern}`;
      if (key !== shown.key || shown.spots !== avatar.spots) {
        plain.color.copy(colorOf(base));
        if (pattern) print(base, p, avatar, cracked);
        Object.assign(shown, { key, spots: avatar.spots, look: !pattern ? plain : WRAPPING.has(pattern) ? around : front });
        glow = -1;
      }
      const lit = cracked ? 0.3 : 0.35 * charge;
      if (lit !== glow) {
        glow = lit;
        plain.emissive.copy(plain.color).multiplyScalar(lit);
        printed.emissive.copy(plain.emissive);
      }
      return shown.look;
    },
  };
}
