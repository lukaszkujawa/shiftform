const hsl = (h, s, l, a = 1) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;

export const alpha = (color, a) => color.replace(/\/ [\d.]+\)$/, `/ ${a})`);

const withDerivedColors = ({ glowAlpha = 0.35, palette, ...theme }) => ({
  ...theme,
  palette: h => {
    const colors = palette(h);
    return { ...colors, accentSoft: alpha(colors.accent, 0.3), hazardGlow: alpha(colors.hazard, glowAlpha), hue: h };
  },
});

export const THEMES = [
  {
    id: 'neon', emoji: '💡', climb: 'rope', mote: 'text', background: 'grid', pattern: 'none', ambient: 'motes', outline: 0, glow: true, hollow: true,
    palette: h => ({
      bgTop: hsl(h, 40, 5), bgBottom: hsl(h + 30, 45, 10), rock: hsl(h, 35, 10), rockEdge: hsl(h + 180, 90, 65), rockDeep: hsl(h, 30, 16),
      ink: hsl(h + 180, 90, 65), accent: hsl(h + 120, 95, 65), hazard: hsl(345, 95, 62),
      player: hsl(h + 180, 30, 96), playerInk: hsl(h, 40, 12), water: hsl(190, 90, 55, 0.3), waterLine: hsl(190, 95, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 20, 70),
    }),
  },
  {
    id: 'paper', emoji: '📄', climb: 'ladder', mote: 'text', background: 'ruled', pattern: 'hatch', ambient: 'none', outline: 3, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(45, 45, 92), bgBottom: hsl(40, 40, 85), rock: hsl(h, 25, 78), rockEdge: hsl(h, 30, 60), rockDeep: hsl(h, 25, 45),
      ink: hsl(h, 35, 16), accent: hsl(h + 150, 70, 42), hazard: hsl(355, 80, 48),
      player: hsl(45, 50, 97), playerInk: hsl(h, 35, 16), water: hsl(205, 70, 55, 0.35), waterLine: hsl(205, 70, 35, 0.9), text: hsl(h, 35, 14), dim: hsl(h, 20, 40),
    }),
  },
  {
    id: 'crystal', emoji: '💎', climb: 'ladder', mote: 'accent', background: 'rays', pattern: 'facets', ambient: 'sparks', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(h, 50, 8), bgBottom: hsl(h + 40, 55, 18), rock: hsl(h, 45, 32), rockEdge: hsl(h, 60, 70), rockDeep: hsl(h, 45, 22),
      ink: hsl(h, 60, 70), accent: hsl(h + 180, 95, 68), hazard: hsl(350, 95, 60),
      player: hsl(h + 180, 40, 96), playerInk: hsl(h, 50, 15), water: hsl(h + 180, 80, 60, 0.3), waterLine: hsl(h + 180, 90, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 30, 75),
    }),
  },
  {
    id: 'ember', emoji: '🌋', climb: 'rope', mote: 'rockEdge', background: 'blobs', pattern: 'cracks', ambient: 'embers', outline: 0, glow: true, hollow: false, glowAlpha: 0.4,
    palette: h => ({
      bgTop: hsl(10, 45, 6), bgBottom: hsl(20, 60, 14), rock: hsl(15, 20, 16), rockEdge: hsl(25, 90, 55), rockDeep: hsl(20, 80, 40),
      ink: hsl(30, 90, 60), accent: hsl(45, 100, 60), hazard: hsl(0, 100, 62),
      player: hsl(40, 30, 95), playerInk: hsl(15, 40, 12), water: hsl(20, 100, 50, 0.45), waterLine: hsl(40, 100, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(25, 40, 70),
    }),
  },
  {
    id: 'frost', emoji: '❄️', climb: 'ladder', mote: 'text', background: 'mountains', pattern: 'frost', ambient: 'snow', outline: 2, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(210, 45, 18), bgBottom: hsl(200, 40, 40), rock: hsl(205, 35, 88), rockEdge: hsl(200, 60, 97), rockDeep: hsl(205, 30, 70),
      ink: hsl(210, 40, 45), accent: hsl(h + 200, 85, 55), hazard: hsl(345, 85, 55),
      player: hsl(35, 70, 60), playerInk: hsl(20, 50, 20), water: hsl(200, 80, 45, 0.4), waterLine: hsl(200, 80, 90, 0.9), text: hsl(0, 0, 98), dim: hsl(205, 30, 85),
    }),
  },
  {
    id: 'void', emoji: '🌌', climb: 'rope', mote: 'text', background: 'stars', pattern: 'dots', ambient: 'stars', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(h, 30, 3), bgBottom: hsl(h + 60, 35, 9), rock: hsl(h, 15, 20), rockEdge: hsl(h, 25, 45), rockDeep: hsl(h, 15, 12),
      ink: hsl(h, 25, 45), accent: hsl(h + 180, 90, 65), hazard: hsl(350, 90, 60),
      player: hsl(h + 180, 50, 95), playerInk: hsl(h, 30, 10), water: hsl(260, 80, 55, 0.3), waterLine: hsl(260, 90, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(h, 15, 65),
    }),
  },
  {
    id: 'jungle', emoji: '🌴', climb: 'vine', mote: 'accent', background: 'vines', pattern: 'moss', ambient: 'spores', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(150, 45, 7), bgBottom: hsl(130, 40, 16), rock: hsl(25, 25, 20), rockEdge: hsl(105, 55, 45), rockDeep: hsl(25, 25, 13),
      ink: hsl(105, 50, 58), accent: hsl(h, 85, 62), hazard: hsl(350, 90, 58),
      player: hsl(60, 30, 95), playerInk: hsl(140, 40, 12), water: hsl(170, 70, 40, 0.4), waterLine: hsl(170, 80, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(110, 20, 70),
    }),
  },
  {
    id: 'dunes', emoji: '🏜️', climb: 'ladder', mote: 'rockDeep', background: 'dunes', pattern: 'strata', ambient: 'dust', outline: 0, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(30, 70, 74), bgBottom: hsl(18, 65, 62), rock: hsl(32, 45, 55), rockEdge: hsl(40, 65, 76), rockDeep: hsl(26, 40, 40),
      ink: hsl(20, 45, 25), accent: hsl(h, 75, 38), hazard: hsl(355, 85, 45),
      player: hsl(45, 40, 97), playerInk: hsl(20, 45, 20), water: hsl(190, 70, 45, 0.45), waterLine: hsl(190, 80, 30, 0.9), text: hsl(20, 45, 15), dim: hsl(25, 30, 32),
    }),
  },
  {
    id: 'deep', emoji: '🐙', climb: 'vine', mote: 'waterLine', background: 'caustics', pattern: 'barnacles', ambient: 'bubbles', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(195, 70, 14), bgBottom: hsl(210, 70, 5), rock: hsl(200, 30, 18), rockEdge: hsl(175, 60, 50), rockDeep: hsl(200, 30, 11),
      ink: hsl(175, 60, 55), accent: hsl(h, 90, 65), hazard: hsl(350, 95, 60),
      player: hsl(180, 40, 96), playerInk: hsl(200, 50, 10), water: hsl(190, 90, 55, 0.3), waterLine: hsl(190, 95, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(190, 30, 70),
    }),
  },
  {
    id: 'blossom', emoji: '🌸', climb: 'vine', mote: 'rockEdge', background: 'hills', pattern: 'waves', ambient: 'petals', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(255, 30, 20), bgBottom: hsl(330, 40, 44), rock: hsl(20, 25, 28), rockEdge: hsl(340, 70, 80), rockDeep: hsl(20, 25, 19),
      ink: hsl(340, 60, 82), accent: hsl(h, 80, 65), hazard: hsl(0, 90, 55),
      player: hsl(40, 40, 96), playerInk: hsl(340, 40, 15), water: hsl(210, 70, 60, 0.35), waterLine: hsl(210, 80, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(330, 25, 80),
    }),
  },
  {
    id: 'city', emoji: '🏙️', climb: 'ladder', mote: 'dim', background: 'skyline', pattern: 'bricks', ambient: 'rain', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(250, 35, 12), bgBottom: hsl(15, 55, 36), rock: hsl(220, 8, 28), rockEdge: hsl(35, 20, 62), rockDeep: hsl(225, 12, 17),
      ink: hsl(40, 30, 82), accent: hsl(45, 95, 62), hazard: hsl(355, 90, 58),
      player: hsl(h, 40, 96), playerInk: hsl(225, 30, 12), water: hsl(200, 60, 50, 0.35), waterLine: hsl(200, 70, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(210, 30, 75),
    }),
  },
  {
    id: 'country', emoji: '🌻', climb: 'ladder', mote: 'accent', background: 'fields', pattern: 'turf', ambient: 'spores', outline: 0, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(200, 65, 62), bgBottom: hsl(55, 60, 84), rock: hsl(28, 40, 34), rockEdge: hsl(100, 55, 45), rockDeep: hsl(28, 40, 23),
      ink: hsl(28, 45, 16), accent: hsl(48, 95, 55), hazard: hsl(355, 85, 48),
      player: hsl(h, 45, 97), playerInk: hsl(28, 45, 15), water: hsl(200, 70, 50, 0.4), waterLine: hsl(200, 80, 35, 0.9), text: hsl(28, 45, 14), dim: hsl(28, 30, 32),
    }),
  },
  {
    id: 'ship', emoji: '🚀', climb: 'ladder', mote: 'rockEdge', background: 'bulkhead', pattern: 'rivets', ambient: 'motes', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(215, 25, 11), bgBottom: hsl(215, 30, 19), rock: hsl(215, 12, 32), rockEdge: hsl(190, 85, 60), rockDeep: hsl(215, 15, 20),
      ink: hsl(200, 30, 78), accent: hsl(h, 90, 62), hazard: hsl(10, 95, 58),
      player: hsl(40, 30, 96), playerInk: hsl(215, 30, 12), water: hsl(190, 80, 55, 0.3), waterLine: hsl(190, 90, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(205, 20, 70),
    }),
  },
  {
    id: 'candy', emoji: '🍭', climb: 'rope', mote: 'accent', background: 'candyland', pattern: 'sprinkles', ambient: 'sprinkles', outline: 2, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(320, 70, 84), bgBottom: hsl(190, 70, 86), rock: hsl(25, 55, 55), rockEdge: hsl(330, 85, 86), rockDeep: hsl(20, 50, 38),
      ink: hsl(330, 45, 30), accent: hsl(h, 85, 58), hazard: hsl(355, 85, 50),
      player: hsl(0, 0, 100), playerInk: hsl(330, 45, 25), water: hsl(300, 70, 60, 0.35), waterLine: hsl(300, 70, 40, 0.9), text: hsl(330, 45, 22), dim: hsl(330, 25, 40),
    }),
  },
  {
    id: 'office', emoji: '💼', climb: 'ladder', mote: 'dim', background: 'blinds', pattern: 'ceiling', ambient: 'motes', outline: 0, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(210, 15, 80), bgBottom: hsl(210, 12, 66), rock: hsl(215, 10, 52), rockEdge: hsl(30, 35, 62), rockDeep: hsl(215, 10, 38),
      ink: hsl(215, 20, 18), accent: hsl(h, 70, 45), hazard: hsl(355, 80, 48),
      player: hsl(45, 40, 97), playerInk: hsl(215, 20, 15), water: hsl(200, 70, 50, 0.35), waterLine: hsl(200, 70, 35, 0.9), text: hsl(215, 20, 14), dim: hsl(215, 15, 40),
    }),
  },
  {
    id: 'matrix', emoji: '💾', climb: 'rope', mote: 'ink', background: 'code', pattern: 'circuit', ambient: 'code', outline: 0, glow: true, hollow: true, glowAlpha: 0.4,
    palette: h => ({
      bgTop: hsl(130, 40, 3), bgBottom: hsl(130, 50, 7), rock: hsl(130, 30, 7), rockEdge: hsl(125, 100, 50), rockDeep: hsl(130, 40, 13),
      ink: hsl(125, 90, 55), accent: hsl(90, 100, 70), hazard: hsl(0, 100, 58),
      player: hsl(120, 30, 96), playerInk: hsl(130, 40, 8), water: hsl(125, 80, 45, 0.3), waterLine: hsl(125, 90, 75, 0.9), text: hsl(120, 80, 85), dim: hsl(125, 40, 55),
    }),
  },
  {
    id: 'inferno', emoji: '🔥', climb: 'rope', mote: 'accent', background: 'lavafalls', pattern: 'magma', ambient: 'embers', outline: 0, glow: true, hollow: false, glowAlpha: 0.4,
    palette: h => ({
      bgTop: hsl(355, 70, 8), bgBottom: hsl(10, 85, 22), rock: hsl(350, 25, 11), rockEdge: hsl(15, 100, 55), rockDeep: hsl(5, 90, 38),
      ink: hsl(30, 100, 62), accent: hsl(45, 100, 60), hazard: hsl(280, 90, 65),
      player: hsl(40, 30, 96), playerInk: hsl(350, 40, 10), water: hsl(15, 100, 50, 0.5), waterLine: hsl(45, 100, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(15, 50, 70),
    }),
  },
  {
    id: 'lunar', emoji: '🌙', climb: 'ladder', mote: 'text', background: 'moonscape', pattern: 'craters', ambient: 'stars', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(230, 30, 3), bgBottom: hsl(230, 25, 9), rock: hsl(220, 6, 52), rockEdge: hsl(220, 10, 80), rockDeep: hsl(220, 6, 36),
      ink: hsl(220, 15, 85), accent: hsl(h, 90, 62), hazard: hsl(350, 90, 60),
      player: hsl(0, 0, 100), playerInk: hsl(230, 30, 10), water: hsl(200, 70, 55, 0.3), waterLine: hsl(200, 80, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(220, 10, 70),
    }),
  },
  {
    id: 'harbor', emoji: '⚓', climb: 'rope', mote: 'text', background: 'seaside', pattern: 'planks', ambient: 'motes', outline: 0, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(200, 60, 66), bgBottom: hsl(35, 70, 82), rock: hsl(28, 40, 36), rockEdge: hsl(32, 45, 58), rockDeep: hsl(25, 40, 22),
      ink: hsl(215, 35, 18), accent: hsl(h, 75, 48), hazard: hsl(355, 85, 48),
      player: hsl(45, 45, 97), playerInk: hsl(215, 35, 15), water: hsl(200, 75, 42, 0.45), waterLine: hsl(195, 80, 85, 0.9), text: hsl(215, 35, 14), dim: hsl(215, 20, 32),
    }),
  },
  {
    id: 'haunted', emoji: '👻', climb: 'vine', mote: 'dim', background: 'graveyard', pattern: 'cracks', ambient: 'fog', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(265, 40, 8), bgBottom: hsl(255, 30, 22), rock: hsl(250, 10, 22), rockEdge: hsl(110, 25, 42), rockDeep: hsl(250, 12, 13),
      ink: hsl(260, 25, 78), accent: hsl(28, 95, 55), hazard: hsl(130, 90, 55),
      player: hsl(50, 30, 95), playerInk: hsl(260, 40, 10), water: hsl(150, 50, 35, 0.4), waterLine: hsl(150, 60, 70, 0.9), text: hsl(0, 0, 97), dim: hsl(260, 20, 72),
    }),
  },
  {
    id: 'synthwave', emoji: '🌆', climb: 'rope', mote: 'rockEdge', background: 'retro', pattern: 'scanlines', ambient: 'stars', outline: 0, glow: true, hollow: true, glowAlpha: 0.4,
    palette: h => ({
      bgTop: hsl(260, 60, 8), bgBottom: hsl(320, 70, 24), rock: hsl(270, 50, 10), rockEdge: hsl(310, 100, 65), rockDeep: hsl(270, 60, 22),
      ink: hsl(185, 100, 65), accent: hsl(45, 100, 62), hazard: hsl(355, 100, 62),
      player: hsl(185, 40, 96), playerInk: hsl(270, 60, 10), water: hsl(185, 90, 55, 0.3), waterLine: hsl(185, 100, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(300, 40, 75),
    }),
  },
  {
    id: 'factory', emoji: '🏭', climb: 'ladder', mote: 'accent', background: 'industry', pattern: 'grating', ambient: 'sparks', outline: 0, glow: false, hollow: false,
    palette: h => ({
      bgTop: hsl(30, 15, 22), bgBottom: hsl(25, 30, 40), rock: hsl(30, 8, 30), rockEdge: hsl(45, 90, 52), rockDeep: hsl(30, 10, 18),
      ink: hsl(35, 15, 82), accent: hsl(30, 100, 58), hazard: hsl(355, 90, 55),
      player: hsl(200, 30, 95), playerInk: hsl(30, 20, 12), water: hsl(90, 50, 35, 0.45), waterLine: hsl(90, 60, 65, 0.9), text: hsl(0, 0, 97), dim: hsl(35, 15, 70),
    }),
  },
  {
    id: 'mushroom', emoji: '🍄', climb: 'vine', mote: 'accent', background: 'glowwood', pattern: 'moss', ambient: 'spores', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(240, 45, 7), bgBottom: hsl(200, 45, 16), rock: hsl(270, 20, 18), rockEdge: hsl(170, 80, 55), rockDeep: hsl(270, 20, 11),
      ink: hsl(170, 70, 65), accent: hsl(h, 95, 65), hazard: hsl(350, 95, 60),
      player: hsl(60, 30, 96), playerInk: hsl(260, 40, 10), water: hsl(190, 80, 50, 0.35), waterLine: hsl(190, 90, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(200, 25, 72),
    }),
  },
  {
    id: 'sky', emoji: '☁️', climb: 'rope', mote: 'text', background: 'skyland', pattern: 'cloudy', ambient: 'motes', outline: 0, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(205, 85, 62), bgBottom: hsl(195, 70, 88), rock: hsl(210, 40, 96), rockEdge: hsl(0, 0, 100), rockDeep: hsl(210, 35, 82),
      ink: hsl(215, 40, 32), accent: hsl(h, 85, 55), hazard: hsl(355, 85, 50),
      player: hsl(45, 90, 60), playerInk: hsl(215, 45, 18), water: hsl(205, 80, 55, 0.35), waterLine: hsl(205, 80, 40, 0.9), text: hsl(215, 45, 18), dim: hsl(215, 25, 40),
    }),
  },
  {
    id: 'autumn', emoji: '🍂', climb: 'vine', mote: 'accent', background: 'woodland', pattern: 'bark', ambient: 'leaves', outline: 0, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(32, 60, 72), bgBottom: hsl(18, 55, 52), rock: hsl(24, 40, 32), rockEdge: hsl(28, 80, 56), rockDeep: hsl(20, 40, 20),
      ink: hsl(20, 45, 16), accent: hsl(h, 90, 55), hazard: hsl(355, 85, 50),
      player: hsl(45, 50, 97), playerInk: hsl(20, 45, 15), water: hsl(200, 60, 45, 0.4), waterLine: hsl(200, 70, 80, 0.9), text: hsl(20, 45, 14), dim: hsl(20, 30, 36),
    }),
  },
  {
    id: 'ruins', emoji: '🏛️', climb: 'vine', mote: 'rockEdge', background: 'colonnade', pattern: 'carved', ambient: 'motes', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(30, 30, 14), bgBottom: hsl(28, 40, 32), rock: hsl(38, 35, 52), rockEdge: hsl(40, 45, 72), rockDeep: hsl(34, 30, 36),
      ink: hsl(30, 40, 16), accent: hsl(18, 95, 58), hazard: hsl(130, 80, 48),
      player: hsl(45, 40, 97), playerInk: hsl(30, 40, 14), water: hsl(170, 50, 40, 0.4), waterLine: hsl(170, 60, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(35, 30, 70),
    }),
  },
  {
    id: 'hive', emoji: '🐝', climb: 'rope', mote: 'accent', background: 'honeycomb', pattern: 'hex', ambient: 'motes', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(40, 80, 38), bgBottom: hsl(28, 85, 26), rock: hsl(38, 70, 46), rockEdge: hsl(46, 95, 66), rockDeep: hsl(30, 65, 30),
      ink: hsl(25, 60, 14), accent: hsl(50, 100, 62), hazard: hsl(355, 90, 55),
      player: hsl(0, 0, 100), playerInk: hsl(25, 60, 12), water: hsl(40, 95, 50, 0.5), waterLine: hsl(45, 100, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(40, 40, 78),
    }),
  },
  {
    id: 'lab', emoji: '☣️', climb: 'ladder', mote: 'accent', background: 'vats', pattern: 'rivets', ambient: 'bubbles', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(150, 30, 7), bgBottom: hsl(140, 35, 15), rock: hsl(200, 10, 30), rockEdge: hsl(120, 90, 55), rockDeep: hsl(200, 12, 18),
      ink: hsl(120, 50, 82), accent: hsl(85, 100, 62), hazard: hsl(350, 95, 60),
      player: hsl(60, 30, 96), playerInk: hsl(200, 30, 10), water: hsl(110, 90, 45, 0.5), waterLine: hsl(100, 100, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(140, 20, 70),
    }),
  },
  {
    id: 'pirate', emoji: '🏴‍☠️', climb: 'rope', mote: 'text', background: 'cove', pattern: 'planks', ambient: 'motes', outline: 0, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(222, 45, 14), bgBottom: hsl(205, 55, 36), rock: hsl(28, 45, 30), rockEdge: hsl(35, 55, 50), rockDeep: hsl(25, 40, 18),
      ink: hsl(30, 30, 12), accent: hsl(45, 95, 58), hazard: hsl(355, 85, 52),
      player: hsl(45, 45, 97), playerInk: hsl(30, 30, 12), water: hsl(205, 70, 40, 0.45), waterLine: hsl(200, 80, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(210, 25, 72),
    }),
  },
  {
    id: 'cathedral', emoji: '⛪', climb: 'rope', mote: 'accent', background: 'stainedglass', pattern: 'masonry', ambient: 'motes', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(258, 30, 9), bgBottom: hsl(250, 25, 18), rock: hsl(230, 10, 44), rockEdge: hsl(230, 15, 70), rockDeep: hsl(230, 12, 28),
      ink: hsl(230, 20, 12), accent: hsl(45, 90, 62), hazard: hsl(355, 90, 58),
      player: hsl(0, 0, 100), playerInk: hsl(230, 30, 10), water: hsl(200, 60, 50, 0.35), waterLine: hsl(200, 70, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(240, 15, 72),
    }),
  },
  {
    id: 'savanna', emoji: '🦒', climb: 'vine', mote: 'accent', background: 'goldenhour', pattern: 'cracks', ambient: 'dust', outline: 0, glow: false, hollow: false, glowAlpha: 0.3,
    palette: h => ({
      bgTop: hsl(345, 45, 26), bgBottom: hsl(28, 90, 52), rock: hsl(22, 42, 22), rockEdge: hsl(44, 62, 52), rockDeep: hsl(18, 40, 12),
      ink: hsl(15, 45, 9), accent: hsl(48, 100, 62), hazard: hsl(355, 80, 52),
      player: hsl(45, 55, 96), playerInk: hsl(15, 45, 9), water: hsl(195, 55, 40, 0.4), waterLine: hsl(45, 90, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(35, 45, 78),
    }),
  },
  {
    id: 'bayou', emoji: '🐊', climb: 'vine', mote: 'accent', background: 'swamp', pattern: 'moss', ambient: 'spores', outline: 0, glow: true, hollow: false, glowAlpha: 0.4,
    palette: h => ({
      bgTop: hsl(185, 35, 6), bgBottom: hsl(165, 30, 17), rock: hsl(105, 22, 19), rockEdge: hsl(88, 45, 42), rockDeep: hsl(130, 25, 10),
      ink: hsl(170, 40, 5), accent: hsl(64, 100, 62), hazard: hsl(350, 80, 56),
      player: hsl(80, 35, 96), playerInk: hsl(170, 40, 6), water: hsl(170, 45, 28, 0.5), waterLine: hsl(150, 60, 70, 0.8), text: hsl(0, 0, 96), dim: hsl(150, 22, 68),
    }),
  },
  {
    id: 'carnival', emoji: '🎡', climb: 'rope', mote: 'accent', background: 'fairground', pattern: 'stripes', ambient: 'sprinkles', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(262, 45, 12), bgBottom: hsl(332, 60, 34), rock: hsl(h, 50, 38), rockEdge: hsl(45, 90, 72), rockDeep: hsl(h, 50, 24),
      ink: hsl(265, 45, 8), accent: hsl(48, 100, 62), hazard: hsl(352, 90, 58),
      player: hsl(45, 60, 97), playerInk: hsl(265, 45, 10), water: hsl(190, 80, 50, 0.4), waterLine: hsl(190, 90, 85, 0.9), text: hsl(0, 0, 97), dim: hsl(300, 25, 78),
    }),
  },
  {
    id: 'lantern', emoji: '🏮', climb: 'rope', mote: 'accent', background: 'lanternfest', pattern: 'kawara', ambient: 'lanterns', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(236, 50, 7), bgBottom: hsl(252, 40, 22), rock: hsl(225, 22, 24), rockEdge: hsl(36, 70, 58), rockDeep: hsl(230, 25, 14),
      ink: hsl(235, 45, 6), accent: hsl(32, 100, 60), hazard: hsl(350, 90, 58),
      player: hsl(40, 40, 97), playerInk: hsl(235, 45, 8), water: hsl(215, 60, 40, 0.4), waterLine: hsl(40, 80, 80, 0.9), text: hsl(0, 0, 97), dim: hsl(240, 25, 72),
    }),
  },
  {
    id: 'library', emoji: '📚', climb: 'ladder', mote: 'accent', background: 'library', pattern: 'spines', ambient: 'motes', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(20, 40, 6), bgBottom: hsl(24, 45, 13), rock: hsl(24, 38, 32), rockEdge: hsl(40, 62, 60), rockDeep: hsl(20, 40, 18),
      ink: hsl(36, 45, 68), accent: hsl(42, 95, 62), hazard: hsl(355, 80, 54),
      player: hsl(40, 50, 96), playerInk: hsl(22, 40, 12), water: hsl(250, 50, 40, 0.5), waterLine: hsl(260, 60, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(35, 30, 72),
    }),
  },
  {
    id: 'mine', emoji: '⛏️', climb: 'rope', mote: 'accent', background: 'mine', pattern: 'ore', ambient: 'dust', outline: 0, glow: true, hollow: false,
    palette: h => ({
      bgTop: hsl(225, 18, 5), bgBottom: hsl(222, 16, 12), rock: hsl(215, 12, 30), rockEdge: hsl(205, 25, 60), rockDeep: hsl(220, 15, 16),
      ink: hsl(32, 32, 66), accent: hsl(38, 100, 58), hazard: hsl(2, 85, 56),
      player: hsl(45, 40, 96), playerInk: hsl(222, 25, 10), water: hsl(190, 60, 38, 0.5), waterLine: hsl(185, 70, 75, 0.9), text: hsl(0, 0, 97), dim: hsl(215, 15, 72),
    }),
  },
].map(withDerivedColors);

export function themeFor(level) {
  return THEMES[(level.theme ?? 0) % THEMES.length];
}
