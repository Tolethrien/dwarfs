import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import type { Signal } from "@axiom/events";
import GameEvents from "../../systems/core/gameEvents";
import { formatAmount, ResourcesID, type ResourceCost } from "../../content/resources";
import { STRUCTURES } from "../../content/structures";
import Storage from "../common/storage";
import ResourcesHud from "../../ui/hud/resources";
import PlayerStats from "../../systems/core/playerStats";
import Calendar, { type Alarm } from "../../systems/core/calendar";
import HeadquartersUI from "../../ui/buildings/headquarters";
import { toast } from "../../ui/elements/toast";

// cost: to reach the level, from level 2 on
// shaft: tiles the shaft may go below its first segment
export interface HeadquartersLevel {
  cost?: ResourceCost;
  shaft: number;
}

export interface StoneShipment {
  stone: number;
  beer: number;
}

export interface HeadquartersSignals {
  upgraded: Signal<number>;
  shipped: Signal<StoneShipment>;
}

// levels: from level 1 on; subsidy: the Party's daily beer, until the mine stands on its own
export const HEADQUARTERS = {
  levels: [{ shaft: 0 }, { cost: { [ResourcesID.ironBars]: 10, [ResourcesID.concrete]: 50 }, shaft: 90 }] as HeadquartersLevel[],
  subsidy: { hour: 12, beer: 100, untilLevel: 2 },
  shipment: { hour: 20, stone: 2, beer: 1, step: 1 },
};

// the deepest row the shaft may reach at a level; no headquarters, no deeper than the first segment
export function shaftLimitAt(level: number) {
  const data = HEADQUARTERS.levels[level - 1];
  return STRUCTURES.shaft.startDepth + (data?.shaft ?? 0);
}

// its level is the mine's development: what can be built at all, how deep the shaft goes
export default class Headquarters extends PragmaComponent {
  public level = 1;
  public readonly shipment = { daily: 0, reserve: 0 };
  declare private hud: ResourcesHud;
  declare private events: GameEvents;
  declare private window: HeadquartersUI;
  declare private subsidy: Alarm;
  declare private shipping: Alarm;

  awake(): void {
    this.hud = new ResourcesHud((id) => this.store.get(id));
    this.events = this.scene.getSystem(GameEvents);
    this.onActorEvent("open", () => this.open());
    const subsidy = HEADQUARTERS.subsidy;
    const shipment = HEADQUARTERS.shipment;
    const calendar = this.scene.getSystem(Calendar);
    this.subsidy = calendar.alarm(
      { hour: subsidy.hour, everyDays: 1 },
      () => this.store.add(ResourcesID.beer, subsidy.beer),
      { from: () => this.actor.getVisibility(), until: () => this.level >= subsidy.untilLevel },
    );
    this.shipping = calendar.alarm(
      { hour: shipment.hour, everyDays: 1 },
      () => this.ship(),
      { from: () => this.actor.getVisibility() },
    );
    const playerStats = this.scene.getSystem(PlayerStats);
    this.window = new HeadquartersUI({
      director: () => playerStats.name,
      level: () => this.level,
      next: () => HEADQUARTERS.levels[this.level],
      shaftLimit: (level) => shaftLimitAt(level),
      missing: (cost) => this.store.missing(cost),
      upgrade: () => this.upgrade(),
      shipmentHour: shipment.hour,
      shipmentStone: shipment.stone,
      shipmentBeer: shipment.beer,
      shipDaily: () => this.shipment.daily,
      shipReserve: () => this.shipment.reserve,
      shippable: () => this.shippable(),
      changeShipDaily: (step) => this.changeShipDaily(step),
      changeShipReserve: (step) => this.changeShipReserve(step),
    });
  }

  update(): void {
    this.hud.update();
    this.window.update();
  }

  destroy(): void {
    this.subsidy.cancel();
    this.shipping.cancel();
    this.window.close();
  }

  private get store() {
    const storage = this.getSibling(Storage);
    assert(storage !== undefined, `Headquarters needs Storage on actor: ${this.actor.ID.description}`);
    return storage.stock;
  }

  public open() {
    this.window.open();
  }

  public shippable() {
    const available = Math.max(0, Math.floor(this.store.get(ResourcesID.stone)) - this.shipment.reserve);
    return Math.min(this.shipment.daily, available);
  }

  private changeShipDaily(step: -1 | 1) {
    this.shipment.daily = Math.max(0, this.shipment.daily + step * HEADQUARTERS.shipment.step);
  }

  private changeShipReserve(step: -1 | 1) {
    this.shipment.reserve = Math.max(0, this.shipment.reserve + step * HEADQUARTERS.shipment.step);
  }

  private ship() {
    const stone = this.shippable();
    if (stone <= 0) return;
    const beer = (stone * HEADQUARTERS.shipment.beer) / HEADQUARTERS.shipment.stone;
    if (!this.store.pay({ [ResourcesID.stone]: stone })) return;
    this.store.add(ResourcesID.beer, beer);
    toast(
      `Shipped ${formatAmount(ResourcesID.stone, stone)} stone for ${formatAmount(ResourcesID.beer, beer)} beer`,
      "success",
    );
    this.events.headquarters.shipped.emit({ stone: stone, beer: beer });
  }

  private upgrade() {
    const cost = HEADQUARTERS.levels[this.level]?.cost;
    if (cost === undefined) return;
    if (!this.store.pay(cost)) {
      toast("Not enough resources", "error");
      return;
    }
    this.level++;
    toast(`The mine is level ${this.level} now`, "success");
    this.window.close();
    this.events.headquarters.upgraded.emit(this.level);
  }
}
