import PragmaActor from "@/core/pragma/actor";
import PlayerInputsComponent from "./playerInputComp";

export default class PlayerInputs extends PragmaActor {
  constructor() {
    super();
    this.addComponent(PlayerInputsComponent);
  }
}
