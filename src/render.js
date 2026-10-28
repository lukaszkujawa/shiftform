import { TILE, COLS, WIDTH, HEIGHT, SOLID, ONE_WAY, tileAt, objectRect, phaseOn, floodLevel, levelIndex, crushed } from './level.js';
import { playerSize, laserOn, hookAnchor, JETPACK_FUEL, FALL_DAMAGE_SPEED } from './physics.js';
import { laserBeam } from './bodies.js';
import { MAX_LIVES } from './climb.js';
import { themeFor } from './themes.js';
import { growLife, drawLife } from './life.js';

const TAU = Math.PI * 2;
const TOAST_MS = 3200;
const FLIP_FRAMES = 24;
const BAR_H = 40;

function jumpExtras(rules) {
  return [
    rules.flipOnJump && 'flips gravity',
    rules.blinkJump && 'teleports up',
    rules.jumps > 1 && `${rules.jumps}× in air`,
    rules.wallJump && 'off walls',
    rules.glide && 'hold to glide',
    rules.jumpBudget && `${rules.jumpBudget} total`,
  ].filter(Boolean);
}

export function controlsFor(level, muted = false, state = null) {
  const r = level.rules, index = levelIndex(level);
  const jump = jumpExtras(r);
  const grab = [index.crates.length && 'lift · throw crate', index.hooks.length && 'grab hook'].filter(Boolean);
  return [
    { caps: ['←', '→'], label: r.mirror ? 'move (reversed!)' : 'move', input: ['left', 'right'], special: r.mirror },
    { caps: ['Z'], label: ['jump', ...jump].join(' · '), input: ['jump'], special: jump.length > 0 },
    r.dash && { caps: ['X'], label: 'dash', input: ['dash'], special: true },
    grab.length && { caps: ['F'], label: grab.join(' · '), input: ['interact'], special: true },
    state?.boots > 0 && { caps: ['Z'], label: `in air · boots ×${state.boots}`, input: ['jump'], special: true },
    state?.fuel > 0 && { caps: ['Z'], label: 'in air · jetpack', input: ['jump'], special: true },
    { caps: ['R'], label: 'back to checkpoint' },
    { caps: ['H'], label: 'hint' },
    { caps: ['M'], label: muted ? 'sound off' : 'sound' },
    { caps: ['Esc'], label: 'menu' },
  ].filter(Boolean);
}

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
  vines(ctx, p, rand) {
    ctx.strokeStyle = alpha(p.rockEdge, 0.22);
    ctx.fillStyle = alpha(p.rockEdge, 0.16);
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const x = WIDTH * rand(), len = HEIGHT * (0.2 + rand() * 0.6), sway = 20 + rand() * 30;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + sway, len / 2, x, len); ctx.stroke();
      for (let y = 30; y < len; y += 34) {
        const lx = x + sway * 0.5 * Math.sin((y / len) * Math.PI), side = (y / 34) % 2 ? 1 : -1;
        ctx.beginPath(); ctx.ellipse(lx + side * 7, y, 8, 4, side * 0.6, 0, TAU); ctx.fill();
      }
    }
  },
  dunes(ctx, p, rand) {
    const sun = ctx.createRadialGradient(WIDTH * 0.75, HEIGHT * 0.25, 10, WIDTH * 0.75, HEIGHT * 0.25, 160);
    sun.addColorStop(0, 'hsl(45 100% 92% / 0.9)');
    sun.addColorStop(0.3, 'hsl(40 100% 80% / 0.4)');
    sun.addColorStop(1, 'hsl(40 100% 80% / 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `hsl(${28 - layer * 4} ${45 + layer * 5}% ${68 - layer * 9}% / 0.7)`;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      let y = HEIGHT * (0.55 + layer * 0.13);
      ctx.lineTo(0, y);
      for (let x = 0; x < WIDTH; x += 240) {
        const next = HEIGHT * (0.5 + layer * 0.13) + rand() * 50;
        ctx.quadraticCurveTo(x + 120, y - 50 - rand() * 40, x + 240, next);
        y = next;
      }
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
  },
  caustics(ctx, p, rand) {
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const x = WIDTH * rand(), w = 30 + rand() * 60;
      const shaft = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      shaft.addColorStop(0, alpha(p.waterLine, 0.12));
      shaft.addColorStop(1, alpha(p.waterLine, 0));
      ctx.fillStyle = shaft;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.5 - 60, HEIGHT); ctx.lineTo(x - 60, HEIGHT); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = alpha(p.waterLine, 0.18);
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(WIDTH * rand(), HEIGHT * rand(), 2 + rand() * 4, 0, TAU); ctx.stroke(); }
  },
  hills(ctx, p, rand) {
    ctx.fillStyle = 'hsl(45 80% 92% / 0.75)';
    ctx.beginPath(); ctx.arc(WIDTH * (0.2 + rand() * 0.6), HEIGHT * 0.22, 46, 0, TAU); ctx.fill();
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `hsl(${290 + layer * 15} 25% ${30 - layer * 6}% / 0.75)`;
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (let x = -100; x <= WIDTH + 100; x += 200) {
        const r = 120 + rand() * 80;
        ctx.arc(x + 100, HEIGHT * (0.7 + layer * 0.1) + r * 0.6, r, Math.PI * 1.1, Math.PI * 1.9);
      }
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
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
  moss(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockEdge, 0.35);
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(x + rand() * TILE, y + 6 + rand() * (TILE - 10), 4, 2, rand() * Math.PI, 0, TAU); ctx.fill(); }
  },
  strata(ctx, p, x, y, rand) {
    ctx.fillStyle = alpha(p.rockDeep, 0.3);
    ctx.fillRect(x, y + 11 + rand() * 3, TILE, 2);
    ctx.fillRect(x, y + 22 + rand() * 3, TILE, 1.5);
  },
  barnacles(ctx, p, x, y, rand) {
    if (rand() > 0.2) return;
    ctx.strokeStyle = alpha(p.rockEdge, 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + 6 + rand() * 18, y + 8 + rand() * 16, 2.5 + rand() * 2, 0, TAU); ctx.stroke();
  },
  waves(ctx, p, x, y) {
    ctx.strokeStyle = alpha(p.rockDeep, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const r of [5, 10, 15]) { ctx.moveTo(x + TILE / 2 + r, y + TILE); ctx.arc(x + TILE / 2, y + TILE, r, 0, Math.PI, true); }
    ctx.stroke();
  },
  dots(ctx, p, x, y, rand) {
    if (rand() > 0.3) return;
    ctx.fillStyle = p.rockDeep;
    ctx.fillRect(x + 8 + rand() * 12, y + 8 + rand() * 12, 5, 5);
  },
};

