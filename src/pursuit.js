export const PURSUIT = { slack: 2.5, delay: 420, margin: 60, rate: 2.5, step: 8, tail: 0.6, below: 90 };

export function pursuitOf(states, playerHeight, levelHeight) {
  const { slack, delay, margin, rate, step, below } = PURSUIT;
  const last = Math.max(0, ...states.map(s => s.tide));
  const lowest = new Array(last + 1).fill(-Infinity);
  for (const s of states) {
    const tide = Math.max(0, s.tide);
    lowest[tide] = Math.max(lowest[tide], s.y + playerHeight);
  }
  for (let t = last - 1; t >= 0; t--) lowest[t] = Math.max(lowest[t], lowest[t + 1]);
  const safeAt = tide => lowest[Math.min(last, Math.max(0, Math.floor((tide - delay) / slack)))] + margin;
  const samples = Math.ceil((last * slack + delay) / step) + 2;
  const ys = [levelHeight + below];
  for (let k = 1; k < samples; k++) ys.push(Math.max(safeAt((k - 1) * step), ys[k - 1] - rate * step));
  return { step, ys };
}

export function pursuitLevel({ step, ys }, tide) {
  const k = Math.floor(tide / step), f = tide / step - k;
  if (k + 1 < ys.length) return ys[k] + (ys[k + 1] - ys[k]) * f;
  return ys[ys.length - 1] - (tide - (ys.length - 1) * step) * PURSUIT.tail;
}
