import { EventBus, SharedData } from "@axiom/events";
import { assert } from "@axiom/utils";
import type Coroutine from "@engine/coroutines/coroutine";
import type { CoroutineScript } from "@engine/coroutines/coroutine";
import CoroutineGroup, {
  type CoroutineStartOptions,
} from "@engine/coroutines/coroutineGroup";
import PragmaActor from "./actor";
import { EnginePhase, FIXED_PHASES, ITERATED_PHASES } from "./pragma";
import type PragmaSystem from "./system";

export type PragmaCoroutineOptions = Partial<
  Pick<
    CoroutineStartOptions<IteratedPragmaPhases>,
    "phase" | "key" | "time" | "name"
  >
>;
interface SceneProps {
  sceneName: string;
  active?: boolean;
}
export default class PragmaScene {
  private sceneName: string;
  public active: boolean;
  private actorsInScene: Map<symbol, PragmaActor> = new Map();
  public actorsDirty: Set<PragmaActor> = new Set();

  public readonly actorsWithPhase: Record<
    IteratedPragmaPhases,
    Set<PragmaActor>
  > = Object.fromEntries(
    ITERATED_PHASES.map((phase) => [phase, new Set<PragmaActor>()]),
  ) as Record<IteratedPragmaPhases, Set<PragmaActor>>;
  public readonly actorsToAdd: Set<PragmaActor> = new Set();
  public readonly actorsToRemove: Set<PragmaActor> = new Set();
  public readonly events = new EventBus();
  public readonly sharedData = new SharedData();
  // stepped after each phase's systems and actors; owners are actors and systems
  public readonly coroutines: CoroutineGroup<IteratedPragmaPhases>;
  // looked up at once after addSystem, stays until the removal is processed
  private readonly systems = new Map<PragmaSystemClass, PragmaSystem>();
  // live systems in the order they were added
  private readonly systemsRunning = {
    before: [] as PragmaSystem[],
    after: [] as PragmaSystem[],
  };
  private readonly systemsToAdd: PragmaSystem[] = [];
  private readonly systemsToRemove = new Set<PragmaSystem>();
  constructor(props: SceneProps) {
    this.sceneName = props.sceneName;
    this.active = props.active ?? true;
    this.coroutines = new CoroutineGroup("update", {
      name: `Pragma ${props.sceneName}`,
      stepPhases: [...FIXED_PHASES],
    });
  }
  public get getAllActors() {
    return this.actorsInScene.values();
  }
  public get getActorsCount() {
    return this.actorsInScene.size;
  }
  public get getName() {
    return this.sceneName;
  }

  private runPhase(phase: IteratedPragmaPhases) {
    PragmaScene.runSystems(this.systemsRunning.before, phase);
    for (const actor of this.actorsWithPhase[phase]) {
      if (phase !== "render" && !actor.getEnabled()) continue;
      if (phase === "render" && !actor.getVisibility()) continue;
      for (const component of actor.phaseRegistrator[phase]) {
        if (!component.getEnabled()) continue;
        component[phase]!();
      }
    }
    PragmaScene.runSystems(this.systemsRunning.after, phase);
    this.coroutines.step(phase);
  }
  private static runSystems(
    systems: PragmaSystem[],
    phase: IteratedPragmaPhases,
  ) {
    for (const system of systems) {
      if (!system.getEnabled() || !(system.phases & EnginePhase[phase]))
        continue;
      system[phase]!();
    }
  }

