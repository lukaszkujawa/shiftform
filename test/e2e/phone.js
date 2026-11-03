import { sleep } from './browser.js';

const SCREENS = [[844, 390], [667, 375], [568, 320], [390, 844], [360, 640], [1024, 768]];
const FLOOR_MARGIN = 26;

const boxes = ev => ev(`[...document.querySelectorAll('#touch button')].map(b => ({ name: b.getAttribute('aria-label'), ...b.getBoundingClientRect().toJSON() })).filter(b => b.width > 0)`);
const centreOf = (ev, label) => ev(`(() => { const r = document.querySelector('#touch [aria-label="${label}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const clash = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const showAll = (ev, on) => ev(`(() => { const lock = document.querySelector('#force-buttons'); if (lock) lock.remove(); if (${on}) { const style = document.createElement('style'); style.id = 'force-buttons'; style.textContent = '#touch .climb { display: flex !important; } #touch [class*="needs-"] { display: grid !important; }'; document.head.append(style); } })()`);

async function layouts({ cdp, ev, start, check }) {
  for (const [width, height] of SCREENS) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
    await sleep(300);
    await showAll(ev, true);
    await sleep(100);
    const all = await boxes(ev);
    const crossing = all.flatMap((a, i) => all.slice(i + 1).filter(b => clash(a, b)).map(b => `${a.name}/${b.name}`));
    const outside = all.filter(b => b.left < 0 || b.top < 0 || b.right > width || b.bottom > height).map(b => b.name);
    check(`${width}x${height}: every button fits with none overlapping`, !crossing.length && !outside.length, [...crossing, ...outside].join(', '));
    check(`${width}x${height}: thumb buttons are big enough`, all.filter(b => !['back to checkpoint', 'hint', 'build', 'sound', 'fullscreen', 'menu'].includes(b.name)).every(b => Math.min(b.width, b.height) >= 48));
    await showAll(ev, false);
    const game = await ev(`document.querySelector('#game').getBoundingClientRect().toJSON()`);
    check(`${width}x${height}: no keyboard bar, the game fills its 16:9`, Math.abs(game.width / game.height - 16 / 9) < 0.02, `${game.width | 0}x${game.height | 0}`);
    if (height > width) check(`${width}x${height}: portrait controls stay off the game`, (await boxes(ev)).every(b => !clash(b, game)));
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
  await start('#seed=e2e-touch&agent=1');
  await sleep(500);
}

const finger = (id, at) => ({ id, x: at.x, y: at.y });
const touches = (cdp, type, points) => cdp('Input.dispatchTouchEvent', { type, touchPoints: points });

async function thumbs({ cdp, ev, until, check, state }) {
  await until(async () => (await state()).grounded, 3000);
  const { rows } = await ev('shiftform.level()');
  await ev(`shiftform.warp(480, ${(rows - 1) * 30 - FLOOR_MARGIN})`);
  await until(async () => (await state()).grounded, 2000);
  const left = await centreOf(ev, 'left'), right = await centreOf(ev, 'right'), jump = await centreOf(ev, 'jump');
  const x0 = (await state()).x;
  await touches(cdp, 'touchStart', [finger(1, right)]);
  await sleep(300);
  const x1 = (await state()).x;
  check('a thumb on the right arrow runs right', x1 > x0 + 15, `${x0} -> ${x1}`);
  await touches(cdp, 'touchMove', [finger(1, left)]);
  await sleep(380);
  const x2 = (await state()).x;
  check('sliding the same thumb across turns you round without lifting it', x2 < x1 - 5, `${x1} -> ${x2}`);
  check('only the arrow under the thumb stays lit', await ev(`document.querySelector('#touch [aria-label="left"]').classList.contains('down') && !document.querySelector('#touch [aria-label="right"]').classList.contains('down')`));
  const y0 = (await state()).y;
  await touches(cdp, 'touchStart', [finger(1, left), finger(2, jump)]);
  let top = y0;
  for (let i = 0; i < 12; i++) { top = Math.min(top, (await state()).y); await sleep(25); }
  check('a second thumb jumps while the first keeps running', y0 - top > 30, `rose ${y0 - top | 0} px`);
  await touches(cdp, 'touchEnd', []);
  await sleep(250);
  check('lifting both thumbs lets everything go', await ev(`!document.querySelector('#touch .down')`));
  await until(async () => (await state()).grounded, 3000);
  await sleep(400);
  const still = (await state()).x;
  await sleep(300);
  check('and the climber stops', (await state()).x === still, `${still} -> ${(await state()).x}`);
}

async function contextual({ cdp, ev, tap, until, check, state }) {
  const visible = label => ev(`document.querySelector('#touch [aria-label="${label}"]').getBoundingClientRect().width > 0`);
  check('dash stays hidden without the skill', !(await visible('dash')));
  check('build stays hidden with nothing to build', !(await visible('build')));
  const { objects } = await ev('shiftform.level()');
  const ladder = objects.filter(o => o.type === 'climb').sort((a, b) => b.y + b.h - (a.y + a.h))[0];
  check('the climb arrows stay hidden away from a ladder', !(await visible('climb up')));
  if (ladder) {
    await ev(`shiftform.warp(${ladder.x + ladder.w / 2 - 10}, ${ladder.y + ladder.h - 28})`);
    await sleep(120);
    check('the climb arrows appear at a ladder', await visible('climb up'));
    const y0 = (await state()).y, up = await centreOf(ev, 'climb up');
    await touches(cdp, 'touchStart', [finger(1, up)]);
    await sleep(300);
    await touches(cdp, 'touchEnd', []);
    check('and they climb it', (await state()).y < y0 - 15, `${y0} -> ${(await state()).y}`);
  }
  const menu = await centreOf(ev, 'menu');
  await touches(cdp, 'touchStart', [finger(1, menu)]);
  await touches(cdp, 'touchEnd', []);
  await sleep(150);
  check('the pause screen clears the buttons away', await ev(`document.body.classList.contains('overlaid') && document.querySelector('#touch').getBoundingClientRect().width === 0`));
  await tap('KeyN');
  await sleep(100);
  check('and they come back', await visible('jump'));
}

export async function phone(browser) {
  const { cdp } = browser;
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await browser.start('#seed=e2e-touch&agent=1');
  await sleep(500);
  await browser.ev(`window.dispatchEvent(new Event('resize'))`);
  await layouts(browser);
  await thumbs(browser);
  await contextual(browser);
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
}
