import Grid from "@/core/axiom/grid";
import PragmaComponent from "@/core/pragma/component";
import Chunk from "@/sandbox/bActors/chunk";
import Spark from "@/sandbox/bActors/spark";
import CameraObject from "@/sandbox/managers/cameraObject";
import EntitiesObject, { BlocksID } from "@/sandbox/managers/entitiesObject";
import MapObject, { LAYER, MAX_DAMAGE } from "@/sandbox/managers/mapObject";
import SoundBank, { SoundsID } from "@/sandbox/managers/soundbank";
import Explode from "../bActors/explode";
import { assert } from "@/utils/utils";
import PragmaActor from "@/core/pragma/actor";
import { SPAWN_REGISTRY } from "../managers/spawnRegistry";

type ChunkRange = { minX: number; minY: number; maxX: number; maxY: number };

export interface TileMinedEvent {
  gx: number;
  gy: number;
  type: BlocksID;
}
export interface TileDamagedEvent {
  gx: number;
  gy: number;
  type: number;
  damage: number;
}
export interface MapDiscoveryEvent {}
const MARGIN = 1; //viewbox margin
const SHOW_ALL_CHUNKS = true;
export default class MapDirector extends PragmaComponent {
  private pool: Chunk[] = [];
  private loadedChunks: Map<number, Chunk> = new Map();
  private lastRange: ChunkRange = { minX: -1, minY: -1, maxX: -1, maxY: -1 };
  private spawnedActors: Map<number, Map<number, PragmaActor>> = new Map();
  private dirty = false;
  constructor(internal: InternalPCProps) {
    super(internal);
  }

  awake(): void {
    this.systemSharedData.add("mapDirector", this);
  }
  start(): void {
    this.syncChunks(this.computeRange());
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
        if (!SHOW_ALL_CHUNKS && !MapObject.isDiscovered(index)) continue;
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
    const block = EntitiesObject.getBlock(type);
    if (block.spawnOnHit) {
      MapObject.setTile(gx, gy, BlocksID.air, 0);
      const world = MapObject.tileCenterToWorld({ x: gx, y: gy });
      this.scene.spawnActor(
        SPAWN_REGISTRY[block.spawnOnHit]({ position: world, type }),
      );
      this.emitSceneEvent<MapDiscoveryEvent>("discoveryFound", { gx, gy });
      return "bounce";
    }
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
      if (MapObject.isTileVisible(gx, gy)) {
        const world = MapObject.tileCenterToWorld({ x: gx, y: gy });
        const spark = new Spark({ position: world });
        this.scene.spawnActor(spark);
        SoundBank.playSound(SoundsID.blockDamage, { position: world });
      }
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
    this.despawnTileActor(gx, gy);

    MapObject.setTile(gx, gy, BlocksID.air, 0);

    if (this.loadedChunks.has(MapObject.chunkIndexOfTile(gx, gy))) {
      if (MapObject.isTileVisible(gx, gy)) {
        const world = MapObject.tileCenterToWorld({ x: gx, y: gy });
        const explode = new Explode({ position: world });
        this.scene.spawnActor(explode); // TODO: nowy komponent na animacje mapy i przeniesc to tam
        SoundBank.playSound(SoundsID.blockDestroy, { volume: 0.5 });
      }
    }
    this.emitSceneEvent<TileMinedEvent>("tileMined", { gx, gy, type });
  }
  private spawnChunkActors(chunkIndex: number) {
    const { blocksPerChunk, chunkInTiles, mapInChunks } = MapObject.mapMeta;
    const data = MapObject.getChunkData(LAYER.solid, chunkIndex);

    const chunkX = chunkIndex % mapInChunks.width;
    const chunkY = Math.floor(chunkIndex / mapInChunks.width);

    let actors: Map<number, PragmaActor> | undefined;

    for (let local = 0; local < blocksPerChunk; local++) {
      const type = data[local];
      if (type === BlocksID.air) continue;

      const spawn = EntitiesObject.getBlock(type).spawn;
      if (!spawn) continue;

      const builder = SPAWN_REGISTRY[spawn];
      assert(builder !== undefined, `No builder for spawn: "${spawn}"`);

      const gx = chunkX * chunkInTiles.width + (local % chunkInTiles.width);
      const gy =
        chunkY * chunkInTiles.height + Math.floor(local / chunkInTiles.width);
      const world = MapObject.tileCenterToWorld({ x: gx, y: gy });
      const actor = builder({ position: world, type });
      this.scene.spawnActor(actor);

      if (!actors) {
        actors = new Map();
        this.spawnedActors.set(chunkIndex, actors);
      }
      actors.set(chunkIndex * blocksPerChunk + local, actor);
    }
  }

  private despawnChunkActors(chunkIndex: number) {
    const actors = this.spawnedActors.get(chunkIndex);
    if (!actors) return;

    for (const actor of actors.values()) this.scene.deleteActor(actor);
    this.spawnedActors.delete(chunkIndex);
  }

  private despawnTileActor(gx: number, gy: number) {
    const chunkIndex = MapObject.chunkIndexOfTile(gx, gy);
    const actors = this.spawnedActors.get(chunkIndex);
    if (!actors) return;

    const { blocksPerChunk, chunkInTiles } = MapObject.mapMeta;
    const local =
      (gy % chunkInTiles.height) * chunkInTiles.width +
      (gx % chunkInTiles.width);
    const key = chunkIndex * blocksPerChunk + local;

    const actor = actors.get(key);
    if (!actor) return;

    this.scene.deleteActor(actor);
    actors.delete(key);
    if (actors.size === 0) this.spawnedActors.delete(chunkIndex);
  }

  private poolChunk(index: number) {
    const pooled = this.pool.pop();
    if (pooled) {
      pooled.reuse(index);
      this.loadedChunks.set(index, pooled);
    } else {
      const fresh = new Chunk({ index });
      this.scene.spawnActor(fresh);
      this.loadedChunks.set(index, fresh);
    }
    this.spawnChunkActors(index);
  }
  private releaseChunk(index: number, chunk: Chunk) {
    this.despawnChunkActors(index);
    this.loadedChunks.delete(index);
    chunk.setVisibility(false);
    this.pool.push(chunk);
  }
  public markDirty() {
    this.dirty = true;
  }
}
