import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, ph, pw, px } from "@navi/units";
import InputManager from "@engine/inputManager";
import { KEY } from "@engine/keys";
import { UI_THEME } from "../../content/ui";
import { button, UIButton } from "./button";
import { placeBeside } from "./place";
import { TextContent } from "./text";
import { tooltip } from "./tooltip";
import { panelStyle } from "./panel";

export interface MenuItem {
  label: string;
  run: () => void;
  disabled?: boolean;
  selected?: boolean;
  tooltip?: TextContent;
}
export interface MenuPlacement {
  offset?: number;
  minWidth?: number;
}

class UIMenu extends UINode {
  constructor(
    private readonly at: Position2D,
    private readonly offset: number,
    minWidth: number,
  ) {
    super({
      size: { width: auto(), height: auto() },
      minSize: { width: px(minWidth / Navi.getScale) },
      style: {
        ...panelStyle("small"),
        zIndex: UI_THEME.menu.zIndex,
        padding: UI_THEME.menu.padding,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: UI_THEME.menu.gap,
      },
    });
  }

  // moving it is pure UI, so tick is fine here
  public tick() {
    placeBeside(this, this.at, this.offset);
  }
}

const MENU = {
  node: undefined as UIMenu | undefined,
  // takes every click outside the menu, so nothing under it fires
  backdrop: undefined as UINode | undefined,
  owner: undefined as object | undefined,
};

export function openMenu(
  owner: object,
  items: MenuItem[],
  at: Position2D,
  placement: MenuPlacement = {},
) {
  closeMenu();
  MENU.backdrop = Navi.append(
    new UINode({
      size: { width: pw(100), height: ph(100) },
      input: "absorb",
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        zIndex: UI_THEME.menu.zIndex,
      },
    }),
  );
  const node = new UIMenu(
    { x: at.x, y: at.y },
    placement.offset ?? UI_THEME.menu.offset,
    placement.minWidth ?? 0,
  );
  Navi.append(node);
  for (const item of items) {
    const entry = button(node, item.label, item.run, {
      disabled: item.disabled,
      selected: item.selected,
      color: UI_THEME.colors.transparent,
    });
    if (item.tooltip !== undefined) tooltip(entry, item.tooltip);
  }
  MENU.node = node;
  MENU.owner = owner;
}

export function closeMenu() {
  if (!MENU.node) return;
  Navi.remove(MENU.node, Navi.root);
  if (MENU.backdrop) Navi.remove(MENU.backdrop, Navi.root);
  MENU.node = undefined;
  MENU.backdrop = undefined;
  MENU.owner = undefined;
}

export function closeMenuOf(owner: object) {
  if (MENU.owner === owner) closeMenu();
}

export function updateMenu(owner: object) {
  const menu = MENU.node;
  const backdrop = MENU.backdrop;
  if (!menu || !backdrop || MENU.owner !== owner) return false;
  const clicked = Navi.getClicked;
  if (clicked instanceof UIButton && clicked.isDescendantOf(menu)) {
    closeMenu();
    clicked.run();
    return true;
  }
  const closes =
    backdrop.clicked ||
    backdrop.rightClicked ||
    InputManager.isKeyPressed(KEY.escape);
  if (closes) closeMenu();
  return true;
}
