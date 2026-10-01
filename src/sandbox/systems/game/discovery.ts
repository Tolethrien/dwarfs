import PragmaSystem from "@pragma/system";
import type World from "@sandbox/world/world";
import type { BallEnteredChunkEvent } from "./physBall";
import Terrain from "./terrain";

export interface ChunkDiscoveredEvent {
  chunk: number;
}

// simulation: a chunk is discovered once a ball is in it or next to it, for good.
// The 8 neighbours go with it, so a ball never gets ahead of what is discovered
export default class Discovery extends PragmaSystem {
  declare private world: World;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  awake(): void {
    this.onSceneEvent<BallEnteredChunkEvent>("ballEnteredChunk", (event) => this.discover(event));
  }

  start(): void {
    this.world = this.scene.getSystem(Terrain).world;
  }

  private discover(event: BallEnteredChunkEvent) {
    const chunks = this.world.meta.mapInChunks;
    const cx = event.chunk % chunks.width;
    const cy = Math.floor(event.chunk / chunks.width);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= chunks.width || ny >= chunks.height) continue;
        const chunk = this.world.chunkIndex(nx, ny);
        if (this.world.isDiscovered(chunk)) continue;
        this.world.setDiscovered(chunk);
        this.emitSceneEvent<ChunkDiscoveredEvent>("chunkDiscovered", { chunk });
      }
    }
  }
}
