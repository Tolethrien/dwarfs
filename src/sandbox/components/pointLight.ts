import { Light } from "@aurora/urp/draw/draw";
import PragmaComponent from "@pragma/component";

interface PointLightProps {
  radius: number;
  color: RGBA;
  intensity: number;
}

// a round light on the actor, sent every frame
export default class PointLight extends PragmaComponent {
  public radius: number;
  public color: RGBA;
  public intensity: number;

  constructor(internal: InternalPCProps, props: PointLightProps) {
    super(internal);
    this.radius = props.radius;
    this.color = props.color;
    this.intensity = props.intensity;
  }

  render(): void {
    Light.point({
      position: this.actor.transform.getRenderPosition(),
      radius: this.radius,
      color: this.color,
      intensity: this.intensity,
    });
  }
}
