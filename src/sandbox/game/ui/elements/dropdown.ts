import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { buttonProps, fillButton, UIButton } from "./button";
import { MenuItem } from "./contextMenu";

export interface DropdownItem<Id> {
  id: Id;
  title: string;
  locked?: boolean;
}
export interface DropdownOptions {
  width?: number;
}

export class UIDropdown extends UIButton {
  constructor(
    public readonly items: () => MenuItem[],
    props: NodeProps,
  ) {
    super(() => {}, props);
  }
}

export function dropdown<Id>(
  parent: UINode,
  items: DropdownItem<Id>[],
  selected: Id,
  pick: (id: Id) => void,
  options: DropdownOptions = {},
) {
  let current = selected;
  const title = () => items.find((item) => item.id === current)?.title ?? "";
  const menu = () =>
    items.map((item) => ({
      label: item.title,
      selected: item.id === current,
      disabled: item.locked,
      run: () => {
        current = item.id;
        pick(item.id);
      },
    }));
  const props = buttonProps({});
  if (options.width !== undefined)
    props.size = { width: px(options.width), height: auto() };
  props.style = { ...props.style, alignMain: "between" };
  const node = new UIDropdown(menu, props);
  Navi.append(node, parent);
  fillButton(node, title, {});
  Navi.append(
    new UIText(() => UI_THEME.dropdown.arrow, {
      size: { width: auto(), height: auto() },
      input: "none",
      inheritState: true,
      style: {
        textColor: UI_THEME.colors.muted,
        textSize: UI_THEME.text.button,
      },
    }),
    node,
  );
  return node;
}
