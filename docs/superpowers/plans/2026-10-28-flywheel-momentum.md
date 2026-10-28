# Flywheel Momentum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `flywheel` mutator where sustained movement in one direction charges a meter that makes jumps higher and longer, and biomes that roll it contain sprint gaps that need a charged jump.

**Architecture:** Charge lives in the player state and is updated inside the one pure `step` function, so the game and the solver see the same rule. The solver keys on charge. The generator lays flat runways before oversized gaps in flywheel biomes and rejects segments the charge-disabled solver can still finish.

**Tech Stack:** Vanilla JS modules, `node --test`, Canvas, Web Audio.

**Spec:** `docs/superpowers/specs/2026-10-28-flywheel-momentum-design.md`

## Global Constraints

- Zero dependencies; run with `npm test` (about 85 s) and `npm start`.
- No comments in code; names carry intent.
- Levels without `rules.flywheel` must behave exactly as before.
- Constants: `CHARGE_FRAMES` 72, `SPEED_BONUS` 0.5, `JUMP_BONUS` 0.25, `CHARGE_SPEED` 0.95 (fraction of walking speed needed to charge).

---

### Task 1: Rule and profiles

**Files:**
- Modify: `src/rules.js` (BASE_RULES, MUTATORS, add constants and `chargedProfile`)
- Test: `test/rules.test.js` (new)

**Interfaces:**
- Produces: `rules.flywheel` boolean; exports `CHARGE_FRAMES`, `SPEED_BONUS`, `JUMP_BONUS`, `chargedProfile(rules) -> { height, reach, airFrames }`.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRules, jumpProfile, chargedProfile, compatible, mutatorById } from '../src/rules.js';

test('flywheel rule is off by default and on with the mutator', () => {
  assert.equal(buildRules([]).flywheel, false);
  assert.equal(buildRules(['flywheel']).flywheel, true);
});

test('a charged jump is about 1.5x higher and about 2x longer than a standing one', () => {
  const rules = buildRules(['flywheel']);
  const standing = jumpProfile(rules), charged = chargedProfile(rules);
  assert.ok(charged.height / standing.height > 1.5 && charged.height / standing.height < 1.65);
  assert.ok(charged.reach / standing.reach > 1.8 && charged.reach / standing.reach < 2);
});

test('flywheel excludes Caffeine and Blink', () => {
  const flywheel = mutatorById('flywheel');
  assert.equal(compatible([flywheel], mutatorById('sprint')), false);
  assert.equal(compatible([flywheel], mutatorById('dash')), false);
  assert.equal(compatible([flywheel], mutatorById('moon')), true);
});
```

- [ ] **Step 2: Run it**

Run: `cd /Users/lukasz/projects/proc-plat && node --test test/rules.test.js`
Expected: FAIL, `chargedProfile` is not exported.

- [ ] **Step 3: Implement**

In `src/rules.js`, add to `BASE_RULES` after `clockRate: 1,`:

```js
  flywheel: false,
```

Add before `export const MUTATORS`:

```js
export const CHARGE_FRAMES = 72;
export const SPEED_BONUS = 0.5;
export const JUMP_BONUS = 0.25;
```

Add to `MUTATORS` after the `hyper` entry:

```js
  { id: 'flywheel', title: 'Flywheel', hint: 'Keep moving one way. Speed becomes height.', tags: ['speed', 'dash'], weight: 2.5,
    apply: r => { r.flywheel = true; } },
```

Add at the end of the file:

```js
export function chargedProfile(rules) {
  return jumpProfile({ ...rules, jumpVel: rules.jumpVel * (1 + JUMP_BONUS), moveSpeed: rules.moveSpeed * (1 + SPEED_BONUS) });
}
```

- [ ] **Step 4: Run it**

Run: `node --test test/rules.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/rules.js test/rules.test.js
git commit -m "Flywheel rule and charged jump profile"
```

---

### Task 2: Charge in the physics step

**Files:**
- Modify: `src/physics.js` (imports, `initialState`, `step`)
- Modify: `src/climb.js` (`standAt`)
- Test: `test/physics.test.js` (append)

**Interfaces:**
- Consumes: `CHARGE_FRAMES`, `SPEED_BONUS`, `JUMP_BONUS` from `src/rules.js`.
- Produces: state fields `charge` (0..1) and `chargeDir` (-1, 0, 1).

- [ ] **Step 1: Write the failing tests**

Append to `test/physics.test.js`:

```js
const runway = (mutators = ['flywheel']) => {
  const level = createLevel(buildRules(mutators), mutators);
  fillTiles(level, 0, 13, COLS, ROWS - 13, SOLID);
  level.start = { x: 30, y: 13 * TILE - 26 };
  return level;
};

