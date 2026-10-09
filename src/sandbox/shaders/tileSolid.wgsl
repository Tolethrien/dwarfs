// solid map tile: where it borders air the edge is chipped inward in whole grains, never past the
// tile and shallow, the ball collides with the full tile. Also the shards of a mined tile
// (shardMaterial), cut by the same cracks. World only (Material gui: false)

// replaced by TileMask.register: tileMask binding, TILE_ORIGIN, TILE_SIZE
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
// rock darkens toward an edge facing air: depth without graphics; width in tiles
const TILE_RIM_WIDTH: f32 = 0.2;
const TILE_RIM_SHADE: f32 = 0.3;

// damage (in.params.x, 0-1): cracks are cell borders in a jittered grid of TILE_CRACK_CELLS
// cells per tile, a border shows once the damage passes its cell's own threshold; the tile also
// darkens up to TILE_DAMAGE_SHADE. Hit (in.params.y, game time) at the impact packed in in.params.z
// (TileMask.packImpact): a light ring runs out of it, the cracks around it light up pale and fade;
// with heat (in.params.w, a blast) they glow instead and cool down (bloom, same ember as tileBurn.wgsl);
// heat below 0 = a deflected hit, the ring alone
const TILE_CRACK_CELLS: f32 = 2.5;
const TILE_CRACK_WIDTH: f32 = 0.07;
const TILE_CRACK_SHADE: f32 = 0.4;
const TILE_DAMAGE_SHADE: f32 = 0.3;
// reach and width in tiles
const TILE_FLASH_TIME: f32 = 0.18;
const TILE_FLASH_STRENGTH: f32 = 0.6;
const TILE_FLASH_REACH: f32 = 0.7;
const TILE_FLASH_WIDTH: f32 = 0.12;
const TILE_FRESH_TIME: f32 = 0.8;
const TILE_FRESH_RADIUS: f32 = 0.9;
// linear: a cold hit lights the cracks up as freshly broken pale stone, partly self lit so the
// dark mine does not swallow it
const TILE_FRESH_COLOR: vec3f = vec3f(0.8, 0.72, 0.58);
const TILE_FRESH_SELF_LIT: f32 = 0.7;
const TILE_HEAT_BRIGHTNESS: f32 = 8.0;
const TILE_EMBER_HOT: vec3f = vec3f(1.0, 0.1, 0.0);
const TILE_EMBER_COOL: vec3f = vec3f(0.6, 0.035, 0.0);
// must match IMPACT in tileMask.ts
const TILE_IMPACT_STEPS: f32 = 255.0;
const TILE_IMPACT_ROW: f32 = 256.0;
// frame.time wraps at this (sharedBinds.ts TIME_WRAP)
const TILE_TIME_WRAP: f32 = 3600.0;

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

struct TileCell {
  // lattice coords of the cell the point belongs to
  nearest: vec2f,
  // how far the point is from the border with the next cell, in cells
  border: f32,
};
// position in tiles, already snapped to the grain: the cracks keep the pixel art step.
// The seeds must match TileMask.shardsOf (CPU copy of the same cells)
fn tileCell(position: vec2f) -> TileCell {
  let point = position * TILE_CRACK_CELLS;
  let base = floor(point);
  var first = 100.0;
  var second = 100.0;
  var nearest = base;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let cell = base + vec2f(f32(x), f32(y));
      let seed = cell + vec2f(tileHash(cell), tileHash(cell + vec2f(17.0, 31.0)));
      let gap = length(point - seed);
      if (gap < first) {
        second = first;
        first = gap;
        nearest = cell;
      } else if (gap < second) {
        second = gap;
      }
    }
  }
  return TileCell(nearest, second - first);
}

fn tileCrack(position: vec2f, damage: f32) -> bool {
  if (damage <= 0.0) {
    return false;
  }
  let cell = tileCell(position);
  let shown = tileHash(cell.nearest + vec2f(53.0, 7.0)) < damage;
  return shown && cell.border < TILE_CRACK_WIDTH;
}

// seconds from a game time stamp to now, negative while it is still ahead; handles the wrap
fn tileSince(stamp: f32) -> f32 {
  var since = frame.time - stamp;
  if (since < -0.5 * TILE_TIME_WRAP) {
    since += TILE_TIME_WRAP;
  }
  if (since > 0.5 * TILE_TIME_WRAP) {
    since -= TILE_TIME_WRAP;
  }
  return since;
}

// gap: distance in tiles from the impact
fn tileFlash(since: f32, gap: f32) -> f32 {
  if (since < 0.0 || since >= TILE_FLASH_TIME) {
    return 0.0;
  }
  let progress = since / TILE_FLASH_TIME;
  let radius = TILE_FLASH_REACH * sqrt(progress);
  let band = clamp(1.0 - abs(gap - radius) / TILE_FLASH_WIDTH, 0.0, 1.0);
  return TILE_FLASH_STRENGTH * (1.0 - progress) * band;
}

// cracks around the impact just after the hit: freshly broken stone, or hot with heat
fn tileFresh(since: f32, gap: f32) -> f32 {
  if (since < 0.0 || since >= TILE_FRESH_TIME) {
    return 0.0;
  }
  let near = clamp(1.0 - gap / TILE_FRESH_RADIUS, 0.0, 1.0);
  // holds most of its light, then goes out at the end
  let progress = since / TILE_FRESH_TIME;
  return (1.0 - progress * progress) * sqrt(near);
}

fn tileImpact(packed: f32) -> vec2f {
  let row = floor(packed / TILE_IMPACT_ROW);
  return vec2f(packed - row * TILE_IMPACT_ROW, row) / TILE_IMPACT_STEPS;
}

