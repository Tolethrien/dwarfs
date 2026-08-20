import PragmaActor from "@/core/pragma/actor";
import MapObject from "../managers/mapObject";
import BackgroundLayer from "@sandbox/systems/map/bgLayer";
import DecoBackLayer from "@sandbox/systems/map/decoBackLayer";
import SolidLayer from "@sandbox/systems/map/solidLayer";
import DecoFrontLayer from "@sandbox/systems/map/decoFrontLayer";
import TileLayer from "@sandbox/systems/map/tileLayer";

interface ChunkProps {
  index: number;
}

export default class Chunk extends PragmaActor {
  public index: number;

  private background: BackgroundLayer;
  private decoBack: DecoBackLayer;
  private solid: SolidLayer;
  private decoFront: DecoFrontLayer;

  constructor(props: ChunkProps) {
    super();
    this.index = props.index;

    this.addComponent(BackgroundLayer, { chunkIndex: props.index });
    this.addComponent(DecoBackLayer, { chunkIndex: props.index });
    this.addComponent(SolidLayer, { chunkIndex: props.index });
    this.addComponent(DecoFrontLayer, { chunkIndex: props.index });
    this.addComponent(TileLayer);

    this.background = this.getComponent(BackgroundLayer)!;
    this.decoBack = this.getComponent(DecoBackLayer)!;
    this.solid = this.getComponent(SolidLayer)!;
    this.decoFront = this.getComponent(DecoFrontLayer)!;

    this.placeAt(props.index);
  }

  public reuse(index: number) {
    this.index = index;
    this.placeAt(index);

    this.background.rebind(index);
    this.decoBack.rebind(index);
    this.solid.rebind(index);
    this.decoFront.rebind(index);

    this.setVisibility(true);
  }

  private placeAt(index: number) {
    const pos = MapObject.chunkToWorld(index);
    this.transform.setPosition(pos.x, pos.y);
  }
}
