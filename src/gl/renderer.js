import { TILE, WIDTH, HEIGHT, erased } from '../world/level.js';
import { playerSize } from '../world/physics.js';
import { THEMES, themeFor, alpha } from '../art/themes.js';
import { barHeight, drawLoading } from '../ui/hud.js';
import { altitudeY } from '../world/climb.js';
import { altitudeTint } from '../art/ambience.js';
import { gripOffset, noteClimber } from '../art/rigging.js';
import { roundRect, veil } from '../art/paint.js';
import { homeOf, atWardrobe, drawHome } from '../world/home.js';
import { drawMouths, drawHall } from '../art/hall-art.js';
import { drawSignpost, drawClimbSign } from '../art/signpost.js';
import { drawGod } from '../world/god.js';
import { drawBodies, drawFlag } from '../art/object-parts.js';
import { drawWires, drawObject } from '../art/object-art.js';
import { drawPlayer } from '../art/player-art.js';
import { drawPowers, drawRival, drawArrows, drawBlinkPreview, drawArchitect, drawCombo } from '../art/player-effects.js';
import { drawPlaced, drawTomb, drawAim } from '../art/placed-art.js';
import { drawPath, drawEcho, drawGuideLine } from '../art/trace-art.js';
import { drawFlood } from '../art/flood-art.js';
import { createRenderer as createFlatRenderer, drawInterface, drawParticles, drawDarkness } from '../art/render.js';
import { THREE, colorOf } from './toon.js';
import { buildTerrain } from './terrain.js';
import { buildScenery, EYE } from './scenery.js';
import { buildProps, modelled } from './props.js';
import { createLife, createImp } from './critters.js';
import * as setPieces from './setpieces.js';
import * as fixtures from './fixtures.js';
import * as cast from './cast.js';
import * as figures from './figures.js';
import { createHero } from './hero.js';

export const PORTED_THEME = THEMES.findIndex(theme => theme.id === 'country');
const STAGES_KEPT = 4;
const BACK_PLANE = 10;
const HINT_ALPHA = 0.7;
const CULL_MARGIN = 160;
const ACTORS = 1;
const LAYERS = [setPieces, fixtures, cast, figures];
const covered = new Set(LAYERS.flatMap(layer => layer.covers));
const flat = name => !covered.has(name);

function drawExit(ctx, p, level, time) {
  if (level.custom) return;
  const e = level.exit, pulse = 0.55 + Math.sin(time / 260) * 0.2;
  const beam = ctx.createLinearGradient(0, e.y, 0, e.y + 4 * TILE);
  beam.addColorStop(0, alpha(p.accent, pulse));
  beam.addColorStop(1, alpha(p.accent, 0));
  ctx.fillStyle = beam;
  ctx.fillRect(e.x + 4, e.y, e.w - 8, 4 * TILE);
}

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
  const sky = new THREE.HemisphereLight(0xeaf6ff, 0x7a6a50, 1.6), sun = new THREE.DirectionalLight(0xfff3dc, 2.2);
  for (const light of [sky, sun]) light.layers.enableAll();
  scene.add(sky, sun, sun.target);
  return { scene, camera, sun };
}

function createBackLayer(camera) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const stretch = (EYE + BACK_PLANE) / EYE;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH * stretch, HEIGHT * stretch), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  plane.position.z = -(EYE + BACK_PLANE);
  plane.renderOrder = 1;
  camera.add(plane);
  return {
    ctx,
    resize(pixels) {
      canvas.width = Math.floor(WIDTH * pixels);
      canvas.height = Math.floor(HEIGHT * pixels);
      ctx.setTransform(pixels, 0, 0, pixels, 0, 0);
    },
    begin() { ctx.clearRect(0, 0, WIDTH, HEIGHT); },
    end() { texture.needsUpdate = true; },
  };
}

const asActors = node => node.traverse(part => part.layers.set(ACTORS));

function dispose(group) {
  group.traverse(node => node.geometry?.dispose());
}

export function createRenderer(canvas) {
  const world = sharedGl();
  return world ? createWorldRenderer(canvas, world) : { ...createFlatRenderer(canvas), stop() {} };
}

