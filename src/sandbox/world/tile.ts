// type + variant packed in one u16, what the solid layer stores
export type Tile = number;

// the only place that knows the split of a solid u16; part of the save format (terrain section)
export const TILE_BITS = { type: 11, variant: 5 };

export const TILE_MASK = {
  type: (1 << TILE_BITS.type) - 1,
  variant: (1 << TILE_BITS.variant) - 1,
};

export function packTile(type: number, variant = 0): Tile {
  return (type & TILE_MASK.type) | ((variant & TILE_MASK.variant) << TILE_BITS.type);
}

export function tileType(raw: Tile) {
  return raw & TILE_MASK.type;
}

export function tileVariant(raw: Tile) {
  return raw >>> TILE_BITS.type;
}
