import { TILE, COLS, WIDTH, HEIGHT, SOLID, ONE_WAY, tileAt, objectRect, phaseOn, floodLevel, levelIndex, crushed, slain, erased, cycleAt } from './level.js';
import { placedAt } from './tricks.js';
import { COMBO_FROM } from './combo.js';
import { playerSize, hookAnchor, cometLift } from './physics.js';
import { laserBeam } from './bodies.js';
import { themeFor, alpha } from './themes.js';
import { growDecor, paintDecor, drawDecor } from './decor.js';
import { growLife, drawLife } from './life.js';
import { glow, lit, sprite, stamp } from './sprites.js';
import { drawMonster } from './monsters.js';
import { drawSpring, drawBumper, drawSaw, drawConveyor } from './gadgets.js';
import { seededNoise, renderBackdrop, hasHorizon, PATTERNS, GLYPHS } from './backdrops.js';
import { ITEM_COLORS, COIN_COLOR, BRIGHT_TEXT, drawItemIcon } from './icons.js';
import { drawPlayer } from './player-art.js';
import { BAR_H, drawMeter, drawHud, drawControls, drawQuitPrompt, drawGameOver, drawLoading, drawLevelUp } from './hud.js';
import { TAU, font, roundRect, strokeDashed, veil } from './paint.js';
import { homeOf, atWardrobe, drawHome } from './home.js';
import { drawWardrobe } from './wardrobe.js';
import { drawMouths, drawHall } from './hall-art.js';
import { drawStallBubble } from './stall-ui.js';
import { drawTooltip } from './tooltip.js';
import { drawSignpost } from './signpost.js';

export { ITEM_COLORS } from './icons.js';
export { inventoryHit, promptHit, gearHit } from './hud.js';

const CULL_MARGIN = 160;
const PARALLAX = 0.3;
const HALL_DIM = 'hsl(240 12% 72% / 1)';
const LIGHT = { inner: 40, outer: 170 };

