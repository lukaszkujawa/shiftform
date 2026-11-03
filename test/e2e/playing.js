import { sleep } from './browser.js';

export async function playing({ ev, down, up, tap, until, start, check, state }) {
  check('game starts and reaches play', await start('#seed=e2e-a&agent=1&focus=saws'));
  const { rows, objects } = await ev('shiftform.level()');
  const floorY = (rows - 1) * 30 - 26;
  await until(async () => (await state()).grounded, 3000);
  let s0 = await state();
  check('starts with 3 lives', s0.lives === 3, `${s0.lives}`);
  await down('ArrowRight'); await sleep(350); await up('ArrowRight');
  let s1 = await state();
  check('right arrow walks right', s1.x > s0.x + 20, `${s0.x} -> ${s1.x}`);
  await down('ArrowLeft'); await sleep(350); await up('ArrowLeft');
  let s2 = await state();
  check('left arrow walks left', s2.x < s1.x - 20, `${s1.x} -> ${s2.x}`);
  await sleep(300);
  const gy = (await state()).y; let top = gy;
  await down('Space'); for (let i = 0; i < 14; i++) { top = Math.min(top, (await state()).y); await sleep(25); } await up('Space');
  check('space jumps', gy - top > 40, `rose ${Math.round(gy - top)} px`);
  await until(async () => (await state()).grounded, 3000);
  await tap('Escape'); await sleep(200);
  const p1 = (await state()).frame; await sleep(400); const p2 = (await state()).frame;
  check('Esc pauses the game', p1 === p2, `frame ${p1} -> ${p2}`);
  await tap('Escape'); await sleep(300);
  const p3 = (await state()).frame; await sleep(300); const p4 = (await state()).frame;
  check('Esc resumes the game', p4 > p3, `frame ${p3} -> ${p4}`);

  const impX = await ev('shiftform.imp()');
  await ev(`shiftform.warp(${impX - 10}, ${floorY})`);
  await until(async () => (await state()).grounded, 2000);
  await sleep(400);
  await tap('Digit2'); await sleep(300);
  check('imp changes difficulty to hard', (await state()).difficulty === 1, `difficulty ${(await state()).difficulty}`);
  await tap('Digit1'); await sleep(300);
  check('imp changes difficulty back to normal', (await state()).difficulty === 0, `difficulty ${(await state()).difficulty}`);

  await ev(`shiftform.warp(60, ${floorY})`);
  await down('ArrowLeft');
  const inHall = await until(async () => (await state()).hall, 5000);
  await up('ArrowLeft');
  check('walking off the floor enters the shops', inHall);
  if (inHall) {
    let bought = false;
    await down('ArrowLeft');
    for (let i = 0; i < 90 && !bought; i++) {
      await sleep(70);
      await tap('Digit1', 20);
      const s = await state();
      if (Object.keys(s.skills ?? {}).length) bought = s;
      if (!s.hall) break;
    }
    await up('ArrowLeft');
    check('free first skill can be bought at the trainer', bought, JSON.stringify(bought?.skills ?? {}));
    await down('ArrowLeft');
    const out = await until(async () => !(await state()).hall, 12000);
    await up('ArrowLeft');
    check('walking on leaves the shops', out);
  }

  await ev('shiftform.trace(true)');
  const saw = objects.find(o => o.type === 'saw');
  const sweep = (x, y) => ev(String.raw`new Promise(done => { let n = 0; const before = shiftform.state().lives, sh = shiftform.state(); const tick = () => { const s = shiftform.state(); if (s.lives < before) return done({ lives: s.lives, n }); if (++n > 1500) return done(null); const a = n * 0.31, r = n % 240; shiftform.warp(${x} + Math.cos(a) * r, ${y} + Math.sin(a) * r); requestAnimationFrame(tick); }; tick(); })`);
  const died = await sweep(saw.x, saw.y);
  check('touching a saw costs a life', died && died.lives === 2, JSON.stringify(died));
  const back = await until(async () => { const s = await state(); return s.phase === 'play' && !s.dead && s.grounded ? s : null; }, 5000);
  check('you respawn standing after dying', back, back ? `x ${back.x} y ${back.y}` : '');
  const deaths = await ev('shiftform.deaths()');
  check('the death is logged with a cause', deaths.length >= 1 && /saw/.test(deaths[0].death ?? ''), JSON.stringify(deaths[0]?.death));
  await sweep(saw.x, saw.y); await until(async () => !(await state()).dead, 3000);
  await sweep(saw.x, saw.y);
  const over = await until(async () => (await state()).phase === 'over', 6000);
  check('losing the last life ends the climb', over);
  await sleep(800);
  await ev(`document.querySelector('#again')?.click()`);
  const again = await until(async () => { const s = await ev('window.shiftform?.state()'); return s?.phase === 'play' && s.lives === 3; }, 30000, 300);
  check('play again starts a fresh climb on 3 lives', again);

}
