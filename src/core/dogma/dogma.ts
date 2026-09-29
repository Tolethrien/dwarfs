import { assert } from "@axiom/utils";
import Time from "@engine/time";
import DogmaScene, { PartialDSFlags } from "./scene";
export type SharedData = Record<string, unknown>;

export default class Dogma {
  private static scenes: Map<string, DogmaScene> = new Map();
  private static scenesToDispatch: Map<string, DogmaScene> = new Map();
  private static scenesToRemoved: Set<string> = new Set();
  private static sceneSorted: DogmaScene[] = [];
  public static readonly globalSharedData: Map<string, SharedData> = new Map();

  public static createScene(name: string, flags?: PartialDSFlags) {
    assert(!this.scenes.has(name), `Scen with name: ${name} already exist`);
    const scene = new DogmaScene(name, flags);

    if (flags?.priority !== undefined)
      scene.setFlag({ priority: flags.priority });
    else
      scene.setFlag({
        priority: this.scenes.size + this.scenesToDispatch.size,
      });
    this.scenesToDispatch.set(name, scene);
    return scene;
  }
  public static deleteScene(name: string) {
    const scene = this.scenes.get(name);
    assert(
      scene !== undefined,
      `Trying to remove scene: ${name}, but scene with that name don't exist`,
    );
    this.scenesToRemoved.add(name);
  }
  public static getScene(name: string) {
    let scene = this.scenes.get(name);
    if (scene === undefined) scene = this.scenesToDispatch.get(name);
    assert(
      scene !== undefined,
      `Trying to access scene: ${name}. Scene doesn't exist`,
    );
    return scene;
  }

  public static getAllScenes() {
    return this.scenes;
  }

  public static tickAll() {
    this.sceneDispatcher();

    this.sceneSorted.forEach((scene) => scene.systemDispatcher());
    this.sceneSorted.forEach((scene) => scene.entityDispatcher());

    this.sceneSorted.forEach((scene) => {
      if (!scene.getFlags().isActive) return;
      this.runPhase(scene, "preUpdate");
    });
    while (Time.requestFixedUpdate()) {
      this.sceneSorted.forEach((scene) => {
        if (!scene.getFlags().isActive) return;
        this.runPhase(scene, "fixedUpdate");
      });
    }

    // event timers count in ms, the delta is in seconds
    const frameDtMs = Time.getDeltaTime() * 1000;
    this.sceneSorted.forEach(
      (scene) =>
        scene.getFlags().isActive && scene.eventManager.updateTimers(frameDtMs),
    );
    this.sceneSorted.forEach((scene) => {
      if (!scene.getFlags().isActive) return;
      this.runPhase(scene, "update");
    });
    this.sceneSorted.forEach((scene) => {
      if (!scene.getFlags().isActive) return;
      this.runPhase(scene, "postUpdate");
    });
    Time.updateAlpha();

    this.sceneSorted.forEach((scene) => {
      this.runPhase(scene, "eventsDeferred");
      scene.eventManager.flush();
    });

    this.sceneSorted.forEach((scene) => {
      if (!scene.getFlags().isRendered) return;
      this.runPhase(scene, "render");
    });
  }
  // the phase's systems, then the scene's coroutines of that phase
  private static runPhase(scene: DogmaScene, phase: DogmaPhase) {
    scene
      .getPhaseSubscribers(phase)
      .forEach((entry) => entry.sysRef.isActive() && entry.callback());
    scene.coroutines.step(phase);
  }
  private static sceneDispatcher() {
    let needSorting = false;
    if (this.scenesToDispatch.size !== 0) {
      needSorting = true;
      this.scenesToDispatch
        .entries()
        .forEach(([name, scene]) => this.scenes.set(name, scene));
      this.scenesToDispatch.clear();
    }

    if (this.scenesToRemoved.size !== 0) {
      needSorting = true;
      this.scenesToRemoved.forEach((name) => {
        this.scenes.get(name)?.destroy();
        this.scenes.delete(name);
      });
      this.scenesToRemoved.clear();
    }
    if (needSorting) {
      const scenes = Array.from(this.scenes.values());
      scenes.sort(
        (sceneA, sceneB) =>
          sceneA.getFlags().priority - sceneB.getFlags().priority,
      );
      this.sceneSorted = [];
      scenes.forEach((scene) => this.sceneSorted.push(scene));
    }
  }
}
