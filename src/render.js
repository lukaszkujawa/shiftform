import { blockById, TIMING_STEPS } from './blueprint.js?v=ac45b7e';
import { TILE, COLS, WIDTH, HEIGHT, SOLID, ONE_WAY, EMPTY, WATER_TILE, roomAt, addObject, tileAt, objectRect, hazardRect, phaseOn, floodLevel, levelIndex, crushed, slain, erased, cycleAt, doorOpen, lockPowered, gateOutput, gatePins } from './level.js?v=ac45b7e';
import { placedAt } from './tricks.js?v=ac45b7e';
import { COMBO_FROM } from './combo.js?v=ac45b7e';
import { initialState, playerSize, hookAnchor, cannonAim, cometLift, shieldsUp } from './physics.js?v=ac45b7e';
import { laserBeam, bodyRects, afloat, swellPhase } from './bodies.js?v=ac45b7e';
import { THEMES, themeFor, alpha, shade, tint } from './themes.js?v=ac45b7e';
import { growDecor, paintDecor, drawDecor } from './decor.js?v=ac45b7e';
import { growStructure } from './structures.js?v=ac45b7e';
import { renderStructure, drawStructureMotion } from './structure-art.js?v=ac45b7e';
import { growLife, drawLife } from './life.js?v=ac45b7e';
import { glow, lit, sprite, stamp } from './sprites.js?v=ac45b7e';
import { drawMonster, drawLurker } from './monsters.js?v=ac45b7e';
import { drawSpring, drawBumper, drawSaw, drawConveyor } from './gadgets.js?v=ac45b7e';
import { drawSpikes, drawFlame, KILLER_ART } from './hazard-art.js?v=ac45b7e';
import { seededNoise, renderBackdrop, hasHorizon, PATTERNS, GLYPHS } from './backdrops.js?v=ac45b7e';
import { ITEM_COLORS, COIN_COLOR, BRIGHT_TEXT, drawItemIcon } from './icons.js?v=ac45b7e';
import { drawPlayer } from './player-art.js?v=ac45b7e';
import { BAR_H, drawMeter, drawHud, drawControls, drawQuitPrompt, drawGameOver, drawLoading, drawLevelUp, drawPerfect } from './hud.js?v=ac45b7e';
import { altitudeY } from './climb.js?v=ac45b7e';
import { drawArm, drawHookRope, gripOffset, noteClimber, swayOf } from './rigging.js?v=ac45b7e';
import { TAU, contactShadow, font, glint, roundRect, slab, strokeDashed, veil } from './paint.js?v=ac45b7e';
import { homeOf, atWardrobe, drawHome } from './home.js?v=ac45b7e';
import { drawWardrobe } from './wardrobe.js?v=ac45b7e';
import { drawMouths, drawHall } from './hall-art.js?v=ac45b7e';
import { drawStallBubble } from './stall-ui.js?v=ac45b7e';
import { drawTooltip } from './tooltip.js?v=ac45b7e';
import { drawSignpost, drawClimbSign } from './signpost.js?v=ac45b7e';
import { drawGod } from './god.js?v=ac45b7e';
import { drawImp } from './imp.js?v=ac45b7e';

export { ITEM_COLORS } from './icons.js?v=ac45b7e';
export { inventoryHit, promptHit } from './hud.js?v=ac45b7e';

const CULL_MARGIN = 160;
const PARALLAX = 0.3;
const HALL_DIM = 'hsl(240 12% 72% / 1)';
const LIGHT = { inner: 40, outer: 170 };
const LAYERS_KEPT = 6;

const TILE_SHADE = 'hsl(240 35% 8% / 0.13)';
const TILE_SHINE = 'hsl(0 0% 100% / 0.4)';
const TILE_CAST = { shadowColor: 'hsl(240 35% 8% / 0.42)', shadowBlur: 8, shadowOffsetX: 3, shadowOffsetY: 7 };

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
        slab(ctx, x, y, TILE, 8, 3, p.rockEdge, theme.outline ? p.ink : null, 1.5);
        continue;
      }
      ctx.fillStyle = p.rock;
      ctx.fillRect(x, y, TILE, TILE);
      PATTERNS[theme.pattern](ctx, p, x, y, rand);
    }
  }

  const bothFaces = level.rules.jumpFlipChance > 0;
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
      ctx.fillStyle = TILE_SHADE;
      if (bottom) { ctx.fillRect(x, y + TILE - 8, TILE, 8); ctx.fillRect(x, y + TILE - 4, TILE, 4); }
      if (right) ctx.fillRect(x + TILE - 4, y, 4, TILE);
      if (lipTop) ctx.fillRect(x, y + 4, TILE, 3);
      ctx.fillStyle = p.rockEdge;
      if (lipTop) ctx.fillRect(x, y, TILE, theme.hollow ? 3 : 4);
      if (lipTop && !theme.hollow) { ctx.fillStyle = TILE_SHINE; ctx.fillRect(x, y, TILE, 1.5); ctx.fillStyle = p.rockEdge; }
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
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  Object.assign(ctx, TILE_CAST);
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
  return canvas;
}

