import { TILE, COLS, ROWS, WIDTH, HEIGHT, SOLID, ONE_WAY, tileAt, objectRect, phaseOn, moverOffset } from './level.js';
import { playerSize, laserOn } from './physics.js';

const TAU = Math.PI * 2;

export function paletteFor(hue) {
  const h = ((hue % 360) + 360) % 360;
  const accentHue = (h + 180) % 360;
  return {
    bgTop: `hsl(${h} 32% 9%)`,
    bgBottom: `hsl(${(h + 25) % 360} 36% 15%)`,
    rock: `hsl(${h} 22% 24%)`,
    rockEdge: `hsl(${h} 28% 42%)`,
    rockDeep: `hsl(${h} 24% 18%)`,
    accent: `hsl(${accentHue} 90% 62%)`,
    accentSoft: `hsl(${accentHue} 80% 62% / 0.35)`,
    hazard: 'hsl(352 92% 60%)',
    hazardGlow: 'hsl(352 92% 60% / 0.35)',
    player: `hsl(${accentHue} 70% 94%)`,
    water: 'hsl(200 85% 55% / 0.35)',
    waterLine: 'hsl(200 90% 75% / 0.8)',
    text: 'hsl(0 0% 96%)',
    dim: 'hsl(0 0% 70%)',
    hue: h,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawStatic(level, palette) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, palette.bgTop);
  sky.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = `hsl(${palette.hue} 30% 12% / 0.6)`;
  for (let i = 0; i < 14; i++) {
    const x = (i * 193 + level.palette * 7) % WIDTH;
    const y = (i * 131 + level.palette * 3) % HEIGHT;
    ctx.beginPath();
    ctx.arc(x, y, 40 + (i % 4) * 25, 0, TAU);
    ctx.fill();
  }

  const up = level.rules.baseGravDir < 0;
  const both = level.rules.flipOnJump || level.rules.flipPeriod > 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = tileAt(level, c, r);
      if (tile === 0) continue;
      const x = c * TILE, y = r * TILE;
      ctx.fillStyle = tile === ONE_WAY ? palette.rockEdge : palette.rock;
      ctx.fillRect(x, y, TILE, tile === ONE_WAY ? 8 : TILE);
      if (tile !== SOLID) continue;
      ctx.fillStyle = palette.rockDeep;
      if (((c * 7 + r * 13 + level.palette) % 5) === 0) ctx.fillRect(x + 8, y + 12, 8, 6);
      const exposedTop = tileAt(level, c, r - 1) !== SOLID;
      const exposedBottom = tileAt(level, c, r + 1) !== SOLID;
      ctx.fillStyle = palette.rockEdge;
      if (exposedTop && (!up || both)) ctx.fillRect(x, y, TILE, 4);
      if (exposedBottom && (up || both)) ctx.fillRect(x, y + TILE - 4, TILE, 4);
      if (tileAt(level, c - 1, r) !== SOLID) ctx.fillRect(x, y, 2, TILE);
      if (tileAt(level, c + 1, r) !== SOLID) ctx.fillRect(x + TILE - 2, y, 2, TILE);
    }
  }
  return canvas;
}

function drawPlatform(ctx, palette, rect, style) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fillStyle = style;
  ctx.fill();
  ctx.fillStyle = palette.rockEdge;
  ctx.fillRect(rect.x + 3, rect.y, rect.w - 6, 3);
}

