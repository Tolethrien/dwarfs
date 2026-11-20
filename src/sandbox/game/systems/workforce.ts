import PragmaSystem from "@pragma/system";
import { assert } from "@axiom/utils";
import type Effect from "../effects/effect";
import GameEvents from "./gameEvents";
import { BASE_GEAR, BaseGearID } from "../content/gear";
import { MAIN_TRAITS, WORKER_TRAITS, type MainTraitsID, type WorkerTraitID } from "../content/traits";

const WORKFORCE = { startGear: BaseGearID.universal };

// Object.keys gives enum numbers as strings
const GEAR_IDS = Object.keys(BASE_GEAR).map(Number) as BaseGearID[];
const CLASS_IDS = Object.keys(MAIN_TRAITS).map(Number) as MainTraitsID[];

export interface WornGear {
  gear: BaseGearID;
  level: number;
}

// the workers' standard, nothing of it for a foreman: the level of every base gear, the gear given
// to every class and the traits researched in AGH; a dwarf takes its gear when ordered (WornGear),
// the traits work at once: version goes up at every change of them, so the dwarfs (most of them out
// of the scene) can tell their effects are stale
export default class Workforce extends PragmaSystem {
  private readonly levels = new Map(GEAR_IDS.map((gear) => [gear, gear === WORKFORCE.startGear ? 1 : 0]));
  private readonly assigned = new Map(CLASS_IDS.map((main) => [main, WORKFORCE.startGear]));
  private readonly traits = new Set<WorkerTraitID>();
  private readonly traitEffects: Effect[] = [];
  private changes = 0;
  declare private events: GameEvents;

  awake(): void {
    this.events = this.scene.getSystem(GameEvents);
  }

  public get assignments(): ReadonlyMap<MainTraitsID, BaseGearID> {
    return this.assigned;
  }

  public touch() {
    this.changes++;
    this.events.dwarfs.statsChanged.emit("all");
  }

  public get version() {
    return this.changes;
  }

  public level(gear: BaseGearID) {
    return this.levels.get(gear) ?? 0;
  }

  public isUnlocked(gear: BaseGearID) {
    return this.level(gear) > 0;
  }

  public setLevel(gear: BaseGearID, level: number) {
    const max = BASE_GEAR[gear].levels.length;
    assert(level >= 0 && level <= max, `${BASE_GEAR[gear].name} has levels 0-${max}, not ${level}`);
    this.levels.set(gear, level);
  }

  public assign(main: MainTraitsID, gear: BaseGearID) {
    assert(this.isUnlocked(gear), `${BASE_GEAR[gear].name} is locked, it can't be given to ${MAIN_TRAITS[main].name}`);
    this.assigned.set(main, gear);
  }

  public gearFor(main: MainTraitsID): WornGear | undefined {
    const gear = this.assigned.get(main);
    if (gear === undefined || !this.isUnlocked(gear)) return undefined;
    return { gear: gear, level: this.level(gear) };
  }

  public get researched(): ReadonlySet<WorkerTraitID> {
    return this.traits;
  }

  public isResearched(id: WorkerTraitID) {
    return this.traits.has(id);
  }

  public research(id: WorkerTraitID) {
    this.traits.add(id);
    this.collect();
  }

  public forget(id: WorkerTraitID) {
    this.traits.delete(id);
    this.collect();
  }

  public get researchedEffects(): readonly Effect[] {
    return this.traitEffects;
  }

  private collect() {
    this.traitEffects.length = 0;
    for (const id of this.traits) this.traitEffects.push(...WORKER_TRAITS[id].effects);
    this.touch();
  }
}
