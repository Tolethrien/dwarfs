import { formatAmount, RESOURCES, type ResourceCost, type ResourcesID } from "../content/resources";
import type Drop from "./drop";
import type { AmountRange } from "./drop";

const RESOURCE_DROPS = { step: 0.1 };

export type ResourceDrop = Drop<ResourcesID>;

export function rollResources(drop: ResourceDrop): ResourceCost {
  const total: ResourceCost = {};
  for (const item of drop.roll({ step: RESOURCE_DROPS.step })) {
    total[item.id] = (total[item.id] ?? 0) + item.amount;
  }
  return total;
}

export function formatResourceRange(id: ResourcesID, range: AmountRange, multiplier = 1) {
  const min = range[0] * multiplier;
  const max = range[1] * multiplier;
  if (min === max) return formatAmount(id, min);
  const low = Math.round(min * 10) / 10;
  const high = Math.round(max * 10) / 10;
  return `${low}–${high} ${RESOURCES[id].unit}`;
}

export function describeResourceDrop(drop: ResourceDrop) {
  return drop.describe((id, range) => `${formatResourceRange(id, range)} ${RESOURCES[id].name}`);
}
