import { assert } from "@axiom/utils";
import AxiomMath from "@axiom/math";
import { packTile, tileType, tileVariant } from "./tile";
import type { DecoLayer } from "../content/decos";

// what the save stores, the rest of the sizes derive from it
export interface WorldMeta {
  seed: number;
  origin: Position2D;
  tileInPixels: Size2D;
  chunkInTiles: Size2D;
  mapInChunks: Size2D;
  biomeCellInTiles: number;
  // type answered outside the map
  border: number;
}

export interface WorldData {
  meta: WorldMeta;
  solid?: Uint16Array;
  damage?: Map<number, number>;
  discovered?: Uint8Array;
  biomes?: Uint8Array;
  decos?: Record<DecoLayer, Map<number, number>>;
}

// pure data: no rules, no events, no camera; filled by the generator or the save codec
export default class World {
  readonly meta: WorldMeta;
  readonly mapInTiles: Size2D;
  readonly mapInPixels: Size2D;
  readonly chunkInPixels: Size2D;
  readonly biomeGrid: Size2D;
  readonly totalTiles: number;
  readonly totalChunks: number;

  // row-major (gx + gy * width), type + variant, see tile.ts
  readonly solid: Uint16Array;
  // sparse, tile index -> damage; most tiles are never hit
  readonly damage: Map<number, number>;
  readonly discovered: Uint8Array;
  readonly biomes: Uint8Array;
  // sparse per layer, tile index -> deco type + variant (packed like a tile); most tiles have none
  readonly decos: Record<DecoLayer, Map<number, number>>;
  // runtime only, bumped when a tile type changes in the chunk
  readonly chunkVersions: Uint32Array;

  constructor(data: WorldData) {
    const meta = data.meta;
    this.meta = meta;
    this.mapInTiles = {
      width: meta.mapInChunks.width * meta.chunkInTiles.width,
      height: meta.mapInChunks.height * meta.chunkInTiles.height,
    };
    this.mapInPixels = {
      width: this.mapInTiles.width * meta.tileInPixels.width,
      height: this.mapInTiles.height * meta.tileInPixels.height,
    };
    this.chunkInPixels = {
      width: meta.chunkInTiles.width * meta.tileInPixels.width,
      height: meta.chunkInTiles.height * meta.tileInPixels.height,
    };
    this.biomeGrid = {
      width: Math.ceil(this.mapInTiles.width / meta.biomeCellInTiles),
      height: Math.ceil(this.mapInTiles.height / meta.biomeCellInTiles),
    };
    this.totalTiles = this.mapInTiles.width * this.mapInTiles.height;
    this.totalChunks = meta.mapInChunks.width * meta.mapInChunks.height;

    this.solid = data.solid ?? new Uint16Array(this.totalTiles);
    this.damage = data.damage ?? new Map();
    this.discovered = data.discovered ?? new Uint8Array(this.totalChunks);
    this.biomes =
      data.biomes ?? new Uint8Array(this.biomeGrid.width * this.biomeGrid.height);
    this.decos = data.decos ?? { back: new Map(), front: new Map() };
    this.chunkVersions = new Uint32Array(this.totalChunks);

    assert(this.solid.length === this.totalTiles, `World: solid has ${this.solid.length} tiles, expected ${this.totalTiles}`);
    assert(this.discovered.length === this.totalChunks, `World: discovered has ${this.discovered.length} chunks, expected ${this.totalChunks}`);
    assert(
      this.biomes.length === this.biomeGrid.width * this.biomeGrid.height,
      `World: biomes has ${this.biomes.length} cells, expected ${this.biomeGrid.width * this.biomeGrid.height}`,
    );
  }

  // tiles

  inside(gx: number, gy: number) {
    return gx >= 0 && gy >= 0 && gx < this.mapInTiles.width && gy < this.mapInTiles.height;
  }

  // -1 outside; inline instead of Grid.tileToIndex: called per tile by physics, no object per call
  tileIndex(gx: number, gy: number) {
    if (!this.inside(gx, gy)) return -1;
    return gx + gy * this.mapInTiles.width;
  }

