import PragmaActor from "@/core/pragma/actor";
import PhysBallComponent from "./physBallCom";

export default class PhysBall extends PragmaActor {
  constructor() {
    super();
    this.addComponent(PhysBallComponent);
  }
}
