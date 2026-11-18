// the game's globals, put in front of every shader that reads them; the bindings and the layouts
// must match GAME_GLOBALS in gpu/gameGlobals.ts. A shader stage takes at most 8 storage buffers
// on common hardware, the engine needs one: what goes together shares a buffer

// a block's (indexed by BlocksID) or, from map.backgroundMaterialsFrom on, a background's (BackgroundsID)
struct TileMaterial {
  // texel rect of its first look in its atlas, width 0: not drawn (void, air, no background)
  crop: vec4f,
  flags: u32,
  // BlockData.glow: linear rgb and the blend, a byte each
  glow: u32,
  // how bright the glow is, above 1 into the bloom; 0: doesn't glow
  shine: f32,
  // its flashing grains: the share 0-1 and the speed as a share of SPARKLE_SPEED_MAX, 16 bits each
  sparkle: u32,
}
const TILE_SOLID: u32 = 1u;
// keeps its own colors under a biome's tint
const TILE_OWN_COLORS: u32 = 2u;

struct Map {
  sizeInTiles: vec2f,
  // world units, the map's top left is the world's 0,0
  tileSize: f32,
  // layer of the rocks atlas in the albedo array
  rocksLayer: u32,
  // how many looks lie side by side for every block in the atlas
  looks: u32,
  // the brightness left to a block about to break
  damagedShade: f32,
  // layer of the backgrounds atlas in the albedo array
  backgroundsLayer: u32,
  // world units of rock a light still gets into, fading over them (occlusion.wgsl)
  lightIntoRock: f32,
  // the background's shade next to a block: width in tiles, strength at the block's edge
  aoWidth: f32,
  aoStrength: f32,
  // the background darker and paler than the blocks: brightness, saturation (1 as is)
  backgroundShade: f32,
  backgroundSaturation: f32,
  // the tunnel mist (MAP_LOOK.mist): linear rgb times its scatter, above 1 in light, a = opacity
  // at its thickest
  mistColor: vec4f,
  // thickness near the top and at the bottom of the map, patches per tile, the draft toward the
  // shaft in tiles a second
  mistShape: vec4f,
  // where the backgrounds' materials start in materials
  backgroundMaterialsFrom: u32,
  // the debug view: 1 the whole ambient at full, 0 the place's own (GameGlobals.setFullLight)
  fullLight: f32,
  // layer of the ores' glow masks in the albedo array, laid out like the rocks
  rocksGlowLayer: u32,
  // MAP_LOOK.glow: sparkle density and flashes a second, breathe amount and beats a second
  glowLook: vec4f,
  blueprint: Blueprint,
  // layer of the camp buildings' atlas in the albedo array
  buildingsLayer: u32,
  buildingCount: u32,
  // the camp buildings' sprites (GameGlobals.setBuildings), the mist leaves out what they cover
  buildings: array<BuildingMask, BUILDING_MASKS>,
}

const BUILDING_MASKS: u32 = 16u;

// box: world x, y, width, height; crop: texel x, y, width, height, a mirrored one starts at its
// right edge with a negative width
struct BuildingMask {
  box: vec4f,
  crop: vec4f,
}

// build mode's plan: its wave's front glows over this many tiles, on the map and on what stands on it
const BLUEPRINT_EDGE: f32 = 2.0;

// MAP_LOOK.blueprint, the colors linear; shape: x the open space's strength, y the blocks', z the
// unknown's hatch lines a tile
struct Blueprint {
  paper: vec4f,
  line: vec4f,
  rockDark: vec4f,
  rockLight: vec4f,
  rockLine: vec4f,
  unknown: vec4f,
  hatch: vec4f,
  shape: vec4f,
  // what stands and flies on the map (structurePlan.wgsl)
  structureDark: vec4f,
  structureLight: vec4f,
  token: vec4f,
  // the jump from, to, the inner lines' strength, the silhouette's
  structureLines: vec4f,
  // the same from and to, the tokens' inner and silhouette
  tokenLines: vec4f,
}