function drawPlatform(ctx, p, theme, rect, style) {
  if (style === p.rock) contactShadow(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  slab(ctx, rect.x, rect.y, rect.w, rect.h, 5, style, theme.outline ? p.ink : style === p.rock ? shade(p.rock, -10) : null, theme.outline || 1.2);
  ctx.fillStyle = p.rockEdge;
  ctx.fillRect(rect.x + 3, rect.y, rect.w - 6, 3);
}

function drawRivets(ctx, color, points) {
  ctx.fillStyle = color;
  for (const [x, y] of points) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
}


const CRATE_LOOKS = {
  wood: { fill: 'hsl(32 55% 46%)', ink: 'hsl(28 50% 26%)' },
  steel: { fill: 'hsl(210 12% 64%)', ink: 'hsl(212 16% 34%)' },
  stone: { fill: 'hsl(30 6% 38%)', ink: 'hsl(30 8% 20%)' },
};

function drawCrate(ctx, theme, p, kind, x, y, size) {
  const look = CRATE_LOOKS[kind];
  slab(ctx, x, y, size, size, kind === 'stone' ? 6 : 3, look.fill, theme.outline ? p.ink : look.ink, kind === 'stone' ? 2.5 : 2);
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'wood') {
    ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + size - 5, y + size - 5);
    ctx.moveTo(x + 3, y + 5); ctx.lineTo(x + size - 3, y + 5);
    ctx.moveTo(x + 3, y + size - 5); ctx.lineTo(x + size - 3, y + size - 5);
    ctx.stroke();
  } else if (kind === 'steel') {
    drawRivets(ctx, look.ink, [[x + 5, y + 5], [x + size - 5, y + 5], [x + 5, y + size - 5], [x + size - 5, y + size - 5]]);
    ctx.fillStyle = look.ink;
    ctx.fillRect(x + 7, y + size / 2 - 1, size - 14, 2);
    ctx.fillStyle = 'hsl(0 0% 100% / 0.45)';
    ctx.fillRect(x + 7, y + size / 2 + 1, size - 14, 1);
  } else {
    ctx.moveTo(x + size * 0.3, y + 3); ctx.lineTo(x + size * 0.45, y + size * 0.45); ctx.lineTo(x + size * 0.25, y + size * 0.7);
    ctx.moveTo(x + size * 0.45, y + size * 0.45); ctx.lineTo(x + size * 0.8, y + size * 0.6);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

const ROCK = 0.05;

function drawBodies(ctx, p, theme, level, state) {
  const crates = levelIndex(level).crates;
  state.bodies.forEach((b, k) => {
    if (b.gone) return;
    const crate = crates[k];
    if (k === state.held || !afloat(level, b, crate)) return drawCrate(ctx, theme, p, crate.kind, b.x, b.y, crate.w);
    ctx.save();
    ctx.translate(b.x + crate.w / 2, b.y + crate.w / 2);
    ctx.rotate(Math.cos(swellPhase(b, state.clock)) * ROCK);
    drawCrate(ctx, theme, p, crate.kind, -crate.w / 2, -crate.w / 2, crate.w);
    ctx.restore();
  });
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
  const shielded = state.shield || shieldsUp(level.rules, state) > 0;
  if (shielded || state.invuln > 0) {
    ctx.strokeStyle = `hsl(210 90% 75% / ${shielded ? 0.55 + Math.sin(time / 200) * 0.15 : (state.invuln % 10 < 5 ? 0.6 : 0.1)})`;
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
  ctx.textBaseline = 'top';
  ctx.font = font(800, 13 + Math.round(heat * 6));
  ctx.fillStyle = state.cometMissed ? 'hsl(0 85% 65%)' : `hsl(${hue} 100% 75%)`;
  ctx.fillText(state.cometMissed ? (state.cometEarly ? 'early!' : 'late!') : state.cometWait > 0 ? 'NOW' : `×${state.comet}`, cx, cy + h * 0.9 + 8);
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

const CAST_INK = 'hsl(240 35% 8% / 0.25)';
const SHEEN = 'hsl(0 0% 100% / 0.35)';

function drawClimb(ctx, p, look, o, time) {
  const cx = o.x + o.w / 2, bottom = o.y + o.h;
  ctx.lineCap = 'round';
  if (look === 'ladder') {
    const trace = dx => {
      ctx.beginPath();
      for (const x of [o.x + 2, o.x + o.w - 2]) { ctx.moveTo(x + dx, o.y - 6 + dx); ctx.lineTo(x + dx, bottom); }
      for (let y = o.y + 4; y < bottom; y += 12) { ctx.moveTo(o.x + 2 + dx, y + dx); ctx.lineTo(o.x + o.w - 2 + dx, y + dx); }
      ctx.stroke();
    };
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = CAST_INK;
    trace(1.5);
    ctx.strokeStyle = p.ink;
    trace(0);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = SHEEN;
    trace(-0.5);
    return;
  }
  const sway = y => Math.sin(time / 700 + y / 40) * 2.5 * ((y - o.y) / o.h);
  const strand = dx => {
    ctx.beginPath();
    ctx.moveTo(cx + dx, o.y - 6);
    for (let y = o.y; y <= bottom; y += 6) ctx.lineTo(cx + sway(y) + dx, y);
    ctx.stroke();
  };
  ctx.lineWidth = 3;
  ctx.strokeStyle = CAST_INK;
  strand(1.5);
  ctx.strokeStyle = look === 'vine' ? p.rockEdge : p.ink;
  strand(0);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = SHEEN;
  strand(-0.6);
  ctx.fillStyle = look === 'vine' ? p.rockEdge : p.ink;
  for (let y = o.y + 10, k = 0; y < bottom; y += 22, k++) {
    ctx.beginPath();
    if (look === 'vine') ctx.ellipse(cx + sway(y) + (k % 2 ? 6 : -6), y, 6, 3, k % 2 ? 0.5 : -0.5, 0, TAU);
    else ctx.arc(cx + sway(y), y, 3, 0, TAU);
    ctx.fill();
    glint(ctx, cx + sway(y) + (look === 'vine' ? (k % 2 ? 4 : -8) : -1), y - 1, 0.9);
    ctx.fillStyle = look === 'vine' ? p.rockEdge : p.ink;
  }
}

function playerOf(level, state) {
  const { w, h } = playerSize(level.rules);
  return { x: state.x, y: state.y, w, h };
}

const touchersOf = (level, state) => [playerOf(level, state), ...bodyRects(level, state.bodies)];

function drawArrows(ctx, p, state) {
  for (const a of state.flying) {
    ctx.save();
    ctx.translate(a.x + a.w / 2, a.y + a.h / 2);
    ctx.rotate(Math.atan2(a.vy, a.vx));
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.fillStyle = ITEM_COLORS.bow;
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(5, -3.5); ctx.lineTo(5, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
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
    slab(ctx, o.x, o.y, o.w, o.h, 4, 'hsl(0 0% 100% / 0)', p.accent, 2);
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
    const round = o.type === 'orb' || o.type === 'timer';
    if (round) g.arc(0, 0, 7, 0, TAU);
    else { g.moveTo(0, -10); g.lineTo(7, 0); g.lineTo(0, 10); g.lineTo(-7, 0); g.closePath(); }
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = theme.outline ? p.ink : p.accentDeep;
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = p.accentDeep;
    g.beginPath();
    if (round) { g.arc(0, 0, 6.2, 0.2, Math.PI * 0.85); g.closePath(); }
    else { g.moveTo(0, -9); g.lineTo(6, 0); g.lineTo(0, 9); g.closePath(); }
    g.fill();
    glint(g, -2.4, round ? -2.6 : -3, 1.5);
  });
  stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 300 + o.x) * 3);
}

function paintShutDoor(ctx, p, o) {
  slab(ctx, o.x + 3, o.y, o.w - 6, o.h, o.plate ? 3 : 4, p.accentSoft, p.accent, 2);
  if (o.plate) {
    ctx.strokeStyle = p.accent;
    ctx.beginPath();
    for (let y = o.y + 10; y < o.y + o.h; y += 12) { ctx.moveTo(o.x + 6, y); ctx.lineTo(o.x + o.w - 6, y); }
    ctx.stroke();
    ctx.strokeStyle = SHEEN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = o.y + 11.5; y < o.y + o.h; y += 12) { ctx.moveTo(o.x + 6, y); ctx.lineTo(o.x + o.w - 6, y); }
    ctx.stroke();
    return;
  }
  ctx.fillStyle = p.accent;
  ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2 - 4, 6, 0, TAU); ctx.fill();
  ctx.fillRect(o.x + o.w / 2 - 2, o.y + o.h / 2, 4, 12);
  glint(ctx, o.x + o.w / 2 - 2, o.y + o.h / 2 - 6, 1.4);
}

const GRIP_GLOW = 60;
const ROOM_METER_ALPHA = 0.35;
const HINT_ALPHA = 0.7;

