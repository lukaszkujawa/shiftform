import { WIDTH, HEIGHT } from '../world/level.js?v=85658ef';

export const FILM_COSTUME = { hat: 'tophat', face: 'handlebar', neck: 'bowtie' };

const FRAME_MS = 1000 / 18;
const SCRATCHES = 3;
const GRAIN = 260;

function frameNoise(frame) {
  let seed = (frame * 2654435761) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function gradeFilm(ctx, time) {
  const rand = frameNoise(Math.floor(time / FRAME_MS));
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = 'hsl(0 0% 50%)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `hsl(40 20% 50% / ${0.04 + rand() * 0.05})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < GRAIN; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'hsl(0 0% 0% / 0.35)' : 'hsl(0 0% 100% / 0.3)';
    ctx.fillRect(rand() * WIDTH, rand() * HEIGHT, 1.5, 1.5);
  }
  ctx.strokeStyle = 'hsl(0 0% 100% / 0.28)';
  ctx.lineWidth = 1;
  for (let i = 0; i < SCRATCHES; i++) {
    if (rand() < 0.5) continue;
    const x = rand() * WIDTH, top = rand() * HEIGHT * 0.5;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + (rand() - 0.5) * 6, top + HEIGHT * (0.3 + rand() * 0.7)); ctx.stroke();
  }
  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.35, WIDTH / 2, HEIGHT / 2, WIDTH * 0.7);
  vignette.addColorStop(0, 'hsl(0 0% 0% / 0)');
  vignette.addColorStop(1, 'hsl(0 0% 0% / 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
}
