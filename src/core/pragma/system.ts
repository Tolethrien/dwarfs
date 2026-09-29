import { assert } from "@axiom/utils";
import type Coroutine from "@engine/coroutines/coroutine";
import type { CoroutineScript } from "@engine/coroutines/coroutine";
import { EnginePhase, ITERATED_PHASES } from "./pragma";
import type PragmaScene from "./scene";
import type { PragmaCoroutineOptions } from "./scene";

export type PragmaSystemRuns = "before" | "after";

abstract class PragmaSystem {
  public readonly ID: symbol;
  public readonly name: string;
  public readonly phases: EnginePhase;
  public readonly scene: PragmaScene;
  public readonly runs: PragmaSystemRuns = "before";
  private isSystemEnabled = true;
  private isRemoved = false;

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
    this.scene.coroutines.stopOwner(this.ID);
    this.destroy?.();
  }

  public startCoroutine<Result>(
    script: CoroutineScript<Result>,
    options?: PragmaCoroutineOptions,
  ): Coroutine<Result> {
    assert(
      !this.isRemoved,
      `System ${this.name} was removed from scene ${this.scene.getName}, it can't start coroutines`,
    );
    return this.scene.startCoroutine(script, {
      ...options,
      owner: this.ID,
      ownerName: `system ${this.name}`,
      active: () => this.isSystemEnabled,
    });
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
