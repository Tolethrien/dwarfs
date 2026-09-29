import type { EventBus } from "@axiom/events";
import type Coroutine from "@engine/coroutines/coroutine";
import type { CoroutineScript } from "@engine/coroutines/coroutine";
import PragmaActor from "./actor";
import type { PragmaCoroutineOptions } from "./scene";
import Pragma, { EnginePhase, ITERATED_PHASES } from "./pragma";

interface ComponentListener {
  bus: EventBus;
  name: string;
  callback: (data: any) => void;
}

abstract class PragmaComponent {
  public readonly phases: EnginePhase;
  public readonly actor: PragmaActor;
  public readonly name: string;
  private isComponentEnabled: boolean = true;
  private readonly startedCoroutines = new Map<Coroutine, string | undefined>();
  private readonly listeners: ComponentListener[] = [];

  constructor(internal: InternalPCProps) {
    this.actor = internal.actor;
    this.name = this.constructor.name;
    let mask = EnginePhase.none;
    for (const phase of ITERATED_PHASES) {
      if (this[phase]) mask |= EnginePhase[phase];
    }
    this.phases = mask;
  }
  public destroySelf() {
    this.actor.destroyComponent(this.constructor as PragmaComponentClass);
  }
  public getSibling<T extends PragmaComponentClass>(Ctor: T) {
    return this.actor.getComponent(Ctor);
  }
  public get scene() {
    return this.actor.scene;
  }
  public get tags() {
    return this.actor.tags;
  }
  public setEnabled(enable: boolean) {
    this.isComponentEnabled = enable;
  }
  public getEnabled() {
    return this.isComponentEnabled;
  }
  public emitActorEvent<T>(name: string, data: T) {
    this.actor.events.emit(name, data);
  }
  public onActorEvent<T>(name: string, cb: (data: T) => void) {
    this.listen(this.actor.events, name, cb);
  }
  public offActorEvent<T>(name: string, cb: (data: T) => void) {
    this.unlisten(this.actor.events, name, cb);
  }
  public emitSceneEvent<T>(name: string, data: T) {
    this.actor.scene.events.emit(name, data);
  }
  public onSceneEvent<T>(name: string, cb: (data: T) => void) {
    this.listen(this.actor.scene.events, name, cb);
  }
  public offSceneEvent<T>(name: string, cb: (data: T) => void) {
    this.unlisten(this.actor.scene.events, name, cb);
  }
  public emitGlobalEvent<T>(name: string, data: T) {
    Pragma.events.emit(name, data);
  }
  public onGlobalEvent<T>(name: string, cb: (data: T) => void) {
    this.listen(Pragma.events, name, cb);
  }
  public offGlobalEvent<T>(name: string, cb: (data: T) => void) {
    this.unlisten(Pragma.events, name, cb);
  }
  public releaseListeners() {
    for (const listener of this.listeners)
      listener.bus.off(listener.name, listener.callback);
    this.listeners.length = 0;
  }
  private listen<T>(bus: EventBus, name: string, callback: (data: T) => void) {
    bus.on(name, callback);
    this.listeners.push({ bus, name, callback });
  }
  private unlisten<T>(
    bus: EventBus,
    name: string,
    callback: (data: T) => void,
  ) {
    bus.off(name, callback);
    const index = this.listeners.findIndex(
      (listener) =>
        listener.bus === bus &&
        listener.name === name &&
        listener.callback === callback,
    );
    if (index !== -1) this.listeners.splice(index, 1);
  }
  public get systemSharedData() {
    return this.scene.sharedData;
  }

  // owned by the actor: keys are shared with its other components
  public startCoroutine<Result>(
    script: CoroutineScript<Result>,
    options?: PragmaCoroutineOptions,
  ): Coroutine<Result> {
    for (const started of this.startedCoroutines.keys()) {
      if (started.done) this.startedCoroutines.delete(started);
    }
    const coroutine = this.actor.startCoroutine(script, options);
    this.startedCoroutines.set(coroutine, options?.key);
    return coroutine;
  }
  public stopCoroutine(key: string) {
    this.actor.stopCoroutine(key);
  }
  public restartCoroutine(key: string) {
    this.actor.restartCoroutine(key);
  }
  public skipCoroutine(key: string) {
    this.actor.skipCoroutine(key);
  }
  public skipCoroutineWait(key: string) {
    this.actor.skipCoroutineWait(key);
  }
  // after destroy(): a coroutine still working on a removed component is a bug, it gets the
  // error at its yield (stop it in destroy() when the removal is on purpose)
  public failOrphanCoroutines() {
    for (const [coroutine, key] of this.startedCoroutines) {
      if (coroutine.done) continue;
      const name = key === undefined ? "" : ` "${key}"`;
      coroutine.throw(
        new Error(
          `Component ${this.name} of ${this.actor.constructor.name} was destroyed while its coroutine${name} was still running`,
        ),
      );
    }
    this.startedCoroutines.clear();
  }
}

interface PragmaComponent {
  awake?(): void;
  start?(): void;
  destroy?(): void;
  preFixedUpdate?(): void;
  fixedUpdate?(): void;
  preUpdate?(): void;
  update?(): void;
  postUpdate?(): void;
  render?(): void;
}

export default PragmaComponent;
