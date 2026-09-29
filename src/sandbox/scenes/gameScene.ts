import Pragma from "@pragma/pragma";
import { Camera } from "@engine/camera/camera";
import WorldPhysics from "../bActors/worldPhysics";
import MineMap from "../bActors/mineMap";
import Player from "../bActors/player";
import MapObject from "../managers/mapObject";
import SoundBank, { SoundsID } from "../managers/soundbank";
export type GameMode = { mode: "game" | "build" };
export default class GameScene {
  constructor() {
    const world = Pragma.addScene("testSetup");
    world.sharedData.add<GameMode>("gameMode", { mode: "game" });
    world.spawnActor(new WorldPhysics());
    world.spawnActor(new MineMap());
    world.spawnActor(new Player());
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
    Camera.setZoomSmoothing(8);
    Camera.setWheelZoom({ enabled: true, at: "cursor", step: 0.2, pull: 0 });
    Camera.setBounds({
      min: { x: bounds.x, y: bounds.y },
      max: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    });
    Camera.setZoom(0.05);
    Camera.teleport({ x: 9216, y: 1500 });
  }
}
