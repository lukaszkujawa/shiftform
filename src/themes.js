const hsl = (h, s, l, a = 1) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;

export const THEMES = [
  {
    id: 'neon', background: 'grid', pattern: 'none', ambient: 'motes', outline: 0, glow: true, hollow: true,
    palette: h => ({
      bgTop: hsl(h, 40, 5), bgBottom: hsl(h + 30, 45, 10), rock: hsl(h, 35, 10), rockEdge: hsl(h + 180, 90, 65), rockDeep: hsl(h, 30, 16),
      ink: hsl(h + 180, 90, 65), accent: hsl(h + 120, 95, 65), accentSoft: hsl(h + 120, 95, 65, 0.3), hazard: hsl(345, 95, 62), hazardGlow: hsl(345, 95, 62, 0.35),
      player: hsl(h + 180, 30, 96), playerInk: hsl(h, 40, 12), water: hsl(190, 90, 55, 0.3), waterLine: hsl(190, 95, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 20, 70), hue: h,
    }),
  },
  {
    id: 'paper', background: 'ruled', pattern: 'hatch', ambient: 'none', outline: 3, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(45, 45, 92), bgBottom: hsl(40, 40, 85), rock: hsl(h, 25, 78), rockEdge: hsl(h, 30, 60), rockDeep: hsl(h, 25, 45),
      ink: hsl(h, 35, 16), accent: hsl(h + 150, 70, 42), accentSoft: hsl(h + 150, 70, 42, 0.3), hazard: hsl(355, 80, 48), hazardGlow: hsl(355, 80, 48, 0.3),
      player: hsl(45, 50, 97), playerInk: hsl(h, 35, 16), water: hsl(205, 70, 55, 0.35), waterLine: hsl(205, 70, 35, 0.9), text: hsl(h, 35, 14), dim: hsl(h, 20, 40), hue: h,
    }),
  },
  {
    id: 'crystal', background: 'rays', pattern: 'facets', ambient: 'sparks', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(h, 50, 8), bgBottom: hsl(h + 40, 55, 18), rock: hsl(h, 45, 32), rockEdge: hsl(h, 60, 70), rockDeep: hsl(h, 45, 22),
      ink: hsl(h, 60, 70), accent: hsl(h + 180, 95, 68), accentSoft: hsl(h + 180, 95, 68, 0.3), hazard: hsl(350, 95, 60), hazardGlow: hsl(350, 95, 60, 0.35),
      player: hsl(h + 180, 40, 96), playerInk: hsl(h, 50, 15), water: hsl(h + 180, 80, 60, 0.3), waterLine: hsl(h + 180, 90, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 30, 75), hue: h,
    }),
  },
  {
    id: 'ember', background: 'blobs', pattern: 'cracks', ambient: 'embers', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(10, 45, 6), bgBottom: hsl(20, 60, 14), rock: hsl(15, 20, 16), rockEdge: hsl(25, 90, 55), rockDeep: hsl(20, 80, 40),
      ink: hsl(30, 90, 60), accent: hsl(45, 100, 60), accentSoft: hsl(45, 100, 60, 0.3), hazard: hsl(0, 100, 62), hazardGlow: hsl(0, 100, 62, 0.4),
      player: hsl(40, 30, 95), playerInk: hsl(15, 40, 12), water: hsl(20, 100, 50, 0.45), waterLine: hsl(40, 100, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(25, 40, 70), hue: h,
    }),
  },
  {
    id: 'frost', background: 'mountains', pattern: 'frost', ambient: 'snow', outline: 2, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(210, 45, 18), bgBottom: hsl(200, 40, 40), rock: hsl(205, 35, 88), rockEdge: hsl(200, 60, 97), rockDeep: hsl(205, 30, 70),
      ink: hsl(210, 40, 45), accent: hsl(h + 200, 85, 55), accentSoft: hsl(h + 200, 85, 55, 0.3), hazard: hsl(345, 85, 55), hazardGlow: hsl(345, 85, 55, 0.3),
      player: hsl(35, 70, 60), playerInk: hsl(20, 50, 20), water: hsl(200, 80, 45, 0.4), waterLine: hsl(200, 80, 90, 0.9), text: hsl(0, 0, 98), dim: hsl(205, 30, 85), hue: h,
    }),
  },
  {
    id: 'void', background: 'stars', pattern: 'dots', ambient: 'stars', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(h, 30, 3), bgBottom: hsl(h + 60, 35, 9), rock: hsl(h, 15, 20), rockEdge: hsl(h, 25, 45), rockDeep: hsl(h, 15, 12),
      ink: hsl(h, 25, 45), accent: hsl(h + 180, 90, 65), accentSoft: hsl(h + 180, 90, 65, 0.3), hazard: hsl(350, 90, 60), hazardGlow: hsl(350, 90, 60, 0.35),
      player: hsl(h + 180, 50, 95), playerInk: hsl(h, 30, 10), water: hsl(260, 80, 55, 0.3), waterLine: hsl(260, 90, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 15, 65), hue: h,
    }),
  },
];

export function themeFor(level) {
  return THEMES[(level.theme ?? 0) % THEMES.length];
}
