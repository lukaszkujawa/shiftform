import { WIDTH, HEIGHT } from '../world/level.js';
import { playerSize } from '../world/physics.js';
import { barHeight, drawLoading } from '../ui/hud.js';
import { altitudeY } from '../world/climb.js';
import { altitudeTint } from '../art/ambience.js';
import { gripOffset, noteClimber } from '../art/rigging.js';
import { roundRect, veil } from '../art/paint.js';
import { drawBlinkPreview, drawCombo } from '../art/player-effects.js';
import { drawAim } from '../art/placed-art.js';
import { drawPath, drawEcho, drawGuideLine } from '../art/trace-art.js';
import { drawInterface, drawParticles, drawDarkness, createRenderer as createFlatRenderer } from '../art/render.js';
import { gradeFilm, FILM_COSTUME } from '../art/film.js';
import { THREE, colorOf } from './toon.js';
import { EYE } from './scenery.js';
import { createImp } from './critters.js';
import { createHero } from './hero.js';
import { buildStage } from './stage.js';

const STAGES_KEPT = 4;

let shared = null;

function sharedGl() {
  if (shared !== null) return shared;
  const canvas = document.createElement('canvas');
  canvas.id = 'world';
  try {
    const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    gl.setClearColor(0x000000, 0);
    document.body.prepend(canvas);
    return (shared = { canvas, gl });
  } catch {
    return (shared = false);
  }
}

function createWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, EYE + 60, EYE + 1600);
  const camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 10, 5000);
  scene.add(camera);
  const sun = new THREE.DirectionalLight(0xfff3dc, 2.2);
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x7a6a50, 1.6), sun, sun.target);
  return { scene, camera, sun };
}

export function createRenderer(canvas) {
  const world = sharedGl();
  return world ? createWorldRenderer(canvas, world) : { ...createFlatRenderer(canvas), stop() {} };
}

