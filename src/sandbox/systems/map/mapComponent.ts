import AuroraCamera from "@/core/aurora/camera";
import Grid from "@/core/axiom/grid";
import PragmaComponent from "@/core/pragma/component";
import { BLOCK_NAMES, BLOCK_TYPES } from "@/sandbox/data";
import Chunk from "@/sandbox/bActors/chunk";
import CameraObject from "@/sandbox/managers/cameraObject";
import MapObject from "@/sandbox/managers/mapObject";

type ChunkRange = { minX: number; minY: number; maxX: number; maxY: number };
export interface MapSystemReady {
  map: MapComponent;
}
export interface TileMinedEvent {
  gx: number;
  gy: number;
  type: number;
}
export interface TileDamagedEvent {
  gx: number;
  gy: number;
  type: number;
  damage: number;
}
const AIR = BLOCK_NAMES.indexOf("air");
const MAX_DAMAGE = 255;
const MARGIN = 1; //viewbox margin
const MAX_SPAN = 5; // max load chunks
const POOL_SIZE = MAX_SPAN * MAX_SPAN + 8;

export default class MapComponent extends PragmaComponent {
  private pool: Chunk[] = [];
  private loadedChunks: Map<number, Chunk> = new Map();
  private lastRange: ChunkRange = { minX: -1, minY: -1, maxX: -1, maxY: -1 };

  constructor(internal: InternalPCProps) {
    super(internal);
  }

  start(): void {
    this.fillPool();
    this.syncChunks(this.computeRange());
    this.emitSceneEvent<MapSystemReady>("mapReady", { map: this });
  }

  update(): void {
    const range = this.computeRange();
    if (
      range.minX === this.lastRange.minX &&
      range.minY === this.lastRange.minY &&
      range.maxX === this.lastRange.maxX &&
      range.maxY === this.lastRange.maxY
    )
      return;

    this.syncChunks(range);
  }

  private computeRange(): ChunkRange {
    const view = CameraObject.getViewBox();
    const { mapInChunks } = MapObject.mapMeta;

    const topLeft = MapObject.worldToChunkTile({ x: view.x, y: view.y });
    const bottomRight = MapObject.worldToChunkTile({
      x: view.x + view.w,
      y: view.y + view.h,
    });
    const center = MapObject.worldToChunkTile({
      x: view.x + view.w / 2,
      y: view.y + view.h / 2,
    });

    let minX = topLeft.x - MARGIN;
    let minY = topLeft.y - MARGIN;
    let maxX = bottomRight.x + MARGIN;
    let maxY = bottomRight.y + MARGIN;

    const half = Math.floor((MAX_SPAN - 1) / 2);
    if (maxX - minX + 1 > MAX_SPAN) {
      minX = center.x - half;
      maxX = center.x + half;
    }
    if (maxY - minY + 1 > MAX_SPAN) {
      minY = center.y - half;
      maxY = center.y + half;
    }

    return {
      minX: Math.max(0, minX),
      minY: Math.max(0, minY),
      maxX: Math.min(mapInChunks.width - 1, maxX),
      maxY: Math.min(mapInChunks.height - 1, maxY),
    };
  }

  private syncChunks(range: ChunkRange) {
    this.lastRange = range;
    const mapWidth = MapObject.mapMeta.mapInChunks.width;

    const wanted = new Set<number>();
    for (let cy = range.minY; cy <= range.maxY; cy++) {
      for (let cx = range.minX; cx <= range.maxX; cx++) {
        wanted.add(Grid.tileToIndex({ x: cx, y: cy }, mapWidth));
      }
    }

    for (const [index, chunk] of this.loadedChunks) {
      if (wanted.has(index)) continue;
      this.releaseChunk(index, chunk);
    }

    for (const index of wanted) {
      if (this.loadedChunks.has(index)) continue;
      this.poolChunk(index);
    }
  }

  private loadChunk(index: number) {
    const chunk = new Chunk({ index });
    this.scene.spawnActor(chunk);
    this.loadedChunks.set(index, chunk);
  }
  public applyHit(
    gx: number,
    gy: number,
    power: number,
  ): "penetrate" | "bounce" {
    const type = MapObject.getTileType(gx, gy);
    if (type === AIR) return "bounce";

    const ratio = power / BLOCK_TYPES[BLOCK_NAMES[type]].str;

    if (ratio >= 1.5) {
      this.destroyTile(gx, gy, type);
      return "penetrate";
    }
    if (ratio >= 1) {
      this.destroyTile(gx, gy, type);
      return "bounce";
    }
    if (ratio >= 0.5) {
      this.damageTile(
        gx,
        gy,
        Math.round(((ratio - 0.5) / 0.5) * MAX_DAMAGE),
        type,
      );
    }
    return "bounce";
  }
  public damageTile(
    gx: number,
    gy: number,
    amount: number,
    type = MapObject.getTileType(gx, gy),
  ) {
    if (type === AIR || amount <= 0) return;

    const damage = MapObject.getTileDamage(gx, gy) + amount;
    if (damage >= MAX_DAMAGE) {
      this.destroyTile(gx, gy, type);
      return;
    }

    MapObject.setTile(gx, gy, type, damage);

    if (this.loadedChunks.has(MapObject.chunkIndexOfTile(gx, gy))) {
      // const world = MapObject.tileCenterToWorld({ x: gx, y: gy });
      //spawn sparks
    }

    this.emitSceneEvent<TileDamagedEvent>("tileDamaged", {
      gx,
      gy,
      type,
      damage,
    });
  }
  public destroyTile(
    gx: number,
    gy: number,
    type = MapObject.getTileType(gx, gy),
  ) {
    if (type === AIR) return;
    MapObject.setTile(gx, gy, AIR, 0);

    if (this.loadedChunks.has(MapObject.chunkIndexOfTile(gx, gy))) {
      // const world = MapObject.tileCenterToWorld({ x: gx, y: gy });
      //spawn block destroying
    }
    this.emitSceneEvent<TileMinedEvent>("tileMined", { gx, gy, type });
  }

  private poolChunk(index: number) {
    const pooled = this.pool.pop();
    if (pooled) {
      pooled.reuse(index);
      this.loadedChunks.set(index, pooled);
      return;
    }
    const fresh = new Chunk({ index });
    this.scene.spawnActor(fresh);
    this.loadedChunks.set(index, fresh);
  }
  private releaseChunk(index: number, chunk: Chunk) {
    this.loadedChunks.delete(index);
    chunk.setVisibility(false);
    this.pool.push(chunk);
  }
  private fillPool() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const chunk = new Chunk({ index: 0 });
      chunk.setVisibility(false);
      this.scene.spawnActor(chunk);
      this.pool.push(chunk);
    }
  }
}
