import PragmaActor from "@pragma/actor";
import ShaftFrame from "../components/shaftFrame";
import ShaftDigging from "../components/shaftDigging";

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