function jumpAfter(level, frames) {
  return run(level, i => ({ right: true, jump: i >= frames && i < frames + 20 }), frames + 70);
}

function peakAfter(level, frames) {
  let s = initialState(level), top = s.y, far = s.x;
  for (let i = 0; i < frames + 70; i++) {
    s = step(level, s, { right: true, jump: i >= frames && i < frames + 20 });
    if (!s.grounded) { top = Math.min(top, s.y); far = s.x; }
    if (i > frames && s.grounded) break;
  }
  return { rise: level.start.y - top, span: far - level.start.x };
}

test('running one way charges to full and a non-flywheel level never charges', () => {
  const charged = run(runway(), { right: true }, 90);
  assert.equal(charged.charge, 1);
  assert.equal(charged.chargeDir, 1);
  assert.equal(run(runway([]), { right: true }, 90).charge, 0);
});

test('a charged jump is higher and longer than a standing one', () => {
  const cold = peakAfter(runway(), 2), hot = peakAfter(runway(), 90);
  assert.ok(hot.rise > cold.rise * 1.4, `rise ${hot.rise} vs ${cold.rise}`);
  assert.ok(hot.span - 90 * 4.2 > (cold.span - 2 * 4.2) * 1.5, `span ${hot.span} vs ${cold.span}`);
});

test('charge carries through a jump and drops on turning, stopping or hitting a wall', () => {
  const level = runway();
  const flying = jumpAfter(level, 90);
  assert.equal(flying.charge, 1);
  const turned = step(level, run(level, { right: true }, 90), { left: true });
  assert.equal(turned.charge, 0);
  assert.equal(turned.chargeDir, 0);
  const stopped = run(level, i => ({ right: i < 90 }), 110);
  assert.equal(stopped.charge, 0);
  const walled = run(level, { right: true }, 400);
  assert.equal(walled.charge, 0);
});

test('a dash neither builds nor spends charge', () => {
  const level = runway(['flywheel', 'moon']);
  const before = run(level, { right: true }, 40);
  const dashing = runFrom(level, before, i => ({ right: true, dash: i === 0 }), 6);
  assert.equal(dashing.charge, before.charge);
});
```

- [ ] **Step 2: Run them**

Run: `node --test test/physics.test.js`
Expected: the four new tests FAIL (`charge` is undefined).

- [ ] **Step 3: Implement**

In `src/physics.js` import the constants:

```js
import { CHARGE_FRAMES, SPEED_BONUS, JUMP_BONUS } from './rules.js';
```

Add `const CHARGE_SPEED = 0.95;` next to the other constants at the top.

In `initialState`, after `ropeLen: 0,` add:

```js
    charge: 0,
    chargeDir: 0,
```

Add a helper above `step`:

```js
function updateCharge(r, s, n, dir) {
  if (!r.flywheel || s.dashTimer > 0) return;
  const fast = Math.abs(s.vx) >= r.moveSpeed * CHARGE_SPEED;
  const moving = fast ? Math.sign(s.vx) : 0;
  if ((dir !== 0 && dir === -s.chargeDir) || (s.grounded && !fast)) {
    n.charge = 0;
    n.chargeDir = 0;
  } else if (dir !== 0 && dir === moving) {
    n.chargeDir = dir;
    n.charge = Math.min(1, s.charge + 1 / CHARGE_FRAMES);
  }
}

function loseCharge(n) {
  n.charge = 0;
  n.chargeDir = 0;
}
```

In `step`, right after `const load = s.held >= 0 ? massOf(level, s.held) : 0;` add:

```js
  updateCharge(r, s, n, dir);
  const charge = r.flywheel ? n.charge : 0;
```

Change the speed line to:

```js
    const speed = r.moveSpeed * Math.min(1, 1.4 / Math.max(1, load)) * (1 + SPEED_BONUS * charge);
```

Change the jump launch line to:

```js
          n.vy = -r.jumpVel * (1 + JUMP_BONUS * charge) * (water ? WATER_JUMP : 1) * (kicked ? KICK_LIFT : 1) * g;
