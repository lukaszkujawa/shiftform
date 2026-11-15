import { font } from '../art/paint.js?v=0a1f4db';
import { THREE, colorOf, opacityOf } from './toon.js?v=0a1f4db';

const PIXELS = 4;

export function createLabel(weight, size) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;
  const shown = { text: null, css: null };

  function paint(text) {
    ctx.font = font(weight, size * PIXELS);
    canvas.width = Math.ceil(ctx.measureText(text).width + 4 * PIXELS);
    canvas.height = Math.ceil(size * 1.3 * PIXELS);
    ctx.font = font(weight, size * PIXELS);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, canvas.width / 2, canvas.height);
    texture.dispose();
    texture.needsUpdate = true;
  }

  return {
    sprite,
    show(text, css, x, y, { opacity = 1, scale = 1 } = {}) {
      sprite.visible = true;
      if (text !== shown.text) { paint(text); shown.text = text; }
      if (css !== shown.css) { sprite.material.color.copy(colorOf(css)); shown.css = css; }
      sprite.material.opacity = opacityOf(css) * opacity;
      sprite.position.set(x, -y, 0);
      sprite.scale.set((canvas.width / PIXELS) * scale, (canvas.height / PIXELS) * scale, 1);
    },
    hide() { sprite.visible = false; },
  };
}
