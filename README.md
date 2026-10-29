# Shiftform

A procedural climbing platformer. Type any seed and you get an endless tower to climb. Every few screens the world crosses into a new biome with new rules and a new look, and every metre of it is proven climbable before you reach it. Height is the score.

## Run

```
npm start
```

Open http://localhost:8080. Zero dependencies, vanilla JS and Canvas.

```
npm test              # unit tests, a couple of seconds
npm run test:generation   # builds and proves whole biomes, a minute or two
npm run test:all
```

## Controls

Arrows or WASD move, Z / Space / Up jump, Up / Down (W / S) climb ladders, ropes and vines (in mid-air with your legs against a wall it kicks you off; alternate walls to chain kicks), X / Shift dash, F grabs, throws and lets go, R returns to your last checkpoint, H shows the solver's route for this stretch, M toggles sound, Esc returns to the title. A bar under the play area always lists the biome's controls, highlights the ones it adds and lights keys as you press them. The title screen has the full reference.

## Daily Climb, share cards and ghosts

- The Daily Climb is one tower per day, the same for everyone (the seed is the UTC date), with 3 lives instead of 5. Endless towers from any seed are still there.
- When you run out of lives you get a share card: the tower, your height, one emoji per biome you climbed through (☄️ marks a comet skip, 💀 where it ended), deaths and your best. Share result copies it (or opens the share sheet on phones).
- Challenge a friend copies a link that carries your whole run. Whoever opens it races your ghost up the same tower: a translucent climber in your biome and a ring on the altitude meter showing how far ahead you are. Runs are stored as compressed inputs (a few hundred characters per minute) and replayed through the same deterministic physics, so the ghost does exactly what you did. Links remember the game version and warn when a ghost was recorded on a different one.

## The climb

