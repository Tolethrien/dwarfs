import PragmaSystem from "@pragma/system";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import { gameCommands } from "../debugCommands";
import type Effect from "../effects/effect";
import { BASE_GEAR, BaseGearID } from "../content/gear";
import { MAIN_TRAITS, WORKER_IDS, WORKER_TRAITS, type MainTraitsID, type WorkerTraitID } from "../content/traits";

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

  awake(): void {
    const workforce = this;
    gameCommands("workforce", {
      get levels() {
        return workforce.levels;
      },
      get assigned() {
        return workforce.assigned;
      },
      get researched() {
        return workforce.traits;
      },
      setLevel: (gear: BaseGearID, level: number) => this.setLevel(gear, level),
      assign: (main: MainTraitsID, gear: BaseGearID) => this.assign(main, gear),
      research: (id: WorkerTraitID) => this.research(id),
      forget: (id: WorkerTraitID) => this.forget(id),
    });
  }

  start(): void {
    debug.game.connect("workforce", () => ({
      gear: GEAR_IDS.map((gear) => ({
        name: BASE_GEAR[gear].name,
        level: this.level(gear),
        max: BASE_GEAR[gear].levels.length,
        classes: CLASS_IDS.filter((main) => this.assigned.get(main) === gear).map((main) => MAIN_TRAITS[main].name),
      })),
      research: WORKER_IDS.map((id) => ({
        name: WORKER_TRAITS[id].name,
        description: WORKER_TRAITS[id].description,
        researched: this.traits.has(id),
      })),
    }));
  }

  public touch() {
    this.changes++;
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
    this.changes++;
  }
}