function drawGripPath(ctx, p, o, x, y, sway) {
  const px = o.x + o.w / 2, py = o.y + o.h / 2;
  ctx.lineCap = 'round';
  if (o.motion === 'orbit') {
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(p.ink, 0.35);
    ctx.beginPath(); ctx.arc(px, py, Math.abs(o.dx), 0, TAU); ctx.stroke();
  }
  const arm = (color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (o.motion) return drawArm(ctx, px, py, x, y, sway);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.lineTo(px + o.dx, py + o.dy); ctx.stroke();
  };
  arm(CAST_INK, o.motion ? 6 : 4.5);
  arm(o.motion ? p.rockEdge : alpha(p.ink, 0.6), o.motion ? 4 : 2.5);
  arm(SHEEN, 1);
  ctx.fillStyle = p.rockDeep;
  for (const [ex, ey] of o.motion ? [[px, py]] : [[px, py], [px + o.dx, py + o.dy]]) { ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); ctx.fill(); glint(ctx, ex - 2, ey - 2, 1.2); }
}

const OBJECT_PAINTERS = {
  start(ctx, p, theme, level, o) {
    ctx.fillStyle = alpha(p.accent, 0.35);
    roundRect(ctx, o.x - 6, o.y + 4, o.w + 12, 6, 3);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y - 12); ctx.lineTo(o.x + o.w / 2 + 7, o.y); ctx.lineTo(o.x + o.w / 2 - 7, o.y); ctx.closePath(); ctx.fill();
  },
  goal(ctx, p, theme, level, o, state, time) {
    const cx = o.x + o.w / 2;
    glow(ctx, theme, p.accent, 16);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(o.x + 4, o.y + o.h); ctx.lineTo(o.x + 4, o.y + o.h / 2); ctx.arc(cx, o.y + o.h / 2, o.w / 2 - 4, Math.PI, 0); ctx.lineTo(o.x + o.w - 4, o.y + o.h); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = alpha(p.accent, 0.18 + 0.1 * Math.sin(time / 300));
    ctx.fill();
  },
  cannon(ctx, p, theme, level, o, state, time) {
    const held = state.barrel === o.id;
    const aim = cannonAim(o, held ? state.barrelAge : time / 16.67);
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(aim);
    if (held) glow(ctx, theme, p.accent, 16);
    roundRect(ctx, -o.w / 2 - 3, -o.h / 2 + 2, o.w + 6, o.h - 4, 8);
    ctx.fillStyle = p.rockDeep;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = held ? p.accent : p.rockEdge;
    ctx.fillRect(-o.w / 2 + 6, -o.h / 2 + 2, 5, o.h - 4);
    ctx.fillRect(-1, -o.h / 2 + 2, 5, o.h - 4);
    slab(ctx, -o.w / 2 - 3, -o.h / 2 + 2, o.w + 6, o.h - 4, 8, 'hsl(0 0% 100% / 0)', held ? p.accent : p.ink, 2);
    slab(ctx, o.w / 2 - 2, -o.h / 2 - 2, 8, o.h + 4, 2, p.ink);
    ctx.fillStyle = alpha(p.accent, 0.8);
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(o.w / 2 + i * 14, -5); ctx.lineTo(o.w / 2 + i * 14 + 6, 0); ctx.lineTo(o.w / 2 + i * 14, 5); ctx.fill(); }
    ctx.restore();
  },
  refill(ctx, p, theme, level, o, state, time) {
    const spent = (state.spent & (1 << o.slot)) !== 0;
    const blur = spent ? 0 : lit(theme, 16);
    const image = sprite(`refill:${p.accent}:${p.accentSoft}:${spent}:${blur}`, 48, g => {
      g.shadowColor = p.accent;
      g.shadowBlur = blur;
      g.strokeStyle = spent ? alpha(p.ink, 0.35) : p.accent;
      g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.stroke();
      g.shadowBlur = 0;
      if (!spent) {
        g.fillStyle = p.accentSoft;
        g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fill();
        g.strokeStyle = p.accentDeep;
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(0, 0, 8.5, 0.3, 2.2); g.stroke();
        glint(g, -5.5, -5.5, 1.5);
      }
    });
    stamp(ctx, image, o.x + o.w / 2, o.y + o.h / 2 + Math.sin(time / 260 + o.x) * 3);
  },
  cling(ctx, p, theme, level, o) {
    ctx.strokeStyle = alpha(p.accent, 0.8);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = o.y + 8; y < o.y + o.h - 4; y += 14) { ctx.moveTo(o.x + 1, y); ctx.lineTo(o.x + o.w - 1, y + 6); }
    ctx.stroke();
  },
  mover(ctx, p, theme, level, o, state) {
    ctx.strokeStyle = alpha(p.ink, 0.3);
    strokeDashed(ctx, [4, 6], () => {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
      ctx.lineTo(o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2);
    });
    drawRivets(ctx, alpha(p.ink, 0.4), [[o.x + o.w / 2, o.y + o.h / 2], [o.x + o.dx + o.w / 2, o.y + o.dy + o.h / 2]]);
    const rect = objectRect(o, state.clock);
    drawPlatform(ctx, p, theme, rect, p.rock);
    drawRivets(ctx, p.rockEdge, [[rect.x + 8, rect.y + rect.h / 2 + 1], [rect.x + rect.w - 8, rect.y + rect.h / 2 + 1]]);
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
    const cracks = dx => {
      ctx.beginPath();
      for (let x = o.x + 10; x < o.x + o.w; x += 22) { ctx.moveTo(x + dx, o.y + 4); ctx.lineTo(x + 5 + dx, o.y + 14); ctx.lineTo(x - 2 + dx, o.y + o.h - 3); }
      ctx.stroke();
    };
    ctx.lineWidth = 1;
    ctx.strokeStyle = SHEEN;
    cracks(1.5);
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.rockDeep;
    cracks(0);
    drawRivets(ctx, p.rockEdge, [[o.x + 6, o.y + o.h + 2], [o.x + o.w * 0.55, o.y + o.h + 3], [o.x + o.w - 9, o.y + o.h + 2]]);
  },
  door(ctx, p, theme, level, o, state) {
    if (o.timer !== undefined) {
      if (!doorOpen(o, state, state.clock)) return paintShutDoor(ctx, p, o);
      const left = o.open - (state.clock - state.timers[o.timer]);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, 9, -Math.PI / 2, -Math.PI / 2 + (TAU * left) / o.open); ctx.stroke();
      return;
    }
    if (lockPowered(o, state.flags | state.pressed)) return;
    paintShutDoor(ctx, p, o);
  },
  timer: paintPickup,
  toggle(ctx, p, theme, level, o, state) {
    const solid = lockPowered(o, state.flags | state.pressed) === o.on;
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
  lever(ctx, p, theme, level, o, state) {
    const on = (state.flags & o.bit) !== 0, cx = o.x + o.w / 2, base = o.y + o.h;
    slab(ctx, cx - 10, base - 7, 20, 7, 2, p.rockEdge, shade(p.rockEdge, -22), 1);
    const tipX = cx + (on ? 9 : -9), tipY = base - 21;
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, base - 6); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = on ? p.accent : p.dim;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, TAU); ctx.fill(); ctx.stroke();
    glint(ctx, tipX - 1.6, tipY - 1.8, 1.3);
  },
  switch(ctx, p, theme, level, o, state) {
    const pressed = (state.flags & o.bit) !== 0;
    slab(ctx, o.x, o.y + (pressed ? 8 : 2), o.w, o.h - (pressed ? 14 : 8), 4, pressed ? p.dim : p.accent, pressed ? null : p.accentDeep, 1);
    slab(ctx, o.x - 4, o.y + o.h - 6, o.w + 8, 6, 2, p.rockEdge, shade(p.rockEdge, -22), 1);
  },
  spikes: (ctx, p, theme, level, o, state, time) => drawSpikes(ctx, p, theme, o, time),
  monster: (ctx, p, theme, level, o, state, time) => drawMonster(ctx, p, theme, level, o, state, time, playerOf(level, state)),
  lurker: (ctx, p, theme, level, o, state, time) => drawLurker(ctx, p, theme, o, state, time, playerOf(level, state)),
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
  saw: (ctx, p, theme, level, o, state) => (KILLER_ART[o.kind] ? KILLER_ART[o.kind](ctx, p, o, state.clock) : drawSaw(ctx, p, theme, o, state.clock)),
  laser(ctx, p, theme, level, o, state, time) {
    if (o.kind === 'flame') return drawFlame(ctx, p, theme, o, state, time);
    const on = phaseOn(o, state.clock);
    const t = cycleAt(o, state.clock);
    const warming = !on && o.period - t < 24;
    const cx = o.x + o.w / 2;
    ctx.fillStyle = p.hazard;
    if (o.steady) slab(ctx, cx - 9, o.dir > 0 ? o.y : o.y + o.h - 5, 18, 5, 1.5, p.hazard);
    else { ctx.beginPath(); ctx.arc(cx, o.y + 4, 5, 0, TAU); ctx.arc(cx, o.y + o.h - 4, 5, 0, TAU); ctx.fill(); }
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
  spring: (ctx, p, theme, level, o, state, time) => drawSpring(ctx, p, o, time, touchersOf(level, state)),
  bumper: (ctx, p, theme, level, o, state, time) => drawBumper(ctx, p, theme, o, time, touchersOf(level, state)),
  gravpad(ctx, p, theme, level, o) {
    const cx = o.x + o.w / 2;
    slab(ctx, o.x, o.y, o.w, o.h, 3, p.accent, p.accentDeep, 1);
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
    const depth = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    depth.addColorStop(0, o.surface === false ? 'hsl(240 35% 8% / 0)' : 'hsl(0 0% 100% / 0.12)');
    depth.addColorStop(0.35, 'hsl(240 35% 8% / 0)');
    depth.addColorStop(1, 'hsl(240 35% 8% / 0.24)');
    ctx.fillStyle = depth;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = alpha(p.waterLine, 0.5);
    for (let k = 0; k * 34 < o.w; k++) {
      const rise = (time / 2400 + k * 0.29) % 1;
      ctx.beginPath(); ctx.arc(o.x + 12 + k * 34 + Math.sin(rise * 9 + k) * 3, o.y + o.h - 6 - rise * (o.h - 12), 1 + (k % 2) * 0.7, 0, TAU); ctx.fill();
    }
    if (o.surface === false) return;
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
    slab(ctx, o.x, o.y + (down ? 3 : 0), o.w, o.h - (down ? 4 : 2), 2, down ? p.accent : p.accentSoft, p.accent, 1.5);
    ctx.shadowBlur = 0;
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
      g.strokeStyle = 'hsl(40 90% 42% / 0.55)';
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, 0, 4, 0.2, Math.PI * 1.1); g.stroke();
      glint(g, -2.8, -3, 1.4);
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
    const anchor = hookAnchor(o, state.clock);
    const sway = o.grip ? swayOf(o, state) : null;
    const x = anchor.x + (sway?.x ?? 0), y = anchor.y + (sway?.y ?? 0);
    const { w, h } = playerSize(level.rules);
    if (o.grip) drawGripPath(ctx, p, o, x, y, sway);
    else drawHookRope(ctx, p, level, o, state);
    const near = state.rope < 0 && Math.hypot(state.x + w / 2 - anchor.x, state.y + h / 2 - anchor.y) <= (o.grip ? GRIP_GLOW : o.reach);
    if (near && !o.grip) {
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
      g.shadowBlur = 0;
      g.strokeStyle = p.accentDeep;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, 6.8, 0.2, 2); g.stroke();
      glint(g, -4.2, -4.2, 1.2);
    });
    stamp(ctx, image, x, y);
  },
  climb: (ctx, p, theme, level, o, state, time) => drawClimb(ctx, p, theme.climb, o, time),
  portal(ctx, p, theme, level, o, state, time) {
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(time / 600);
    ctx.fillStyle = 'hsl(240 35% 8% / 0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 17, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    glow(ctx, theme, p.accent, 14);
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 17, 0, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, 0, TAU); ctx.stroke();
    glint(ctx, -6, -11, 1.4);
    ctx.restore();
  },
};