// one u32 per tile: the World tile (type | look << 11) | damage << 16
@group(0) @binding(4) var<storage, read> tiles: array<u32>;
// the blocks', then the backgrounds'
@group(0) @binding(5) var<storage, read> materials: array<TileMaterial>;
@group(0) @binding(6) var<uniform> map: Map;
// one u32 per tile: the World background (type | look << 11)
@group(0) @binding(7) var<storage, read> backgrounds: array<u32>;
// two u32 per tile, already faded across the borders, linear rgb as unorm8: x the biome's tint,
// y the place's ambient light
@group(0) @binding(8) var<storage, read> biomeLooks: array<vec2u>;
// the fog of war, World.discovered: 0-255 per point, FOG_PER_TILE points per tile side, four
// points in a u32 (the first in the low byte)
@group(0) @binding(9) var<storage, read> fog: array<u32>;
const FOG_PER_TILE: f32 = 4.0;
// the share of the light left under the fog, so the undiscovered is faintly visible
const FOG_MIN_LIGHT: f32 = 0.05;
// one u32 per tile (mistField.ts): the low byte how tight the place is, the mist's thickness before
// depth; the next byte the dust in the air, 0-255
@group(0) @binding(10) var<storage, read> mist: array<u32>;
const MIST_DUST_SHIFT: u32 = 8u;

// between the tile centers, so it has no steps at the tile edges; tilePosition in tiles; spelled
// out per buffer, WGSL takes no storage array as an argument
fn biomeTint(tilePosition: vec2f) -> vec3f {
  let size = vec2i(map.sizeInTiles);
  let position = tilePosition - 0.5;
  let low = vec2i(floor(position));
  let blend = fract(position);
  let a = unpackRgb(biomeLooks[tileAt(low, size)].x);
  let b = unpackRgb(biomeLooks[tileAt(low + vec2i(1, 0), size)].x);
  let c = unpackRgb(biomeLooks[tileAt(low + vec2i(0, 1), size)].x);
  let d = unpackRgb(biomeLooks[tileAt(low + vec2i(1, 1), size)].x);
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

fn placeAmbient(tilePosition: vec2f) -> vec3f {
  let size = vec2i(map.sizeInTiles);
  let position = tilePosition - 0.5;
  let low = vec2i(floor(position));
  let blend = fract(position);
  let a = unpackRgb(biomeLooks[tileAt(low, size)].y);
  let b = unpackRgb(biomeLooks[tileAt(low + vec2i(1, 0), size)].y);
  let c = unpackRgb(biomeLooks[tileAt(low + vec2i(0, 1), size)].y);
  let d = unpackRgb(biomeLooks[tileAt(low + vec2i(1, 1), size)].y);
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

// 0 undiscovered, 1 discovered; between the points, so the border is soft; over the map's top the
// surface, always discovered, the rest outside the map 0
fn discoveredAt(world: vec2f) -> f32 {
  let size = vec2i(map.sizeInTiles * FOG_PER_TILE);
  let position = world / map.tileSize * FOG_PER_TILE - 0.5;
  let low = vec2i(floor(position));
  let blend = fract(position);
  let a = fogAt(low, size);
  let b = fogAt(low + vec2i(1, 0), size);
  let c = fogAt(low + vec2i(0, 1), size);
  let d = fogAt(low + vec2i(1, 1), size);
  return smoothstep(0.0, 1.0, mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y));
}

// what the fog leaves of the light: the discovered share taken into linear, the light is linear
// and the screen isn't, as it is the whole fade would land in the last bit of the border
fn fogShade(world: vec2f) -> f32 {
  return mix(FOG_MIN_LIGHT, 1.0, fogLightShade(world));
}

// the same for what shines (the lamps' light): nothing of it under the fog, no FOG_MIN_LIGHT, so a
// lamp in the undiscovered doesn't give it away
fn fogLightShade(world: vec2f) -> f32 {
  return pow(discoveredAt(world), 2.2);
}

fn fogAt(point: vec2i, size: vec2i) -> f32 {
  if (point.y < 0) {
    return 1.0;
  }
  if (any(point < vec2i(0)) || any(point >= size)) {
    return 0.0;
  }
  let index = u32(point.x) + u32(point.y) * u32(size.x);
  return f32((fog[index >> 2u] >> ((index & 3u) * 8u)) & 0xFFu) / 255.0;
}

// 0-1 between the tile centers, like the tints
fn mistAt(tilePosition: vec2f) -> f32 {
  let size = vec2i(map.sizeInTiles);
  let position = tilePosition - 0.5;
  let low = vec2i(floor(position));
  let blend = fract(position);
  let a = f32(mist[tileAt(low, size)] & 0xFFu);
  let b = f32(mist[tileAt(low + vec2i(1, 0), size)] & 0xFFu);
  let c = f32(mist[tileAt(low + vec2i(0, 1), size)] & 0xFFu);
  let d = f32(mist[tileAt(low + vec2i(1, 1), size)] & 0xFFu);
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y) / 255.0;
}

