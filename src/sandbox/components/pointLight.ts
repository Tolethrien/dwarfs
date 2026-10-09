import { Light } from "@aurora/urp/draw/draw";
import PragmaComponent from "@pragma/component";

interface PointLightProps {
  radius: number;
  color: RGBA;
  intensity: number;
  // from the actor's position
  offset?: Position2D;
  // stopped by rock
  occluded?: boolean;
}

// a round light on the actor, sent every frame
export default class PointLight extends PragmaComponent {
  public radius: number;
  public color: RGBA;
  public intensity: number;
  public offset: Position2D;
  public occluded: boolean;

  constructor(internal: InternalPCProps, props: PointLightProps) {
    super(internal);
    this.radius = props.radius;
    this.color = props.color;
    this.intensity = props.intensity;
    this.offset = props.offset ?? { x: 0, y: 0 };
    this.occluded = props.occluded ?? false;
  }

  render(): void {
    const position = this.actor.transform.getRenderPosition();
    Light.point({
      position: { x: position.x + this.offset.x, y: position.y + this.offset.y },
      radius: this.radius,
      color: this.color,
      intensity: this.intensity,
      occluded: this.occluded,
    });
  }
}
