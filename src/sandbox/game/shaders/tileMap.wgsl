// tiles, backgrounds, materials, biome looks and map come from globals.wgsl, put in front by TileMap
// in.params.x: which layer this rect draws, the blocks, the background under them, the ores' glow
// over them or build mode's blueprint over all of it (TILE_MAP_LAYER in tileMap.ts); the
// blueprint's y: the wave's radius in tiles (0: none), z: its center as a tile index

// the albedo keeps mips 0-3 (MAX_MIPS in albedoBake)
const MAX_LOD: f32 = 3.0;
const TILE_MAP_BLOCKS: f32 = 0.0;
const TILE_MAP_BACKGROUNDS: f32 = 1.0;
const TILE_MAP_GLOW: f32 = 2.0;
const TILE_MAP_BLUEPRINT: f32 = 3.0;
// the blueprint: a thick line every few tiles (its wave's front: BLUEPRINT_EDGE in globals.wgsl)
const BLUEPRINT_MAJOR_EVERY: u32 = 10u;

fn material(in: MaterialInput) -> vec4f {
  let mapInTiles = map.sizeInTiles;
  let tilePosition = in.uv * mapInTiles;
  // from the continuous position, before any branch: the in-tile fraction jumps at tile edges
  // and its derivative there would pick a far mip, a line between the tiles
  let tileDx = dpdx(tilePosition);
  let tileDy = dpdy(tilePosition);
  let discovered = discoveredAt(tilePosition * map.tileSize);
  // uv reaches 1 on the right and bottom edge, one tile past the map
  let tile = min(vec2u(floor(tilePosition)), vec2u(mapInTiles) - 1u);
  let index = tile.x + tile.y * u32(mapInTiles.x);
  // the plan covers the undiscovered too, as unknown paper
  if (in.params.x == TILE_MAP_BLUEPRINT) {
    return blueprintColor(tiles[index], tile, tilePosition, tileDx, tileDy, in.params.y, in.params.z, discovered);
  }
  // the ores glow only where discovered: the faint look through the fog has no glimmer in it
  if (in.params.x == TILE_MAP_GLOW) {
    return glowColor(tiles[index], tile, fract(tilePosition), tileDx, tileDy, discovered) * discovered;
  }
  let tint = biomeTint(tilePosition);
  if (in.params.x == TILE_MAP_BLOCKS) {
    return blockColor(tiles[index], tile, fract(tilePosition), tileDx, tileDy, tint);
  }
  let background = backgroundColor(backgrounds[index], fract(tilePosition), tileDx, tileDy, tint);
  return vec4f(background.rgb * backgroundShade(vec2i(tile), fract(tilePosition)), background.a);
}

// ambient occlusion of the background: every block around it (and its own, seen through a hole)
// darkens it, fading with the distance to that block's rock over map.aoWidth; the shades multiply,
// so a corner gets darker
fn backgroundShade(tile: vec2i, local: vec2f) -> f32 {
  let position = vec2f(tile) + local;
  var shade = 1.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let neighbour = tile + vec2i(dx, dy);
      if (!isSolidAt(neighbour)) {
        continue;
      }
      let reach = 1.0 - smoothstep(0.0, map.aoWidth, blockGap(neighbour, position));
      shade *= 1.0 - map.aoStrength * reach;
    }
  }
  return shade;
}

// nothing to draw (void, air) is zero alpha, which the opaque pass discards
fn blockColor(word: u32, tile: vec2u, local: vec2f, tileDx: vec2f, tileDy: vec2f, tint: vec3f) -> vec4f {
  let blockMaterial = materials[tileType(word)];
  var crop = blockMaterial.crop;
  if (crop.z == 0.0) {
    return vec4f(0.0);
  }
  // the looks lie to the right of the first one
  crop.x += f32(tileLook(word)) * crop.z;
  if (chippedAt(vec2i(tile), local)) {
    return vec4f(0.0);
  }
  let color = sampleCrop(crop, local, tileDx, tileDy, map.rocksLayer);
  let tinted = select(color.rgb * tint, color.rgb, (blockMaterial.flags & TILE_OWN_COLORS) != 0u);
  // darker, not greyer: its own colors at less brightness
  return vec4f(tinted * mix(1.0, map.damagedShade, tileDamage(word)), color.a);
}

