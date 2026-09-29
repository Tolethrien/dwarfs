import PragmaComponent from "@pragma/component";
import MapObject from "@sandbox/managers/mapObject";
import { BallChangedChunkEvent } from "../systems/physBall";
import mapDirector from "./mapDirector";

export default class MapDiscovery extends PragmaComponent {
  declare private map: mapDirector;

  constructor(internal: InternalPCProps) {
    super(internal);
  }

  awake(): void {
    this.onSceneEvent<BallChangedChunkEvent>("ballChangedChunk", ({ chunk }) =>
      this.discover(chunk),
    );
  }

  start(): void {
    this.map = this.getSibling(mapDirector)!;
  }

  private discover(chunk: number) {
    const { mapInChunks } = MapObject.mapMeta;
    const cx = chunk % mapInChunks.width;
    const cy = Math.floor(chunk / mapInChunks.width);
    let revealed = false;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (
          nx < 0 ||
          ny < 0 ||
          nx >= mapInChunks.width ||
          ny >= mapInChunks.height
        )
          continue;

        const index = ny * mapInChunks.width + nx;
        if (MapObject.isDiscovered(index)) continue;

        MapObject.setDiscovered(index);
        revealed = true;
      }
    }

    if (revealed) this.map.markDirty();
  }
}
