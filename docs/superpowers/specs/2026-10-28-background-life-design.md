# Background life

## Goal

Every biome grows a deterministic population of procedural plants and creatures that live behind the platforms: faded, parallaxed, idly animated, never interacting with play. Each theme has its own families so the six looks become six ecosystems.

## Population

`growLife(level, theme)` in `src/life.js` returns `{ specimens, drifters }` from an `Rng` seeded by the biome's palette hue, index and theme id, so a tower always grows the same life.

- 80 plants and 30 creatures per biome, each with `x` across the width, `y` in the biome's extended range for its depth, `depth` from `DEPTHS` (0.35, 0.55, 0.75), `scale`, `phase` and the shape its family generator produced.
- A specimen at biome `y` and depth `d` is drawn at screen `HEIGHT / 2 + (offset + y - camera - HEIGHT / 2) * d`. The extended range for `d` is `[HEIGHT / 2 - HEIGHT / (2d), height - HEIGHT / 2 + HEIGHT / (2d)]`, so every camera position sees a full band.
- Alpha is `0.16 + 0.28 * depth`. Scale is `(0.45 + 0.7 * depth) * rng.float(0.8, 1.25)`.
- Drifters: one to three per biome from the family's drifter list, each with a `y`, `depth`, speed in pixels per second, direction, and member offsets for flocks. Position is a pure function of time, wrapping across the width plus a margin.

## Families

`FAMILIES` in `src/life-shapes.js` maps theme id to `{ plants, creatures, drifters }`, each a list of generators taking an `Rng`.

- Plant generators return `{ parts: [{ build(path), mode: 'fill' | 'stroke', width, color }], flex }`. `build` emits only path geometry (moveTo, lineTo, quadraticCurveTo, bezierCurveTo, arc, closePath) so the renderer can cache it as a `Path2D`. The root sits at the origin and the plant grows into negative y. `color` names a palette role: `rockEdge`, `ink` or `accent`.
- Creature generators return `{ draw(g, t, colors), width, height }`. `draw` uses the full context API and recomputes from `t` in seconds. `colors` carries `primary`, `secondary` and `ink` strings.
- Drifter generators return `{ draw(g, t, colors), speed, members: [{ dx, dy, phase }] }`.

Families: neon (kelp, anemone; jelly, moth; jelly drift, moth flock), paper (fern, dandelion, grass; beetle, bird; bird flock, seeds), crystal (cluster, geode flower; prism bug; shard drift), ember (dead tree, ember shrub; lava worm, fire moth; moth flock, ash), frost (pine, birch; hare, owl; bird flock), void (nebula flower, urchin; whale, satellite; whale drift).

Shared primitives: `branch`, `frond`, `blob`, `polygon`, `segmented`, `wings`, `eye`.

## Motion

Plants rotate about their root by `sin(t * 0.7 + phase) * 0.04 * flex`. Creatures animate inside `draw` from `t + phase`: jellies pulse, moths and birds flap, worms undulate, hares twitch, owls blink, whales roll. Drifters move at their speed and bob on a sine.

## Rendering

`drawLife(ctx, life, palette, theme, offset, camera, time, makePath)` in `src/life.js` draws the specimens whose screen band overlaps the canvas, then the drifters, at their alpha. `makePath` defaults to `() => new Path2D()` and lets tests pass a recorder. The renderer caches `growLife` per level alongside its layer and calls `drawLife` inside `drawBiome` before the tiles, for the current biome and the ones above and below. Budget: under 2 ms per frame at 960 by 540.

## Tests

`test/life.test.js`: growth is deterministic and differs by palette; counts match; every kind belongs to the theme family; y lies in the extended range for its depth; every plant, creature and drifter of every theme draws through a recording stub without throwing and emits path operations.

## Out of scope

Life reacting to the player, life on cave rock faces, sound for creatures.
