const hsl = (h, s, l, a = 1) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;

export const alpha = (color, a) => color.replace(/\/ [\d.]+\)$/, `/ ${a})`);

export const THEMES = [
  {
    id: 'neon', emoji: '💡', climb: 'rope', mote: 'text', background: 'grid', pattern: 'none', ambient: 'motes', outline: 0, glow: true, hollow: true,
    palette: h => ({
      bgTop: hsl(h, 40, 5), bgBottom: hsl(h + 30, 45, 10), rock: hsl(h, 35, 10), rockEdge: hsl(h + 180, 90, 65), rockDeep: hsl(h, 30, 16),
      ink: hsl(h + 180, 90, 65), accent: hsl(h + 120, 95, 65), accentSoft: hsl(h + 120, 95, 65, 0.3), hazard: hsl(345, 95, 62), hazardGlow: hsl(345, 95, 62, 0.35),
      player: hsl(h + 180, 30, 96), playerInk: hsl(h, 40, 12), water: hsl(190, 90, 55, 0.3), waterLine: hsl(190, 95, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 20, 70), hue: h,
    }),
  },
  {
    id: 'paper', emoji: '📄', climb: 'ladder', mote: 'text', background: 'ruled', pattern: 'hatch', ambient: 'none', outline: 3, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(45, 45, 92), bgBottom: hsl(40, 40, 85), rock: hsl(h, 25, 78), rockEdge: hsl(h, 30, 60), rockDeep: hsl(h, 25, 45),
      ink: hsl(h, 35, 16), accent: hsl(h + 150, 70, 42), accentSoft: hsl(h + 150, 70, 42, 0.3), hazard: hsl(355, 80, 48), hazardGlow: hsl(355, 80, 48, 0.3),
      player: hsl(45, 50, 97), playerInk: hsl(h, 35, 16), water: hsl(205, 70, 55, 0.35), waterLine: hsl(205, 70, 35, 0.9), text: hsl(h, 35, 14), dim: hsl(h, 20, 40), hue: h,
    }),
  },
  {
    id: 'crystal', emoji: '💎', climb: 'ladder', mote: 'accent', background: 'rays', pattern: 'facets', ambient: 'sparks', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(h, 50, 8), bgBottom: hsl(h + 40, 55, 18), rock: hsl(h, 45, 32), rockEdge: hsl(h, 60, 70), rockDeep: hsl(h, 45, 22),
      ink: hsl(h, 60, 70), accent: hsl(h + 180, 95, 68), accentSoft: hsl(h + 180, 95, 68, 0.3), hazard: hsl(350, 95, 60), hazardGlow: hsl(350, 95, 60, 0.35),
      player: hsl(h + 180, 40, 96), playerInk: hsl(h, 50, 15), water: hsl(h + 180, 80, 60, 0.3), waterLine: hsl(h + 180, 90, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 30, 75), hue: h,
    }),
  },
  {
    id: 'ember', emoji: '🌋', climb: 'rope', mote: 'rockEdge', background: 'blobs', pattern: 'cracks', ambient: 'embers', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(10, 45, 6), bgBottom: hsl(20, 60, 14), rock: hsl(15, 20, 16), rockEdge: hsl(25, 90, 55), rockDeep: hsl(20, 80, 40),
      ink: hsl(30, 90, 60), accent: hsl(45, 100, 60), accentSoft: hsl(45, 100, 60, 0.3), hazard: hsl(0, 100, 62), hazardGlow: hsl(0, 100, 62, 0.4),
      player: hsl(40, 30, 95), playerInk: hsl(15, 40, 12), water: hsl(20, 100, 50, 0.45), waterLine: hsl(40, 100, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(25, 40, 70), hue: h,
    }),
  },
  {
    id: 'frost', emoji: '❄️', climb: 'ladder', mote: 'text', background: 'mountains', pattern: 'frost', ambient: 'snow', outline: 2, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(210, 45, 18), bgBottom: hsl(200, 40, 40), rock: hsl(205, 35, 88), rockEdge: hsl(200, 60, 97), rockDeep: hsl(205, 30, 70),
      ink: hsl(210, 40, 45), accent: hsl(h + 200, 85, 55), accentSoft: hsl(h + 200, 85, 55, 0.3), hazard: hsl(345, 85, 55), hazardGlow: hsl(345, 85, 55, 0.3),
      player: hsl(35, 70, 60), playerInk: hsl(20, 50, 20), water: hsl(200, 80, 45, 0.4), waterLine: hsl(200, 80, 90, 0.9), text: hsl(0, 0, 98), dim: hsl(205, 30, 85), hue: h,
    }),
  },
  {
    id: 'void', emoji: '🌌', climb: 'rope', mote: 'text', background: 'stars', pattern: 'dots', ambient: 'stars', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(h, 30, 3), bgBottom: hsl(h + 60, 35, 9), rock: hsl(h, 15, 20), rockEdge: hsl(h, 25, 45), rockDeep: hsl(h, 15, 12),
      ink: hsl(h, 25, 45), accent: hsl(h + 180, 90, 65), accentSoft: hsl(h + 180, 90, 65, 0.3), hazard: hsl(350, 90, 60), hazardGlow: hsl(350, 90, 60, 0.35),
      player: hsl(h + 180, 50, 95), playerInk: hsl(h, 30, 10), water: hsl(260, 80, 55, 0.3), waterLine: hsl(260, 90, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 15, 65), hue: h,
    }),
  },
  {
    id: 'jungle', emoji: '🌴', climb: 'vine', mote: 'accent', background: 'vines', pattern: 'moss', ambient: 'spores', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(150, 45, 7), bgBottom: hsl(130, 40, 16), rock: hsl(25, 25, 20), rockEdge: hsl(105, 55, 45), rockDeep: hsl(25, 25, 13),
      ink: hsl(105, 50, 58), accent: hsl(h, 85, 62), accentSoft: hsl(h, 85, 62, 0.3), hazard: hsl(350, 90, 58), hazardGlow: hsl(350, 90, 58, 0.35),
      player: hsl(60, 30, 95), playerInk: hsl(140, 40, 12), water: hsl(170, 70, 40, 0.4), waterLine: hsl(170, 80, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(110, 20, 70), hue: h,
    }),
  },
  {
    id: 'dunes', emoji: '🏜️', climb: 'ladder', mote: 'rockDeep', background: 'dunes', pattern: 'strata', ambient: 'dust', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(30, 70, 74), bgBottom: hsl(18, 65, 62), rock: hsl(32, 45, 55), rockEdge: hsl(40, 65, 76), rockDeep: hsl(26, 40, 40),
      ink: hsl(20, 45, 25), accent: hsl(h, 75, 38), accentSoft: hsl(h, 75, 38, 0.3), hazard: hsl(355, 85, 45), hazardGlow: hsl(355, 85, 45, 0.3),
      player: hsl(45, 40, 97), playerInk: hsl(20, 45, 20), water: hsl(190, 70, 45, 0.45), waterLine: hsl(190, 80, 30, 0.9), text: hsl(20, 45, 15), dim: hsl(25, 30, 32), hue: h,
    }),
  },
  {
    id: 'deep', emoji: '🐙', climb: 'vine', mote: 'waterLine', background: 'caustics', pattern: 'barnacles', ambient: 'bubbles', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(195, 70, 14), bgBottom: hsl(210, 70, 5), rock: hsl(200, 30, 18), rockEdge: hsl(175, 60, 50), rockDeep: hsl(200, 30, 11),
      ink: hsl(175, 60, 55), accent: hsl(h, 90, 65), accentSoft: hsl(h, 90, 65, 0.3), hazard: hsl(350, 95, 60), hazardGlow: hsl(350, 95, 60, 0.35),
      player: hsl(180, 40, 96), playerInk: hsl(200, 50, 10), water: hsl(190, 90, 55, 0.3), waterLine: hsl(190, 95, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(190, 30, 70), hue: h,
    }),
  },
  {
    id: 'blossom', emoji: '🌸', climb: 'vine', mote: 'rockEdge', background: 'hills', pattern: 'waves', ambient: 'petals', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(255, 30, 20), bgBottom: hsl(330, 40, 44), rock: hsl(20, 25, 28), rockEdge: hsl(340, 70, 80), rockDeep: hsl(20, 25, 19),
      ink: hsl(340, 60, 82), accent: hsl(h, 80, 65), accentSoft: hsl(h, 80, 65, 0.3), hazard: hsl(0, 90, 55), hazardGlow: hsl(0, 90, 55, 0.35),
      player: hsl(40, 40, 96), playerInk: hsl(340, 40, 15), water: hsl(210, 70, 60, 0.35), waterLine: hsl(210, 80, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(330, 25, 80), hue: h,
    }),
  },
  {
    id: 'city', emoji: '🏙️', climb: 'ladder', mote: 'dim', background: 'skyline', pattern: 'bricks', ambient: 'rain', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(250, 35, 12), bgBottom: hsl(15, 55, 36), rock: hsl(220, 8, 28), rockEdge: hsl(35, 20, 62), rockDeep: hsl(225, 12, 17),
      ink: hsl(40, 30, 82), accent: hsl(45, 95, 62), accentSoft: hsl(45, 95, 62, 0.3), hazard: hsl(355, 90, 58), hazardGlow: hsl(355, 90, 58, 0.35),
      player: hsl(h, 40, 96), playerInk: hsl(225, 30, 12), water: hsl(200, 60, 50, 0.35), waterLine: hsl(200, 70, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(210, 30, 75), hue: h,
    }),
  },
  {
    id: 'country', emoji: '🌻', climb: 'ladder', mote: 'accent', background: 'fields', pattern: 'turf', ambient: 'spores', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(200, 65, 62), bgBottom: hsl(55, 60, 84), rock: hsl(28, 40, 34), rockEdge: hsl(100, 55, 45), rockDeep: hsl(28, 40, 23),
      ink: hsl(28, 45, 16), accent: hsl(48, 95, 55), accentSoft: hsl(48, 95, 55, 0.3), hazard: hsl(355, 85, 48), hazardGlow: hsl(355, 85, 48, 0.3),
      player: hsl(h, 45, 97), playerInk: hsl(28, 45, 15), water: hsl(200, 70, 50, 0.4), waterLine: hsl(200, 80, 35, 0.9), text: hsl(28, 45, 14), dim: hsl(28, 30, 32), hue: h,
    }),
  },
  {
    id: 'ship', emoji: '🚀', climb: 'ladder', mote: 'rockEdge', background: 'bulkhead', pattern: 'rivets', ambient: 'motes', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(215, 25, 11), bgBottom: hsl(215, 30, 19), rock: hsl(215, 12, 32), rockEdge: hsl(190, 85, 60), rockDeep: hsl(215, 15, 20),
      ink: hsl(200, 30, 78), accent: hsl(h, 90, 62), accentSoft: hsl(h, 90, 62, 0.3), hazard: hsl(10, 95, 58), hazardGlow: hsl(10, 95, 58, 0.35),
      player: hsl(40, 30, 96), playerInk: hsl(215, 30, 12), water: hsl(190, 80, 55, 0.3), waterLine: hsl(190, 90, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(205, 20, 70), hue: h,
    }),
  },
  {
    id: 'candy', emoji: '🍭', climb: 'rope', mote: 'accent', background: 'candyland', pattern: 'sprinkles', ambient: 'sprinkles', outline: 2, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(320, 70, 84), bgBottom: hsl(190, 70, 86), rock: hsl(25, 55, 55), rockEdge: hsl(330, 85, 86), rockDeep: hsl(20, 50, 38),
      ink: hsl(330, 45, 30), accent: hsl(h, 85, 58), accentSoft: hsl(h, 85, 58, 0.3), hazard: hsl(355, 85, 50), hazardGlow: hsl(355, 85, 50, 0.3),
      player: hsl(0, 0, 100), playerInk: hsl(330, 45, 25), water: hsl(300, 70, 60, 0.35), waterLine: hsl(300, 70, 40, 0.9), text: hsl(330, 45, 22), dim: hsl(330, 25, 40), hue: h,
    }),
  },
  {
    id: 'office', emoji: '💼', climb: 'ladder', mote: 'dim', background: 'blinds', pattern: 'ceiling', ambient: 'motes', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(210, 15, 80), bgBottom: hsl(210, 12, 66), rock: hsl(215, 10, 52), rockEdge: hsl(30, 35, 62), rockDeep: hsl(215, 10, 38),
      ink: hsl(215, 20, 18), accent: hsl(h, 70, 45), accentSoft: hsl(h, 70, 45, 0.3), hazard: hsl(355, 80, 48), hazardGlow: hsl(355, 80, 48, 0.3),
      player: hsl(45, 40, 97), playerInk: hsl(215, 20, 15), water: hsl(200, 70, 50, 0.35), waterLine: hsl(200, 70, 35, 0.9), text: hsl(215, 20, 14), dim: hsl(215, 15, 40), hue: h,
    }),
  },
  {
    id: 'matrix', emoji: '💾', climb: 'rope', mote: 'ink', background: 'code', pattern: 'circuit', ambient: 'code', outline: 0, glow: true, hollow: true,
    palette: h => ({
      bgTop: hsl(130, 40, 3), bgBottom: hsl(130, 50, 7), rock: hsl(130, 30, 7), rockEdge: hsl(125, 100, 50), rockDeep: hsl(130, 40, 13),
      ink: hsl(125, 90, 55), accent: hsl(90, 100, 70), accentSoft: hsl(90, 100, 70, 0.3), hazard: hsl(0, 100, 58), hazardGlow: hsl(0, 100, 58, 0.4),
      player: hsl(120, 30, 96), playerInk: hsl(130, 40, 8), water: hsl(125, 80, 45, 0.3), waterLine: hsl(125, 90, 75, 0.9), text: hsl(120, 80, 85), dim: hsl(125, 40, 55), hue: h,
    }),
  },
  {
    id: 'inferno', emoji: '🔥', climb: 'rope', mote: 'accent', background: 'lavafalls', pattern: 'magma', ambient: 'embers', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(355, 70, 8), bgBottom: hsl(10, 85, 22), rock: hsl(350, 25, 11), rockEdge: hsl(15, 100, 55), rockDeep: hsl(5, 90, 38),
      ink: hsl(30, 100, 62), accent: hsl(45, 100, 60), accentSoft: hsl(45, 100, 60, 0.3), hazard: hsl(280, 90, 65), hazardGlow: hsl(280, 90, 65, 0.4),
      player: hsl(40, 30, 96), playerInk: hsl(350, 40, 10), water: hsl(15, 100, 50, 0.5), waterLine: hsl(45, 100, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(15, 50, 70), hue: h,
    }),
  },
  {
    id: 'lunar', emoji: '🌙', climb: 'ladder', mote: 'text', background: 'moonscape', pattern: 'craters', ambient: 'stars', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(230, 30, 3), bgBottom: hsl(230, 25, 9), rock: hsl(220, 6, 52), rockEdge: hsl(220, 10, 80), rockDeep: hsl(220, 6, 36),
      ink: hsl(220, 15, 85), accent: hsl(h, 90, 62), accentSoft: hsl(h, 90, 62, 0.3), hazard: hsl(350, 90, 60), hazardGlow: hsl(350, 90, 60, 0.35),
      player: hsl(0, 0, 100), playerInk: hsl(230, 30, 10), water: hsl(200, 70, 55, 0.3), waterLine: hsl(200, 80, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(220, 10, 70), hue: h,
    }),
  },
  {
    id: 'harbor', emoji: '⚓', climb: 'rope', mote: 'text', background: 'seaside', pattern: 'planks', ambient: 'motes', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(200, 60, 66), bgBottom: hsl(35, 70, 82), rock: hsl(28, 40, 36), rockEdge: hsl(32, 45, 58), rockDeep: hsl(25, 40, 22),
      ink: hsl(215, 35, 18), accent: hsl(h, 75, 48), accentSoft: hsl(h, 75, 48, 0.3), hazard: hsl(355, 85, 48), hazardGlow: hsl(355, 85, 48, 0.3),
      player: hsl(45, 45, 97), playerInk: hsl(215, 35, 15), water: hsl(200, 75, 42, 0.45), waterLine: hsl(195, 80, 85, 0.9), text: hsl(215, 35, 14), dim: hsl(215, 20, 32), hue: h,
    }),
  },
  {
    id: 'haunted', emoji: '👻', climb: 'vine', mote: 'dim', background: 'graveyard', pattern: 'cracks', ambient: 'fog', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(265, 40, 8), bgBottom: hsl(255, 30, 22), rock: hsl(250, 10, 22), rockEdge: hsl(110, 25, 42), rockDeep: hsl(250, 12, 13),
      ink: hsl(260, 25, 78), accent: hsl(28, 95, 55), accentSoft: hsl(28, 95, 55, 0.3), hazard: hsl(130, 90, 55), hazardGlow: hsl(130, 90, 55, 0.35),
      player: hsl(50, 30, 95), playerInk: hsl(260, 40, 10), water: hsl(150, 50, 35, 0.4), waterLine: hsl(150, 60, 70, 0.9), text: hsl(0, 0, 97), dim: hsl(260, 20, 72), hue: h,
    }),
  },
  {
    id: 'synthwave', emoji: '🌆', climb: 'rope', mote: 'rockEdge', background: 'retro', pattern: 'scanlines', ambient: 'stars', outline: 0, glow: true, hollow: true,
    palette: h => ({
      bgTop: hsl(260, 60, 8), bgBottom: hsl(320, 70, 24), rock: hsl(270, 50, 10), rockEdge: hsl(310, 100, 65), rockDeep: hsl(270, 60, 22),
      ink: hsl(185, 100, 65), accent: hsl(45, 100, 62), accentSoft: hsl(45, 100, 62, 0.3), hazard: hsl(355, 100, 62), hazardGlow: hsl(355, 100, 62, 0.4),
      player: hsl(185, 40, 96), playerInk: hsl(270, 60, 10), water: hsl(185, 90, 55, 0.3), waterLine: hsl(185, 100, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(300, 40, 75), hue: h,
    }),
  },
  {
    id: 'factory', emoji: '🏭', climb: 'ladder', mote: 'accent', background: 'industry', pattern: 'grating', ambient: 'sparks', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(30, 15, 22), bgBottom: hsl(25, 30, 40), rock: hsl(30, 8, 30), rockEdge: hsl(45, 90, 52), rockDeep: hsl(30, 10, 18),
      ink: hsl(35, 15, 82), accent: hsl(30, 100, 58), accentSoft: hsl(30, 100, 58, 0.3), hazard: hsl(355, 90, 55), hazardGlow: hsl(355, 90, 55, 0.35),
      player: hsl(200, 30, 95), playerInk: hsl(30, 20, 12), water: hsl(90, 50, 35, 0.45), waterLine: hsl(90, 60, 65, 0.9), text: hsl(0, 0, 97), dim: hsl(35, 15, 70), hue: h,
    }),
  },
  {
    id: 'mushroom', emoji: '🍄', climb: 'vine', mote: 'accent', background: 'glowwood', pattern: 'moss', ambient: 'spores', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(240, 45, 7), bgBottom: hsl(200, 45, 16), rock: hsl(270, 20, 18), rockEdge: hsl(170, 80, 55), rockDeep: hsl(270, 20, 11),
      ink: hsl(170, 70, 65), accent: hsl(h, 95, 65), accentSoft: hsl(h, 95, 65, 0.3), hazard: hsl(350, 95, 60), hazardGlow: hsl(350, 95, 60, 0.35),
      player: hsl(60, 30, 96), playerInk: hsl(260, 40, 10), water: hsl(190, 80, 50, 0.35), waterLine: hsl(190, 90, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(200, 25, 72), hue: h,
    }),
  },
  {
    id: 'sky', emoji: '☁️', climb: 'rope', mote: 'text', background: 'skyland', pattern: 'cloudy', ambient: 'motes', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(205, 85, 62), bgBottom: hsl(195, 70, 88), rock: hsl(210, 40, 96), rockEdge: hsl(0, 0, 100), rockDeep: hsl(210, 35, 82),
      ink: hsl(215, 40, 32), accent: hsl(h, 85, 55), accentSoft: hsl(h, 85, 55, 0.3), hazard: hsl(355, 85, 50), hazardGlow: hsl(355, 85, 50, 0.3),
      player: hsl(45, 90, 60), playerInk: hsl(215, 45, 18), water: hsl(205, 80, 55, 0.35), waterLine: hsl(205, 80, 40, 0.9), text: hsl(215, 45, 18), dim: hsl(215, 25, 40), hue: h,
    }),
  },
];

export function themeFor(level) {
  return THEMES[(level.theme ?? 0) % THEMES.length];
}
