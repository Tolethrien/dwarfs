import Navi from "@navi/navi";
import type UINode from "@navi/node";
import { assert } from "@axiom/utils";
import type Dwarf from "../../actors/dwarf";
import LayeredSprite from "../../components/common/layeredSprite";
import Traits from "../../components/dwarfs/traits";
import { MainTraitsID } from "../../content/traits";
import type { ResourceCost, ResourcesID } from "../../content/resources";
import { UI_THEME } from "../../content/ui";
import { CALENDAR } from "../../systems/core/calendar";
import type { DwarfState } from "../../systems/dwarfs/roster";
import { closeOnCameraMove, UIWindow } from "../elements/window";
import { row } from "../elements/row";
import { column } from "../elements/column";
import { text } from "../elements/text";
import { button } from "../elements/button";
import { header } from "../elements/header";
import { cost, costEntries } from "../elements/cost";
import { table, type UITable } from "../elements/table";
import { tabs, type TabItem } from "../elements/tabs";
import { portrait } from "../elements/portrait";

export interface TavernActions {
  applications: () => readonly Dwarf[];
  limit: number;
  perDay: number;
  arrivalHour: number;
  hireCost: ResourceCost;
  lacking: (cost: ResourceCost) => [ResourcesID, number][];
  beerPerHour: (dwarf: Dwarf) => number;
  hire: (dwarf: Dwarf) => void;
  dismiss: (dwarf: Dwarf) => void;
  crew: () => readonly Dwarf[];
  stateOf: (dwarf: Dwarf) => DwarfState;
  stationName: (dwarf: Dwarf) => string | undefined;
  shiftEnd: (dwarf: Dwarf) => number | undefined;
  openCard: (dwarf: Dwarf) => void;
}

export type TavernTab = "applications" | "crew";

const TABS: TabItem<TavernTab>[] = [
  { id: "applications", title: "Applications" },
  { id: "crew", title: "Crew" },
];

const STATES: Record<DwarfState, string> = {
  tavern: "tavern",
  travelling: "on the way",
  waiting: "waiting",
  working: "working",
  returning: "returning",
};

const TAVERN_UI = {
  width: 640,
  listHeight: 360,
  // both lists end at the same edge, the window's width without its padding and the scrollbar:
  // columns add up to 570 and 558 (the gaps and the row padding make up the rest)
  applications: { look: 32, name: 190, type: 90, bph: 50, offer: 208 },
  crew: { look: 32, name: 140, type: 60, rank: 60, state: 166, shift: 60, bph: 40 },
};

export default class TavernUI {
  private readonly window = new UIWindow({ kind: "docked", width: TAVERN_UI.width, title: "Tavern", closeOnMove: closeOnCameraMove() });
  private tab: TavernTab = "applications";
  declare private tabBar: UINode;
  declare private body: UINode;
  private list: UITable | undefined;
  private shown: readonly Dwarf[] = [];
  private crewScroll = 0;

  constructor(private readonly actions: TavernActions) {}

  public open() {
    if (this.window.isOpen) return;
    const content = this.window.open();
    this.tabBar = row(content, { fit: true });
    this.body = column(content);
    this.showTab();
  }

  public close() {
    this.window.close();
  }

  public get isOpen() {
    return this.window.isOpen;
  }

  public update() {
    if (this.window.isOpen) this.followList();
    this.window.update();
  }

  public get uiWindow() {
    return this.window;
  }

  public get shownTab(): TavernTab | undefined {
    return this.window.isOpen ? this.tab : undefined;
  }

  private pick(tab: TavernTab) {
    this.tab = tab;
    this.showTab();
  }

  private showTab() {
    Navi.clear(this.tabBar);
    tabs(this.tabBar, TABS, this.tab, (tab) => this.pick(tab));
    Navi.clear(this.body);
    if (this.tab === "applications") this.buildApplications(this.body);
    else this.buildCrew(this.body);
  }

  private listed() {
    return this.tab === "applications" ? this.actions.applications() : this.actions.crew();
  }

  private followList() {
    const listed = this.listed();
    const same =
      listed.length === this.shown.length && listed.every((dwarf, index) => dwarf === this.shown[index]);
    if (same) return;
    if (this.tab === "applications") this.fillApplications();
    else this.fillCrew();
  }

