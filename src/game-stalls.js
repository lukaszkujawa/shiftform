import { TILE } from './level.js';
import { canBuy, stallOf, shopOffer, canLearn, skillPrice, skillsOnOffer, canReroll, atImp, difficultyOffer } from './run.js';
import { levelOf } from './skills.js';
import { skillTip } from './tooltip.js';
import { MERCHANT, TRAINER, DICER } from './tunnel.js';
import { GOD_PAGES, godX, nearGod } from './god.js';
import { impX } from './imp.js';
import { DIFFICULTIES } from './difficulty.js';
import { DEV } from './game-tools.js';

const GOD = 'god';
const IMP = 'imp';
const COME_BACK = "Come back when you're more experienced.";

export function createStalls({ game, audio }) {
  const atGod = () => DEV && game.run.phase === 'play' && nearGod(game.run.level, game.run.s);
  const standingAt = () => stallOf(game.run) ?? (atGod() ? GOD : game.run.phase === 'play' && atImp(game.run) ? IMP : null);

  function stallView(time) {
    const { run } = game, id = standingAt();
    if (id !== game.stall?.id) Object.assign(game, { stall: id && { id, since: time }, godPage: 0 });
    if (!id) return null;
    const base = { id, age: time - game.stall.since, floor: run.level.height - TILE - game.camera };
    if (id === GOD) return { ...base, x: godX(run.level), gifts: GOD_PAGES[game.godPage].map(gift => ({ ...gift, level: gift.skill ? levelOf(run.skills, gift.skill) : 0 })) };
    if (id === IMP) return { ...base, x: impX(run.level), tiers: difficultyOffer(run) };
    if (id === DICER) return { ...base, dice: true, affordable: canReroll(run) };
    if (id === TRAINER) return { ...base, skills: skillsOnOffer(run).map(skill => ({ id: skill, level: levelOf(run.skills, skill), price: skillPrice(run, skill), affordable: canLearn(run, skill), tip: skillTip(skill, run.skills) })) };
    const offer = shopOffer(run);
    if (offer) return { ...base, offer, bought: run.bought, affordable: offer.map(kind => canBuy(run, kind)) };
    return { ...base, note: COME_BACK };
  }

  function useStall(n) {
    if (standingAt() === IMP) { if (DIFFICULTIES[n - 1]) game.pending = { difficulty: n - 1 }; return; }
    if (standingAt() === GOD) {
      const gift = GOD_PAGES[game.godPage][n - 1];
      if (gift?.more) { game.godPage = (game.godPage + 1) % GOD_PAGES.length; audio.play({ type: 'pick' }); }
      else if (gift) { gift.give(game.run); audio.play({ type: 'item' }); game.flash = 0.25; }
      return;
    }
    if (stallOf(game.run) === MERCHANT) { game.pending = { pick: n }; return; }
    if (stallOf(game.run) === TRAINER) { if (skillsOnOffer(game.run)[n - 1]) game.pending = { skill: n }; return; }
    if (stallOf(game.run) === DICER && n === 1) game.pending = { reroll: true };
  }

  return { standingAt, stallView, useStall };
}
