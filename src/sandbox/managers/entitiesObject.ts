import AxiomMath from "@/core/axiom/math";

//DO NOT CHANGE PLACE, ADD AT THE END
export enum DwarfsID {
  intern,
  miner,
  carrier,
  pyro,
  driller,
  scout,
}
export enum BlocksID {
  air,
  rock,
  bedrock,
  coal,
}

export enum DecosID {
  none,
  flower,
  mushroom,
}
interface DwarfData {
  baseSpeed: number;
  baseDmg: number;
  bpm: number; // beer per minute
  crop: Crop;
}
interface BlockData {
  crop: Crop;
  str: number;
  solid: boolean;
  category: "terrain" | "construct";
}
interface DecoData {
  crop: Crop;
}
export default class EntitiesObject {
  public static renderOrder = {
    bg: 0,
    decoBack: 0.25,
    main: 0.5,
    decoFront: 0.75,
    overlay: 0.8,
    debug: 1,
  };
  public static sprites = { dwarfs: "chars", blocks: "stones", deco: "decor" };
  public static dwarfs: Record<DwarfsID, DwarfData> = {
    [DwarfsID.intern]: {
      baseDmg: 10,
      baseSpeed: 400,
      bpm: 5,
      crop: { x: 0, y: 0, width: 110, height: 110 },
    },
    [DwarfsID.miner]: {
      baseDmg: 10,
      baseSpeed: 400,
      bpm: 5,
      crop: { x: 0, y: 0, width: 110, height: 110 },
    },
    [DwarfsID.carrier]: {
      baseDmg: 10,
      baseSpeed: 400,
      bpm: 5,
      crop: { x: 0, y: 0, width: 110, height: 110 },
    },
    [DwarfsID.pyro]: {
      baseDmg: 10,
      baseSpeed: 400,
      bpm: 5,
      crop: { x: 0, y: 0, width: 110, height: 110 },
    },
    [DwarfsID.driller]: {
      baseDmg: 10,
      baseSpeed: 400,
      bpm: 5,
      crop: { x: 0, y: 0, width: 110, height: 110 },
    },
    [DwarfsID.scout]: {
      baseDmg: 10,
      baseSpeed: 400,
      bpm: 5,
      crop: { x: 0, y: 0, width: 110, height: 110 },
    },
  };
  public static blocks: Record<BlocksID, BlockData> = {
    [BlocksID.air]: {
      crop: { x: 0, y: 0, width: 0, height: 0 },
      str: 0,
      solid: false,
      category: "terrain",
    },
    [BlocksID.rock]: {
      crop: { x: 0, y: 0, width: 96, height: 96 },
      str: 8,
      solid: true,
      category: "terrain",
    },
    [BlocksID.bedrock]: {
      crop: { x: 0, y: 96, width: 96, height: 96 },
      str: 9999,
      solid: true,
      category: "terrain",
    },
    [BlocksID.coal]: {
      crop: { x: 96, y: 96, width: 96, height: 96 },
      str: 12,
      solid: true,
      category: "terrain",
    },
  };
  public static decos: Record<DecosID, DecoData> = {
    [DecosID.none]: {
      crop: { x: 0, y: 0, width: 0, height: 0 },
    },
    [DecosID.flower]: {
      crop: { x: 0, y: 0, width: 0, height: 0 },
    },
    [DecosID.mushroom]: {
      crop: { x: 0, y: 0, width: 0, height: 0 },
    },
  };

  public static getBlock(ID: number): BlockData {
    return this.blocks[ID as BlocksID];
  }
  public static getDwarf(ID: number) {
    return this.dwarfs[ID as DwarfsID];
  }
  public static getRandomDwarfID(): DwarfsID {
    const size = Object.keys(EntitiesObject.blocks).length;
    return AxiomMath.randomInt(0, size - 1) as DwarfsID;
  }
}
