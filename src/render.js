import { TILE, COLS, ROWS, WIDTH, HEIGHT, SOLID, ONE_WAY, tileAt, objectRect, phaseOn, floodLevel } from './level.js';
import { playerSize, laserOn } from './physics.js';
import { themeFor } from './themes.js';

const TAU = Math.PI * 2;

const alpha = (color, a) => color.replace(/\/ [\d.]+\)$/, `/ ${a})`);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function seededNoise(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const BACKGROUNDS = {
  grid(ctx, p, rand) {
    ctx.strokeStyle = alpha(p.ink, 0.08);
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    const glow = ctx.createRadialGradient(WIDTH * rand(), HEIGHT * rand(), 20, WIDTH / 2, HEIGHT / 2, 700);
    glow.addColorStop(0, alpha(p.accent, 0.18));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  },
  ruled(ctx, p, rand) {
    ctx.strokeStyle = 'hsl(205 60% 70% / 0.35)';
    ctx.lineWidth = 1;
    for (let y = 36; y < HEIGHT; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    ctx.strokeStyle = 'hsl(0 70% 60% / 0.4)';
    ctx.beginPath(); ctx.moveTo(70, 0); ctx.lineTo(70, HEIGHT); ctx.stroke();
    ctx.fillStyle = 'hsl(40 40% 60% / 0.12)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * rand(), 1 + rand() * 2, 0, TAU); ctx.fill(); }
  },
  rays(ctx, p, rand) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = p.rockEdge;
    for (let i = 0; i < 9; i++) {
      const x = -200 + i * 170 + rand() * 60;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 330, HEIGHT); ctx.lineTo(x + 200, HEIGHT); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  blobs(ctx, p, rand) {
    for (let i = 0; i < 16; i++) {
      const r = 50 + rand() * 120;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, alpha(p.rockEdge, 0.12));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(WIDTH * rand(), HEIGHT * rand()); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
    }
  },
  mountains(ctx, p, rand) {
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `hsl(210 35% ${30 + layer * 12}% / 0.8)`;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (let x = 0; x <= WIDTH; x += 40) ctx.lineTo(x, HEIGHT * (0.45 + layer * 0.15) - rand() * 90 - layer * 20);
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
  },
  stars(ctx, p, rand) {
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `hsl(0 0% 100% / ${0.2 + rand() * 0.7})`;
      ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * rand(), rand() < 0.1 ? 2 : 1, 0, TAU); ctx.fill();
    }
    const g = ctx.createRadialGradient(WIDTH * rand(), HEIGHT * rand(), 10, WIDTH / 2, HEIGHT / 2, 600);
    g.addColorStop(0, alpha(p.accent, 0.12));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  },
};

const PATTERNS = {
  none() {},
  hatch(ctx, p, x, y, rand) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -TILE; i < TILE; i += 7) { ctx.moveTo(x + i, y + TILE); ctx.lineTo(x + i + TILE, y); }
    ctx.stroke();
  },
  facets(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockEdge, 0.18);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + TILE, y); ctx.lineTo(x, y + TILE); ctx.closePath(); ctx.fill();
    ctx.fillStyle = alpha(p.rockDeep, 0.5);
    ctx.beginPath(); ctx.moveTo(x + TILE, y + TILE); ctx.lineTo(x + TILE, y + TILE * 0.4); ctx.lineTo(x + TILE * 0.4, y + TILE); ctx.closePath(); ctx.fill();
  },
  cracks(ctx, p, x, y, rand) {
    if (rand() > 0.35) return;
    ctx.strokeStyle = p.rockDeep;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + rand() * TILE, y);
    ctx.lineTo(x + rand() * TILE, y + TILE * 0.5);
    ctx.lineTo(x + rand() * TILE, y + TILE);
    ctx.stroke();
  },
  frost(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockDeep, 0.25);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + rand() * TILE, y + rand() * TILE, 1.5, 0, TAU); ctx.fill(); }
  },
  dots(ctx, p, x, y, rand) {
    if (rand() > 0.3) return;
    ctx.fillStyle = p.rockDeep;
    ctx.fillRect(x + 8 + rand() * 12, y + 8 + rand() * 12, 5, 5);
  },
};

