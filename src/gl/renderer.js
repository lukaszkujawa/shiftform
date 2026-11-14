import { WIDTH, HEIGHT } from '../world/level.js';
import { playerSize } from '../world/physics.js';
import { barHeight, drawLoading, touchScreen } from '../ui/hud.js';
import { screen } from '../ui/screen.js';
import { altitudeY } from '../world/climb.js';
import { gripOffset, noteClimber } from '../art/rigging.js';
import { veil } from '../art/paint.js';
import { drawBlinkPreview, drawCombo } from '../art/player-effects.js';
import { drawAim } from '../art/placed-art.js';
import { drawPath, drawEcho, drawGuideLine } from '../art/trace-art.js';
import { drawInterface, drawParticles, drawDarkness, createRenderer as createFlatRenderer } from '../art/render.js';
import { gradeFilm, FILM_COSTUME } from '../art/film.js';
import { THREE, shadowed, featured, faded, roundBox } from './toon.js';
import { createLighting } from './lighting.js';
import { createBloom } from './bloom.js';
import { createImp } from './critters.js';
import { createHero } from './hero.js';
import { buildStage } from './stage.js';
import { createMoments } from './moments.js';

const STAGES_KEPT = 4;
const TILT = 0.1;
const IDLE_ZOOM = 1.15;
const PUNCH_ZOOM = 0.32;
const REVEAL_ZOOM = 0.3;
const STILL = 0.15;
const EASE_MS = { zoomIn: 1400, zoomOut: 350 };
const FX_MARGIN = 140;
const THUMBS_CSS = 200;
const SYSTEM_CSS = 54;
const TALLEST = 4 * HEIGHT;
const FOV = 30;
const eyeFor = height => height / 2 / Math.tan((FOV * Math.PI) / 360);

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
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, WIDTH / HEIGHT, 400, 5000);
  scene.add(camera);
  return { scene, camera, lighting: createLighting(scene) };
}

export function createRenderer(canvas, { cover = false } = {}) {
  const world = sharedGl();
  return world ? createWorldRenderer(canvas, world, cover) : { ...createFlatRenderer(canvas), stop() {} };
}

