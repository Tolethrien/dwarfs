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

export default class TileMask {
  declare private static texture: GPUTexture;
  declare private static world: World;
  declare private static chunkBytes: Uint8Array;
  declare public static solid: Material;

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
    this.solid = Material.create({
      name: "tileSolid",
      fragment: tileSolidShader.replace("// TILE_MAP", map),
      gui: false,
      // damage 0-1, game time of the last hit (far in the past = no flash)
      params: { damage: 0, hitTime: -1000 },
    });
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
