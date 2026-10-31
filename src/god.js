import { TILE, WIDTH } from './level.js?v=ce820f8';
import { grant, playerSize, initialState } from './physics.js?v=ce820f8';
import { MUTATORS, BOONS, mutatorById } from './rules.js?v=ce820f8';
import { wear } from './run.js?v=ce820f8';
import { TRICKS } from './tricks.js?v=ce820f8';
import { createAvatar } from './avatar.js?v=ce820f8';
import { drawPlayer } from './player-art.js?v=ce820f8';
import { shopsX } from './signpost.js?v=ce820f8';

const REACH = 40;
const RUNES = 10;
const POINTS = 5000;
const STOCK = 3;
const LOOK = { tint: 'hsl(48 95% 70% / 1)', top: 'halo', glasses: 'shades', back: 'wings', neck: 'chain' };

export const GIFTS = [
  { icon: '💎', title: `${RUNES} runes`, give: run => { run.runes += RUNES; } },
  { icon: '🪙', title: `${POINTS} points`, give: run => { run.points += POINTS; } },
  { icon: '❤️', title: 'One more life', give: run => { run.maxLives += 1; run.lives = run.maxLives; } },
  { icon: '🎒', title: 'Every item', give: run => {
    run.s = ['jetpack', 'boots', 'shield', 'bow'].reduce((s, kind) => grant(s, kind), { ...run.s });
    run.tricks = [...run.tricks, ...Object.keys(TRICKS).filter(kind => TRICKS[kind].held).flatMap(kind => Array(STOCK).fill(kind))];
  } },
  { icon: '📜', title: 'Every bane', give: run => { run.collected = MUTATORS.filter(m => m.effect === 'bane').map(m => m.id); } },
  { icon: '🚀', title: 'To the top', give: run => { run.s = summit(run.level, run.s); } },
];

const MORE = { icon: '➡️', title: 'More', more: true };
const PAGE = 6;
const gearGifts = BOONS.map(id => ({ rule: id, title: mutatorById(id).title, give: run => wear(run, id) }));

export const GOD_PAGES = [[...GIFTS, MORE], ...Array.from({ length: Math.ceil(gearGifts.length / PAGE) }, (_, k) => [...gearGifts.slice(k * PAGE, (k + 1) * PAGE), MORE])];

export const godX = level => WIDTH - shopsX(level);

export function nearGod(level, s) {
  const { w } = playerSize(level.rules);
  return !level.hall && s.grounded && Math.abs(s.x + w / 2 - godX(level)) < REACH;
}

function summit(level, s) {
  const { w, h } = playerSize(level.rules);
  const spring = level.objects.find(o => o.type === 'spring' && o.y < 6 * TILE && Math.abs(o.x - level.exit.x) < TILE);
  const x = spring ? spring.x + spring.w + 2 : level.exit.x + level.exit.w;
  const y = (spring ? spring.y + spring.h : 4 * TILE) - h;
  return { ...s, x: Math.min(WIDTH - w, x), y, vx: 0, vy: 0, grounded: true, dead: false };
}

export function drawGod(ctx, p, theme, level, time, player) {
  const { w, h } = playerSize(level.rules), floor = (level.rows - 1) * TILE, x = godX(level);
  const toward = Math.sign(player.x + w / 2 - x) || 1;
  const pose = { ...initialState(level), x: x - w / 2, y: floor - h - 6 + Math.sin(time / 400) * 3, facing: toward, grounded: true, frame: Math.floor(time / 16) };
  drawPlayer(ctx, p, theme, level, pose, 1, { ...createAvatar('', LOOK), lookX: toward, joy: 1, sway: Math.sin(time / 700) * 0.3 });
}
