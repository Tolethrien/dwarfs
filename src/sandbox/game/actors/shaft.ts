import PragmaActor from "@pragma/actor";
import ShaftFrame from "../components/mine/shaftFrame";
import ShaftDigging from "../components/mine/shaftDigging";

interface ShaftProps {
  position: Position2D;
  seed: number;
}

export default class Shaft extends PragmaActor {
  constructor(props: ShaftProps) {
    super();
    this.transform.teleport(props.position.x, props.position.y);
    this.addComponent(ShaftFrame);
    this.addComponent(ShaftDigging, { seed: props.seed });
  }
}
