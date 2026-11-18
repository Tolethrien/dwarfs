import Aurora from "@aurora/core";
import Material from "@aurora/material";
import AxiomColor from "@axiom/color";
import AxiomMath from "@axiom/math";
import { atlasCrops, BlocksID, getBlock, RAMPS, ROCK_ATLAS, type Ramp } from "@sandbox/content/blocks";
import { SPRITES } from "@sandbox/content/sprites";
import { tileType, tileVariant } from "@sandbox/world/tile";
import { assert, loadImg } from "@axiom/utils";
import { MAP_GEN_CONFIG } from "@sandbox/mapGen/mapGenerator";
import { layerAt } from "@sandbox/mapGen/passes/rock";
import type World from "@sandbox/world/world";
import tileSolidShader from "@sandbox/shaders/tileSolid.wgsl?raw";
import tileOcclusionShader from "@sandbox/shaders/tileOcclusion.wgsl?raw";
import { Light } from "@aurora/urp/draw/draw";

// rgba8, one texel per map tile: r = rock where the solid layer draws a tile, air elsewhere;
// g = the tile's palette, the ramp tileSolid.wgsl colours the grey rock atlas with; b = its crop in
// the plate map (PLATES), kept after the tile is mined: its shards still cut along the plates
const MASK = { binding: 4, rock: 255, air: 0, channels: 4 };
// rg8 over the rock rows of the atlas (patterns × features, crop = row × features + column): per
// pixel the offset to the middle of its stone plate, 128 = 0, in steps of step px; the middle sits
// on the same step grid as the pixel centres, so every pixel of a plate gives exactly the same one. A crack cell takes whole
// plates (the cell of the plate's middle), so cracks and shards follow the seams of the texture.
// Plates: pixels brighter (linear) than threshold, shrunk by erode px so thin gaps in a seam still
// split them, smaller than minPixels count as seam; a seam pixel goes to the nearest plate.
// The tile wraps around: a plate across its edge is one plate
const PLATES = { binding: 6, step: 0.5, threshold: 0.12, erode: 1, minPixels: 30, none: 255 };
const BAKED = bakeRamps();
// palette = index into BAKED.ramps (baked into the shader); mixed = how many blend with each other,
// all but obsidian. none must match TILE_RAMP_NONE in tileSolid.wgsl. textureMid = linear
// brightness where the atlas sits on a ramp's mid colour (TILE_RAMP_TOP × TILE_RAMP_MID), for
// tints that copy a ramp
const PALETTE = {
  none: 255,
  rocks: BAKED.rocks,
  mixed: BAKED.ramps.length - 1,
  obsidian: BAKED.ramps.length - 1,
  textureMid: 0.29,
};
const ATLAS = {
  rock: Array.from({ length: ROCK_ATLAS.patterns }, (_, row) => atlasCrops(row, 0, ROCK_ATLAS.features)),
  obsidian: atlasCrops(ROCK_ATLAS.obsidian.row, 0, ROCK_ATLAS.obsidian.variants),
};
// tileSolid impact: x and y (0-1) in steps of 1/255 in one float, must match tileSolid.wgsl
const IMPACT = { steps: 255, row: 256 };
// crack cells per tile, must match TILE_CRACK_CELLS in tileSolid.wgsl; samples per tile side
// when looking for the shards
const CELLS = { perTile: 2.5, samples: 12 };

export interface Shard {
  // lattice coords of the crack cell
  cell: Position2D;
  // middle of its pixels, 0-1 on the tile
  center: Position2D;
  // share of the tile
  share: number;
}

// how a tile is drawn: crop on texture, through the ramp of palette (PALETTE.none = as is), and
// an overlay on top for deposits; plates = the crop in the plate map, PLATES.none off the rock rows
export interface TileLook {
  crop: Crop;
  texture: string;
  palette: number;
  plates: number;
  overlay?: { crop: Crop; tint: RGBA };
}

export default class TileMask {
  declare private static texture: GPUTexture;
  declare private static world: World;
  declare private static chunkBytes: Uint8Array;
  // the plate crop of every map tile, what .b of the mask holds; outlives a mined tile
  declare private static plateCrops: Uint8Array;
  declare private static plates: Uint8Array;
  declare public static rock: Material;
  declare public static solid: Material;
  declare public static overlay: Material;
  declare public static ore: Material;
  declare public static shard: Material;

