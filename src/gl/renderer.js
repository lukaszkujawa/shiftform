import { WIDTH, HEIGHT } from '../world/level.js';
import { playerSize } from '../world/physics.js';
import { barHeight, drawLoading } from '../ui/hud.js';
import { altitudeY } from '../world/climb.js';
import { gripOffset, noteClimber } from '../art/rigging.js';
import { veil } from '../art/paint.js';
import { drawBlinkPreview, drawCombo } from '../art/player-effects.js';
import { drawAim } from '../art/placed-art.js';
import { drawPath, drawEcho, drawGuideLine } from '../art/trace-art.js';
import { drawInterface, drawParticles, drawDarkness, createRenderer as createFlatRenderer } from '../art/render.js';
import { gradeFilm, FILM_COSTUME } from '../art/film.js';
import { THREE, shadowed, faded, roundBox } from './toon.js';
import { createLighting } from './lighting.js';
import { createBloom } from './bloom.js';
import { EYE } from './scenery.js';
import { createImp } from './critters.js';
import { createHero } from './hero.js';
import { buildStage } from './stage.js';

const STAGES_KEPT = 4;
const LEAN = (4 * Math.PI) / 180;
const TILT = 0.1;
const IDLE_ZOOM = 1.15;
const STILL = 0.15;
const EASE_MS = { lean: 500, zoomIn: 1400, zoomOut: 350 };
const FX_MARGIN = 140;

let shared = null;

function sharedGl() {
  if (shared !== null) return shared;
  const canvas = document.createElement('canvas');
  canvas.id = 'world';
  try {
    const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    gl.setClearColor(0x000000, 0);
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    document.body.prepend(canvas);
    return (shared = { canvas, gl });
  } catch {
    return (shared = false);
  }
}

function createWorld() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 10, 5000);
  scene.add(camera);
  return { scene, camera, lighting: createLighting(scene) };
}

export function createRenderer(canvas) {
  const world = sharedGl();
  return world ? createWorldRenderer(canvas, world) : { ...createFlatRenderer(canvas), stop() {} };
}

function createEffectsPlane(scene) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const w = WIDTH + 2 * FX_MARGIN, h = HEIGHT + 2 * FX_MARGIN;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  plane.renderOrder = 10;
  plane.userData.overlay = true;
  scene.add(plane);
  let pixels = 1;
  return {
    resize(ratio) {
      pixels = ratio;
      canvas.width = Math.ceil(w * pixels);
      canvas.height = Math.ceil(h * pixels);
    },
    paint(camera, draw) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(pixels, 0, 0, pixels, FX_MARGIN * pixels, (FX_MARGIN - camera) * pixels);
      draw(ctx);
      plane.position.set(WIDTH / 2, -(camera + HEIGHT / 2), 0);
      texture.needsUpdate = true;
    },
  };
}

function createTrail(scene) {
  const body = roundBox(1, 1, 1, 0.3), ghosts = [];
  return function show(trail, state, palette, { w, h }) {
    while (ghosts.length < trail.length) {
      const ghost = new THREE.Mesh(body);
      scene.add(ghost);
      ghosts.push(ghost);
    }
    ghosts.forEach((ghost, i) => {
      const step = trail[i];
      ghost.visible = !!step;
      if (!step) return;
      ghost.material = faded(palette.player, (i / trail.length) * (state.dashTimer > 0 ? 0.5 : 0.22 + 0.3 * state.charge));
      ghost.position.set(step.x + w / 2, -(step.y + h / 2), -4);
      ghost.scale.set(w * 0.6, h * 0.6, 8);
    });
  };
}

