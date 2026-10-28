# Focus Biomes and Risk Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biomes built around one escalating focus, plus optional risky items (jetpack, boots, shield, heart).

**Architecture:** `src/focus.js` holds the focus catalogue and turns a stage into a puzzle plus feature list for `buildSegment`. Items are a new object type handled in `physics.js`, carried by `climb.js`, placed and proven by a new `src/items.js` that the generator calls after each proven segment.

**Tech Stack:** Vanilla JS, Canvas, Web Audio, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-29-focus-and-items-design.md`

## Global Constraints

- No code comments. All tests pass before each commit.
- Main chain is always proven with every item taken.

---

### Task 1: Focus biomes
**Files:** create `src/focus.js`; modify `src/generator.js`, `src/features.js` (stage timing via `ctx.tune`); test `test/generator.test.js`.
- [ ] Test: biomes expose `level.focus`, and the focus's signature object types appear in the biome.
- [ ] Implement catalogue, focus choice, stage-driven puzzle and features, banner title and hint.
- [ ] `npm test`, measure generation time, commit.

### Task 2: Item physics and run rules
**Files:** modify `src/level.js`, `src/physics.js`, `src/solver.js`, `src/climb.js`; tests `test/items.test.js`, `test/climb.test.js`.
- [ ] Tests: jetpack thrust and fuel, boots, shield, pickup sets `taken`, inventory and `taken` survive respawn, inventory survives `enterBiome`.
- [ ] Implement, `npm test`, commit.

### Task 3: Item placement and proofs
**Files:** create `src/items.js`; modify `src/generator.js`, `src/solver.js` (item waypoints); test `test/generator.test.js`.
- [ ] Test: every placed item has `level.itemProofs` entry whose replay collects it and reaches the segment goal; chain still replays with items taken.
- [ ] Implement, `npm test`, commit.

### Task 4: Presentation
**Files:** modify `src/render.js`, `src/game.js`, `src/sounds.js`, `src/audio.js`, `index.html`, `README.md`.
- [ ] Item icons, HUD inventory, control bar entries, toast, heart refills lives, jet/shield visuals and sounds.
- [ ] Headless Chrome check, `npm test`, commit.
