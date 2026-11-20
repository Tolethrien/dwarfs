import Navi from "@navi/navi";
import type UINode from "@navi/node";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import type Dwarf from "../../actors/dwarf";
import type Station from "../../actors/station";
import { STATION } from "../../actors/station";
import LayeredSprite from "../../components/layeredSprite";
import Shift from "../../components/shift";
import Traits from "../../components/traits";
import { ACTIVE_MAIN_TRAITS, MAIN_TRAITS, MainTraitsID } from "../../content/traits";
import { SPECIAL_BEERS, type SpecialBeerID } from "../../content/beers";
import type { ResourceCost, ResourcesID } from "../../content/resources";
import { UI_THEME } from "../../content/ui";
import { CALENDAR } from "../../systems/calendar";
import type { DwarfState } from "../../systems/roster";
import { closeOnCameraMove, UIWindow } from "../elements/window";
import { row } from "../elements/row";
import { text } from "../elements/text";
import { button, type UIButton } from "../elements/button";
import { header } from "../elements/header";
import { stepper } from "../elements/stepper";
import { gridCells } from "../elements/grid";
import { cost, costEntries } from "../elements/cost";
import { table, type UITable } from "../elements/table";
import { portrait } from "../elements/portrait";
import { dropdown, type DropdownItem } from "../elements/dropdown";
import { collapsible } from "../elements/collapsible";
import { input } from "../elements/input";

export interface StationMenuActions {
  freeCount: (main: MainTraitsID) => number;
  wage: (main: MainTraitsID, hours: number) => ResourceCost | undefined;
  lacking: (cost: ResourceCost) => [ResourcesID, number][];
  connected: (station: Station) => boolean;
  haul: (station: Station) => string;
  order: (main: MainTraitsID, hours: number, beer: SpecialBeerID | undefined, station: Station) => void;
  beerOf: (dwarf: Dwarf, station: Station) => SpecialBeerID | undefined;
  rename: (station: Station, name: string) => void;
  setPriority: (station: Station, priority: number) => void;
  assigned: (station: Station) => Dwarf[];
  stateOf: (dwarf: Dwarf) => DwarfState;
  canShoot: (station: Station) => boolean;
  shoot: (station: Station) => void;
  recall: (station: Station, working: boolean) => void;
  inTavern: () => Dwarf[];
  // temporary, for testing: says itself why not
  sendNow: (dwarf: Dwarf, hours: number, beer: SpecialBeerID | undefined, station: Station) => void;
}

const MENU = {
  width: 400,
  ordered: { look: 32, name: 130, state: 190, listHeight: 135 },
  nameLength: 24,
};

const CLASSES = ACTIVE_MAIN_TRAITS;
const BEERS: DropdownItem<SpecialBeerID | undefined>[] = [
  { id: undefined, title: "No special beer" },
  ...(Object.keys(SPECIAL_BEERS).map(Number) as SpecialBeerID[]).map((id) => ({
    id: id as SpecialBeerID | undefined,
    title: SPECIAL_BEERS[id].name,
  })),
];

export default class StationMenuUI {
  private readonly window = new UIWindow({
    kind: "docked",
    slot: "center",
    width: MENU.width,
    title: () => this.station?.name ?? "",
    closeOnMove: closeOnCameraMove(),
    onClose: () => (this.station = undefined),
  });
  private station: Station | undefined;
  private main = CLASSES[0];
  private hours = STATION.shift.start;
  private beer: SpecialBeerID | undefined = undefined;
  private settingsOpen = false;
  declare private classes: UINode;
  declare private wage: UINode;
  declare private shootButton: UIButton;
  declare private orderButton: UIButton;
  declare private unconnected: UINode;
  declare private list: UITable;
  private shownWage = "";
  private shownOrdered: Dwarf[] = [];
  // the debug pick: the dropdown reads this list on every opening, refilled in place
  private readonly tavernItems: DropdownItem<Dwarf | undefined>[] = [];
  private shownTavern: Dwarf[] = [];
  private picked: Dwarf | undefined;

  constructor(private readonly actions: StationMenuActions) {}

  public update() {
    const station = this.station;
    if (station) {
      this.shootButton.input = this.actions.canShoot(station) ? "absorb" : "disabled";
      const connected = this.actions.connected(station);
      this.orderButton.input = connected ? "absorb" : "disabled";
      this.unconnected.setActive(!connected);
      this.showWage();
      this.showOrdered(station);
      this.showTavern();
    }
    this.window.update();
  }

  public open(station: Station) {
    if (this.station === station && this.window.isOpen) return;
    this.window.close();
    this.station = station;
    this.build(this.window.open(), station);
  }

  public close() {
    this.window.close();
  }

  public get isOpen() {
    return this.window.isOpen;
  }

