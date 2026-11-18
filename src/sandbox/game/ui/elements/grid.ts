import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, pw } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { button } from "./button";

export interface GridItem<Id> {
  id: Id;
  title: string;
  icon?: Crop;
  locked?: boolean;
}

export function grid<Id>(
  parent: UINode,
  items: GridItem<Id>[],
  selected: Id | undefined,
  pick: (id: Id) => void,
  columns = UI_THEME.grid.columns,
) {
  const cells = gridCells(parent, columns);
  for (const item of items)
    button(cells, item.title, () => pick(item.id), {
      icon: item.icon,
      selected: item.id === selected,
      disabled: item.locked,
    });
  return cells;
}

export function gridCells(parent: UINode, columns = UI_THEME.grid.columns) {
  return Navi.append(
    new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "grid",
        direction: "row",
        gridCount: columns,
        gap: UI_THEME.spacing.gap,
        gapCross: UI_THEME.spacing.gap,
        cellAlignX: "stretch",
        cellAlignY: "stretch",
      },
    }),
    parent,
  );
}