fn solidMaterial(in: MaterialInput) -> vec4f {
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
  let base = outline + in.color * in.texel * (1.0 - outline.a);
  let damage = in.params.x;
  let since = tileSince(in.params.y);
  let gap = length(local - tileImpact(in.params.z));
  // premultiplied: the flash adds light in proportion to coverage
  let flash = tileFlash(since, gap);
  let rim = mix(1.0 - TILE_RIM_SHADE, 1.0, smoothstep(0.0, TILE_RIM_WIDTH, edge));
  let shade = (1.0 - damage * TILE_DAMAGE_SHADE) * rim;
  if (!tileCrack(position, damage)) {
    return vec4f(base.rgb * shade + flash * base.a, base.a);
  }

  // a deflected hit did nothing: no fresh cracks, only the ring
  let fresh = select(tileFresh(since, gap), 0.0, in.params.w < 0.0);
  let cold = fresh * (1.0 - in.params.w);
  let crack = mix(base.rgb * shade * TILE_CRACK_SHADE, TILE_FRESH_COLOR * base.a, cold);
  let heat = fresh * in.params.w;
  let hot = mix(TILE_EMBER_COOL, TILE_EMBER_HOT, heat) * mix(1.0, TILE_HEAT_BRIGHTNESS, heat) * base.a;
  let heated = smoothstep(0.0, 0.3, heat);
  materialGlow = max(heated, cold * TILE_FRESH_SELF_LIT);
  return vec4f(mix(crack, hot, heated) + flash * base.a, base.a);
}

// a shard of a mined tile, flying off on its own sprite (whole tile crop, moved and rotated): only
// the tile's pixels in one crack cell, so the tile breaks along the cracks it had. in.params: xy =
// the tile in map tiles, zw = the cell's lattice coords (TileMask.shardsOf); fades with the tint
fn shardMaterial(in: MaterialInput) -> vec4f {
  // local is before the rotation: the pixel where it sat in the tile, snapped like the tile
  let pixel = (floor((in.local + in.size * 0.5) / TILE_GRAIN) + 0.5) * TILE_GRAIN;
  let cell = tileCell(in.params.xy + pixel / TILE_SIZE);
  if (any(cell.nearest != in.params.zw)) {
    return vec4f(0.0);
  }
  let base = in.color * in.texel;
  let rim = select(1.0, TILE_CRACK_SHADE, cell.border < TILE_CRACK_WIDTH);
  return vec4f(base.rgb * (1.0 - TILE_DAMAGE_SHADE) * rim, base.a);
}

// ore (TileMask.ore, blocks with glint): a solid tile whose bright texels, the ore itself, glow a
// little in the dark and catch a light sweep running across the tile now and then, each tile at
// its own moment, while single grains flash on their own; both go over 1 and bloom
const ORE_GLINT_PERIOD: f32 = 2.2;
// share of the period the sweep takes to cross, the rest it rests
const ORE_GLINT_CROSS: f32 = 0.35;
// in tiles, half the width of the sweep across the diagonal
const ORE_GLINT_WIDTH: f32 = 0.22;
const ORE_GLINT_GAIN: f32 = 5.0;
const ORE_SELF_LIT: f32 = 0.55;
// single ore grains flash on their own: changes per second, share of the grains lit at a time, gain
const ORE_SPARKLE_RATE: f32 = 7.0;
const ORE_SPARKLE_SHARE: f32 = 0.04;
const ORE_SPARKLE_GAIN: f32 = 6.0;
// linear brightness of a texel from which it counts as ore, and where it fully does
const ORE_BRIGHT: vec2f = vec2f(0.3, 0.6);

fn oreMaterial(in: MaterialInput) -> vec4f {
  let base = solidMaterial(in);
  if (base.a <= 0.0) {
    return base;
  }
  let position = (floor((in.world - TILE_ORIGIN) / TILE_GRAIN) + 0.5) * TILE_GRAIN / TILE_SIZE;
  let cell = floor(position);
  let local = position - cell;
  let texel = in.texel.rgb / max(in.texel.a, 0.0001);
  let bright = smoothstep(ORE_BRIGHT.x, ORE_BRIGHT.y, max(texel.r, max(texel.g, texel.b)));

  let phase = fract(frame.time / ORE_GLINT_PERIOD + tileHash(cell + vec2f(91.0, 17.0)));
  // the band runs along the diagonal from past one corner to past the other
  let sweep = mix(-ORE_GLINT_WIDTH, 1.0 + ORE_GLINT_WIDTH, phase / ORE_GLINT_CROSS);
  let along = (local.x + local.y) * 0.5;
  let glint = select(0.0, 1.0 - smoothstep(0.0, ORE_GLINT_WIDTH, abs(along - sweep)), phase < ORE_GLINT_CROSS);

  // a grain of the pixel art step, flashing in its own random moments
  let grain = floor((in.world - TILE_ORIGIN) / TILE_GRAIN);
  let moment = floor(frame.time * ORE_SPARKLE_RATE);
  let sparkle = select(0.0, 1.0, tileHash(grain + vec2f(moment * 7.0, moment * 13.0)) < ORE_SPARKLE_SHARE);

  materialGlow = max(materialGlow, bright * ORE_SELF_LIT);
  let gain = 1.0 + bright * (glint * ORE_GLINT_GAIN + sparkle * ORE_SPARKLE_GAIN);
  return vec4f(base.rgb * gain, base.a);
}

// replaced by TileMask.register with the material entry: solidMaterial, oreMaterial or shardMaterial
// TILE_ENTRY
