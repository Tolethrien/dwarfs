import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import DwarfCardUI from "../../ui/dwarfCard";
import Dwarf from "../../actors/dwarf";
import Morale, { MORALE } from "../../components/dwarfs/morale";
import Outfit from "../../components/dwarfs/outfit";
import Shift from "../../components/dwarfs/shift";
import Traits from "../../components/dwarfs/traits";
import type Station from "../../actors/station";
import { DwarfRank, getRandomDwarfLook, getRandomDwarfName } from "../../content/dwarfs";
import { ACTIVE_MAIN_TRAITS, TraitsID, type MainTraitsID } from "../../content/traits";
import Buffs from "./buffs";
import Workforce from "./workforce";
import GameEvents from "../core/gameEvents";

const ROSTER = { startWorkers: 0 };

export type DwarfState = "tavern" | "travelling" | "waiting" | "working" | "returning";

// mine: everyone out of the tavern, on the way there and back too
export type DwarfGroup = "all" | "mine" | DwarfState[];

interface Whereabouts {
  state: DwarfState;
  station: Station | undefined;
}

export default class Roster extends PragmaSystem {
  public readonly dwarfs: Dwarf[] = [];
  public moraleOn = false;
  private readonly whereabouts = new Map<Dwarf, Whereabouts>();
  declare private card: DwarfCardUI;
  declare private buffs: Buffs;
  declare private workforce: Workforce;
  declare private events: GameEvents;
  public createInstead: (() => Dwarf) | undefined;

  awake(): void {
    this.buffs = this.scene.getSystem(Buffs);
    this.workforce = this.scene.getSystem(Workforce);
    this.card = new DwarfCardUI(
      {
        previous: (dwarf) => this.neighbour(dwarf, -1),
        next: (dwarf) => this.neighbour(dwarf, 1),
      },
      this.workforce,
    );
    this.events = this.scene.getSystem(GameEvents);
    this.connect(this.events.calendar.hourStarted, () => this.hour());
    this.connect(this.events.dwarfs.statsChanged, (changed) => {
      if (changed === "all") this.syncTavernGear();
      this.fitMorale(changed);
    });
  }

  start(): void {
    this.spawnRandom(ROSTER.startWorkers, false);
  }

  update(): void {
    this.card.update();
  }

  public dwarfsIn(where: DwarfGroup) {
    if (where === "all") return this.dwarfs;
    if (where === "mine") return this.dwarfs.filter((dwarf) => this.stateOf(dwarf) !== "tavern");
    return this.dwarfs.filter((dwarf) => where.includes(this.stateOf(dwarf)));
  }

  public addTraitAll(trait: TraitsID, where: DwarfGroup = "all", hours?: number) {
    for (const dwarf of this.dwarfsIn(where)) this.traitsOf(dwarf).add(trait, hours);
  }

  public removeTraitAll(trait: TraitsID) {
    for (const dwarf of this.dwarfs) this.traitsOf(dwarf).remove(trait);
  }

  private traitsOf(dwarf: Dwarf) {
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    return traits;
  }

  private neighbour(dwarf: Dwarf, step: number) {
    const count = this.dwarfs.length;
    const index = this.dwarfs.indexOf(dwarf);
    return this.dwarfs[(index + step + count) % count];
  }

  public recruit(mainTrait: MainTraitsID, rank: DwarfRank) {
    const dwarf = this.create(mainTrait, rank);
    this.enlist(dwarf);
    return dwarf;
  }

  public create(mainTrait: MainTraitsID, rank: DwarfRank) {
    return this.createInstead?.() ?? this.make(mainTrait, rank);
  }

  public make(mainTrait: MainTraitsID, rank: DwarfRank) {
    return new Dwarf({
      mainTrait: mainTrait,
      rank: rank,
      look: getRandomDwarfLook(),
      name: getRandomDwarfName(),
      buffs: this.buffs,
      workforce: this.workforce,
      events: this.events,
    });
  }

