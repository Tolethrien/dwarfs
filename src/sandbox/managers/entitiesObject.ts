import AxiomMath from "@axiom/math";
import { SPRITES } from "./generalData";
import { GameResourcesID } from "./resourcesObject";

export enum DwarfsID {
  intern,
  miner,
  carrier,
  pyro,
  driller,
  scout,
}
export enum BackgroundsID {
  none,
  someOne,
  someTwo,
}
export enum BlocksID {
  air,
  bonesOne,
  bonesTwo,
  rocksBrown,
  rocksGray,
  obsidian,
  rocksDarkGray,
  rocksLightGray,
  rocksLightBrown,
  gold,
  diamonds,
  silver,
  sapphire,
  copper,
  coal,
  hiddenChest,
}

export enum DecosID {
  none,
  flower,
  mushroom,
}
export enum BasesID {
  none,
  blacksmith,
  school,
  inn,
}
export enum AnimsID {
  none,
  sparks,
  explode,
  chest,
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
  resource?: GameResourcesID;
  spawn?: string;
  spawnOnHit?: string;
}
interface DecoData {
  crop: Crop;
}
interface BaseData {
  crop: Crop;
}
interface BackgroundData {
  crop: Crop;
}
interface AnimData {
  crop: Crop; // of 1 frame
  frames: number;
  fps: number;
  texture: string;
}
export default class EntitiesObject {
  public static dwarfs: Record<DwarfsID, DwarfData> = {
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
  public static blocks: Record<BlocksID, BlockData> = {
    [BlocksID.air]: {
      crop: { x: 0, y: 0, width: 0, height: 0 },
      str: 0,
      solid: false,
      category: "terrain",
      resource: GameResourcesID.none,
    },
    [BlocksID.bonesOne]: {
      crop: { x: 0, y: 0, width: 96, height: 96 },
      str: 15,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.bones,
    },
    [BlocksID.bonesTwo]: {
      crop: { x: 96, y: 0, width: 96, height: 96 },
      str: 15,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.bones,
    },
    [BlocksID.rocksBrown]: {
      crop: { x: 192, y: 0, width: 96, height: 96 },
      str: 8,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.stone,
    },
    [BlocksID.rocksGray]: {
      crop: { x: 288, y: 0, width: 96, height: 96 },
      str: 8,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.stone,
    },
    [BlocksID.obsidian]: {
      crop: { x: 384, y: 0, width: 96, height: 96 },
      str: 9999,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.none,
    },
    [BlocksID.rocksDarkGray]: {
      crop: { x: 480, y: 0, width: 96, height: 96 },
      str: 8,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.stone,
    },

    [BlocksID.rocksLightGray]: {
      crop: { x: 0, y: 96, width: 96, height: 96 },
      str: 8,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.stone,
    },
    [BlocksID.rocksLightBrown]: {
      crop: { x: 96, y: 96, width: 96, height: 96 },
      str: 8,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.stone,
    },
    [BlocksID.gold]: {
      crop: { x: 192, y: 96, width: 96, height: 96 },
      str: 20,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.gold,
    },
    [BlocksID.diamonds]: {
      crop: { x: 288, y: 96, width: 96, height: 96 },
      str: 30,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.diamonds,
    },
    [BlocksID.silver]: {
      crop: { x: 384, y: 96, width: 96, height: 96 },
      str: 12,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.silver,
    },
    [BlocksID.sapphire]: {
      crop: { x: 480, y: 96, width: 96, height: 96 },
      str: 20,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.sapphire,
    },
    [BlocksID.copper]: {
      crop: { x: 0, y: 192, width: 96, height: 96 },
      str: 5,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.copper,
    },
    [BlocksID.coal]: {
      crop: { x: 96, y: 192, width: 96, height: 96 },
      str: 10,
      solid: true,
      category: "terrain",
      resource: GameResourcesID.coal,
    },
    [BlocksID.hiddenChest]: {
      crop: { x: 0, y: 96, width: 96, height: 96 },
      str: 0.1,
      solid: true,
      category: "construct",
      spawnOnHit: "chest",
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
  public static bases: Record<BasesID, BaseData> = {
    [BasesID.none]: {
      crop: { x: 0, y: 0, width: 0, height: 0 },
    },
    [BasesID.blacksmith]: {
      crop: { x: 1, y: 1, width: 657, height: 427 },
    },
    [BasesID.school]: {
      crop: { x: 0, y: 431, width: 577, height: 464 },
    },
    [BasesID.inn]: {
      crop: { x: 2, y: 901, width: 705, height: 410 },
    },
  };
  public static backgrounds: Record<BackgroundsID, BackgroundData> = {
    [BackgroundsID.none]: {
      crop: { x: 0, y: 0, width: 0, height: 0 },
    },
    [BackgroundsID.someOne]: {
      crop: { x: 0, y: 0, width: 96, height: 96 },
    },
    [BackgroundsID.someTwo]: {
      crop: { x: 96, y: 0, width: 96, height: 96 },
    },
  };
  public static animations: Record<AnimsID, AnimData> = {
    [AnimsID.none]: {
      crop: { x: 0, y: 0, width: 0, height: 0 },
      fps: 0,
      frames: 0,
      texture: SPRITES.base,
    },
    [AnimsID.sparks]: {
      crop: { x: 0, y: 0, width: 94, height: 79 },
      fps: 30,
      frames: 8,
      texture: SPRITES.anims,
    },
    [AnimsID.explode]: {
      crop: { x: 0, y: 79, width: 94, height: 79 },
      fps: 30,
      frames: 8,
      texture: SPRITES.anims,
    },
    [AnimsID.chest]: {
      crop: { x: 0, y: 158, width: 96, height: 96 },
      fps: 30,
      frames: 4,
      texture: SPRITES.anims,
    },
  };

  public static getBlock(ID: number): BlockData {
    return this.blocks[ID as BlocksID];
  }
  public static getDwarf(ID: number) {
    return this.dwarfs[ID as DwarfsID];
  }
  public static getRandomDwarfID(): DwarfsID {
    const size = Object.keys(EntitiesObject.dwarfs).length;
    return AxiomMath.randomInt(0, size - 1) as DwarfsID;
  }
}
