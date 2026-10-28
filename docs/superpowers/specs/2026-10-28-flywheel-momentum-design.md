# Flywheel: momentum that turns into height

## Goal

A mutator biome where keeping your speed up in one direction charges a momentum meter, and a charged jump goes higher and further. Levels in that biome demand it: each stretch has gaps that cannot be crossed from a standing jump.

## Mechanic

The player state gains `charge` (0 to 1) and `chargeDir` (-1, 0, 1).

- Charge builds while the held direction matches `chargeDir` and the player moves at or above base walking speed, on the ground or in the air. It reaches 1 after `CHARGE_FRAMES` (90) frames.
- When `chargeDir` is 0 and the player holds a direction at walking speed, `chargeDir` becomes that direction and charging starts.
- Charge drops to 0 and `chargeDir` to 0 when the player holds the opposite direction, when the player is grounded and below walking speed (stopped), or when horizontal movement is blocked by a wall or a body.
- A dash neither builds nor spends charge.
- While charging, the run speed target is `moveSpeed * (1 + SPEED_BONUS * charge)` with `SPEED_BONUS` 0.5. Charge only ever raises the speed; it never lowers it.
- A jump launches with `jumpVel * (1 + JUMP_BONUS * charge)` with `JUMP_BONUS` 0.25. Wall jumps and kicks use the same multiplier. Blink jumps are excluded by the mutator tags.
- The charge survives a jump and a landing. It is part of the checkpoint snapshot like every other state field, and `standAt` resets it to 0 because the player is placed standing still.

Only levels whose rules have `flywheel` true evaluate any of this. Other levels leave `charge` at 0 so their proofs are unchanged.

## Mutator

`{ id: 'flywheel', title: 'Flywheel', hint: 'Keep moving one way. Speed becomes height.', tags: ['speed', 'dash'], weight: 2.5 }` sets `rules.flywheel = true`. The tags exclude Caffeine (speed) and Blink (dash).

`jumpProfile(rules)` is unchanged: it reports the standing jump, which is what every ordinary gap is sized from. A new `chargedProfile(rules)` reports the height and reach of a full-charge jump and is used only for sprint gaps.

## Solver

`stateKey` includes `Math.round(charge * 3)` and `chargeDir`. The heuristic keeps using the base `moveSpeed`, so it remains admissible. Macros are unchanged: holding a direction for several macros is how charge is built.

## Generator

In a flywheel biome, `layClimb` places one or two sprint gaps per segment. A sprint gap reuses the wide-gap slot:

- Its width is between the standing reach and 90% of the charged reach, in tiles.
- Before it, the climb runs in one direction without a turn for at least `RUN_UP_TILES`, counting ledges and the gaps between them, since charge carries through the air. `RUN_UP_TILES` is the distance covered in `CHARGE_FRAMES` at base speed, in tiles, rounded up.
- The ledge before the sprint gap is at least 3 tiles wide so the jump can be timed.
- A sprint gap gets no feature on its landing ledge that would stop the run (no barrier, no door).

Acceptance adds a check mirroring the crate bypass test: the segment is solved again with a copy of the rules where `flywheel` is false. If that solve succeeds the segment does not demand momentum and is rejected. Other puzzles and features apply as usual. The segment budget for flywheel biomes uses `PHYSICS_LEG_BUDGET`.

## Feel

- The player's glow radius and the afterimage trail length scale with charge.
- A rising tone plays when charge reaches 1 (`charged` sound event) and a short drop plays when a full charge is lost (`uncharged`).
- No new key. The banner shows the mutator hint.

## Tests

- physics: charge builds to 1 while running right on flat ground; a jump at full charge rises about 1.5x and travels about 2x a standing jump; charge carries through a jump; charge resets on turning, on stopping, and on hitting a wall; dash leaves charge unchanged; a non-flywheel level never charges.
- rules: `chargedProfile` reports higher height and reach than `jumpProfile`; `flywheel` is incompatible with `sprint` and `dash`.
- solver: two states differing only in charge have different keys.
- generator: three flywheel seeds produce segments where the stored solution reaches the exit and at least one sprint gap per biome cannot be crossed by the charge-disabled solver.
- sounds: `charged` fires once when charge reaches 1.

## Out of scope

Momentum in other biomes, momentum affecting crates, and any new control.
