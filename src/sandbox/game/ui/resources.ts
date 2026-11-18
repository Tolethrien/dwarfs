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
} from "../content/resources";
import { UI_THEME } from "../content/ui";
import { hudLayer } from "./hud";
import { button, UIButton } from "./elements/button";
import { counter } from "./elements/counter";
import { divider } from "./elements/divider";

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
    const margin = UI_THEME.spacing.screenMargin;
    this.panel = Navi.append(
      new UINode({
        position: { x: px(margin), y: px(margin) },
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: UI_THEME.colors.panel,
          outline: { width: UI_THEME.outline.window, color: UI_THEME.colors.frame },
          rounded: UI_THEME.radius.window,
          padding: UI_THEME.spacing.buttonPadding,
          layout: "stack",
          direction: "col",
          gap: UI_THEME.spacing.listGap,
        },
      }),
      hudLayer(),
    );
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
    const clicked = Navi.getClicked;
    if (!(clicked instanceof UIButton) || clicked.isDisabled) return;
    if (clicked.isDescendantOf(this.panel)) clicked.run();
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
