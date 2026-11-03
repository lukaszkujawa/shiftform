import { TILE, WIDTH, HEIGHT, roomAt, erased } from '../world/level.js';
import { playerSize } from '../world/physics.js';
import { themeFor, alpha } from './themes.js';
import { growDecor, drawDecor } from './decor.js';
import { growStructure } from './structures.js';
import { renderStructure, drawStructureMotion } from './structure-art.js';
import { growLife, drawLife } from './life.js';
import { renderBackdrop, hasHorizon } from './backdrops.js';
import { seededNoise } from './backdrop-kit.js';
import { BRIGHT_TEXT } from './icons.js';
import { drawPlayer } from './player-art.js';
import { barHeight, touchScreen, drawMeter, drawHud, drawControls, drawQuitPrompt, drawGameOver, drawLoading, drawLevelUp, drawPerfect } from '../ui/hud.js';
import { altitudeY } from '../world/climb.js';
import { gripOffset, noteClimber } from './rigging.js';
import { TAU, roundRect, veil } from './paint.js';
import { homeOf, atWardrobe, drawHome } from '../world/home.js';
import { drawWardrobe } from '../ui/wardrobe.js';
import { drawMouths, drawHall } from './hall-art.js';
import { drawStallBubble } from '../ui/stall-ui.js';
import { drawTooltip } from '../ui/tooltip.js';
import { drawSignpost, drawClimbSign } from './signpost.js';
import { drawGod } from '../world/god.js';
import { drawImp } from '../world/imp.js';
import { renderTiles } from './tile-art.js';
import { drawBodies, drawFlag } from './object-parts.js';
import { drawWires, drawObject } from './object-art.js';
import { drawPowers, drawRival, drawArrows, drawBlinkPreview, drawArchitect, drawCombo } from './player-effects.js';
import { drawPlaced, drawTomb, drawAim } from './placed-art.js';
import { drawPath, drawEcho, drawGuideLine } from './trace-art.js';
import { drawFlood } from './flood-art.js';
import { altitudeTint, spawnAmbient } from './ambience.js';
import { drawEditorNote, drawEditing } from '../builder/editor-art.js';

const CULL_MARGIN = 160;
const PARALLAX = 0.3;
const HALL_DIM = 'hsl(240 12% 72% / 1)';
const LIGHT = { inner: 40, outer: 170 };
const LAYERS_KEPT = 6;

const ROOM_METER_ALPHA = 0.35;
const HINT_ALPHA = 0.7;

function verticalSpan(o) {
  if (o.type === 'lurker') return [-Infinity, Infinity];
  const dy = o.period ? o.dy ?? 0 : 0;
  return [o.y + Math.min(0, dy), o.y + o.h + Math.max(0, dy)];
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
    scale = Math.min(viewport.width / WIDTH, viewport.height / (HEIGHT + barHeight()));
    canvas.width = Math.floor(WIDTH * scale * dpr);
    canvas.height = Math.floor((HEIGHT + barHeight()) * scale * dpr);
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${(HEIGHT + barHeight()) * scale}px`;
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
    if (!touchScreen()) drawControls(ctx, bar, level, view.keys, p, view.muted, state);
  }

  return { fit, draw, drawLoading: building => drawLoading(ctx, building), paletteFor: level => layerFor(level).palette, forget: level => layers.delete(level), pointer: event => ({ x: event.offsetX / scale, y: event.offsetY / scale }) };
}
