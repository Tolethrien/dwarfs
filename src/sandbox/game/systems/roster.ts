import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import { gameCommands } from "../debugCommands";
import DwarfCardUI from "../ui/dwarfCard";
import Dwarf from "../actors/dwarf";
import Drinker from "../components/drinker";
import Effects from "../components/effects";
import Equipment from "../components/equipment";
import Outfit from "../components/outfit";
import Shift from "../components/shift";
import Traits from "../components/traits";
import type Station from "../actors/station";
import { ITEMS, type GearSlot, type ItemID } from "../content/gear";
import { SPECIAL_BEERS, type SpecialBeerID } from "../content/beers";
import { DwarfRank, getRandomDwarfLook, getRandomDwarfName } from "../content/dwarfs";
import { MAIN_TRAITS, TRAITS, type MainTraitsID } from "../content/traits";
import Buffs from "./buffs";
import Calendar from "./calendar";
import Workforce from "./workforce";
import SpawnTemplate from "./spawnTemplate";

// Object.keys gives enum numbers as strings
const CLASSES = Object.keys(MAIN_TRAITS).map(Number) as MainTraitsID[];

const ROSTER = { startWorkers: 6 };

export type DwarfState = "tavern" | "travelling" | "waiting" | "working" | "returning";

interface Whereabouts {
  state: DwarfState;
  station: Station | undefined;
}

export default class Roster extends PragmaSystem {
  public readonly dwarfs: Dwarf[] = [];
  private readonly whereabouts = new Map<Dwarf, Whereabouts>();
  declare private card: DwarfCardUI;
  declare private buffs: Buffs;
  declare private workforce: Workforce;
  declare private calendar: Calendar;
  public readonly template = new SpawnTemplate();

  awake(): void {
    this.buffs = this.scene.getSystem(Buffs);
    this.workforce = this.scene.getSystem(Workforce);
    this.calendar = this.scene.getSystem(Calendar);
    this.card = new DwarfCardUI(
      {
        previous: (dwarf) => this.neighbour(dwarf, -1),
        next: (dwarf) => this.neighbour(dwarf, 1),
      },
      this.workforce,
    );
    this.template.spawn = (count) => {
      for (let index = 0; index < count; index++) this.enlist(this.fromTemplate());
    };
    const roster = this;
    gameCommands("dwarf", {
      get list() {
        return roster.dwarfs;
      },
      card: (index: number = 0) => this.card.open(this.at(index)),
      spawn: (count: number = 1, foreman: boolean = false) => this.spawnRandom(count, foreman),
      pourBeer: (beer: SpecialBeerID, index: number = 0) => this.drinker(index).pour(beer),
      emptyBeer: (index: number = 0) => this.drinker(index).empty(),
      equip: (index: number, item: ItemID) => this.equipment(index).equip(item),
      unequip: (index: number, slot: GearSlot) => this.equipment(index).unequip(slot),
      get states() {
        return roster.counts();
      },
    });
  }

  start(): void {
    debug.game.connect("dwarfs", () => ({ counts: this.counts(), rows: this.dwarfs.map((dwarf) => this.row(dwarf)) }));
    this.spawnRandom(ROSTER.startWorkers, false);
  }

  update(): void {
    this.card.update();
  }

  private at(index: number) {
    const dwarf = this.dwarfs[index];
    assert(dwarf !== undefined, `No dwarf number ${index}, the roster has ${this.dwarfs.length}`);
    return dwarf;
  }

  private drinker(index: number) {
    const dwarf = this.at(index);
    const drinker = dwarf.getComponent(Drinker);
    assert(drinker !== undefined, `Dwarf ${dwarf.name} has no Drinker`);
    return drinker;
  }

  private equipment(index: number) {
    const dwarf = this.at(index);
    const equipment = dwarf.getComponent(Equipment);
    assert(equipment !== undefined, `Dwarf ${dwarf.name} is no foreman, only foremen wear items`);
    return equipment;
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
    return this.template.apply ? this.fromTemplate() : this.make(mainTrait, rank);
  }

  public fromTemplate() {
    const dwarf = this.make(this.template.mainTrait, this.template.rank);
    this.template.dress(dwarf);
    return dwarf;
  }

  private make(mainTrait: MainTraitsID, rank: DwarfRank) {
    return new Dwarf({
      mainTrait: mainTrait,
      rank: rank,
      look: getRandomDwarfLook(),
      name: getRandomDwarfName(),
      buffs: this.buffs,
      workforce: this.workforce,
    });
  }

  public createRandom(rank: DwarfRank) {
    return this.create(CLASSES[AxiomMath.randomArrayIndex(CLASSES)], rank);
  }

  public enlist(dwarf: Dwarf) {
    this.dwarfs.push(dwarf);
    this.whereabouts.set(dwarf, { state: "tavern", station: undefined });
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
    return !traits.foreman && traits.main === main;
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

  private counts() {
    const counts: Record<DwarfState, number> = { tavern: 0, travelling: 0, waiting: 0, working: 0, returning: 0 };
    for (const whereabouts of this.whereabouts.values()) counts[whereabouts.state]++;
    return counts;
  }

  private row(dwarf: Dwarf) {
    const traits = dwarf.getComponent(Traits);
    const effects = dwarf.getComponent(Effects);
    const drinker = dwarf.getComponent(Drinker);
    const shift = dwarf.getComponent(Shift);
    assert(traits !== undefined && effects !== undefined && drinker !== undefined && shift !== undefined, `Dwarf ${dwarf.name} lacks a component the debug report reads`);
    const station = this.stationOf(dwarf);
    const equipment = dwarf.getComponent(Equipment);
    return {
      name: dwarf.name,
      rank: traits.foreman ? "foreman" : "worker",
      class: MAIN_TRAITS[traits.main].name,
      state: this.stateOf(dwarf),
      station: station ? station.name : null,
      shiftHoursLeft: shift.endsAt === undefined ? null : shift.endsAt - this.calendar.time,
      beer: drinker.specialBeer === undefined ? null : SPECIAL_BEERS[drinker.specialBeer].name,
      speed: Math.round(effects.speed),
      power: Math.round(effects.power * 10) / 10,
      bph: Math.round(effects.bph * 10) / 10,
      traits: [...traits.list].map((trait) => TRAITS[trait].name),
      gear: equipment ? [...equipment.list.values()].map((item) => ITEMS[item].name) : [],
    };
  }

  public showCard(dwarf: Dwarf, back?: () => void) {
    this.card.open(dwarf, back);
  }

  private spawnRandom(count: number, foreman: boolean) {
    const rank = foreman ? DwarfRank.foreman : DwarfRank.worker;
    for (let index = 0; index < count; index++) this.enlist(this.createRandom(rank));
  }
}
