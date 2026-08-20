import Grid from "@/core/axiom/grid";
import PragmaComponent from "@/core/pragma/component";
import Chunk from "@/sandbox/bActors/chunk";
import CameraObject from "@/sandbox/managers/cameraObject";
import EntitiesObject, { BlocksID } from "@/sandbox/managers/entitiesObject";
import MapObject, { MAX_DAMAGE } from "@/sandbox/managers/mapObject";

type ChunkRange = { minX: number; minY: number; maxX: number; maxY: number };
export interface MapSystemReady {
  map: mapDirector;
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
const MARGIN = 1; //viewbox margin

export default class mapDirector extends PragmaComponent {
  private pool: Chunk[] = [];
  private loadedChunks: Map<number, Chunk> = new Map();
  private lastRange: ChunkRange = { minX: -1, minY: -1, maxX: -1, maxY: -1 };
  private dirty = false;
  constructor(internal: InternalPCProps) {
    super(internal);
  }

  start(): void {
    this.syncChunks(this.computeRange());
    this.emitSceneEvent<MapSystemReady>("mapReady", { map: this });
  }

  update(): void {
    const range = this.computeRange();
    const sameRange =
      range.minX === this.lastRange.minX &&
      range.minY === this.lastRange.minY &&
      range.maxX === this.lastRange.maxX &&
      range.maxY === this.lastRange.maxY;

    if (sameRange && !this.dirty) return;
    this.dirty = false;
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

    return {
      minX: Math.max(0, topLeft.x - MARGIN),
      minY: Math.max(0, topLeft.y - MARGIN),
      maxX: Math.min(mapInChunks.width - 1, bottomRight.x + MARGIN),
      maxY: Math.min(mapInChunks.height - 1, bottomRight.y + MARGIN),
    };
  }

  private syncChunks(range: ChunkRange) {
    this.lastRange = range;
    const mapWidth = MapObject.mapMeta.mapInChunks.width;

    const wanted = new Set<number>();
    for (let cy = range.minY; cy <= range.maxY; cy++) {
      for (let cx = range.minX; cx <= range.maxX; cx++) {
        const index = Grid.tileToIndex({ x: cx, y: cy }, mapWidth);
        if (!MapObject.isDiscovered(index)) continue;
        wanted.add(index);
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

  public applyHit(
    gx: number,
    gy: number,
    power: number,
  ): "penetrate" | "bounce" {
    const type = MapObject.getTileType(gx, gy);
    if (type === BlocksID.air) return "bounce";

    const ratio = power / EntitiesObject.getBlock(type).str;
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
    if (type === BlocksID.air || amount <= 0) return;

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
    if (type === BlocksID.air) return;
    MapObject.setTile(gx, gy, BlocksID.air, 0);

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
  public markDirty() {
    this.dirty = true;
  }
}
