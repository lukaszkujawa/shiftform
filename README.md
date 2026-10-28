# Shiftform

A procedural climbing platformer. Type any seed and you get an endless tower to climb. Every few screens the world crosses into a new biome with new rules and a new look, and every metre of it is proven climbable before you reach it. Height is the score.

## Run

```
npm start
```

Open http://localhost:8080. Zero dependencies, vanilla JS and Canvas.

```
npm test
```

## Controls

Arrows or WASD move, Z / Space / Up jump, X / Shift dash, F grabs, throws and lets go, R returns to your last checkpoint, H shows the solver's route for this stretch, Esc returns to the title. A bar under the play area always lists the biome's controls, highlights the ones it adds and lights keys as you press them. The title screen has the full reference.

## The climb

- Each biome is about four screens tall and has one rule set, one theme and its own puzzles. A spring at its top launches you through a hatch into the next biome; the banner shows the altitude and the new rules.
- Falling is real: you can drop back down through the whole biome you are in, but never below its floor.
- You have 5 lives. Each death costs one, and crossing a gate gives one back (never above 5). Run out and the climb ends; Enter or R starts the same tower again from the ground.
- Checkpoint flags sit about once a screen. Dying or pressing R puts you back on the highest touched flag at or below where you were, so dying never shortcuts a fall.
- The altitude meter on the left shows your height, your best for the seed (kept in the browser) and the biome's checkpoints. The sky darkens from haze to night as you climb.

## How it works

- `src/physics.js` is one pure, deterministic step function shared by the game and the solver. Levels carry their own height, so a biome is just a tall level.
- `src/rules.js` holds the mutator catalog: moon or lead gravity, gravity flips every jump or on a clock, trampoline landings, ice, mirrored controls, double and triple jump, wall jump, no air control, dash, time only moves when you move, bullet time in the air, tiny or giant player, glide, darkness, strobe, caffeine, rationed jumps, teleport hops, rubber walls, fall damage, a rising flood, overclocked timers.
- `src/bodies.js` simulates crates (wood, steel, stone) with pushing by mass, stacking, lifting and throwing, buoyancy, conveyors, springs, portals, lasers, spikes, switches and pressure plates. Hooks give rope swings.
- `src/generator.js` builds a biome as four segments. Each segment lays a zig-zag climb sized to the real jump, places a puzzle (keys and doors, switches with walls or bridges, portals, crate steps, pressure plates, thrown-crate switches, hook swings) and features (moving, phasing, crumbling and one-way platforms, conveyors, lasers, gates, saws, gravity pads, headwinds, spikes), and ends on a checkpoint or, at the top, the gate. Puzzles unlock gradually over the first biomes.
- `src/solver.js` proves each segment by solving it leg by leg along the generator's route with A* over quantized states using the real physics, backtracking one leg when a leg gets stuck. After every new segment the whole chain is replayed from the biome floor and any segment the new geometry broke is re-solved. Crate and hook puzzles must be unbeatable without their crates or hooks.
- `src/climb.js` holds the run rules: standing on checkpoints, respawning, entering the next biome and altitude.
- `src/themes.js` and `src/render.js` give each biome one of six looks over an altitude-driven sky, with a smoothed camera and the neighbouring biome drawn across gates.
- `src/worker.js` generates biomes in order off the main thread and stays two biomes ahead of you.

The seed lives in the URL hash, so a link reproduces the same tower.
