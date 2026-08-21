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
    const scale = this.transform.getScale();
    const width = this.crop.width * scale.x;
    const height = this.crop.height * scale.y;
    const x = pos.x - width / 2;
    const y = pos.y - height / 2;

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
        x: x,
        y: y,
        z: this.zIndex,
      },
      crop: this.crop,
      size: { height: height, width: width },
      textureToUse: this.sprite,
      tint: this.tint,
    });
    Draw.pointLight({
      position: {
        x: x,
        y: y,
        z: 1,
      },
      size: { height: 2000, width: 2000 },
      intensity: 150,
      tint: [255, 176, 64],
    });
  }
}
