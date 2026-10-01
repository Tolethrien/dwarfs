import { Draw } from "@aurora/urp/draw/draw";
import PragmaComponent from "@pragma/component";

interface ShapeProps {
  size: Size2D;
  color: RGBA;
  zIndex: number;
}

// a plain rect centred on the actor, turned with it; for things without graphics yet
export default class Shape extends PragmaComponent {
  public size: Size2D;
  public color: RGBA;
  public zIndex: number;

  constructor(internal: InternalPCProps, props: ShapeProps) {
    super(internal);
    this.size = props.size;
    this.color = props.color;
    this.zIndex = props.zIndex;
  }

  render(): void {
    const position = this.actor.transform.getRenderPosition();
    Draw.rect({
      position: {
        x: position.x - this.size.width / 2,
        y: position.y - this.size.height / 2,
        z: this.zIndex,
      },
      size: this.size,
      rotation: this.actor.transform.getRenderRotation(),
      color: this.color,
    });
  }
}
