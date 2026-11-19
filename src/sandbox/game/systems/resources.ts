import PragmaSystem from "@pragma/system";
import type { Signal } from "@axiom/events";
import { debug } from "@debug";
import { gameCommands } from "../debugCommands";
import { formatAmount, RESOURCE_IDS, RESOURCES, ResourcesID, type ResourceCost } from "../content/resources";
import ResourcesHud from "../ui/resources";
import GameEvents from "./gameEvents";

// start: what the game begins with, none of the rest (the intro's grant comes on top); precision: amounts and costs are kept to a
// tenth, so float noise (23.9999 L) never blocks a payment
export const RESOURCE_RULES = {
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

export default class Resources extends PragmaSystem {
  private readonly amounts = new Map<ResourcesID, number>(RESOURCE_IDS.map((id) => [id, RESOURCE_RULES.start[id] ?? 0]));
  declare private events: GameEvents;
  declare private hud: ResourcesHud;

  awake(): void {
    this.events = this.scene.getSystem(GameEvents);
    this.hud = new ResourcesHud((id) => this.get(id));
    debug.game.connect("resources", () =>
      RESOURCE_IDS.map((id) => ({ name: RESOURCES[id].name, amount: formatAmount(id, this.get(id)) })),
    );
    const resources = this;
    gameCommands("res", {
      get amounts() {
        return Object.fromEntries(RESOURCE_IDS.map((id) => [RESOURCES[id].name, resources.get(id)]));
      },
      add: (amount: number) => {
        for (const id of RESOURCE_IDS) this.add(id, amount);
      },
      addBeer: (amount: number) => this.add(ResourcesID.beer, amount),
      addStone: (amount: number) => this.add(ResourcesID.stone, amount),
    });
  }

  update(): void {
    this.hud.update();
  }

  public get(id: ResourcesID) {
    return this.amounts.get(id) ?? 0;
  }

  public add(id: ResourcesID, amount: number) {
    this.change(id, amount);
  }

  public addAll(load: ResourceCost) {
    for (const [id, amount] of this.costEntries(load)) this.change(id, amount);
  }

  public canAfford(cost: ResourceCost) {
    return this.missing(cost).length === 0;
  }

  public missing(cost: ResourceCost) {
    const lacking: [ResourcesID, number][] = [];
    for (const [id, amount] of this.costEntries(cost)) {
      const have = this.get(id);
      if (have < amount) lacking.push([id, amount - have]);
    }
    return lacking;
  }

  public pay(cost: ResourceCost) {
    if (!this.canAfford(cost)) return false;
    for (const [id, amount] of this.costEntries(cost)) this.change(id, -amount);
    return true;
  }

  private change(id: ResourcesID, delta: number) {
    if (delta === 0) return;
    const amount = this.rounded(this.get(id) + delta);
    if (amount < 0) {
      debug.log.error(`${RESOURCES[id].name} would go below zero: ${formatAmount(id, amount)}`);
      return;
    }
    this.amounts.set(id, amount);
    this.events.resources.changed.emit({ id: id, amount: amount, delta: delta });
  }

  // Object.entries gives enum numbers as strings
  private costEntries(cost: ResourceCost) {
    return Object.entries(cost).map(([id, amount]) => [Number(id) as ResourcesID, this.rounded(amount ?? 0)] as const);
  }

  private rounded(amount: number) {
    return Math.round(amount * RESOURCE_RULES.precision) / RESOURCE_RULES.precision;
  }
}
