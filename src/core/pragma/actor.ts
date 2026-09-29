import { assert } from "@axiom/utils";
import PragmaComponent from "./component";
import PragmaScene from "./scene";
import { EnginePhase, ITERATED_PHASES } from "./pragma";
import Transform from "./transform";
import { EventBus } from "@axiom/events";
import type Coroutine from "@engine/coroutines/coroutine";
import type { CoroutineScript } from "@engine/coroutines/coroutine";
import type { PragmaCoroutineOptions } from "./scene";

export default abstract class PragmaActor {
  public readonly ID: symbol;
  private components = new Map<PragmaComponentClass, PragmaComponent>();
  public readonly tags: Set<string> = new Set();
  private marker: string | undefined = undefined;
  private isVisible: boolean = true;
  private isEnabled: boolean = true;
  private isLive: boolean = false;
  // from the start of onDestroy until a respawn: no new coroutines
  private isDestroyed: boolean = false;
  private pendingToAdd: Set<PragmaComponent> = new Set();
  private pendingToRemove: Set<PragmaComponent> = new Set();
  // awake done, start comes after the whole batch
  private awaitingStart: PragmaComponent[] = [];
  declare public scene: PragmaScene;
  public events = new EventBus();
  public phaseRegistrator: PragmaPhaseRegistry = Object.fromEntries(
    ITERATED_PHASES.map((phase) => [phase, new Set<PragmaComponent>()]),
  ) as PragmaPhaseRegistry;

