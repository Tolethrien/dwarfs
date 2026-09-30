import Pragma from "@pragma/pragma";
import { Camera } from "@engine/camera/camera";
import GameMode from "../systems/gameMode";
import PhysBall from "../systems/physBall";
import MapDirector from "../systems/mapDirector";
import MapDiscovery from "../systems/mapDiscovery";
import MapBuilder from "../systems/mapBuilder";
import CameraController from "../systems/cameraController";
import PlayerInputsComponent from "../systems/playerInputComp";
import PlayerResources from "../systems/resources";
import InteractiveElements from "../systems/interactiveEvents";
import MapObject from "../managers/mapObject";
import SoundBank, { SoundsID } from "../managers/soundbank";
export default class GameScene {
  constructor() {
    const world = Pragma.addScene("testSetup");
    // added order = run order in every phase
    world.addSystem(GameMode);
    world.addSystem(PhysBall);
    world.addSystem(MapDirector);
    world.addSystem(MapDiscovery);
    world.addSystem(MapBuilder);
    world.addSystem(CameraController);
    world.addSystem(PlayerInputsComponent);
    world.addSystem(PlayerResources);
    world.addSystem(InteractiveElements);
    GameScene.setupCamera();
    // const ambientController = SoundBank.loopSound(SoundsID.ambientOne);
    // ambientController?.fadeOutAndStop(15);
  }
  private static setupCamera() {
    const bounds = MapObject.getWorldBounds();
    Camera.setOrigin("center");
    Camera.setMode("free");
    Camera.setFree({ speed: 500, acceleration: 33, deceleration: 11 });
    Camera.setZoomLimits(0.05, 4);
    // only zooms where a tile is whole pixels, the grid never goes uneven at rest
    Camera.setZoomLevels({ grid: MapObject.mapMeta.tileInPixels.width });
    Camera.setZoomSmoothing(8);
    Camera.setWheelZoom({ enabled: true, at: "cursor", step: 0.2, pull: 0 });
    Camera.setBounds({
      min: { x: bounds.x, y: bounds.y },
      max: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    });
    Camera.setZoom(0.5);
    Camera.teleport({ x: 9216, y: 1500 });
  }
}
