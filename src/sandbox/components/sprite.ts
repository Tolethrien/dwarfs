import Draw from "@/core/aurora/draw";
import PragmaComponent from "@/core/pragma/component";
import { assert } from "@/utils/utils";
import Transform from "./transform";
interface SpriteProps {
  sprite: string;
  crop: Crop;
  tint?: RGBA;
}
export default class Sprite extends PragmaComponent {
  public sprite: SpriteProps["sprite"];
  public crop: SpriteProps["crop"];
  public tint: SpriteProps["tint"];
  declare private transform: Transform;
  constructor(internal: InternalPCProps, props: SpriteProps) {
    super(internal);
    this.crop = props.crop;
    this.sprite = props.sprite;
    this.tint = props.tint;
  }
  start(): void {
    const transform = this.actor.transform;
    assert(
      transform !== undefined,
      `there is no transform component for actor: ${this.actor.ID.description}`,
    );
    this.transform = transform;
  }
  render(): void {
    const pos = this.transform.getRenderPosition();
    Draw.sprite({
      position: {
        x: pos.x - this.crop.width / 2,
        y: pos.y - this.crop.height / 2,
        z: 1,
      },
      crop: this.crop,
      size: { height: this.crop.height, width: this.crop.width },
      textureToUse: this.sprite,
    });
  }
}
