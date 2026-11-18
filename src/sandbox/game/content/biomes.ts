import { BlocksID } from "./blocks";

export enum BiomesID {
  none,
  overgrown,
  frozen,
}

export interface BiomeData {
  name: string;
  tint?: RGB;
  ambient?: { color: RGB; level: number };
  replace: Partial<Record<BlocksID, BlocksID>>;
  extras: { chance: number; blocks: BlocksID[] };
}

// every plain rock, what a biome turns into its own block (ores stay)
const ROCKS = [BlocksID.dirt, BlocksID.sandstone, BlocksID.stone, BlocksID.granite, BlocksID.slate, BlocksID.gneiss, BlocksID.marble];

function allRocksTo(block: BlocksID): Partial<Record<BlocksID, BlocksID>> {
  return Object.fromEntries(ROCKS.map((rock) => [rock, block]));
}

export const BIOMES: Partial<Record<BiomesID, BiomeData>> = {
  [BiomesID.overgrown]: {
    name: "Overgrown grotto",
    tint: [200, 235, 175],
    ambient: { color: [140, 225, 130], level: 0.3 },
    replace: allRocksTo(BlocksID.moss),
    extras: { chance: 0, blocks: [] },
  },
  [BiomesID.frozen]: {
    name: "Frozen depths",
    tint: [195, 220, 255],
    ambient: { color: [130, 180, 255], level: 0.34 },
    replace: allRocksTo(BlocksID.ice),
    extras: { chance: 0, blocks: [] },
  },
};

export const BIOME_RULES = {
  transition: 12,
};