```

After the wall branch `else if (wallHit !== 0 && Math.sign(n.vx) === wallHit) { n.vx = r.rubberWalls ? -n.vx * 0.9 : 0; n.dashTimer = 0; }` change it to:

```js
  else if (wallHit !== 0 && Math.sign(n.vx) === wallHit) { n.vx = r.rubberWalls ? -n.vx * 0.9 : 0; n.dashTimer = 0; loseCharge(n); }
```

And the bound clamps to:

```js
  if (n.x < minX) { n.x = minX; if (n.vx < 0) { n.vx = 0; loseCharge(n); } }
  if (n.x > maxX) { n.x = maxX; if (n.vx > 0) { n.vx = 0; loseCharge(n); } }
```

In `src/climb.js` `standAt`, after `ropeLen` is not listed, so add after `rope: -1,`:

```js
    charge: 0,
    chargeDir: 0,
```

- [ ] **Step 4: Run all physics tests**

Run: `node --test test/physics.test.js test/movement.test.js test/bodies.test.js test/climb.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/physics.js src/climb.js test/physics.test.js
git commit -m "Charge builds while moving one way and boosts speed and jumps"
```

---

### Task 3: Solver keys on charge

**Files:**
- Modify: `src/solver.js` (`stateKey`)
- Test: `test/solver.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/solver.test.js`, importing `stateKey` and `step`:

```js
import { stateKey } from '../src/solver.js';
import { step } from '../src/physics.js';

test('states that differ only in charge get different keys in a flywheel level', () => {
  const level = createLevel(buildRules(['flywheel']), ['flywheel']);
  fillTiles(level, 0, 17, COLS, 1, SOLID);
  level.start = { x: 30, y: 17 * TILE - 26 };
  let s = initialState(level);
  for (let i = 0; i < 30; i++) s = step(level, s, {});
  const cold = { ...s, charge: 0, chargeDir: 0 }, hot = { ...s, charge: 1, chargeDir: 1 };
  assert.notEqual(stateKey(level, cold), stateKey(level, hot));
  const plain = createLevel(buildRules([]), []);
  assert.equal(stateKey(plain, cold), stateKey(plain, hot));
});
```

- [ ] **Step 2: Run it**

Run: `node --test test/solver.test.js`
Expected: FAIL, `stateKey` is not exported.

- [ ] **Step 3: Implement**

In `src/solver.js` export `stateKey` and append the charge to the key when the rule is on:

```js
function chargeKey(level, s) {
  return level.rules.flywheel ? `:${Math.round(s.charge * 3)}:${s.chargeDir}` : '';
}

export function stateKey(level, s) {
  ...existing body, with the template ending in `${s.lastKick}${bodiesKey(s)}${chargeKey(level, s)}`;
}
```

- [ ] **Step 4: Run it**

Run: `node --test test/solver.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/solver.js test/solver.test.js
git commit -m "Solver distinguishes charge levels in flywheel levels"
```

---

### Task 4: Sprint gaps in the generator

**Files:**
- Modify: `src/generator.js` (`buildBiome` ctx, `buildSegment`, `layClimb`, new `laySprint`, `demandsMomentum`)
- Modify: `src/features.js` (export `sprintPlan`)
- Test: `test/generator.test.js` (append)

**Interfaces:**
- Consumes: `chargedProfile`, `CHARGE_FRAMES` from `src/rules.js`; `solve` from `src/solver.js`.
- Produces: nodes flagged `sprint: true` on the landing ledge; `ctx.sprint` plan `{ min, max, runUp }` or `null`.

- [ ] **Step 1: Write the failing test**

Append to `test/generator.test.js`, importing `solve` from the solver and `TILE`:

```js
import { solve } from '../src/solver.js';

