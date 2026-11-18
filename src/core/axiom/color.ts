export default class AxiomColor {
  //RGB To ->
  static rgbToHex([r, g, b]: RGB): string {
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  static randomRGBA(): RGBA {
    return [
      Math.random() * 255 + 1,
      Math.random() * 255 + 1,
      Math.random() * 255 + 1,
      Math.random() * 255 + 1,
    ];
  }
  static randomRGB(): RGB {
    return [
      Math.random() * 255 + 1,
      Math.random() * 255 + 1,
      Math.random() * 255 + 1,
    ];
  }
  // per channel on the stored values (srgb 0-255), no rounding
  static lerpRGBA(from: Readonly<RGBA>, to: Readonly<RGBA>, t: number): RGBA {
    return [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
      from[3] + (to[3] - from[3]) * t,
    ];
  }
  // one channel: srgb 0-255 → linear 0-1, what the GPU blends and the shaders work in
  static srgbToLinear(channel: number): number {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }
  // one channel: linear 0-1 → srgb 0-255, no rounding
  static linearToSrgb(channel: number): number {
    const value = Math.min(Math.max(channel, 0), 1);
    return 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055);
  }
  // a palette color (COLOR.*) with another alpha, 0-255
  static withAlpha(color: Readonly<RGBA>, alpha: number): RGBA {
    return [color[0], color[1], color[2], alpha];
  }
  static rgbaToHex([r, g, b, a]: RGBA): string {
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a * 255)}`;
  }
  static rgbToHsl([r, g, b]: RGB): HSL {
    const rn = r / 255,
      gn = g / 255,
      bn = b / 255;
    const max = Math.max(rn, gn, bn),
      min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;

    if (max === min) return [0, 0, l * 100];

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    return [h * 60, s * 100, l * 100];
  }
  static rgbaToHsla([r, g, b, a]: RGBA): HSLA {
    const [h, s, l] = AxiomColor.rgbToHsl([r, g, b]);
    return [h, s, l, a];
  }
  //HEX TO ->
  static hexToRgb(hex: string): RGB {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }

  static hexToRgba(hex: string): RGBA {
    const clean = hex.replace("#", "");
    const [r, g, b] = AxiomColor.hexToRgb(hex);
    const a = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1;
    return [r, g, b, a];
  }
  static hexToHsl(hex: string): HSL {
    const [r, g, b] = AxiomColor.hexToRgb(hex);
    return AxiomColor.rgbToHsl([r, g, b]);
  }

  static hexToHsla(hex: string): HSLA {
    const [r, g, b, a] = AxiomColor.hexToRgba(hex);
    const [h, s, l] = AxiomColor.rgbToHsl([r, g, b]);
    return [h, s, l, a];
  }
  //HSL TO ->
  static hslToRgb([h, s, l]: HSL): RGB {
    const hn = h / 360,
      sn = s / 100,
      ln = l / 100;

    if (sn === 0) {
      const v = Math.round(ln * 255);
      return [v, v, v];
    }

    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
    const p = 2 * ln - q;
    const r = this.hue2rgb(p, q, hn + 1 / 3);
    const g = this.hue2rgb(p, q, hn);
    const b = this.hue2rgb(p, q, hn - 1 / 3);

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  static hslaToRgba([h, s, l, a]: HSLA): RGBA {
    const [r, g, b] = AxiomColor.hslToRgb([h, s, l]);
    return [r, g, b, a];
  }
  static hslToHex([h, s, l]: HSL): string {
    const [r, g, b] = AxiomColor.hslToRgb([h, s, l]);
    return AxiomColor.rgbToHex([r, g, b]);
  }

  static hslaToHex([h, s, l, a]: HSLA): string {
    const [r, g, b] = AxiomColor.hslToRgb([h, s, l]);
    return AxiomColor.rgbaToHex([r, g, b, a]);
  }
  private static hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
}
const rgba = (r: number, g: number, b: number, a = 255) =>
  Object.freeze([r, g, b, a]) as RGBA;

export const COLOR = {
  // neutral
  TRANSPARENT: rgba(0, 0, 0, 0),
  WHITE: rgba(255, 255, 255),
  SNOW: rgba(255, 250, 250),
  IVORY: rgba(255, 255, 240),
  SILVER: rgba(192, 192, 192),
  LIGHT_GRAY: rgba(211, 211, 211),
  GRAY: rgba(128, 128, 128),
  DARK_GRAY: rgba(64, 64, 64),
  CHARCOAL: rgba(36, 36, 36),
  BLACK: rgba(0, 0, 0),

  // red and pink
  RED: rgba(255, 0, 0),
  DARK_RED: rgba(139, 0, 0),
  CRIMSON: rgba(220, 20, 60),
  MAROON: rgba(128, 0, 0),
  SALMON: rgba(250, 128, 114),
  CORAL: rgba(255, 127, 80),
  TOMATO: rgba(255, 99, 71),
  PINK: rgba(255, 192, 203),
  HOT_PINK: rgba(255, 105, 180),
  DEEP_PINK: rgba(255, 20, 147),

  // orange and brown
  ORANGE: rgba(255, 165, 0),
  DARK_ORANGE: rgba(255, 140, 0),
  AMBER: rgba(255, 191, 0),
  PEACH: rgba(255, 218, 185),
  BROWN: rgba(139, 69, 19),
  CHOCOLATE: rgba(210, 105, 30),
  TAN: rgba(210, 180, 140),
  BEIGE: rgba(245, 245, 220),

  // yellow
  YELLOW: rgba(255, 255, 0),
  GOLD: rgba(255, 215, 0),
  LEMON: rgba(255, 250, 205),
  KHAKI: rgba(240, 230, 140),
  OLIVE: rgba(128, 128, 0),

  // green
  GREEN: rgba(0, 255, 0),
  DARK_GREEN: rgba(0, 100, 0),
  FOREST_GREEN: rgba(34, 139, 34),
  LIME: rgba(50, 205, 50),
  MINT: rgba(152, 255, 152),
  SEA_GREEN: rgba(46, 139, 87),
  EMERALD: rgba(80, 200, 120),
  TEAL: rgba(0, 128, 128),

  // cyan and blue
  CYAN: rgba(0, 255, 255),
  TURQUOISE: rgba(64, 224, 208),
  AQUAMARINE: rgba(127, 255, 212),
  SKY_BLUE: rgba(135, 206, 235),
  LIGHT_BLUE: rgba(173, 216, 230),
  BLUE: rgba(0, 0, 255),
  ROYAL_BLUE: rgba(65, 105, 225),
  DODGER_BLUE: rgba(30, 144, 255),
  STEEL_BLUE: rgba(70, 130, 180),
  NAVY: rgba(0, 0, 128),
  MIDNIGHT_BLUE: rgba(25, 25, 112),

  // purple
  PURPLE: rgba(128, 0, 128),
  VIOLET: rgba(238, 130, 238),
  INDIGO: rgba(75, 0, 130),
  LAVENDER: rgba(230, 230, 250),
  PLUM: rgba(221, 160, 221),
  ORCHID: rgba(218, 112, 214),
  MAGENTA: rgba(255, 0, 255),
} as const;

// ready moods: each one has its own backgrounds, surfaces, text and accents, nothing to mix in from outside
export const PALETTE = {
  // stone, wood, metal and lamplight; text: BONE, muted: ASH
  MINE: {
    SOOT: rgba(26, 22, 19),
    COAL: rgba(38, 34, 32),
    SLATE: rgba(74, 72, 70),
    GRANITE: rgba(120, 114, 106),
    LIMESTONE: rgba(176, 168, 152),
    EBONY: rgba(54, 46, 39),
    WALNUT: rgba(84, 64, 44),
    OAK: rgba(120, 96, 70),
    PINE: rgba(170, 130, 85),
    IRON: rgba(78, 74, 70),
    STEEL: rgba(140, 144, 148),
    BRONZE: rgba(122, 84, 40),
    COPPER: rgba(176, 98, 52),
    BRASS: rgba(214, 168, 92),
    GOLD: rgba(232, 186, 72),
    LAMPLIGHT: rgba(255, 176, 80),
    EMBER: rgba(230, 110, 40),
    RUST: rgba(204, 92, 64),
    BONE: rgba(232, 220, 196),
    ASH: rgba(160, 146, 124),
  },
  // cold metals, the void and glows; text: STARLIGHT, muted: TITANIUM
  SPACE: {
    VOID: rgba(8, 10, 18),
    DEEP_SPACE: rgba(16, 20, 34),
    HULL: rgba(30, 36, 46),
    GUNMETAL: rgba(52, 60, 72),
    ALUMINIUM: rgba(96, 106, 120),
    TITANIUM: rgba(140, 150, 162),
    CHROME: rgba(200, 208, 218),
    STARLIGHT: rgba(240, 244, 255),
    ICE: rgba(170, 210, 235),
    PLASMA: rgba(80, 200, 255),
    ION: rgba(90, 255, 200),
    NEBULA: rgba(120, 80, 200),
    AURORA: rgba(200, 110, 230),
    HAZARD: rgba(255, 170, 40),
    ALERT: rgba(240, 70, 70),
  },
  // muted and dark, few accents; text: PALLOR, muted: FOG
  HORROR: {
    PITCH: rgba(10, 9, 10),
    GRAVE: rgba(24, 22, 24),
    ROT: rgba(40, 34, 28),
    MOSS: rgba(52, 58, 40),
    BRUISE: rgba(58, 44, 58),
    MILDEW: rgba(82, 88, 72),
    FOG: rgba(110, 112, 112),
    PALLOR: rgba(176, 174, 162),
    YELLOWED_BONE: rgba(190, 180, 150),
    DRIED_BLOOD: rgba(80, 18, 18),
    BLOOD: rgba(150, 20, 24),
    CANDLE: rgba(230, 170, 90),
    SICKLY: rgba(150, 170, 80),
    ECTO: rgba(140, 220, 190),
  },
  // moonlit blues and lanterns; text: MOONLIGHT, muted: MIST
  NIGHT: {
    MIDNIGHT: rgba(8, 12, 24),
    DUSK: rgba(20, 26, 48),
    SHADOW: rgba(34, 42, 70),
    TWILIGHT: rgba(56, 64, 104),
    SLATE_BLUE: rgba(86, 98, 140),
    MIST: rgba(140, 152, 184),
    MOONLIGHT: rgba(220, 228, 245),
    STAR: rgba(250, 248, 230),
    LANTERN: rgba(255, 196, 90),
    FIREFLY: rgba(200, 240, 110),
    AMETHYST: rgba(150, 110, 210),
    EMBER: rgba(220, 90, 60),
  },
  // greens, bark and soil; text: MIST, muted: LICHEN
  FOREST: {
    UNDERGROWTH: rgba(20, 30, 20),
    SHADE: rgba(30, 44, 32),
    PINE_NEEDLE: rgba(34, 64, 40),
    FERN: rgba(70, 120, 60),
    LEAF: rgba(110, 160, 70),
    LICHEN: rgba(160, 180, 120),
    MIST: rgba(226, 232, 214),
    BARK: rgba(70, 52, 38),
    SOIL: rgba(100, 74, 50),
    MUSHROOM: rgba(200, 170, 130),
    BERRY: rgba(150, 40, 60),
    SUNBEAM: rgba(240, 220, 140),
  },
  // sand, rock and sun; text: BLEACHED, muted: DUNE
  DESERT: {
    NIGHT_SAND: rgba(40, 30, 30),
    DUSKY_ROCK: rgba(72, 50, 42),
    CANYON: rgba(150, 70, 40),
    TERRACOTTA: rgba(190, 100, 60),
    DUNE: rgba(220, 170, 110),
    SAND: rgba(236, 206, 150),
    BLEACHED: rgba(245, 236, 214),
    SAGE: rgba(140, 150, 110),
    CACTUS: rgba(80, 120, 70),
    TURQUOISE_STONE: rgba(70, 170, 160),
    SUN: rgba(255, 200, 80),
    BLOOD_RED: rgba(170, 40, 30),
  },
  // depths, waves and foam; text: FOAM, muted: SHALLOWS
  OCEAN: {
    ABYSS: rgba(6, 16, 30),
    DEEP: rgba(14, 40, 70),
    TIDE: rgba(30, 80, 120),
    WAVE: rgba(50, 130, 170),
    LAGOON: rgba(60, 180, 180),
    SHALLOWS: rgba(130, 210, 210),
    FOAM: rgba(230, 245, 245),
    PEARL: rgba(235, 228, 220),
    KELP: rgba(60, 90, 50),
    SAND: rgba(220, 200, 150),
    CORAL: rgba(240, 120, 100),
    URCHIN: rgba(110, 50, 110),
  },
  // dark base, loud accents; text: GLOW_WHITE, muted: HAZE
  NEON: {
    BACKDROP: rgba(12, 10, 20),
    GRID: rgba(30, 24, 50),
    ASPHALT: rgba(44, 44, 56),
    HAZE: rgba(150, 150, 180),
    GLOW_WHITE: rgba(240, 240, 255),
    NEON_PINK: rgba(255, 40, 160),
    NEON_CYAN: rgba(0, 240, 255),
    NEON_GREEN: rgba(60, 255, 120),
    NEON_YELLOW: rgba(255, 240, 60),
    NEON_PURPLE: rgba(170, 60, 255),
    HOT_ORANGE: rgba(255, 110, 30),
  },
  // light and soft, text goes dark; text: INK, muted: GRAPHITE
  PASTEL: {
    CREAM: rgba(255, 248, 231),
    CLOUD: rgba(235, 235, 240),
    BLUSH: rgba(248, 200, 200),
    PEACH: rgba(255, 214, 180),
    BUTTER: rgba(255, 240, 170),
    MINT: rgba(190, 235, 200),
    SKY: rgba(190, 220, 245),
    LAVENDER: rgba(210, 195, 240),
    LILAC: rgba(230, 200, 230),
    BERRY: rgba(200, 90, 120),
    GRAPHITE: rgba(130, 130, 150),
    INK: rgba(70, 70, 90),
  },
  // obsidian, ash and glowing lava; text: PALE_ASH, muted: PUMICE
  VOLCANO: {
    OBSIDIAN: rgba(14, 10, 12),
    BASALT: rgba(34, 28, 28),
    SCORIA: rgba(58, 40, 36),
    ASH_GRAY: rgba(96, 90, 88),
    PUMICE: rgba(150, 140, 132),
    PALE_ASH: rgba(236, 226, 214),
    MAGMA: rgba(200, 50, 20),
    LAVA: rgba(255, 100, 30),
    FLAME: rgba(255, 160, 50),
    SULFUR: rgba(230, 210, 70),
    GLOW: rgba(255, 220, 150),
  },
  // glaciers, snow and polar lights; text: SNOW, muted: FROST
  ICE: {
    POLAR_NIGHT: rgba(10, 18, 34),
    GLACIER_DEEP: rgba(16, 34, 52),
    FROZEN_ROCK: rgba(40, 52, 64),
    SLUSH: rgba(70, 90, 108),
    ICE_BLUE: rgba(120, 170, 210),
    FROST: rgba(180, 215, 235),
    SNOW: rgba(245, 250, 255),
    AURORA_GREEN: rgba(90, 230, 160),
    AURORA_VIOLET: rgba(160, 120, 230),
    FROSTBITE: rgba(210, 60, 80),
  },
  // wet stone, chains and torches; text: PARCHMENT, muted: DUST
  DUNGEON: {
    CELL: rgba(14, 12, 12),
    DAMP_STONE: rgba(36, 36, 38),
    COBBLE: rgba(64, 62, 60),
    CHAIN: rgba(90, 92, 96),
    MORTAR: rgba(110, 104, 96),
    DUST: rgba(160, 150, 136),
    PARCHMENT: rgba(226, 212, 180),
    MOSS: rgba(60, 80, 40),
    TORCHLIGHT: rgba(255, 170, 70),
    FLAME: rgba(230, 100, 30),
    OLD_BLOOD: rgba(110, 24, 20),
  },
  // mud, reeds and marsh lights; text: PALE_REED, muted: SEDGE
  SWAMP: {
    BOG: rgba(16, 20, 14),
    MUCK: rgba(36, 38, 24),
    MURK: rgba(52, 60, 40),
    MURKY_WATER: rgba(60, 80, 70),
    ROTWOOD: rgba(70, 56, 40),
    REED: rgba(110, 110, 60),
    ALGAE: rgba(90, 130, 50),
    DUCKWEED: rgba(150, 180, 60),
    SEDGE: rgba(150, 154, 120),
    PALE_REED: rgba(220, 226, 190),
    MARSH_GAS: rgba(200, 220, 120),
    WILL_O_WISP: rgba(170, 240, 210),
    LEECH: rgba(140, 40, 40),
  },
  // fallen leaves, pumpkins and fog; text: WHEAT, muted: FOG
  AUTUMN: {
    DAMP_BARK: rgba(34, 24, 20),
    HUMUS: rgba(58, 40, 30),
    CHESTNUT: rgba(110, 56, 34),
    OLIVE_LEAF: rgba(120, 120, 60),
    RUST_LEAF: rgba(180, 70, 30),
    MAPLE: rgba(200, 50, 30),
    PUMPKIN: rgba(230, 120, 40),
    CIDER: rgba(200, 140, 70),
    AMBER_LEAF: rgba(240, 170, 60),
    FOG: rgba(180, 176, 168),
    WHEAT: rgba(245, 230, 200),
  },
  // evening sky from violet to gold; text: GLOW, muted: LILAC_HAZE
  SUNSET: {
    SILHOUETTE: rgba(12, 8, 20),
    DUSK_SKY: rgba(30, 20, 50),
    EVENING: rgba(60, 36, 80),
    VIOLET: rgba(110, 60, 130),
    ROSE: rgba(200, 90, 130),
    CORAL: rgba(240, 120, 100),
    PEACH: rgba(255, 170, 120),
    GOLD: rgba(255, 205, 110),
    LILAC_HAZE: rgba(190, 160, 200),
    GLOW: rgba(255, 235, 190),
    CRIMSON_SUN: rgba(200, 40, 60),
  },
  // velvet, gold and gems; text: IVORY, muted: SILVER
  ROYAL: {
    VELVET_NIGHT: rgba(18, 10, 24),
    DEEP_PURPLE: rgba(44, 20, 60),
    PURPLE: rgba(90, 40, 120),
    AMETHYST: rgba(140, 80, 180),
    WINE: rgba(100, 20, 40),
    CRIMSON: rgba(170, 30, 50),
    SAPPHIRE: rgba(40, 70, 160),
    EMERALD: rgba(30, 120, 80),
    GOLD: rgba(220, 180, 70),
    GILT: rgba(245, 215, 120),
    SILVER: rgba(180, 176, 190),
    IVORY: rgba(248, 240, 220),
  },
  // leather, brass and steam; text: PAPER, muted: PEWTER
  STEAMPUNK: {
    GREASE: rgba(20, 16, 14),
    LEATHER_DARK: rgba(54, 36, 26),
    GRAPHITE: rgba(60, 62, 66),
    MAHOGANY: rgba(90, 40, 30),
    LEATHER: rgba(110, 70, 44),
    PEWTER: rgba(130, 130, 126),
    COPPER: rgba(180, 100, 60),
    BRASS: rgba(200, 160, 80),
    VERDIGRIS: rgba(80, 160, 140),
    STEAM: rgba(210, 214, 214),
    PAPER: rgba(240, 230, 210),
    GAUGE_RED: rgba(190, 50, 40),
  },
  // old console, 16 flat colors; text: WHITE, muted: LIGHT_GRAY
  RETRO: {
    BLACK: rgba(0, 0, 0),
    NAVY: rgba(29, 43, 83),
    PLUM: rgba(126, 37, 83),
    FOREST: rgba(0, 135, 81),
    BROWN: rgba(171, 82, 54),
    DARK_GRAY: rgba(95, 87, 79),
    LIGHT_GRAY: rgba(194, 195, 199),
    WHITE: rgba(255, 241, 232),
    RED: rgba(255, 0, 77),
    ORANGE: rgba(255, 163, 0),
    YELLOW: rgba(255, 236, 39),
    GREEN: rgba(0, 228, 54),
    BLUE: rgba(41, 173, 255),
    LAVENDER: rgba(131, 118, 156),
    PINK: rgba(255, 119, 168),
    PEACH: rgba(255, 204, 170),
  },
  // grays with one signal accent, noir; text: PAPER, muted: STEEL
  MONO: {
    INK: rgba(10, 10, 12),
    CHARCOAL: rgba(28, 28, 32),
    GRAPHITE: rgba(52, 52, 58),
    SMOKE: rgba(90, 90, 98),
    STEEL: rgba(130, 130, 138),
    SILVER: rgba(176, 176, 184),
    PAPER: rgba(236, 236, 240),
    WHITE: rgba(252, 252, 255),
    SIGNAL_RED: rgba(220, 40, 50),
  },
  // concrete, barrels and contamination; text: CHALK, muted: DUST
  TOXIC: {
    BUNKER: rgba(16, 18, 14),
    GRIME: rgba(50, 48, 30),
    CONCRETE: rgba(60, 62, 58),
    CRACKED_CONCRETE: rgba(100, 102, 96),
    DUST: rgba(156, 158, 146),
    CHALK: rgba(230, 232, 220),
    SLUDGE: rgba(90, 120, 30),
    RUSTED_BARREL: rgba(140, 70, 30),
    TOXIC_GREEN: rgba(120, 230, 40),
    RADIUM: rgba(180, 255, 90),
    ACID: rgba(210, 255, 60),
    HAZMAT_YELLOW: rgba(240, 200, 30),
    WARNING_RED: rgba(220, 50, 30),
  },
} as const;