function createEffectsPlane(scene) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  plane.renderOrder = 10;
  scene.add(plane);
  let pixels = 1, tall = HEIGHT;
  return {
    resize(ratio, height) {
      pixels = ratio;
      tall = height;
      plane.scale.set(WIDTH + 2 * FX_MARGIN, tall + 2 * FX_MARGIN, 1);
      canvas.width = Math.ceil((WIDTH + 2 * FX_MARGIN) * pixels);
      canvas.height = Math.ceil((tall + 2 * FX_MARGIN) * pixels);
    },
    paint(top, draw) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(pixels, 0, 0, pixels, FX_MARGIN * pixels, (FX_MARGIN - top) * pixels);
      draw(ctx);
      plane.position.set(WIDTH / 2, -(top + tall / 2), 0);
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

function createWorldRenderer(canvas, { canvas: worldCanvas, gl }, cover) {
  const ctx = canvas.getContext('2d');
  const { scene, camera, lighting } = createWorld();
  const overlay = new THREE.Scene(), effects = createEffectsPlane(overlay), bloom = createBloom(gl, scene, overlay, camera), showTrail = createTrail(scene), moments = createMoments(scene);
  const aim = new THREE.Vector3(), sunAnchor = new THREE.Vector3(), seen = new THREE.Vector3(), ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  const beam = new THREE.PointLight(0xffb48a, 0, 1100, 1.3);
  scene.add(beam);
  let zoom = null, framedAt = 0;
  const hero = createHero(), imp = createImp();
  scene.add(shadowed(hero.group, { receive: false }), featured(shadowed(imp.group, { receive: false })));
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
    const bar = cover ? 0 : barHeight();
    scale = cover ? viewport.width / WIDTH : Math.min(viewport.width / WIDTH, viewport.height / (HEIGHT + bar));
    const height = cover ? viewport.height / scale : document.body.classList.contains('editing') ? HEIGHT : Math.min(TALLEST, Math.max(HEIGHT, viewport.height / scale - bar));
    const thumbs = !cover && touchScreen() && height > HEIGHT ? Math.min(height - HEIGHT, THUMBS_CSS / scale) : 0;
    Object.assign(screen, { height, thumbs, inset: thumbs ? SYSTEM_CSS / scale : 0, window: thumbs ? height - thumbs - HEIGHT : (height - HEIGHT) / 2 });
    camera.aspect = WIDTH / height;
    camera.far = eyeFor(height) + 2600;
    camera.updateProjectionMatrix();
    canvas.width = Math.floor(WIDTH * scale * dpr);
    canvas.height = Math.floor((height + bar) * scale * dpr);
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${(height + bar) * scale}px`;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    gl.setPixelRatio(dpr);
    gl.setSize(WIDTH * scale, height * scale);
    effects.resize(scale * dpr, height);
    bloom.resize(WIDTH * scale, height * scale, dpr);
    lighting.reach(height);
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
    const { state } = view, moving = Math.abs(state.vx) > STILL || Math.abs(state.vy) > STILL, tilt = view.editing ? 0 : TILT;
    const zoomTo = view.editing || moving ? 1 : IDLE_ZOOM;
    zoom = zoom === null ? zoomTo : zoom + (zoomTo - zoom) * (1 - Math.exp(-Math.max(0, view.time - framedAt) / (zoomTo > zoom ? EASE_MS.zoomIn : EASE_MS.zoomOut)));
    framedAt = view.time;
    const { dip, punch, reveal, lift } = moments.camera(view.time), framing = zoom * (1 + PUNCH_ZOOM * punch) * (1 - REVEAL_ZOOM * reveal);
    const pull = 1 - 1 / framing, distance = eyeFor(screen.height) / framing, middle = view.camera - screen.window + screen.height / 2;
    aim.set(WIDTH / 2 + (player.x - WIDTH / 2) * pull - shake.x, -(middle + (player.y - middle) * pull) + shake.y + reveal * lift - dip, 0);
    camera.position.set(aim.x, aim.y + Math.sin(tilt) * distance, Math.cos(tilt) * distance);
    camera.lookAt(aim);
  }

  function worldAt(x, y) {
    ray.setFromCamera(new THREE.Vector2((x / WIDTH) * 2 - 1, 1 - (y / screen.height) * 2), camera);
    return ray.ray.intersectPlane(floor, hit);
  }

  function onScreen(x, y) {
    seen.set(x, -y, 0).project(camera);
    return { x: ((seen.x + 1) / 2) * WIDTH, y: ((1 - seen.y) / 2) * screen.height };
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
    lighting.mood(stage.palette, view.altitude, eyeFor(screen.height) + 60, eyeFor(screen.height) + 1600);
    worldCanvas.style.filter = stage.theme.film ? 'grayscale(1) contrast(1.08)' : '';
    for (const shown of stages.values()) shown.group.visible = false;
    for (const biome of biomesOf(view)) {
      const shown = stageFor(biome.level);
      if (shown.group.parent !== scene) scene.add(shown.group);
      shown.update(biome, time, { ...view, player: biome.current ? player : { x: -1e4, y: -1e4 }, touched: biome.current ? view.touched : [] });
    }
    stagePlayer(view, stage);
    showTrail(view.trail, state, stage.palette, playerSize(level.rules));
    if (!view.editing) moments.update(view, stage.palette, time);
    imp.group.visible = !level.hall && !level.custom;
    if (imp.group.visible) imp.update(level, state, time, view.difficulty);
    frameCamera(view, shake, player);
    effects.paint(view.camera - screen.window, fx => drawEffects(fx, view));
    lighting.follow(aim, sunAnchor.set(WIDTH / 2, -(view.camera - screen.window + screen.height / 2), 0), [...imp.emitters, ...biomesOf(view).flatMap(biome => stageFor(biome.level).emitters)]);
    bloom.render(camera.position.z / Math.cos(TILT));
    ctx.clearRect(0, 0, WIDTH, screen.height + barHeight());
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, screen.height);
    ctx.clip();
    if (level.rules.darkness) {
      const lamp = onScreen(player.x, player.y);
      drawDarkness(ctx, { ...state, x: lamp.x - w / 2, y: lamp.y - h / 2 }, level, 0, view.light ?? 1, screen.height);
    }
    if (view.frozen) veil(ctx, 'rgba(120,130,160,0.22)', screen.height);
    if (view.flash > 0) veil(ctx, `rgba(255,255,255,${view.flash})`, screen.height);
    if (stage.theme.film) gradeFilm(ctx, time, { desaturate: false, height: screen.height });
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
      const x = event.offsetX / scale, y = event.offsetY / scale, world = worldAt(x, y);
      return { x, y, world: world && { x: world.x, y: -world.y } };
    },
    beacon(cssX, cssY, power, lift = 160) {
      const box = canvas.getBoundingClientRect(), world = worldAt((cssX - box.left) / scale, (cssY - box.top) / scale);
      beam.intensity = world ? power : 0;
      if (world) beam.position.set(world.x, world.y, lift);
    },
    fade: out => worldCanvas.classList.toggle('fading', out),
    stop: () => { worldCanvas.hidden = true; worldCanvas.classList.remove('fading'); for (const level of [...stages.keys()]) forget(level); },
  };
}