function drawStatic(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const rand = seededNoise(level.palette * 7919 + 13);
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, p.bgTop);
  sky.addColorStop(1, p.bgBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  BACKGROUNDS[theme.background](ctx, p, rand);

  const solid = (c, r) => tileAt(level, c, r) === SOLID;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = tileAt(level, c, r);
      if (tile === 0) continue;
      const x = c * TILE, y = r * TILE;
      if (tile === ONE_WAY) {
        ctx.fillStyle = p.rockEdge;
        roundRect(ctx, x, y, TILE, 8, 3);
        ctx.fill();
        if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
        continue;
      }
      ctx.fillStyle = p.rock;
      ctx.fillRect(x, y, TILE, TILE);
      PATTERNS[theme.pattern](ctx, p, x, y, rand);
    }
  }

  const bothFaces = level.rules.flipOnJump || level.rules.flipPeriod > 0;
  const up = level.rules.baseGravDir < 0;
  ctx.lineCap = 'round';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!solid(c, r)) continue;
      const x = c * TILE, y = r * TILE;
      const top = !solid(c, r - 1), bottom = !solid(c, r + 1), left = !solid(c - 1, r), right = !solid(c + 1, r);
      if (theme.hollow) {
        ctx.fillStyle = p.rockDeep;
        ctx.fillRect(x + (left ? 3 : 0), y + (top ? 3 : 0), TILE - (left ? 3 : 0) - (right ? 3 : 0), TILE - (top ? 3 : 0) - (bottom ? 3 : 0));
        ctx.fillStyle = p.rock;
        ctx.fillRect(x + (left ? 5 : 0), y + (top ? 5 : 0), TILE - (left ? 5 : 0) - (right ? 5 : 0), TILE - (top ? 5 : 0) - (bottom ? 5 : 0));
      }
      const lipTop = top && (!up || bothFaces), lipBottom = bottom && (up || bothFaces);
      ctx.fillStyle = p.rockEdge;
      if (lipTop) ctx.fillRect(x, y, TILE, theme.hollow ? 3 : 4);
      if (lipBottom) ctx.fillRect(x, y + TILE - (theme.hollow ? 3 : 4), TILE, theme.hollow ? 3 : 4);
      if (theme.hollow) {
        if (left) ctx.fillRect(x, y, 3, TILE);
        if (right) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      }
      if (theme.outline) {
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = theme.outline;
        ctx.beginPath();
        if (top) { ctx.moveTo(x, y); ctx.lineTo(x + TILE, y); }
        if (bottom) { ctx.moveTo(x, y + TILE); ctx.lineTo(x + TILE, y + TILE); }
        if (left) { ctx.moveTo(x, y); ctx.lineTo(x, y + TILE); }
        if (right) { ctx.moveTo(x + TILE, y); ctx.lineTo(x + TILE, y + TILE); }
        ctx.stroke();
      }
    }
  }
  return canvas;
}

function drawPlatform(ctx, p, theme, rect, style) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fillStyle = style;
  ctx.fill();
  if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = theme.outline; ctx.stroke(); }
  ctx.fillStyle = p.rockEdge;
  ctx.fillRect(rect.x + 3, rect.y, rect.w - 6, 3);
}

function glow(ctx, theme, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = theme.glow ? blur : 0;
}