test('flywheel biomes contain sprint gaps that a standing jump cannot cross', () => {
  let sprints = 0, flywheels = 0;
  for (const seed of ['fly-a', 'fly-b', 'fly-c', 'fly-d']) {
    climb(seed, 4).forEach((biome, index) => {
      if (!biome.rules.flywheel) return;
      flywheels++;
      assertChains(biome, `${seed}/${index}`);
      const standing = { ...biome, rules: { ...biome.rules, flywheel: false } };
      biome.segments.forEach((segment, k) => {
        if (!segment.sprint) return;
        sprints++;
        const goal = k === biome.segments.length - 1 ? null : biome.objects.filter(o => o.type === 'checkpoint')[k];
        assert.equal(solve(standing, { start: segment.start, goal, route: segment.route, maxNodes: 10000 }), null, `${seed}/${index} segment ${k} needs momentum`);
      });
    });
  }
  assert.ok(flywheels >= 1, 'some biome rolled flywheel');
  assert.ok(sprints >= 1, 'some segment has a sprint gap');
});
```

Note: `segment.route` and `segment.sprint` must survive the final `level.segments.map(...)` in `buildBiome`; Step 3 keeps them.

- [ ] **Step 2: Run it**

Run: `node --test test/generator.test.js`
Expected: FAIL (no flywheel biome ever has `segment.sprint`).

- [ ] **Step 3: Implement**

In `src/features.js` import `chargedProfile, CHARGE_FRAMES` from `./rules.js` and add:

```js
const SPRINT_MARGIN = 0.8;

export function sprintPlan(ctx) {
  const { rules, profile } = ctx;
  if (!rules.flywheel) return null;
  const min = Math.ceil(profile.reach / TILE) + 1;
  const max = Math.floor((chargedProfile(rules).reach * SPRINT_MARGIN) / TILE);
  const runUp = Math.ceil((CHARGE_FRAMES * rules.moveSpeed) / TILE) + 1;
  return max >= min ? { min, max, runUp } : null;
}
```

In `src/generator.js` import `sprintPlan` from `./features.js` and in `buildBiome` after `ctx.clearance = ...` add:

```js
  ctx.sprint = sprintPlan(ctx);
```

Add `laySprint` above `layClimb`:

```js
function laySprint(ctx, nodes, from) {
  const { rng, sprint } = ctx;
  const gap = rng.int(sprint.min, sprint.max);
  const landingW = rng.int(3, 4);
  const fits = (c, w) => c >= 0 && c + w <= COLS;
  for (const dir of [from.dir, -from.dir]) {
    const laid = [];
    let col = from.col, w = from.w, covered = from.w;
    while (covered < sprint.runUp) {
      const g = rng.int(1, 2), nw = rng.int(4, 6);
      const nc = dir > 0 ? col + w + g : col - g - nw;
      if (!fits(nc, nw) || crowded([...ctx.placed, ...nodes], nc, from.row, nw)) { laid.length = 0; break; }
      laid.push({ col: nc, row: from.row, w: nw, kind: 'tiles', gap: g, dir, thick: 1, reserved: true });
      covered += g + nw;
      col = nc;
      w = nw;
    }
    if (!laid.length) continue;
    const lc = dir > 0 ? col + w + gap : col - gap - landingW;
    if (!fits(lc, landingW) || crowded([...ctx.placed, ...nodes], lc, from.row, landingW)) continue;
    laid.push({ col: lc, row: from.row, w: landingW, kind: 'tiles', gap, dir, thick: 1, reserved: true, sprint: true });
    return laid;
  }
  return null;
}
```

In `layClimb`, after `let wideLeft = ...` add `let sprintsLeft = ctx.sprint ? rng.int(1, 2) : 0;` and at the top of the loop body, before `const wantWide`, add:

```js
    if (sprintsLeft > 0 && pocketsLeft === 0 && wideLeft === 0 && remaining > maxUp && rng.chance(0.4)) {
      const laid = laySprint(ctx, nodes, { col, row, w, dir });
      if (laid) {
        nodes.push(...laid);
        sprintsLeft--;
        ({ col, w, dir } = laid[laid.length - 1]);
        continue;
      }
    }
```

In `buildSegment`, when pushing the segment record add `sprint: nodes.some(n => n.sprint)`:

```js
    level.segments.push({ route: segmentRoute(ctx, nodes, saved.waypoints), goal, physical, sprint: nodes.some(n => n.sprint), inputs: [], start: null });