// how much of an ore's glow is gone at full damage
const GLOW_DAMAGE_LOSS: f32 = 0.85;


// premultiplied: the open space turns to paper, the blocks to the rock's shades by their brightness,
// the grid's lines over both; the wave's front is all paper and lines, the plan unrolling, only
// behind it the blocks settle into their weaker plan; the undiscovered is unknown paper, hatched,
// nothing of the map under it, the fog's soft rim blends the two
fn blueprintColor(word: u32, tile: vec2u, tilePosition: vec2f, tileDx: vec2f, tileDy: vec2f, radius: f32, centerIndex: f32, discovered: f32) -> vec4f {
  if (radius <= 0.0) {
    return vec4f(0.0);
  }
  let width = u32(map.sizeInTiles.x);
  let center = vec2f(f32(u32(centerIndex) % width), f32(u32(centerIndex) / width));
  // whole tiles: the wave's edge steps from tile to tile
  let distance = length(vec2f(tile) - center);
  if (distance > radius) {
    return vec4f(0.0);
  }
  let palette = map.blueprint;
  let edge = smoothstep(radius - BLUEPRINT_EDGE, radius, distance);

  // the lines in screen pixels, the same width at any zoom
  let pixel = max(abs(tileDx) + abs(tileDy), vec2f(0.0001));
  let fraction = fract(tilePosition);
  let toLine = min(fraction, 1.0 - fraction) / pixel;
  let thin = 1.0 - smoothstep(0.5, 1.5, min(toLine.x, toLine.y));
  let major = (tile % vec2u(BLUEPRINT_MAJOR_EVERY)) == vec2u(0u);
  // the major line runs along the left or top edge of every tenth tile
  let toMajor = select(vec2f(1e6), fraction / pixel, major);
  let thick = 1.0 - smoothstep(1.5, 2.5, min(toMajor.x, toMajor.y));

  // the hatch runs diagonally, one pixel wide as well
  let hatchPerTile = palette.shape.z;
  let across = (tilePosition.x + tilePosition.y) * hatchPerTile;
  let acrossPixel = max((abs(tileDx.x + tileDx.y) + abs(tileDy.x + tileDy.y)) * hatchPerTile, 0.0001);
  let toHatch = min(fract(across), 1.0 - fract(across)) / acrossPixel;
  let hatch = 1.0 - smoothstep(0.5, 1.5, toHatch);
  var unknown = mix(palette.unknown.rgb, palette.hatch.rgb, hatch);
  unknown = mix(unknown, palette.hatch.rgb, max(thin * 0.35, thick * 0.8));
  unknown = mix(unknown, palette.line.rgb, edge * 0.5);
  if (discovered <= 0.0) {
    return vec4f(unknown, 1.0);
  }

  let base = blockColor(word, tile, fraction, tileDx, tileDy, vec3f(1.0));
  let open = base.a == 0.0;
  let luminance = dot(base.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let rock = mix(palette.rockDark.rgb, palette.rockLight.rgb, clamp(luminance * 1.5, 0.0, 1.0));
  var color = select(mix(rock, palette.paper.rgb, edge), palette.paper.rgb, open);
  let line = select(mix(palette.rockLine.rgb, palette.line.rgb, edge), palette.line.rgb, open);
  color = mix(color, line, max(thin * 0.35, thick * 0.8));
  color = mix(color, palette.line.rgb, edge * 0.5);
  let strength = select(mix(palette.shape.y, 1.0, edge), palette.shape.x, open);
  return mix(vec4f(unknown, 1.0), vec4f(color * strength, strength), discovered);
}

// no background: zero alpha, what lies under the map shows through (engravings later)
fn backgroundColor(word: u32, local: vec2f, tileDx: vec2f, tileDy: vec2f, tint: vec3f) -> vec4f {
  var crop = materials[map.backgroundMaterialsFrom + tileType(word)].crop;
  if (crop.z == 0.0) {
    return vec4f(0.0);
  }
  crop.x += f32(tileLook(word)) * crop.z;
  let color = sampleCrop(crop, local, tileDx, tileDy, map.backgroundsLayer);
  let gray = vec3f(dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722)));
  let pale = mix(gray, color.rgb, map.backgroundSaturation) * map.backgroundShade;
  return vec4f(pale * tint, color.a);
}