  private build(content: UINode, station: Station) {
    text(content, () => `Haul: ${this.actions.haul(station)}`);
    const order = header(content, "Order");
    this.unconnected = text(order, "Not connected to the shaft, nobody can be sent here", {
      color: UI_THEME.colors.lacking,
    });
    this.unconnected.setActive(!this.actions.connected(station));
    this.classes = gridCells(order);
    this.showClasses();
    stepper(order, "Shift", () => `${this.hours} h`, (step) => {
      this.hours = AxiomMath.clamp(this.hours + step, STATION.shift.min, STATION.shift.max);
    });
    const beer = row(order, { align: "between" });
    text(beer, "Beer");
    dropdown(beer, BEERS, this.beer, (id) => (this.beer = id));
    const actions = row(order, { align: "between" });
    this.wage = row(actions, { fit: true });
    this.shownWage = "";
    this.showWage();
    const buttons = row(actions, { fit: true });
    this.orderButton = button(buttons, "Order", () => this.actions.order(this.main, this.hours, this.beer, station));
    this.shootButton = button(buttons, "Shoot", () => this.actions.shoot(station));
    this.addSendNow(order, station);

    const ordered = header(
      content,
      () => `Ordered ${this.actions.assigned(station).length}/${STATION.manualLimit}`,
    );
    const columns = MENU.ordered;
    this.list = table(
      ordered,
      [
        { title: "", width: columns.look },
        { title: "Name", width: columns.name },
        { title: "", width: columns.state },
      ],
      { height: columns.listHeight },
    );
    this.shownOrdered = [];
    this.fillOrdered(station);
    const recall = row(content, { fit: true });
    button(recall, "Recall waiting", () => this.actions.recall(station, false));
    button(recall, "Recall all", () => this.actions.recall(station, true));
    this.addSettings(content, station);
  }

  private addSendNow(parent: UINode, station: Station) {
    const line = row(parent, { align: "between" });
    text(line, "Debug");
    const pick = row(line, { fit: true });
    this.shownTavern = [];
    this.showTavern();
    dropdown(pick, this.tavernItems, this.picked, (dwarf) => (this.picked = dwarf));
    button(pick, "Send now", () => {
      if (this.picked) this.actions.sendNow(this.picked, this.hours, this.beer, station);
    });
  }

  private showTavern() {
    const tavern = this.actions.inTavern();
    const same = tavern.length === this.shownTavern.length && tavern.every((dwarf, index) => dwarf === this.shownTavern[index]);
    if (same) return;
    this.shownTavern = tavern;
    this.tavernItems.length = 0;
    this.tavernItems.push({ id: undefined, title: "Pick a dwarf" });
    for (const dwarf of tavern) {
      const traits = dwarf.getComponent(Traits);
      assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
      const rank = traits.foreman ? ", foreman" : "";
      this.tavernItems.push({ id: dwarf, title: `${dwarf.name} (${MAIN_TRAITS[traits.main].name}${rank})` });
    }
  }

  private addSettings(parent: UINode, station: Station) {
    const settings = collapsible(parent, "Settings", this.settingsOpen, (open) => (this.settingsOpen = open));
    const name = row(settings, { align: "between" });
    text(name, "Name");
    input(name, {
      value: station.name,
      maxLength: MENU.nameLength,
      width: MENU.width / 2,
      submit: (value) => {
        if (value.trim().length > 0) this.actions.rename(station, value.trim());
      },
    });
    stepper(settings, "Priority", () => `${station.priority}`, (step) => {
      this.actions.setPriority(station, Math.max(station.priority + step, 0));
    });
  }

  private showClasses() {
    Navi.clear(this.classes);
    for (const main of CLASSES)
      button(
        this.classes,
        () => `${MainTraitsID[main]} (${this.actions.freeCount(main)})`,
        () => {
          this.main = main;
          this.showClasses();
        },
        { selected: main === this.main },
      );
  }

  private showWage() {
    const wage = this.actions.wage(this.main, this.hours);
    const lacking = wage ? this.actions.lacking(wage) : [];
    const shown = JSON.stringify([wage, lacking]);
    if (shown === this.shownWage) return;
    this.shownWage = shown;
    Navi.clear(this.wage);
    if (wage) cost(this.wage, costEntries(wage, lacking));
    else text(this.wage, "Nobody free", { color: UI_THEME.colors.muted });
  }

  private showOrdered(station: Station) {
    const ordered = this.actions.assigned(station);
    const same =
      ordered.length === this.shownOrdered.length &&
      ordered.every((dwarf, index) => dwarf === this.shownOrdered[index]);
    if (!same) this.fillOrdered(station);
  }

  private fillOrdered(station: Station) {
    const ordered = this.actions.assigned(station);
    this.shownOrdered = ordered;
    Navi.clear(this.list.body);
    if (ordered.length === 0) {
      this.list.row(["", "Nobody ordered"]);
      return;
    }
    for (const dwarf of ordered) {
      const sprite = dwarf.getComponent(LayeredSprite);
      assert(sprite !== undefined, `Dwarf ${dwarf.name} has no LayeredSprite`);
      this.list.row([
        { build: (cell) => portrait(cell, sprite.layers) },
        dwarf.name,
        () => this.stateText(dwarf, station),
      ]);
    }
  }

  private stateText(dwarf: Dwarf, station: Station) {
    const beer = this.actions.beerOf(dwarf, station);
    const state = this.whereText(dwarf);
    return beer === undefined ? state : `${state} · ${SPECIAL_BEERS[beer].name}`;
  }

  private whereText(dwarf: Dwarf) {
    const state = this.actions.stateOf(dwarf);
    if (state === "travelling") return "on the way";
    if (state !== "working") return state;
    const shift = dwarf.getComponent(Shift);
    assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
    const hour = String((shift.endsAt ?? 0) % CALENDAR.hoursPerDay).padStart(2, "0");
    return `working till ${hour}:00`;
  }
}
