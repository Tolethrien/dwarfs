import PragmaActor from "@/core/pragma/actor";
import Grid from "@/core/axiom/grid";
import Tiles from "../components/tiles";
import MapObject from "../managers/mapObject";

interface ChunkProps {
  index: number;
}

export default class Chunk extends PragmaActor {
  public index: number;
  public tiles: Tiles;

  constructor(props: ChunkProps) {
    super();
    this.index = props.index;
    this.addComponent(Tiles, { chunkIndex: props.index });
    this.tiles = this.getComponent(Tiles)!;
    this.placeAt(props.index);
  }

  public reuse(index: number) {
    this.index = index;
    this.placeAt(index);
    this.tiles.rebind(index);
    this.setVisibility(true);
  }

  private placeAt(index: number) {
    const pos = MapObject.chunkToWorld(index);
    this.transform.setPosition(pos.x, pos.y);
  }
}
