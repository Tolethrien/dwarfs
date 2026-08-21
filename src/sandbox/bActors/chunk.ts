import PragmaActor from "@/core/pragma/actor";
import MapObject from "../managers/mapObject";
import TileLayer from "@sandbox/systems/map/tileLayer";

interface ChunkProps {
  index: number;
}

export default class Chunk extends PragmaActor {
  public index: number;
  private tiles: TileLayer;

  constructor(props: ChunkProps) {
    super();
    this.index = props.index;
    this.addComponent(TileLayer, { chunkIndex: this.index });
    this.tiles = this.getComponent(TileLayer)!;

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
