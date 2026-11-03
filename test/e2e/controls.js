import { sleep } from './browser.js';

const SCRIPT_LIMIT_MS = 15000;
const timed = run => `Promise.race([${run}, new Promise(done => setTimeout(() => done(null), ${SCRIPT_LIMIT_MS}))])`;
const script = (ev, steps) => ev(timed(`shiftform.script(${JSON.stringify(steps)})`));
const touch = (ev, selector, type) => ev(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new PointerEvent(${JSON.stringify(type)}, { pointerId: 7, bubbles: true }))`);

async function agentScripts({ ev, check, state }) {
  const moved = await script(ev, 'settle, right 12, wait 5, settle');
  check('agent scripts drive the climber', moved?.grounded, `x ${moved?.x}`);
  await script(ev, 'settle, press KeyH, wait 20, press KeyH, wait 2');
  check('the hint turns on and off', !(await state()).dead);
  check('the proof can be read for any stretch', (await ev('shiftform.proof(0).length')) > 0);
  await ev(timed('shiftform.script(shiftform.solution(0).slice(0, 400))'));
  check('a proof plays through the script runner', (await ev('shiftform.path().length')) > 0);
  await ev('shiftform.clear()');
  check('the trail clears', (await ev('shiftform.path().length')) === 0);
}

async function wardrobe({ ev, tap, until, check, state }) {
  const { rows, start } = await ev('shiftform.level()');
  const floor = (rows - 1) * 30 - 26;
  const frozen = async () => { const a = (await state()).frame; await sleep(120); return a === (await state()).frame; };
  let opened = false;
  for (let dx = -240; dx <= 240 && !opened; dx += 24) {
    await ev(`shiftform.warp(${Math.max(4, start.x + dx)}, ${floor})`);
    await until(async () => (await state()).grounded, 800, 40);
    await tap('KeyF');
    opened = await frozen();
  }
  check('F at the wardrobe opens it and holds the game', opened);
  await tap('ArrowRight');
  await tap('KeyR');
  await tap('Escape');
  await sleep(150);
  check('leaving the wardrobe lets the game run on', !(await frozen()));
}

async function touchButtons({ ev, until, check, state }) {
  await until(async () => (await state()).grounded, 2000);
  const x = (await state()).x, direction = x < 480 ? 'right' : 'left';
  const button = `#touch [data-input~="${direction}"]`;
  await touch(ev, button, 'pointerdown');
  await sleep(350);
  await touch(ev, button, 'pointerup');
  const after = (await state()).x;
  check('touch buttons walk the climber', Math.abs(after - x) > 20, `${x} -> ${after}`);
}

async function teleporting({ ev, tap, until, check, state }) {
  const gift = await ev(`import('/src/world/god.js').then(m => { const page = m.GOD_PAGES.findIndex(q => q.some(g => g.skill === 'teleport')); return { page, slot: m.GOD_PAGES[page].findIndex(g => g.skill === 'teleport') + 1, more: m.GOD_PAGES[0].findIndex(g => g.more) + 1, x: m.godX({ start: shiftform.level().start, ...shiftform.level() }) }; })`);
  const { rows } = await ev('shiftform.level()');
  await ev(`shiftform.warp(${gift.x - 10}, ${(rows - 1) * 30 - 26})`);
  const turns = Array.from({ length: gift.page }, () => `press Digit${gift.more}, wait 3`);
  await script(ev, ['settle', ...turns, `press Digit${gift.slot}`, 'wait 3'].join(', '));
  const before = await state();
  check('the god gives a skill', before.skills.teleport >= 1, JSON.stringify(before.skills));
  await tap('KeyT');
  await sleep(100);
  const after = await state();
  check('T teleports', after.x !== before.x || after.y !== before.y, `${before.x},${before.y} -> ${after.x},${after.y}`);
  await until(async () => (await state()).grounded, 3000);
}

async function leaving({ cdp, ev, tap, until, mouse, check, state }) {
  await mouse('mousePressed', { x: 640, y: 300 }, { button: 'right', buttons: 2 });
  await mouse('mouseReleased', { x: 640, y: 300 }, { button: 'right' });
  await cdp('Runtime.evaluate', { expression: 'void 0' });
  await tap('Escape');
  await sleep(100);
  await tap('KeyR');
  const back = await until(async () => { const a = (await state()).frame; await sleep(80); return (await state()).frame > a; }, 3000);
  check('R on the pause screen restarts the biome and plays on', back);
  await tap('Escape');
  await sleep(100);
  await tap('Enter');
  check('leaving from the pause screen returns to the title', await until(() => ev(`!!document.querySelector('#play')?.offsetParent`), 3000));
}

async function builderTools({ cdp, ev, until, open, drag, check, state }) {
  await open('#');
  await ev(`document.querySelector('#build-level').click()`);
  await until(() => ev(`document.body.classList.contains('editing')`), 6000);
  await sleep(600);
  const { rows } = await ev('shiftform.editor().blueprint');
  const place = async (id, at) => { await ev(`shiftform.editor().tool = ${JSON.stringify(id)}`); await drag(at, at); };
  const low = rows - 2;
  await place('switch', [6, low]);
  await place('door', [12, low - 2]);
  await place('wire', [6, low]);
  await place('wire', [12, low - 1]);
  check('the wire tool links a switch to a door', (await ev('shiftform.editor().level().wires.length')) === 1);
  const pickup = await ev(`import('/src/builder/blueprint.js').then(m => m.BLOCKS.find(b => b.group === 'Pickups' && /heart|shield|boots|jetpack/i.test(b.id))?.id)`);
  if (pickup) await place(pickup, [18, low]);
  const y = (await state()).y;
  const middle = { x: 640, y: 300 };
  await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', ...middle, deltaX: 0, deltaY: -240 });
  await sleep(120);
  check('the wheel scrolls the builder', (await state()).y !== y);
  await ev(`document.querySelector('#edit-test').click()`);
  await sleep(500);
  if (pickup) {
    await ev(`shiftform.warp(${18 * 30 + 4}, ${(low + 1) * 30 - 26})`);
    await sleep(300);
  }
  check('test mode still runs after wiring and collecting', (await state()).phase === 'play');
  await ev(`document.querySelector('#edit-test').click()`);
  await sleep(300);
}

export async function controls(browser) {
  await browser.start('#seed=e2e-c&agent=1');
  await sleep(300);
  await agentScripts(browser);
  await browser.start('#seed=e2e-c&agent=1');
  await sleep(300);
  await wardrobe(browser);
  await touchButtons(browser);
  await teleporting(browser);
  await leaving(browser);
  await builderTools(browser);
}
