import PragmaActor from "@pragma/actor";
import PhysBall from "@sandbox/systems/physBall";

export default class WorldPhysics extends PragmaActor {
  constructor() {
    super();
    this.addComponent(PhysBall);
  }
}