// local: 0..1 inside the crop
// the ores' glimmer: grains: sparkle cells across a tile; flash: how much brighter a sparkle peaks
// than the shine; sharp: the power that keeps a flash short; texture: the ore's own brightness that
// glows least and most, the glow follows its grains instead of a flat color
struct GlowLook {
  grains: f32,
  flash: f32,
  sharp: f32,
  textureLow: f32,
  textureHigh: f32,
  glintDensity: f32,
  glintSpeed: f32,
  emberCells: f32,
  emberSpeed: f32,
  sheenSpeed: f32,
  sheenWidth: f32,
}
// glint: how many times more grains flash than the ore's sparkle, and how much faster; embers: patches
// across a tile that smoulder each on their own, beats a second; sheen: passes a second (it waits two
// passes between), the band's width as a share of the tile
const GLOW_LOOK = GlowLook(28.0, 3.0, 6.0, 0.02, 0.25, 14.0, 2.0, 9.0, 0.35, 0.12, 0.09);
const LUMA: vec3f = vec3f(0.2126, 0.7152, 0.0722);
// BlockData.glow.style, GLOW_STYLES in content/blocks.ts, in the material flags from bit 2
const GLOW_STYLE_SHIFT: u32 = 2u;
// GAME_GLOBALS.sparkleSpeedMax: the material packs the speed as a share of it
const SPARKLE_SPEED_MAX: f32 = 8.0;
const GLOW_STYLE_GLOW: u32 = 0u;
const GLOW_STYLE_GLINT: u32 = 1u;
const GLOW_STYLE_EMBERS: u32 = 2u;

