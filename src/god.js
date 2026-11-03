import { TILE, WIDTH } from './level.js?v=ac45b7e';
import { grant, playerSize, initialState } from './physics.js?v=ac45b7e';
import { MUTATORS } from './rules.js?v=ac45b7e';
import { train } from './run.js?v=ac45b7e';
import { SKILLS, SKILL_IDS, MAX_SKILL, levelOf } from './skills.js?v=ac45b7e';
import { TRICKS } from './tricks.js?v=ac45b7e';
import { createAvatar } from './avatar.js?v=ac45b7e';
import { drawPlayer } from './player-art.js?v=ac45b7e';
import { shopsX } from './signpost.js?v=ac45b7e';

const REACH = 40;
const RUNES = 10;
const POINTS = 5000;
const STOCK = 3;
const LOOK = { tint: 'hsl(48 95% 70% / 1)', top: 'halo', glasses: 'shades', back: 'wings', neck: 'chain' };

export const GIFTS = [
  { icon: '💎', title: `${RUNES} runes`, give: run => { run.runes += RUNES; } },
  { icon: '🪙', title: `${POINTS} gold`, give: run => { run.points += POINTS; } },
  { icon: '❤️', title: 'One more life', give: run => { run.maxLives += 1; run.lives = run.maxLives; } },
  { icon: '🎒', title: 'Every item', give: run => {
    run.s = ['jetpack', 'boots', 'shield', 'bow'].reduce((s, kind) => grant(s, kind, run.level.rules), { ...run.s });
    run.tricks = [...run.tricks, ...Object.keys(TRICKS).filter(kind => TRICKS[kind].held).flatMap(kind => Array(STOCK).fill(kind))];
  } },
  { icon: '📜', title: 'Every bane', give: run => { run.collected = MUTATORS.filter(m => m.effect === 'bane').map(m => m.id); } },
  { icon: '🚀', title: 'To the top', give: run => { run.s = summit(run.level, run.s); } },
];

const MORE = { icon: '➡️', title: 'More', more: true };
const PAGE = 6;
const skillGifts = SKILL_IDS.map(id => ({ skill: id, title: SKILLS[id].title, give: run => { if (levelOf(run.skills, id) < MAX_SKILL) train(run, id); } }));

export const GOD_PAGES = [[...GIFTS, MORE], ...Array.from({ length: Math.ceil(skillGifts.length / PAGE) }, (_, k) => [...skillGifts.slice(k * PAGE, (k + 1) * PAGE), MORE])];

export const godX = level => WIDTH - shopsX(level);

export function nearGod(level, s) {
  const { w, h } = playerSize(level.rules);
  const onFloor = s.grounded && Math.abs(s.y + h - (level.rows - 1) * TILE) < 1;
  return !level.hall && onFloor && Math.abs(s.x + w / 2 - godX(level)) < REACH;
}

export function summit(level, s) {
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
