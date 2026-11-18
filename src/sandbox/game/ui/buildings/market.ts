import type UINode from "@navi/node";
import { formatAmount, RESOURCES, ResourcesID } from "../../content/resources";
import type { MarketGood } from "../../content/market";
import { UIWindow } from "../elements/window";
import { row } from "../elements/row";
import { button } from "../elements/button";
import { icon } from "../elements/icon";
import { stepper } from "../elements/stepper";
import { table } from "../elements/table";

export interface MarketActions {
  goods: readonly MarketGood[];
  have: (id: ResourcesID) => number;
  packsHeld: (good: MarketGood) => number;
  sell: (good: MarketGood, packs: number) => void;
}

const MARKET_UI = {
  width: 720,
  columns: { look: 32, name: 90, have: 100, price: 150, packs: 110, sell: 170 },
};

export default class MarketUI {
  private readonly window = new UIWindow({ kind: "modal", width: MARKET_UI.width, title: "Market" });
  private readonly picked = new Map<MarketGood, number>();

  constructor(private readonly actions: MarketActions) {}

  public open() {
    if (this.window.isOpen) return;
    this.buildGoods(this.window.open());
  }

  public close() {
    this.window.close();
  }

  public update() {
    this.window.update();
  }

  private buildGoods(parent: UINode) {
    const columns = MARKET_UI.columns;
    const list = table(parent, [
      { title: "", width: columns.look },
      { title: "Good", width: columns.name },
      { title: "In store", width: columns.have, align: "end" },
      { title: "Pack", width: columns.price, align: "end" },
      { title: "Packs", width: columns.packs, align: "center" },
      { title: "", width: columns.sell, align: "end" },
    ]);
    for (const good of this.actions.goods)
      list.row([
        { build: (cell) => icon(cell, RESOURCES[good.id].icon) },
        RESOURCES[good.id].name,
        () => formatAmount(good.id, this.actions.have(good.id)),
        `${formatAmount(good.id, good.pack)} → ${formatAmount(ResourcesID.beer, good.price)}`,
        { build: (cell) => stepper(cell, "", () => `${this.packsOf(good)}`, (step) => this.pick(good, step)) },
        { build: (cell) => this.addSell(cell, good) },
      ]);
  }

  private addSell(cell: UINode, good: MarketGood) {
    const buttons = row(cell, { fit: true });
    button(buttons, "Sell", () => this.actions.sell(good, this.packsOf(good)));
    button(buttons, "Sell all", () => this.actions.sell(good, this.actions.packsHeld(good)));
  }

  private packsOf(good: MarketGood) {
    return this.picked.get(good) ?? 1;
  }

  private pick(good: MarketGood, step: -1 | 1) {
    this.picked.set(good, Math.max(1, this.packsOf(good) + step));
  }
}
