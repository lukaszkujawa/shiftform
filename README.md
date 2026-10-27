# Shiftform

A procedural puzzle-platformer where every level rewrites the rules. Type any seed and you get an endless sequence of single-screen levels. Each one is proven solvable before you see it.

## Run

```
npm start
```

Open http://localhost:8080. Zero dependencies, vanilla JS and Canvas.

```
npm test
```

## Controls

Arrows or WASD move, Z / Space / Up jump, X / Shift dash, R restart, H shows the solver's ghost, N skips, Esc returns to the title.

## How it works

- `src/physics.js` is one pure, deterministic step function shared by the game and the solver.
- `src/rules.js` holds the mutator catalog. One to three compatible mutators rewrite the rules of each level: moon or lead gravity, upside down, gravity flips every jump, gravity flips on a clock, trampoline landings, ice, mirrored controls, double and triple jump, wall jump, no air control, dash, time only moves when you move, bullet time in the air, vertical wrap, tiny or giant player, glide, darkness, strobe, caffeine, seven rationed jumps, teleport hops, rubber walls, fall damage, a rising flood, overclocked timers.
- `src/generator.js` and `src/features.js` lay a path sized to the current jump capability in one of four layout styles (pillars, floating islands, carved caves, three-tier spirals), plan a puzzle (keys and doors, switches with vanishing walls or appearing bridges, orbs that unlock the exit, portals) and sprinkle features (moving, phasing, crumbling and one-way platforms, conveyors, springs, bumpers, timed lasers and gates, patrolling saws, gravity pads, updrafts and headwinds, water, spikes).
- `src/solver.js` runs weighted A* over quantized player states using the real physics, guided by the generator's intended route. A level ships only if the solver finds an input sequence that reaches the exit. That sequence doubles as the in-game hint ghost.
- `src/themes.js` and `src/render.js` give each level one of six looks: neon outlines, ink on paper, faceted crystal, ember, frost, void. Each has its own background, tile texture, ambient particles and player styling.
- `src/worker.js` generates levels off the main thread; the next level is prefetched while you play.

Seeds and level numbers live in the URL hash, so a link reproduces a level exactly.
