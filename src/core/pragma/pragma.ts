import Time from "@engine/time";
import { EventBus } from "@axiom/events";
import PragmaActor from "./actor";
import PragmaScene from "./scene";

export enum EnginePhase {
  none = 0,
  awake = 1 << 0,
  start = 1 << 1,
  preFixedUpdate = 1 << 2,
  fixedUpdate = 1 << 3,
  preUpdate = 1 << 4,
  update = 1 << 5,
  postUpdate = 1 << 6,
  render = 1 << 7,
  destroy = 1 << 8,
}
//order dependent for engine
export const ITERATED_PHASES = [
  "preFixedUpdate",
  "fixedUpdate",
  "preUpdate",
  "update",
  "postUpdate",
  "render",
] as const satisfies readonly IteratedPragmaPhases[];
// run several times a frame, coroutines there use fixed time and step per step
export const FIXED_PHASES: ReadonlySet<IteratedPragmaPhases> = new Set([
  "preFixedUpdate",
  "fixedUpdate",
]);

export default class Pragma {
  private static sceneList: Map<string, PragmaScene> = new Map();
  public static readonly events = new EventBus();

  public static addScene(sceneName: string, active?: boolean) {
    // replaced scene goes like deleteScene, its place in the order stays
    this.sceneList.get(sceneName)?.destroy();
    const scene = new PragmaScene({ sceneName, active });
    this.sceneList.set(sceneName, scene);
    return scene;
  }
  public static deleteScene(sceneName: string) {
    const scene = this.sceneList.get(sceneName);
    if (!scene) {
      console.warn(`There is no scene with name: ${sceneName} to remove`);
      return;
    }
    scene.destroy();
    this.sceneList.delete(sceneName);
  }
  public static getScene(sceneName: string) {
    return this.sceneList.get(sceneName);
  }

  public static update() {
    this.sceneList.forEach((scene) => scene.active && scene.prePhase());
    while (Time.requestFixedUpdate()) {
      this.sceneList.forEach((scene) => scene.active && scene.fixedPhase());
    }
    Time.updateAlpha();
    this.sceneList.forEach((scene) => scene.active && scene.postPhase());
  }
  public static addActor(actor: PragmaActor, sceneName: string) {
    const scene = this.sceneList.get(sceneName);
    if (!scene) {
      console.warn(
        `There is no scene with name ${sceneName}. Trying add actor: ${actor.ID.description}`,
      );
      return;
    }
    scene.spawnActor(actor);
  }
  public static deleteActor(actor: PragmaActor, sceneName: string) {
    const scene = this.sceneList.get(sceneName);
    if (!scene) {
      console.warn(
        `There is no scene with name ${sceneName}. Trying to remove actor: ${actor.ID.description}`,
      );
      return;
    }
    scene.deleteActor(actor);
  }
  public static emitGlobalEvent<T>(name: string, data: T) {
    this.events.emit(name, data);
  }
  public static onGlobalEvent<T>(name: string, cb: (data: T) => void) {
    this.events.on(name, cb);
  }
  public static offGlobalEvent<T>(name: string, cb: (data: T) => void) {
    this.events.off(name, cb);
  }
}
