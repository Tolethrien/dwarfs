import PragmaComponent from "@pragma/component";
import Time from "@engine/time";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import Physics from "./physics";
import Sprite from "./sprite";

interface FacingProps {
  // how fast it turns after the flight direction, per second; a bounce flips the velocity at
  // once, the actor swings over instead of jumping
  turnRate: number;
}

// turns the actor's face where it flies: the sprite looks right, so it is rotated by the flight
// direction; flying left it would hang upside down, so it is mirrored top to bottom then (the same
// as mirrored left to right and turned half a circle, but the rotation never jumps, the transform
// interpolation would spin it through the half turn)
export default class Facing extends PragmaComponent {
  public readonly turnRate: number;
  // radians, smoothed flight direction; NaN until the actor first moves
  public direction = NaN;
  public flipped = false;
  declare private physics: Physics;
  declare private sprite: Sprite;

  constructor(internal: InternalPCProps, props: FacingProps) {
    super(internal);
    this.turnRate = props.turnRate;
  }

  start(): void {
    const physics = this.getSibling(Physics);
    const sprite = this.getSibling(Sprite);
    assert(physics !== undefined && sprite !== undefined, "Facing: the actor needs Physics and Sprite");
    this.physics = physics;
    this.sprite = sprite;
  }

  update(): void {
    const velocity = this.physics.velocity;
    if (velocity.isZero()) return;
    const target = Math.atan2(velocity.y, velocity.x);
    const step = 1 - Math.exp(-this.turnRate * Time.getDeltaTime());
    this.direction = Number.isNaN(this.direction)
      ? target
      : AxiomMath.lerpAngle(this.direction, target, step);

    this.flipped = Math.cos(this.direction) < 0;
    this.sprite.flipY = this.flipped;
    this.actor.transform.setRotation(this.direction);
  }
}
