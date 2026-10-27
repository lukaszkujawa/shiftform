# Shiftform design

## Goal

A browser puzzle-platformer where any seed yields an infinite sequence of unique, solvable single-screen levels. The fixed objective is moving from the left edge to the exit on the right. Everything else changes per level: physics rules, objects, layout and palette.

## Architecture

Pure core modules with no DOM dependency so they run in Node tests, the browser and a Web Worker:

- `rng.js`: FNV hash, integer mixer and mulberry32 generator. Seed text plus level index derives every decision.
- `rules.js`: base rules and the mutator catalog. Mutators carry exclusivity tags; `buildRules` composes them. `jumpProfile` estimates jump height and horizontal reach for layout sizing.
- `level.js`: constants, tile grid (empty, solid, one-way), object records, clock helpers for timed objects, serialization for worker transfer.
- `physics.js`: `step(level, state, input)` returns a new state. Handles movement, jumps, dash, wall jumps, gravity direction, bounce, water, wind, carrying on movers and conveyors, crumble flags, pickups, switches, portals, springs, hazards, bounds and the exit check.
- `solver.js`: weighted A* over quantized states with four-frame input macros. Keys and switches always count as required waypoints because the generator only places them to gate the path. Returns the per-frame input list.
- `generator.js` and `features.js`: candidate construction and verification with rerolls.

Browser layer: `render.js` (static tile layer cached per level, dynamic objects, player, HUD, darkness and strobe overlays), `game.js` (fixed 60 Hz loop, input with jump buffering, death and win phases, ghost replay, worker-backed level loading with prefetch), `worker.js`, `main.js` and `index.html`.

## Generation

1. Derive difficulty from the level index and choose compatible mutators.
2. Choose a puzzle plan. The plan decides how many pocket platforms and whether a wide gap is needed before the path is laid, so no geometry is patched afterwards.
3. Lay a chain of platform nodes left to right. Gaps and rises are sized from the jump profile scaled by difficulty.
4. Build tiles: open layouts fill pillars below nodes; caves start solid and carve corridors around the path.
5. Apply the puzzle, then features on random gaps with a minimum count that grows with difficulty.
6. Decorate, place start and exit, mirror vertically for upside-down levels.
7. Solve. Reject unsolvable or trivially short candidates and reroll with the next sub-seed. Later attempts ease difficulty. A verified fallback level exists but has not been needed in testing.

## Verification

Tests cover physics behaviours, determinism, serialization and that six seeds times eight levels all replay their solutions to the exit with at least one object present. A sweep of 360 candidates shows about ninety percent solve on the first attempt and generation averages well under a second per level.
