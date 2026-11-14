import { themeFor } from '../art/themes.js';
import { THREE } from './toon.js';
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
  const group = new THREE.Group().add(buildTerrain(level, palette, theme), scenery.group, life.group, props.group, ...layers.map(layer => layer.group));
  return {
    theme, palette, group,
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
