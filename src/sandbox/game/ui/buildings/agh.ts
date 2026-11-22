import Navi from "@navi/navi";
import type UINode from "@navi/node";
import {
  AGH_CATEGORIES,
  AGH_CATEGORY_IDS,
  AGH_UPGRADES,
  AghCategoryID,
  upgradesIn,
  type AghUpgradeID,
  type AghUpgradeLevel,
} from "../../content/agh";
import { UI_THEME } from "../../content/ui";
import { closeOnCameraMove, UIWindow } from "../elements/window";
import { button } from "../elements/button";
import { column } from "../elements/column";
import { confirm } from "../elements/confirm";
import { paragraph } from "../elements/paragraph";
import { row } from "../elements/row";
import { tabs, type TabItem } from "../elements/tabs";
import { text } from "../elements/text";
import { tooltip } from "../elements/tooltip";

const AGH_UI = {
  width: 480,
};

const TABS: TabItem<AghCategoryID>[] = AGH_CATEGORY_IDS.map((id) => ({
  id: id,
  title: AGH_CATEGORIES[id].title,
}));

export interface AghActions {
  levelOf: (id: AghUpgradeID) => number;
  maxLevelOf: (id: AghUpgradeID) => number;
  nextLevel: (id: AghUpgradeID) => AghUpgradeLevel | undefined;
  upgrade: (id: AghUpgradeID) => boolean;
}

export default class AghUI {
  private readonly window = new UIWindow({
    kind: "docked",
    width: AGH_UI.width,
    title: "AGH",
    closeOnMove: closeOnCameraMove(),
  });
  private tab: AghCategoryID = AghCategoryID.roster;
  declare private tabBar: UINode;
  declare private body: UINode;

  constructor(private readonly actions: AghActions) {}

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

  public update() {
    this.window.update();
  }

  private pick(tab: AghCategoryID) {
    this.tab = tab;
    this.showTab();
  }

  private showTab() {
    Navi.clear(this.tabBar);
    tabs(this.tabBar, TABS, this.tab, (tab) => this.pick(tab));
    Navi.clear(this.body);
    const list = upgradesIn(this.tab);
    if (list.length === 0) {
      text(this.body, "Nothing to research here yet", { color: UI_THEME.colors.muted });
      return;
    }
    for (const id of list) this.buildUpgrade(this.body, id);
  }

  private buildUpgrade(parent: UINode, id: AghUpgradeID) {
    const level = this.actions.levelOf(id);
    const max = this.actions.maxLevelOf(id);
    const next = this.actions.nextLevel(id);
    const shown = next ?? AGH_UPGRADES[id].levels[max - 1];
    const item = column(parent);
    const action = button(
      item,
      `${shown.title} (${level}/${max})`,
      () => {
        if (next !== undefined) this.askUpgrade(id, next);
      },
      { disabled: next === undefined },
    );
    tooltip(action, shown.description);
    text(item, shown.description, { color: UI_THEME.colors.muted });
  }

  private askUpgrade(id: AghUpgradeID, level: AghUpgradeLevel) {
    confirm(
      this.window,
      `Research ${level.title}?`,
      () => {
        if (this.actions.upgrade(id)) this.showTab();
      },
      {
        title: "Confirm research",
        details: (content) => paragraph(content, level.description),
      },
    );
  }
}
