import { Draw } from "@aurora/urp/draw/draw";
import PragmaComponent from "@pragma/component";
import Materials from "../shaders/materials";

interface EmbersProps {
  // the flame, from the actor's position: the embers rise from here
  from: Position2D;
  // how wide and how high they go
  size: Size2D;
  zIndex: number;
}

// sparks rising off a flame forever (embers.wgsl), nothing kept on the cpu
export default class Embers extends PragmaComponent {
  public readonly props: EmbersProps;
  // neighbouring flames must not spark in step
  private readonly seed = Math.random() * 1000;

  constructor(internal: InternalPCProps, props: EmbersProps) {
    super(internal);
    this.props = props;
  }

  render(): void {
    const position = this.actor.transform.getRenderPosition();
    const size = this.props.size;
    Draw.rect({
      position: {
        x: position.x + this.props.from.x - size.width / 2,
        y: position.y + this.props.from.y - size.height,
        z: this.props.zIndex,
      },
      size,
      material: Materials.embers,
      params: [this.seed, 0, 0, 0],
    });
  }
}
