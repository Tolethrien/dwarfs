import PragmaComponent from "@pragma/component";
import { formatAmount, RESOURCES, type ResourceCost, type ResourcesID } from "../content/resources";
import Resources from "../systems/resources";

// what the station's dwarfs mined, waiting for the hourly delivery; a station torn down hands it
// straight to the store
export default class Haul extends PragmaComponent {
  private amounts: ResourceCost = {};
  declare private resources: Resources;

  awake(): void {
    this.resources = this.scene.getSystem(Resources);
  }

  destroy(): void {
    this.resources.addAll(this.take());
  }

  public add(id: ResourcesID, amount: number) {
    this.amounts[id] = (this.amounts[id] ?? 0) + amount;
  }

  public addAll(load: ResourceCost) {
    for (const [id, amount] of loadEntries(load)) this.add(id, amount);
  }

  public get isEmpty() {
    return loadEntries(this.amounts).length === 0;
  }

  public take(): ResourceCost {
    const load = this.amounts;
    this.amounts = {};
    return load;
  }

  public get text() {
    return describeLoad(this.amounts);
  }
}

// Object.entries gives enum numbers as strings
export function loadEntries(load: ResourceCost) {
  return Object.entries(load)
    .map(([id, amount]) => [Number(id) as ResourcesID, amount ?? 0] as const)
    .filter(([, amount]) => amount > 0);
}

export function describeLoad(load: ResourceCost) {
  const entries = loadEntries(load);
  if (entries.length === 0) return "empty";
  return entries.map(([id, amount]) => `${formatAmount(id, amount)} ${RESOURCES[id].name}`).join(", ");
}