const SIGNAL_HUES = [0, 150, 70, 240];
const signalPalettes = new Map();

function signalPalette(p, bit) {
  const shift = SIGNAL_HUES[Math.log2(bit) % SIGNAL_HUES.length];
  if (!shift) return p;
  const key = `${p.accent}:${shift}`;
  if (!signalPalettes.has(key)) signalPalettes.set(key, { ...p, accent: tint(p.accent, shift), accentSoft: tint(p.accentSoft, shift), accentDeep: tint(p.accentDeep, shift) });
  return signalPalettes.get(key);
}

function wireLive(level, wire, state) {
  if (wire.gate) return gateOutput(wire.gate, state.flags | state.pressed);
  return wire.bit ? ((state.flags | state.pressed) & wire.bit) !== 0 : state.timers[wire.timer] >= 0 && state.clock - state.timers[wire.timer] < levelIndex(level).timers[wire.timer].open;
}

function drawWires(ctx, p, theme, level, state, time) {
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (const wire of level.wires ?? []) {
    const color = wire.gate ? p.ink : wire.bit ? signalPalette(p, wire.bit).accent : p.accent, live = wireLive(level, wire, state);
    ctx.strokeStyle = live ? color : alpha(color, 0.6);
    ctx.setLineDash(live ? [8, 6] : [2, 5]);
    ctx.lineDashOffset = live ? -time / 40 : 0;
    ctx.beginPath();
    wire.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

const GATE_OUTLINES = {
  and(ctx) { ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(10, 0); ctx.arc(0, 0, 10, 0, Math.PI); ctx.closePath(); },
  or(ctx) { ctx.moveTo(-10, -8); ctx.quadraticCurveTo(0, -3, 10, -8); ctx.quadraticCurveTo(10, 3, 0, 10); ctx.quadraticCurveTo(-10, 3, -10, -8); ctx.closePath(); },
  xor(ctx) { GATE_OUTLINES.or(ctx); },
};

function drawGate(ctx, palette, o, state) {
  const { gate } = o, bits = state.flags | state.pressed, on = gateOutput(gate, bits);
  for (const pin of gatePins(gate)) {
    const color = signalPalette(palette, pin.bit).accent, inputOn = (bits & pin.bit) !== 0;
    ctx.fillStyle = inputOn ? color : alpha(color, 0.35);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pin.at[0], pin.at[1], pin.negated ? 3.5 : 2.5, 0, TAU);
    if (pin.negated) { ctx.fillStyle = palette.rockEdge; ctx.fill(); ctx.stroke(); } else ctx.fill();
  }
  ctx.save();
  ctx.translate(gate.x, gate.y);
  ctx.scale(1, gate.dir);
  ctx.fillStyle = on ? palette.ink : palette.rockEdge;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  GATE_OUTLINES[gate.op](ctx);
  ctx.fill();
  ctx.stroke();
  if (gate.op === 'xor') {
    ctx.beginPath(); ctx.moveTo(-10, -12); ctx.quadraticCurveTo(0, -7, 10, -12); ctx.stroke();
  }
  ctx.restore();
}

function drawObject(ctx, palette, theme, level, o, state, time) {
  const p = o.gate ? { ...palette, accent: palette.ink, accentSoft: alpha(palette.ink, 0.25), accentDeep: palette.ink } : o.bit ? signalPalette(palette, o.bit) : palette;
  if (crushed(level, state, o)) {
    ctx.fillStyle = o.type === 'saw' ? p.hazardGlow : p.dim;
    const rect = objectRect(o, state.clock);
    ctx.fillRect(rect.x, rect.y + rect.h - 4, rect.w, 4);
    return;
  }
  OBJECT_PAINTERS[o.type]?.(ctx, p, theme, level, o, state, time);
  if (o.gate) drawGate(ctx, palette, o, state);
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

const TOMB_FALL = 0.55;
const TOMB_SLAB_INSET = 3;
const TOMB_SHOULDER = 5;
const TOMB_PLINTH = 3;

const TOMB_SPIN = 0.3;

function drawTomb(ctx, p, rect, frame) {
  const age = Math.max(0, frame - rect.born), flying = rect.path?.[age];
  const y = rect.path ? (flying?.[1] ?? rect.y) : Math.min(rect.y, rect.from + (TOMB_FALL * age * age) / 2);
  ctx.save();
  ctx.translate(flying?.[0] ?? rect.x, y);
  if (flying) { ctx.translate(rect.w / 2, rect.h / 2); ctx.rotate(age * TOMB_SPIN); ctx.translate(-rect.w / 2, -rect.h / 2); }
  ctx.fillStyle = p.edgeDeep;
  ctx.beginPath(); ctx.roundRect(TOMB_SLAB_INSET, 0, rect.w - 2 * TOMB_SLAB_INSET, rect.h, [TOMB_SHOULDER, TOMB_SHOULDER, 0, 0]); ctx.fill();
  ctx.fillStyle = p.edgeLight;
  ctx.fillRect(0, rect.h - TOMB_PLINTH, rect.w, TOMB_PLINTH);
  ctx.fillStyle = p.inkSoft;
  ctx.fillRect(rect.w / 2 - 1, 3, 2, 9);
  ctx.fillRect(rect.w / 2 - 4, 5, 8, 2);
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
      if (aim.object) { const r = hazardRect(aim.object, state); roundRect(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 6); }
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

const PATH = { color: 'hsl(90 100% 62% / 0.9)', death: 'hsl(0 95% 60%)', dot: 1.1, gap: 40, cross: 7 };
const ECHO = { gap: 60, cross: 6, ring: 14, under: 'hsl(240 30% 8% / 0.7)' };

function drawDeath(ctx, q) {
  ctx.strokeStyle = PATH.death;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(q.x - PATH.cross, q.y - PATH.cross); ctx.lineTo(q.x + PATH.cross, q.y + PATH.cross);
  ctx.moveTo(q.x + PATH.cross, q.y - PATH.cross); ctx.lineTo(q.x - PATH.cross, q.y + PATH.cross);
  ctx.stroke();
  ctx.fillStyle = PATH.death;
  ctx.font = font(800, 11);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`died: ${q.death} @${q.frame}`, q.x, q.y - PATH.cross - 3);
}

function tracePolyline(ctx, points, gap) {
  ctx.beginPath();
  points.forEach((q, i) => {
    const previous = points[i - 1];
    if (previous && Math.hypot(q.x - previous.x, q.y - previous.y) < gap) ctx.lineTo(q.x, q.y);
    else ctx.moveTo(q.x, q.y);
  });
  ctx.stroke();
}

function drawPath(ctx, points) {
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = PATH.color;
  ctx.lineWidth = 1.5;
  tracePolyline(ctx, points, PATH.gap);
  for (const q of points) { ctx.beginPath(); ctx.arc(q.x, q.y, PATH.dot, 0, TAU); ctx.fill(); }
  for (const q of points) if (q.death) drawDeath(ctx, q);
  ctx.restore();
}

function drawEcho(ctx, p, echo) {
  const end = echo.points[echo.points.length - 1];
  if (!end) return;
  const life = echo.age / echo.ms, fade = Math.max(0, 1 - life);
  ctx.save();
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.globalAlpha = fade * 0.9;
  ctx.strokeStyle = ECHO.under;
  ctx.lineWidth = 4.5;
  tracePolyline(ctx, echo.points, ECHO.gap);
  ctx.strokeStyle = p.player;
  ctx.lineWidth = 2.5;
  tracePolyline(ctx, echo.points, ECHO.gap);
  ctx.strokeStyle = p.hazard;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(end.x - ECHO.cross, end.y - ECHO.cross); ctx.lineTo(end.x + ECHO.cross, end.y + ECHO.cross);
  ctx.moveTo(end.x + ECHO.cross, end.y - ECHO.cross); ctx.lineTo(end.x - ECHO.cross, end.y + ECHO.cross);
  ctx.stroke();
  ctx.globalAlpha = fade * Math.max(0, 1 - life * 3);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(end.x, end.y, ECHO.cross + life * 3 * ECHO.ring, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawArchitect(ctx, p, level, s, time) {
  const { w, h } = playerSize(level.rules);
  const bob = Math.sin(time / 180) * 1.5, radius = Math.min(8, w / 3);
  ctx.save();
  ctx.translate(s.x + w / 2, s.y + h / 2);
  if (s.gravDir < 0) ctx.scale(1, -1);
  ctx.fillStyle = alpha(p.accent, 0.16);
  roundRect(ctx, -w / 2, -h / 2 + bob, w, h - 3, radius);
  ctx.fill();
  ctx.strokeStyle = alpha(p.accent, 0.75);
  ctx.lineWidth = 1.5;
  strokeDashed(ctx, [4, 3], () => roundRect(ctx, -w / 2, -h / 2 + bob, w, h - 3, radius));
  ctx.fillStyle = p.accent;
  const eye = s.facing * w * 0.14;
  ctx.beginPath(); ctx.arc(eye - w * 0.15, -h * 0.2 + bob, 1.8, 0, TAU); ctx.arc(eye + w * 0.15, -h * 0.2 + bob, 1.8, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawGuideLine(ctx, color, y, label, below = false) {
  ctx.save();
  ctx.strokeStyle = alpha(color, 0.55);
  ctx.lineWidth = 1.5;
  strokeDashed(ctx, [10, 8], () => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); });
  ctx.font = font(700, 11);
  ctx.textAlign = 'right';
  ctx.textBaseline = below ? 'top' : 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'hsl(240 30% 8% / 0.7)';
  const ly = below ? y + 3 : y - 3;
  ctx.strokeText(label, WIDTH - 12, ly);
  ctx.fillStyle = color;
  ctx.fillText(label, WIDTH - 12, ly);
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
  ctx.strokeStyle = SHEEN;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - 0.5, top); ctx.lineTo(x - 0.5, bottom); ctx.stroke();
  ctx.fillStyle = touched ? p.accent : alpha(p.dim, 0.5);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 16, top + 6 + wave); ctx.lineTo(x, top + 13); ctx.closePath(); ctx.fill();
  if (touched) {
    ctx.fillStyle = p.accentDeep;
    ctx.beginPath(); ctx.moveTo(x, top + 6.5 + wave / 2); ctx.lineTo(x + 16, top + 6 + wave); ctx.lineTo(x, top + 13); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = p.ink;
  ctx.beginPath(); ctx.arc(x, top, 2, 0, TAU); ctx.fill();
  glint(ctx, x - 0.6, top - 0.6, 0.7);
}

function verticalSpan(o) {
  if (o.type === 'lurker') return [-Infinity, Infinity];
  const dy = o.period ? o.dy ?? 0 : 0;
  return [o.y + Math.min(0, dy), o.y + o.h + Math.max(0, dy)];
}

const CHASERS = {
  water(ctx, p, y, depth, time) {
    ctx.fillStyle = p.hazardGlow;
    ctx.fillRect(0, y, WIDTH, depth);
    ctx.strokeStyle = p.hazard;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin(x / 18 + time / 180) * 3);
    ctx.stroke();
  },
  ash(ctx, p, y, depth, time) {
    const smoke = 'hsl(20 30% 4% / 0.92)', g = ctx.createLinearGradient(0, y, 0, y + 120);
    g.addColorStop(0, alpha(p.accent, 0.6));
    g.addColorStop(0.35, alpha(p.hazard, 0.6));
    g.addColorStop(1, smoke);
    ctx.fillStyle = g;
    ctx.fillRect(0, y, WIDTH, Math.min(depth, 120));
    ctx.fillStyle = smoke;
    ctx.fillRect(0, y + 120, WIDTH, Math.max(0, depth - 120));
    ctx.strokeStyle = p.accentLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 6) ctx.lineTo(x, y + Math.sin(x / 11 + time / 90) * 4 + Math.sin(x / 3.7 - time / 60) * 2);
    ctx.stroke();
    for (let i = 0; i < 28; i++) {
      const rise = (time / 14 + i * 53) % 90, x = (i * 97 + Math.sin(time / 500 + i) * 12 + WIDTH) % WIDTH;
      ctx.fillStyle = alpha(i % 3 ? p.hazard : p.accent, Math.max(0, 0.9 - rise / 100));
      ctx.fillRect(x, y - rise, 2, 2);
    }
  },
  fog(ctx, p, y, depth, time) {
    const mist = a => `hsl(200 30% 92% / ${a})`, g = ctx.createLinearGradient(0, y - 40, 0, y + 60);
    g.addColorStop(0, mist(0));
    g.addColorStop(0.4, mist(0.55));
    g.addColorStop(1, mist(0.85));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 40, WIDTH, Math.min(depth + 40, 100));
    ctx.fillStyle = mist(0.85);
    ctx.fillRect(0, y + 60, WIDTH, Math.max(0, depth - 60));
    ctx.fillStyle = alpha(p.accentLight, 0.8);
    for (let i = 0; i < 14; i++) {
      const x = (i * 71 + 20) % WIDTH, spike = 10 + ((i * 37) % 14) + Math.sin(time / 400 + i) * 2;
      ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.lineTo(x, y - spike); ctx.lineTo(x + 6, y + 4); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = mist(0.6);
    for (let i = 0; i < 20; i++) ctx.fillRect((i * 113 + (time / 40) * (1 + (i % 3))) % WIDTH, y - ((i * 29) % 50) - Math.sin(time / 300 + i) * 4, 2, 2);
  },
  void(ctx, p, y, depth, time) {
    ctx.fillStyle = 'hsl(260 45% 4% / 0.94)';
    ctx.fillRect(0, y, WIDTH, depth);
    const g = ctx.createLinearGradient(0, y - 50, 0, y);
    g.addColorStop(0, alpha(p.accent, 0));
    g.addColorStop(1, alpha(p.accent, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 50, WIDTH, 50);
    ctx.strokeStyle = alpha(p.accent, 0.8);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const x = i * (WIDTH / 8) + Math.sin(time / 700 + i) * 20;
      ctx.beginPath(); ctx.moveTo(x, y + 2);
      for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(time / 250 + i + k * 1.3) * k * 2.3, y - k * 9);
      ctx.stroke();
    }
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 16; i++) {
      const fall = (time / 10 + i * 41) % 70;
      ctx.globalAlpha = fall / 70;
      ctx.fillRect((i * 131 + 40) % WIDTH, y - 70 + fall, 2, 2);
    }
    ctx.globalAlpha = 1;
  },
  growth(ctx, p, y, depth, time) {
    const g = ctx.createLinearGradient(0, y, 0, y + 100);
    g.addColorStop(0, alpha(p.rockEdge, 0.7));
    g.addColorStop(1, alpha(p.edgeDeep, 0.9));
    ctx.fillStyle = g;
    ctx.fillRect(0, y, WIDTH, Math.min(depth, 100));
    ctx.fillStyle = alpha(p.edgeDeep, 0.9);
    ctx.fillRect(0, y + 100, WIDTH, Math.max(0, depth - 100));
    ctx.fillStyle = alpha(p.rockEdge, 0.85);
    for (let x = 0; x < WIDTH; x += 18) {
      ctx.beginPath(); ctx.arc(x + 9, y + 4 + Math.sin(time / 350 + x / 30) * 2, 8 + ((x * 7) % 9), Math.PI, TAU); ctx.fill();
    }
    ctx.strokeStyle = alpha(p.accent, 0.9);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const x = i * (WIDTH / 7) + 30, sway = Math.sin(time / 420 + i) * 6, reach = 24 + ((i * 13) % 16);
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.quadraticCurveTo(x + sway, y - reach / 2, x - sway, y - reach); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - sway, y - reach, 2.5, 0, TAU); ctx.fillStyle = p.accent; ctx.fill();
    }
  },
  sand(ctx, p, y, depth, time) {
    const g = ctx.createLinearGradient(0, y - 30, 0, y + 40);
    g.addColorStop(0, alpha(p.rockDeep, 0));
    g.addColorStop(1, alpha(p.rockDeep, 0.9));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 30, WIDTH, Math.min(depth + 30, 70));
    ctx.fillStyle = alpha(p.rockDeep, 0.9);
    ctx.fillRect(0, y + 40, WIDTH, Math.max(0, depth - 40));
    ctx.strokeStyle = alpha(p.rockEdge, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 8) ctx.lineTo(x, y + Math.sin(x / 40 + time / 600) * 5);
    ctx.stroke();
    ctx.fillStyle = alpha(p.rockEdge, 0.7);
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 89 + (time / 6) * (1 + (i % 4))) % WIDTH, y - ((i * 23) % 45), 2, 1);
  },
};

