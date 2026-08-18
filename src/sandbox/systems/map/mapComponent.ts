import Grid from "@/core/axiom/grid";
import Vec2 from "@/core/axiom/vec2";
import PragmaComponent from "@/core/pragma/component";
import Chunk from "@/sandbox/bActors/chunk";
import Physics from "@/sandbox/components/physics";
import MapObject from "@/sandbox/managers/mapObject";
import { BallChangedChunkEvent } from "../physics/physBallCom";
export interface MapReadyEvent {
  getChunk: (index: number) => Chunk | undefined;
}
const START_INDEX = 3;
export default class MapComponent extends PragmaComponent {
  private loadedChunks: Map<number, Chunk> = new Map();
  private chunksToBuffer = new Set<number>();
  private markAsEmpty = new Set<number>();
  private ballsInChunks = new Map<number, Set<Symbol>>();
  constructor(internal: InternalPCProps) {
    super(internal);
  }
  awake(): void {
    this.onSceneEvent<number>("chunkEmpty", (index) => this.deleteChunk(index));
    this.onSceneEvent<BallChangedChunkEvent>("ballChangedChunk", (event) =>
      this.swapBallsInChunk(event),
    );
  }
  start(): void {
    this.loadChunk(START_INDEX);
    this.loadChunk(START_INDEX);
    this.emitSceneEvent<MapReadyEvent>("mapReady", {
      getChunk: (index: number) => this.loadedChunks.get(index),
    });
  }
  update(): void {
    if (this.chunksToBuffer.size === 0) return;
    this.chunksToBuffer.forEach((index) => {
      console.log("load");
      const chunk = this.loadChunk(index);
      if (this.ballsInChunks.has(index)) chunk.setEnabled(true);
      this.chunksToBuffer.delete(index);
    });
  }
  swapBallsInChunk(event: BallChangedChunkEvent) {
    if (event.lastChunk !== undefined) {
      const lastSet = this.ballsInChunks.get(event.lastChunk);
      lastSet?.delete(event.ID);
      if (lastSet?.size === 0) {
        this.ballsInChunks.delete(event.lastChunk);
        this.loadedChunks.get(event.lastChunk)?.setEnabled(false);
      }
    }
    if (event.newChunk === null) return;
    let addSet = this.ballsInChunks.get(event.newChunk);
    if (!addSet) {
      addSet = new Set();
      this.ballsInChunks.set(event.newChunk, addSet);
      this.loadedChunks.get(event.newChunk)?.setEnabled(true);
    }
    addSet.add(event.ID);

    const indexes = this.getAllNeighbors(event.newChunk);
    indexes.forEach((index) => this.chunksToBuffer.add(index));
  }

  deleteChunk(index: number) {
    const chunk = this.loadedChunks.get(index);
    if (!chunk) return;
    this.loadedChunks.delete(index);
    this.scene.deleteActor(chunk);
    this.markAsEmpty.add(index);
    console.log("chunk deleted", index, this.scene.getAllActors);
  }

  getChunkIndex(phys: Physics) {
    const pos = phys.actor.transform.getWorldPosition();
    const chunkPos = Grid.worldToTile(pos, MapObject.mapMeta.chunkInPixels);
    return Grid.tileToIndex(chunkPos, MapObject.mapMeta.mapInChunks.width);
  }
  loadChunk(index: number) {
    const existing = this.loadedChunks.get(index);
    if (existing) return existing;
    const data = MapObject.getChunkData(index);
    const chunk = new Chunk({
      index: index,
      mapInChunksWidth: MapObject.mapMeta.mapInChunks.width,
      tilesData: data,
    });
    this.scene.spawnActor(chunk);
    this.loadedChunks.set(index, chunk);
    chunk.setEnabled(false);
    return chunk;
  }
  private getAllNeighbors(index: number): number[] {
    const { mapInChunks } = MapObject.mapMeta;
    const { x, y } = Grid.indexToTile(index, mapInChunks.width);

    const neighbors: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (
          nx < 0 ||
          ny < 0 ||
          nx >= mapInChunks.width ||
          ny >= mapInChunks.height
        )
          continue;
        const neighborIndex = Grid.tileToIndex(
          { x: nx, y: ny },
          mapInChunks.width,
        );
        if (!this.loadedChunks.has(neighborIndex))
          neighbors.push(neighborIndex);
      }
    }
    return neighbors;
  }
}
