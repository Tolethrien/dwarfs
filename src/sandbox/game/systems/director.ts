import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import Navi from "@navi/navi";
import type { ActionName } from "../content/actions";
import { gameSwitch } from "../debugCommands";
import { SURFACE } from "../content/surface";
import Terrain from "./terrain";

const DIRECTOR = {
  startZoom: 0.25,
  zoomSmoothing: 4,
  zoomLimits: { min: 0.0625, max: 4 },
};

export default class Director extends PragmaSystem {
  private readonly move: Position2D = { x: 0, y: 0 };
  declare private terrain: Terrain;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    gameSwitch(
      "hideUi",
      "hide ui",
      () => !Navi.root.active,
      (on) => Navi.root.setActive(!on),
    );
  }

  start(): void {
    Camera.setOrigin("center");
    Camera.setMode("free");
    Camera.setZoomLimits(DIRECTOR.zoomLimits.min, DIRECTOR.zoomLimits.max);
    Camera.setZoom(DIRECTOR.startZoom);
    Camera.setPosition(this.terrain.startPoint);
    const map = this.terrain.world.mapInPixels;
    Camera.setBounds({ min: { x: 0, y: -SURFACE.height }, max: { x: map.width, y: map.height } });
    Camera.setZoomSmoothing(DIRECTOR.zoomSmoothing);
    // the first frame lands on the start zoom instead of gliding there
    Camera.snap();
  }

  update(): void {
    this.move.x = this.held("cameraRight") - this.held("cameraLeft");
    this.move.y = this.held("cameraDown") - this.held("cameraUp");
    Camera.pan(this.move);

    if (InputManager.onActionPressed("zoomIn")) Camera.zoomBy(1);
    if (InputManager.onActionPressed("zoomOut")) Camera.zoomBy(-1);
  }

  private held(action: ActionName) {
    return InputManager.onActionHold(action) ? 1 : 0;
  }
}