  public prePhase() {
    // systems of a batch wake up before its actors, so a component finds them in awake
    while (this.systemsToAdd.length > 0 || this.actorsToAdd.size > 0) {
      this.addPendingSystems();
      const batch = new Set(this.actorsToAdd);
      this.actorsToAdd.clear();

      for (const actor of batch) {
        this.actorsInScene.set(actor.ID, actor);
        actor.onAwake();
      }
      for (const actor of batch) {
        actor.onStart();
      }
    }
    for (const actor of this.actorsToRemove) {
      if (!actor.getAlive()) {
        this.actorsToAdd.delete(actor);
        continue;
      }
      actor.onDestroy();
      this.actorsInScene.delete(actor.ID);
    }
    this.actorsToRemove.clear();
    this.removePendingSystems();
    while (this.actorsDirty.size > 0) {
      const batch = [...this.actorsDirty];
      this.actorsDirty.clear();
      for (const actor of batch) actor.resolvePending();
      for (const actor of batch) actor.startPending();
    }

    this.runPhase("preUpdate");
  }
  public fixedPhase() {
    this.runPhase("preFixedUpdate");
    this.runPhase("fixedUpdate");
  }
  public postPhase() {
    this.runPhase("update");
    this.runPhase("postUpdate");
    this.runPhase("render");
  }
  public addSystem<T extends PragmaSystemClass>(
    ctor: T,
    ...args: DropFirst<ConstructorParameters<T>>
  ) {
    const current = this.systems.get(ctor);
    assert(
      current === undefined || this.systemsToRemove.has(current),
      `Trying to add a second ${ctor.name} system to scene ${this.sceneName}`,
    );
    const system = new ctor({ scene: this }, ...args) as InstanceType<T>;
    this.systems.set(ctor, system);
    this.systemsToAdd.push(system);
    return system;
  }
  public removeSystem(ctor: PragmaSystemClass) {
    const system = this.systems.get(ctor);
    if (!system) {
      console.warn(
        `There is no ${ctor.name} system in scene ${this.sceneName} to remove`,
      );
      return;
    }
    const queued = this.systemsToAdd.indexOf(system);
    if (queued !== -1) {
      this.systemsToAdd.splice(queued, 1);
      this.systems.delete(ctor);
      return;
    }
    this.systemsToRemove.add(system);
  }
  public getSystem<T extends PragmaSystemClass>(ctor: T) {
    const system = this.systems.get(ctor);
    assert(
      system !== undefined,
      `Scene ${this.sceneName} has no ${ctor.name} system`,
    );
    return system as InstanceType<T>;
  }
  public findSystem<T extends PragmaSystemClass>(ctor: T) {
    return this.systems.get(ctor) as InstanceType<T> | undefined;
  }
  public startCoroutine<Result>(
    script: CoroutineScript<Result>,
    options?: Partial<CoroutineStartOptions<IteratedPragmaPhases>>,
  ): Coroutine<Result> {
    const phase = options?.phase ?? "update";
    const time = options?.time ?? (FIXED_PHASES.has(phase) ? "fixed" : "game");
    return this.coroutines.start(script, { ...options, phase, time });
  }
  public destroy() {
    for (const actor of this.actorsInScene.values()) actor.onDestroy();
    for (const system of this.systemsRunning.before) system.onDestroy();
    for (const system of this.systemsRunning.after) system.onDestroy();
    this.coroutines.stopAll();
  }
  private addPendingSystems() {
    const batch = this.systemsToAdd.splice(0);
    for (const system of batch) {
      this.systemsRunning[system.runs].push(system);
      system.awake?.();
    }
    for (const system of batch) system.start?.();
  }
  private removePendingSystems() {
    for (const system of this.systemsToRemove) {
      system.onDestroy();
      const running = this.systemsRunning[system.runs];
      running.splice(running.indexOf(system), 1);
      const ctor = system.constructor as PragmaSystemClass;
      if (this.systems.get(ctor) === system) this.systems.delete(ctor);
    }
    this.systemsToRemove.clear();
  }
  public spawnActor(actor: PragmaActor) {
    assert(
      !actor.getAlive() && !actor.scene?.actorsToAdd.has(actor),
      `Actor ${actor.constructor.name} (${actor.ID.description}) is already spawned or queued in scene ${actor.scene?.getName}`,
    );
    const parent = actor.transform.getParent();
    assert(
      parent === null ||
        parent.actor.scene === undefined ||
        parent.actor.scene === this,
      `Actor ${actor.constructor.name} (${actor.ID.description}) has its parent in scene ${parent?.actor.scene?.getName}, can't spawn it in ${this.sceneName}`,
    );
    actor.scene = this;
    this.actorsToAdd.add(actor);
  }
  public deleteActor(actor: PragmaActor) {
    assert(
      actor.scene === this,
      `Actor ${actor.constructor.name} (${actor.ID.description}) is not in scene ${this.sceneName}, can't delete it from there`,
    );
    this.actorsToRemove.add(actor);
  }
}
