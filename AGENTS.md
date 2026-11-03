# Playing Shiftform

This file is for agents who want to play the game for fun. It applies only when someone asks you to play. If you are here to work on the code, ignore it.

You play the way a person with very slow reflexes would: look at a screenshot, plan a few moves, run them, look at the trail you left, and adjust. Every tower is proven climbable, so a failed jump is your fault.

## What you need

A browser tool that can run JavaScript in the page and take screenshots: Playwright, agent-browser, chrome-use or anything similar. Use a throwaway browser profile, because the game keeps best climbs in local storage and the owner's records are theirs. Keep the tab visible, since the game advances on animation frames and a hidden tab stands still.

## Start a climb

1. Open `https://shiftform.app/#seed=<any word>&agent=1` at 1280×800. The seed picks the tower, so choose your own, and `agent=1` turns on the `shiftform` calls below. Clicking play tidies the address, so reopen this link rather than reloading.
2. Click `#play`.
3. Run `shiftform.state().phase` until it says `play`. This takes a few seconds.
4. Define these helpers in the page, then call `pause()` once. They make the game turn-based: `move` unpauses, plays your script and pauses again. They also stop you waiting forever, because a script never finishes once the game is over.

```js
window.pause = () => {
  if (shiftform.state().phase !== 'over') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
};
window.move = (steps, ms = 20000) => {
  pause();
  return Promise.race([
    shiftform.script(steps),
    new Promise(done => setTimeout(() => done({ ...shiftform.state(), timedOut: true }), ms)),
  ]).then(result => {
    pause();
    return result;
  });
};
```

## The loop

1. Take a screenshot and work out where you are.
2. Run a few moves with `move('right 20, right+jump 30, wait 20')`.
3. Read what comes back: position, `grounded`, `altitude`, `lives` and the `deaths` from that script, each with its cause.
4. Take another screenshot. Your path is drawn on the screen as a thin line in your colour, so you can see how the jump really went.

Keep each script to one idea, because long ones go wrong early and keep running anyway. You can stop in mid-air and carry on with the next `move`, but keys are let go between moves, so a jump you are still holding gets cut short. Keep a whole jump in one script.

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

- Never `press Escape` in a script. It pauses the game and the script stops there, so use `pause()` instead.
- `KeyR` returns to your last checkpoint, and is ignored unless you are standing still, so put `settle` first.
- `KeyV` fires the bow.
- `KeyB` opens build mode for held tricks.
- `KeyH` turns the hint on or off. It is a pale ghost climber walking this stretch's route from the stretch's start, not a drawn line, so it may be off screen. Press it once, then `wait 60` and take a screenshot.
- `Digit1` to `Digit9` and `Digit0` buy at a stall you are standing at.

## Reading the world

- **Size:** the play area is 960×540 world pixels, and a tile is 30. In the 1280×800 window, one world pixel is 1.33 screen pixels.
- **Coordinates:** `y` grows downward. `state().x` and `.y` are the climber's top-left corner, and a normal climber is 20 wide and 26 tall.
- **Height:** two metres per tile.
- **Screen position:** with `rect = document.querySelector('#game').getBoundingClientRect()` and `scale = rect.width / 960`, a world point is at `rect.left + x * scale`, `rect.top + (y - shiftform.camera()) * scale`.
- **Lag:** the camera trails behind you, so `wait 20` before a screenshot if you moved far.

Useful calls:

- `shiftform.state()`: where you are, lives, points (gold), runes, skills, difficulty and the flood.
- `shiftform.level()`: this biome's `title`, rule names (`mutators`), `surfaces`, `objects`, `start` and `exit`, in world coordinates. It is your map for measuring a jump you can already see. Surfaces only give top edges, but platforms are solid blocks, usually 30 thick or more, so check the screenshot for a ceiling above your jump. Objects are listed at their starting positions, so a moving platform won't be where `level()` says.
- `shiftform.imp()`: the x of the imp on this floor.
- `shiftform.path()`: your trail, as points at the climber's feet.
- `shiftform.deaths()`: every death so far, with its cause. A script's result only lists deaths during that script, so check here if `lives` dropped without one.
- `shiftform.clear()`: wipes the trail and the death list.

## Words the game uses

- **Biome:** one tall section of the tower with its own rules and look.
- **Gate:** the spring at the top of a biome that launches you into the next one.
- **Bane:** a rule that makes a biome harder.
- **Rune:** currency for skills. You earn them for every biome you finish, more on a harder difficulty.
- **Imp:** stands on every biome's floor and sets the difficulty. Changing it wipes your flags in that biome.

## How a climber moves

These are the numbers with no rules applied. Banes and skills change them, so measure again after each gate with a small hop on safe ground.

- Running reaches 4.2 px per frame after about 15 frames.
- How long you hold jump decides the height: `tap jump` barely leaves the ground (about 7 px), 8 frames gives 55 px, 12 gives 75 px and 14 gives 83 px. A full hold gives 86 px from standing and 105 px at a run.
- A full running jump covers roughly 170 px and lasts about 45 frames.
- You keep your momentum in the air after letting go: `left+jump 12, wait 25` still travelled about 125 px. To land short, push the opposite key.
- Jumping again needs a gap of at least one frame with the key up.
- Ropes and ladders: stand on them and hold `up`. Hold `up+right` at the top to step off.
- Marked walls have yellow hatching and let you jump off them. The `cling` objects in `level()` give the marked range, and you can't kick off a wall below it. Touch one in the air, then alternate presses. Between two facing walls 60 px apart, which leaves 40 px of travel, `right 2, wait 1, jump 9, wait 1, jump 9, wait 1, jump 9` keeps gaining height, and six kicks gained about 157 px. Wider gaps need longer holds.
- Falling usually costs only the climb back, and `KeyR` costs no life. Some biomes add fall damage, and hazards take a life.

## Things that will catch you out

- **The game only waits while paused.** Without `pause()` it runs in real time between your commands: platforms move, crumbling ledges come back, floods rise, and a round trip can cost 300 frames or more. While paused, the screen is dimmed and the Paused buttons cover the middle, but you can still read it. Don't send `Enter` or `KeyR` while paused, because they leave the climb or restart the level.
- **Timing moving things.** Time passes only during your moves, so step with `wait` and take screenshots to watch a cycle before you jump. `state().clock` rewinds when you return to a checkpoint, while `state().frame` keeps counting.
- **The flood is uneven.** `state().flood` can sit still and then rise quickly once you start climbing, so an old reading is not a safe margin.
- **Scripts carry on after a death.** They pause during the respawn and then play the remaining frames from the checkpoint. If `deaths` is not empty, ignore where you ended up and look again.
- **Game over stops scripts for good.** `move` returns with `timedOut: true` and `phase: 'over'`. To climb again, click `#again` and call `pause()`.
- **Shops are off to the side.** On each biome's floor, follow the SHOPS sign into the tunnel. Inside, `state().hall` is true and coordinates belong to the hall. The stalls run SHOP, SKILLS, DICE, and cards appear when you stand close: `press Digit1` to buy. Your first level from SKILLS is free. Walk out of either end to return to the climb.

## Fair play

Don't read the generator or solver to work out a level, and don't change any code while you play, because that makes it not a game.

`H` and pausing are fine, since human players have them too. You will enjoy it more if you skip the README's game section and find out what each biome does by dying in it.

## When you stop

Tell whoever asked how it went: the seed, your best height, your deaths and what killed you, the best and worst moments, and a screenshot if you can share one. Close your browser session when you are done.
