import UINode from "@navi/node";
import { button } from "./button";
import { row } from "./row";

export interface TabItem<Id> {
  id: Id;
  title: string;
  locked?: boolean;
}

export function tabs<Id>(
  parent: UINode,
  items: TabItem<Id>[],
  selected: Id,
  pick: (id: Id) => void,
) {
  const bar = row(parent, { fit: true });
  for (const item of items)
    button(bar, item.title, () => pick(item.id), {
      selected: item.id === selected,
      disabled: item.locked,
    });
  return bar;
}
