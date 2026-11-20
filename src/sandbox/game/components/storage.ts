import PragmaComponent from "@pragma/component";
import type { Signal } from "@axiom/events";
import { debug } from "@debug";
import { formatAmount, RESOURCES, type ResourceCost, type ResourcesID } from "../content/resources";
import Buildings from "../systems/buildings";
import GameEvents from "../systems/gameEvents";

// start: what the camp's store begins with, none of the rest (the intro's grant comes on top);
// precision: amounts and costs are kept to a tenth, so float noise (23.9999 L) never blocks a payment
export const STORAGE = {
  precision: 10,
  start: {} as ResourceCost,
};

export interface ResourceChange {
  id: ResourcesID;
  amount: number;
  delta: number;
}

export interface ResourcesSignals {
  changed: Signal<ResourceChange>;
}

export class Stock {
  public onChange: ((change: ResourceChange) => void) | undefined;
  private readonly amounts = new Map<ResourcesID, number>();

  constructor(start: ResourceCost = {}) {
    for (const [id, amount] of entriesOf(start)) this.amounts.set(id, amount);
  }

  public get(id: ResourcesID) {
    return this.amounts.get(id) ?? 0;
  }

  public add(id: ResourcesID, amount: number) {
    this.change(id, amount);
  }

  public addAll(load: ResourceCost) {
    for (const [id, amount] of entriesOf(load)) this.change(id, amount);
  }

  public canAfford(cost: ResourceCost) {
    return this.missing(cost).length === 0;
  }

  public missing(cost: ResourceCost) {
    const lacking: [ResourcesID, number][] = [];
    for (const [id, amount] of entriesOf(cost)) {
      const have = this.get(id);
      if (have < amount) lacking.push([id, amount - have]);
    }
    return lacking;
  }

  public pay(cost: ResourceCost) {
    if (!this.canAfford(cost)) return false;
    for (const [id, amount] of entriesOf(cost)) this.change(id, -amount);
    return true;
  }

  public get isEmpty() {
    for (const amount of this.amounts.values()) if (amount > 0) return false;
    return true;
  }

  public get contents(): ResourceCost {
    return Object.fromEntries([...this.amounts].filter(([, amount]) => amount > 0));
  }

  public moveAllTo(other: Stock) {
    const load = this.contents;
    for (const [id, amount] of entriesOf(load)) this.change(id, -amount);
    other.addAll(load);
  }

  public get text() {
    const entries = entriesOf(this.contents);
    if (entries.length === 0) return "empty";
    return entries.map(([id, amount]) => `${formatAmount(id, amount)} ${RESOURCES[id].name}`).join(", ");
  }

  private change(id: ResourcesID, delta: number) {
    if (delta === 0) return;
    const amount = rounded(this.get(id) + delta);
    if (amount < 0) {
      debug.log.error(`${RESOURCES[id].name} would go below zero: ${formatAmount(id, amount)}`);
      return;
    }
    this.amounts.set(id, amount);
    this.onChange?.({ id: id, amount: amount, delta: delta });
  }
}

interface StorageProps {
  camp?: boolean;
}

// a store of resources on an actor; the camp's own announces its changes, any other hands what it
// still holds to the camp's when its actor is gone
export default class Storage extends PragmaComponent {
  public readonly stock: Stock;
  private readonly camp: boolean;
  declare private buildings: Buildings;

  constructor(internal: InternalPCProps, props: StorageProps = {}) {
    super(internal);
    this.camp = props.camp ?? false;
    this.stock = new Stock(this.camp ? STORAGE.start : {});
  }

  awake(): void {
    this.buildings = this.scene.getSystem(Buildings);
    if (!this.camp) return;
    const events = this.scene.getSystem(GameEvents);
    this.stock.onChange = (change) => events.resources.changed.emit(change);
  }

  destroy(): void {
    if (!this.camp) this.stock.moveAllTo(this.buildings.store);
  }
}

// Object.entries gives enum numbers as strings
function entriesOf(cost: ResourceCost) {
  return Object.entries(cost)
    .map(([id, amount]) => [Number(id) as ResourcesID, rounded(amount ?? 0)] as const)
    .filter(([, amount]) => amount > 0);
}

function rounded(amount: number) {
  return Math.round(amount * STORAGE.precision) / STORAGE.precision;
}
