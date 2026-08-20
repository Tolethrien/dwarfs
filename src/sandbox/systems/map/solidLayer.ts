import PragmaComponent from "@/core/pragma/component";
import EntitiesObject from "@/sandbox/managers/entitiesObject";
import MapObject, { LAYER } from "@/sandbox/managers/mapObject";
export default class SolidLayer extends PragmaComponent {
  declare public data: Uint16Array;
  declare public damage: Uint16Array;
  public readonly z = EntitiesObject.renderOrder.main;

  public readonly tints: RGBA[] | null = null;
  public readonly texture = EntitiesObject.sprites.blocks;
  public readonly crops = EntitiesObject.blocks as Record<
    number,
    { crop: Crop }
  >;
  constructor(internal: InternalPCProps, props: { chunkIndex: number }) {
    super(internal);
    this.rebind(props.chunkIndex);
  }

  public rebind(chunkIndex: number) {
    this.data = MapObject.getChunkData(LAYER.solid, chunkIndex);
    this.damage = MapObject.getChunkDamage(chunkIndex);
  }
}
