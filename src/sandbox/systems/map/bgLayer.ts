import PragmaComponent from "@/core/pragma/component";
import { BG_SHADES } from "@/mapFormat";
import EntitiesObject from "@/sandbox/managers/entitiesObject";
import MapObject, { LAYER } from "@/sandbox/managers/mapObject";

// TYMCZASOWE — dopóki nie ma atlasu teł. Szarości pokazują granice chunków.
const TINTS: RGBA[] = Array.from({ length: BG_SHADES + 1 }, (_, i) => {
  const shade = ((i / BG_SHADES) * 200) | 0;
  return [shade, shade, shade, 255];
});

export default class BackgroundLayer extends PragmaComponent {
  declare public data: Uint16Array;
  public readonly z = EntitiesObject.renderOrder.bg;
  public readonly texture = EntitiesObject.sprites.blocks; //TODO: nie ma bg?

  public readonly tints: RGBA[] | null = TINTS;

  constructor(internal: InternalPCProps, props: { chunkIndex: number }) {
    super(internal);
    this.rebind(props.chunkIndex);
  }

  public rebind(chunkIndex: number) {
    this.data = MapObject.getChunkData(LAYER.background, chunkIndex);
  }
}
