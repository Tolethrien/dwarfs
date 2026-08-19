import PragmaActor from "@/core/pragma/actor";
import CameraController from "./cameraController";

export default class CameraActor extends PragmaActor {
  constructor() {
    super();
    this.addComponent(CameraController);
  }
}
