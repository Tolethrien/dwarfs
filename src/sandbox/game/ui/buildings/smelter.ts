import Navi from "@navi/navi";
import type UINode from "@navi/node";
import { formatAmount, RESOURCES, ResourcesID, type ResourceCost } from "../../content/resources";
import { RECIPES, recipeCost, type RecipeID } from "../../content/smelter";
import { describeResourceDrop, formatResourceRange } from "../../drops/resources";
import type { SmelterOrder } from "../../components/buildings/smelter";
import { UI_THEME } from "../../content/ui";
import { closeOnCameraMove, UIWindow } from "../elements/window";
import { header } from "../elements/header";
import { button } from "../elements/button";
import { cost, costEntries } from "../elements/cost";
import { icon } from "../elements/icon";
import { stepper } from "../elements/stepper";
import { table, type UITable } from "../elements/table";
import { text } from "../elements/text";
import { bar } from "../elements/bar";

export interface SmelterActions {
  recipes: readonly RecipeID[];
  fuel: () => number;
  coalPerHour: () => number;
  orders: () => readonly SmelterOrder[];
  status: () => string;
  missing: (cost: ResourceCost) => [ResourcesID, number][];
  order: (recipe: RecipeID, batches: number) => void;
  cancel: (order: SmelterOrder) => void;
}

const SMELTER_UI = {
  width: 760,
  // batches the stepper adds or takes
  step: 1,
  recipes: { look: 32, amount: 170, cost: 300, smelt: 90 },
  queue: { look: 32, name: 90, amount: 150, progress: 220, remove: 90 },
};

export default class SmelterUI {
  private readonly window = new UIWindow({ kind: "docked", width: SMELTER_UI.width, title: "Smelter", closeOnMove: closeOnCameraMove() });
  private readonly picked = new Map<RecipeID, number>();
  // the cost is built again on each step, its lacking marks are read once
  private readonly costCells = new Map<RecipeID, UINode>();
  private readonly rows = new Map<SmelterOrder, UINode>();
  private queue: UITable | undefined;
  private empty: UINode | undefined;

  constructor(private readonly actions: SmelterActions) {}

  public open() {
    if (this.window.isOpen) return;
    const content = this.window.open();
    this.buildRecipes(content);
    this.buildQueue(content);
    this.buildFuel(content);
  }

  public close() {
    this.window.close();
  }

  public update() {
    if (this.window.isOpen) this.syncQueue();
    this.window.update();
    if (!this.window.isOpen) this.forgetNodes();
  }

  private buildRecipes(parent: UINode) {
    const columns = SMELTER_UI.recipes;
    header(parent, "Recipes");
    const list = table(parent, [
      { title: "", width: columns.look },
      { title: "Makes", width: columns.amount, align: "center" },
      { title: "Costs", width: columns.cost },
      { title: "", width: columns.smelt, align: "end" },
    ]);
    for (const id of this.actions.recipes) {
      const recipe = RECIPES[id];
      const main = recipe.output.main;
      list.row([
        {
          build: (cell) => {
            if (main) icon(cell, RESOURCES[main.id].icon, { tooltip: describeResourceDrop(recipe.output) });
          },
        },
        {
          build: (cell) =>
            stepper(
              cell,
              "",
              () => (main ? formatResourceRange(main.id, main.amount, this.batchesOf(id)) : `×${this.batchesOf(id)}`),
              (step) => this.pick(id, step),
            ),
        },
        {
          build: (cell) => {
            this.costCells.set(id, cell);
            this.showCost(id);
          },
        },
        { build: (cell) => button(cell, "Smelt", () => this.actions.order(id, this.batchesOf(id)), { sprite: "red" }) },
      ]);
    }
  }

  private showCost(id: RecipeID) {
    const cell = this.costCells.get(id);
    if (cell === undefined) return;
    Navi.clear(cell);
    const total = recipeCost(id, this.batchesOf(id));
    cost(cell, costEntries(total, this.actions.missing(total)));
  }

  private buildQueue(parent: UINode) {
    const columns = SMELTER_UI.queue;
    header(parent, "Queue");
    text(parent, this.actions.status);
    this.queue = table(parent, [
      { title: "", width: columns.look },
      { title: "Makes", width: columns.name },
      { title: "Made", width: columns.amount, align: "end" },
      { title: "Batch", width: columns.progress, align: "center" },
      { title: "", width: columns.remove, align: "end" },
    ]);
    this.empty = text(parent, "Nothing to smelt", { color: UI_THEME.colors.muted });
  }

  private buildFuel(parent: UINode) {
    header(parent, "Fuel");
    bar(parent, {
      value: this.actions.fuel,
      label: () => `${Math.round(this.actions.fuel() * 100)}%`,
    });
    text(parent, () => `${formatAmount(ResourcesID.coal, this.actions.coalPerHour())} ${RESOURCES[ResourcesID.coal].name} / h`, {
      color: UI_THEME.colors.muted,
    });
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
    const main = recipe.output.main;
    return queue.row([
      {
        build: (cell) => {
          if (main) icon(cell, RESOURCES[main.id].icon, { tooltip: describeResourceDrop(recipe.output) });
        },
      },
      recipe.name,
      () =>
        main
          ? `${formatResourceRange(main.id, main.amount, order.done)} / ${formatResourceRange(main.id, main.amount, order.batches)}`
          : `${order.done} / ${order.batches}`,
      { build: (cell) => bar(cell, { value: () => order.progress }) },
      { build: (cell) => button(cell, "Remove", () => this.actions.cancel(order)) },
    ]);
  }

  // closing drops the window's nodes, the next open builds them anew
  private forgetNodes() {
    this.rows.clear();
    this.costCells.clear();
    this.queue = undefined;
    this.empty = undefined;
  }

  private batchesOf(id: RecipeID) {
    return this.picked.get(id) ?? SMELTER_UI.step;
  }

  private pick(id: RecipeID, step: -1 | 1) {
    this.picked.set(id, Math.max(SMELTER_UI.step, this.batchesOf(id) + step * SMELTER_UI.step));
    this.showCost(id);
  }
}
