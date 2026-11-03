import { MOVE_IDS } from './moves.js?v=ac45b7e';

const STYLE_WEIGHT = 0.5;
const RISE_SCALE = 3;
const NOVELTY_SPAN = 2;

const kindOf = node => (node.connector ? 'shaft' : MOVE_IDS.includes(node.move) ? node.move : 'hop');

export function profileOf(nodes) {
  const counts = Object.fromEntries(MOVE_IDS.map(id => [id, 0]));
  let flips = 0, rise = 0;
  for (let i = 1; i < nodes.length; i++) {
    counts[kindOf(nodes[i])]++;
    rise += nodes[i - 1].row - nodes[i].row;
    if (i > 1 && nodes[i].dir !== nodes[i - 1].dir) flips++;
  }
  const legs = Math.max(1, nodes.length - 1);
  return { moves: MOVE_IDS.map(id => counts[id] / legs), flips: flips / legs, rise: rise / legs };
}

const distance = (a, b) => a.moves.reduce((d, v, i) => d + Math.abs(v - b.moves[i]), 0) + Math.abs(a.flips - b.flips) + Math.abs(a.rise - b.rise) / RISE_SCALE;

export const novelty = (profile, history) => (history.length ? Math.min(1, Math.min(...history.map(h => distance(profile, h))) / NOVELTY_SPAN) : 1);

export function styleFit(profile, weights) {
  const total = MOVE_IDS.reduce((s, id) => s + (weights[id] ?? 0), 0) || 1;
  return MOVE_IDS.reduce((s, id, i) => {
    const expected = (weights[id] ?? 0) / total;
    return expected > 0 ? s + (profile.moves[i] - expected) ** 2 / expected : s + profile.moves[i] * 4;
  }, 0);
}

export const score = (profile, history, weights) => novelty(profile, history) - STYLE_WEIGHT * styleFit(profile, weights);
