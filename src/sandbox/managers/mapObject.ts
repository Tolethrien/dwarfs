import Grid from "@axiom/grid";
import Vec2 from "@axiom/vec2";
import { assert } from "@axiom/utils";
import EntitiesObject, { BlocksID } from "./entitiesObject";
import { Camera } from "@engine/camera/camera";
import InputManager from "@engine/inputManager";
import { debug } from "@debug";
import {
  chunkMajorIndex,
  generateMap,
  MAP_GEN_CONFIG,
  MapGenConfig,
  MapMeta,
} from "../mapGen/mapGenerator";

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
const EFFECT_VISIBILITY_MARGIN = 2;
export default class MapObject {
  declare private static layers: Uint16Array[];
  declare private static damage: Uint16Array;
  declare private static discovered: Uint8Array;
  declare private static biome: Uint8Array;

  declare private static mapConfig: MapMeta;
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

  public static generate(seed: number, config: MapGenConfig) {
    const map = debug.mapGen.measure(() => generateMap(seed, config));

    this.mapConfig = map.meta;
    this.origin = map.meta.start;
    this.layers = [map.background, map.decoBack, map.solid, map.decoFront];
    this.damage = map.damage;
    this.discovered = map.discovered;
    this.biome = map.biome;
    this.chunkVersions = new Uint32Array(map.meta.totalChunks);

    debug.mapGen.connect({
      seed,
      config,
      defaults: MAP_GEN_CONFIG,
      map,
      blocks: BlocksID,
    });
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
    const { mapInTiles } = this.mapConfig;
    if (gx < 0 || gy < 0 || gx >= mapInTiles.width || gy >= mapInTiles.height)
      return -1;
    return chunkMajorIndex(this.mapConfig, gx, gy);
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
      return layer === LAYER.solid ? BlocksID.obsidian : BlocksID.air;
    return this.layers[layer][index];
  }

  public static getTileDamage(gx: number, gy: number) {
    const index = this.tileIndex(gx, gy);
    return index === -1 ? 0 : this.damage[index];
  }
  public static isTileVisible(gx: number, gy: number): boolean {
    const view = Camera.getViewBounds;
    const pos = this.tileCenterToWorld({ x: gx, y: gy });
    const { tileInPixels } = this.mapConfig;

    const marginX = tileInPixels.width * EFFECT_VISIBILITY_MARGIN;
    const marginY = tileInPixels.height * EFFECT_VISIBILITY_MARGIN;
    const halfW = tileInPixels.width / 2;
    const halfH = tileInPixels.height / 2;

    return !(
      pos.x + halfW < view.min.x - marginX ||
      pos.y + halfH < view.min.y - marginY ||
      pos.x - halfW > view.max.x + marginX ||
      pos.y - halfH > view.max.y + marginY
    );
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
  public static mouseToTile(): Position2D {
    const mouse = InputManager.getMousePos();
    return this.worldToTile(Camera.screenToWorld(mouse));
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

    // the version marks a type change only, damage alone is patched in place (tileDamaged)
    if (this.layers[LAYER.solid][index] !== type)
      this.chunkVersions[this.chunkIndexOfTile(gx, gy)]++;
    this.layers[LAYER.solid][index] = type;
    this.damage[index] = damage;
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