function createWorldRenderer(canvas, { canvas: worldCanvas, gl }) {
  const ctx = canvas.getContext('2d');
  const { scene, camera, sun } = createWorld();
  const hero = createHero(), imp = createImp();
  scene.add(hero.group, imp.group);
  const stages = new Map();
  const bar = { level: null, key: null, items: null };
  let scale = 1;

  function forget(level) {
    stages.get(level)?.dispose();
    stages.delete(level);
  }

  function stageFor(level) {
    const stage = stages.get(level) ?? buildStage(level);
    stages.delete(level);
    stages.set(level, stage);
    if (stages.size > STAGES_KEPT) forget(stages.keys().next().value);
    return stage;
  }

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const viewport = window.visualViewport ?? { width: window.innerWidth, height: window.innerHeight };
    scale = Math.min(viewport.width / WIDTH, viewport.height / (HEIGHT + barHeight()));
    canvas.width = Math.floor(WIDTH * scale * dpr);
    canvas.height = Math.floor((HEIGHT + barHeight()) * scale * dpr);
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${(HEIGHT + barHeight()) * scale}px`;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    gl.setPixelRatio(dpr);
    gl.setSize(WIDTH * scale, HEIGHT * scale);
    const box = canvas.getBoundingClientRect();
    Object.assign(worldCanvas.style, { left: `${box.left}px`, top: `${box.top}px` });
  }

  function paintSky(palette, altitude, film) {
    const tint = altitudeTint(Math.round(altitude / 10) * 10), faint = css => css.replace(/\/ ([\d.]+)\)$/, (_, a) => `/ ${a * 0.5})`);
    worldCanvas.style.background = `linear-gradient(${faint(tint.top)}, ${faint(tint.bottom)}), linear-gradient(${palette.bgTop}, ${palette.bgBottom})`;
    worldCanvas.style.filter = film ? 'grayscale(1) contrast(1.08)' : '';
    scene.fog.color.copy(colorOf(palette.bgBottom)).lerp(colorOf(palette.bgTop), 0.45);
  }

  const biomesOf = view => [
    ...(view.above ? [{ level: view.above.level, state: view.above.state, offset: -view.above.level.height, current: false }] : []),
    ...(view.below ? [{ level: view.below.level, state: view.below.state, offset: view.level.height, current: false }] : []),
    { level: view.level, state: view.state, offset: 0, current: true },
  ];

  function drawFront(view) {
    const { level, state, time } = view, { palette: p, theme } = stageFor(level), { w, h } = playerSize(level.rules);
    ctx.save();
    ctx.translate(0, -view.camera);
    if (view.path?.length) drawPath(ctx, view.path);
    view.trail.forEach((t, i) => {
      ctx.globalAlpha = (i / view.trail.length) * (state.dashTimer > 0 ? 0.5 : 0.22 + 0.3 * state.charge);
      ctx.fillStyle = p.player;
      roundRect(ctx, t.x + w * 0.2, t.y + h * 0.2, w * 0.6, h * 0.6, 4);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (!level.hall && Number.isFinite(view.combo?.floor)) drawGuideLine(ctx, p.accent, view.combo.floor, 'COMBO LINE');
    const recordY = view.record > 0 ? altitudeY(view.biomeIndex, level, view.record) : -1;
    if (!level.hall && recordY > 0 && recordY < level.height) drawGuideLine(ctx, p.text, recordY, `BEST ${view.record.toLocaleString()} m`, true);
    if (!state.dead) {
      noteClimber(state);
      if (view.combo) drawCombo(ctx, p, state, view.combo, w, h);
    }
    if (view.aim) drawAim(ctx, p, theme, level, state, view.aim, time);
    if (view.blink) drawBlinkPreview(ctx, p, level, state, view.blink, time);
    if (view.echo) drawEcho(ctx, p, view.echo);
    drawParticles(ctx, view.particles);
    ctx.restore();
  }

  function stagePlayer(view, stage) {
    const { level, state } = view, hold = gripOffset(level, state);
    hero.update(level, hold ? { ...state, x: state.x + hold.x, y: state.y + hold.y } : state, stage.theme.film ? { ...view.avatar, ...FILM_COSTUME } : view.avatar, stage.palette);
  }

  function draw(view) {
    const { level, state, time } = view, stage = stageFor(level);
    const shake = view.shake > 0 ? { x: (Math.random() - 0.5) * view.shake, y: (Math.random() - 0.5) * view.shake } : { x: 0, y: 0 };
    const { w, h } = playerSize(level.rules), player = { x: state.x + w / 2, y: state.y + h / 2 };
    worldCanvas.hidden = false;
    paintSky(stage.palette, view.altitude, stage.theme.film);
    for (const shown of stages.values()) shown.group.visible = false;
    for (const biome of biomesOf(view)) {
      const shown = stageFor(biome.level);
      if (shown.group.parent !== scene) scene.add(shown.group);
      shown.update(biome, time, { ...view, player: biome.current ? player : { x: -1e4, y: -1e4 }, touched: biome.current ? view.touched : [] });
    }
    stagePlayer(view, stage);
    imp.group.visible = !level.hall && !level.custom;
    if (imp.group.visible) imp.update(level, state, time, view.difficulty);
    camera.position.set(WIDTH / 2 - shake.x, -(view.camera + HEIGHT / 2) + shake.y, EYE);
    sun.position.set(camera.position.x - 260, camera.position.y + 520, 600);
    sun.target.position.set(camera.position.x, camera.position.y, 0);
    gl.render(scene, camera);
    ctx.clearRect(0, 0, WIDTH, HEIGHT + barHeight());
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT);
    ctx.clip();
    ctx.translate(shake.x, shake.y);
    drawFront(view);
    if (level.rules.darkness) drawDarkness(ctx, state, level, view.camera, view.light ?? 1);
    if (view.frozen) veil(ctx, 'rgba(120,130,160,0.22)');
    if (view.flash > 0) veil(ctx, `rgba(255,255,255,${view.flash})`);
    if (stage.theme.film) gradeFilm(ctx, time);
    ctx.restore();
    if (!view.backdrop) drawInterface(ctx, view, stage, bar);
  }

  return {
    fit,
    draw,
    drawLoading: building => { worldCanvas.hidden = true; drawLoading(ctx, building); },
    paletteFor: level => stageFor(level).palette,
    forget,
    pointer: event => ({ x: event.offsetX / scale, y: event.offsetY / scale }),
    stop: () => { worldCanvas.hidden = true; for (const level of [...stages.keys()]) forget(level); },
  };
}
