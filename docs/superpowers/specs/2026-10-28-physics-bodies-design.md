# Physics bodies design

## Goal

Add objects that move under physics and interact with the existing rules, while every level stays proven solvable.

## Model

Crates live in the step state as `bodies`, parallel to the level's `crate` objects (`slot` indexes them). Each body has position, velocity, ground contact, portal latch, a `gone` flag once it leaves the world, and an `asleep` marker holding the gravity direction it settled under. Sleeping bodies skip simulation until pushed, lifted, thrown or gravity changes.

| Kind | Mass | Push | Lift with F | Notes |
|---|---|---|---|---|
| wood | 1 | full speed | yes, throws far | floats half submerged |
| steel | 2 | 60% speed | yes, throws short, no jumping while carried | sinks |
| stone | 4 | dash only | no | sinks, crushes saws and springs |

Pushing moves the chain of touching crates plus anything resting on them when the total mass is within strength (2, or 4 while dashing). The chain stops at the first obstacle. A carried crate extends the player's collision box.

F, in priority order: throw (moving) or set down (still) the held crate, let go of the rope, grab the nearest hook in reach while airborne, lift an adjacent crate while grounded. Jumping also lets go of the rope. A rope is a distance constraint projected onto the player's movement each frame.

Pressure plates set momentary `pressed` bits each frame. Doors and toggles read `flags | pressed`, so plates reuse the existing barrier and bridge objects.

## Generation

Puzzles: `crateStep` (ledge one crate above jump height), `plateDoor` and `plateBridge` (crate must stay on the plate), `throwSwitch` (switch above jump plus crate height, reachable by a thrown crate), `swing` (hook over a wide gap). Height-based puzzles measure the real jump by simulation. Plate puzzles skip gravity-flip rules because flipping lifts crates off plates. Wooden puzzle crates start on the previous platform half the time, so they must be carried or thrown across the gap.

Crates and hooks only exist as puzzles. Before accepting a level that contains them, the generator solves a copy where they are replaced by inert objects (ids preserved) with a 25k node budget; if that copy is solvable the candidate is rejected. Decorative crates were removed after playtesting showed they added nothing.

Route waypoints can carry `body` with a crate target (`tx`, `ty`). The solver treats them as satisfied when the crate rests at the target (or when their bit is set) and adds the crate's distance to the target to the heuristic. Levels containing crates or hooks get an 80k node budget, which keeps about 85% of solvable candidates while keeping rerolls cheap.

## Verification

Unit tests cover pushing, mass limits, stacking, lifting, throwing distances, plates, conveyors, buoyancy, lasers, spikes, crushing, switches and swinging. A generator test pins one seed per physics puzzle and checks the stored solution reaches the exit and actually moves a crate or uses a rope. Sixty levels across six seeds generate in about 1.3 s on average with no fallbacks.