  private buildApplications(parent: UINode) {
    const actions = this.actions;
    const section = header(parent, () => `Applications ${actions.applications().length}/${actions.limit}`);
    text(section, () => this.arrivalText(), { color: UI_THEME.colors.muted });
    const columns = TAVERN_UI.applications;
    this.list = table(
      section,
      [
        { title: "", width: columns.look },
        { title: "Name", width: columns.name },
        { title: "Class", width: columns.type },
        { title: "BPH", width: columns.bph, align: "end" },
        { title: "", width: columns.offer, align: "end" },
      ],
      { height: TAVERN_UI.listHeight },
    );
    this.fillApplications();
  }

  private arrivalText() {
    const actions = this.actions;
    if (actions.applications().length >= actions.limit) return "The list is full, nobody new comes";
    return `${actions.perDay} new every day at ${hourText(actions.arrivalHour)}`;
  }

  private fillApplications() {
    const list = this.startList();
    const applications = this.actions.applications();
    if (applications.length === 0) {
      list.row(["", "Nobody waits"]);
      return;
    }
    for (const dwarf of applications)
      list.row([
        { build: (cell) => portrait(cell, layersOf(dwarf)) },
        dwarf.name,
        MainTraitsID[traitsOf(dwarf).main],
        `${this.actions.beerPerHour(dwarf)}`,
        { build: (cell) => this.addOffer(cell, dwarf) },
      ]);
  }

  private addOffer(cell: UINode, dwarf: Dwarf) {
    const offer = row(cell, { fit: true });
    const price = this.actions.hireCost;
    cost(offer, costEntries(price, this.actions.lacking(price)));
    button(offer, "Hire", () => this.actions.hire(dwarf));
    button(offer, "Dismiss", () => this.actions.dismiss(dwarf));
  }

  private buildCrew(parent: UINode) {
    const section = header(parent, () => `Crew ${this.actions.crew().length}`);
    const columns = TAVERN_UI.crew;
    this.list = table(
      section,
      [
        { title: "", width: columns.look },
        { title: "Name", width: columns.name },
        { title: "Class", width: columns.type },
        { title: "Rank", width: columns.rank },
        { title: "Where", width: columns.state },
        { title: "Shift", width: columns.shift },
        { title: "BPH", width: columns.bph, align: "end" },
      ],
      { height: TAVERN_UI.listHeight, offset: this.crewScroll },
    );
    this.crewScroll = 0;
    this.fillCrew();
  }

  // a row is a button: the dwarf's card, the tavern closed so it's not under this modal and opened
  // again on the crew when the card closes
  private fillCrew() {
    const list = this.startList();
    for (const dwarf of this.actions.crew()) {
      const traits = traitsOf(dwarf);
      list.row(
        [
          { build: (cell) => portrait(cell, layersOf(dwarf)) },
          dwarf.name,
          MainTraitsID[traits.main],
          traits.foreman ? "foreman" : "worker",
          () => this.whereText(dwarf),
          () => {
            const end = this.actions.shiftEnd(dwarf);
            return end === undefined ? "—" : hourText(end);
          },
          () => `${this.actions.beerPerHour(dwarf)}`,
        ],
        {
          click: () => {
            this.crewScroll = list.body.scrollOffset.y;
            this.close();
            this.actions.openCard(dwarf);
          },
        },
      );
    }
  }

  private whereText(dwarf: Dwarf) {
    const state = STATES[this.actions.stateOf(dwarf)];
    const station = this.actions.stationName(dwarf);
    return station === undefined ? state : `${state} · ${station}`;
  }

  private startList() {
    const list = this.list;
    assert(list !== undefined, "The tavern's list is filled before it's built");
    this.shown = [...this.listed()];
    Navi.clear(list.body);
    return list;
  }
}

function hourText(hour: number) {
  return `${String(hour % CALENDAR.hoursPerDay).padStart(2, "0")}:00`;
}

function layersOf(dwarf: Dwarf) {
  const sprite = dwarf.getComponent(LayeredSprite);
  assert(sprite !== undefined, `Dwarf ${dwarf.name} has no LayeredSprite`);
  return sprite.layers;
}

function traitsOf(dwarf: Dwarf) {
  const traits = dwarf.getComponent(Traits);
  assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
  return traits;
}
