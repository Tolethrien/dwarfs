import { Draw } from "@aurora/urp/draw/draw";
import PragmaComponent from "@pragma/component";
import Aurora from "@aurora/core";
import Materials from "../shaders/materials";

interface TrailProps {
  // how long a point of the path stays, in seconds
  seconds: number;
  // at the actor, thinning to 0 at the end
  width: number;
  color: RGBA;
  zIndex: number;
}

interface TrailPoint {
  x: number;
  y: number;
  bornAt: number;
}

// a fading streak along the path the actor flew in the last moment
export default class Trail extends PragmaComponent {
  public readonly props: TrailProps;
  private points: TrailPoint[] = [];

  constructor(internal: InternalPCProps, props: TrailProps) {
    super(internal);
    this.props = props;
  }

  render(): void {
    const now = Aurora.getGameTime;
    const position = this.actor.transform.getRenderPosition();
    // standing still (or paused, the game time stops) adds nothing, the list does not grow
    const last = this.points[this.points.length - 1];
    if (!last || last.x !== position.x || last.y !== position.y)
      this.points.push({ x: position.x, y: position.y, bornAt: now });
    // the frame time wraps every hour: a negative age is a point from before the wrap
    while (this.points.length > 0) {
      const age = now - this.points[0].bornAt;
      if (age >= 0 && age < this.props.seconds) break;
      this.points.shift();
    }

    const color = this.props.color;
    for (let index = 1; index < this.points.length; index++) {
      const from = this.points[index - 1];
      const to = this.points[index];
      const left = 1 - (now - from.bornAt) / this.props.seconds;
      if (left <= 0) continue;
      Draw.line({
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        z: this.props.zIndex,
        width: this.props.width * left,
        cap: "round",
        color: [color[0], color[1], color[2], color[3] * left * left],
        material: Materials.trail,
      });
    }
  }
}
