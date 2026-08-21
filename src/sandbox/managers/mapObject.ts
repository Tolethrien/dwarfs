import { LoadedMap } from "@/backend/IPC/streaming";
import Grid from "@/core/axiom/grid";
import Vec2 from "@/core/axiom/vec2";
import { assert } from "@/utils/utils";
import EntitiesObject, { BlocksID } from "./entitiesObject";

export interface TileHit {
  rect: Rect;
  gx: number;
  gy: number;
  type: number;
}
//map layers
export enum LAYER {
  background,
  decoBack,
  solid,
  decoFront,
}

export const MAX_DAMAGE = 65535;
const SKY_MARGIN = 300;
const MAX_RAYCAST_TILES = 64;

export default class MapObject {
  declare private static layers: Uint16Array[];
  declare private static damage: Uint16Array;
  declare private static discovered: Uint8Array;
  declare private static biome: Uint8Array;

  declare private static mapConfig: LoadedMap["header"];
  declare private static chunkVersions: Uint32Array;
  declare private static origin: Position2D;

  private static hitPool: TileHit[] = Array.from(
    { length: MAX_RAYCAST_TILES },
    () => ({
      rect: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      gx: 0,
      gy: 0,
      type: 0,
    }),
  );
  private static result: TileHit[] = [];

  public static async loadMap(path: string) {
    const data = await window.API.STREAMING.loadMapFromFile(path);
    const { totalBlocks, totalChunks, offsets, start } = data.header;
    const bytes = data.data;

    const blocks = (offset: number) =>
      new Uint16Array(bytes.buffer, bytes.byteOffset + offset, totalBlocks);
    const chunks = (offset: number) =>
      new Uint8Array(bytes.buffer, bytes.byteOffset + offset, totalChunks);

    this.mapConfig = data.header;
    this.origin = start;

    this.layers = [
      blocks(offsets.background),
      blocks(offsets.decoBack),
      blocks(offsets.solidType),
      blocks(offsets.decoFront),
    ];
    this.damage = blocks(offsets.solidDamage);
    this.discovered = chunks(offsets.discovered);
    this.biome = chunks(offsets.biome);

    this.chunkVersions = new Uint32Array(totalChunks);

    console.log("loaded map", data.header);
  }

  public static get mapMeta() {
    return this.mapConfig;
  }

  public static worldToTile(pos: Position2D): Position2D {
    const { tileInPixels } = this.mapConfig;
    return {
      x: Math.floor((pos.x - this.origin.x) / tileInPixels.width),
      y: Math.floor((pos.y - this.origin.y) / tileInPixels.height),
    };
  }

  public static tileCenterToWorld(tile: Position2D): Position2D {
    const { tileInPixels } = this.mapConfig;
    return {
      x: this.origin.x + tile.x * tileInPixels.width + tileInPixels.width / 2,
      y: this.origin.y + tile.y * tileInPixels.height + tileInPixels.height / 2,
    };
  }

  public static chunkToWorld(chunkIndex: number): Position2D {
    const { mapInChunks, chunkInPixels } = this.mapConfig;
    const c = Grid.indexToTile(chunkIndex, mapInChunks.width);
    return {
      x: this.origin.x + c.x * chunkInPixels.width,
      y: this.origin.y + c.y * chunkInPixels.height,
    };
  }

  public static worldToChunkTile(pos: Position2D): Position2D {
    const { chunkInPixels } = this.mapConfig;
    return {
      x: Math.floor((pos.x - this.origin.x) / chunkInPixels.width),
      y: Math.floor((pos.y - this.origin.y) / chunkInPixels.height),
    };
  }

  public static getWorldBounds(): Box {
    const { mapInPixels } = this.mapConfig;
    return {
      x: this.origin.x,
      y: this.origin.y - SKY_MARGIN,
      w: mapInPixels.width,
      h: mapInPixels.height + SKY_MARGIN,
    };
  }

