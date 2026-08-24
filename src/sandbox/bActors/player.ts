import PragmaActor from "@/core/pragma/actor";
import CameraController from "../systems/cameraController";
import PlayerInputsComponent from "../systems/playerInputComp";
import PlayerResources from "../systems/resources";
export default class Player extends PragmaActor {
  constructor() {
    super();
    this.addComponent(CameraController);
    this.addComponent(PlayerInputsComponent);
    this.addComponent(PlayerResources);
  }
}
