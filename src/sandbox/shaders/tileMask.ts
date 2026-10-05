import Aurora from "@aurora/core";
import Material from "@aurora/material";
import { hasGraphics } from "@sandbox/content/blocks";
import { tileType } from "@sandbox/world/tile";
import { assert } from "@axiom/utils";
import { MAP_GEN_CONFIG } from "@sandbox/mapGen/mapGenerator";
import type World from "@sandbox/world/world";
import tileSolidShader from "@sandbox/shaders/tileSolid.wgsl?raw";

// r8, one texel per map tile: rock where the solid layer draws a tile, air elsewhere
const MASK = { binding: 4, rock: 255, air: 0 };
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

export default class TileMask {
  declare private static texture: GPUTexture;
  declare private static world: World;
  declare private static chunkBytes: Uint8Array;
  declare public static solid: Material;
  declare public static shard: Material;

  // once at start, before Aurora.build: the global (1×1 until a world is bound) and the material.
  // Origin and tile size are baked into the shader, every world has to share them
  public static register() {
    this.texture = this.createTexture({ width: 1, height: 1 });
    Aurora.addGlobal({
      binding: MASK.binding,
      layout: { texture: { sampleType: "float", viewDimension: "2d" } },
      resource: this.texture.createView({ label: "tileMaskView" }),
    });

    const origin = MAP_GEN_CONFIG.start;
    const tileInPixels = MAP_GEN_CONFIG.tileInPixels;
    const map = [
      `@group(0) @binding(${MASK.binding}) var tileMask: texture_2d<f32>;`,
      `const TILE_ORIGIN = vec2f(${origin.x.toFixed(1)}, ${origin.y.toFixed(1)});`,
      `const TILE_SIZE = vec2f(${tileInPixels.width.toFixed(1)}, ${tileInPixels.height.toFixed(1)});`,
    ].join("\n");
    const shader = tileSolidShader.replace("// TILE_MAP", map);
    const entry = (name: string) =>
      shader.replace("// TILE_ENTRY", `fn material(in: MaterialInput) -> vec4f { return ${name}(in); }`);
    this.solid = Material.create({
      name: "tileSolid",
      fragment: entry("solidMaterial"),
      gui: false,
      // damage 0-1, game time of the last hit (far in the past = no flash), where it hit (packImpact),
      // heat 0-1 of the hit: 0 a pick on cold stone, 1 a blast (the cracks around glow); -1 a
      // deflected hit (nothing done, the cracks stay as they are)
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

  // the crack cells cutting the tile, found by sampling it on a grid: a sliver thinner than a
  // sample is missed and simply not drawn
  public static shardsOf(gx: number, gy: number): Shard[] {
    const found = new Map<number, Shard>();
    const sample = 1 / CELLS.samples;
    for (let sy = 0; sy < CELLS.samples; sy++) {
      for (let sx = 0; sx < CELLS.samples; sx++) {
        const fraction = { x: (sx + 0.5) * sample, y: (sy + 0.5) * sample };
        const cell = nearestCell((gx + fraction.x) * CELLS.perTile, (gy + fraction.y) * CELLS.perTile);
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
    this.chunkBytes = new Uint8Array(meta.chunkInTiles.width * meta.chunkInTiles.height);

    const bytes = new Uint8Array(size.width * size.height);
    for (let index = 0; index < bytes.length; index++)
      bytes[index] = this.valueOf(tileType(world.solid[index]));
    Aurora.device.queue.writeTexture(
      { texture: this.texture },
      bytes,
      { bytesPerRow: size.width },
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
    for (let ly = 0; ly < chunkInTiles.height; ly++) {
      const row = world.tileIndex(origin.x, origin.y + ly);
      for (let lx = 0; lx < chunkInTiles.width; lx++)
        this.chunkBytes[lx + ly * chunkInTiles.width] = this.valueOf(tileType(world.solid[row + lx]));
    }
    Aurora.device.queue.writeTexture(
      { texture: this.texture, origin: { x: origin.x, y: origin.y } },
      this.chunkBytes,
      { bytesPerRow: chunkInTiles.width },
      { width: chunkInTiles.width, height: chunkInTiles.height },
    );
  }

  private static createTexture(size: Size2D) {
    return Aurora.device.createTexture({
      label: "tileMask",
      format: "r8unorm",
      size,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
  }

  // a block without graphics (air, void) leaves a hole in the rock
  private static valueOf(type: number) {
    if (!hasGraphics(type)) return MASK.air;
    return MASK.rock;
  }
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
