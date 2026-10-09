import { Light } from "@aurora/urp/draw/draw";
import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import Facing from "./facing";

interface HeadlightProps {
  length: number;
  // half angle, radians
  spread: number;
  color: RGBA;
  intensity: number;
  // the lamp from the sprite's centre, unrotated and not mirrored (sprite pixels at scale 1)
  lamp: Position2D;
  // a small light on the lamp itself
  glow: { radius: number; intensity: number };
}

// a beam from the helmet lamp where the actor looks (Facing), not a glow around it
export default class Headlight extends PragmaComponent {
  public props: HeadlightProps;
  declare private facing: Facing;

  constructor(internal: InternalPCProps, props: HeadlightProps) {
    super(internal);
    this.props = props;
  }

  start(): void {
    const facing = this.getSibling(Facing);
    assert(facing !== undefined, "Headlight: the actor has no Facing to follow");
    this.facing = facing;
  }

  // the lamp turns with the sprite: mirrored like it (Facing), then rotated like the actor; the
  // beam goes along the rotation
  render(): void {
    if (Number.isNaN(this.facing.direction)) return;
    const transform = this.actor.transform;
    const position = transform.getRenderPosition();
    const rotation = transform.getRenderRotation();
    const lampX = this.props.lamp.x;
    const lampY = this.facing.flipped ? -this.props.lamp.y : this.props.lamp.y;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const lamp = {
      x: position.x + lampX * cos - lampY * sin,
      y: position.y + lampX * sin + lampY * cos,
    };
    Light.cone({
      position: lamp,
      direction: rotation,
      length: this.props.length,
      spread: this.props.spread,
      color: this.props.color,
      intensity: this.props.intensity,
      occluded: true,
    });
    // the lamp itself glows a little: the beam visibly comes out of the helmet
    Light.point({
      position: lamp,
      radius: this.props.glow.radius,
      color: this.props.color,
      intensity: this.props.glow.intensity,
    });
  }
}