function drawFlood(ctx, p, theme, level, state, time) {
  const y = floodLevel(level, state.tide);
  if (y >= level.height) return;
  ctx.save();
  CHASERS[theme.chaser](ctx, p, y, level.height - y, time);
  ctx.restore();
}

function drawExit(ctx, p, level, time) {
  if (level.custom) return;
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

const PREVIEW_ALPHA = 0.6;

function drawEditorNote(ctx, text) {
  ctx.font = font(800, 26);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = BRIGHT_TEXT;
  ctx.fillText(text, WIDTH / 2, 60);
}

const MAP_CELL = 5;
const MAP_HUE = 200;
const ICON_TRAVEL = 30;
const ICON_ZOOM = 2;
const ICON_CANNON_ZOOM = 1;

function previewOf(level, block, rect) {
  const fake = { ...level, objects: [], timed: false };
  block.make(rect, level, {}).forEach(shape => addObject(fake, { ...shape }));
  return { fake, state: initialState(fake) };
}

function drawPreview(ctx, p, theme, level, block, rect, time) {
  ctx.save();
  ctx.globalAlpha = PREVIEW_ALPHA;
  if (block.tile !== undefined) {
    ctx.fillStyle = p.rock;
    ctx.fillRect(rect.c * TILE, rect.r * TILE, rect.w * TILE, block.tile === ONE_WAY ? TILE / 3 : rect.h * TILE);
  } else {
    const { fake, state } = previewOf(level, block, rect);
    for (const o of fake.objects) {
      if (o.type === 'crate') drawCrate(ctx, theme, p, o.kind, o.x, o.y, o.w);
      else if (o.type === 'checkpoint') drawFlag(ctx, p, o, false, time);
      else OBJECT_PAINTERS[o.type]?.(ctx, o.bit ? signalPalette(p, o.bit) : p, theme, fake, o, state, time);
    }
  }
  ctx.restore();
}

function drawTimingDial(ctx, p, x, y, step) {
  const r = 11;
  ctx.fillStyle = alpha(p.bgTop, 0.9);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + (TAU * step) / TIMING_STEPS); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}