function drawObject(ctx, palette, level, o, state, time) {
  const clock = state.clock;
  switch (o.type) {
    case 'mover': {
      const rect = objectRect(o, clock);
      ctx.strokeStyle = `hsl(${palette.hue} 20% 50% / 0.35)`;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
      ctx.lineTo(o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawPlatform(ctx, palette, rect, palette.rock);
      break;
    }
    case 'conveyor': {
      drawPlatform(ctx, palette, o, palette.rock);
      ctx.fillStyle = palette.accent;
      const shift = ((clock * o.speed) % 16 + 16) % 16;
      for (let x = o.x + shift - 16; x < o.x + o.w; x += 16) {
        const x0 = Math.max(o.x, x), x1 = Math.min(o.x + o.w, x + 8);
        if (x1 > x0) ctx.fillRect(x0, o.y + 12, x1 - x0, 4);
      }
      break;
    }
    case 'phase': {
      const on = phaseOn(o, clock);
      const t = (((clock + o.phase) % o.period) + o.period) % o.period;
      const soon = on ? o.on - t < 30 : o.period - t < 30;
      if (on) {
        drawPlatform(ctx, palette, o, soon && Math.floor(time / 80) % 2 ? palette.rockDeep : palette.accentSoft);
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 2;
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = soon ? palette.accent : `hsl(${palette.hue} 20% 60% / 0.4)`;
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'crumble': {
      if (state.flags & o.bit && state.groundId !== o.id) return;
      drawPlatform(ctx, palette, o, palette.rock);
      ctx.strokeStyle = palette.rockDeep;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = o.x + 10; x < o.x + o.w; x += 22) {
        ctx.moveTo(x, o.y + 4);
        ctx.lineTo(x + 5, o.y + 14);
        ctx.lineTo(x - 2, o.y + o.h - 3);
      }
      ctx.stroke();
      break;
    }
    case 'door': {
      if (state.flags & o.bit) return;
      roundRect(ctx, o.x + 3, o.y, o.w - 6, o.h, 4);
      ctx.fillStyle = palette.accentSoft;
      ctx.fill();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, o.y + o.h / 2 - 4, 6, 0, TAU);
      ctx.fill();
      ctx.fillRect(o.x + o.w / 2 - 2, o.y + o.h / 2, 4, 12);
      break;
    }
    case 'toggle': {
      const solid = ((state.flags & o.bit) !== 0) === o.on;
      ctx.lineWidth = 2;
      if (solid) {
        drawPlatform(ctx, palette, o, palette.accentSoft);
        ctx.strokeStyle = palette.accent;
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = `hsl(${palette.hue} 20% 60% / 0.3)`;
        ctx.setLineDash([3, 7]);
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'key':
    case 'orb': {
      if (state.flags & o.bit) return;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2 + Math.sin(time / 300 + o.x) * 3;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 18;
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      if (o.type === 'orb') ctx.arc(cx, cy, 7, 0, TAU);
      else { ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 7, cy); ctx.closePath(); }
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case 'switch': {
      const pressed = (state.flags & o.bit) !== 0;
      ctx.fillStyle = palette.rockEdge;
      ctx.fillRect(o.x - 4, o.y + o.h - 6, o.w + 8, 6);
      ctx.fillStyle = pressed ? palette.dim : palette.accent;
      roundRect(ctx, o.x, o.y + (pressed ? 8 : 2), o.w, o.h - (pressed ? 14 : 8), 4);
      ctx.fill();
      break;
    }
    case 'spikes': {
      ctx.fillStyle = palette.hazard;
      ctx.beginPath();
      const n = Math.max(1, Math.round(o.w / 12));
      const tipY = o.dir < 0 ? o.y : o.y + o.h;
      const baseY = o.dir < 0 ? o.y + o.h : o.y;
      for (let i = 0; i < n; i++) {
        const x0 = o.x + (i * o.w) / n, x1 = o.x + ((i + 1) * o.w) / n;
        ctx.moveTo(x0, baseY);
        ctx.lineTo((x0 + x1) / 2, tipY);
        ctx.lineTo(x1, baseY);
      }
      ctx.fill();
      break;
    }
    case 'laser': {
      const on = laserOn(o, clock);
      const t = (((clock + o.phase) % o.period) + o.period) % o.period;
      const warming = !on && o.period - t < 24;
      const cx = o.x + o.w / 2;
      ctx.fillStyle = palette.hazard;
      ctx.beginPath();
      ctx.arc(cx, o.y + 4, 5, 0, TAU);
      ctx.arc(cx, o.y + o.h - 4, 5, 0, TAU);
      ctx.fill();
      if (on) {
        ctx.shadowColor = palette.hazard;
        ctx.shadowBlur = 16;
        ctx.fillStyle = palette.hazard;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.fillRect(cx - 1, o.y, 2, o.h);
      } else if (warming) {
        ctx.strokeStyle = palette.hazardGlow;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(cx, o.y);
        ctx.lineTo(cx, o.y + o.h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'spring': {
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const y = o.y + 2 + (i * (o.h - 4)) / 3;
        ctx.moveTo(o.x, y);
        ctx.lineTo(o.x + o.w, y);
      }
      ctx.stroke();
      ctx.fillStyle = palette.accent;
      ctx.fillRect(o.x - 2, o.dir < 0 ? o.y - 3 : o.y + o.h, o.w + 4, 3);
      break;
    }
    case 'wind': {
      ctx.strokeStyle = `hsl(${palette.hue} 40% 80% / 0.35)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < o.w / 18; i++) {
        const x = o.x + 9 + i * 18;
        const phase = (time / 6 + i * 37) % o.h;
        const y = o.ay < 0 ? o.y + o.h - phase : o.y + phase;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + (o.ay < 0 ? 14 : -14));
      }
      ctx.stroke();
      break;
    }
    case 'water': {
      ctx.fillStyle = palette.water;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = palette.waterLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = o.x; x <= o.x + o.w; x += 6) ctx.lineTo(x, o.y + Math.sin(x / 14 + time / 250) * 2);
      ctx.stroke();
      break;
    }
    case 'portal': {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time / 600);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 3;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 17, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 10, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

function drawExit(ctx, palette, level, state, time) {
  const e = level.exit;
  const locked = (state.flags & level.exitNeeds) !== level.exitNeeds;
  const pulse = 0.6 + Math.sin(time / 200) * 0.25;
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = locked ? 4 : 24 * pulse;
  ctx.fillStyle = locked ? palette.accentSoft : palette.accent;
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (locked) {
    ctx.fillStyle = palette.text;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔒', e.x + e.w / 2, e.y - 8);
  }
}

function drawPlayer(ctx, palette, level, s, alpha = 1) {
  const { w, h } = playerSize(level.rules);
  const stretch = Math.min(1.25, Math.max(0.8, 1 + Math.abs(s.vy) * 0.015));
  const dw = w / stretch, dh = h * stretch;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(s.x + w / 2, s.y + h / 2);
  if (s.gravDir < 0) ctx.scale(1, -1);
  ctx.fillStyle = palette.player;
  ctx.shadowColor = palette.player;
  ctx.shadowBlur = 10;
  roundRect(ctx, -dw / 2, -dh / 2, dw, dh, Math.min(8, dw / 3));
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = `hsl(${palette.hue} 40% 15%)`;
  const eyeX = s.facing * dw * 0.18;
  ctx.beginPath();
  ctx.arc(eyeX - dw * 0.12, -dh * 0.15, dw * 0.09, 0, TAU);
  ctx.arc(eyeX + dw * 0.12, -dh * 0.15, dw * 0.09, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cache = { level: null, layer: null, palette: null };

  function layerFor(level) {
    if (cache.level !== level) cache = { level, palette: paletteFor(level.palette), layer: drawStatic(level, paletteFor(level.palette)) };
    return cache;
  }

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    canvas.width = Math.floor(WIDTH * scale * dpr);
    canvas.height = Math.floor(HEIGHT * scale * dpr);
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${HEIGHT * scale}px`;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  function drawWorld(level, state, time, palette, layer, ghost, trail) {
    ctx.drawImage(layer, 0, 0);
    for (const o of level.objects) if (o.type === 'water' || o.type === 'wind') drawObject(ctx, palette, level, o, state, time);
    for (const o of level.objects) if (o.type !== 'water' && o.type !== 'wind') drawObject(ctx, palette, level, o, state, time);
    drawExit(ctx, palette, level, state, time);
    if (ghost) drawPlayer(ctx, palette, level, ghost, 0.35);
    const { w, h } = playerSize(level.rules);
    trail.forEach((p, i) => {
      ctx.globalAlpha = (i / trail.length) * 0.25;
      ctx.fillStyle = palette.player;
      roundRect(ctx, p.x + w * 0.2, p.y + h * 0.2, w * 0.6, h * 0.6, 4);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (!state.dead) drawPlayer(ctx, palette, level, state);
  }

  function drawParticles(particles) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawDarkness(state, level) {
    const { w, h } = playerSize(level.rules);
    const cx = state.x + w / 2, cy = state.y + h / 2;
    const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 170);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(0.6, 'rgba(0,0,0,0.85)');
    glow.addColorStop(1, 'rgba(0,0,0,0.985)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawHud(view, palette) {
    const { level, state, deaths, seed, introAge, message, controlsHint, solvedCount } = view;
    ctx.textBaseline = 'top';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = palette.dim;
    ctx.textAlign = 'left';
    ctx.fillText(`seed ${seed}  ·  level ${level.index}`, 14, 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${solvedCount} solved  ·  ${deaths} deaths  ·  ${(state.frame / 60).toFixed(1)}s`, WIDTH - 14, 12);

    const intro = Math.max(0, 1 - Math.max(0, introAge - 2200) / 600);
    if (intro > 0) {
      ctx.globalAlpha = intro;
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.text;
      ctx.font = '800 40px system-ui, sans-serif';
      ctx.fillText(level.title, WIDTH / 2, 150);
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillStyle = palette.accent;
      level.hints.forEach((hint, i) => ctx.fillText(hint, WIDTH / 2, 205 + i * 26));
      ctx.globalAlpha = 1;
    } else if (level.hints.length) {
      ctx.textAlign = 'left';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = palette.accent;
      ctx.fillText(level.title.toUpperCase(), 14, 34);
    }
    if (message) {
      ctx.textAlign = 'center';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillStyle = palette.text;
      ctx.fillText(message, WIDTH / 2, HEIGHT / 2 - 60);
    }
    if (controlsHint) {
      ctx.textAlign = 'center';
      ctx.font = '500 13px system-ui, sans-serif';
      ctx.fillStyle = palette.dim;
      ctx.fillText(controlsHint, WIDTH / 2, HEIGHT - 26);
    }
  }

  function draw(view) {
    const { level, state, time, ghost, trail, particles, flash } = view;
    const { palette, layer } = layerFor(level);
    const strobeVisible = !level.rules.strobe || (state.frame % 90) < 26 || state.frame < 90;
    ctx.save();
    if (view.shake > 0) ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    if (strobeVisible) {
      drawWorld(level, state, time, palette, layer, ghost, trail);
    } else {
      ctx.fillStyle = palette.bgTop;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      drawExit(ctx, palette, level, state, time);
      if (!state.dead) drawPlayer(ctx, palette, level, state);
    }
    drawParticles(particles);
    if (level.rules.darkness) drawDarkness(state, level);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();
    drawHud(view, palette);
  }

  function drawTransition(progress, palette) {
    ctx.fillStyle = palette.bgTop;
    const w = WIDTH * progress;
    ctx.fillRect(WIDTH - w, 0, w, HEIGHT);
  }

  return { fit, draw, drawTransition, paletteFor: level => layerFor(level).palette };
}