```

Change the acceptance condition to:

```js
    const segment = level.segments[level.segments.length - 1];
    const demanded = !ctx.sprint || simple || segment.sprint;
    if (demanded && settleChain(level) && !(physical && bypassable(level, segment.route, segment.start, goal, added)) && !(segment.sprint && !demandsMomentum(level, segment))) {
```

Add `demandsMomentum` next to `bypassable`:

```js
function demandsMomentum(level, segment) {
  const standing = { ...level, rules: { ...level.rules, flywheel: false } };
  return !solve(standing, { start: segment.start, goal: segment.goal, route: segment.route, maxNodes: BYPASS_BUDGET });
}
```

In `settleChain`, use the physics budget for sprint segments:

```js
      const result = solveRoute(level, segment.route, { start, goal: segment.goal, maxNodes: segment.physical || segment.sprint ? PHYSICS_LEG_BUDGET : LEG_BUDGET });
```

In `buildBiome`, keep route and sprint on the shipped segments:

```js
  level.segments = level.segments.map(({ start, inputs, route, sprint }) => ({ start, inputs, route, sprint }));
```

- [ ] **Step 4: Run the generator tests and time them**

Run: `time node --test test/generator.test.js`
Expected: PASS. Note the duration; if the new test exceeds 60 s on its own, reduce the seeds to three.

- [ ] **Step 5: Commit**

```bash
git add src/generator.js src/features.js test/generator.test.js
git commit -m "Flywheel biomes lay runways and sprint gaps that need a charged jump"
```

---

### Task 5: Feel: glow, trail and tones

**Files:**
- Modify: `src/sounds.js` (`playerEvents`)
- Modify: `src/audio.js` (effects table)
- Modify: `src/render.js` (`drawPlayer`, trail alpha in `drawBiome`)
- Modify: `src/game.js` (trail length)
- Test: `test/sounds.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/sounds.test.js`:

```js
test('reaching full charge and losing it are reported once each', () => {
  const level = flatLevel(['flywheel']);
  const events = eventsOf(level, i => ({ right: i < 100, left: i >= 100 }), 110);
  assert.equal(types(events).filter(t => t === 'charged').length, 1);
  assert.equal(types(events).filter(t => t === 'uncharged').length, 1);
  assert.ok(events.find(e => e.type === 'charged').frame < events.find(e => e.type === 'uncharged').frame);
});
```

- [ ] **Step 2: Run it**

Run: `node --test test/sounds.test.js`
Expected: FAIL (no `charged` event).

- [ ] **Step 3: Implement**

In `src/sounds.js` `playerEvents`, after the `letGo` line add:

```js
  if (next.charge >= 1 && prev.charge < 1) events.push({ type: 'charged' });
  if (prev.charge >= 1 && next.charge < 1) events.push({ type: 'uncharged' });
```

In `src/audio.js` effects table, after `dash`:

```js
    charged: () => { tone({ type: 'triangle', freq: 440, to: 1320, dur: 0.22, gain: 0.07 }); hiss({ freq: 1200, to: 4000, dur: 0.18, gain: 0.06 }); },
    uncharged: () => tone({ type: 'triangle', freq: 880, to: 330, dur: 0.16, gain: 0.05 }),
```

In `src/render.js` `drawPlayer`, change the glow line to:

```js
  glow(ctx, theme, shattering ? p.hazard : p.player, shattering ? 18 : 10 + 16 * s.charge);
```

In `drawBiome`, change the trail alpha to:

```js
        ctx.globalAlpha = (i / trail.length) * (state.dashTimer > 0 ? 0.5 : 0.22 + 0.3 * state.charge);
```

In `src/game.js`, change the trail cap to grow with charge:

```js
      if (game.trail.length > 8 + Math.round(8 * s.charge)) game.trail.shift();
```

- [ ] **Step 4: Run the sounds tests and the game**

Run: `node --test test/sounds.test.js`
Expected: PASS.

Run: `npm start`, open `http://localhost:8080/#fly-a`, climb until a Flywheel biome appears (the banner names it), run one way and confirm the glow grows and the tone plays.

- [ ] **Step 5: Commit**

```bash
git add src/sounds.js src/audio.js src/render.js src/game.js test/sounds.test.js
git commit -m "Charge shows in the glow and trail and chimes when full"
```

---

### Task 6: Docs and full run

**Files:**
- Modify: `README.md` (rules list and how it works)

- [ ] **Step 1: Document**

In `README.md`, in the `src/rules.js` bullet, add "flywheel momentum" to the mutator list. In the `src/generator.js` bullet, after "places a puzzle (...)" add: "in a Flywheel biome it also lays flat runways before gaps that only a charged jump can cross, and rejects any stretch the charge-disabled solver can still finish".

- [ ] **Step 2: Run everything**

Run: `npm test`
Expected: all tests PASS. Report the duration.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Docs for Flywheel"
```
