import AxiomMath from "@axiom/math";

// written into saves: never change or reuse a number
export enum DwarfsID {
  intern,
  miner,
  carrier,
  pyro,
  driller,
  scout,
}

export interface DwarfLook {
  crop: Crop;
  // the helmet lamp in the crop, pixels from its top-left: the headlight starts there
  lamp: Position2D;
}

// every dwarf in SPRITES.dwarfs, left to right; a new dwarf of any kind picks one at random
export const DWARF_LOOKS: DwarfLook[] = [
  { crop: { x: 0, y: 0, width: 110, height: 110 }, lamp: { x: 78, y: 16 } },
  { crop: { x: 110, y: 0, width: 110, height: 110 }, lamp: { x: 76, y: 20 } },
  { crop: { x: 220, y: 0, width: 110, height: 110 }, lamp: { x: 76, y: 23 } },
  // horned helmet, no lamp: its front
  { crop: { x: 330, y: 0, width: 110, height: 110 }, lamp: { x: 55, y: 20 } },
  { crop: { x: 440, y: 0, width: 110, height: 110 }, lamp: { x: 69, y: 24 } },
  // steel helmet, no lamp: its front
  { crop: { x: 550, y: 0, width: 110, height: 110 }, lamp: { x: 55, y: 20 } },
  { crop: { x: 660, y: 0, width: 110, height: 110 }, lamp: { x: 73, y: 21 } },
  // hood, no lamp: its front
  { crop: { x: 770, y: 0, width: 110, height: 110 }, lamp: { x: 72, y: 22 } },
];

export interface DwarfData {
  name: string;
  // shown in the tavern
  description: string;
  baseSpeed: number;
  baseDmg: number;
  bpm: number; // beer per minute
}

export const DWARFS: Record<DwarfsID, DwarfData> = {
  [DwarfsID.intern]: {
    name: "Stażysta",
    description: "Rozbija tylko podstawowy blok. Tani i szybki.",
    baseDmg: 10,
    baseSpeed: 400,
    bpm: 4,
  },
  [DwarfsID.miner]: {
    name: "Miner",
    description: "2,4× silniejszy od skauta, wolniejszy, pije 6 piwa/min. Na twarde skały i rudy.",
    baseDmg: 12,
    baseSpeed: 300,
    bpm: 6,
  },
  [DwarfsID.carrier]: {
    name: "Tragarz",
    description: "Kulki, które przelecą przez jego zasięg, kopią z większym zyskiem.",
    baseDmg: 5,
    baseSpeed: 400,
    bpm: 4,
  },
  [DwarfsID.pyro]: {
    name: "Demolka",
    description: "Wybucha przy pierwszym uderzeniu albo po czasie i rozwala kilka bloków naraz.",
    baseDmg: 75,
    baseSpeed: 400,
    bpm: 4,
  },
  [DwarfsID.driller]: {
    name: "Wiertacz",
    description: "Leci po prostej, zamiast odbijać się chaotycznie.",
    baseDmg: 999,
    baseSpeed: 400,
    bpm: 4,
  },
  [DwarfsID.scout]: {
    name: "Skaut",
    description: "Tani i szybki, słaby: kruszy kamień, rudy ledwo rysuje. Pije 4 piwa/min.",
    baseDmg: 5,
    baseSpeed: 400,
    bpm: 4,
  },
};

export function getDwarf(id: number) {
  return DWARFS[id as DwarfsID];
}

export function randomDwarfLook() {
  return DWARF_LOOKS[AxiomMath.randomInt(0, DWARF_LOOKS.length - 1)];
}

export function randomDwarfID(): DwarfsID {
  const size = Object.keys(DWARFS).length;
  return AxiomMath.randomInt(0, size - 1) as DwarfsID;
}
