import Aurora from "@aurora/core";
import Material from "@aurora/material";
import EntitiesObject from "@sandbox/managers/entitiesObject";
import MapObject, { LAYER } from "@sandbox/managers/mapObject";
import tileSolidShader from "@sandbox/shaders/tileSolid.wgsl?raw";

// r8, one texel per map tile: rock where the solid layer draws a tile, air elsewhere
const MASK = { binding: 4, rock: 255, air: 0 };

export default class TileMask {
  declare private static texture: GPUTexture;
  declare private static chunkBytes: Uint8Array;
  declare public static solid: Material;

  // after MapObject.generate, before Aurora.build (the global and the material join the first build)
  public static init() {
    const { mapInTiles, chunkInTiles, tileInPixels } = MapObject.mapMeta;
    this.texture = Aurora.device.createTexture({
      label: "tileMask",
      format: "r8unorm",
      size: { width: mapInTiles.width, height: mapInTiles.height },
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.chunkBytes = new Uint8Array(chunkInTiles.width * chunkInTiles.height);

    const bytes = new Uint8Array(mapInTiles.width * mapInTiles.height);
    for (let gy = 0; gy < mapInTiles.height; gy++) {
      for (let gx = 0; gx < mapInTiles.width; gx++) {
        bytes[gy * mapInTiles.width + gx] = this.valueOf(
          MapObject.getTileType(gx, gy, LAYER.solid),
        );
      }
    }
    Aurora.device.queue.writeTexture(
      { texture: this.texture },
      bytes,
      { bytesPerRow: mapInTiles.width },
      { width: mapInTiles.width, height: mapInTiles.height },
    );

    Aurora.addGlobal({
      binding: MASK.binding,
      layout: { texture: { sampleType: "float", viewDimension: "2d" } },
      resource: this.texture.createView({ label: "tileMaskView" }),
    });

    const origin = MapObject.chunkToWorld(0);
    const map = [
      `@group(0) @binding(${MASK.binding}) var tileMask: texture_2d<f32>;`,
      `const TILE_ORIGIN = vec2f(${origin.x.toFixed(1)}, ${origin.y.toFixed(1)});`,
      `const TILE_SIZE = vec2f(${tileInPixels.width.toFixed(1)}, ${tileInPixels.height.toFixed(1)});`,
    ].join("\n");
    this.solid = Material.create({
      name: "tileSolid",
      fragment: tileSolidShader.replace("// TILE_MAP", map),
      gui: false,
    });
  }

  // the chunk's region from the solid layer, called when its batch is rebuilt
  public static writeChunk(chunkIndex: number) {
    const { chunkInTiles, mapInChunks } = MapObject.mapMeta;
    const data = MapObject.getChunkData(LAYER.solid, chunkIndex);
    for (let index = 0; index < data.length; index++) {
      this.chunkBytes[index] = this.valueOf(data[index]);
    }
    Aurora.device.queue.writeTexture(
      {
        texture: this.texture,
        origin: {
          x: (chunkIndex % mapInChunks.width) * chunkInTiles.width,
          y: Math.floor(chunkIndex / mapInChunks.width) * chunkInTiles.height,
        },
      },
      this.chunkBytes,
      { bytesPerRow: chunkInTiles.width },
      { width: chunkInTiles.width, height: chunkInTiles.height },
    );
  }

  // same rule as TileLayer: air and spawn blocks (drawn as actors) leave a hole in the rock
  private static valueOf(type: number) {
    if (type === 0 || EntitiesObject.getBlock(type).spawn) return MASK.air;
    return MASK.rock;
  }
}