  // once at start, before Aurora.build: the global (1×1 until a world is bound), the plate map of
  // the rock atlas (rocksUrl), the material and the light occlusion (occluded lights stop at rock).
  // Origin and tile size are baked into the shader, every world has to share them
  public static async register(rocksUrl: string) {
    this.texture = this.createTexture({ width: 1, height: 1 });
    Aurora.addGlobal({
      binding: MASK.binding,
      layout: { texture: { sampleType: "float", viewDimension: "2d" } },
      resource: this.texture.createView({ label: "tileMaskView" }),
    });

    const plateSize = {
      width: ROCK_ATLAS.features * ROCK_ATLAS.tile,
      height: ROCK_ATLAS.patterns * ROCK_ATLAS.tile,
    };
    const image = await loadImg(rocksUrl);
    const canvas = new OffscreenCanvas(plateSize.width, plateSize.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    this.plates = bakePlates(context.getImageData(0, 0, plateSize.width, plateSize.height).data);
    const plateTexture = Aurora.device.createTexture({
      label: "tilePlates",
      format: "rg8unorm",
      size: plateSize,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    Aurora.device.queue.writeTexture(
      { texture: plateTexture },
      this.plates,
      { bytesPerRow: plateSize.width * 2 },
      plateSize,
    );
    Aurora.addGlobal({
      binding: PLATES.binding,
      layout: { texture: { sampleType: "float", viewDimension: "2d" } },
      resource: plateTexture.createView({ label: "tilePlatesView" }),
    });

    const origin = MAP_GEN_CONFIG.start;
    const tileInPixels = MAP_GEN_CONFIG.tileInPixels;
    const map = [
      `@group(0) @binding(${MASK.binding}) var tileMask: texture_2d<f32>;`,
      `const TILE_ORIGIN = vec2f(${origin.x.toFixed(1)}, ${origin.y.toFixed(1)});`,
      `const TILE_SIZE = vec2f(${tileInPixels.width.toFixed(1)}, ${tileInPixels.height.toFixed(1)});`,
    ].join("\n");
    Light.setOcclusion(tileOcclusionShader.replace("// TILE_MAP", map));
    const shader = tileSolidShader.replace("// TILE_MAP", map).replace("// TILE_RAMPS", this.atlasCode());
    const entry = (name: string) =>
      shader.replace("// TILE_ENTRY", `fn material(in: MaterialInput) -> vec4f { return ${name}(in); }`);
    this.rock = Material.create({
      name: "tileRock",
      fragment: entry("rockMaterial"),
      gui: false,
      // damage 0-1, game time of the last hit (far in the past = no flash), where it hit (packImpact),
      // heat 0-1 of the hit: 0 a pick on cold stone, 1 a blast (the cracks around glow); -1 a
      // deflected hit (nothing done, the cracks stay as they are)
      params: { damage: 0, hitTime: -1000, impact: this.packImpact({ x: 0.5, y: 0.5 }), heat: 0 },
    });
    // the same params as rock: a tile swaps between them only through a chunk rebuild
    this.solid = Material.create({
      name: "tileSolid",
      fragment: entry("solidMaterial"),
      gui: false,
      params: { damage: 0, hitTime: -1000, impact: this.packImpact({ x: 0.5, y: 0.5 }), heat: 0 },
    });
    // deposit overlays: soft baked shadows, blended over the rock under them
    this.overlay = Material.create({
      name: "tileOverlay",
      fragment: entry("solidMaterial"),
      transparent: true,
      gui: false,
      params: { damage: 0, hitTime: -1000, impact: this.packImpact({ x: 0.5, y: 0.5 }), heat: 0 },
    });
    this.ore = Material.create({
      name: "tileOre",
      fragment: entry("oreMaterial"),
      transparent: true,
      gui: false,
      params: { damage: 0, hitTime: -1000, impact: this.packImpact({ x: 0.5, y: 0.5 }), heat: 0 },
    });
    this.shard = Material.create({
      name: "tileShard",
      fragment: entry("shardMaterial"),
      transparent: true,
      gui: false,
      params: { tileX: 0, tileY: 0, cellX: 0, cellY: 0 },
    });
  }

  // type and variant given: a mined tile is already air in the world
  public static lookOf(gx: number, gy: number, type: number, variant: number): TileLook | null {
    const look = getBlock(type).look;
    if (look.kind === "none") return null;
    if (look.kind === "sprite") {
      const crop = look.variants[variant] ?? look.variants[0];
      return { crop, texture: SPRITES.blocks, palette: PALETTE.none, plates: PLATES.none };
    }
    if (look.kind === "obsidian") {
      const obsidian = ROCK_ATLAS.obsidian;
      const column = pickColumn(cellHash(gx + 613, gy + 89), obsidian.plain, obsidian.variants);
      return { crop: ATLAS.obsidian[column], texture: SPRITES.rocks, palette: PALETTE.obsidian, plates: PLATES.none };
    }

    const palette = this.paletteOf(gx, gy, type, variant);
    const pattern = BAKED.ramps[palette].pattern;
    if (look.kind === "rock") {
      const column = pickColumn(cellHash(gx + 4099, gy + 811), ROCK_ATLAS.plain, ROCK_ATLAS.features);
      const plates = pattern * ROCK_ATLAS.features + column;
      return { crop: ATLAS.rock[pattern][column], texture: SPRITES.rocks, palette, plates };
    }
    const pick = Math.min(look.overlays.length - 1, Math.floor(cellHash(gx + 211, gy + 7) * look.overlays.length));
    return {
      crop: ATLAS.rock[pattern][0],
      texture: SPRITES.rocks,
      palette,
      plates: pattern * ROCK_ATLAS.features,
      overlay: { crop: look.overlays[pick], tint: look.tint },
    };
  }

  // a multiply tint close to what the ramp gives, for sprites that cannot run it (flying shards)
  public static tintOf(palette: number): RGBA {
    const ramp = BAKED.ramps[palette];
    if (!ramp) return [255, 255, 255, 255];
    const channel = (index: number) => Math.round(AxiomColor.linearToSrgb(ramp.mid[index] / PALETTE.textureMid));
    return [channel(0), channel(1), channel(2), 255];
  }

  // the crack cells cutting the tile, found by sampling it on a grid: a sliver thinner than a
  // sample is missed and simply not drawn. plates: TileLook.plates of the tile, as the shader cuts
  // it (tilePlateMiddle)
  public static shardsOf(gx: number, gy: number, plates: number): Shard[] {
    const found = new Map<number, Shard>();
    const sample = 1 / CELLS.samples;
    const tile = ROCK_ATLAS.tile;
    const rowWidth = ROCK_ATLAS.features * tile;
    for (let sy = 0; sy < CELLS.samples; sy++) {
      for (let sx = 0; sx < CELLS.samples; sx++) {
        const fraction = { x: (sx + 0.5) * sample, y: (sy + 0.5) * sample };
        const middle = { x: gx + fraction.x, y: gy + fraction.y };
        if (plates !== PLATES.none) {
          const pixel = { x: Math.floor(fraction.x * tile), y: Math.floor(fraction.y * tile) };
          const atlasX = (plates % ROCK_ATLAS.features) * tile + pixel.x;
          const atlasY = Math.floor(plates / ROCK_ATLAS.features) * tile + pixel.y;
          const at = (atlasX + atlasY * rowWidth) * 2;
          middle.x = gx + (pixel.x + 0.5 + (this.plates[at] - 128) * PLATES.step) / tile;
          middle.y = gy + (pixel.y + 0.5 + (this.plates[at + 1] - 128) * PLATES.step) / tile;
        }
        const cell = nearestCell(middle.x * CELLS.perTile, middle.y * CELLS.perTile);
        // lattice coords stay far below 2^16 on any map
        const key = cell.x * 65536 + cell.y;
        const shard = found.get(key) ?? { cell, center: { x: 0, y: 0 }, share: 0 };
        shard.center.x += fraction.x;
        shard.center.y += fraction.y;
        shard.share++;
        found.set(key, shard);
      }
    }
    const shards = [...found.values()];
    for (const shard of shards) {
      shard.center.x /= shard.share;
      shard.center.y /= shard.share;
      shard.share /= CELLS.samples * CELLS.samples;
    }
    return shards;
  }

  // fraction: 0-1 on the tile
  public static packImpact(fraction: Position2D) {
    return Math.round(fraction.x * IMPACT.steps) + Math.round(fraction.y * IMPACT.steps) * IMPACT.row;
  }

  // every loaded world: a texture of its size swapped under the same global, no render graph rebuild
  public static bind(world: World) {
    const meta = world.meta;
    assert(
      meta.origin.x === MAP_GEN_CONFIG.start.x &&
        meta.origin.y === MAP_GEN_CONFIG.start.y &&
        meta.tileInPixels.width === MAP_GEN_CONFIG.tileInPixels.width &&
        meta.tileInPixels.height === MAP_GEN_CONFIG.tileInPixels.height,
      "TileMask: the world's origin / tile size differ from the ones baked into the tileSolid shader",
    );
    this.world = world;
    const size = world.mapInTiles;
    const previous = this.texture;
    this.texture = this.createTexture(size);
    this.chunkBytes = new Uint8Array(meta.chunkInTiles.width * meta.chunkInTiles.height * MASK.channels);
    this.plateCrops = new Uint8Array(size.width * size.height).fill(PLATES.none);

    const bytes = new Uint8Array(size.width * size.height * MASK.channels);
    for (let gy = 0; gy < size.height; gy++)
      for (let gx = 0; gx < size.width; gx++) this.writeTexel(bytes, (gx + gy * size.width) * MASK.channels, gx, gy);
    Aurora.device.queue.writeTexture(
      { texture: this.texture },
      bytes,
      { bytesPerRow: size.width * MASK.channels },
      size,
    );

    Aurora.setGlobalResource(MASK.binding, this.texture.createView({ label: "tileMaskView" }));
    previous.destroy();
  }

  // the chunk's region from the solid layer, called when its batch is rebuilt
  public static writeChunk(chunkIndex: number) {
    const world = this.world;
    const chunkInTiles = world.meta.chunkInTiles;
    const origin = world.chunkOrigin(chunkIndex);
    for (let ly = 0; ly < chunkInTiles.height; ly++)
      for (let lx = 0; lx < chunkInTiles.width; lx++)
        this.writeTexel(this.chunkBytes, (lx + ly * chunkInTiles.width) * MASK.channels, origin.x + lx, origin.y + ly);
    Aurora.device.queue.writeTexture(
      { texture: this.texture, origin: { x: origin.x, y: origin.y } },
      this.chunkBytes,
      { bytesPerRow: chunkInTiles.width * MASK.channels },
      { width: chunkInTiles.width, height: chunkInTiles.height },
    );
  }

  private static createTexture(size: Size2D) {
    return Aurora.device.createTexture({
      label: "tileMask",
      format: "rgba8unorm",
      size,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
  }

  // a block without graphics (air, void) leaves a hole in the rock
  private static writeTexel(bytes: Uint8Array, at: number, gx: number, gy: number) {
    const index = this.world.tileIndex(gx, gy);
    const raw = this.world.solid[index];
    const look = this.lookOf(gx, gy, tileType(raw), tileVariant(raw));
    if (look) this.plateCrops[index] = look.plates;
    bytes[at] = look ? MASK.rock : MASK.air;
    bytes[at + 1] = look ? look.palette : PALETTE.none;
    bytes[at + 2] = this.plateCrops[index];
  }

  // rock: its variant; a deposit or a sprite takes the rock next to it, else the rock layer's at
  // its depth (the generator's first rock there)
  private static paletteOf(gx: number, gy: number, type: number, variant: number): number {
    const kind = getBlock(type).look.kind;
    if (kind === "none") return PALETTE.none;
    if (kind === "obsidian") return PALETTE.obsidian;
    if (kind === "rock") return variant < PALETTE.rocks ? variant : 0;
    const rock = this.rockAround(gx, gy);
    const deposit = BAKED.deposits.get(type);
    if (deposit === undefined) return rock;
    return PALETTE.rocks * (1 + deposit) + rock;
  }

  // the rock next to the tile, else the rock layer's at its depth (the generator's first rock there)
  private static rockAround(gx: number, gy: number) {
    for (const [dx, dy] of NEIGHBOURS) {
      if (getBlock(this.world.getType(gx + dx, gy + dy)).look.kind !== "rock") continue;
      const near = this.world.getVariant(gx + dx, gy + dy);
      return near < PALETTE.rocks ? near : 0;
    }
    const layers = MAP_GEN_CONFIG.rock.layers;
    const layer = layers[layerAt(layers, gy / this.world.mapInTiles.height)];
    const fallback = tileVariant(layer.rocks[0]);
    return fallback < PALETTE.rocks ? fallback : 0;
  }

  // what tileSolid.wgsl needs to know of the rock atlas: the ramps and the plate map
  private static atlasCode() {
    const vec = (color: RGB) => `vec3f(${color.map((channel) => channel.toFixed(5)).join(", ")})`;
    const ramps = BAKED.ramps;
    const list = ramps.map((ramp) => `TileRamp(${vec(ramp.shadow)}, ${vec(ramp.mid)}, ${vec(ramp.light)})`);
    return [
      `var<private> TILE_RAMPS: array<TileRamp, ${ramps.length}> = array<TileRamp, ${ramps.length}>(${list.join(", ")});`,
      `const TILE_RAMP_ROCKS: u32 = ${PALETTE.mixed}u;`,
      `const TILE_RAMP_OBSIDIAN: u32 = ${PALETTE.obsidian}u;`,
      `@group(0) @binding(${PLATES.binding}) var tilePlates: texture_2d<f32>;`,
      `const TILE_PLATE_TILE: f32 = ${ROCK_ATLAS.tile.toFixed(1)};`,
      `const TILE_PLATE_COLUMNS: u32 = ${ROCK_ATLAS.features}u;`,
      `const TILE_PLATE_STEP: f32 = ${PLATES.step.toFixed(3)};`,
      `const TILE_PLATE_NONE: u32 = ${PLATES.none}u;`,
    ].join("\n");
  }
}

// the plate map (PLATES) of the rock rows, from the atlas pixels (rgba, srgb) of those rows
function bakePlates(pixels: Uint8ClampedArray): Uint8Array {
  const tile = ROCK_ATLAS.tile;
  const width = ROCK_ATLAS.features * tile;
  const area = tile * tile;
  const out = new Uint8Array(width * ROCK_ATLAS.patterns * tile * 2);
  const bright = new Float32Array(area);
  const solid = new Uint8Array(area);
  const label = new Int32Array(area);
  // coords unwrapped across the tile's edges, so a plate across one has one middle
  const unwrapped = new Int32Array(area * 2);
  const wrap = (value: number) => (value + tile) % tile;
  const sides = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let row = 0; row < ROCK_ATLAS.patterns; row++) {
    for (let column = 0; column < ROCK_ATLAS.features; column++) {
      for (let y = 0; y < tile; y++)
        for (let x = 0; x < tile; x++) {
          const at = ((row * tile + y) * width + column * tile + x) * 4;
          bright[x + y * tile] =
            0.2126 * AxiomColor.srgbToLinear(pixels[at]) +
            0.7152 * AxiomColor.srgbToLinear(pixels[at + 1]) +
            0.0722 * AxiomColor.srgbToLinear(pixels[at + 2]);
        }
      for (let y = 0; y < tile; y++)
        for (let x = 0; x < tile; x++) {
          let inside = 1;
          for (let dy = -PLATES.erode; dy <= PLATES.erode && inside; dy++)
            for (let dx = -PLATES.erode; dx <= PLATES.erode; dx++)
              if (bright[wrap(x + dx) + wrap(y + dy) * tile] < PLATES.threshold) {
                inside = 0;
                break;
              }
          solid[x + y * tile] = inside;
        }

      label.fill(-1);
      const middles: { x: number; y: number; size: number }[] = [];
      for (let start = 0; start < area; start++) {
        if (label[start] !== -1 || !solid[start]) continue;
        const id = middles.length;
        const middle = { x: 0, y: 0, size: 0 };
        label[start] = id;
        unwrapped[start * 2] = start % tile;
        unwrapped[start * 2 + 1] = Math.floor(start / tile);
        const stack = [start];
        while (stack.length > 0) {
          const pixel = stack.pop()!;
          const ux = unwrapped[pixel * 2];
          const uy = unwrapped[pixel * 2 + 1];
          middle.x += ux;
          middle.y += uy;
          middle.size++;
          for (const [dx, dy] of sides) {
            const next = wrap(ux + dx) + wrap(uy + dy) * tile;
            if (label[next] !== -1 || !solid[next]) continue;
            label[next] = id;
            unwrapped[next * 2] = ux + dx;
            unwrapped[next * 2 + 1] = uy + dy;
            stack.push(next);
          }
        }
        middles.push(middle);
      }
      for (let pixel = 0; pixel < area; pixel++)
        if (label[pixel] !== -1 && middles[label[pixel]].size < PLATES.minPixels) label[pixel] = -1;

      // seam pixels go to the nearest plate, spreading out from all of them at once
      const queue: number[] = [];
      for (let pixel = 0; pixel < area; pixel++) if (label[pixel] !== -1) queue.push(pixel);
      for (let head = 0; head < queue.length; head++) {
        const pixel = queue[head];
        const ux = unwrapped[pixel * 2];
        const uy = unwrapped[pixel * 2 + 1];
        for (const [dx, dy] of sides) {
          const next = wrap(ux + dx) + wrap(uy + dy) * tile;
          if (label[next] !== -1) continue;
          label[next] = label[pixel];
          unwrapped[next * 2] = ux + dx;
          unwrapped[next * 2 + 1] = uy + dy;
          queue.push(next);
        }
      }

      for (let pixel = 0; pixel < area; pixel++) {
        const at = ((row * tile + Math.floor(pixel / tile)) * width + column * tile + (pixel % tile)) * 2;
        const middle = middles[label[pixel]];
        // no plate in the whole tile: every pixel its own middle
        if (!middle) {
          out[at] = 128;
          out[at + 1] = 128;
          continue;
        }
        // offsets in steps, the middle snapped to the step grid (pixel centres sit on it)
        const encode = (sum: number, own: number) =>
          AxiomMath.clamp(128 + Math.round((sum / middle.size - own) / PLATES.step), 0, 255);
        out[at] = encode(middle.x, unwrapped[pixel * 2]);
        out[at + 1] = encode(middle.y, unwrapped[pixel * 2 + 1]);
      }
    }
  }
  return out;
}

interface LinearRamp {
  pattern: number;
  shadow: RGB;
  mid: RGB;
  light: RGB;
}

// every ramp in palette order, linear: the rock variants (ROCK), then for each deposit all of them
// stained by it (the rock under a deposit), then obsidian
function bakeRamps() {
  const rocks = Array.from({ length: Object.keys(RAMPS.rock).length }, (_, index) => RAMPS.rock[index]);
  assert(rocks.every(Boolean), "TileMask: RAMPS.rock must have a ramp for every variant 0..n-1");
  const linear = (ramp: Ramp, stain: RGB = [1, 1, 1]): LinearRamp => {
    const convert = (color: RGBA): RGB =>
      [0, 1, 2].map((index) => Math.min(1, AxiomColor.srgbToLinear(color[index]) * stain[index])) as RGB;
    return { pattern: ramp.pattern, shadow: convert(ramp.shadow), mid: convert(ramp.mid), light: convert(ramp.light) };
  };

  const ramps = rocks.map((ramp) => linear(ramp));
  const deposits = new Map<number, number>();
  for (const id of Object.values(BlocksID)) {
    if (typeof id !== "number") continue;
    const look = getBlock(id).look;
    if (look.kind !== "deposit") continue;
    deposits.set(id, deposits.size);
    ramps.push(...rocks.map((ramp) => linear(ramp, look.stain)));
  }
  ramps.push(linear(RAMPS.obsidian));
  assert(ramps.length < 255, "TileMask: more ramps than the tileMask palette byte holds");
  return { ramps, rocks: rocks.length, deposits };
}

const NEIGHBOURS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// 0 = plain with the chance plain, else one of the other columns
function pickColumn(hash: number, plain: number, columns: number) {
  if (hash < plain) return 0;
  return 1 + Math.min(columns - 2, Math.floor(((hash - plain) / (1 - plain)) * (columns - 1)));
}

// tileHash in tileSolid.wgsl: u32 math through Math.imul, the same bits as on the GPU
function cellHash(x: number, y: number) {
  let hash = (Math.imul(x, 1597334677) ^ Math.imul(y, 3812015801)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 2246822519) >>> 0;
  hash = (hash ^ (hash >>> 13)) >>> 0;
  return hash / 4294967295;
}

// tileCell in tileSolid.wgsl; point in cells
function nearestCell(px: number, py: number): Position2D {
  const baseX = Math.floor(px);
  const baseY = Math.floor(py);
  let nearest = { x: baseX, y: baseY };
  let first = Infinity;
  for (let y = baseY - 1; y <= baseY + 1; y++) {
    for (let x = baseX - 1; x <= baseX + 1; x++) {
      const seedX = x + cellHash(x, y);
      const seedY = y + cellHash(x + 17, y + 31);
      const gap = Math.hypot(px - seedX, py - seedY);
      if (gap < first) {
        first = gap;
        nearest = { x, y };
      }
    }
  }
  return nearest;
}
