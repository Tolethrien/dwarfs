import { Draw } from "@aurora/urp/draw/draw";
import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import Transform from "@pragma/transform";
import { Camera } from "@engine/camera/camera";
interface SpriteProps {
  sprite: string;
  crop: Crop;
  zIndex: number;
  tint?: RGBA;
}
const CULL_MARGIN = 100;
export default class Sprite extends PragmaComponent {
  public sprite: SpriteProps["sprite"];
  public crop: SpriteProps["crop"];
  public tint: SpriteProps["tint"];
  public zIndex: SpriteProps["zIndex"];
  declare private transform: Transform;
  constructor(internal: InternalPCProps, props: SpriteProps) {
    super(internal);
    this.crop = props.crop;
    this.sprite = props.sprite;
    this.tint = props.tint;
    this.zIndex = props.zIndex;
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
    const scale = this.transform.getScale();
    const width = this.crop.width * scale.x;
    const height = this.crop.height * scale.y;
    const x = pos.x - width / 2;
    const y = pos.y - height / 2;

    const view = Camera.getViewBounds;
    if (
      x + width < view.min.x - CULL_MARGIN ||
      y + height < view.min.y - CULL_MARGIN ||
      x > view.max.x + CULL_MARGIN ||
      y > view.max.y + CULL_MARGIN
    )
      return;

    Draw.sprite({
      position: {
        x: x,
        y: y,
        z: this.zIndex,
      },
      crop: this.crop,
      size: { height: height, width: width },
      texture: this.sprite,
      tint: this.tint,
    });
  }
}