function createWorldRenderer(canvas, { canvas: worldCanvas, gl }) {
  const ctx = canvas.getContext('2d');
  const { scene, camera, lighting } = createWorld();
  const effects = createEffectsPlane(scene), bloom = createBloom(gl, scene, camera), showTrail = createTrail(scene);
  const aim = new THREE.Vector3(), seen = new THREE.Vector3(), ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  let lean = null, zoom = 1, framedAt = 0;
  const hero = createHero(), imp = createImp();
  scene.add(shadowed(hero.group, { receive: false }), shadowed(imp.group, { receive: false }));
  imp.emitters = [];
  imp.group.traverse(node => { if (node.userData.emitter) imp.emitters.push(node); });
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
    effects.resize(scale * dpr);
    bloom.resize(WIDTH * scale, HEIGHT * scale, dpr);
    const box = canvas.getBoundingClientRect();
    Object.assign(worldCanvas.style, { left: `${box.left}px`, top: `${box.top}px` });
  }

  const biomesOf = view => [
    ...(view.above ? [{ level: view.above.level, state: view.above.state, offset: -view.above.level.height, current: false }] : []),
    ...(view.below ? [{ level: view.below.level, state: view.below.state, offset: view.level.height, current: false }] : []),
    { level: view.level, state: view.state, offset: 0, current: true },
  ];

  function drawEffects(ctx, view) {
    const { level, state, time } = view, { palette: p, theme } = stageFor(level), { w, h } = playerSize(level.rules);
    if (view.path?.length) drawPath(ctx, view.path);
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
  }

  function frameCamera(view, shake, player) {
    const { state, keys } = view, moving = Math.abs(state.vx) > STILL || Math.abs(state.vy) > STILL, tilt = view.editing ? 0 : TILT;
    const steering = !view.editing && !!keys?.left !== !!keys?.right && Math.abs(state.vx) > STILL;
    const leanTo = steering ? Math.sign(state.vx) * LEAN : 0, zoomTo = view.editing || moving ? 1 : IDLE_ZOOM;
    const elapsed = Math.max(0, view.time - framedAt), ease = ms => 1 - Math.exp(-elapsed / ms);
    if (lean === null) [lean, zoom] = [leanTo, zoomTo];
    lean += (leanTo - lean) * ease(EASE_MS.lean);
    zoom += (zoomTo - zoom) * ease(zoomTo > zoom ? EASE_MS.zoomIn : EASE_MS.zoomOut);
    framedAt = view.time;
    const pull = 1 - 1 / zoom, distance = EYE / zoom;
    aim.set(WIDTH / 2 + (player.x - WIDTH / 2) * pull - shake.x, -(view.camera + HEIGHT / 2 + (player.y - view.camera - HEIGHT / 2) * pull) + shake.y, 0);
    camera.position.set(aim.x + Math.sin(lean) * Math.cos(tilt) * distance, aim.y + Math.sin(tilt) * distance, Math.cos(lean) * Math.cos(tilt) * distance);
    camera.lookAt(aim);
  }

  function onScreen(x, y) {
    seen.set(x, -y, 0).project(camera);
    return { x: ((seen.x + 1) / 2) * WIDTH, y: ((1 - seen.y) / 2) * HEIGHT };
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
    lighting.mood(stage.palette, view.altitude, EYE + 60, EYE + 1600);
    worldCanvas.style.filter = stage.theme.film ? 'grayscale(1) contrast(1.08)' : '';
    for (const shown of stages.values()) shown.group.visible = false;
    for (const biome of biomesOf(view)) {
      const shown = stageFor(biome.level);
      if (shown.group.parent !== scene) scene.add(shown.group);
      shown.update(biome, time, { ...view, player: biome.current ? player : { x: -1e4, y: -1e4 }, touched: biome.current ? view.touched : [] });
    }
    stagePlayer(view, stage);
    showTrail(view.trail, state, stage.palette, playerSize(level.rules));
    imp.group.visible = !level.hall && !level.custom;
    if (imp.group.visible) imp.update(level, state, time, view.difficulty);
    frameCamera(view, shake, player);
    effects.paint(view.camera, fx => drawEffects(fx, view));
    lighting.follow(aim, [...imp.emitters, ...biomesOf(view).flatMap(biome => stageFor(biome.level).emitters)]);
    bloom.render();
    ctx.clearRect(0, 0, WIDTH, HEIGHT + barHeight());
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT);
    ctx.clip();
    if (level.rules.darkness) {
      const lamp = onScreen(player.x, player.y);
      drawDarkness(ctx, { ...state, x: lamp.x - w / 2, y: lamp.y - h / 2 }, level, 0, view.light ?? 1);
    }
    if (view.frozen) veil(ctx, 'rgba(120,130,160,0.22)');
    if (view.flash > 0) veil(ctx, `rgba(255,255,255,${view.flash})`);
    if (stage.theme.film) gradeFilm(ctx, time, { desaturate: false });
    ctx.restore();
    if (!view.backdrop) drawInterface(ctx, view, stage, bar);
  }

  return {
    fit,
    draw,
    drawLoading: building => { worldCanvas.hidden = true; drawLoading(ctx, building); },
    paletteFor: level => stageFor(level).palette,
    forget,
    pointer: event => {
      const x = event.offsetX / scale, y = event.offsetY / scale;
      ray.setFromCamera(new THREE.Vector2((x / WIDTH) * 2 - 1, 1 - (y / HEIGHT) * 2), camera);
      return { x, y, world: ray.ray.intersectPlane(floor, hit) ? { x: hit.x, y: -hit.y } : null };
    },
    stop: () => { worldCanvas.hidden = true; for (const level of [...stages.keys()]) forget(level); },
  };
}
