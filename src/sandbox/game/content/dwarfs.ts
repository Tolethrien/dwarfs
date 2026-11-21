import AxiomMath from "@axiom/math";
import type { SpriteLayer } from "../components/common/layeredSprite";

export enum DwarfRank {
  worker,
  foreman,
}

interface LookLayer {
  row: number;
  variants: number;
  tints?: readonly RGBA[];
}

export const DWARF_LOOK: { cell: number; layers: Record<string, LookLayer> } = {
  cell: 96,
  layers: {
    body: { row: 0, variants: 7 },
    armor: { row: 1, variants: 12 },
    beard: {
      row: 2,
      variants: 4,
      tints: [
        [255, 255, 255, 255], // white
        [175, 170, 165, 255], // ash
        [240, 210, 140, 255], // light blond
        [225, 175, 85, 255], // golden
        [215, 110, 50, 255], // ginger
        [185, 80, 40, 255], // copper
        [150, 80, 45, 255], // auburn
        [115, 72, 45, 255], // brown
        [78, 55, 40, 255], // dark brown
        [55, 50, 50, 255], // black
      ],
    },
    hands: { row: 3, variants: 2 },
    helmet: { row: 4, variants: 2 },
  },
};

export const DWARF_NAMES = {
  first: [
    "Borin",
    "Durgan",
    "Brokk",
    "Hrodgar",
    "Tormund",
    "Baldrik",
    "Gundar",
    "Orvik",
    "Kragg",
    "Rurik",
    "Haldor",
    "Thorgrim",
    "Morgrim",
    "Ulfgar",
    "Belgor",
    "Fargrim",
    "Grunni",
    "Harbek",
    "Jorund",
    "Kildrak",
    "Magni",
    "Nordak",
    "Ozrik",
    "Skaldi",
    "Torvik",
    "Vigdor",
    "Zbrog",
    "Gorm",
    "Snorri",
    "Eitri",
  ],
  last: [
    "Ironbeard",
    "Hammerhand",
    "Stonefist",
    "Alebelly",
    "Pickheft",
    "Granitejaw",
    "Copperbeard",
    "Redbeard",
    "Hardhead",
    "Tankardson",
    "Deepdelve",
    "Coalbrow",
    "Flintstrike",
    "Boulderborn",
    "Anvilback",
    "Shaftwalker",
    "Rockbreaker",
    "Veinseeker",
    "Goldpalm",
    "Chiselmark",
    "Barrelgut",
    "Bronzeshield",
    "Oreheart",
    "Hopsbeard",
    "Heavyfoot",
    "Tunnelborn",
    "Orebiter",
    "Flintson",
    "Fuseburner",
    "Thunderbrow",
  ],
};

// Object.keys gives enum numbers as strings
export function getRandomDwarfLook(): SpriteLayer[] {
  return Object.values(DWARF_LOOK.layers).map((layer) => ({
    crop: {
      x: AxiomMath.randomInt(0, layer.variants - 1) * DWARF_LOOK.cell,
      y: layer.row * DWARF_LOOK.cell,
      width: DWARF_LOOK.cell,
      height: DWARF_LOOK.cell,
    },
    tint: layer.tints
      ? layer.tints[AxiomMath.randomArrayIndex(layer.tints)]
      : undefined,
  }));
}
export function getRandomDwarfName() {
  const first =
    DWARF_NAMES.first[AxiomMath.randomArrayIndex(DWARF_NAMES.first)];
  const last = DWARF_NAMES.last[AxiomMath.randomArrayIndex(DWARF_NAMES.last)];
  return `${first} ${last}`;
}
