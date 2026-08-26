import Pragma from "@/core/pragma/pragma";
import WorldPhysics from "../bActors/worldPhysics";
import MineMap from "../bActors/mineMap";
import Player from "../bActors/player";
import CameraObject from "../managers/cameraObject";
export type GameMode = { mode: "game" | "build" };
export default class GameScene {
  constructor() {
    const world = Pragma.addScene("testSetup");
    world.sharedData.add<GameMode>("gameMode", { mode: "game" });
    world.spawnActor(new WorldPhysics());
    world.spawnActor(new MineMap());
    world.spawnActor(new Player());
    CameraObject.setZoom(0.05);
    CameraObject.setPosition(9216, 1500);
    // const ambientController = SoundBank.loopSound(SoundsID.ambientOne);
    // ambientController?.fadeOutAndStop(15);
  }
}
