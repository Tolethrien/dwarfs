import { BlocksID } from "../content/blocks";
import { BackgroundsID } from "../content/backgrounds";
import { BiomesID } from "../content/biomes";
import type { DecoLayer, DecosID, DecoSupport } from "../content/decorations";
import { packTile, tileLook, tileType } from "./tile";

export interface DecoPlacement {
  id: DecosID;
  layer: DecoLayer;
  support: DecoSupport;
  flipX: boolean;
  scale: number;
  offset: number;
  phase: number;
}

export interface BiomeArea {
  biome: BiomesID;
  name?: string;
}

export interface WorldMeta {
  mapInTiles: Size2D;
  tileInPixels: number;
}

// discovered: points per tile side of the fog mask, must match FOG_PER_TILE in shaders/globals.wgsl;
// soft: tiles over which what's discovered tile by tile (the shaft's hole, a crater) fades out
export const WORLD_FOG = { perTile: 4, soft: 2.5 };

export default class World {
  readonly meta: WorldMeta;
  readonly mapInTiles: Size2D;
  readonly totalTiles: number;
  readonly solid: Uint16Array;
  readonly backgrounds: Uint16Array;
  // the biome area per tile, its number in biomeAreas, 0: none; mining leaves it, the area
  // outlives its blocks
  readonly biomes: Uint16Array;
  readonly biomeAreas: BiomeArea[] = [{ biome: BiomesID.none }];
  readonly damage = new Map<number, number>();
  readonly decos = new Map<number, DecoPlacement[]>();
  readonly discovered: Uint8Array;
  readonly fogSize: Size2D;
  shaftDepth = 0;

  constructor(meta: WorldMeta) {
    this.meta = meta;
    this.mapInTiles = meta.mapInTiles;
    this.totalTiles = meta.mapInTiles.width * meta.mapInTiles.height;
    this.solid = new Uint16Array(this.totalTiles);
    this.backgrounds = new Uint16Array(this.totalTiles);
    this.fogSize = {
      width: meta.mapInTiles.width * WORLD_FOG.perTile,
      height: meta.mapInTiles.height * WORLD_FOG.perTile,
    };
    this.discovered = new Uint8Array(this.fogSize.width * this.fogSize.height);
    this.biomes = new Uint16Array(this.totalTiles);
  }

  inside(gx: number, gy: number) {
    return (
      gx >= 0 &&
      gy >= 0 &&
      gx < this.mapInTiles.width &&
      gy < this.mapInTiles.height
    );
  }

  // inline instead of a Grid helper: called per tile by physics, no object per call
  tileIndex(gx: number, gy: number) {
    if (!this.inside(gx, gy)) return -1;
    return gx + gy * this.mapInTiles.width;
  }

  getType(gx: number, gy: number): BlocksID {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return BlocksID.void;
    return tileType(this.solid[index]);
  }

  getLook(gx: number, gy: number) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return 0;
    return tileLook(this.solid[index]);
  }

  setTile(gx: number, gy: number, type: BlocksID, look = 0) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return;
    this.solid[index] = packTile(type, look);
    this.damage.delete(index);
  }

  getBackground(gx: number, gy: number): BackgroundsID {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return BackgroundsID.none;
    return tileType(this.backgrounds[index]);
  }

  setBackground(gx: number, gy: number, type: BackgroundsID, look = 0) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return;
    this.backgrounds[index] = packTile(type, look);
  }

  getDecos(gx: number, gy: number) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return undefined;
    return this.decos.get(index);
  }

  addDeco(gx: number, gy: number, deco: DecoPlacement) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return;
    const list = this.decos.get(index);
    if (list) list.push(deco);
    else this.decos.set(index, [deco]);
  }

  removeDecos(gx: number, gy: number, match: (deco: DecoPlacement) => boolean) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return;
    const list = this.decos.get(index);
    if (!list) return;
    const kept = list.filter((deco) => !match(deco));
    if (kept.length === 0) this.decos.delete(index);
    else if (kept.length !== list.length) this.decos.set(index, kept);
  }

  isTileDiscovered(gx: number, gy: number) {
    if (!this.inside(gx, gy)) return false;
    const perTile = WORLD_FOG.perTile;
    const baseX = gx * perTile;
    const baseY = gy * perTile;
    const width = this.fogSize.width;
    for (let py = 0; py < perTile; py++)
      for (let px = 0; px < perTile; px++)
        if (this.discovered[baseX + px + (baseY + py) * width] > 0) return true;
    return false;
  }

  discoverTiles(tiles: Position2D[]) {
    const perTile = WORLD_FOG.perTile;
    const soft = WORLD_FOG.soft;
    const reach = Math.ceil(soft);
    const width = this.mapInTiles.width;
    const whole = new Set(tiles.filter((tile) => this.inside(tile.x, tile.y)).map((tile) => tile.x + tile.y * width));
    const rows = { from: Infinity, to: -Infinity };
    if (whole.size === 0) return rows;
    const xs = tiles.map((tile) => tile.x);
    const ys = tiles.map((tile) => tile.y);
    const fromX = Math.max((Math.min(...xs) - reach) * perTile, 0);
    const toX = Math.min((Math.max(...xs) + reach + 1) * perTile, this.fogSize.width) - 1;
    const fromY = Math.max((Math.min(...ys) - reach) * perTile, 0);
    const toY = Math.min((Math.max(...ys) + reach + 1) * perTile, this.fogSize.height) - 1;
    for (let py = fromY; py <= toY; py++)
      for (let px = fromX; px <= toX; px++) {
        const x = (px + 0.5) / perTile;
        const y = (py + 0.5) / perTile;
        const gx = Math.floor(x);
        const gy = Math.floor(y);
        let nearest = Infinity;
        for (let ny = gy - reach; ny <= gy + reach; ny++)
          for (let nx = gx - reach; nx <= gx + reach; nx++) {
            if (!this.inside(nx, ny) || !whole.has(nx + ny * width)) continue;
            const dx = Math.max(nx - x, 0, x - (nx + 1));
            const dy = Math.max(ny - y, 0, y - (ny + 1));
            nearest = Math.min(nearest, Math.hypot(dx, dy));
          }
        if (nearest >= soft) continue;
        const value = Math.round(255 * (1 - nearest / soft));
        const index = px + py * this.fogSize.width;
        if (value <= this.discovered[index]) continue;
        this.discovered[index] = value;
        rows.from = Math.min(rows.from, py);
        rows.to = Math.max(rows.to, py);
      }
    return rows;
  }

  addBiomeArea(area: BiomeArea) {
    this.biomeAreas.push(area);
    return this.biomeAreas.length - 1;
  }

  getBiomeArea(gx: number, gy: number) {
    const index = this.tileIndex(gx, gy);
    if (index === -1) return 0;
    return this.biomes[index];
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

  worldToTile(position: Position2D): Position2D {
    return {
      x: Math.floor(position.x / this.meta.tileInPixels),
      y: Math.floor(position.y / this.meta.tileInPixels),
    };
  }

  tileToWorld(tile: Position2D): Position2D {
    return {
      x: tile.x * this.meta.tileInPixels,
      y: tile.y * this.meta.tileInPixels,
    };
  }

  get mapInPixels(): Size2D {
    return {
      width: this.mapInTiles.width * this.meta.tileInPixels,
      height: this.mapInTiles.height * this.meta.tileInPixels,
    };
  }
}