function drawEditing(ctx, p, theme, level, editing, camera, time) {
  const { at, rect, erasing, block, wiring, timing, linking, items } = editing;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, HEIGHT);
  ctx.clip();
  ctx.translate(0, -camera);
  ctx.strokeStyle = alpha(p.ink, 0.1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * TILE, camera); ctx.lineTo(c * TILE, camera + HEIGHT); }
  const firstRow = Math.floor(camera / TILE);
  for (let r = firstRow; r <= firstRow + HEIGHT / TILE + 1; r++) { ctx.moveTo(0, r * TILE); ctx.lineTo(WIDTH, r * TILE); }
  ctx.stroke();
  if (wiring) {
    for (const item of items.filter(i => i.u === linking)) {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(item.c * TILE - 2, item.r * TILE - 2, item.w * TILE + 4, item.h * TILE + 4);
    }
  }
  if (timing) for (const item of items.filter(i => blockById(i.b).timed)) drawTimingDial(ctx, p, (item.c + 0.5) * TILE, (item.r + 0.5) * TILE, item.p ?? 0);
  if (at && rect) {
    if (block) drawPreview(ctx, p, theme, level, block, rect, time);
    ctx.strokeStyle = erasing ? p.hazard : p.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.c * TILE, rect.r * TILE, rect.w * TILE, rect.h * TILE);
  }
  ctx.restore();
}