function drawObject(ctx, p, theme, level, o, state, time) {
  const clock = state.clock;
  switch (o.type) {
    case 'mover': {
      ctx.strokeStyle = alpha(p.ink, 0.3);
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
      ctx.lineTo(o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawPlatform(ctx, p, theme, objectRect(o, clock), p.rock);
      break;
    }
    case 'conveyor': {
      drawPlatform(ctx, p, theme, o, p.rock);
      ctx.fillStyle = p.accent;
      const shift = ((clock * o.speed) % 16 + 16) % 16;
      for (let x = o.x + shift - 16; x < o.x + o.w; x += 16) {
        const x0 = Math.max(o.x, x), x1 = Math.min(o.x + o.w, x + 8);
        if (x1 > x0) ctx.fillRect(x0, o.y + 12, x1 - x0, 4);
      }
      break;
    }
    case 'phase':
    case 'gate': {
      const on = phaseOn(o, clock);
      const t = (((clock + o.phase) % o.period) + o.period) % o.period;
      const soon = on ? o.on - t < 30 : o.period - t < 30;
      ctx.lineWidth = 2;
      if (on) {
        glow(ctx, theme, p.accent, 10);
        roundRect(ctx, o.x, o.y, o.w, o.h, 4);
        ctx.fillStyle = soon && Math.floor(time / 80) % 2 ? p.rockDeep : p.accentSoft;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = p.accent;
        ctx.stroke();
      } else {
        ctx.strokeStyle = soon ? p.accent : alpha(p.ink, 0.4);
        ctx.setLineDash([6, 6]);
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'crumble': {
      if (state.flags & o.bit && state.groundId !== o.id) return;
      drawPlatform(ctx, p, theme, o, p.rock);
      ctx.strokeStyle = p.rockDeep;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = o.x + 10; x < o.x + o.w; x += 22) { ctx.moveTo(x, o.y + 4); ctx.lineTo(x + 5, o.y + 14); ctx.lineTo(x - 2, o.y + o.h - 3); }
      ctx.stroke();
      break;
    }
    case 'door': {
      if (state.flags & o.bit) return;
      roundRect(ctx, o.x + 3, o.y, o.w - 6, o.h, 4);
      ctx.fillStyle = p.accentSoft;
      ctx.fill();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2 - 4, 6, 0, TAU); ctx.fill();
      ctx.fillRect(o.x + o.w / 2 - 2, o.y + o.h / 2, 4, 12);
      break;
    }
    case 'toggle': {
      const solid = ((state.flags & o.bit) !== 0) === o.on;
      ctx.lineWidth = 2;
      if (solid) {
        drawPlatform(ctx, p, theme, o, p.accentSoft);
        ctx.strokeStyle = p.accent;
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = alpha(p.ink, 0.3);
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
      glow(ctx, theme, p.accent, 18);
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      if (o.type === 'orb') ctx.arc(cx, cy, 7, 0, TAU);
      else { ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 7, cy); ctx.closePath(); }
      ctx.fill();
      if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.shadowBlur = 0;
      break;
    }
    case 'switch': {
      const pressed = (state.flags & o.bit) !== 0;
      ctx.fillStyle = p.rockEdge;
      ctx.fillRect(o.x - 4, o.y + o.h - 6, o.w + 8, 6);
      ctx.fillStyle = pressed ? p.dim : p.accent;
      roundRect(ctx, o.x, o.y + (pressed ? 8 : 2), o.w, o.h - (pressed ? 14 : 8), 4);
      ctx.fill();
      break;
    }
    case 'spikes': {
      ctx.fillStyle = p.hazard;
      ctx.beginPath();
      const n = Math.max(1, Math.round(o.w / 12));
      const tipY = o.dir < 0 ? o.y : o.y + o.h;
      const baseY = o.dir < 0 ? o.y + o.h : o.y;
      for (let i = 0; i < n; i++) {
        const x0 = o.x + (i * o.w) / n, x1 = o.x + ((i + 1) * o.w) / n;
        ctx.moveTo(x0, baseY); ctx.lineTo((x0 + x1) / 2, tipY); ctx.lineTo(x1, baseY);
      }
      ctx.fill();
      if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
      break;
    }
    case 'saw': {
      const rect = objectRect(o, clock);
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      ctx.strokeStyle = alpha(p.ink, 0.3);
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2); ctx.lineTo(o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(clock / 6);
      glow(ctx, theme, p.hazard, 12);
      ctx.fillStyle = p.hazard;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU, b = a + TAU / 20;
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.lineTo(Math.cos(b) * 10, Math.sin(b) * 10);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = p.bgTop;
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'laser': {
      const on = laserOn(o, clock);
      const t = (((clock + o.phase) % o.period) + o.period) % o.period;
      const warming = !on && o.period - t < 24;
      const cx = o.x + o.w / 2;
      ctx.fillStyle = p.hazard;
      ctx.beginPath(); ctx.arc(cx, o.y + 4, 5, 0, TAU); ctx.arc(cx, o.y + o.h - 4, 5, 0, TAU); ctx.fill();
      if (on) {
        glow(ctx, theme, p.hazard, 16);
        ctx.fillStyle = p.hazard;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.fillRect(cx - 1, o.y, 2, o.h);
      } else if (warming) {
        ctx.strokeStyle = p.hazardGlow;
        ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(cx, o.y); ctx.lineTo(cx, o.y + o.h); ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'spring': {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const y = o.y + 2 + (i * (o.h - 4)) / 3; ctx.moveTo(o.x, y); ctx.lineTo(o.x + o.w, y); }
      ctx.stroke();
      ctx.fillStyle = p.accent;
      ctx.fillRect(o.x - 2, o.dir < 0 ? o.y - 3 : o.y + o.h, o.w + 4, 3);
      break;
    }
    case 'bumper': {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      glow(ctx, theme, p.accent, 10);
      ctx.fillStyle = p.accentSoft;
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 4 * o.dir, cy - 6); ctx.lineTo(cx + 3 * o.dir, cy); ctx.lineTo(cx - 4 * o.dir, cy + 6); ctx.stroke();
      break;
    }
    case 'gravpad': {
      const cx = o.x + o.w / 2;
      ctx.fillStyle = p.accent;
      roundRect(ctx, o.x, o.y, o.w, o.h, 3);
      ctx.fill();
      ctx.fillStyle = p.bgTop;
      ctx.beginPath();
      const tip = o.dir < 0 ? o.y + 1 : o.y + o.h - 1, base = o.dir < 0 ? o.y + o.h - 1 : o.y + 1;
      ctx.moveTo(cx - 5, base); ctx.lineTo(cx, tip); ctx.lineTo(cx + 5, base); ctx.closePath(); ctx.fill();
      break;
    }
    case 'wind': {
      ctx.strokeStyle = alpha(p.dim, 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (o.ay !== 0) {
        for (let i = 0; i < o.w / 18; i++) {
          const x = o.x + 9 + i * 18, phase = (time / 6 + i * 37) % o.h;
          const y = o.ay < 0 ? o.y + o.h - phase : o.y + phase;
          ctx.moveTo(x, y); ctx.lineTo(x, y + (o.ay < 0 ? 14 : -14));
        }
      } else {
        for (let i = 0; i < o.h / 18; i++) {
          const y = o.y + 9 + i * 18, phase = (time / 5 + i * 41) % o.w;
          const x = o.ax > 0 ? o.x + phase : o.x + o.w - phase;
          ctx.moveTo(x, y); ctx.lineTo(x - Math.sign(o.ax) * 16, y);
        }
      }
      ctx.stroke();
      break;
    }
    case 'water': {
      ctx.fillStyle = p.water;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = p.waterLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = o.x; x <= o.x + o.w; x += 6) ctx.lineTo(x, o.y + Math.sin(x / 14 + time / 250) * 2);
      ctx.stroke();
      break;
    }
    case 'portal': {
      ctx.save();
      ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
      ctx.rotate(time / 600);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      glow(ctx, theme, p.accent, 14);
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 17, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

function drawFlood(ctx, p, level, state, time) {
  const y = floodLevel(level, state.clock);
  if (y >= HEIGHT) return;
  ctx.fillStyle = p.hazardGlow;
  ctx.fillRect(0, y, WIDTH, HEIGHT - y);
  ctx.strokeStyle = p.hazard;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin(x / 18 + time / 180) * 3);
  ctx.stroke();
}

function drawExit(ctx, p, theme, level, state, time) {
  const e = level.exit;
  const locked = (state.flags & level.exitNeeds) !== level.exitNeeds;
  const pulse = 0.6 + Math.sin(time / 200) * 0.25;
  glow(ctx, theme, p.accent, locked ? 4 : 24 * pulse);
  ctx.fillStyle = locked ? p.accentSoft : p.accent;
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (theme.outline) { ctx.strokeStyle = p.ink; ctx.lineWidth = theme.outline; ctx.stroke(); }
  if (locked) {
    ctx.fillStyle = p.text;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔒', e.x + e.w / 2, e.y - 8);
  }
}

function drawPlayer(ctx, p, theme, level, s, alpha = 1) {
  const r = level.rules;
  const { w, h } = playerSize(r);
  const stretch = Math.min(1.25, Math.max(0.8, 1 + Math.abs(s.vy) * 0.015));
  const dw = w / stretch, dh = h * stretch;
  const g = s.gravDir;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(s.x + w / 2, s.y + h / 2);
  if (g < 0) ctx.scale(1, -1);
  if (r.glide && s.jumpHeld && !s.grounded && s.vy * g > 0) {
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -dh / 2); ctx.lineTo(0, -dh / 2 - 14); ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.arc(0, -dh / 2 - 14, 18, Math.PI, TAU); ctx.closePath(); ctx.fill();
    if (theme.outline) ctx.stroke();
  }
  if (r.size < 1) {
    ctx.strokeStyle = p.playerInk;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, -dh / 2); ctx.lineTo(-6, -dh / 2 - 7); ctx.moveTo(3, -dh / 2); ctx.lineTo(6, -dh / 2 - 7); ctx.stroke();
  }
  ctx.fillStyle = p.player;
  glow(ctx, theme, p.player, 10);
  roundRect(ctx, -dw / 2, -dh / 2, dw, dh, Math.min(8, dw / 3));
  ctx.fill();
  ctx.shadowBlur = 0;
  if (theme.outline) { ctx.strokeStyle = p.playerInk; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = p.playerInk;
  const eyeX = s.facing * dw * 0.18;
  const blink = Math.floor(s.frame / 7) % 40 === 0;
  ctx.beginPath();
  if (blink) ctx.rect(eyeX - dw * 0.24, -dh * 0.16, dw * 0.48, 2);
  else { ctx.arc(eyeX - dw * 0.12, -dh * 0.15, dw * 0.09, 0, TAU); ctx.arc(eyeX + dw * 0.12, -dh * 0.15, dw * 0.09, 0, TAU); }
  ctx.fill();
  if (r.size > 1) { ctx.fillRect(eyeX - dw * 0.26, -dh * 0.3, dw * 0.22, 3); ctx.fillRect(eyeX + dw * 0.04, -dh * 0.3, dw * 0.22, 3); }
  ctx.restore();
  if (r.jumpBudget) {
    ctx.fillStyle = p.text;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${r.jumpBudget - s.jumpsUsed}`, s.x + w / 2, (g > 0 ? s.y : s.y + h + 14) - 6);
  }
}

function spawnAmbient(kind, rand) {
  switch (kind) {
    case 'snow': return { x: rand() * WIDTH, y: -10, vx: 0.2, vy: 0.6 + rand() * 0.8, size: 2 + rand() * 2, alpha: 0.7, sway: rand() * TAU };
    case 'embers': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.6 - rand() * 0.9, size: 2 + rand() * 2, alpha: 0.8, sway: rand() * TAU };
    case 'motes': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: 0.1 + rand() * 0.2, vy: -0.05, size: 1.5 + rand() * 1.5, alpha: 0.35, sway: rand() * TAU };
    case 'sparks': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: 0, vy: 0, size: 1 + rand() * 2, alpha: 0.9, sway: rand() * TAU };
    case 'stars': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: -0.15, vy: 0, size: 1 + rand() * 1.5, alpha: 0.8, sway: rand() * TAU };
    default: return null;
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cache = { level: null, layer: null, palette: null, theme: null, ambient: [] };
  const rand = Math.random;

  function layerFor(level) {
    if (cache.level !== level) {
      const theme = themeFor(level);
      const palette = theme.palette(level.palette);
      const ambient = [];
      for (let i = 0; i < 45; i++) {
        const particle = spawnAmbient(theme.ambient, rand);
        if (!particle) break;
        particle.y = rand() * HEIGHT;
        ambient.push(particle);
      }
      cache = { level, theme, palette, layer: drawStatic(level, theme, palette), ambient };
    }
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

  function drawAmbient(theme, p, time) {
    const { ambient } = cache;
    ambient.forEach((a, i) => {
      a.x += a.vx + Math.sin(time / 900 + a.sway) * 0.3;
      a.y += a.vy;
      if (a.y < -12 || a.y > HEIGHT + 12 || a.x > WIDTH + 12 || a.x < -12) ambient[i] = { ...spawnAmbient(theme.ambient, rand) };
      const twinkle = theme.ambient === 'sparks' || theme.ambient === 'stars' ? 0.4 + 0.6 * Math.abs(Math.sin(time / 400 + a.sway)) : 1;
      ctx.globalAlpha = a.alpha * twinkle;
      ctx.fillStyle = theme.ambient === 'embers' ? p.rockEdge : theme.ambient === 'sparks' ? p.accent : p.text;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawWorld(view, p, theme, layer) {
    const { level, state, time, ghost, trail } = view;
    ctx.drawImage(layer, 0, 0);
    drawAmbient(theme, p, time);
    for (const o of level.objects) if (o.type === 'water' || o.type === 'wind') drawObject(ctx, p, theme, level, o, state, time);
    for (const o of level.objects) if (o.type !== 'water' && o.type !== 'wind') drawObject(ctx, p, theme, level, o, state, time);
    drawExit(ctx, p, theme, level, state, time);
    if (ghost) drawPlayer(ctx, p, theme, level, ghost, 0.35);
    const { w, h } = playerSize(level.rules);
    trail.forEach((t, i) => {
      ctx.globalAlpha = (i / trail.length) * (state.dashTimer > 0 ? 0.5 : 0.22);
      ctx.fillStyle = p.player;
      roundRect(ctx, t.x + w * 0.2, t.y + h * 0.2, w * 0.6, h * 0.6, 4);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (!state.dead) drawPlayer(ctx, p, theme, level, state);
    drawFlood(ctx, p, level, state, time);
  }

  function drawParticles(particles) {
    for (const q of particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.maxLife);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawDarkness(state, level) {
    const { w, h } = playerSize(level.rules);
    const cx = state.x + w / 2, cy = state.y + h / 2;
    const dark = ctx.createRadialGradient(cx, cy, 40, cx, cy, 170);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(0.6, 'rgba(0,0,0,0.85)');
    dark.addColorStop(1, 'rgba(0,0,0,0.985)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawHud(view, p) {
    const { level, state, deaths, seed, introAge, message, controlsHint, solvedCount } = view;
    ctx.textBaseline = 'top';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = p.dim;
    ctx.textAlign = 'left';
    ctx.fillText(`seed ${seed}  ·  level ${level.index}`, 14, 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${solvedCount} solved  ·  ${deaths} deaths  ·  ${(state.frame / 60).toFixed(1)}s`, WIDTH - 14, 12);
    const intro = Math.max(0, 1 - Math.max(0, introAge - 2200) / 600);
    if (intro > 0) {
      const slide = Math.min(1, introAge / 350);
      ctx.globalAlpha = intro * slide;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.text;
      ctx.font = '800 42px system-ui, sans-serif';
      ctx.fillText(level.title, WIDTH / 2, 140 + (1 - slide) * 20);
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillStyle = p.accent;
      level.hints.forEach((hint, i) => ctx.fillText(hint, WIDTH / 2, 198 + i * 26));
      ctx.globalAlpha = 1;
    } else if (level.hints.length) {
      ctx.textAlign = 'left';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = p.accent;
      ctx.fillText(level.title.toUpperCase(), 14, 34);
    }
    if (message) {
      ctx.textAlign = 'center';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillStyle = p.text;
      ctx.fillText(message, WIDTH / 2, HEIGHT / 2 - 60);
    }
    if (controlsHint) {
      ctx.textAlign = 'center';
      ctx.font = '500 13px system-ui, sans-serif';
      ctx.fillStyle = p.dim;
      ctx.fillText(controlsHint, WIDTH / 2, HEIGHT - 26);
    }
  }

  function draw(view) {
    const { level, state, time, particles, flash, frozen } = view;
    const { palette: p, theme, layer } = layerFor(level);
    const strobeVisible = !level.rules.strobe || (state.frame % 90) < 26 || state.frame < 90;
    ctx.save();
    if (view.shake > 0) ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    if (strobeVisible) {
      drawWorld(view, p, theme, layer);
    } else {
      ctx.fillStyle = p.bgTop;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      drawExit(ctx, p, theme, level, state, time);
      if (!state.dead) drawPlayer(ctx, p, theme, level, state);
    }
    drawParticles(particles);
    if (level.rules.darkness) drawDarkness(state, level);
    if (frozen) {
      ctx.fillStyle = 'rgba(120,130,160,0.22)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();
    drawHud(view, p);
  }

  function drawTransition(progress, p) {
    ctx.fillStyle = p.bgTop;
    const w = WIDTH * progress;
    ctx.fillRect(WIDTH - w, 0, w, HEIGHT);
  }

  return { fit, draw, drawTransition, paletteFor: level => layerFor(level).palette };
}
