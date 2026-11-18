import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import type Dwarf from "../actors/dwarf";
import { DwarfRank } from "../content/dwarfs";
import { formatAmount, ResourcesID, type ResourceCost } from "../content/resources";
import Calendar, { type Alarm } from "../systems/calendar";
import Resources from "../systems/resources";
import Roster from "../systems/roster";
import TavernUI from "../ui/buildings/tavern";
import { toast } from "../ui/elements/toast";
import Drinker from "./drinker";
import Shift from "./shift";

const TAVERN = {
  applications: 10,
  perDay: 2,
  startApplications: 4,
  arrivalHour: 12,
  hireCost: { [ResourcesID.beer]: 20 } as ResourceCost,
};

export default class Tavern extends PragmaComponent {
  public readonly applications: Dwarf[] = [];
  private alarm: Alarm | undefined;
  declare private roster: Roster;
  declare private resources: Resources;
  declare private window: TavernUI;

  awake(): void {
    this.roster = this.scene.getSystem(Roster);
    this.resources = this.scene.getSystem(Resources);
    this.window = new TavernUI({
      applications: () => this.applications,
      limit: TAVERN.applications,
      perDay: TAVERN.perDay,
      arrivalHour: TAVERN.arrivalHour,
      hireCost: TAVERN.hireCost,
      lacking: (cost) => this.resources.missing(cost),
      beerPerHour: (dwarf) => this.drinker(dwarf).beerPerHour,
      hire: (dwarf) => this.hire(dwarf),
      dismiss: (dwarf) => this.dismiss(dwarf),
      crew: () => this.roster.dwarfs,
      stateOf: (dwarf) => this.roster.stateOf(dwarf),
      stationName: (dwarf) => this.roster.stationOf(dwarf)?.name,
      shiftEnd: (dwarf) => this.shift(dwarf).endsAt,
      openCard: (dwarf) => this.roster.showCard(dwarf, () => this.window.open()),
    });
  }

  start(): void {
    debug.game.connect("tavern", () => ({
      applications: this.applications.length,
      limit: TAVERN.applications,
      perDay: TAVERN.perDay,
      arrivalHour: TAVERN.arrivalHour,
      hireCost: Object.entries(TAVERN.hireCost)
        .map(([id, amount]) => formatAmount(Number(id) as ResourcesID, amount ?? 0))
        .join(", "),
    }));
    const calendar = this.scene.getSystem(Calendar);
    this.alarm = calendar.alarm({ hour: TAVERN.arrivalHour, everyDays: 1 }, () => this.arrive(TAVERN.perDay));
    this.arrive(TAVERN.startApplications);
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

  private arrive(count: number) {
    for (let index = 0; index < count; index++) {
      if (this.applications.length >= TAVERN.applications) return;
      this.applications.push(this.roster.createRandom(DwarfRank.worker));
    }
  }

  private hire(dwarf: Dwarf) {
    const lacking = this.resources.missing(TAVERN.hireCost);
    if (lacking.length > 0) {
      const short = lacking.map(([id, amount]) => formatAmount(id, amount)).join(", ");
      toast(`Not enough to hire ${dwarf.name}: ${short} short`, "error");
      return;
    }
    this.resources.pay(TAVERN.hireCost);
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
