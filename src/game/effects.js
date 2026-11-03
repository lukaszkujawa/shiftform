
const SPRAY = { count: 16, minOut: 0.6, out: 2.6, lift: 0.9, life: 14 };

export function createEffects(game) {
  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random());
      game.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 30 + Math.random() * 30, maxLife: 60, size: 3 + Math.random() * 4, color });
    }
  }

  function spray(x, y, color, g) {
    for (let i = 0; i < SPRAY.count; i++) {
      const out = (i % 2 ? 1 : -1) * (SPRAY.minOut + Math.random() * SPRAY.out);
      game.particles.push({ x: x + out, y, vx: out, vy: (SPRAY.lift + Math.random() * SPRAY.lift) * -g, life: SPRAY.life + Math.random() * SPRAY.life, maxLife: 2 * SPRAY.life, size: 2 + Math.random() * 2, color });
    }
  }

  function puff(dust, color) {
    game.particles.push({ ...dust, life: 22, maxLife: 22, color, puff: true });
  }

  function tickParticles() {
    for (const p of game.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.puff) { p.vx *= 0.9; p.vy *= 0.9; p.size += 0.18; } else { p.vx *= 0.96; p.vy += 0.25; }
      p.life--;
    }
    game.particles = game.particles.filter(p => p.life > 0);
    game.flash = Math.max(0, game.flash - 0.04);
    game.shake = Math.max(0, game.shake - 0.6);
  }

  return { burst, spray, puff, tickParticles };
}