function renderTiles(level, theme, p, decor) {
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

  const bothFaces = level.rules.flipChance > 0 || level.rules.jumpFlipChance > 0;
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
  paintDecor(ctx, decor, p, theme);
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
  if (state.comet) drawCometAura(ctx, state, cx, cy, w, h, time);
  if (state.shield || state.invuln > 0) {
    ctx.strokeStyle = `hsl(210 90% 75% / ${state.shield ? 0.55 + Math.sin(time / 200) * 0.15 : (state.invuln % 10 < 5 ? 0.6 : 0.1)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.85, 0, TAU); ctx.stroke();
  }
}

function drawCometAura(ctx, state, cx, cy, w, h, time) {
  const heat = (cometLift(state.comet) - 1) / 2;
  const hue = 45 - heat * 45, r = Math.max(w, h) * (0.9 + heat * 0.5);
  const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 1.6);
  aura.addColorStop(0, `hsl(${hue} 100% 65% / ${state.cometMissed ? 0.15 : 0.55})`);
  aura.addColorStop(1, `hsl(${hue} 100% 55% / 0)`);
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, TAU); ctx.fill();
  const tail = -Math.sign(state.vy || -1) * state.gravDir;
  ctx.fillStyle = `hsl(${hue} 100% 62% / ${state.cometMissed ? 0.2 : 0.5})`;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.5, cy); ctx.lineTo(cx, cy + tail * (h * 1.4 + heat * 30 + Math.sin(time / 40) * 4)); ctx.lineTo(cx + w * 0.5, cy); ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = font(800, 13 + Math.round(heat * 6));
  ctx.fillStyle = state.cometMissed ? 'hsl(0 85% 65%)' : `hsl(${hue} 100% 75%)`;
  ctx.fillText(state.cometMissed ? (state.cometEarly ? 'early!' : 'late!') : state.cometWait > 0 ? 'NOW' : `×${state.comet}`, cx, cy - h * 0.9 - 6);
}

function drawRival(ctx, p, theme, level, s) {
  const { w } = playerSize(level.rules);
  drawPlayer(ctx, p, theme, level, s, 0.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = font(700, 11);
  ctx.fillStyle = alpha(p.text, 0.7);
  ctx.fillText('ghost', s.x + w / 2, s.y - 6);
}

function drawRope(ctx, p, level, state) {
  if (state.rope < 0) return;
  const anchor = hookAnchor(level.objects[state.rope]);
  const { w, h } = playerSize(level.rules);
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(state.x + w / 2, state.y + h / 2); ctx.stroke();
}

function drawClimb(ctx, p, look, o, time) {
  const cx = o.x + o.w / 2, bottom = o.y + o.h;
  ctx.lineCap = 'round';
  if (look === 'ladder') {
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const x of [o.x + 2, o.x + o.w - 2]) { ctx.moveTo(x, o.y - 6); ctx.lineTo(x, bottom); }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = o.y + 4; y < bottom; y += 12) { ctx.moveTo(o.x + 2, y); ctx.lineTo(o.x + o.w - 2, y); }
    ctx.stroke();
    return;
  }
  const sway = y => Math.sin(time / 700 + y / 40) * 2.5 * ((y - o.y) / o.h);
  ctx.strokeStyle = look === 'vine' ? p.rockEdge : p.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, o.y - 6);
  for (let y = o.y; y <= bottom; y += 6) ctx.lineTo(cx + sway(y), y);
  ctx.stroke();
  ctx.fillStyle = look === 'vine' ? p.rockEdge : p.ink;
  for (let y = o.y + 10, k = 0; y < bottom; y += 22, k++) {
    ctx.beginPath();
    if (look === 'vine') ctx.ellipse(cx + sway(y) + (k % 2 ? 6 : -6), y, 6, 3, k % 2 ? 0.5 : -0.5, 0, TAU);
    else ctx.arc(cx + sway(y), y, 3, 0, TAU);
    ctx.fill();
  }
}

function playerOf(level, state) {
  const { w, h } = playerSize(level.rules);
  return { x: state.x, y: state.y, w, h };
}

function drawArrows(ctx, p, state) {
  for (const a of state.flying) {
    const tail = a.dir > 0 ? a.x : a.x + 14, head = a.dir > 0 ? a.x + 14 : a.x, y = a.y + 1.5;
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tail, y); ctx.lineTo(head, y); ctx.stroke();
    ctx.fillStyle = ITEM_COLORS.bow;
    ctx.beginPath(); ctx.moveTo(head + a.dir * 4, y); ctx.lineTo(head - a.dir * 2, y - 3.5); ctx.lineTo(head - a.dir * 2, y + 3.5); ctx.closePath(); ctx.fill();
  }
}

function paintGate(ctx, p, theme, level, o, state, time) {
  const on = phaseOn(o, state.clock);
  const t = cycleAt(o, state.clock);
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
    strokeDashed(ctx, [6, 6], () => roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4));
  }
}

function paintPickup(ctx, p, theme, level, o, state, time) {
  if (state.flags & o.bit) return;
  const blur = lit(theme, 18);
  const image = sprite(`${o.type}:${p.accent}:${theme.outline}:${blur}`, 60, g => {
    g.shadowColor = p.accent;
    g.shadowBlur = blur;
    g.fillStyle = p.accent;
    g.beginPath();
    if (o.type === 'orb') g.arc(0, 0, 7, 0, TAU);
    else { g.moveTo(0, -10); g.lineTo(7, 0); g.lineTo(0, 10); g.lineTo(-7, 0); g.closePath(); }
    g.fill();
    if (theme.outline) { g.shadowBlur = 0; g.strokeStyle = p.ink; g.lineWidth = 1.5; g.stroke(); }
  });
  stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 300 + o.x) * 3);
}

const OBJECT_PAINTERS = {
  mover(ctx, p, theme, level, o, state) {
    ctx.strokeStyle = alpha(p.ink, 0.3);
    strokeDashed(ctx, [4, 6], () => {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
      ctx.lineTo(o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2);
    });
    drawPlatform(ctx, p, theme, objectRect(o, state.clock), p.rock);
  },
  conveyor: (ctx, p, theme, level, o, state) => drawConveyor(ctx, p, theme, o, state.clock),
  phase: paintGate,
  gate: paintGate,
  crumble(ctx, p, theme, level, o, state, time) {
    const gone = state.crumbled[o.slot];
    if (gone) {
      ctx.strokeStyle = alpha(p.ink, gone < 40 && Math.floor(time / 80) % 2 ? 0.7 : 0.18);
      ctx.lineWidth = 2;
      strokeDashed(ctx, [4, 6], () => roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 5));
      return;
    }
    drawPlatform(ctx, p, theme, o, p.rock);
    ctx.strokeStyle = p.rockDeep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = o.x + 10; x < o.x + o.w; x += 22) { ctx.moveTo(x, o.y + 4); ctx.lineTo(x + 5, o.y + 14); ctx.lineTo(x - 2, o.y + o.h - 3); }
    ctx.stroke();
  },
  door(ctx, p, theme, level, o, state) {
    if ((state.flags | state.pressed) & o.bit) return;
    roundRect(ctx, o.x + 3, o.y, o.w - 6, o.h, o.plate ? 3 : 4);
    ctx.fillStyle = p.accentSoft;
    ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (o.plate) {
      ctx.beginPath();
      for (let y = o.y + 10; y < o.y + o.h; y += 12) { ctx.moveTo(o.x + 6, y); ctx.lineTo(o.x + o.w - 6, y); }
      ctx.stroke();
      return;
    }
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2 - 4, 6, 0, TAU); ctx.fill();
    ctx.fillRect(o.x + o.w / 2 - 2, o.y + o.h / 2, 4, 12);
  },
  toggle(ctx, p, theme, level, o, state) {
    const solid = (((state.flags | state.pressed) & o.bit) !== 0) === o.on;
    ctx.lineWidth = 2;
    if (solid) {
      drawPlatform(ctx, p, theme, o, p.accentSoft);
      ctx.strokeStyle = p.accent;
      roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4);
      ctx.stroke();
    } else {
      ctx.strokeStyle = alpha(p.ink, 0.3);
      strokeDashed(ctx, [3, 7], () => roundRect(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 4));
    }
  },
  key: paintPickup,
  orb: paintPickup,
  switch(ctx, p, theme, level, o, state) {
    const pressed = (state.flags & o.bit) !== 0;
    ctx.fillStyle = p.rockEdge;
    ctx.fillRect(o.x - 4, o.y + o.h - 6, o.w + 8, 6);
    ctx.fillStyle = pressed ? p.dim : p.accent;
    roundRect(ctx, o.x, o.y + (pressed ? 8 : 2), o.w, o.h - (pressed ? 14 : 8), 4);
    ctx.fill();
  },
  spikes(ctx, p, theme, level, o) {
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
  },
  monster: (ctx, p, theme, level, o, state, time) => drawMonster(ctx, p, theme, level, o, state, time, playerOf(level, state)),
  shot(ctx, p, theme, level, o, state) {
    if (slain(state, level.objects[o.source])) return;
    const rect = objectRect(o, state.clock), blur = lit(theme, 14);
    const image = sprite(`shot:${p.hazard}:${p.text}:${rect.w}:${blur}`, rect.w + 36, g => {
      g.shadowColor = p.hazard;
      g.shadowBlur = blur;
      g.fillStyle = p.hazard;
      g.beginPath(); g.arc(0, 0, rect.w / 2, 0, TAU); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = alpha(p.text, 0.8);
      g.beginPath(); g.arc(0, 0, rect.w / 5, 0, TAU); g.fill();
    });
    stamp(ctx, image, rect.x + rect.w / 2, rect.y + rect.h / 2);
  },
  saw: (ctx, p, theme, level, o, state) => drawSaw(ctx, p, theme, o, state.clock),
  laser(ctx, p, theme, level, o, state) {
    const on = phaseOn(o, state.clock);
    const t = cycleAt(o, state.clock);
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
      strokeDashed(ctx, [4, 8], () => { ctx.beginPath(); ctx.moveTo(cx, o.y); ctx.lineTo(cx, o.y + o.h); });
    }
  },
  spring: (ctx, p, theme, level, o, state, time) => drawSpring(ctx, p, o, time, playerOf(level, state)),
  bumper: (ctx, p, theme, level, o, state, time) => drawBumper(ctx, p, theme, o, time, playerOf(level, state)),
  gravpad(ctx, p, theme, level, o) {
    const cx = o.x + o.w / 2;
    ctx.fillStyle = p.accent;
    roundRect(ctx, o.x, o.y, o.w, o.h, 3);
    ctx.fill();
    ctx.fillStyle = p.bgTop;
    ctx.beginPath();
    const tip = o.dir < 0 ? o.y + 1 : o.y + o.h - 1, base = o.dir < 0 ? o.y + o.h - 1 : o.y + 1;
    ctx.moveTo(cx - 5, base); ctx.lineTo(cx, tip); ctx.lineTo(cx + 5, base); ctx.closePath(); ctx.fill();
  },
  wind(ctx, p, theme, level, o, state, time) {
    const lift = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    lift.addColorStop(0, alpha(p.ink, o.ay < 0 ? 0.14 : 0.04));
    lift.addColorStop(1, alpha(p.ink, 0.03));
    ctx.fillStyle = lift;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = alpha(p.ink, 0.5);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
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
  },
  water(ctx, p, theme, level, o, state, time) {
    ctx.fillStyle = p.water;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = p.waterLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = o.x; x <= o.x + o.w; x += 6) ctx.lineTo(x, o.y + Math.sin(x / 14 + time / 250) * 2);
    ctx.stroke();
  },
  plate(ctx, p, theme, level, o, state) {
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
  },
  coin(ctx, p, theme, level, o, state, time) {
    if (state.coins & (1 << o.slot)) return;
    const blur = lit(theme, 10);
    const image = sprite(`coin:${blur}`, 40, g => {
      g.shadowColor = COIN_COLOR;
      g.shadowBlur = blur;
      g.fillStyle = COIN_COLOR;
      g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'hsl(40 90% 40% / 0.8)';
      g.lineWidth = 1.5;
      g.stroke();
    });
    const spin = Math.max(0.2, Math.abs(Math.cos(time / 180 + o.x / 40)));
    stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 260 + o.x) * 2, spin);
  },
  item(ctx, p, theme, level, o, state, time) {
    if (state.taken & (1 << o.slot)) return;
    const image = sprite(`item:${o.kind}`, 48, g => {
      const halo = g.createRadialGradient(0, 0, 2, 0, 0, 22);
      halo.addColorStop(0, alpha(ITEM_COLORS[o.kind], 0.55));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = halo;
      g.fillRect(-22, -22, 44, 44);
      drawItemIcon(g, o.kind, 0, 0);
    });
    stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 280 + o.x) * 3);
  },
  hook(ctx, p, theme, level, o, state) {
    const { x, y } = hookAnchor(o);
    const { w, h } = playerSize(level.rules);
    const near = state.rope < 0 && Math.hypot(state.x + w / 2 - x, state.y + h / 2 - y) <= o.reach;
    if (near) {
      ctx.strokeStyle = alpha(p.accent, 0.25);
      strokeDashed(ctx, [3, 6], () => { ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, o.reach, 0, TAU); });
    }
    const blur = lit(theme, near ? 14 : 4);
    const image = sprite(`hook:${p.accent}:${blur}`, 48, g => {
      g.shadowColor = p.accent;
      g.shadowBlur = blur;
      g.strokeStyle = p.accent;
      g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.stroke();
    });
    stamp(ctx, image, x, y);
  },
  climb: (ctx, p, theme, level, o, state, time) => drawClimb(ctx, p, theme.climb, o, time),
  portal(ctx, p, theme, level, o, state, time) {
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(time / 600);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    glow(ctx, theme, p.accent, 14);
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 17, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  },
};

function drawObject(ctx, p, theme, level, o, state, time) {
  if (crushed(level, state, o)) {
    ctx.fillStyle = o.type === 'saw' ? p.hazardGlow : p.dim;
    const rect = objectRect(o, state.clock);
    ctx.fillRect(rect.x, rect.y + rect.h - 4, rect.w, 4);
    return;
  }
  OBJECT_PAINTERS[o.type]?.(ctx, p, theme, level, o, state, time);
}

function drawPlaced(ctx, p, theme, rect, time, valid = true) {
  ctx.save();
  if (!valid) ctx.globalAlpha = 0.45;
  if (rect.kind === 'ladder') {
    ctx.globalAlpha *= 0.9;
    drawClimb(ctx, { ...p, ink: valid ? p.accent : p.hazard }, 'ladder', rect, time);
  } else if (rect.kind === 'trampoline') {
    drawSpring(ctx, p, rect, time, null, valid ? p.accent : p.hazard);
  } else {
    drawPlatform(ctx, p, theme, rect, valid ? p.accentSoft : p.hazardGlow);
    ctx.strokeStyle = valid ? p.accent : p.hazard;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    roundRect(ctx, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBlinkPreview(ctx, p, level, state, to, time) {
  const { w, h } = playerSize(level.rules);
  ctx.save();
  ctx.globalAlpha = 0.45 + 0.2 * Math.sin(time / 120);
  ctx.strokeStyle = p.player;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  roundRect(ctx, to.x, to.y, w, h, 6);
  ctx.stroke();
  ctx.setLineDash([2, 5]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(state.x + w / 2, state.y + h / 2); ctx.lineTo(to.x + w / 2, to.y + h / 2); ctx.stroke();
  ctx.restore();
}

function drawAim(ctx, p, theme, level, state, aim, time) {
  if (aim.kind === 'erase') {
    ctx.strokeStyle = aim.object ? p.hazard : alpha(p.text, 0.5);
    ctx.lineWidth = 2;
    strokeDashed(ctx, [4, 4], () => {
      if (aim.object) { const r = objectRect(aim.object, state.clock); roundRect(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 6); }
      else { ctx.beginPath(); ctx.arc(aim.x, aim.y, 10, 0, TAU); }
    });
    return;
  }
  if (aim.kind === 'flag') {
    const { w, h } = playerSize(level.rules);
    ctx.save();
    ctx.globalAlpha = aim.ok ? 0.8 : 0.35;
    drawFlag(ctx, p, { x: state.x + w / 2 - 12, y: state.y + h - 40, w: 24, h: 40 }, true, time);
    ctx.restore();
    return;
  }
  const rect = aim.rect ?? placedAt(aim.kind, aim.x, aim.y);
  if (aim.kind === 'ladder' && !aim.rect) rect.h = 6 * TILE;
  drawPlaced(ctx, p, theme, rect, time, !!aim.rect);
}

function drawComboLine(ctx, p, floor) {
  ctx.save();
  ctx.strokeStyle = alpha(p.accent, 0.55);
  ctx.lineWidth = 1.5;
  strokeDashed(ctx, [10, 8], () => { ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(WIDTH, floor); });
  ctx.font = font(700, 11);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'hsl(240 30% 8% / 0.7)';
  ctx.strokeText('COMBO LINE', WIDTH - 12, floor - 3);
  ctx.fillStyle = p.accent;
  ctx.fillText('COMBO LINE', WIDTH - 12, floor - 3);
  ctx.restore();
}

function drawCombo(ctx, p, state, combo, w, h) {
  const links = combo.pop?.links ?? combo.links;
  if (combo.links < COMBO_FROM && !(combo.pop && combo.pop.age < 40 && links >= COMBO_FROM)) return;
  const pop = combo.pop && combo.pop.age < 12 ? 1 - combo.pop.age / 12 : 0;
  const cx = state.x + w / 2, top = state.gravDir > 0 ? state.y - 10 : state.y + h + 22;
  ctx.save();
  ctx.translate(cx, top);
  ctx.scale(1 + pop * 0.7, 1 + pop * 0.7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = font(800, 16 + Math.min(14, links));
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'hsl(240 30% 8% / 0.7)';
  ctx.fillStyle = p.accent;
  ctx.strokeText(`×${links}`, 0, 0);
  ctx.fillText(`×${links}`, 0, 0);
  ctx.restore();
  if (combo.pop?.word && combo.pop.wordAge < 60) {
    const t = combo.pop.wordAge / 60;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.translate(cx, top - 28 - t * 26);
    ctx.scale(1 + (1 - Math.min(1, t * 6)) * 0.6, 1 + (1 - Math.min(1, t * 6)) * 0.6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = font(900, 24);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'hsl(240 30% 8% / 0.75)';
    ctx.fillStyle = 'hsl(48 100% 70%)';
    ctx.strokeText(combo.pop.word.toUpperCase() + '!', 0, 0);
    ctx.fillText(combo.pop.word.toUpperCase() + '!', 0, 0);
    ctx.restore();
  }
}

function drawFlag(ctx, p, o, touched, time) {
  const x = o.x + 5, top = o.y + 4, bottom = o.y + o.h;
  const wave = Math.sin(time / 180 + o.x) * 2;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  ctx.fillStyle = touched ? p.accent : alpha(p.dim, 0.5);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 16, top + 6 + wave); ctx.lineTo(x, top + 13); ctx.closePath(); ctx.fill();
}

function verticalSpan(o) {
  const dy = o.period ? o.dy ?? 0 : 0;
  return [o.y + Math.min(0, dy), o.y + o.h + Math.max(0, dy)];
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
    case 'rain': return { x: rand() * (WIDTH + 200), y: -10, vx: -1.5, vy: 9 + rand() * 4, size: 1, alpha: 0.35, sway: 0, wobble: 0, shape: 'streak', trail: 2 };
    case 'sprinkles': return { x: rand() * WIDTH, y: -10, vx: 0.2, vy: 0.8 + rand() * 0.6, size: 2, alpha: 0.8, sway: rand() * TAU, shape: 'streak', trail: 5 };
    case 'code': return { x: Math.floor(rand() * WIDTH / 16) * 16 + 4, y: -10, vx: 0, vy: 1.5 + rand() * 2.5, size: 14, alpha: 0.6, sway: 0, wobble: 0, shape: 'glyph', glyph: GLYPHS[Math.floor(rand() * GLYPHS.length)] };
    case 'fog': return { x: -10, y: rand() * HEIGHT, vx: 0.25 + rand() * 0.3, vy: 0, size: 30 + rand() * 40, alpha: 0.07, sway: rand() * TAU };
    case 'petals': return { x: rand() * WIDTH, y: -10, vx: 0.3 + rand() * 0.4, vy: 0.4 + rand() * 0.5, size: 2.5 + rand(), alpha: 0.85, sway: rand() * TAU };
    case 'lanterns': return { x: rand() * WIDTH, y: HEIGHT + 10, vx: 0.1 + rand() * 0.2, vy: -0.25 - rand() * 0.35, size: 2.5 + rand() * 2, alpha: 0.85, sway: rand() * TAU, twinkle: true };
    case 'leaves': return { x: rand() * WIDTH, y: -10, vx: 0.4 + rand() * 0.5, vy: 0.5 + rand() * 0.6, size: 3 + rand() * 2, alpha: 0.8, sway: rand() * TAU, wobble: 0.8, shape: 'streak', trail: 3 };
    default: return null;
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const bar = { level: null, key: null, items: null };
  const skies = { palette: null, sky: null, bucket: -1, air: null, stars: 0 };
  const layers = new WeakMap();
  let ambient = { level: null, particles: [] };
  const rand = Math.random;

  function layerFor(level) {
    let layer = layers.get(level);
    if (!layer) {
      const theme = themeFor(level);
      const palette = theme.palette(level.palette);
      const decor = growDecor(level);
      layer = { theme, palette, decor, tiles: renderTiles(level, theme, palette, decor), backdrop: renderBackdrop(level, theme, palette), life: growLife(level, theme) };
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

  let scale = 1;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const viewport = window.visualViewport ?? { width: window.innerWidth, height: window.innerHeight };
    scale = Math.min(viewport.width / WIDTH, viewport.height / (HEIGHT + BAR_H));
    canvas.width = Math.floor(WIDTH * scale * dpr);
    canvas.height = Math.floor((HEIGHT + BAR_H) * scale * dpr);
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${(HEIGHT + BAR_H) * scale}px`;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  function drawAmbient(level, theme, p, time) {
    const particles = ambientFor(level, theme);
    particles.forEach((a, i) => {
      a.x += a.vx + Math.sin(time / 900 + a.sway) * (a.wobble ?? 0.3);
      a.y += a.vy;
      if (a.y < -12 || a.y > HEIGHT + 12 || a.x > WIDTH + 12 || a.x < -12) particles[i] = { ...spawnAmbient(theme.ambient, rand) };
      ctx.globalAlpha = a.alpha * (a.twinkle ? 0.4 + 0.6 * Math.abs(Math.sin(time / 400 + a.sway)) : 1);
      ctx.fillStyle = ctx.strokeStyle = p[theme.mote];
      drawParticle(a);
    });
    ctx.globalAlpha = 1;
  }

  function drawParticle(a) {
    if (a.shape === 'streak') {
      ctx.lineWidth = a.size;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - a.vx * a.trail, a.y - a.vy * a.trail); ctx.stroke();
    } else if (a.shape === 'glyph') {
      ctx.font = `${a.size}px monospace`;
      ctx.fillText(a.glyph, a.x, a.y);
    } else {
      ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, TAU); ctx.fill();
    }
  }

  function drawSky(p, altitude, camera) {
    if (skies.palette !== p) {
      skies.palette = p;
      skies.sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      skies.sky.addColorStop(0, p.bgTop);
      skies.sky.addColorStop(1, p.bgBottom);
    }
    veil(ctx, skies.sky);
    const bucket = Math.round(altitude / 10);
    if (skies.bucket !== bucket) {
      const tint = altitudeTint(bucket * 10);
      skies.bucket = bucket;
      skies.stars = tint.stars;
      skies.air = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      skies.air.addColorStop(0, tint.top);
      skies.air.addColorStop(1, tint.bottom);
    }
    veil(ctx, skies.air);
    if (skies.stars > 0) {
      const stars = seededNoise(97);
      ctx.fillStyle = 'white';
      for (let i = 0; i < 90; i++) {
        const x = stars() * WIDTH, y = (((stars() * HEIGHT * 2 - camera * 0.05) % HEIGHT) + HEIGHT) % HEIGHT;
        ctx.globalAlpha = skies.stars * (0.3 + stars() * 0.7);
        ctx.fillRect(x, y, stars() < 0.15 ? 2 : 1, stars() < 0.15 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawBackdrop(layer, top, bottom, floor) {
    if (bottom <= 0 || top >= HEIGHT) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, Math.max(0, top), WIDTH, Math.min(HEIGHT, bottom) - Math.max(0, top));
    ctx.clip();
    const drift = (floor - HEIGHT) * PARALLAX;
    if (hasHorizon(layer.theme.background)) {
      ctx.drawImage(layer.backdrop, 0, drift);
    } else {
      const shift = ((drift % HEIGHT) + HEIGHT) % HEIGHT;
      ctx.drawImage(layer.backdrop, 0, shift - HEIGHT);
      ctx.drawImage(layer.backdrop, 0, shift);
    }
    ctx.restore();
  }

  function drawBiome(level, state, offset, view, current) {
    const layer = layerFor(level);
    const { palette: p, theme } = layer;
    const { time, ghost, trail } = view;
    drawLife(ctx, layer.life, p, offset, view.camera, time);
    const top = view.camera - offset - CULL_MARGIN, bottom = top + HEIGHT + 2 * CULL_MARGIN;
    if (!current && (bottom < 0 || top > level.height)) return;
    ctx.save();
    ctx.translate(0, offset - view.camera);
    const home = homeOf(level);
    if (home) drawHome(ctx, home, time, current && !view.wardrobe && atWardrobe(home, level, state));
    ctx.drawImage(layer.tiles, 0, 0);
    if (level.hall) drawHall(ctx, level, p, theme, time, state);
    if (!level.hall) { drawMouths(ctx, level, p, time); drawSignpost(ctx, level, p, theme, time, current && view.freeGear); }
    const { w: pw, h: ph } = playerSize(level.rules);
    if (!level.hall) drawDecor(ctx, layer.decor, p, { time, playerX: state.x + pw / 2, playerY: state.y + ph / 2, top, bottom });
    const shown = level.objects.filter(o => { const [y0, y1] = verticalSpan(o); return y1 >= top && y0 <= bottom && !erased(state, o); });
    const backdrop = o => o.type === 'water' || o.type === 'wind';
    for (const o of shown) if (backdrop(o)) drawObject(ctx, p, theme, level, o, state, time);
    for (const o of shown) if (!backdrop(o)) drawObject(ctx, p, theme, level, o, state, time);
    for (const o of shown) if (o.type === 'checkpoint') drawFlag(ctx, p, o, current && view.touched.includes(o.id), time);
    if (current) for (const flag of view.planted ?? []) drawFlag(ctx, p, flag, true, time);
    for (const rect of state.placed) drawPlaced(ctx, p, theme, rect, time);
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
      drawArrows(ctx, p, state);
      if (Number.isFinite(view.combo?.floor)) drawComboLine(ctx, p, view.combo.floor);
      if (!state.dead) {
        drawPlayer(ctx, p, theme, level, state, 1, view.avatar);
        drawPowers(ctx, level, state, time);
        if (view.combo) drawCombo(ctx, p, state, view.combo, w, h);
      }
      if (view.aim) drawAim(ctx, p, theme, level, state, view.aim, time);
      if (view.blink) drawBlinkPreview(ctx, p, level, state, view.blink, time);
      const rival = view.rival;
      if (rival?.state && rival.index === view.biomeIndex && !rival.state.dead) drawRival(ctx, p, theme, level, rival.state);
    }
    drawBodies(ctx, p, theme, level, state);
    drawFlood(ctx, p, level, state, time);
    if (current) drawParticles(view.particles);
    ctx.restore();
  }

  function drawParticles(particles) {
    for (const q of particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.maxLife) * (q.puff ? 0.55 : 1);
      ctx.fillStyle = q.color;
      if (q.puff) { ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill(); }
      else ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawDarkness(state, level, camera, light) {
    const { w, h } = playerSize(level.rules);
    const cx = state.x + w / 2, cy = state.y + h / 2 - camera;
    const dark = ctx.createRadialGradient(cx, cy, LIGHT.inner * light, cx, cy, LIGHT.outer * light);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(0.6, 'rgba(0,0,0,0.85)');
    dark.addColorStop(1, 'rgba(0,0,0,0.985)');
    veil(ctx, dark);
  }

  function draw(view) {
    const { level, state, flash, frozen, camera, below, above, altitude } = view;
    const { palette: p, theme } = layerFor(level);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT);
    ctx.clip();
    if (view.shake > 0) ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    drawSky(p, altitude, camera);
    const floor = level.height - camera;
    drawBackdrop(layerFor(level), -camera, floor + (below ? 0 : HEIGHT), floor);
    if (above) drawBackdrop(layerFor(above.level), -camera - above.level.height, -camera, -camera);
    if (below) drawBackdrop(layerFor(below.level), floor, floor + below.level.height, floor + below.level.height);
    drawAmbient(level, theme, p, view.time);
    if (above) drawBiome(above.level, above.state, -above.level.height, view, false);
    if (below) drawBiome(below.level, below.state, level.height, view, false);
    drawBiome(level, state, 0, view, true);
    if (level.rules.darkness) drawDarkness(state, level, camera, view.light ?? 1);
    if (frozen) veil(ctx, 'rgba(120,130,160,0.22)');
    if (flash > 0) veil(ctx, `rgba(255,255,255,${flash})`);
    ctx.restore();
    if (view.backdrop) return;
    const hud = level.hall ? { ...p, text: BRIGHT_TEXT, dim: HALL_DIM } : p;
    drawMeter(ctx, view, hud);
    drawHud(ctx, view, hud);
    if (view.stall) drawStallBubble(ctx, view.stall, p, view.stall.age);
    if (view.levelUp) drawLevelUp(ctx, view.levelUp);
    drawTooltip(ctx, view.pointer);
    if (view.over) drawGameOver(ctx, view, p);
    if (view.quitting) drawQuitPrompt(ctx, view, p);
    if (view.wardrobe) drawWardrobe(ctx, view, p, theme);
    drawControls(ctx, bar, level, view.keys, p, view.muted, state);
  }

  return { fit, draw, drawLoading: building => drawLoading(ctx, building), paletteFor: level => layerFor(level).palette, pointer: event => ({ x: event.offsetX / scale, y: event.offsetY / scale }) };
}