  constructor() {
    this.ID = Symbol(crypto.randomUUID());
    this.addComponent(Transform);
  }
  public addComponent<T extends PragmaComponentClass>(
    ctor: T,
    ...args: DropFirst<ConstructorParameters<T>>
  ) {
    assert(
      !this.components.has(ctor),
      `Trying to add multiple instance of Component: ${ctor.name} to Actor: ${this.constructor.name}, ID:${this.ID.description}`,
    );
    const component = new ctor({ actor: this }, ...args) as InstanceType<T>;

    if (this.isLive) {
      this.scene.actorsDirty.add(this);
      this.pendingToAdd.add(component);
    } else this.addToLocalPhases(component);

    this.components.set(ctor, component);
    return component;
  }
  public get transform() {
    return this.components.get(Transform)! as Transform;
  }
  public destroyComponent<T extends PragmaComponentClass>(ctor: T) {
    assert(ctor !== (Transform as unknown as T), `cannot remove Transform.`);
    const component = this.components.get(ctor);
    if (!component) {
      console.warn(
        `there in no component with name: ${ctor.name} in actor: ${this.ID.description}`,
      );
      return;
    }
    this.components.delete(ctor);
    if (this.isLive && !this.pendingToAdd.has(component)) {
      this.scene.actorsDirty.add(this);
      this.pendingToRemove.add(component);
      return;
    }
    // never woken up: no destroy, just drop it
    this.pendingToAdd.delete(component);
    this.deleteFromLocalPhases(component);
    component.releaseListeners();
  }
  public getComponent<T extends PragmaComponentClass>(ctor: T) {
    return this.components.get(ctor) as InstanceType<T> | undefined;
  }
  public hasComponent(ctor: PragmaComponentClass) {
    return this.components.has(ctor);
  }
  public getAllComponents() {
    return this.components.values();
  }
  public setMarker(marker: string) {
    this.marker = marker;
  }
  public getMarker() {
    return this.marker;
  }
  public setVisibility(visible: boolean) {
    this.isVisible = visible;
  }
  public setEnabled(enable: boolean) {
    this.isEnabled = enable;
  }
  public getVisibility() {
    return this.isVisible;
  }
  public getEnabled() {
    return this.isEnabled;
  }
  public getAlive() {
    return this.isLive;
  }
  // components queued from inside the loops land in the next batch, not the one iterated
  public resolvePending() {
    const added = [...this.pendingToAdd];
    this.pendingToAdd.clear();
    for (const component of added) {
      this.addToLocalPhases(component);
      this.awaitingStart.push(component);
      component.awake?.();
    }
    const removed = [...this.pendingToRemove];
    this.pendingToRemove.clear();
    for (const component of removed) {
      this.deleteFromLocalPhases(component);
      component.destroy?.();
      component.releaseListeners();
      component.failOrphanCoroutines();
    }
    this.updateScenePhases();
  }
  public startPending() {
    const started = this.awaitingStart.splice(0);
    for (const component of started) {
      // removed between its awake and start
      if (this.components.get(component.constructor as PragmaComponentClass) !== component) continue;
      component.start?.();
    }
  }
  public onAwake() {
    this.isDestroyed = false;
    this.components.forEach((component) => component.awake?.());
    this.isLive = true;
    // after awake: components added there are in the local registry already
    this.updateScenePhases();
  }
  public onStart() {
    this.components.forEach((component) => component.start?.());
  }
  public onDestroy() {
    this.isDestroyed = true;
    this.scene.coroutines.stopOwner(this.ID);
    this.components.forEach((component) => {
      if (!this.pendingToAdd.has(component)) component.destroy?.();
      component.releaseListeners();
    });
    for (const component of this.pendingToRemove) {
      component.destroy?.();
      component.releaseListeners();
    }
    this.pendingToAdd.clear();
    this.pendingToRemove.clear();
    this.awaitingStart.length = 0;
    // pending changes of a dead actor would put it back into the scene phases
    this.scene.actorsDirty.delete(this);
    for (const phase of ITERATED_PHASES)
      this.scene.actorsWithPhase[phase].delete(this);
    this.isLive = false;
  }
  private deleteFromLocalPhases(component: PragmaComponent) {
    for (const phase of ITERATED_PHASES) {
      this.phaseRegistrator[phase].delete(component);
    }
  }
  private addToLocalPhases(component: PragmaComponent) {
    for (const phase of ITERATED_PHASES) {
      if (component.phases & EnginePhase[phase]) {
        this.phaseRegistrator[phase].add(component);
      }
    }
  }
  private updateScenePhases() {
    for (const phase of ITERATED_PHASES) {
      const set = this.scene.actorsWithPhase[phase];
      this.phaseRegistrator[phase].size > 0 ? set.add(this) : set.delete(this);
    }
  }
  public selfDestroy() {
    this.scene.deleteActor(this);
  }

  // frozen while the actor is disabled, stopped when it's destroyed
  public startCoroutine<Result>(
    script: CoroutineScript<Result>,
    options?: PragmaCoroutineOptions,
  ): Coroutine<Result> {
    assert(
      this.scene !== undefined,
      `Actor ${this.constructor.name} (${this.ID.description}) is in no scene, add it before starting coroutines`,
    );
    // stopOwner already ran, nothing would ever stop it
    assert(
      !this.isDestroyed,
      `Actor ${this.constructor.name} (${this.ID.description}) is destroyed, it can't start coroutines (from destroy() use this.scene.startCoroutine)`,
    );
    return this.scene.startCoroutine(script, {
      ...options,
      owner: this.ID,
      ownerName: this.marker ?? `${this.constructor.name} ${this.ID.description?.slice(0, 4)}`,
      active: () => this.isEnabled,
    });
  }
  public stopCoroutine(key: string) {
    this.scene?.coroutines.stop(key, this.ID);
  }
  public restartCoroutine(key: string) {
    this.scene?.coroutines.restart(key, this.ID);
  }
  public skipCoroutine(key: string) {
    this.scene?.coroutines.skip(key, this.ID);
  }
  public skipCoroutineWait(key: string) {
    this.scene?.coroutines.skipWait(key, this.ID);
  }
  public stopAllCoroutines() {
    this.scene?.coroutines.stopOwner(this.ID);
  }
}
