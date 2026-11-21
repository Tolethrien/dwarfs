import type UINode from "@navi/node";
import { formatAmount, ResourcesID, type ResourceCost } from "../../content/resources";
import type { HeadquartersLevel } from "../../components/buildings/headquarters";
import { CALENDAR } from "../../systems/core/calendar";
import { UI_THEME } from "../../content/ui";
import { closeOnCameraMove, UIWindow } from "../elements/window";
import { button } from "../elements/button";
import { confirm } from "../elements/confirm";
import { cost, costEntries } from "../elements/cost";
import { header } from "../elements/header";
import { stepper } from "../elements/stepper";
import { text } from "../elements/text";

export interface HeadquartersActions {
  director: () => string;
  level: () => number;
  next: () => HeadquartersLevel | undefined;
  shaftLimit: (level: number) => number;
  missing: (cost: ResourceCost) => [ResourcesID, number][];
  upgrade: () => void;
  shipmentHour: number;
  shipmentStone: number;
  shipmentBeer: number;
  shipDaily: () => number;
  shipReserve: () => number;
  shippable: () => number;
  changeShipDaily: (step: -1 | 1) => void;
  changeShipReserve: (step: -1 | 1) => void;
}

export default class HeadquartersUI {
  private readonly window = new UIWindow({ kind: "docked", width: 420, title: "Headquarters", closeOnMove: closeOnCameraMove() });

  constructor(private readonly actions: HeadquartersActions) {}

  public open() {
    if (this.window.isOpen) return;
    this.build(this.window.open());
  }

  public close() {
    this.window.close();
  }

  public update() {
    this.window.update();
  }

  private build(parent: UINode) {
    const level = this.actions.level();
    text(parent, `Director: Comrade ${this.actions.director()}`);
    text(parent, `Mine level ${level}`);
    text(parent, `The shaft reaches ${this.actions.shaftLimit(level)} tiles deep`, { color: UI_THEME.colors.muted });
    this.buildUpgrade(parent, level);
    this.buildShipment(parent);
  }

  private buildUpgrade(parent: UINode, level: number) {
    const next = this.actions.next()?.cost;
    if (next === undefined) {
      text(parent, "The highest level", { color: UI_THEME.colors.muted });
      return;
    }
    const section = header(parent, `Level ${level + 1}`);
    text(section, `The shaft reaches ${this.actions.shaftLimit(level + 1)} tiles deep`);
    cost(section, costEntries(next, this.actions.missing(next)));
    button(section, "Upgrade", () => confirm(this.window, `Raise the headquarters to level ${level + 1}?`, () => this.actions.upgrade()));
  }

  private buildShipment(parent: UINode) {
    const actions = this.actions;
    const section = header(parent, "Stone shipment");
    text(
      section,
      `Daily at ${hourText(actions.shipmentHour)} · ${formatAmount(ResourcesID.stone, actions.shipmentStone)} stone for ${formatAmount(ResourcesID.beer, actions.shipmentBeer)} beer`,
      { color: UI_THEME.colors.muted },
    );
    stepper(
      section,
      "Send daily",
      () => formatAmount(ResourcesID.stone, actions.shipDaily()),
      (step) => actions.changeShipDaily(step),
    );
    stepper(
      section,
      "Keep at least",
      () => formatAmount(ResourcesID.stone, actions.shipReserve()),
      (step) => actions.changeShipReserve(step),
    );
    text(
      section,
      () => {
        const stone = actions.shippable();
        const beer = (stone * actions.shipmentBeer) / actions.shipmentStone;
        return `Next shipment: ${formatAmount(ResourcesID.stone, stone)} (${formatAmount(ResourcesID.beer, beer)} beer)`;
      },
      { color: UI_THEME.colors.muted },
    );
  }
}

function hourText(hour: number) {
  return `${String(hour % CALENDAR.hoursPerDay).padStart(2, "0")}:00`;
}