  private static tileIndex(gx: number, gy: number) {
    const { chunkInTiles, mapInTiles, mapInChunks, blocksPerChunk } =
      this.mapConfig;

    if (gx < 0 || gy < 0 || gx >= mapInTiles.width || gy >= mapInTiles.height)
      return -1;

    const cx = Math.floor(gx / chunkInTiles.width);
    const cy = Math.floor(gy / chunkInTiles.height);
    const localIndex =
      (gy - cy * chunkInTiles.height) * chunkInTiles.width +
      (gx - cx * chunkInTiles.width);

    return (cy * mapInChunks.width + cx) * blocksPerChunk + localIndex;
  }

  public static chunkIndexOfTile(gx: number, gy: number) {
    const { chunkInTiles, mapInChunks } = this.mapConfig;
    return (
      Math.floor(gy / chunkInTiles.height) * mapInChunks.width +
      Math.floor(gx / chunkInTiles.width)
    );
  }

  public static getTileType(gx: number, gy: number, layer = LAYER.solid) {
    const index = this.tileIndex(gx, gy);
    if (index === -1)
      return layer === LAYER.solid ? BlocksID.bedrock : BlocksID.air;
    return this.layers[layer][index];
  }

  public static getTileDamage(gx: number, gy: number) {
    const index = this.tileIndex(gx, gy);
    return index === -1 ? 0 : this.damage[index];
  }

  //THIS IS WINDOW FOR DATA - DO NOT COPY IT - ALWAYS WORK ON WINDOW
  public static getChunkData(layer: LAYER, chunkIndex: number) {
    const { blocksPerChunk } = this.mapConfig;
    const start = chunkIndex * blocksPerChunk;
    return this.layers[layer].subarray(start, start + blocksPerChunk);
  }
  //THIS IS WINDOW FOR DATA - DO NOT COPY IT - ALWAYS WORK ON WINDOW
  public static getChunkDamage(chunkIndex: number) {
    const { blocksPerChunk } = this.mapConfig;
    const start = chunkIndex * blocksPerChunk;
    return this.damage.subarray(start, start + blocksPerChunk);
  }

  public static isDiscovered(chunkIndex: number) {
    return this.discovered[chunkIndex] === 1;
  }

  public static getBiome(chunkIndex: number) {
    return this.biome[chunkIndex];
  }

  public static getChunkVersion(chunkIndex: number) {
    return this.chunkVersions[chunkIndex];
  }

  public static setTile(gx: number, gy: number, type: number, damage: number) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return;

    this.layers[LAYER.solid][index] = type;
    this.damage[index] = damage;
    this.chunkVersions[this.chunkIndexOfTile(gx, gy)]++;
  }

  public static setDiscovered(chunkIndex: number) {
    if (chunkIndex < 0 || chunkIndex >= this.discovered.length) return;
    this.discovered[chunkIndex] = 1;
  }

  public static getTilesForRaycast(
    rayOrigin: Position2D,
    direction: Vec2,
    distance: number,
    radius = 0,
  ): TileHit[] {
    const tileSize = this.mapConfig.tileInPixels;
    const endX = rayOrigin.x + direction.x * distance;
    const endY = rayOrigin.y + direction.y * distance;

    const min = this.worldToTile({
      x: Math.min(rayOrigin.x, endX) - radius,
      y: Math.min(rayOrigin.y, endY) - radius,
    });
    const max = this.worldToTile({
      x: Math.max(rayOrigin.x, endX) + radius,
      y: Math.max(rayOrigin.y, endY) + radius,
    });

    this.result.length = 0;

    for (let gy = min.y; gy <= max.y; gy++) {
      for (let gx = min.x; gx <= max.x; gx++) {
        const type = this.getTileType(gx, gy);
        if (!EntitiesObject.getBlock(type).solid) continue;

        assert(
          this.result.length < MAX_RAYCAST_TILES,
          `raycast pool overflow (${MAX_RAYCAST_TILES}) — ball too big or too fast`,
        );

        const hit = this.hitPool[this.result.length];
        const center = this.tileCenterToWorld({ x: gx, y: gy });

        hit.rect.x = center.x;
        hit.rect.y = center.y;
        hit.rect.w = tileSize.width;
        hit.rect.h = tileSize.height;
        hit.gx = gx;
        hit.gy = gy;
        hit.type = type;

        this.result.push(hit);
      }
    }

    return this.result;
  }
}
