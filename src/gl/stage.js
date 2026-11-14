import { themeFor } from '../art/themes.js';
import { THREE, shadowed } from './toon.js';
import { buildTerrain } from './terrain.js';
import { buildScenery } from './scenery.js';
import { buildProps } from './props.js';
import { createLife } from './life.js';
import * as setPieces from './setpieces.js';
import * as fixtures from './fixtures.js';
import * as cast from './cast.js';
import * as figures from './figures.js';

const LAYERS = [setPieces, fixtures, cast, figures];

export function buildStage(level) {
  const theme = themeFor(level), palette = theme.palette(level.palette);
  const scenery = buildScenery(level, palette, theme), life = createLife(level, palette, theme), props = buildProps(level, palette, theme);
  const layers = LAYERS.map(layer => layer.build(level, palette, theme));
  const group = new THREE.Group().add(shadowed(buildTerrain(level, palette, theme)), scenery.group, life.group, shadowed(props.group), ...layers.map(layer => shadowed(layer.group)));
  const emitters = [];
  group.traverse(node => { if (node.userData.emitter) emitters.push(node); });
  return {
    theme, palette, group, emitters,
    update({ state, offset, current }, time, view) {
      group.visible = true;
      group.position.y = -offset;
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