function createWorldRenderer(canvas, { canvas: worldCanvas, gl }) {
  const ctx = canvas.getContext('2d');
  const { scene, camera, sun } = createWorld();
  const back = createBackLayer(camera);
  const hero = createHero(), imp = createImp();
  for (const actor of [hero, imp]) { asActors(actor.group); scene.add(actor.group); }
  const stages = new Map();
  const bar = { level: null, key: null, items: null };
  let scale = 1;

  function stageFor(level) {
    let stage = stages.get(level);
    if (stage) { stages.delete(level); stages.set(level, stage); return stage; }
    const theme = themeFor(level), palette = theme.palette(level.palette);
    const group = new THREE.Group(), scenery = buildScenery(level), life = createLife(level), props = buildProps(level, palette, theme);
    const layers = LAYERS.map(layer => layer.build(level, palette, theme));
    for (const actor of [life, props, ...layers]) { asActors(actor.group); group.add(actor.group); }
    group.add(buildTerrain(level), scenery.group);
    stage = { theme, palette, group, scenery, life, props, layers };
    stages.set(level, stage);
    if (stages.size > STAGES_KEPT) {
      const [oldest, gone] = stages.entries().next().value;
      stages.delete(oldest);
      scene.remove(gone.group);
      dispose(gone.group);
    }
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
    back.resize(scale * dpr);
    const box = canvas.getBoundingClientRect();
    Object.assign(worldCanvas.style, { left: `${box.left}px`, top: `${box.top}px` });
  }

  function paintSky(palette, altitude) {
    const tint = altitudeTint(Math.round(altitude / 10) * 10);
    worldCanvas.style.background = `linear-gradient(${tint.top}, ${tint.bottom}), linear-gradient(${palette.bgTop}, ${palette.bgBottom})`;
    scene.fog.color.copy(colorOf(palette.bgBottom)).lerp(colorOf(palette.bgTop), 0.45);
  }

  const biomesOf = view => [
    ...(view.above ? [{ level: view.above.level, state: view.above.state, offset: -view.above.level.height, current: false }] : []),
    ...(view.below ? [{ level: view.below.level, state: view.below.state, offset: view.level.height, current: false }] : []),
    { level: view.level, state: view.state, offset: 0, current: true },
  ];

  function drawBack(g, { level, state, offset, current }, view) {
    const { palette: p, theme } = stageFor(level), { time } = view;
    const top = view.camera - offset - CULL_MARGIN, bottom = top + HEIGHT + 2 * CULL_MARGIN;
    if (!current && (bottom < 0 || top > level.height)) return;
    g.save();
    g.translate(0, offset - view.camera);
    const home = homeOf(level);
    if (home && flat('home')) drawHome(g, home, time, current && !view.wardrobe && atWardrobe(home, level, state));
    if (level.hall && flat('hall')) drawHall(g, level, p, theme, time, state);
    if (!level.hall && !level.custom && flat('mouths')) drawMouths(g, level, p, time);
    if (!level.hall && !level.custom && flat('signpost')) drawSignpost(g, level, p, theme, time, current && view.freeSkill);
    if (home && flat('climbSign')) drawClimbSign(g, level, p, theme, time);
    if (current && view.god && !level.hall && flat('god')) drawGod(g, p, theme, level, time, state);
    if (flat('wires')) drawWires(g, p, theme, level, state, time);
    const unported = level.objects.filter(o => !modelled(o, theme) && !erased(state, o));
    const backdrop = o => o.type === 'water' || o.type === 'wind';
    for (const o of unported) if (backdrop(o)) drawObject(g, p, theme, level, o, state, time);
    for (const o of unported) if (!backdrop(o)) drawObject(g, p, theme, level, o, state, time);
    if (current && flat('flags')) for (const flag of view.planted ?? []) drawFlag(g, p, flag, true, time);
    if (flat('tombs')) for (const tomb of state.tombs) drawTomb(g, p, tomb, state.frame);
    if (flat('placed')) for (const rect of state.placed) drawPlaced(g, p, theme, rect, time);
    if (flat('bodies')) drawBodies(g, p, theme, level, state);
    if (flat('exit')) drawExit(g, p, level, time);
    g.restore();
  }

  function drawFront(view) {
    const { level, state, time } = view, { palette: p, theme } = stageFor(level), { w, h } = playerSize(level.rules);
    ctx.save();
    ctx.translate(0, -view.camera);
    if (view.path?.length) drawPath(ctx, view.path);
    if (view.ghost && flat('ghost')) drawPlayer(ctx, p, theme, level, view.ghost, HINT_ALPHA);
    if (view.architect?.started && !view.architect.done && flat('architect')) drawArchitect(ctx, p, level, view.architect.state, time);
    view.trail.forEach((t, i) => {
      ctx.globalAlpha = (i / view.trail.length) * (state.dashTimer > 0 ? 0.5 : 0.22 + 0.3 * state.charge);
      ctx.fillStyle = p.player;
      roundRect(ctx, t.x + w * 0.2, t.y + h * 0.2, w * 0.6, h * 0.6, 4);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (flat('arrows')) drawArrows(ctx, p, state);
    if (!level.hall && Number.isFinite(view.combo?.floor)) drawGuideLine(ctx, p.accent, view.combo.floor, 'COMBO LINE');
    const recordY = view.record > 0 ? altitudeY(view.biomeIndex, level, view.record) : -1;
    if (!level.hall && recordY > 0 && recordY < level.height) drawGuideLine(ctx, p.text, recordY, `BEST ${view.record.toLocaleString()} m`, true);
    if (!state.dead) {
      noteClimber(state);
      if (flat('powers')) drawPowers(ctx, level, state, time);
      if (view.combo) drawCombo(ctx, p, state, view.combo, w, h);
    }
    if (view.aim) drawAim(ctx, p, theme, level, state, view.aim, time);
    if (view.blink) drawBlinkPreview(ctx, p, level, state, view.blink, time);
    if (view.rival?.state && view.rival.index === view.biomeIndex && !view.rival.state.dead && flat('rival')) drawRival(ctx, p, theme, level, view.rival.state);
    if (flat('flood')) drawFlood(ctx, p, theme, level, state, time);
    if (view.echo) drawEcho(ctx, p, view.echo);
    drawParticles(ctx, view.particles);
    ctx.restore();
  }

  function stagePlayer(view, stage) {
    const { level, state } = view, hold = gripOffset(level, state);
    hero.update(level, hold ? { ...state, x: state.x + hold.x, y: state.y + hold.y } : state, view.avatar, stage.palette);
  }

  function draw(view) {
    const { level, state, time } = view, stage = stageFor(level);
    const shake = view.shake > 0 ? { x: (Math.random() - 0.5) * view.shake, y: (Math.random() - 0.5) * view.shake } : { x: 0, y: 0 };
    const { w, h } = playerSize(level.rules), player = { x: state.x + w / 2, y: state.y + h / 2 };
    worldCanvas.hidden = false;
    paintSky(stage.palette, view.altitude);
    const biomes = biomesOf(view);
    for (const s of stages.values()) s.group.visible = false;
    back.begin();
    back.ctx.save();
    back.ctx.translate(shake.x, shake.y);
    for (const biome of biomes) {
      const shown = stageFor(biome.level);
      if (shown.group.parent !== scene) scene.add(shown.group);
      shown.group.visible = true;
      shown.group.position.y = -biome.offset;
      shown.scenery.update(time);
      shown.life.update(time);
      const seen = { ...view, player: biome.current ? player : { x: -1e4, y: -1e4 }, touched: biome.current ? view.touched : [] };
      for (const { o, node, update } of shown.props.parts) {
        node.visible = !erased(biome.state, o);
        if (node.visible) update?.(biome.state, time, biome.level, seen);
      }
      for (const layer of shown.layers) layer.update(biome.state, time, biome.level, seen, biome.current);
      drawBack(back.ctx, biome, view);
    }
    back.ctx.restore();
    back.end();
    stagePlayer(view, stage);
    imp.group.visible = !level.hall && !level.custom;
    if (imp.group.visible) imp.update(level, state, time, view.difficulty);
    camera.position.set(WIDTH / 2 - shake.x, -(view.camera + HEIGHT / 2) + shake.y, EYE);
    sun.position.set(camera.position.x - 260, camera.position.y + 520, 600);
    sun.target.position.set(camera.position.x, camera.position.y, 0);
    camera.layers.set(0);
    gl.autoClear = true;
    gl.render(scene, camera);
    camera.layers.set(ACTORS);
    gl.autoClear = false;
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
    ctx.restore();
    if (!view.backdrop) drawInterface(ctx, view, stage, bar);
  }

  return {
    fit,
    draw,
    drawLoading: building => { worldCanvas.hidden = true; drawLoading(ctx, building); },
    paletteFor: level => stageFor(level).palette,
    forget: level => { const stage = stages.get(level); if (stage) { scene.remove(stage.group); dispose(stage.group); stages.delete(level); } },
    pointer: event => ({ x: event.offsetX / scale, y: event.offsetY / scale }),
    stop: () => { worldCanvas.hidden = true; for (const stage of stages.values()) dispose(stage.group); stages.clear(); },
  };
}
