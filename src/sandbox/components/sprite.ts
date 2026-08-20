import Draw from "@/core/aurora/draw";
import PragmaComponent from "@/core/pragma/component";
import { assert } from "@/utils/utils";
import Transform from "./transform";
import AuroraCamera from "@/core/aurora/camera";
import CameraObject from "../managers/cameraObject";
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
    const x = pos.x - this.crop.width / 2;
    const y = pos.y - this.crop.height / 2;

    const view = CameraObject.getViewBox();
    if (
      x + this.crop.width < view.x - CULL_MARGIN ||
      y + this.crop.height < view.y - CULL_MARGIN ||
      x > view.x + view.w + CULL_MARGIN ||
      y > view.y + view.h + CULL_MARGIN
    )
      return;
    Draw.sprite({
      position: {
        x: pos.x - this.crop.width / 2,
        y: pos.y - this.crop.height / 2,
        z: this.zIndex,
      },
      crop: this.crop,
      size: { height: this.crop.height, width: this.crop.width },
      textureToUse: this.sprite,
    });
  }
}
