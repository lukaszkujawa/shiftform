import { Rng, hashString, mix } from './rng.js';
import { JETPACK_FUEL, ARROWS, volleyAt } from './rules.js';

export const MAX_SKILL = 5;
const JUMP_FADE = 0.9;
const LIFT_PER_LEVEL = 0.04;
const DASH_FRAMES = 8;
const DASH_FRAMES_PER_LEVEL = 3;
const GLIDE_START = 2.5;
const GLIDE_PER_LEVEL = 0.3;
const CHARGE_START = 0.4;
const CHARGE_PER_LEVEL = 0.2;
const LIGHT_PER_LEVEL = 0.5;
const FUEL_PER_LEVEL = 0.2;
const ARROWS_PER_LEVEL = 2;
const OFFER_SALT = 0x534b494c;
const OFFER_SIZE = 6;

const times = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const percent = n => `${Math.round(n * 100)}%`;

export const SKILLS = {
  torch: { title: 'Torch', icon: 'torch', about: 'See more of what is about to kill you in the dark.', now: n => `${percent(lightOf({ torch: n }))} of the usual light`, apply: () => {} },
  jump: { title: 'Jump', icon: 'triple', about: 'Jump again in mid-air, because gravity is more of a suggestion.', now: n => times(n, 'air jump'), apply: (r, n) => { r.jumps = 1 + n; r.airFade = JUMP_FADE; } },
  spider: { title: 'Spider', icon: 'walls', about: 'Jump off walls in mid-air, no web required.', now: n => `${times(n, 'kick')} off the same wall`, apply: (r, n) => { r.wallJump = true; r.wallKicks = n; } },
  jumper: { title: 'Jumper', icon: 'moon', about: 'Your jumps go higher and your knees file a complaint.', now: n => `${percent((1 + LIFT_PER_LEVEL * n) ** 2)} of the usual height`, apply: (r, n) => { r.jumpVel *= 1 + LIFT_PER_LEVEL * n; } },
  dash: { title: 'Dash', icon: 'dash', about: 'Hold X to bolt sideways, once per landing.', aboutOnTouch: 'Hold » to bolt sideways, once per landing.', now: n => `${dashFrames(n) * 11} px dash`, apply: (r, n) => { r.dash = true; r.dashFrames = dashFrames(n); } },
  teleport: { title: 'Teleport', icon: 'blink', about: 'Press T to blink a jump away, platforms be damned.', aboutOnTouch: 'Tap ⌖ to blink a jump away, platforms be damned.', now: n => times(n, 'teleport'), apply: (r, n) => { r.blinkJump = true; r.teleports = n; } },
  shield: { title: 'Shield', icon: 'shield', about: 'Takes a hit for you, then sits out until the next biome.', now: n => `${times(n, 'shield')} per biome`, apply: (r, n) => { r.shields = n; } },
  umbrella: { title: 'Umbrella', icon: 'glide', about: 'Hold jump while falling to drift down like you meant to.', now: n => `falls at ${glideAt(n).toFixed(1)} px a frame`, apply: (r, n) => { r.glide = true; r.glideSpeed = glideAt(n); } },
  flywheel: { title: 'Flywheel', icon: 'flywheel', about: 'Keep running one way to go faster and jump higher.', now: n => `${percent(chargeAt(n))} charge power`, apply: (r, n) => { r.flywheel = true; r.chargePower = chargeAt(n); } },
  jetpack: { title: 'Jetpack', icon: 'jetpack', about: 'Every jetpack you find or buy holds more fuel.', now: n => `${(1 + FUEL_PER_LEVEL * n).toFixed(1)}x fuel`, apply: (r, n) => { r.jetFuel = Math.round(JETPACK_FUEL * (1 + FUEL_PER_LEVEL * n)); } },
  bow: { title: 'Bow', icon: 'bow', about: 'Press V to fire arrows, with less and less need to aim.', aboutOnTouch: 'Tap the bow to fire arrows, with less and less need to aim.', now: n => `${quiverAt(n)} arrows, ${times(volleyAt(n).length, 'way')} at once`, apply: (r, n) => { r.quiver = quiverAt(n); r.volley = volleyAt(n); }, fill: (s, r) => ({ ...s, arrows: Math.max(s.arrows, r.quiver) }) },
  heart: { title: 'Heart', icon: 'spare', about: 'More lives, for all the mistakes you have planned.', now: n => `+${n} ${n === 1 ? 'life' : 'lives'}`, apply: () => {} },
};

export const SKILL_IDS = Object.keys(SKILLS);

function dashFrames(n) { return DASH_FRAMES + DASH_FRAMES_PER_LEVEL * (n - 1); }
function quiverAt(n) { return ARROWS + ARROWS_PER_LEVEL * n; }
function glideAt(n) { return GLIDE_START - GLIDE_PER_LEVEL * n; }
function chargeAt(n) { return CHARGE_START + CHARGE_PER_LEVEL * n; }

export const levelOf = (skills, id) => skills[id] ?? 0;

export function skillOffer(seed, index, skills, roll = 0) {
  const rng = new Rng(mix(mix(hashString(seed), index * 7919 + 1), OFFER_SALT + roll));
  return rng.shuffle(SKILL_IDS.filter(id => levelOf(skills, id) < MAX_SKILL)).slice(0, OFFER_SIZE);
}

export const priceOf = (skills, id) => levelOf(skills, id) + 1;
export const lightOf = skills => 1 + LIGHT_PER_LEVEL * levelOf(skills, 'torch');

export function withSkills(rules, skills) {
  const skilled = { ...rules };
  for (const [id, level] of Object.entries(skills)) SKILLS[id].apply(skilled, level);
  return skilled;
}