  getType(gx: number, gy: number) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return this.meta.border;
    return tileType(this.solid[index]);
  }

  getVariant(gx: number, gy: number) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return 0;
    return tileVariant(this.solid[index]);
  }

  // a new tile starts undamaged
  setTile(gx: number, gy: number, type: number, variant = 0) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return;

    if (tileType(this.solid[index]) !== type)
      this.chunkVersions[this.chunkOfTile(gx, gy)]++;
    this.solid[index] = packTile(type, variant);
    this.damage.delete(index);
  }

  getDamage(gx: number, gy: number) {
    return this.damage.get(this.tileIndex(gx, gy)) ?? 0;
  }

  setDamage(gx: number, gy: number, value: number) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return;
    if (value <= 0) this.damage.delete(index);
    else this.damage.set(index, value);
  }

  // decos

  // type 0 = none
  getDecoType(layer: DecoLayer, gx: number, gy: number) {
    return tileType(this.decos[layer].get(this.tileIndex(gx, gy)) ?? 0);
  }

  getDecoVariant(layer: DecoLayer, gx: number, gy: number) {
    return tileVariant(this.decos[layer].get(this.tileIndex(gx, gy)) ?? 0);
  }

  // type 0 removes it
  setDeco(layer: DecoLayer, gx: number, gy: number, type: number, variant = 0) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return;
    if (type === 0) this.decos[layer].delete(index);
    else this.decos[layer].set(index, packTile(type, variant));
    this.chunkVersions[this.chunkOfTile(gx, gy)]++;
  }

  // chunks

  chunkIndex(cx: number, cy: number) {
    return cx + cy * this.meta.mapInChunks.width;
  }

  chunkOfTile(gx: number, gy: number) {
    return this.chunkIndex(
      Math.floor(gx / this.meta.chunkInTiles.width),
      Math.floor(gy / this.meta.chunkInTiles.height),
    );
  }

  // top-left tile of the chunk
  chunkOrigin(chunkIndex: number): Position2D {
    return {
      x: (chunkIndex % this.meta.mapInChunks.width) * this.meta.chunkInTiles.width,
      y: Math.floor(chunkIndex / this.meta.mapInChunks.width) * this.meta.chunkInTiles.height,
    };
  }

  isDiscovered(chunkIndex: number) {
    return this.discovered[chunkIndex] === 1;
  }

  setDiscovered(chunkIndex: number) {
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks) return;
    this.discovered[chunkIndex] = 1;
  }

  // biomes

  biomeAt(gx: number, gy: number) {
    const cell = this.meta.biomeCellInTiles;
    const bx = AxiomMath.clamp(Math.floor(gx / cell), 0, this.biomeGrid.width - 1);
    const by = AxiomMath.clamp(Math.floor(gy / cell), 0, this.biomeGrid.height - 1);
    return this.biomes[bx + by * this.biomeGrid.width];
  }

  // world space

  worldToTile(position: Position2D): Position2D {
    return {
      x: Math.floor((position.x - this.meta.origin.x) / this.meta.tileInPixels.width),
      y: Math.floor((position.y - this.meta.origin.y) / this.meta.tileInPixels.height),
    };
  }

  tileToWorld(tile: Position2D): Position2D {
    return {
      x: this.meta.origin.x + tile.x * this.meta.tileInPixels.width,
      y: this.meta.origin.y + tile.y * this.meta.tileInPixels.height,
    };
  }

  // where a world point lies on the tile, 0-1 each axis, clamped to the tile
  worldToTileFraction(tile: Position2D, position: Position2D): Position2D {
    const corner = this.tileToWorld(tile);
    return {
      x: AxiomMath.clamp((position.x - corner.x) / this.meta.tileInPixels.width, 0, 1),
      y: AxiomMath.clamp((position.y - corner.y) / this.meta.tileInPixels.height, 0, 1),
    };
  }

  tileCenterToWorld(tile: Position2D): Position2D {
    return {
      x: this.meta.origin.x + (tile.x + 0.5) * this.meta.tileInPixels.width,
      y: this.meta.origin.y + (tile.y + 0.5) * this.meta.tileInPixels.height,
    };
  }

  worldToChunk(position: Position2D): Position2D {
    return {
      x: Math.floor((position.x - this.meta.origin.x) / this.chunkInPixels.width),
      y: Math.floor((position.y - this.meta.origin.y) / this.chunkInPixels.height),
    };
  }

  chunkToWorld(chunkIndex: number): Position2D {
    return this.tileToWorld(this.chunkOrigin(chunkIndex));
  }

  get bounds(): Box {
    return {
      x: this.meta.origin.x,
      y: this.meta.origin.y,
      w: this.mapInPixels.width,
      h: this.mapInPixels.height,
    };
  }
}
