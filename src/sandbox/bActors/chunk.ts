import PragmaActor from "@/core/pragma/actor";
import MapManager from "../managers/mapObject";
import Grid from "@/core/axiom/grid";
import Tiles from "../components/tiles";
import Vec2 from "@/core/axiom/vec2";
interface ChunkProps {
  tilesData: Uint8Array;
  index: number;
  mapInChunksWidth: number;
}

export default class Chunk extends PragmaActor {
  public readonly index: number;
  public state: "active" | "buffer" = "active"; //TODO
  public isEaten: boolean = false; // TODO
  public tiles: Tiles;
  constructor(props: ChunkProps) {
    super();
    this.index = props.index;
    this.addComponent(Tiles, { data: props.tilesData });
    this.tiles = this.getComponent(Tiles)!;
    const worldPos = Grid.tileToWorld(
      {
        x: props.index % props.mapInChunksWidth,
        y: Math.floor(props.index / props.mapInChunksWidth),
      },
      MapManager.mapMeta.chunkInPixels,
    );
    this.transform.setPosition(worldPos.x, worldPos.y);
  }
}
