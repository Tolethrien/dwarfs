import PragmaActor from "@pragma/actor";
import CameraController from "../systems/cameraController";
import PlayerInputsComponent from "../systems/playerInputComp";
import PlayerResources from "../systems/resources";
import InteractiveElements from "../systems/interactiveEvents";
import TestUI from "../systems/testUI";
import TestShop from "../systems/testShop";
export default class Player extends PragmaActor {
  constructor() {
    super();
    this.addComponent(CameraController);
    this.addComponent(PlayerInputsComponent);
    this.addComponent(PlayerResources);
    this.addComponent(InteractiveElements);
    // this.addComponent(TestUI);
    // this.addComponent(TestShop);
  }
}
