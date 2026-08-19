import { LoadedMap } from "@/backend/IPC/streaming";
import Grid from "@/core/axiom/grid";
import Vec2 from "@/core/axiom/vec2";
import { BLOCK_NAMES } from "@/sandbox/data";
import { assert } from "@/utils/utils";

export interface TileHit {
  rect: Rect;
  gx: number;
  gy: number;
  type: number;
}

const AIR = BLOCK_NAMES.indexOf("air");
const OUT_OF_BOUNDS = BLOCK_NAMES.indexOf("bedrock");
const MAX_RAYCAST_TILES = 64;

export default class MapObject {
  declare private static original: Uint8Array;
  declare private static working: Uint8Array;
  declare private static mapConfig: LoadedMap["header"];
  declare private static chunkVersions: Uint32Array;
  declare private static blocksPerChunk: number;
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
    const { chunkInTiles, mapInChunks } = data.header;

    this.mapConfig = data.header;
    this.original = data.data;
    this.working = new Uint8Array(data.data);

    this.blocksPerChunk = chunkInTiles.width * chunkInTiles.height;
    this.chunkVersions = new Uint32Array(
      mapInChunks.width * mapInChunks.height,
    );
    this.origin = data.header.start;

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

  public static tileToWorld(tile: Position2D): Position2D {
    const { tileInPixels } = this.mapConfig;
    return {
      x: this.origin.x + tile.x * tileInPixels.width,
      y: this.origin.y + tile.y * tileInPixels.height,
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

  private static tileOffset(gx: number, gy: number) {
    const { chunkInTiles, mapInTiles, mapInChunks, BYTES_PER_BLOCK } =
      this.mapConfig;

    if (gx < 0 || gy < 0 || gx >= mapInTiles.width || gy >= mapInTiles.height)
      return -1;

    const cx = Math.floor(gx / chunkInTiles.width);
    const cy = Math.floor(gy / chunkInTiles.height);
    const chunkIndex = cy * mapInChunks.width + cx;
    const localIndex =
      (gy - cy * chunkInTiles.height) * chunkInTiles.width +
      (gx - cx * chunkInTiles.width);

    return (chunkIndex * this.blocksPerChunk + localIndex) * BYTES_PER_BLOCK;
  }

  public static chunkIndexOfTile(gx: number, gy: number) {
    const { chunkInTiles, mapInChunks } = this.mapConfig;
    const cx = Math.floor(gx / chunkInTiles.width);
    const cy = Math.floor(gy / chunkInTiles.height);
    return cy * mapInChunks.width + cx;
  }

  public static getTileType(gx: number, gy: number) {
    const offset = this.tileOffset(gx, gy);
    return offset === -1 ? OUT_OF_BOUNDS : this.working[offset];
  }

  public static getTileDamage(gx: number, gy: number) {
    const offset = this.tileOffset(gx, gy);
    return offset === -1 ? 0 : this.working[offset + 1];
  }
  //THIS IS WINDOW FOR DATA - DO NOT COPY IT - ALWAYS WORK ON WINDOW
  public static getChunkData(chunkIndex: number) {
    const start =
      chunkIndex * this.blocksPerChunk * this.mapConfig.BYTES_PER_BLOCK;
    const length = this.blocksPerChunk * this.mapConfig.BYTES_PER_BLOCK;
    return this.working.subarray(start, start + length);
  }

  public static getChunkVersion(chunkIndex: number) {
    return this.chunkVersions[chunkIndex];
  }

  public static setTile(gx: number, gy: number, type: number, damage: number) {
    const offset = this.tileOffset(gx, gy);
    if (offset === -1) return;

    this.working[offset] = type;
    this.working[offset + 1] = damage;
    this.chunkVersions[this.chunkIndexOfTile(gx, gy)]++;
  }

  public static resetToOriginal() {
    this.working.set(this.original);
    for (let i = 0; i < this.chunkVersions.length; i++) this.chunkVersions[i]++;
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
        if (type === AIR) continue;
        assert(
          this.result.length < MAX_RAYCAST_TILES,
          `error with raycast pool size overflow! ball was to fast or to big! change pool size! size: ${MAX_RAYCAST_TILES}`,
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