  public createRandom(rank: DwarfRank) {
    return this.create(ACTIVE_MAIN_TRAITS[AxiomMath.randomArrayIndex(ACTIVE_MAIN_TRAITS)], rank);
  }

  public enlist(dwarf: Dwarf) {
    this.dwarfs.push(dwarf);
    this.whereabouts.set(dwarf, { state: "tavern", station: undefined });
    this.equipFromWorkforce(dwarf);
  }

  // out of the roster for good; take it out of the mine first
  public dismiss(dwarf: Dwarf) {
    const index = this.dwarfs.indexOf(dwarf);
    assert(index !== -1, `Dwarf ${dwarf.name} is not in the roster`);
    this.dwarfs.splice(index, 1);
    this.whereabouts.delete(dwarf);
  }

  public freeWorker(main: MainTraitsID) {
    return this.dwarfs.find((dwarf) => this.isFreeWorker(dwarf, main));
  }

  private isFreeWorker(dwarf: Dwarf, main: MainTraitsID) {
    if (this.stateOf(dwarf) !== "tavern") return false;
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    return !traits.foreman && traits.main === main && !traits.has(TraitsID.tired);
  }

  public inTavern() {
    return this.dwarfs.filter((dwarf) => this.stateOf(dwarf) === "tavern");
  }

  public freeCount(main: MainTraitsID) {
    return this.dwarfs.filter((dwarf) => this.isFreeWorker(dwarf, main)).length;
  }

  public assignedTo(station: Station) {
    return this.dwarfs.filter((dwarf) => this.stationOf(dwarf) === station);
  }

  public stateOf(dwarf: Dwarf) {
    return this.whereaboutsOf(dwarf).state;
  }

  public stationOf(dwarf: Dwarf) {
    return this.whereaboutsOf(dwarf).station;
  }

  public send(dwarf: Dwarf, station: Station) {
    this.change(dwarf, "tavern", "travelling");
    this.whereaboutsOf(dwarf).station = station;
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    if (traits.foreman) return;
    const outfit = dwarf.getComponent(Outfit);
    assert(outfit !== undefined, `Worker ${dwarf.name} has no Outfit`);
    outfit.wear(this.workforce.gearFor(traits.main));
  }

  public arrive(dwarf: Dwarf) {
    this.change(dwarf, "travelling", "waiting");
  }

  public deploy(dwarf: Dwarf) {
    this.change(dwarf, "waiting", "working");
  }

  public leave(dwarf: Dwarf) {
    const whereabouts = this.whereaboutsOf(dwarf);
    assert(
      whereabouts.station !== undefined,
      `Dwarf ${dwarf.name} has to be at a station to leave it, it is ${whereabouts.state}`,
    );
    whereabouts.state = "returning";
    whereabouts.station = undefined;
  }

  public returnHome(dwarf: Dwarf) {
    const whereabouts = this.whereaboutsOf(dwarf);
    whereabouts.state = "tavern";
    whereabouts.station = undefined;
    this.equipFromWorkforce(dwarf);
  }

  private syncTavernGear() {
    for (const dwarf of this.inTavern()) this.equipFromWorkforce(dwarf);
  }

  private equipFromWorkforce(dwarf: Dwarf) {
    const traits = this.traitsOf(dwarf);
    if (traits.foreman) return;
    const outfit = dwarf.getComponent(Outfit);
    assert(outfit !== undefined, `Worker ${dwarf.name} has no Outfit`);
    const next = this.workforce.gearFor(traits.main);
    const current = outfit.worn;
    if (current?.gear === next?.gear && current?.level === next?.level) return;
    outfit.wear(next);
  }

  private change(dwarf: Dwarf, from: DwarfState, to: DwarfState) {
    const whereabouts = this.whereaboutsOf(dwarf);
    assert(
      whereabouts.state === from,
      `Dwarf ${dwarf.name} has to be ${from} to become ${to}, it is ${whereabouts.state}`,
    );
    whereabouts.state = to;
  }

