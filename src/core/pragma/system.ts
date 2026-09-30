import type { EventBus } from "@axiom/events";
import { assert } from "@axiom/utils";
import type Coroutine from "@engine/coroutines/coroutine";
import type { CoroutineScript } from "@engine/coroutines/coroutine";
import Pragma, { EnginePhase, ITERATED_PHASES } from "./pragma";
import type PragmaScene from "./scene";
import type { PragmaCoroutineOptions } from "./scene";

export type PragmaSystemRuns = "before" | "after";

interface SystemListener {
  bus: EventBus;
  name: string;
  callback: (data: any) => void;
}

abstract class PragmaSystem {
  public readonly ID: symbol;
  public readonly name: string;
  public readonly phases: EnginePhase;
  public readonly scene: PragmaScene;
  public readonly runs: PragmaSystemRuns = "before";
  private isSystemEnabled = true;
  private isRemoved = false;
  private readonly listeners: SystemListener[] = [];
  private readonly startedCoroutines = new Map<Coroutine, string | undefined>();

  constructor(internal: InternalPSProps) {
    this.scene = internal.scene;
    this.name = this.constructor.name;
    this.ID = Symbol(this.name);
    let mask = EnginePhase.none;
    for (const phase of ITERATED_PHASES) {
      if (this[phase]) mask |= EnginePhase[phase];
    }
    this.phases = mask;
  }
  public setEnabled(enable: boolean) {
    this.isSystemEnabled = enable;
  }
  public getEnabled() {
    return this.isSystemEnabled;
  }
  public destroySelf() {
    const ctor = this.constructor as PragmaSystemClass;
    if (this.scene.findSystem(ctor) === this) this.scene.removeSystem(ctor);
  }
  public onDestroy() {
    this.isRemoved = true;
    this.destroy?.();
    this.releaseListeners();
    this.failOrphanCoroutines();
  }
  public emitSceneEvent<T>(name: string, data: T) {
    this.scene.events.emit(name, data);
  }
  public onSceneEvent<T>(name: string, cb: (data: T) => void) {
    this.listen(this.scene.events, name, cb);
  }
  public offSceneEvent<T>(name: string, cb: (data: T) => void) {
    this.unlisten(this.scene.events, name, cb);
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

  public startCoroutine<Result>(
    script: CoroutineScript<Result>,
    options?: PragmaCoroutineOptions,
  ): Coroutine<Result> {
    assert(
      !this.isRemoved,
      `System ${this.name} was removed from scene ${this.scene.getName}, it can't start coroutines`,
    );
    for (const started of this.startedCoroutines.keys()) {
      if (started.done) this.startedCoroutines.delete(started);
    }
    const coroutine = this.scene.startCoroutine(script, {
      ...options,
      owner: this.ID,
      ownerName: `system ${this.name}`,
      active: () => this.isSystemEnabled,
    });
    this.startedCoroutines.set(coroutine, options?.key);
    return coroutine;
  }
  public stopCoroutine(key: string) {
    this.scene.coroutines.stop(key, this.ID);
  }
  public restartCoroutine(key: string) {
    this.scene.coroutines.restart(key, this.ID);
  }
  public skipCoroutine(key: string) {
    this.scene.coroutines.skip(key, this.ID);
  }
  public skipCoroutineWait(key: string) {
    this.scene.coroutines.skipWait(key, this.ID);
  }
  public stopAllCoroutines() {
    this.scene.coroutines.stopOwner(this.ID);
  }
  // after destroy(): a coroutine still working on a removed system is a bug, it gets the
  // error at its yield (stop it in destroy() when the removal is on purpose)
  public failOrphanCoroutines() {
    for (const [coroutine, key] of this.startedCoroutines) {
      if (coroutine.done) continue;
      const name = key === undefined ? "" : ` "${key}"`;
      coroutine.throw(
        new Error(
          `System ${this.name} was removed from scene ${this.scene.getName} while its coroutine${name} was still running`,
        ),
      );
    }
    this.startedCoroutines.clear();
  }
}

interface PragmaSystem {
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

export default PragmaSystem;
