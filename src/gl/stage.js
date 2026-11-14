import { themeFor } from '../art/themes.js?v=92c407e';
import { THREE, shadowed } from './toon.js?v=92c407e';
import { buildTerrain } from './terrain.js?v=92c407e';
import { buildScenery } from './scenery.js?v=92c407e';
import { buildProps } from './props.js?v=92c407e';
import { createLife } from './life.js?v=92c407e';
import * as setPieces from './setpieces.js?v=92c407e';
import * as fixtures from './fixtures.js?v=92c407e';
import * as cast from './cast.js?v=92c407e';
import * as figures from './figures.js?v=92c407e';

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