function renderBackdrop(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  BACKGROUNDS[theme.background](canvas.getContext('2d'), p, seededNoise(level.palette * 7919 + 13));
  return canvas;
}

function renderTiles(level, theme, p) {
  const canvas = new OffscreenCanvas(WIDTH, level.height);
  const ctx = canvas.getContext('2d');
  const rand = seededNoise(level.palette * 104729 + 7);

  const solid = (c, r) => tileAt(level, c, r) === SOLID;
  for (let r = 0; r < level.rows; r++) {
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
  for (let r = 0; r < level.rows; r++) {
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

const CRATE_LOOKS = {
  wood: { fill: 'hsl(32 55% 46%)', ink: 'hsl(28 50% 26%)' },
  steel: { fill: 'hsl(210 12% 64%)', ink: 'hsl(212 16% 34%)' },
  stone: { fill: 'hsl(30 6% 38%)', ink: 'hsl(30 8% 20%)' },
};

function drawCrate(ctx, theme, p, kind, x, y, size) {
  const look = CRATE_LOOKS[kind];
  roundRect(ctx, x, y, size, size, kind === 'stone' ? 6 : 3);
  ctx.fillStyle = look.fill;
  ctx.fill();
  ctx.strokeStyle = theme.outline ? p.ink : look.ink;
  ctx.lineWidth = kind === 'stone' ? 3 : 2;
  ctx.stroke();
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (kind === 'wood') {
    ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + size - 4, y + size - 4);
    ctx.moveTo(x + 3, y + size / 2); ctx.lineTo(x + size - 3, y + size / 2);
    ctx.stroke();
  } else if (kind === 'steel') {
    ctx.stroke();
    ctx.fillStyle = look.ink;
    for (const [dx, dy] of [[5, 5], [size - 5, 5], [5, size - 5], [size - 5, size - 5]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2, 0, TAU); ctx.fill(); }
    ctx.fillRect(x + 6, y + size / 2 - 1, size - 12, 2);
  } else {
    ctx.moveTo(x + size * 0.3, y + 3); ctx.lineTo(x + size * 0.45, y + size * 0.45); ctx.lineTo(x + size * 0.25, y + size * 0.7);
    ctx.moveTo(x + size * 0.45, y + size * 0.45); ctx.lineTo(x + size * 0.8, y + size * 0.6);
    ctx.stroke();
  }
}

const ITEM_COLORS = { jetpack: 'hsl(25 90% 60% / 1)', boots: 'hsl(190 80% 60% / 1)', shield: 'hsl(210 85% 72% / 1)', heart: 'hsl(350 85% 62% / 1)' };

function drawItemIcon(ctx, kind, cx, cy, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = ITEM_COLORS[kind];
  ctx.strokeStyle = 'hsl(0 0% 100% / 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (kind === 'jetpack') {
    ctx.roundRect(-8, -9, 7, 15, 3);
    ctx.roundRect(1, -9, 7, 15, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'hsl(45 100% 60%)';
    ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(-4.5, 11); ctx.lineTo(-3, 7); ctx.moveTo(3, 7); ctx.lineTo(4.5, 11); ctx.lineTo(6, 7); ctx.fill();
  } else if (kind === 'boots') {
    ctx.moveTo(-6, -9); ctx.lineTo(1, -9); ctx.lineTo(1, 1); ctx.lineTo(8, 1); ctx.lineTo(8, 6); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(-5, 8 + i * 2); ctx.lineTo(7, 8 + i * 2); }
    ctx.stroke();
  } else if (kind === 'shield') {
    ctx.moveTo(0, -10); ctx.lineTo(8, -6); ctx.lineTo(7, 3); ctx.lineTo(0, 10); ctx.lineTo(-7, 3); ctx.lineTo(-8, -6); ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(0, 9); ctx.bezierCurveTo(-12, 0, -8, -11, 0, -4); ctx.bezierCurveTo(8, -11, 12, 0, 0, 9);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBodies(ctx, p, theme, level, state) {
  const crates = levelIndex(level).crates;
  state.bodies.forEach((b, k) => { if (!b.gone) drawCrate(ctx, theme, p, crates[k].kind, b.x, b.y, crates[k].w); });
}

function drawPowers(ctx, level, state, time) {
  const { w, h } = playerSize(level.rules);
  const cx = state.x + w / 2, cy = state.y + h / 2;
  if (state.jetting) {
    const base = state.gravDir > 0 ? state.y + h : state.y;
    const flame = ctx.createLinearGradient(0, base, 0, base + 22 * state.gravDir);
    flame.addColorStop(0, 'hsl(45 100% 70% / 0.95)');
    flame.addColorStop(1, 'hsl(15 100% 55% / 0)');
    ctx.fillStyle = flame;
    const flicker = 16 + Math.sin(time / 30) * 5;
    ctx.beginPath(); ctx.moveTo(cx - 6, base); ctx.lineTo(cx, base + flicker * state.gravDir); ctx.lineTo(cx + 6, base); ctx.fill();
  }
  if (state.shield || state.invuln > 0) {
    ctx.strokeStyle = `hsl(210 90% 75% / ${state.shield ? 0.55 + Math.sin(time / 200) * 0.15 : (state.invuln % 10 < 5 ? 0.6 : 0.1)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.85, 0, TAU); ctx.stroke();
  }
}

function drawRope(ctx, p, level, state) {
  if (state.rope < 0) return;
  const anchor = hookAnchor(level.objects[state.rope]);
  const { w, h } = playerSize(level.rules);
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(state.x + w / 2, state.y + h / 2); ctx.stroke();
}

function drawObject(ctx, p, theme, level, o, state, time) {
  const clock = state.clock;
  const bits = state.flags | state.pressed;
  if (crushed(level, state, o)) {
    ctx.fillStyle = o.type === 'saw' ? p.hazardGlow : p.dim;
    const rect = objectRect(o, clock);
    ctx.fillRect(rect.x, rect.y + rect.h - 4, rect.w, 4);
    return;
  }
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
      const gone = state.crumbled[o.slot];
      if (gone) {
        ctx.strokeStyle = alpha(p.ink, gone < 40 && Math.floor(time / 80) % 2 ? 0.7 : 0.18);
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 5);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      drawPlatform(ctx, p, theme, o, p.rock);
      ctx.strokeStyle = p.rockDeep;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = o.x + 10; x < o.x + o.w; x += 22) { ctx.moveTo(x, o.y + 4); ctx.lineTo(x + 5, o.y + 14); ctx.lineTo(x - 2, o.y + o.h - 3); }
      ctx.stroke();
      break;
    }
    case 'door': {
      if (bits & o.bit) return;
      if (o.plate) {
        roundRect(ctx, o.x + 3, o.y, o.w - 6, o.h, 3);
        ctx.fillStyle = p.accentSoft;
        ctx.fill();
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        for (let y = o.y + 10; y < o.y + o.h; y += 12) { ctx.moveTo(o.x + 6, y); ctx.lineTo(o.x + o.w - 6, y); }
        ctx.stroke();
        break;
      }
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
      const solid = ((bits & o.bit) !== 0) === o.on;
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
        const beam = laserBeam(level, o, state.bodies);
        glow(ctx, theme, p.hazard, 16);
        ctx.fillStyle = p.hazard;
        ctx.fillRect(beam.x, beam.y, beam.w, beam.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.fillRect(cx - 1, beam.y, 2, beam.h);
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
    case 'plate': {
      const down = (state.pressed & o.bit) !== 0;
      ctx.fillStyle = p.rockEdge;
      ctx.fillRect(o.x - 3, o.y + o.h - 2, o.w + 6, 2);
      if (down) glow(ctx, theme, p.accent, 12);
      ctx.fillStyle = down ? p.accent : p.accentSoft;
      roundRect(ctx, o.x, o.y + (down ? 3 : 0), o.w, o.h - (down ? 4 : 2), 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'item': {
      if (state.taken & (1 << o.slot)) return;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2 + Math.sin(time / 280 + o.x) * 3;
      const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
      halo.addColorStop(0, alpha(ITEM_COLORS[o.kind], 0.55));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(cx - 22, cy - 22, 44, 44);
      drawItemIcon(ctx, o.kind, cx, cy);
      break;
    }
    case 'hook': {
      const { x, y } = hookAnchor(o);
      const { w, h } = playerSize(level.rules);
      const near = state.rope < 0 && Math.hypot(state.x + w / 2 - x, state.y + h / 2 - y) <= o.reach;
      if (near) {
        ctx.strokeStyle = alpha(p.accent, 0.25);
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, o.reach, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      glow(ctx, theme, p.accent, near ? 14 : 4);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
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
  if (y >= level.height) return;
  ctx.fillStyle = p.hazardGlow;
  ctx.fillRect(0, y, WIDTH, level.height - y);
  ctx.strokeStyle = p.hazard;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin(x / 18 + time / 180) * 3);
  ctx.stroke();
}

function drawExit(ctx, p, level, time) {
  const e = level.exit;
  const pulse = 0.55 + Math.sin(time / 260) * 0.2;
  const beam = ctx.createLinearGradient(0, e.y, 0, e.y + 4 * TILE);
  beam.addColorStop(0, alpha(p.accent, pulse));
  beam.addColorStop(1, alpha(p.accent, 0));
  ctx.fillStyle = beam;
  ctx.fillRect(e.x + 4, e.y, e.w - 8, 4 * TILE);
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
  const flip = (s.frame - s.flipFrame) / FLIP_FRAMES;
  if (flip >= 0 && flip < 1 && !s.grounded) ctx.rotate((1 - (1 - flip) ** 2) * TAU * s.facing);
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
  const shattering = r.fallDamage && s.vy * g >= FALL_DAMAGE_SPEED - 0.6;
  ctx.fillStyle = shattering ? p.hazard : p.player;
  glow(ctx, theme, shattering ? p.hazard : p.player, shattering ? 18 : 10 + 16 * s.charge);
  roundRect(ctx, -dw / 2, -dh / 2, dw, dh, Math.min(8, dw / 3));
  ctx.fill();
  ctx.shadowBlur = 0;
  if (shattering) {
    ctx.strokeStyle = p.playerInk;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-dw * 0.3, -dh / 2); ctx.lineTo(-dw * 0.05, -dh * 0.1); ctx.lineTo(-dw * 0.25, dh * 0.2); ctx.lineTo(0, dh / 2);
    ctx.moveTo(dw * 0.35, -dh * 0.3); ctx.lineTo(dw * 0.1, 0); ctx.lineTo(dw * 0.3, dh * 0.3);
    ctx.stroke();
  }
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

const ALTITUDE_STOPS = [
  { at: 0, top: [35, 70, 75, 0.18], bottom: [30, 60, 70, 0.28], stars: 0 },
  { at: 300, top: [205, 70, 62, 0.22], bottom: [195, 60, 70, 0.18], stars: 0 },
  { at: 900, top: [275, 45, 40, 0.3], bottom: [20, 70, 55, 0.25], stars: 0.2 },
  { at: 1800, top: [235, 55, 8, 0.55], bottom: [250, 45, 18, 0.35], stars: 1 },
];

function mixStop(a, b, t) {
  const mix = (x, y) => x.map((v, i) => v + (y[i] - v) * t);
  const hsla = ([h, s, l, a]) => `hsl(${h} ${s}% ${l}% / ${a})`;
  return { top: hsla(mix(a.top, b.top)), bottom: hsla(mix(a.bottom, b.bottom)), stars: a.stars + (b.stars - a.stars) * t };
}

function altitudeTint(metres) {
  const i = ALTITUDE_STOPS.findIndex(stop => stop.at > metres);
  if (i === -1) return mixStop(ALTITUDE_STOPS.at(-1), ALTITUDE_STOPS.at(-1), 0);
  if (i === 0) return mixStop(ALTITUDE_STOPS[0], ALTITUDE_STOPS[0], 0);
  const a = ALTITUDE_STOPS[i - 1], b = ALTITUDE_STOPS[i];
  return mixStop(a, b, (metres - a.at) / (b.at - a.at));
}

function spawnAmbient(kind, rand) {
  switch (kind) {
    case 'snow': return { x: rand() * WIDTH, y: -10, vx: 0.2, vy: 0.6 + rand() * 0.8, size: 2 + rand() * 2, alpha: 0.7, sway: rand() * TAU };
    case 'embers': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.6 - rand() * 0.9, size: 2 + rand() * 2, alpha: 0.8, sway: rand() * TAU };
    case 'motes': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: 0.1 + rand() * 0.2, vy: -0.05, size: 1.5 + rand() * 1.5, alpha: 0.35, sway: rand() * TAU };
    case 'sparks': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: 0, vy: 0, size: 1 + rand() * 2, alpha: 0.9, sway: rand() * TAU, twinkle: true };
    case 'stars': return { x: rand() * WIDTH, y: rand() * HEIGHT, vx: -0.15, vy: 0, size: 1 + rand() * 1.5, alpha: 0.8, sway: rand() * TAU, twinkle: true };
    case 'spores': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.2 - rand() * 0.3, size: 1.5 + rand() * 1.5, alpha: 0.8, sway: rand() * TAU, twinkle: true };
    case 'dust': return { x: -10, y: rand() * HEIGHT, vx: 0.8 + rand() * 0.9, vy: 0.05, size: 1 + rand() * 1.5, alpha: 0.45, sway: rand() * TAU };
    case 'bubbles': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0, vy: -0.4 - rand() * 0.7, size: 1.5 + rand() * 2.5, alpha: 0.5, sway: rand() * TAU };
    case 'petals': return { x: rand() * WIDTH, y: -10, vx: 0.3 + rand() * 0.4, vy: 0.4 + rand() * 0.5, size: 2.5 + rand(), alpha: 0.85, sway: rand() * TAU };
    default: return null;
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const layers = new WeakMap();
  let ambient = { level: null, particles: [] };
  const rand = Math.random;

  function layerFor(level) {
    let layer = layers.get(level);
    if (!layer) {
      const theme = themeFor(level);
      const palette = theme.palette(level.palette);
      layer = { theme, palette, tiles: renderTiles(level, theme, palette), backdrop: renderBackdrop(level, theme, palette), life: growLife(level, theme) };
      layers.set(level, layer);
    }
    return layer;
  }

  function ambientFor(level, theme) {
    if (ambient.level !== level) {
      const particles = [];
      for (let i = 0; i < 45; i++) {
        const particle = spawnAmbient(theme.ambient, rand);
        if (!particle) break;
        particle.y = rand() * HEIGHT;
        particles.push(particle);
      }
      ambient = { level, particles };
    }
    return ambient.particles;
  }

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / (HEIGHT + BAR_H));
    canvas.width = Math.floor(WIDTH * scale * dpr);
    canvas.height = Math.floor((HEIGHT + BAR_H) * scale * dpr);
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${(HEIGHT + BAR_H) * scale}px`;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  function drawAmbient(level, theme, p, time) {
    const particles = ambientFor(level, theme);
    particles.forEach((a, i) => {
      a.x += a.vx + Math.sin(time / 900 + a.sway) * 0.3;
      a.y += a.vy;
      if (a.y < -12 || a.y > HEIGHT + 12 || a.x > WIDTH + 12 || a.x < -12) particles[i] = { ...spawnAmbient(theme.ambient, rand) };
      ctx.globalAlpha = a.alpha * (a.twinkle ? 0.4 + 0.6 * Math.abs(Math.sin(time / 400 + a.sway)) : 1);
      ctx.fillStyle = p[theme.mote];
      ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawSky(p, altitude, camera) {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, p.bgTop);
    sky.addColorStop(1, p.bgBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const tint = altitudeTint(altitude);
    const air = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    air.addColorStop(0, tint.top);
    air.addColorStop(1, tint.bottom);
    ctx.fillStyle = air;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (tint.stars > 0) {
      const stars = seededNoise(97);
      ctx.fillStyle = 'white';
      for (let i = 0; i < 90; i++) {
        const x = stars() * WIDTH, y = (((stars() * HEIGHT * 2 - camera * 0.05) % HEIGHT) + HEIGHT) % HEIGHT;
        ctx.globalAlpha = tint.stars * (0.3 + stars() * 0.7);
        ctx.fillRect(x, y, stars() < 0.15 ? 2 : 1, stars() < 0.15 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawBackdrop(layer, top, bottom, camera) {
    if (bottom <= 0 || top >= HEIGHT) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, Math.max(0, top), WIDTH, Math.min(HEIGHT, bottom) - Math.max(0, top));
    ctx.clip();
    const shift = (((-camera * 0.3) % HEIGHT) + HEIGHT) % HEIGHT;
    ctx.drawImage(layer.backdrop, 0, shift - HEIGHT);
    ctx.drawImage(layer.backdrop, 0, shift);
    ctx.restore();
  }

  function drawBiome(level, state, offset, view, current) {
    const layer = layerFor(level);
    const { palette: p, theme } = layer;
    const { time, ghost, trail } = view;
    ctx.save();
    drawLife(ctx, layer.life, p, offset, view.camera, time);
    ctx.translate(0, offset - view.camera);
    ctx.drawImage(layer.tiles, 0, 0);
    for (const o of level.objects) if (o.type === 'water' || o.type === 'wind') drawObject(ctx, p, theme, level, o, state, time);
    for (const o of level.objects) if (o.type !== 'water' && o.type !== 'wind') drawObject(ctx, p, theme, level, o, state, time);
    drawExit(ctx, p, level, time);
    if (current) {
      if (ghost) drawPlayer(ctx, p, theme, level, ghost, 0.35);
      const { w, h } = playerSize(level.rules);
      trail.forEach((t, i) => {
        ctx.globalAlpha = (i / trail.length) * (state.dashTimer > 0 ? 0.5 : 0.22 + 0.3 * state.charge);
        ctx.fillStyle = p.player;
        roundRect(ctx, t.x + w * 0.2, t.y + h * 0.2, w * 0.6, h * 0.6, 4);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      drawRope(ctx, p, level, state);
      if (!state.dead) {
        drawPlayer(ctx, p, theme, level, state);
        drawPowers(ctx, level, state, time);
      }
    }
    drawBodies(ctx, p, theme, level, state);
    drawFlood(ctx, p, level, state, time);
    if (current) drawParticles(view.particles);
    ctx.restore();
  }

  function drawParticles(particles) {
    for (const q of particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.maxLife);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawDarkness(state, level, camera) {
    const { w, h } = playerSize(level.rules);
    const cx = state.x + w / 2, cy = state.y + h / 2 - camera;
    const dark = ctx.createRadialGradient(cx, cy, 40, cx, cy, 170);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(0.6, 'rgba(0,0,0,0.85)');
    dark.addColorStop(1, 'rgba(0,0,0,0.985)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawInventory(state, p) {
    let x = WIDTH - 180;
    const y = 44;
    if (state.fuel > 0) {
      drawItemIcon(ctx, 'jetpack', x, y, 0.8);
      ctx.fillStyle = 'hsl(240 20% 10% / 0.6)';
      ctx.fillRect(x + 12, y - 4, 50, 8);
      ctx.fillStyle = ITEM_COLORS.jetpack;
      ctx.fillRect(x + 12, y - 4, 50 * (state.fuel / JETPACK_FUEL), 8);
      x += 76;
    }
    if (state.boots > 0) {
      drawItemIcon(ctx, 'boots', x, y, 0.8);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillStyle = p.text;
      ctx.fillText(`×${state.boots}`, x + 11, y + 1);
      x += 44;
    }
    if (state.shield) drawItemIcon(ctx, 'shield', x, y, 0.8);
  }

  function drawMeter(view, p) {
    const { level, state, altitude, best, touched } = view;
    const x = 18, top = 70, bottom = HEIGHT - 70;
    const span = bottom - top;
    const at = y => bottom - (1 - y / level.height) * span;
    ctx.fillStyle = 'hsl(240 20% 8% / 0.55)';
    roundRect(ctx, x - 4, top - 8, 8, span + 16, 4);
    ctx.fill();
    for (const o of level.objects) {
      if (o.type !== 'checkpoint') continue;
      ctx.fillStyle = touched.includes(o.id) ? p.accent : 'hsl(240 10% 60% / 0.6)';
      ctx.fillRect(x - 7, at(o.y + o.h) - 1, 14, 2);
    }
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.moveTo(x - 8, top - 10); ctx.lineTo(x + 8, top - 10); ctx.lineTo(x, top - 18); ctx.closePath(); ctx.fill();
    const py = at(Math.max(0, Math.min(level.height, state.y)));
    ctx.fillStyle = p.player;
    ctx.beginPath(); ctx.arc(x, py, 6, 0, TAU); ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = p.text;
    ctx.fillText(`${altitude.toLocaleString()} m`, x + 16, py);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = p.dim;
    ctx.fillText(`best ${best.toLocaleString()} m`, x + 16, py + 20);
  }

  function drawHud(view, p) {
    const { level, state, lives, seed, bannerAge, biomeIndex, message } = view;
    ctx.textBaseline = 'top';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = p.dim;
    ctx.textAlign = 'left';
    ctx.fillText(`seed ${seed}  ·  biome ${biomeIndex + 1}`, 14, 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${(state.frame / 60).toFixed(1)}s`, WIDTH - 14, 12);
    ctx.font = '700 18px system-ui, sans-serif';
    for (let i = 0; i < MAX_LIVES; i++) {
      ctx.fillStyle = i < lives ? p.hazard : alpha(p.dim, 0.35);
      ctx.fillText('♥', WIDTH - 70 - (MAX_LIVES - 1 - i) * 20, 9);
    }
    drawInventory(state, p);
    if (view.toast && view.toast.age < TOAST_MS) {
      ctx.globalAlpha = Math.min(1, (TOAST_MS - view.toast.age) / 500, view.toast.age / 150);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 17px system-ui, sans-serif';
      const width = ctx.measureText(view.toast.text).width + 60;
      ctx.fillStyle = 'hsl(240 25% 8% / 0.8)';
      roundRect(ctx, WIDTH / 2 - width / 2, HEIGHT - 70, width, 36, 10);
      ctx.fill();
      drawItemIcon(ctx, view.toast.kind, WIDTH / 2 - width / 2 + 22, HEIGHT - 52, 0.9);
      ctx.fillStyle = 'hsl(0 0% 97%)';
      ctx.fillText(view.toast.text, WIDTH / 2 + 12, HEIGHT - 51);
      ctx.globalAlpha = 1;
    }
    const banner = Math.max(0, 1 - Math.max(0, bannerAge - 2600) / 700);
    if (banner > 0) {
      const slide = Math.min(1, bannerAge / 350);
      ctx.globalAlpha = banner * slide;
      ctx.textAlign = 'center';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillStyle = p.dim;
      ctx.fillText(`${(biomeIndex * level.rows * 2).toLocaleString()} m`, WIDTH / 2, 112 + (1 - slide) * 20);
      ctx.fillStyle = p.text;
      ctx.font = '800 42px system-ui, sans-serif';
      ctx.fillText(level.title, WIDTH / 2, 134 + (1 - slide) * 20);
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillStyle = p.accent;
      level.hints.forEach((hint, i) => ctx.fillText(hint, WIDTH / 2, 192 + i * 26));
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
  }

  function drawControls(level, keys, p, muted, state) {
    ctx.fillStyle = 'hsl(240 20% 6%)';
    ctx.fillRect(0, HEIGHT, WIDTH, BAR_H);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const capFont = '700 12px system-ui, sans-serif', labelFont = '600 13px system-ui, sans-serif';
    const cy = HEIGHT + BAR_H / 2;
    const items = controlsFor(level, muted, state).map(item => {
      ctx.font = capFont;
      const caps = item.caps.map(cap => ({ cap, w: Math.max(22, ctx.measureText(cap).width + 12) }));
      ctx.font = labelFont;
      const labelW = ctx.measureText(item.label).width;
      return { ...item, caps, labelW, w: caps.reduce((sum, c) => sum + c.w + 4, 0) + 4 + labelW };
    });
    const gap = 22;
    let x = (WIDTH - items.reduce((sum, item) => sum + item.w, 0) - gap * (items.length - 1)) / 2;
    for (const item of items) {
      const lit = item.input?.some(input => keys[input]);
      const color = item.special ? p.accent : 'hsl(240 10% 78%)';
      for (const { cap, w } of item.caps) {
        roundRect(ctx, x, cy - 11, w, 22, 5);
        ctx.fillStyle = lit ? color : 'hsl(240 15% 14%)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = item.special ? 1.5 : 1;
        ctx.stroke();
        ctx.font = capFont;
        ctx.fillStyle = lit ? 'hsl(240 20% 8%)' : color;
        ctx.textAlign = 'center';
        ctx.fillText(cap, x + w / 2, cy + 1);
        x += w + 4;
      }
      ctx.textAlign = 'left';
      ctx.font = labelFont;
      ctx.fillStyle = item.special ? p.accent : 'hsl(240 8% 62%)';
      ctx.fillText(item.label, x + 4, cy + 1);
      x += 4 + item.labelW + gap;
    }
  }
  function draw(view) {
    const { level, state, particles, flash, frozen, camera, below, above, altitude } = view;
    const { palette: p, theme } = layerFor(level);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT);
    ctx.clip();
    if (view.shake > 0) ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    drawSky(p, altitude, camera);
    drawBackdrop(layerFor(level), -camera, level.height - camera + (below ? 0 : HEIGHT), camera);
    if (above) drawBackdrop(layerFor(above.level), -camera - above.level.height, -camera, camera);
    if (below) drawBackdrop(layerFor(below.level), level.height - camera, level.height - camera + below.level.height, camera);
    drawAmbient(level, theme, p, view.time);
    if (above) drawBiome(above.level, above.state, -above.level.height, view, false);
    if (below) drawBiome(below.level, below.state, level.height, view, false);
    drawBiome(level, state, 0, view, true);
    if (level.rules.darkness) drawDarkness(state, level, camera);
    if (frozen) {
      ctx.fillStyle = 'rgba(120,130,160,0.22)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();
    drawMeter(view, p);
    drawHud(view, p);
    if (view.over) drawGameOver(view, p);
    drawControls(level, view.keys, p, view.muted, state);
  }

  function drawGameOver(view, p) {
    ctx.fillStyle = 'hsl(240 30% 4% / 0.78)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.hazard;
    ctx.font = '800 46px system-ui, sans-serif';
    ctx.fillText('Out of lives', WIDTH / 2, HEIGHT / 2 - 70);
    ctx.fillStyle = 'hsl(0 0% 97%)';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText(`You reached ${view.altitude.toLocaleString()} m`, WIDTH / 2, HEIGHT / 2 - 12);
    ctx.fillStyle = 'hsl(240 10% 75%)';
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(`best on this seed: ${view.best.toLocaleString()} m`, WIDTH / 2, HEIGHT / 2 + 26);
    ctx.fillStyle = p.accent;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText('Enter or R to climb again  ·  Esc for the menu', WIDTH / 2, HEIGHT / 2 + 72);
  }

  function drawLoading() {
    ctx.fillStyle = 'hsl(240 25% 5%)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT + BAR_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(240 10% 80%)';
    ctx.fillText('building the climb…', WIDTH / 2, HEIGHT / 2);
  }

  return { fit, draw, drawLoading, paletteFor: level => layerFor(level).palette };
}