// eased between the centers: a straight blend shows the tile grid as creases in the dust
fn dustAt(tilePosition: vec2f) -> f32 {
  let size = vec2i(map.sizeInTiles);
  let position = tilePosition - 0.5;
  let low = vec2i(floor(position));
  let blend = smoothstep(vec2f(0.0), vec2f(1.0), fract(position));
  let a = f32((mist[tileAt(low, size)] >> MIST_DUST_SHIFT) & 0xFFu);
  let b = f32((mist[tileAt(low + vec2i(1, 0), size)] >> MIST_DUST_SHIFT) & 0xFFu);
  let c = f32((mist[tileAt(low + vec2i(0, 1), size)] >> MIST_DUST_SHIFT) & 0xFFu);
  let d = f32((mist[tileAt(low + vec2i(1, 1), size)] >> MIST_DUST_SHIFT) & 0xFFu);
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y) / 255.0;
}

fn openAt(tilePosition: vec2f) -> f32 {
  return clamp(0.5 + rockDistance(tilePosition), 0.0, 1.0);
}

// the tile's index, clamped into the map
fn tileAt(tile: vec2i, size: vec2i) -> u32 {
  let clamped = clamp(tile, vec2i(0), size - 1);
  return u32(clamped.x) + u32(clamped.y) * u32(size.x);
}

fn unpackRgb(word: u32) -> vec3f {
  return unpack4x8unorm(word).rgb;
}

const TILE_TYPE_MASK: u32 = 0x7FFu;
const TILE_LOOK_SHIFT: u32 = 11u;
const TILE_LOOK_MASK: u32 = 0x1Fu;
const TILE_DAMAGE_SHIFT: u32 = 16u;
const TILE_MAX_DAMAGE: f32 = 65535.0;

fn tileType(word: u32) -> u32 {
  return word & TILE_TYPE_MASK;
}

fn tileLook(word: u32) -> u32 {
  return (word >> TILE_LOOK_SHIFT) & TILE_LOOK_MASK;
}

// 0..1, 1 breaks it
fn tileDamage(word: u32) -> f32 {
  return f32(word >> TILE_DAMAGE_SHIFT) / TILE_MAX_DAMAGE;
}

// over the map's top the surface's open air, the rest outside the map counts as rock
fn isSolidAt(tile: vec2i) -> bool {
  let size = vec2i(map.sizeInTiles);
  if (tile.y < 0) {
    return false;
  }
  if (any(tile < vec2i(0)) || any(tile >= size)) {
    return true;
  }
  let word = tiles[u32(tile.x) + u32(tile.y) * u32(size.x)];
  return (materials[tileType(word)].flags & TILE_SOLID) != 0u;
}

// a damaged block crumbles from its open faces (the side of a tile with no block): depth, how far in
// it reaches at full damage, a share of the tile; grain, texels of the rock that go whole, so the
// edge keeps the pixel step; ragged: how much the reach wanders along the edge (0 a straight cut),
// bumps: its waves per tile. The ball still hits the whole tile, so the depth stays shallow. Shared:
// the map leaves the holes out, the mist and the dust fill them, the background's shade follows them
struct ChipLook {
  depth: f32,
  grain: f32,
  ragged: f32,
  bumps: f32,
}
const CHIP_LOOK = ChipLook(0.33, 4.0, 0.7, 4.0);

