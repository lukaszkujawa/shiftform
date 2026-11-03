import { playerSize, grant } from '../world/physics.js?v=7d0e866';
import { replay } from '../generation/solver.js?v=7d0e866';
import { restful } from '../world/run.js?v=7d0e866';
import { VERSION } from '../version.js?v=7d0e866';
import { summit } from '../world/god.js?v=7d0e866';
import { impX } from '../world/imp.js?v=7d0e866';
import { parseScript, framesOf, summarizeLevel, summarizeState } from './devtools.js?v=7d0e866';

export const DEV = VERSION === 'dev';

export function createTools({ game, keys, hold, tap, audio, custom }) {
  function scriptFrame() {
    const script = game.script;
    if (script.at >= script.frames.length) {
      for (const name of script.held) keys[name] = false;
      game.script = null;
      script.resolve({ ...summarizeState(game.run), deaths: game.deaths.slice(script.deathsBefore) });
      return;
    }
    const frame = script.frames[script.at], want = new Set(frame.settle && !restful(game.run) ? [] : frame.keys);
    if (!frame.settle || restful(game.run)) script.at++;
    for (const name of want) if (!script.held.has(name)) hold(name);
    for (const name of script.held) if (!want.has(name)) keys[name] = false;
    script.held = want;
    if (frame.press) tap(frame.press);
  }

  const runScript = frames => new Promise(resolve => {
    game.tracing = true;
    game.script = { frames, at: 0, held: new Set(), resolve, deathsBefore: game.deaths.length };
  });

  const agentTools = () => ({
    script: steps => runScript(Array.isArray(steps) ? framesOf(steps) : parseScript(steps)),
    state: () => summarizeState(game.run),
    level: () => summarizeLevel(game.run.level),
    camera: () => game.camera,
    imp: () => impX(game.run.level),
    path: () => game.path,
    deaths: () => game.deaths,
    clear: () => { game.path = []; game.deaths = []; },
  });

  const devTools = () => ({
    ...agentTools(),
    level: () => ({ ...summarizeLevel(game.run.level), routes: game.run.level.segments.map(segment => segment.route) }),
    solution: segment => (segment === undefined ? game.run.level.solution : game.run.level.segments[segment].inputs),
    proof: segment => {
      const { level } = game.run, { w, h } = playerSize(level.rules), { inputs, start } = level.segments[segment];
      return replay(level, inputs, start).map(s => ({ x: s.x + w / 2, y: s.y + h, clock: s.clock, grounded: s.grounded }));
    },
    grant: kind => { game.run.s = grant({ ...game.run.s }, kind, game.run.level.rules); },
    summit: () => { game.run.s = summit(game.run.level, game.run.s); },
    music: () => audio.music,
    editor: () => custom?.editor,
    warp: (x, y) => { game.run.s = { ...game.run.s, x, y, vx: 0, vy: 0 }; },
    trace: on => { game.tracing = on; },
  });

  return { scriptFrame, agentTools, devTools };
}