// the ore showing on its own where its mask (the rocksGlow sheet, laid out like the rocks) is white,
// ignoring the light (the fog of war still hides it); the color is its own blended toward the block's.
// glow: lit through, it takes the rock's pixel whole, the brightness following its grains, breathing
// on the tile's own beat with a grain flashing now and then, its brightness reaching the bloom. The
// rest only lay their light over the rock: glint the flashes alone, embers a smoulder in the dark
// cracks, sheen a band sliding over the vein
fn glowColor(word: u32, tile: vec2u, local: vec2f, tileDx: vec2f, tileDy: vec2f, discovered: f32) -> vec4f {
  let blockMaterial = materials[tileType(word)];
  if (blockMaterial.shine <= 0.0 || blockMaterial.crop.z == 0.0) {
    return vec4f(0.0);
  }
  var crop = blockMaterial.crop;
  crop.x += f32(tileLook(word)) * crop.z;
  // a damaged ore dims, nothing glows where it crumbled away
  let damage = tileDamage(word);
  if (chippedAt(vec2i(tile), local)) {
    return vec4f(0.0);
  }
  let left = 1.0 - damage * GLOW_DAMAGE_LOSS;
  let mask = sampleCrop(crop, local, tileDx, tileDy, map.rocksGlowLayer).r * left;
  if (mask <= 0.0) {
    return vec4f(0.0);
  }
  let ore = sampleCrop(crop, local, tileDx, tileDy, map.rocksLayer).rgb;
  let glow = unpack4x8unorm(blockMaterial.glow);
  // the hue only, at brightness 1: the ore's own or the chosen one
  let oreHue = ore / max(dot(ore, LUMA), 0.001);
  let glowHue = glow.rgb / max(dot(glow.rgb, LUMA), 0.001);
  let hue = mix(oreHue, glowHue, glow.a);
  let texture = smoothstep(GLOW_LOOK.textureLow, GLOW_LOOK.textureHigh, dot(ore, LUMA));
  let look = map.glowLook;
  let tileSeed = glowHash(vec2f(tile));
  let style = blockMaterial.flags >> GLOW_STYLE_SHIFT;
  // the share of grains that flash and flashes a second, the block's own or the shared one
  let sparkle = unpack2x16unorm(blockMaterial.sparkle) * vec2f(1.0, SPARKLE_SPEED_MAX);
  materialGlow = discovered;
  if (style == GLOW_STYLE_GLOW) {
    let breathe = 1.0 + look.z * sin((frame.time * look.w + tileSeed) * 6.2832);
    let bright = blockMaterial.shine * (texture * breathe + grainSparkle(tile, local, sparkle.x, sparkle.y));
    return vec4f(hue * bright * mask, mask);
  }
  var bright = 0.0;
  if (style == GLOW_STYLE_GLINT) {
    bright = grainSparkle(tile, local, sparkle.x * GLOW_LOOK.glintDensity, sparkle.y * GLOW_LOOK.glintSpeed);
  } else if (style == GLOW_STYLE_EMBERS) {
    let emberCell = floor(local * GLOW_LOOK.emberCells) + vec2f(tile) * GLOW_LOOK.emberCells;
    let smoulder = 0.55 + 0.45 * sin((frame.time * GLOW_LOOK.emberSpeed + glowHash(emberCell)) * 6.2832);
    bright = smoulder * (1.0 - texture);
  } else {
    let along = (local.x + local.y) * 0.5;
    let center = fract(frame.time * GLOW_LOOK.sheenSpeed + tileSeed) * 3.0 - 1.0;
    let band = exp(-pow((along - center) / GLOW_LOOK.sheenWidth, 2.0));
    bright = band * texture + grainSparkle(tile, local, sparkle.x, sparkle.y);
  }
  bright *= blockMaterial.shine;
  let cover = mask * min(bright, 1.0);
  return vec4f(hue * bright * mask, cover);
}

// a grain flashes in a cycle of its own, and every cycle it rolls again whether it does: the sparkles
// keep moving around the ore instead of blinking in the same spots; density: the share that flashes
fn grainSparkle(tile: vec2u, local: vec2f, density: f32, speed: f32) -> f32 {
  let grain = floor(local * GLOW_LOOK.grains) + vec2f(tile) * GLOW_LOOK.grains;
  let beat = frame.time * speed + glowHash(grain);
  let cycle = floor(beat);
  if (glowHash(grain + vec2f(cycle * 17.31, cycle * 5.13)) >= density) {
    return 0.0;
  }
  return pow(sin(fract(beat) * 3.14159), GLOW_LOOK.sharp) * GLOW_LOOK.flash;
}

// 0-1, no sin: the grain cells reach tens of thousands, where sin loses its precision on the GPU
fn glowHash(cell: vec2f) -> f32 {
  var point = fract(vec3f(cell.xyx) * 0.1031);
  point += dot(point, point.yzx + 33.33);
  return fract((point.x + point.y) * point.z);
}

fn sampleCrop(crop: vec4f, local: vec2f, tileDx: vec2f, tileDy: vec2f, layer: u32) -> vec4f {
  let texelDx = tileDx * crop.zw;
  let texelDy = tileDy * crop.zw;
  let lod = min(0.5 * log2(max(max(dot(texelDx, texelDx), dot(texelDy, texelDy)), 1.0)), MAX_LOD);
  let texelPosition = crop.xy + local * crop.zw;
  // kept inside the crop, or the filter reads the next block of the sheet; the sampler is
  // trilinear, so the inset has to cover the coarser of the two mips it blends
  let texelUv = sharpTexel(texelPosition, abs(texelDx) + abs(texelDy), crop, ceil(lod));
  let uv = texelUv / vec2f(textureDimensions(albedo, 0));
  return textureSampleLevel(albedo, texSampler, uv, layer, lod);
}
