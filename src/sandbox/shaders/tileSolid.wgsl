// solid map tile: where it borders air the edge is chipped inward in whole grains, never past the
// tile and shallow, the ball collides with the full tile. World only (Material gui: false)

// replaced by TileMask.init: tileMask binding, TILE_ORIGIN, TILE_SIZE
// TILE_MAP

// grain in world units must divide the tile size, the cut keeps that pixel art step;
// share of the edge that is chipped, the rest stays straight; chips in grains, whole steps from
// min to max; frequency per world unit, how long one chip runs;
// chamfer < 1 bevels convex corners at 45° (0.5: the bevel is twice the chip depth)
const TILE_GRAIN: f32 = 3.0;
const TILE_CHIP_AMOUNT: f32 = 0.35;
const TILE_CHIP_MIN_GRAINS: f32 = 1.0;
const TILE_CHIP_MAX_GRAINS: f32 = 3.0;
const TILE_CHIP_FREQUENCY: f32 = 1.0 / 9.0;
const TILE_CHIP_CHAMFER: f32 = 0.5;

fn tileHash(cell: vec2f) -> f32 {
  let n = bitcast<vec2u>(vec2i(cell));
  var h = (n.x * 1597334677u) ^ (n.y * 3812015801u);
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  return f32(h) / 4294967295.0;
}
// linear, not smoothed: sharp kinks between the lattice points read as chipped stone
fn tileNoise(point: vec2f) -> f32 {
  let cell = floor(point);
  let fraction = point - cell;
  let top = mix(tileHash(cell), tileHash(cell + vec2f(1.0, 0.0)), fraction.x);
  let bottom = mix(tileHash(cell + vec2f(0.0, 1.0)), tileHash(cell + vec2f(1.0, 1.0)), fraction.x);
  return mix(top, bottom, fraction.y);
}
// outside the map counts as rock, the border stays straight
fn tileIsAir(cell: vec2i) -> bool {
  let size = vec2i(textureDimensions(tileMask));
  if (any(cell < vec2i(0)) || any(cell >= size)) {
    return false;
  }
  return textureLoad(tileMask, cell, 0).r < 0.5;
}

fn material(in: MaterialInput) -> vec4f {
  // the pixel snapped to the grain, in tiles from the map origin
  let position = (floor((in.world - TILE_ORIGIN) / TILE_GRAIN) + 0.5) * TILE_GRAIN / TILE_SIZE;
  let cell = vec2i(floor(position));
  let local = position - vec2f(cell);

  // distance in tiles to each side facing air, far when the side touches rock
  let noAir = 1000.0;
  let up = select(noAir, local.y, tileIsAir(cell + vec2i(0, -1)));
  let right = select(noAir, 1.0 - local.x, tileIsAir(cell + vec2i(1, 0)));
  let down = select(noAir, 1.0 - local.y, tileIsAir(cell + vec2i(0, 1)));
  let left = select(noAir, local.x, tileIsAir(cell + vec2i(-1, 0)));
  let sideX = min(left, right);
  let sideY = min(up, down);
  let edge = min(min(sideX, sideY), (sideX + sideY) * TILE_CHIP_CHAMFER);

  // linear noise sits mostly mid range: stretched, then its top TILE_CHIP_AMOUNT is chipped,
  // spread again over min..max
  let noise = tileNoise(position * TILE_SIZE * TILE_CHIP_FREQUENCY);
  let spread = clamp((noise - 0.5) * 2.2 + 0.5, 0.0, 0.999);
  let chip = (spread - (1.0 - TILE_CHIP_AMOUNT)) / TILE_CHIP_AMOUNT;
  let chipSteps = TILE_CHIP_MAX_GRAINS - TILE_CHIP_MIN_GRAINS + 1.0;
  let grains = select(0.0, TILE_CHIP_MIN_GRAINS + floor(chip * chipSteps), chip >= 0.0);
  if (edge < grains * TILE_GRAIN / TILE_SIZE.x) {
    return vec4f(0.0);
  }

  let outline = in.outlineColor * in.ring;
  return outline + in.color * in.texel * (1.0 - outline.a);
}
