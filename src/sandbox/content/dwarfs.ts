import AxiomMath from "@axiom/math";

export enum DwarfsID {
  intern,
  miner,
  carrier,
  pyro,
  driller,
  scout,
}

export interface DwarfData {
  baseSpeed: number;
  baseDmg: number;
  bpm: number; // beer per minute
  crop: Crop;
}

export const DWARFS: Record<DwarfsID, DwarfData> = {
  [DwarfsID.intern]: {
    baseDmg: 10,
    baseSpeed: 400,
    bpm: 5,
    crop: { x: 110, y: 0, width: 110, height: 110 },
  },
  [DwarfsID.miner]: {
    baseDmg: 50,
    baseSpeed: 400,
    bpm: 5,
    crop: { x: 0, y: 0, width: 110, height: 110 },
  },
  [DwarfsID.carrier]: {
    baseDmg: 5,
    baseSpeed: 400,
    bpm: 5,
    crop: { x: 330, y: 0, width: 110, height: 110 },
  },
  [DwarfsID.pyro]: {
    baseDmg: 75,
    baseSpeed: 400,
    bpm: 5,
    crop: { x: 770, y: 0, width: 110, height: 110 },
  },
  [DwarfsID.driller]: {
    baseDmg: 999,
    baseSpeed: 400,
    bpm: 5,
    crop: { x: 660, y: 0, width: 110, height: 110 },
  },
  [DwarfsID.scout]: {
    baseDmg: 5,
    baseSpeed: 400,
    bpm: 5,
    crop: { x: 440, y: 0, width: 110, height: 110 },
  },
};

export function getDwarf(id: number) {
  return DWARFS[id as DwarfsID];
}

export function randomDwarfID(): DwarfsID {
  const size = Object.keys(DWARFS).length;
  return AxiomMath.randomInt(0, size - 1) as DwarfsID;
}
