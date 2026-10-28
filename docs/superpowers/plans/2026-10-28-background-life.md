# Background Life Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deterministic, faded, idly animated plants and creatures behind every biome, with a family per theme.

**Architecture:** Pure generation in `src/life.js` and shape generators in `src/life-shapes.js`, both testable without a canvas through a recording stub. The renderer caches the population per level and draws it before the tiles with parallax by depth.

**Tech Stack:** Vanilla JS, Canvas `Path2D`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-28-background-life-design.md`

## Global Constraints

- No comments in code. Zero dependencies. `npm test` must stay green.
- Life never touches physics, solver or generator output.

---

### Task 1: Shapes and families

**Files:**
- Create: `src/life-shapes.js`
- Test: `test/life.test.js`

**Interfaces:**
- Produces: `FAMILIES[themeId] = { plants: [rng => plant], creatures: [rng => creature], drifters: [rng => drifter] }` with the shapes described in the spec. Every generator sets `kind`.

- [ ] Write the recording stub and a test that, for every theme, every generator builds and draws without throwing and emits at least one path op.
- [ ] Run: `node --test test/life.test.js`, expect FAIL (module missing).
- [ ] Implement primitives and the six families.
- [ ] Run the test, expect PASS. Commit: `Background life shapes for every theme`.

### Task 2: Population and drawing

**Files:**
- Create: `src/life.js`
- Test: `test/life.test.js` (append)

**Interfaces:**
- Produces: `DEPTHS`, `growLife(level, theme)`, `drawLife(ctx, life, palette, theme, offset, camera, time, makePath)`.

- [ ] Tests: determinism, counts (80 plants, 30 creatures, 1 to 3 drifters), kinds from the family, y within the extended range per depth, `drawLife` over a stub draws all visible specimens.
- [ ] Run, expect FAIL. Implement. Run, expect PASS. Commit: `Grow and draw a biome's background life`.

### Task 3: Renderer hook and budget

**Files:**
- Modify: `src/render.js` (`layerFor`, `drawBiome`)

- [ ] Cache `growLife` in `layerFor`; call `drawLife` in `drawBiome` before the tiles.
- [ ] Run the game, open a few seeds, confirm life is visible in all six themes and that `performance.now()` around `drawLife` stays under 2 ms. Commit: `Draw background life behind the platforms`.

### Task 4: Docs

- [ ] README: a line under how it works. Full `npm test`. Commit and push.
