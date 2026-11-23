import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import { formatAmount, RESOURCES, ResourcesID } from "../../content/resources";
import { RECIPE_IDS, RECIPES, recipeCost, type RecipeID } from "../../content/smelter";
import { rollResources } from "../../drops/resources";
import Calendar from "../../systems/core/calendar";
import { CAMP_STORE } from "../../sceneData";
import { Stock } from "../common/storage";
import SmelterUI from "../../ui/buildings/smelter";

// coalPerHour: kg of coal the furnace burns per game hour of work
export const SMELTER = { coalPerHour: 6 };

export interface SmelterOrder {
  recipe: RecipeID;
  batches: number;
  done: number;
  // of the batch in the works, 0-1
  progress: number;
}

// a batch takes its input into the smelter when it starts and gives its output when it ends; the
// furnace burns coal only while working and pauses mid-batch if coal runs out
export default class Smelter extends PragmaComponent {
  private readonly queue: SmelterOrder[] = [];
  private readonly input = new Stock();
  // kg of coal left burning in the furnace (0-1)
  private fuel = 0;
  private lastTime = 0;
  declare private store: Stock;
  declare private calendar: Calendar;
  declare private window: SmelterUI;

  awake(): void {
    this.store = this.scene.sharedData.require(CAMP_STORE);
    this.calendar = this.scene.getSystem(Calendar);
    this.lastTime = this.calendar.time;
    this.onActorEvent("open", () => this.open());
    this.window = new SmelterUI({
      recipes: RECIPE_IDS,
      fuel: () => this.fuel,
      coalPerHour: () => SMELTER.coalPerHour,
      orders: () => this.queue,
      status: () => this.status,
      missing: (cost) => this.store.missing(cost),
      order: (recipe, batches) => this.order(recipe, batches),
      cancel: (order) => this.cancel(order),
    });
  }

  update(): void {
    const hours = this.calendar.time - this.lastTime;
    this.lastTime = this.calendar.time;
    this.smelt(hours);
    this.window.update();
  }

  destroy(): void {
    this.input.moveAllTo(this.store);
    this.window.close();
  }

  public open() {
    this.window.open();
  }

  private smelt(hours: number) {
    let remaining = hours;
    while (remaining > 0) {
      const order = this.queue[0];
      if (order === undefined) return;
      const recipe = RECIPES[order.recipe];
      if (this.input.isEmpty && !this.load(order)) return;
      const rate = SMELTER.coalPerHour;
      if (rate > 0 && !this.hasFuel()) return;
      const needed = (1 - order.progress) * recipe.hours;
      const fuelTime = rate > 0 ? this.fuel / rate : Infinity;
      const worked = Math.min(remaining, fuelTime, needed);
      remaining -= worked;
      if (rate > 0) {
        this.fuel -= worked * rate;
        if (this.fuel < 1e-6) this.fuel = 0;
      }
      order.progress += worked / recipe.hours;
      if (order.progress < 1 - 1e-6) continue;
      this.input.pay(recipeCost(order.recipe));
      this.store.addAll(rollResources(recipe.output));
      order.done++;
      order.progress = 0;
      if (order.done === order.batches) this.queue.shift();
    }
  }

  private hasFuel() {
    if (this.fuel > 0) return true;
    if (!this.store.pay({ [ResourcesID.coal]: 1 })) return false;
    this.fuel = 1;
    return true;
  }

  private get status() {
    const order = this.queue[0];
    if (order === undefined) return "Idle";
    if (this.input.isEmpty) {
      const lacking = this.store.missing(recipeCost(order.recipe));
      return `Waiting for ${lacking.map(([id, amount]) => `${formatAmount(id, amount)} ${RESOURCES[id].name}`).join(", ")}`;
    }
    if (SMELTER.coalPerHour > 0 && this.fuel <= 0 && !this.store.canAfford({ [ResourcesID.coal]: 1 })) {
      return `Waiting for ${RESOURCES[ResourcesID.coal].name}`;
    }
    return `Smelting ${RECIPES[order.recipe].name}`;
  }

  private load(order: SmelterOrder) {
    const cost = recipeCost(order.recipe);
    if (!this.store.pay(cost)) return false;
    this.input.addAll(cost);
    return true;
  }

  private order(recipe: RecipeID, batches: number) {
    this.queue.push({ recipe: recipe, batches: batches, done: 0, progress: 0 });
  }

  private cancel(order: SmelterOrder) {
    const index = this.queue.indexOf(order);
    assert(index !== -1, "Cancelling an order not in the smelter's queue");
    if (index === 0) this.input.moveAllTo(this.store);
    this.queue.splice(index, 1);
  }
}
