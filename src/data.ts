export type BlockName = (typeof BLOCK_NAMES)[number]; // "air
export const BLOCK_NAMES = ["air", "rock", "coal", "bedrock", "gold"] as const;

export const BLOCK_TYPES: Record<BlockName, Crop & { str: number }> = {
  air: { x: 0, y: 0, width: 0, height: 0, str: 0 },
  rock: { x: 0, y: 0, width: 96, height: 96, str: 8 },
  coal: { x: 96, y: 96, width: 96, height: 96, str: 12 },
  bedrock: { x: 0, y: 96, width: 96, height: 96, str: 9999 },
  gold: { x: 96, y: 0, width: 96, height: 96, str: 1 },
};