export function drawBlockIcon(canvas, block, level, theme, p) {
  const g = canvas.getContext('2d'), size = canvas.width;
  g.clearRect(0, 0, size, size);
  g.save();
  if (block.tile !== undefined) {
    const left = size * 0.15, top = size * 0.3, across = size * 0.7, lip = size * 0.1;
    g.fillStyle = block.tile === WATER_TILE ? p.water : p.rock;
    g.fillRect(left, top, across, block.tile === ONE_WAY ? lip * 1.6 : size * 0.45);
    g.fillStyle = block.tile === WATER_TILE ? p.waterLine : p.rockEdge;
    g.fillRect(left, top, across, block.tile === WATER_TILE ? lip / 3 : lip);
    g.restore();
    return;
  }
  const [w, h] = block.size ?? [1, 1];
  const { fake, state } = previewOf(level, block, { c: 4, r: 8, w, h });
  const o = fake.objects[0];
  if (o.type === 'toggle') o.on = false;
  const shrink = Math.min(1, ICON_TRAVEL / Math.max(Math.abs(o.dx ?? 0), Math.abs(o.dy ?? 0), 1));
  const dx = (o.dx ?? 0) * shrink, dy = (o.dy ?? 0) * shrink;
  if (o.dx !== undefined) Object.assign(o, { dx, dy });
  const sweep = o.motion ? 2 : 1;
  const scale = Math.min(o.type === 'cannon' ? ICON_CANNON_ZOOM : ICON_ZOOM, (size - 8) / Math.max(o.w + sweep * Math.abs(dx), o.h + sweep * Math.abs(dy)));
  g.translate(size / 2, size / 2);
  g.scale(scale, scale);
  g.translate(-(o.x + o.w / 2 + (o.motion ? 0 : dx / 2)), -(o.y + o.h / 2 + (o.motion ? 0 : dy / 2)));
  for (const object of fake.objects) {
    if (object.type === 'crate') drawCrate(g, theme, p, object.kind, object.x, object.y, object.w);
    else if (object.type === 'checkpoint') drawFlag(g, p, object, false, 0);
    else OBJECT_PAINTERS[object.type]?.(g, p, theme, fake, object, state, 0);
  }
  g.restore();
}