  private whereaboutsOf(dwarf: Dwarf) {
    const whereabouts = this.whereabouts.get(dwarf);
    assert(whereabouts !== undefined, `Dwarf ${dwarf.name} is not in the roster`);
    return whereabouts;
  }

  public counts() {
    const counts: Record<DwarfState, number> = { tavern: 0, travelling: 0, waiting: 0, working: 0, returning: 0 };
    for (const whereabouts of this.whereabouts.values()) counts[whereabouts.state]++;
    return counts;
  }

  public get tiredCount() {
    let tired = 0;
    for (const dwarf of this.dwarfs) if (this.traitsOf(dwarf).has(TraitsID.tired)) tired++;
    return tired;
  }

  // every dwarf starts full, the ones working too; it moves from the next full hour
  public beginMorale() {
    this.moraleOn = true;
    this.card.showMorale();
    for (const dwarf of this.dwarfs) this.setMorale(dwarf, MORALE.start);
  }

  public moraleOf(dwarf: Dwarf) {
    const morale = dwarf.getComponent(Morale);
    assert(morale !== undefined, `Dwarf ${dwarf.name} has no Morale`);
    return morale;
  }

  public setMorale(dwarf: Dwarf, value: number) {
    const morale = this.moraleOf(dwarf);
    morale.set(value);
    this.checkQuit(dwarf, morale.value);
  }

  public changeMorale(dwarf: Dwarf, points: number) {
    const morale = this.moraleOf(dwarf);
    morale.change(points);
    this.checkQuit(dwarf, morale.value);
  }

  public giveMorale(dwarf: Dwarf, points: number) {
    const morale = this.moraleOf(dwarf);
    morale.give(points);
    this.checkQuit(dwarf, morale.value);
  }

  public setMoraleAll(value: number, where: DwarfGroup = "all") {
    for (const dwarf of this.dwarfsIn(where)) this.setMorale(dwarf, value);
  }

  public changeMoraleAll(points: number, where: DwarfGroup = "all") {
    for (const dwarf of this.dwarfsIn(where)) this.changeMorale(dwarf, points);
  }

  public giveMoraleAll(points: number, where: DwarfGroup = "all") {
    for (const dwarf of this.dwarfsIn(where)) this.giveMorale(dwarf, points);
  }

  private hour() {
    for (const dwarf of this.dwarfs) {
      this.traitsOf(dwarf).hourPassed();
      if (!this.moraleOn) continue;
      const state = this.stateOf(dwarf);
      if (state === "working") this.changeMorale(dwarf, MORALE.work);
      else if (state === "tavern") this.changeMorale(dwarf, MORALE.tavern);
    }
  }

  private fitMorale(changed: Dwarf | "all") {
    if (!this.moraleOn) return;
    const dwarfs = changed === "all" ? this.dwarfs : [changed];
    for (const dwarf of dwarfs) {
      if (!this.dwarfs.includes(dwarf)) continue;
      const morale = this.moraleOf(dwarf);
      if (morale.fit()) this.checkQuit(dwarf, morale.value);
    }
  }

  private checkQuit(dwarf: Dwarf, value: number) {
    if (value > 0 || this.stateOf(dwarf) !== "working") return;
    const shift = dwarf.getComponent(Shift);
    assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
    this.events.inbox.push.emit({
      kind: "warning",
      title: `${dwarf.name} quit the shift`,
      body: "Morale fell to 0 — returning to the tavern.",
    });
    shift.cutShort();
  }

  public showCard(dwarf: Dwarf, back?: () => void) {
    this.card.open(dwarf, back);
  }

  public spawnRandom(count: number, foreman: boolean) {
    const rank = foreman ? DwarfRank.foreman : DwarfRank.worker;
    for (let index = 0; index < count; index++) this.enlist(this.createRandom(rank));
  }
}
