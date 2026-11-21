import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import { formatAmount, RESOURCES } from "../../content/resources";
import { RECIPE_IDS, RECIPES, recipeCost, type RecipeID } from "../../content/smelter";
import Calendar from "../../systems/core/calendar";
import { CAMP_STORE } from "../../sceneData";
import { Stock } from "../common/storage";
import SmelterUI from "../../ui/buildings/smelter";

// power: kg of input an hour of game time
export const SMELTER = { power: 100 };

export interface SmelterOrder {
  recipe: RecipeID;
  batches: number;
  done: number;
  // of the batch in the works, 0-1
  progress: number;
}

// a batch takes its input into the smelter when it starts and gives its output when it ends; the
// store keeps tenths of a kg, so a frame's share of a batch would round away
export default class Smelter extends PragmaComponent {
  private readonly queue: SmelterOrder[] = [];
  private readonly input = new Stock();
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
      power: () => SMELTER.power,
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
    const order = this.queue[0];
    if (order === undefined) return;
    const recipe = RECIPES[order.recipe];
    if (this.input.isEmpty && !this.load(order)) return;
    order.progress += (hours * SMELTER.power) / recipe.batch;
    if (order.progress < 1) return;
    this.input.pay(recipeCost(order.recipe));
    this.store.add(recipe.output, recipe.yield);
    order.done++;
    order.progress = 0;
    if (order.done === order.batches) this.queue.shift();
  }

  private get status() {
    const order = this.queue[0];
    if (order === undefined) return "Idle";
    if (!this.input.isEmpty) return `Smelting ${RECIPES[order.recipe].name}`;
    const lacking = this.store.missing(recipeCost(order.recipe));
    return `Waiting for ${lacking.map(([id, amount]) => `${formatAmount(id, amount)} ${RESOURCES[id].name}`).join(", ")}`;
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
