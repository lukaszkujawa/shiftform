# Focus biomes and risk items design

## Goal

Make every stretch of the climb about something, and give every biome a decision worth making.

## Focus biomes

Each biome picks one focus compatible with its rules. The focus defines what its four segments build, in order: introduce, develop, twist, test. Segments no longer sprinkle unrelated random features; they apply the focus's puzzle and features for their stage, with timing tightened in later stages and at higher altitude.

| Focus | Introduce | Develop | Twist | Test |
|---|---|---|---|---|
| Crate Works | crate step | plate door | plate bridge + conveyor | throw switch + saw |
| Phase Shift | 1 slow phasing platform | 3 phasing | 2 phasing + mover | 3 fast phasing + spikes |
| Moving Parts | 1 slow mover | 2 movers | 2 movers + saw | 3 fast movers |
| Crumbling Heights | 2 crumbles | 3 crumbles | key door + 2 crumbles | 4 crumbles + floating spikes |
| Swingers | swing | swing + gust | swing + laser | swing + saw + crumble |
| Clockwork | 1 slow laser | gate + laser | 2 lasers + crumble | 2 fast lasers + 2 fast gates |
| Locksmith | key door | switch bridge | switch wall + saw | key door + laser + gate |
| Blade Run | 1 slow saw | 2 saws | 2 saws + conveyor | 3 fast saws |

A focus is allowed when every stage has at least one allowed option for the biome's rules and style. Biome 0 picks from the gentle focuses (Moving Parts, Crumbling Heights, Phase Shift, Locksmith); crate focuses unlock from biome 1 and Swingers from biome 2. The banner shows the focus name and its one-line hint before the mutator titles. A segment that keeps failing falls back to a plain climb as before.

## Risk items

Objects of type `item` with a `kind`:

- `jetpack`: adds 180 frames of fuel. Pressing jump in mid-air when no normal or boot jump is left starts thrust; holding jump keeps thrusting upward while fuel lasts.
- `boots`: adds 5 extra mid-air jumps, used after normal jumps.
- `shield`: the next spike, saw or laser hit bounces the player up instead of killing, with a short invulnerability.
- `heart`: refills lives to the maximum (handled by the game).

State gains `taken` (bitmask of collected items in this biome), `fuel`, `boots`, `shield`, `jetting`, `invuln`. The solver keys on them. Inventory (`fuel`, `boots`, `shield`) and `taken` survive respawns; inventory survives entering the next biome.

Placement: after a segment is proven, the generator may add a side branch off one route platform: a ledge one gap away from the route, sometimes crumbling, guarded by a laser or saw across the gap, with the item on it. The segment chain is always proven with every item already taken, so skipping items is always safe. Each item is separately proven: from the segment start with the item available, the solver must collect it and still reach the segment goal. Items whose proof fails are not placed. About one item per biome, two from biome 4.

## Presentation

Items glow with a distinct icon per kind. The HUD shows a fuel gauge, boot count and shield next to the hearts; the control bar adds the jetpack or boots action while owned. Picking an item shows a one-line toast and plays a pickup sound; jet thrust has a sustained sound; a shield break has its own sound and a bubble around the player while it is up.

## Testing

Physics: jetpack thrust and fuel, boot jumps, shield absorbs one hit then expires, pickups set `taken`. Climb: inventory survives respawn and biome entry, items cannot be collected twice after dying. Generation: biomes carry a focus whose stage objects appear, the chain replays, and every placed item has a stored proof that collects it and reaches the segment goal.
