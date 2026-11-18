import Navi from "@navi/navi";
import type UINode from "@navi/node";
import { formatAmount, RESOURCES, ResourcesID } from "../../content/resources";
import { RECIPES, type RecipeID } from "../../content/smelter";
import type { SmelterOrder } from "../../components/smelter";
import { UI_THEME } from "../../content/ui";
import { UIWindow } from "../elements/window";
import { header } from "../elements/header";
import { button } from "../elements/button";
import { icon } from "../elements/icon";
import { stepper } from "../elements/stepper";
import { table, type UITable } from "../elements/table";
import { text } from "../elements/text";
import { bar } from "../elements/bar";

export interface SmelterActions {
  recipes: readonly RecipeID[];
  power: () => number;
  orders: () => readonly SmelterOrder[];
  status: () => string;
  order: (recipe: RecipeID, batches: number) => void;
  cancel: (order: SmelterOrder) => void;
}

const SMELTER_UI = {
  width: 760,
  // batches the stepper adds or takes
  step: 1,
  recipes: { look: 32, name: 90, recipe: 260, amount: 150, add: 70 },
  queue: { look: 32, name: 90, amount: 150, progress: 220, remove: 90 },
};

export default class SmelterUI {
  private readonly window = new UIWindow({ kind: "modal", width: SMELTER_UI.width, title: "Smelter" });
  private readonly picked = new Map<RecipeID, number>();
  private readonly rows = new Map<SmelterOrder, UINode>();
  private queue: UITable | undefined;
  private empty: UINode | undefined;

  constructor(private readonly actions: SmelterActions) {}

  public open() {
    if (this.window.isOpen) return;
    const content = this.window.open();
    this.buildRecipes(content);
    this.buildQueue(content);
    text(content, `Power: ${this.actions.power()} kg of input an hour`, { color: UI_THEME.colors.muted });
  }

  public close() {
    this.window.close();
  }

  public update() {
    if (this.window.isOpen) this.syncQueue();
    this.window.update();
    if (!this.window.isOpen) this.forgetQueue();
  }

  private buildRecipes(parent: UINode) {
    const columns = SMELTER_UI.recipes;
    header(parent, "Recipes");
    const list = table(parent, [
      { title: "", width: columns.look },
      { title: "Makes", width: columns.name },
      { title: "One batch", width: columns.recipe },
      { title: "Input", width: columns.amount, align: "center" },
      { title: "", width: columns.add, align: "end" },
    ]);
    for (const id of this.actions.recipes) {
      const recipe = RECIPES[id];
      list.row([
        { build: (cell) => icon(cell, RESOURCES[recipe.output].icon) },
        recipe.name,
        batchText(id),
        { build: (cell) => stepper(cell, "", () => formatAmount(recipe.input, this.batchesOf(id) * recipe.batch), (step) => this.pick(id, step)) },
        { build: (cell) => button(cell, "Add", () => this.actions.order(id, this.batchesOf(id))) },
      ]);
    }
  }

  private buildQueue(parent: UINode) {
    const columns = SMELTER_UI.queue;
    header(parent, "Queue");
    text(parent, this.actions.status);
    this.queue = table(parent, [
      { title: "", width: columns.look },
      { title: "Makes", width: columns.name },
      { title: "Input", width: columns.amount, align: "end" },
      { title: "Batch", width: columns.progress, align: "center" },
      { title: "", width: columns.remove, align: "end" },
    ]);
    this.empty = text(parent, "Nothing to smelt", { color: UI_THEME.colors.muted });
  }

  private syncQueue() {
    const queue = this.queue;
    if (queue === undefined) return;
    const orders = this.actions.orders();
    for (const [order, row] of this.rows) {
      if (orders.includes(order)) continue;
      Navi.remove(row, queue.body);
      this.rows.delete(order);
    }
    for (const order of orders) if (!this.rows.has(order)) this.rows.set(order, this.orderRow(queue, order));
    this.empty?.setActive(orders.length === 0);
  }

  private orderRow(queue: UITable, order: SmelterOrder) {
    const recipe = RECIPES[order.recipe];
    return queue.row([
      { build: (cell) => icon(cell, RESOURCES[recipe.output].icon) },
      recipe.name,
      () => `${formatAmount(recipe.input, order.done * recipe.batch)} / ${formatAmount(recipe.input, order.batches * recipe.batch)}`,
      { build: (cell) => bar(cell, { value: () => order.progress }) },
      { build: (cell) => button(cell, "Remove", () => this.actions.cancel(order)) },
    ]);
  }

  // closing drops the window's nodes, the next open builds them anew
  private forgetQueue() {
    this.rows.clear();
    this.queue = undefined;
    this.empty = undefined;
  }

  private batchesOf(id: RecipeID) {
    return this.picked.get(id) ?? SMELTER_UI.step;
  }

  private pick(id: RecipeID, step: -1 | 1) {
    this.picked.set(id, Math.max(SMELTER_UI.step, this.batchesOf(id) + step * SMELTER_UI.step));
  }
}

function batchText(id: RecipeID) {
  const recipe = RECIPES[id];
  const coal = recipe.coal > 0 ? ` + ${formatAmount(ResourcesID.coal, recipe.coal)} ${RESOURCES[ResourcesID.coal].name}` : "";
  return `${formatAmount(recipe.input, recipe.batch)} ${RESOURCES[recipe.input].name}${coal} → ${formatAmount(recipe.output, recipe.yield)}`;
}
