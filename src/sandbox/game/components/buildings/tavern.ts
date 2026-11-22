import PragmaComponent from "@pragma/component";
import type { Signal } from "@axiom/events";
import { assert } from "@axiom/utils";
import type Dwarf from "../../actors/dwarf";
import { DwarfRank } from "../../content/dwarfs";
import { MainTraitsID } from "../../content/traits";
import { formatAmount, ResourcesID, type ResourceCost } from "../../content/resources";
import Calendar, { type Alarm } from "../../systems/core/calendar";
import { CAMP_STORE } from "../../sceneData";
import type { Stock } from "../common/storage";
import Roster from "../../systems/dwarfs/roster";
import TavernUI, { type TavernTab } from "../../ui/buildings/tavern";
import GameEvents from "../../systems/core/gameEvents";
import { toast } from "../../ui/elements/toast";
import Drinker from "../dwarfs/drinker";
import Shift from "../dwarfs/shift";

export interface TavernSignals {
  arrived: Signal<Dwarf[]>;
}

export const TAVERN = {
  applications: 10,
  perDay: 2,
  // the first crew and the first day's arrivals, the same every game
  startApplications: [MainTraitsID.intern],
  firstArrival: [MainTraitsID.miner, MainTraitsID.miner],
  arrivalHour: 12,
  hireCost: { [ResourcesID.beer]: 20 } as ResourceCost,
};

export default class Tavern extends PragmaComponent {
  public readonly applications: Dwarf[] = [];
  private alarm: Alarm | undefined;
  private arrivals = 0;
  declare private events: GameEvents;
  declare private roster: Roster;
  declare private store: Stock;
  declare private window: TavernUI;

  awake(): void {
    this.roster = this.scene.getSystem(Roster);
    this.store = this.scene.sharedData.require(CAMP_STORE);
    this.events = this.scene.getSystem(GameEvents);
    this.onActorEvent("open", () => this.open());
    this.window = new TavernUI({
      applications: () => this.applications,
      limit: TAVERN.applications,
      perDay: TAVERN.perDay,
      arrivalHour: TAVERN.arrivalHour,
      hireCost: TAVERN.hireCost,
      lacking: (cost) => this.store.missing(cost),
      beerPerHour: (dwarf) => this.drinker(dwarf).beerPerHour,
      hire: (dwarf) => this.hire(dwarf),
      dismiss: (dwarf) => this.dismiss(dwarf),
      crew: () => this.roster.dwarfs,
      stateOf: (dwarf) => this.roster.stateOf(dwarf),
      stationName: (dwarf) => this.roster.stationOf(dwarf)?.name,
      shiftEnd: (dwarf) => this.shift(dwarf).endsAt,
      openCard: (dwarf) => this.roster.showCard(dwarf, () => this.window.open()),
    });
    // here, not in start: whoever looks once the tavern is alive finds them
    for (const main of TAVERN.startApplications) this.applications.push(this.roster.create(main, DwarfRank.worker));
  }

  start(): void {
    const calendar = this.scene.getSystem(Calendar);
    this.alarm = calendar.alarm({ hour: TAVERN.arrivalHour, everyDays: 1 }, () => this.arrive());
  }

  update(): void {
    this.window.update();
  }

  destroy(): void {
    this.alarm?.cancel();
    this.alarm = undefined;
    this.window.close();
  }

  public open() {
    this.window.open();
  }

  public get isOpen() {
    return this.window.isOpen;
  }

  public get uiWindow() {
    return this.window.uiWindow;
  }

  public shows(tab: TavernTab) {
    return this.window.shownTab === tab;
  }

  public get startCrew() {
    return TAVERN.startApplications.length;
  }

  public get arrivalsCount() {
    return this.arrivals;
  }

  // hired for the player, the intro skipped; whoever can't be paid for stays
  public hireAll() {
    for (const dwarf of [...this.applications]) this.hire(dwarf);
  }

  public addApplication(main: MainTraitsID) {
    if (this.applications.length >= TAVERN.applications) return;
    this.applications.push(this.roster.create(main, DwarfRank.worker));
  }

  private arrive() {
    const first = this.arrivals === 0;
    this.arrivals++;
    const arrived: Dwarf[] = [];
    for (let index = 0; index < TAVERN.perDay; index++) {
      if (this.applications.length >= TAVERN.applications) break;
      const main = first ? TAVERN.firstArrival[index] : undefined;
      const dwarf = main === undefined ? this.roster.createRandom(DwarfRank.worker) : this.roster.create(main, DwarfRank.worker);
      this.applications.push(dwarf);
      arrived.push(dwarf);
    }
    if (arrived.length > 0) this.events.tavern.arrived.emit(arrived);
  }

  private hire(dwarf: Dwarf) {
    const lacking = this.store.missing(TAVERN.hireCost);
    if (lacking.length > 0) {
      const short = lacking.map(([id, amount]) => formatAmount(id, amount)).join(", ");
      toast(`Not enough to hire ${dwarf.name}: ${short} short`, "error");
      return;
    }
    this.store.pay(TAVERN.hireCost);
    this.remove(dwarf);
    this.roster.enlist(dwarf);
    toast(`${dwarf.name} hired`, "success");
  }

  private dismiss(dwarf: Dwarf) {
    this.remove(dwarf);
  }

  private remove(dwarf: Dwarf) {
    const index = this.applications.indexOf(dwarf);
    assert(index !== -1, `${dwarf.name} has no application in the tavern`);
    this.applications.splice(index, 1);
  }

  private shift(dwarf: Dwarf) {
    const shift = dwarf.getComponent(Shift);
    assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
    return shift;
  }

  private drinker(dwarf: Dwarf) {
    const drinker = dwarf.getComponent(Drinker);
    assert(drinker !== undefined, `Dwarf ${dwarf.name} has no Drinker`);
    return drinker;
  }
}
