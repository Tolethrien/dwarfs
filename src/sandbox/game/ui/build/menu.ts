import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens } from "@navi/tween";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { BUILD_CATEGORIES, BUILD_ELEMENTS, categoriesOf, elementsOf, type BuildLayer } from "../../content/structures";
import type BuildMode from "../../systems/buildMode";
import type Resources from "../../systems/resources";
import { buttonProps, UIButton } from "../elements/button";
import { cost, costEntries } from "../elements/cost";
import { gridCells } from "../elements/grid";
import { row } from "../elements/row";
import { button } from "../elements/button";
import { slot } from "../elements/slot";
import { tabs } from "../elements/tabs";
import { text } from "../elements/text";

const LAYER_TITLES: Record<BuildLayer, string> = {
  main: "Main",
  deco: "Deco",
};

export default class BuildMenu {
  private readonly toggleButton: UIButton;
  private readonly panel: UINode;
  private readonly layers: UINode;
  private readonly categories: UINode;
  private readonly elements: UINode;
  private readonly selection: UINode;
  private isOpen = true;

  constructor(
    private readonly buildMode: BuildMode,
    private readonly resources: Resources,
  ) {
    this.toggleButton = this.createToggleButton();
    Navi.append(this.toggleButton);
    this.toggleButton.setActive(false);
    this.panel = Navi.append(this.createPanel());
    this.panel.setActive(false);
    this.layers = row(this.panel, { fit: true });
    const tools = row(this.panel, { fit: true });
    button(tools, () => (this.buildMode.removing ? "Stop removing" : "Remove"), () => this.buildMode.toggleRemoving());
    const body = Navi.append(this.createStack("row"), this.panel);
    this.categories = Navi.append(this.createStack("col"), body);
    this.elements = Navi.append(this.createGridHolder(), body);
    this.selection = Navi.append(this.createStack("col"), this.panel);
    this.showLayers();
    this.showCategories();
    this.showElements();
    this.showSelected();
  }

  public showSelected() {
    clear(this.selection);
    if (this.buildMode.removing) {
      text(this.selection, "Removing");
      text(this.selection, "Click a station, drag over rails and joints", { color: UI_THEME.colors.muted });
      return;
    }
    const element = this.buildMode.selected;
    if (element === undefined) {
      text(this.selection, "Pick something to build", { color: UI_THEME.colors.muted });
      return;
    }
    const data = BUILD_ELEMENTS[element];
    text(this.selection, data.title);
    const price = this.buildMode.costOf(element);
    cost(this.selection, costEntries(price, this.resources.missing(price)));
  }

  public update() {
    const clicked = Navi.getClicked;
    if (!(clicked instanceof UIButton) || clicked.isDisabled) return;
    if (clicked === this.toggleButton || clicked.isDescendantOf(this.panel)) clicked.run();
  }

  public show() {
    this.isOpen = true;
    this.panel.stopAllTweens();
    // a finished slide-out keeps its last offset, behind the edge
    this.panel.motion.offset.x = 0;
    this.toggleButton.setActive(true);
    this.panel.setActive(true);
    this.showSelected();
  }

  public hide() {
    this.panel.stopAllTweens();
    this.toggleButton.setActive(false);
    this.panel.setActive(false);
  }

  private toggle() {
    this.isOpen = !this.isOpen;
    const panel = this.panel;
    const box = panel.pixelBox;
    const hidden = { x: -(box.x + box.w), y: 0 };
    const ms = UI_THEME.buildMenu.slideMs;
    panel.stopAllTweens();
    if (this.isOpen) {
      panel.setActive(true);
      panel.play(Tweens.slideIn(hidden, ms));
    } else panel.play(Tweens.slideOut(hidden, ms, undefined, () => panel.setActive(false)));
  }

  private pickLayer(layer: BuildLayer) {
    this.buildMode.pickLayer(layer);
    this.showLayers();
    this.showCategories();
    this.showElements();
  }

  // the tabs mark the picked one when built, so they are built again on a pick
  private showLayers() {
    clear(this.layers);
    const items = (Object.keys(LAYER_TITLES) as BuildLayer[]).map((layer) => ({
      id: layer,
      title: LAYER_TITLES[layer],
    }));
    tabs(this.layers, items, this.buildMode.layer, (layer) => this.pickLayer(layer));
  }

  private showCategories() {
    clear(this.categories);
    for (const category of categoriesOf(this.buildMode.layer)) {
      const data = BUILD_CATEGORIES[category];
      slot(this.categories, {
        label: data.short,
        tooltip: data.title,
        selected: () => this.buildMode.category === category,
        click: () => {
          this.buildMode.pickCategory(category);
          this.showElements();
        },
      });
    }
  }

  private showElements() {
    clear(this.elements);
    const category = this.buildMode.category;
    if (category === undefined) {
      text(this.elements, "Nothing here yet", { color: UI_THEME.colors.muted });
      return;
    }
    const cells = gridCells(this.elements);
    for (const element of elementsOf(category)) {
      const data = BUILD_ELEMENTS[element];
      slot(cells, {
        label: data.short,
        tooltip: data.title,
        selected: () => this.buildMode.selected === element,
        click: () => this.buildMode.pick(element),
      });
    }
  }

  private createToggleButton() {
    const look = UI_THEME.buildMenu;
    const props = buttonProps({});
    props.position = { x: px(UI_THEME.spacing.screenMargin), y: px(look.top) };
    props.size = { width: px(look.button), height: px(look.button) };
    props.style = {
      ...props.style,
      direction: "col",
      alignMain: "center",
      gap: look.bars.gap,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    const node = new UIButton(() => this.toggle(), props);
    for (let bar = 0; bar < 3; bar++) {
      Navi.append(
        new UINode({
          size: { width: px(look.bars.width), height: px(look.bars.height) },
          input: "none",
          style: { backgroundColor: UI_THEME.colors.text },
        }),
        node,
      );
    }
    return node;
  }

  private createPanel() {
    const look = UI_THEME.buildMenu;
    const padding = UI_THEME.spacing.windowPadding;
    return new UINode({
      position: {
        x: px(UI_THEME.spacing.screenMargin),
        y: px(look.top + look.button + look.panelGap),
      },
      size: { width: auto(), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.panel,
        outline: { width: UI_THEME.outline.window, color: UI_THEME.colors.frame },
        rounded: UI_THEME.radius.window,
        layout: "stack",
        direction: "col",
        gap: UI_THEME.spacing.windowGap,
        padding: { top: padding, right: padding, bottom: padding, left: padding },
      },
    });
  }

  private createStack(direction: "row" | "col") {
    return new UINode({
      size: { width: auto(), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: direction,
        alignCross: "start",
        gap: UI_THEME.spacing.gap,
      },
    });
  }

  private createGridHolder() {
    const columns = UI_THEME.grid.columns;
    const width = columns * UI_THEME.slot.size + (columns - 1) * UI_THEME.spacing.gap;
    return new UINode({
      size: { width: px(width), height: auto() },
      style: { backgroundColor: UI_THEME.colors.transparent },
    });
  }
}

function clear(node: UINode) {
  for (const child of [...node.children]) Navi.remove(child, node);
}
