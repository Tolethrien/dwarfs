import PragmaComponent from "@/core/pragma/component";
import EntitiesObject from "@/sandbox/managers/entitiesObject";
import MapObject, { LAYER } from "@/sandbox/managers/mapObject";
const BG_SHADES = 32;
// TYMCZASOWE — dopóki nie ma atlasu teł. Szarości pokazują granice chunków.
const TINTS: RGBA[] = Array.from({ length: BG_SHADES + 1 }, (_, i) => {
  const shade = ((i / BG_SHADES) * 200) | 0;
  return [shade, 150, shade, 255];
});

export default class DecoBackLayer extends PragmaComponent {
  declare public data: Uint16Array;
  public readonly z = EntitiesObject.renderOrder.decoBack;
  public readonly texture = EntitiesObject.sprites.blocks;
  public readonly crops = EntitiesObject.blocks as Record<
    number,
    { crop: Crop }
  >;
  public readonly tints: RGBA[] | null = TINTS;
  constructor(internal: InternalPCProps, props: { chunkIndex: number }) {
    super(internal);
    this.rebind(props.chunkIndex);
  }

  public rebind(chunkIndex: number) {
    this.data = MapObject.getChunkData(LAYER.decoBack, chunkIndex);
  }
}
