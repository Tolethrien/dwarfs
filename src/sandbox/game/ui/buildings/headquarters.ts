import type UINode from "@navi/node";
import type { ResourceCost, ResourcesID } from "../../content/resources";
import type { HeadquartersLevel } from "../../components/headquarters";
import { UI_THEME } from "../../content/ui";
import { closeOnCameraMove, UIWindow } from "../elements/window";
import { button } from "../elements/button";
import { confirm } from "../elements/confirm";
import { cost, costEntries } from "../elements/cost";
import { header } from "../elements/header";
import { text } from "../elements/text";

export interface HeadquartersActions {
  director: () => string;
  level: () => number;
  next: () => HeadquartersLevel | undefined;
  shaftLimit: (level: number) => number;
  missing: (cost: ResourceCost) => [ResourcesID, number][];
  upgrade: () => void;
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
    const next = this.actions.next()?.cost;
    if (next === undefined) {
      text(parent, "The highest level", { color: UI_THEME.colors.muted });
      return;
    }
    header(parent, `Level ${level + 1}`);
    text(parent, `The shaft reaches ${this.actions.shaftLimit(level + 1)} tiles deep`);
    cost(parent, costEntries(next, this.actions.missing(next)));
    button(parent, "Upgrade", () => confirm(this.window, `Raise the headquarters to level ${level + 1}?`, () => this.actions.upgrade()));
  }
}
