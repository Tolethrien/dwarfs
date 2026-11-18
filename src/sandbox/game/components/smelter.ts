import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import { formatAmount, RESOURCES, ResourcesID, type ResourceCost } from "../content/resources";
import { RECIPE_IDS, RECIPES, type RecipeID } from "../content/smelter";
import Calendar from "../systems/calendar";
import Resources from "../systems/resources";
import SmelterUI from "../ui/buildings/smelter";

// power: kg of input an hour of game time
export const SMELTER = { power: 100 };

export interface SmelterOrder {
  recipe: RecipeID;
  batches: number;
  done: number;
  // of the batch in the works, 0-1
  progress: number;
}

// a batch takes its input when it starts and gives its output when it ends; the store keeps
// tenths of a kg, so a frame's share of a batch would round away
export default class Smelter extends PragmaComponent {
  private readonly queue: SmelterOrder[] = [];
  // the first order's batch in the works has taken its input
  private loaded = false;
  private lastTime = 0;
  declare private resources: Resources;
  declare private calendar: Calendar;
  declare private window: SmelterUI;

  awake(): void {
    this.resources = this.scene.getSystem(Resources);
    this.calendar = this.scene.getSystem(Calendar);
    this.lastTime = this.calendar.time;
    this.window = new SmelterUI({
      recipes: RECIPE_IDS,
      power: () => SMELTER.power,
      orders: () => this.queue,
      status: () => this.status,
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
    this.window.close();
  }

  public open() {
    this.window.open();
  }

  private smelt(hours: number) {
    const order = this.queue[0];
    if (order === undefined) return;
    const recipe = RECIPES[order.recipe];
    if (!this.loaded) this.loaded = this.resources.pay(batchCost(order.recipe));
    if (!this.loaded) return;
    order.progress += (hours * SMELTER.power) / recipe.batch;
    if (order.progress < 1) return;
    this.resources.add(recipe.output, recipe.yield);
    order.done++;
    order.progress = 0;
    this.loaded = false;
    if (order.done === order.batches) this.queue.shift();
  }

  private get status() {
    const order = this.queue[0];
    if (order === undefined) return "Idle";
    if (this.loaded) return `Smelting ${RECIPES[order.recipe].name}`;
    const lacking = this.resources.missing(batchCost(order.recipe));
    return `Waiting for ${lacking.map(([id, amount]) => `${formatAmount(id, amount)} ${RESOURCES[id].name}`).join(", ")}`;
  }

  private order(recipe: RecipeID, batches: number) {
    this.queue.push({ recipe: recipe, batches: batches, done: 0, progress: 0 });
  }

  private cancel(order: SmelterOrder) {
    const index = this.queue.indexOf(order);
    assert(index !== -1, "Cancelling an order not in the smelter's queue");
    if (index === 0 && this.loaded) {
      this.resources.addAll(batchCost(order.recipe));
      this.loaded = false;
    }
    this.queue.splice(index, 1);
  }
}

function batchCost(id: RecipeID): ResourceCost {
  const recipe = RECIPES[id];
  const cost: ResourceCost = { [recipe.input]: recipe.batch };
  if (recipe.coal > 0) cost[ResourcesID.coal] = recipe.coal;
  return cost;
}