- The first biome is always First Steps: no mutators, no hazards, no puzzles, just hops, then a ladder or trampoline, then a slow moving platform, then a crumbling one, with a tip when you enter each stretch. The opening banner waits for your first key press.
- Each biome is about four screens tall and has one rule set, one theme and its own puzzles. A spring at its top launches you through a hatch into the next biome; the banner shows the altitude and the new rules.
- The climber has a life of its own: it squashes and wobbles on landings, stretches on take-off, kicks up dust as it runs and skids, and wears a leaf, antenna, tuft or bow (picked by the seed) that swings with every move. Its eyes follow nearby monsters and items, it beams at pickups and checkpoints, panics in long falls, frowns through dashes and nods off if left alone. Stomps, deaths and perfect comet bounces land with a short hit-stop.
- Roughly half of every climb is platform hops; the rest is ladders, ropes and vines (themed per biome) and trampolines that launch you to high ledges.
- Falling is real: you can drop back down through the whole biome you are in, but never below its floor.
- You have 5 lives. Each death costs one, and crossing a gate gives one back (never above 5). Run out and the climb ends; Enter or R starts the same tower again from the ground.
- Checkpoint flags sit about once a screen. Dying or pressing R puts you back on the last flag you touched, with everything you were carrying.
- Crates never wait where they are needed. They sit in a nook just off the climb: a guarded ledge a few rows below the route to carry the crate up from, a high alcove to push it down from, or a steel crate you shove onto a trampoline so it pops up onto a plate. The last stretches ask for two crates stacked into one tall step.
- Every biome is built around one focus (Crate Works, Phase Shift, Moving Parts, Crumbling Heights, Swingers, Clockwork, Locksmith, Blade Run). Its four stretches introduce the idea, develop it, twist it and test it.
- From the second biome on, monsters turn up now and then, more often the higher you climb: patrollers pacing a platform, flappers circling over a gap and spitters lobbing shots across the jump to their ledge. Touching one kills you; landing on top squashes it and bounces you up (shots can't be squashed, but they stop once their spitter is gone). Squashed monsters come back if you respawn at an earlier checkpoint.
- Items wait on risky ledges off the route: a jetpack (fly when out of jumps), spring boots (five extra air jumps), a shield (survive one hazard), a heart (refill lives) and the rare comet.
- The comet turns every platform one-way: you fly up through them and land on top, bouncing on every landing. Tap jump just as you land (within eight frames either side) and the next bounce goes 35% higher, up to six times your jump; each perfect bounce tightens the window by a frame, down to four. While it lasts the camera leans toward where you are falling so you can see the landing coming. Miss once and the comet burns out on the next landing (the first bounce is free). Squashing a monster counts as a perfect bounce, hazards still kill, and flying out of the top of a biome takes you straight into the next, up to two biomes per comet. Items you hold survive deaths and gates. Skipping them is always safe: the route is proven without them, and each item is proven reachable with a way back.
- The altitude meter on the left shows your height, your best for the seed (kept in the browser) and the biome's checkpoints. The sky darkens from haze to night as you climb.

## How it works

- `src/physics.js` is one pure, deterministic step function shared by the game and the solver. Levels carry their own height, so a biome is just a tall level.
- `src/rules.js` holds the mutator catalog: moon or lead gravity, gravity flips every jump or on a clock, trampoline landings, ice, mirrored controls, double and triple jump, wall jump, no air control, dash, time only moves when you move, bullet time in the air, tiny or giant player, glide, darkness, caffeine, teleport hops, rubber walls, fall damage, a rising flood, overclocked timers, and Flywheel momentum: keep moving one way for a second and your jumps grow higher and longer until you turn, stop or hit a wall.
- `src/bodies.js` simulates crates (wood, steel, stone) with pushing by mass, stacking (set a crate down against another and it goes on top), lifting and throwing, buoyancy, conveyors, springs, portals, lasers, spikes, switches and pressure plates. Hooks give rope swings.
- `src/generator.js` builds a biome as four segments. Each segment lays a zig-zag climb sized to the real jump, places a puzzle (keys and doors, switches with walls or bridges, portals, crate puzzles, thrown-crate switches, hook swings) and features (moving, phasing, crumbling (they return three seconds after you leave them) and one-way platforms, conveyors, lasers, gates, saws, gravity pads, headwinds, spikes), and ends on a checkpoint or, at the top, the gate. In a Flywheel biome it also lays flat runways before gaps that only a charged jump can cross, and rejects any stretch the charge-disabled solver can still finish. Puzzles unlock gradually over the first biomes.
- `src/solver.js` proves each segment by solving it leg by leg along the generator's route with A* over quantized states using the real physics, backtracking one leg when a leg gets stuck. After every new segment the whole chain is replayed from the biome floor and any segment the new geometry broke is re-solved. Crate and hook puzzles must be unbeatable without their crates or hooks.
- `src/climb.js` holds the run rules: standing on checkpoints, respawning, entering the next biome and altitude.
- `src/themes.js` and `src/render.js` give each biome one of twenty-four looks (neon, paper, crystal, ember, frost, void, jungle, dunes, deep sea, blossom, a rainy city skyline, countryside fields with a windmill, a spaceship bulkhead with portholes, candy land, an office behind window blinds, falling matrix code, an inferno of lava falls, a lunar surface under an earthrise, a harbor with sailboats and a lighthouse, a haunted graveyard under a full moon, a synthwave sunset over a neon grid, a smoking factory, a glowing mushroom forest and a sky kingdom of clouds and floating islands) over an altitude-driven sky, with a smoothed camera and the neighbouring biome drawn across gates.
- `src/sounds.js` turns each pair of physics states into sound events (jumps, landings, dashes, deaths, pickups, plates, flips, springs, the gate launch, portals, hooks, crate lifts, throws, pushes and material-specific landings, crushing). `src/audio.js` synthesizes all of it with the Web Audio API, no samples: effects, proximity loops for saws, lasers, conveyors, platforms, wind and the flood, a per-theme ambience (synth pulses, pencil scratches, glass bells, embers, howling wind, a deep void drone, jungle drips, desert wind, deep-sea bubbles, blossom plucks, distant car horns, birdsong, console beeps, music-box bells, keyboard clicks, digital bleeps, volcanic rumbles, gull cries, ghostly moans, synth arpeggios, factory clanks) that crossfades at gates, and an altitude wind that grows as you climb.
- `src/decor.js` keeps the platforms from looking stamped out: each biome's blocks get seeded chipped corners, pebbles, tufts, bands, lichen patches, cracks and stalactites baked into the tile layer, and a few blocks per screen come alive with eyes that blink and follow you, a bug crawling back and forth along the top, a corner glint or a drip forming and falling underneath.
- `src/life.js` and `src/life-shapes.js` grow each biome's background life from its seed: plants rooted on platform tops behind the tiles, rotating through their theme's kinds so neighbours differ, ground creatures that hop or crawl back and forth along a platform, flyers crossing the screen in parallax depths on glide, wave, loop or swoop paths, and one drifting flock. Each theme has its own family (kelp and jellies, ink ferns and birds, crystal clusters and prism bugs, dead trees and lava worms, pines, hares and owls, nebula flowers and whales, monsteras, frogs and fireflies, cacti, lizards, vultures and tumbleweed, coral, crabs and fish schools, bamboo, blossom trees and petals, streetlamps, hydrants, cats and blimps, sunflowers, wheat, sheep and bees, consoles, drones and robots, lollipops, candy canes and gummy bears, potted plants, water coolers, paper planes and robot vacuums, data pylons, server racks, glitch cubes and data packets, hell spires, bats and ash, satellite dishes, rockets, hopping astronauts and meteors, bollards, anchors, barrels, gulls and crabs, tombstones, pumpkins, ghosts and spiders, palms, arcade cabinets and spinning records, gears and oil drums, toadstools, glowing mushrooms and snails, balloons, pinwheels, kites and hot-air balloons). They never touch play.
- `src/worker.js` generates biomes in order off the main thread and stays two biomes ahead of you. While you wait, the generator reports which stretch it is laying or proving and how far along it is, and `src/chatter.js` fills the gap with seeded nonsense about what it is supposedly busy with.

The seed lives in the URL hash, so a link reproduces the same tower.
