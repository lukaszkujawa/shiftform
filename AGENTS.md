# Playing Shiftform

This file is for agents who want to play the game for fun. It applies only when someone asks you to play. If you are here to work on the code, ignore it.

You play the way a person with very slow reflexes would: look at a screenshot, plan a few moves, run them, look at the trail you left, and adjust. Every tower is proven climbable, so a failed jump is your fault.

## What you need

A browser tool that can run JavaScript in the page and take screenshots: Playwright, agent-browser, chrome-use or anything similar. Use a throwaway browser profile, because the game keeps best climbs in local storage and the owner's records are theirs. Keep the tab visible, since the game advances on animation frames and a hidden tab stands still.

## Start a climb

Check whether the game is already up with `curl -sI localhost:8080`, and if not run `npm start` (no install step). Use a different `PORT=` if 8080 belongs to something else. The harness below exists only on this local build, not on the deployed site.

1. Open `http://localhost:8080/#seed=<any word>` at 1280×800. The seed picks the tower, so choose your own.
2. Click `#play`.
3. Run `shiftform.state().phase` until it says `play`. This takes a few seconds.
4. Define this helper in the page. It stops you waiting forever, because a script never finishes once the game is over:

```js
window.move = (steps, ms = 20000) => Promise.race([
  shiftform.script(steps),
  new Promise(done => setTimeout(() => done({ ...shiftform.state(), timedOut: true }), ms)),
]);
```

## The loop

1. Take a screenshot and work out where you are.
2. Run a few moves with `move('right 20, right+jump 30, wait 20')`.
3. Read what comes back: position, `grounded`, `altitude`, `lives` and the `deaths` from that script, each with its cause.
4. Take another screenshot. Your path is drawn on the screen as a thin line in your colour, so you can see how the jump really went.

Keep each script to one idea, because long ones go wrong early and keep running anyway. But anything that happens in mid-air must fit in a single script: a browser round trip can cost 300 frames or more, so you will have landed before your next command arrives.

If your tool keeps variables between evals, wrap probes in `(() => { ... })()` so a repeated `const` doesn't throw.

## Script language

A comma-separated list, one frame at 60 per second:

| Step | Meaning |
|---|---|
| `right 20` | hold a key for 20 frames |
| `right+jump 30` | hold several keys together |
| `wait 15` | hold nothing |
| `tap jump` | hold for one frame |
| `settle` | wait until the climber is standing still |
| `press KeyR` | send one raw key press |

Keys: `left`, `right`, `up`, `down`, `jump`, `dash`, `interact`, `teleport`.

Raw presses, each with `press`:

- `KeyR` returns to your last checkpoint, and is ignored unless you are standing still, so put `settle` first.
- `KeyV` fires the bow.
- `KeyB` opens build mode for held tricks.
- `KeyH` turns the hint on or off. It is a pale ghost climber walking this stretch's route in real time from the stretch's start, not a drawn line, so it may be off screen. Press it once and take a few screenshots.
- `Digit1` to `Digit7` buy at a stall you are standing at.

## Reading the world

- **Size:** the play area is 960×540 world pixels, and a tile is 30. In the 1280×800 window, one world pixel is 1.33 screen pixels.
- **Coordinates:** `y` grows downward. `state().x` and `.y` are the climber's top-left corner, and a normal climber is 20 wide and 26 tall.
- **Height:** two metres per tile.
- **Screen position:** with `rect = document.querySelector('#game').getBoundingClientRect()` and `scale = rect.width / 960`, a world point is at `rect.left + x * scale`, `rect.top + (y - shiftform.camera()) * scale`.
- **Lag:** the camera trails behind you, so `wait 20` before a screenshot if you moved far.

Useful calls:

- `shiftform.state()`: where you are, lives, points, runes, gear and the flood.
- `shiftform.level()`: this biome's `title`, rule names (`mutators`), `surfaces`, `objects`, `start` and `exit`, in world coordinates. It is your map for measuring a jump you can already see. Surfaces only give top edges, but platforms are solid blocks, usually 30 thick or more, so check the screenshot for a ceiling above your jump.
- `shiftform.path()`: your trail, as points at the climber's feet.
- `shiftform.deaths()`: every death so far, with its cause.
- `shiftform.clear()`: wipes the trail and the death list.

## Words the game uses

- **Biome:** one tall section of the tower with its own rules and look.
- **Gate:** the spring at the top of a biome that launches you into the next one.
- **Bane:** a rule that makes a biome harder.
- **Rune:** currency for gear and rewriting rules. You earn one per biome.

## How a climber moves

These are the numbers with no rules applied. Banes and gear change them, so measure again after each gate with a small hop on safe ground.

- Running reaches 4.2 px per frame after about 15 frames.
- How long you hold jump decides the height: `tap jump` barely leaves the ground (about 7 px), 8 frames gives about 55 px, and a full hold about 85 to 105 px.
- A full running jump covers roughly 170 px and lasts about 45 frames.
- You keep your momentum in the air after letting go: `left+jump 12, wait 25` still travelled about 125 px. To land short, push the opposite key.
- Jumping again needs a gap of at least one frame with the key up.
- Ropes and ladders: stand on them and hold `up`. Hold `up+right` at the top to step off.
- Marked walls have yellow hatching and let you jump off them. Touch one in the air, then alternate presses in one script. Between two facing walls 40 px apart, `right 2, wait 1, jump 9, wait 1, jump 9, wait 1, jump 9` keeps gaining height, and six kicks gained about 157 px. Wider gaps need longer holds.
- Falling usually costs only the climb back, and `KeyR` costs no life. Some biomes add fall damage, and hazards take a life.

## Things that will catch you out

- **The game does not wait for you.** It runs in real time between your commands: platforms move, crumbling ledges come back and floods keep rising. Anything moving in your screenshot has moved on by the time you act, so use `state().clock` and watch a cycle before you jump. The clock rewinds when you return to a checkpoint, while `state().frame` keeps counting. When the flood is rising, spend less time thinking.
- **Scripts carry on after a death.** They pause during the respawn and then play the remaining frames from the checkpoint. If `deaths` is not empty, ignore where you ended up and look again.
- **Game over stops scripts for good.** `move` returns with `timedOut: true` and `phase: 'over'`. To climb again, click `#again`.
- **Shops are off to the side.** On each biome's floor, follow the SHOPS sign into the tunnel. Inside, `state().hall` is true and coordinates belong to the hall. The stalls run SHOP, GEAR, RULES, DICE, and cards appear when you stand close: `press Digit1` to buy. Your first piece from GEAR is free. Walk out of either end to return to the climb.
- **Cards can hide the screen.** A golden merchant stands on each floor and his cards cover part of the view while you are near him.

## Fair play

Off limits, because they make it not a game:

- `shiftform.solution()`, `shiftform.proof()` and the `routes` in `level()` are the answer key.
- `shiftform.warp()`, `shiftform.summit()` and `shiftform.grant()` move you or hand you things.
- The golden merchant is a test tool: don't buy from him.
- Don't read the generator or solver to work out a level, and don't change any code while you play.

`H` is fine, since human players have it too. You will enjoy it more if you skip the README's game section and find out what each biome does by dying in it.

## When you stop

Tell whoever asked how it went: the seed, your best height, your deaths and what killed you, the best and worst moments, and a screenshot if you can share one. Close your browser session when you are done.
