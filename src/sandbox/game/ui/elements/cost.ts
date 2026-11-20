import UINode from "@navi/node";
import { UI_THEME } from "../../content/ui";
import { RESOURCES, ResourcesID, type ResourceCost } from "../../content/resources";
import { hasIcon, icon } from "./icon";
import { row } from "./row";
import { text, TextContent } from "./text";
import { tooltip } from "./tooltip";

export interface CostEntry {
  icon: Crop;
  amount: number;
  label: string;
  lacking?: boolean;
  tooltip?: TextContent;
}

// a resource cost as entries, the lacking ones (Stock.missing) marked; Object.entries gives
// enum numbers as strings
export function costEntries(resourceCost: ResourceCost, lacking: [ResourcesID, number][]): CostEntry[] {
  return Object.entries(resourceCost).map(([key, amount]) => {
    const id = Number(key) as ResourcesID;
    return {
      icon: RESOURCES[id].icon,
      amount: amount ?? 0,
      label: RESOURCES[id].name,
      lacking: lacking.some(([missing]) => missing === id),
    };
  });
}

export function cost(parent: UINode, entries: CostEntry[]) {
  const line = row(parent, { fit: true, gap: UI_THEME.cost.gap });
  for (const entry of entries) {
    const item = row(line, { fit: true, gap: UI_THEME.cost.innerGap });
    tooltip(item, entry.tooltip ?? entry.label);
    const color = entry.lacking
      ? UI_THEME.colors.lacking
      : UI_THEME.colors.text;
    text(item, `${entry.amount}`, { color: color });
    if (hasIcon(entry.icon))
      icon(item, entry.icon, { size: UI_THEME.cost.icon });
    else text(item, entry.label, { color: color });
  }
  return line;
}
