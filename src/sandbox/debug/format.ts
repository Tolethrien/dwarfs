import { formatAmount, RESOURCES, type ResourceCost, type ResourcesID } from "../game/content/resources";

export function amountText(id: ResourcesID, amount: number) {
  return `${formatAmount(id, amount)} ${RESOURCES[id].name}`;
}

export function costText(cost: ResourceCost) {
  const parts = Object.entries(cost).map(([id, amount]) => amountText(Number(id) as ResourcesID, amount ?? 0));
  return parts.join(", ") || "free";
}
