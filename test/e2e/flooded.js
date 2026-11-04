import { sleep } from './browser.js';

export async function flooded({ ev, down, up, until, start, check, state }) {
  let found = null;
  for (const seed of ['fl-a','fl-b','fl-c','fl-d','fl-e','fl-f','fl-g','fl-h','fl-i','fl-j','fl-k','fl-l','fl-m','fl-n']) {
    if (!await start(`#seed=${seed}`)) continue;
    await sleep(300);
    await ev('shiftform.summit()');
    await sleep(100);
    { const here = await state(); const spring = (await ev('shiftform.level()')).objects.filter(o => o.type === 'spring' && o.y < 180).sort((a, b) => Math.abs(a.x - here.x) - Math.abs(b.x - here.x))[0]; const key = spring && spring.x + spring.w / 2 < here.x + 10 ? 'ArrowLeft' : 'ArrowRight'; await down(key); await sleep(300); await up(key); }
    const moved = await until(async () => (await state()).index === 1 && (await state()).phase === 'play', 25000, 300);
    if (!moved) continue;
    await sleep(500);
    const lvl = await ev('shiftform.level()');
    const water = lvl.objects.filter(o => o.type === 'water' && o.h >= 60);
    if (water.length >= 3 && lvl.title !== 'Waterworks') { found = { seed, lvl, water }; break; }
  }
  check('a flooded stretch appears in a real climb', found, found ? `${found.seed}: ${found.water.length} water blocks` : '');
  if (found) {
    const { lvl, water } = found;
    const low = water.reduce((a, o) => (o.y + o.h > a.y + a.h ? o : a));
    const ledge = lvl.surfaces?.length;
    await ev(`shiftform.warp(${low.x + low.w / 2 - 10}, ${low.y + low.h - 26 - 2})`);
    await sleep(700);
    const a = await state();
    check('you can be inside a flooded passage without dying', !a.dead, `lives ${a.lives}`);
    const s0 = await state();
    for (let i = 0; i < 10; i++) { await down('Space'); await sleep(80); await up('Space'); await sleep(80); }
    const s1 = await state();
    check('strokes swim upward in a passage', s1.y < s0.y - 10 || s1.vy !== 0, `${s0.y} -> ${s1.y}`);
    const top = water.reduce((a, o) => (o.y < a.y ? o : a));
    check('the flooded stretch has a surface', top, JSON.stringify(top ?? {}));
    if (top) {
      await ev(`shiftform.warp(${top.x + top.w / 2 - 10}, ${top.y + 30})`);
      await sleep(120);
      let high = 1e9;
      for (let i = 0; i < 12; i++) { await down('Space'); await sleep(80); await up('Space'); await sleep(70); high = Math.min(high, (await state()).y + 26); }
      check('you can only just break the surface of a flooded stretch', top.y - high < 22, `rose ${Math.round(top.y - high)} px`);
      const ledge = lvl.surfaces.filter(q => Math.abs(q.y - top.y) < 2).sort((a, b) => Math.abs((a.x + a.w / 2) - top.x) - Math.abs((b.x + b.w / 2) - top.x))[0];
      const toRight = ledge ? ledge.x + (ledge.w ?? 0) / 2 > top.x : true;
      await ev(`shiftform.warp(${top.x + top.w / 2 - 10}, ${top.y + 30})`);
      await down(toRight ? 'ArrowRight' : 'ArrowLeft');
      let landed = null;
      for (let i = 0; i < 40 && !landed; i++) {
        await down('Space'); await sleep(50); await up('Space'); await sleep(40);
        const s = await state();
        if (s.grounded && s.y + 26 <= top.y + 1) landed = s;
      }
      await up('ArrowRight'); await up('ArrowLeft');
      check('you can climb out onto the ledge at the top', landed, landed ? `stood at y ${landed.y}` : JSON.stringify(await state()).slice(0, 110));
    }
  }
}
