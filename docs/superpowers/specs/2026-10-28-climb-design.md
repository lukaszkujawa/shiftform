# The Climb design

## Goal

Replace separate levels with one endless vertical climb. Height is the score and the reason to keep going. The world changes rules and look every few screens, the camera scrolls with the player, and falling costs real height.

## Player experience

- One continuous tower per seed. The camera follows vertically; there are no level breaks.
- The tower is a sequence of biomes. A biome is about four screens tall, has one rule set (mutators), one theme and its own puzzles.
- Crossing into the next biome happens through a gate: a spring at the top of a biome launches the player through a one-way hatch into the floor of the next biome. The banner "1,240 m · Moon Shoes + Black Ice" fades in, the sky keeps changing, and the new physics apply from the first frame inside.
- Within a biome the player can fall back down as far as its floor. The gate hatch is solid from above, so a biome never loses more than itself.
- Checkpoint flags sit about once per screen. Touching one saves the full state. Hazard deaths and R restore the highest touched checkpoint at or below the player's current height, so dying is never a shortcut back up after a fall. The biome spawn counts as checkpoint zero.
- An altitude meter on the left edge shows current metres, best metres for this seed, and gate ticks. The sky blends with altitude: ground haze, clouds, dusk, stars. Parallax layers drift past.
- Difficulty and mutator count rise with biome index. Early biomes introduce crates and hooks one at a time.
- The URL stores the seed. Best altitude per seed persists in localStorage. N (skip) is removed.

## Architecture

### Per-level dimensions (`level.js`)

Levels gain `rows` and `height`. `tileAt`, kill bounds, flood, serialization, the solver's distance field and state key, and rendering use the level's dimensions instead of the fixed `ROWS` and `HEIGHT`. Screen-sized levels keep working unchanged; tests stay green.

### Biome generation (`generator.js`, `features.js`)

`generateBiome(seed, index)` builds one tall level:

1. Choose mutators for the biome. `ceiling` (upside down) and `wrap` are excluded; `flood` becomes a slow rising flood that chases the climb.
2. Lay a climbing path of tiers zig-zagging upward through the whole height, generalising the existing spiral tiers and ladder steps. Every ~18 rows a segment boundary is marked with a checkpoint node.
3. Each segment gets its own puzzle (from the existing catalogue, including crate and hook puzzles) and features, placed on that segment's nodes.
4. Bottom: a solid floor whose entry hatch is one-way tiles, with the spawn on the hatch. Top: a final platform with a spring under an opening in the ceiling; the exit rectangle sits just above the top edge.
5. Decoration, theme and palette as today.

### Segment-chained solving (`solver.js`)

`solve(level, { start, goal })` accepts a start state and a goal rectangle. The generator solves segment by segment: segment k starts from the state that ended segment k-1 and must reach checkpoint k (the last segment's goal is the exit). A segment that fails rerolls that segment's puzzle and features, then the whole biome after a few failures. The concatenated inputs are the biome solution and the hint ghost. The bypass check (puzzle must need its crates or hooks) runs per segment.

### World and game loop (`game.js`, new `climb.js`)

`climb.js` holds the run: the list of loaded biomes, the current biome index, its physics state, the checkpoint snapshots, altitude bookkeeping and best altitude. When the player overlaps the exit above a biome's top edge, the state moves into the next biome: position mapped onto the hatch column at the bottom, velocity kept, per-biome fields (bodies, flags, clock) reset to the new biome's initial values. The worker generates biomes ahead: the next one starts when the current one loads.

### Rendering (`render.js`)

A vertical camera with smoothing and slight upward lookahead. The static tile layer is cached per biome at full height. Near a gate the adjacent biome's top or bottom slice is drawn so the crossing looks continuous. The sky gradient and parallax depend on absolute altitude; the biome theme draws on top. The HUD gains the altitude meter and the arrival banner; the control bar stays.

## Out of scope

Medals, ghost-time targets, a rulebook, daily seeds, leaderboards. They fit on top of the climb later.

## Testing

- Unit: per-level dimensions (tall level physics, kill bounds, flood), solver start and goal options, checkpoint restore picks the highest checkpoint below the player, biome transfer keeps velocity and resets per-biome state.
- Generation: for several seeds, the first three biomes generate, every segment's solution chains, and the concatenated solution replays from the biome spawn to the exit. Biome generation time is measured and reported.
- Browser: climb through a gate in headless Chrome and check the camera, banner, altitude meter and sky.
