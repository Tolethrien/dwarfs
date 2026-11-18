// type + look packed in one u16, what World.solid stores
export type Tile = number;

// the only place that knows the split of a solid u16
export const TILE_BITS = { type: 11, look: 5 };

export const TILE_MASK = {
  type: (1 << TILE_BITS.type) - 1,
  look: (1 << TILE_BITS.look) - 1,
};

export function packTile(type: number, look = 0): Tile {
  return (type & TILE_MASK.type) | ((look & TILE_MASK.look) << TILE_BITS.type);
}

export function tileType(tile: Tile) {
  return tile & TILE_MASK.type;
}

export function tileLook(tile: Tile) {
  return tile >>> TILE_BITS.type;
}
