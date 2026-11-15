import { shape } from './toon.js?v=cb728ba';
import { HATS, ACCESSORIES, HEADWEAR_MOTION } from './hero-headwear.js?v=cb728ba';
import { GLASSES, FACES, NECKS, BACKS, WEAR_MOTION } from './hero-wear.js?v=cb728ba';

const SLOTS = [['hat', HATS, 'crown'], ['accessory', ACCESSORIES, 'crown'], ['glasses', GLASSES, 'face'], ['face', FACES, 'face'], ['neck', NECKS, 'chest'], ['back', BACKS, 'chest']];
const MOTION = { ...HEADWEAR_MOTION, ...WEAR_MOTION };

export function createWardrobe(anchors, finish) {
  let key = null, worn = [];
  return {
    get worn() { return worn; },
    dress(avatar, tall) {
      const next = `${tall}|${SLOTS.map(([slot]) => avatar[slot]).join('|')}`;
      if (next === key) return false;
      key = next;
      for (const { node } of worn) node.removeFromParent();
      worn = SLOTS.filter(([slot, , anchor]) => avatar[slot] && (tall || anchor !== 'crown')).map(([slot, table, anchor]) => {
        const node = shape(`hero:${slot}:${avatar[slot]}`, table[avatar[slot]]).clone();
        anchors[anchor].add(node);
        finish(node);
        return { node, move: MOTION[avatar[slot]] };
      });
      return true;
    },
    animate(motion) {
      for (const { node, move } of worn) move?.(node, motion);
    },
  };
}
