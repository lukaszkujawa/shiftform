import { playerSize, initialState } from '../world/physics.js?v=c6062ce';
import { TILE, WIDTH, HEIGHT } from '../world/level.js?v=c6062ce';
import { RESTING, createAvatar } from '../art/avatar.js?v=c6062ce';
import { alpha } from '../art/themes.js?v=c6062ce';
import { godX, GOD_LOOK } from '../world/god.js?v=c6062ce';
import { THREE } from './toon.js?v=c6062ce';
import { EYE } from './scenery.js?v=c6062ce';
import { createHero } from './hero.js?v=c6062ce';
import { createLabel } from './hero-label.js?v=c6062ce';
import { createArchitect } from './figure-architect.js?v=c6062ce';

const HINT_ALPHA = 0.7;
const RIVAL_ALPHA = 0.4;
const BEHIND_CLIMBER = 12;

function createShade(opacity, tag) {
  const hero = createHero({ opacity }), label = tag && createLabel(700, 11);
  if (label) hero.group.add(label.sprite);
  return {
    group: hero.group,
    update(level, s, time, palette) {
      hero.update(level, s, RESTING, palette);
      label?.show(tag, alpha(palette.text, 0.7), s.x + playerSize(level.rules).w / 2, s.y - 6);
    },
  };
}

function createGod(level) {
  const hero = createHero(), avatar = { ...createAvatar('', GOD_LOOK), joy: 1 }, pose = initialState(level);
  return {
    group: hero.group,
    update(level, player, time, palette) {
      const { w, h } = playerSize(level.rules), x = godX(level), toward = Math.sign(player.x + w / 2 - x) || 1;
      Object.assign(pose, { x: x - w / 2, y: (level.rows - 1) * TILE - h - 6 + Math.sin(time / 400) * 3, facing: toward, grounded: true, frame: Math.floor(time / 16) });
      Object.assign(avatar, { lookX: toward, sway: Math.sin(time / 700) * 0.3 });
      hero.update(level, pose, avatar, palette);
    },
  };
}

const FIGURES = Object.entries({
  ghost: { behind: true, pose: view => view.ghost, make: () => createShade(HINT_ALPHA) },
  rival: { behind: true, pose: ({ rival, biomeIndex }) => (rival?.state && rival.index === biomeIndex && !rival.state.dead ? rival.state : null), make: () => createShade(RIVAL_ALPHA, 'ghost') },
  architect: { pose: ({ architect }) => (architect?.started && !architect.done ? architect.state : null), make: (level, palette) => createArchitect(palette) },
  god: { pose: (view, level, state) => (view.god && !level.hall ? state : null), make: createGod },
});

function recede(node, view) {
  const k = (EYE + BEHIND_CLIMBER) / EYE;
  node.scale.setScalar(k);
  node.position.set((WIDTH / 2) * (1 - k), -(view.camera + HEIGHT / 2) * (1 - k), -BEHIND_CLIMBER);
}

export function build(level, palette) {
  const group = new THREE.Group(), behind = new THREE.Group(), cast = new Map();
  group.add(behind);

  function summon(name, { behind: receded, make }) {
    if (!cast.has(name)) {
      const figure = make(level, palette);
      figure.group.traverse(node => { node.layers.mask = group.layers.mask; });
      (receded ? behind : group).add(figure.group);
      cast.set(name, figure);
    }
    return cast.get(name);
  }

  return {
    group,
    update(state, time, level, view, current) {
      recede(behind, view);
      for (const [name, role] of FIGURES) {
        const s = current ? role.pose(view, level, state) : null;
        if (!s) { if (cast.has(name)) cast.get(name).group.visible = false; continue; }
        const figure = summon(name, role);
        figure.group.visible = true;
        figure.update(level, s, time, palette);
      }
    },
  };
}