export function drawLevelMap(canvas, blueprint) {
  const p = THEMES[blueprint.theme].palette(MAP_HUE), rows = blueprint.rows;
  canvas.width = COLS * MAP_CELL;
  canvas.height = rows * MAP_CELL;
  const g = canvas.getContext('2d'), sky = g.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, p.bgTop);
  sky.addColorStop(1, p.bgBottom);
  g.fillStyle = sky;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = p.ink;
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (blueprint.tiles[r * COLS + c] !== EMPTY) g.fillRect(c * MAP_CELL, r * MAP_CELL, MAP_CELL, MAP_CELL);
  for (const item of blueprint.items) {
    g.fillStyle = blockById(item.b).group === 'Hazards' || blockById(item.b).group === 'Monsters' ? p.hazard : p.accent;
    g.fillRect(item.c * MAP_CELL, item.r * MAP_CELL, item.w * MAP_CELL, item.h * MAP_CELL);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const bar = { level: null, key: null, items: null };
  const skies = { palette: null, sky: null, bucket: -1, air: null, stars: 0 };
  const layers = new Map();
  let ambient = { level: null, particles: [] };
  const rand = Math.random;

  function layerFor(level) {
    let layer = layers.get(level);
    if (layer) layers.delete(level);
    else {
      const theme = themeFor(level);
      const palette = theme.palette(level.palette);
      const decor = growDecor(level);
      layer = { theme, palette, decor, tiles: renderTiles(level, theme, palette, decor), backdrop: renderBackdrop(level, theme, palette), life: growLife(level, theme), structure: level.hall ? null : renderStructure(level, theme, palette, growStructure(level)) };
    }
    layers.set(level, layer);
    if (layers.size > LAYERS_KEPT) layers.delete(layers.keys().next().value);
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
    const top = view.camera - offset - CULL_MARGIN, bottom = top + HEIGHT + 2 * CULL_MARGIN;
    if (layer.structure) {
      ctx.save();
      ctx.translate(0, offset - view.camera);
      const shownTop = Math.max(0, top), shownHeight = Math.min(level.height, bottom) - shownTop;
      if (shownHeight > 0) ctx.drawImage(layer.structure.canvas, 0, shownTop, WIDTH, shownHeight, 0, shownTop, WIDTH, shownHeight);
      drawStructureMotion(ctx, layer.structure, top, bottom, time);
      ctx.restore();
    }
    drawLife(ctx, layer.life, p, offset, view.camera, time);
    if (!current && (bottom < 0 || top > level.height)) return;
    ctx.save();
    ctx.translate(0, offset - view.camera);
    const home = homeOf(level);
    if (home) drawHome(ctx, home, time, current && !view.wardrobe && atWardrobe(home, level, state));
    ctx.drawImage(layer.tiles, 0, 0);
    if (level.hall) drawHall(ctx, level, p, theme, time, state);
    if (!level.hall && !level.custom) { drawMouths(ctx, level, p, time); drawSignpost(ctx, level, p, theme, time, current && view.freeSkill); }
    if (home) drawClimbSign(ctx, level, p, theme, time);
    if (current && view.god && !level.hall) drawGod(ctx, p, theme, level, time, state);
    if (current && !level.hall && !level.custom) drawImp(ctx, level, time, state, view.difficulty);
    const { w: pw, h: ph } = playerSize(level.rules);
    if (!level.hall) drawDecor(ctx, layer.decor, p, { time, playerX: state.x + pw / 2, playerY: state.y + ph / 2, top, bottom });
    const shown = level.objects.filter(o => { const [y0, y1] = verticalSpan(o); return y1 >= top && y0 <= bottom && !erased(state, o); });
    const backdrop = o => o.type === 'water' || o.type === 'wind';
    drawWires(ctx, p, theme, level, state, time);
    for (const o of shown) if (backdrop(o)) drawObject(ctx, p, theme, level, o, state, time);
    for (const o of shown) if (!backdrop(o)) drawObject(ctx, p, theme, level, o, state, time);
    for (const o of shown) if (o.type === 'checkpoint') drawFlag(ctx, p, o, current && view.touched.includes(o.id), time);
    if (current) for (const flag of view.planted ?? []) drawFlag(ctx, p, flag, true, time);
    for (const rect of state.placed) if (rect.kind === 'tomb') drawTomb(ctx, p, rect, state.frame); else drawPlaced(ctx, p, theme, rect, time);
    drawExit(ctx, p, level, time);
    if (current) {
      if (view.path?.length) drawPath(ctx, view.path);
      if (ghost) drawPlayer(ctx, p, theme, level, ghost, HINT_ALPHA);
      if (view.architect?.started && !view.architect.done) drawArchitect(ctx, p, level, view.architect.state, time);
      const { w, h } = playerSize(level.rules);
      trail.forEach((t, i) => {
        ctx.globalAlpha = (i / trail.length) * (state.dashTimer > 0 ? 0.5 : 0.22 + 0.3 * state.charge);
        ctx.fillStyle = p.player;
        roundRect(ctx, t.x + w * 0.2, t.y + h * 0.2, w * 0.6, h * 0.6, 4);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      drawArrows(ctx, p, state);
      if (Number.isFinite(view.combo?.floor)) drawGuideLine(ctx, p.accent, view.combo.floor, 'COMBO LINE');
      const recordY = view.record > 0 ? altitudeY(view.biomeIndex, level, view.record) : -1;
      if (recordY > 0 && recordY < level.height) drawGuideLine(ctx, p.text, recordY, `BEST ${view.record.toLocaleString()} m`, true);
      if (!state.dead) {
        if (state.barrel < 0) {
          const hold = gripOffset(level, state);
          drawPlayer(ctx, p, theme, level, hold ? { ...state, x: state.x + hold.x, y: state.y + hold.y } : state, 1, view.avatar);
        }
        noteClimber(state);
        drawPowers(ctx, level, state, time);
        if (view.combo) drawCombo(ctx, p, state, view.combo, w, h);
      }
      if (view.aim) drawAim(ctx, p, theme, level, state, view.aim, time);
      if (view.blink) drawBlinkPreview(ctx, p, level, state, view.blink, time);
      const rival = view.rival;
      if (rival?.state && rival.index === view.biomeIndex && !rival.state.dead) drawRival(ctx, p, theme, level, rival.state);
    }
    drawBodies(ctx, p, theme, level, state);
    drawFlood(ctx, p, theme, level, state, time);
    if (current && view.echo) drawEcho(ctx, p, view.echo);
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
    if (view.editing) {
      drawEditing(ctx, p, theme, level, view.editing, camera, view.time);
      drawTooltip(ctx, view.pointer);
      if (view.quitting) drawQuitPrompt(ctx, view, p);
      if (view.toast && view.toast.age < view.toast.ms) drawEditorNote(ctx, view.toast.text);
      return;
    }
    const hud = level.hall ? { ...p, text: BRIGHT_TEXT, dim: HALL_DIM } : p;
    ctx.save();
    if (roomAt(level, state.y)) ctx.globalAlpha = ROOM_METER_ALPHA;
    drawMeter(ctx, view, hud);
    ctx.restore();
    drawHud(ctx, view, hud);
    if (view.stall) drawStallBubble(ctx, view.stall, p, view.stall.age);
    if (view.levelUp) drawLevelUp(ctx, view.levelUp);
    if (view.perfect) drawPerfect(ctx, view.perfect);
    drawTooltip(ctx, view.pointer);
    if (view.over) drawGameOver(ctx);
    if (view.quitting) drawQuitPrompt(ctx, view, p);
    if (view.wardrobe) drawWardrobe(ctx, view, p, theme);
    drawControls(ctx, bar, level, view.keys, p, view.muted, state);
  }

  return { fit, draw, drawLoading: building => drawLoading(ctx, building), paletteFor: level => layerFor(level).palette, forget: level => layers.delete(level), pointer: event => ({ x: event.offsetX / scale, y: event.offsetY / scale }) };
}
