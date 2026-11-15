import { themeFor } from '../art/themes.js?v=3328ffe';
import { THREE, featured, shadowed, clock, climber } from './toon.js?v=3328ffe';
import { buildTerrain } from './terrain.js?v=3328ffe';
import { buildScenery } from './scenery.js?v=3328ffe';
import { buildProps } from './props.js?v=3328ffe';
import { createLife } from './life.js?v=3328ffe';
import * as setPieces from './setpieces.js?v=3328ffe';
import * as fixtures from './fixtures.js?v=3328ffe';
import * as cast from './cast.js?v=3328ffe';
import * as figures from './figures.js?v=3328ffe';

const LAYERS = [setPieces, fixtures, cast, figures];

export function buildStage(level) {
  const theme = themeFor(level), palette = theme.palette(level.palette);
  const scenery = buildScenery(level, palette, theme), life = createLife(level, palette, theme), props = buildProps(level, palette, theme);
  const layers = LAYERS.map(layer => layer.build(level, palette, theme));
  const [pieces, ...actors] = layers.map(layer => shadowed(layer.group));
  const group = new THREE.Group().add(shadowed(buildTerrain(level, palette, theme)), scenery.group, life.group, featured(shadowed(props.group)), pieces, ...actors.map(featured));
  const emitters = [];
  group.traverse(node => { if (node.userData.emitter) emitters.push(node); });
  return {
    theme, palette, group, emitters,
    update({ state, offset, current }, time, view) {
      group.visible = true;
      group.position.y = -offset;
      clock.value = time / 1000;
      if (current) climber.value.set(view.player.x, -view.player.y);
      scenery.update(time);
      life.update(time, view.camera - offset, current);
      props.update(state, time, view);
      for (const layer of layers) layer.update(state, time, level, view, current);
    },
    dispose() {
      group.removeFromParent();
      group.traverse(node => node.geometry?.dispose());
    },
  };
}
