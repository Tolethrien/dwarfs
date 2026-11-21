import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import {
  formatAmount,
  RESOURCE_CATEGORIES,
  RESOURCE_IDS,
  RESOURCES,
  ResourceCategory,
  type ResourcesID,
  type ResourceView,
} from "../../content/resources";
import { UI_THEME } from "../../content/ui";
import { hudSlot } from "../hud";
import { button, runClicked } from "../elements/button";
import { counter } from "../elements/counter";
import { divider } from "../elements/divider";
import { panelStyle } from "../elements/panel";

// Object.keys gives enum numbers as strings
const CATEGORIES = Object.keys(RESOURCE_CATEGORIES).map(Number) as ResourceCategory[];

interface Shown {
  node: UINode;
  viewFrom: ResourceView;
}

export default class ResourcesHud {
  private readonly panel: UINode;
  private readonly shown: Shown[] = [];
  private view: ResourceView = 1;

  constructor(private readonly amountOf: (id: ResourcesID) => number) {
    this.panel = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          ...panelStyle("hud"),
          layout: "stack",
          direction: "col",
          gap: UI_THEME.spacing.listGap,
        },
      }),
      hudSlot("topLeft"),
    );
    this.panel.tags.add("hud:resources");
    this.hamburger();
    for (const id of RESOURCE_IDS.filter((id) => RESOURCES[id].category === undefined)) this.counter(id);
    for (const category of CATEGORIES) {
      const ids = RESOURCE_IDS.filter((id) => RESOURCES[id].category === category);
      const viewFrom = Math.min(...ids.map((id) => RESOURCES[id].viewFrom)) as ResourceView;
      this.shown.push({ node: divider(this.panel, RESOURCE_CATEGORIES[category]), viewFrom: viewFrom });
      for (const id of ids) this.counter(id);
    }
    this.show();
  }

  public update() {
    runClicked(this.panel);
  }

  private hamburger() {
    const theme = UI_THEME.hamburger;
    const node = button(this.panel, "", () => {
      this.view = ((this.view % 3) + 1) as ResourceView;
      this.show();
    });
    const bars = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "none",
        style: { backgroundColor: UI_THEME.colors.transparent, layout: "stack", direction: "col", gap: theme.gap },
      }),
      node,
    );
    for (let bar = 0; bar < 3; bar++)
      Navi.append(
        new UINode({
          size: { width: px(theme.width), height: px(theme.bar) },
          input: "none",
          style: { backgroundColor: UI_THEME.colors.text },
        }),
        bars,
      );
  }

  private counter(id: ResourcesID) {
    const node = counter(this.panel, {
      value: () => this.amountOf(id),
      icon: RESOURCES[id].icon,
      tooltip: RESOURCES[id].name,
      format: (amount) => formatAmount(id, amount),
    });
    this.shown.push({ node: node, viewFrom: RESOURCES[id].viewFrom });
  }

  private show() {
    for (const entry of this.shown) entry.node.setActive(entry.viewFrom <= this.view);
    // hiding alone leaves the panel at its old size
    Navi.markLayoutDirty();
  }
}