// whether the point of a block's tile crumbled away; local 0-1 in the tile
fn chippedAt(tile: vec2i, local: vec2f) -> bool {
  let size = vec2i(map.sizeInTiles);
  if (any(tile < vec2i(0)) || any(tile >= size) || !isSolidAt(tile)) {
    return false;
  }
  let word = tiles[u32(tile.x) + u32(tile.y) * u32(size.x)];
  let damage = tileDamage(word);
  if (damage <= 0.0) {
    return false;
  }
  let grains = materials[tileType(word)].crop.z / CHIP_LOOK.grain;
  let snapped = (floor(local * grains) + 0.5) / grains;
  // in tiles of the whole map: the wander runs on across a tile's edge
  return openDepth(tile, snapped) < chipReach(vec2f(tile) + snapped, damage);
}

fn tileDamageAt(tile: vec2i) -> f32 {
  let size = vec2i(map.sizeInTiles);
  if (any(tile < vec2i(0)) || any(tile >= size)) {
    return 0.0;
  }
  return tileDamage(tiles[u32(tile.x) + u32(tile.y) * u32(size.x)]);
}

fn blockGap(block: vec2i, position: vec2f) -> f32 {
  let nearest = clamp(position, vec2f(block), vec2f(block) + 1.0);
  let gap = length(position - nearest);
  let damage = tileDamageAt(block);
  if (damage <= 0.0) {
    return gap;
  }
  return gap + max(chipReach(nearest, damage) - openDepth(block, nearest - vec2f(block)), 0.0);
}

// below 0 inside the rock
fn rockDistance(position: vec2f) -> f32 {
  let tile = vec2i(floor(position));
  if (isSolidAt(tile)) {
    let local = fract(position);
    let damage = tileDamageAt(tile);
    let reach = select(0.0, chipReach(position, damage), damage > 0.0);
    let depth = openDepth(tile, local) - reach;
    if (depth > 0.0) {
      return -depth;
    }
  }
  var closest = 2.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let block = tile + vec2i(dx, dy);
      if (isSolidAt(block)) {
        closest = min(closest, blockGap(block, position));
      }
    }
  }
  return closest;
}

// how deep a point of a block crumbles in, from its open faces; position in map tiles
fn chipReach(position: vec2f, damage: f32) -> f32 {
  let wander = chipNoise(position * CHIP_LOOK.bumps);
  return damage * CHIP_LOOK.depth * mix(1.0 - CHIP_LOOK.ragged, 1.0, wander);
}

// tiles from the point to the nearest open face or corner of its tile, 2 with none
fn openDepth(at: vec2i, local: vec2f) -> f32 {
  var depth = 2.0;
  if (!isSolidAt(at + vec2i(-1, 0))) { depth = min(depth, local.x); }
  if (!isSolidAt(at + vec2i(1, 0))) { depth = min(depth, 1.0 - local.x); }
  if (!isSolidAt(at + vec2i(0, -1))) { depth = min(depth, local.y); }
  if (!isSolidAt(at + vec2i(0, 1))) { depth = min(depth, 1.0 - local.y); }
  if (!isSolidAt(at + vec2i(-1, -1))) { depth = min(depth, length(local)); }
  if (!isSolidAt(at + vec2i(1, -1))) { depth = min(depth, length(local - vec2f(1.0, 0.0))); }
  if (!isSolidAt(at + vec2i(-1, 1))) { depth = min(depth, length(local - vec2f(0.0, 1.0))); }
  if (!isSolidAt(at + vec2i(1, 1))) { depth = min(depth, length(local - vec2f(1.0))); }
  return depth;
}

// value noise 0-1, smooth between the cells
fn chipNoise(point: vec2f) -> f32 {
  let cell = floor(point);
  let blend = smoothstep(vec2f(0.0), vec2f(1.0), fract(point));
  let top = mix(chipHash(cell), chipHash(cell + vec2f(1.0, 0.0)), blend.x);
  let bottom = mix(chipHash(cell + vec2f(0.0, 1.0)), chipHash(cell + vec2f(1.0)), blend.x);
  return mix(top, bottom, blend.y);
}

// 0-1, no sin: the cells reach tens of thousands, where sin loses its precision on the GPU
fn chipHash(cell: vec2f) -> f32 {
  var point = fract(vec3f(cell.xyx) * 0.1031);
  point += dot(point, point.yzx + 33.33);
  return fract((point.x + point.y) * point.z);
}
