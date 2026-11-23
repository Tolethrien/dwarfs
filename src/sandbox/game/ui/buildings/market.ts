import Navi from "@navi/navi";
import type UINode from "@navi/node";
import { formatAmount, RESOURCES, ResourcesID, type ResourceCost } from "../../content/resources";
import { buyPrice, type MarketGood } from "../../content/market";
import { closeOnCameraMove, UIWindow } from "../elements/window";
import { row } from "../elements/row";
import { column } from "../elements/column";
import { button } from "../elements/button";
import { cost, costEntries } from "../elements/cost";
import { icon } from "../elements/icon";
import { stepper } from "../elements/stepper";
import { table } from "../elements/table";
import { tabs, type TabItem } from "../elements/tabs";

export interface MarketActions {
  goods: readonly MarketGood[];
  have: (id: ResourcesID) => number;
  packsHeld: (good: MarketGood) => number;
  packsAffordable: (good: MarketGood) => number;
  missing: (cost: ResourceCost) => [ResourcesID, number][];
  sell: (good: MarketGood, packs: number) => void;
  buy: (good: MarketGood, packs: number) => void;
}

type Tab = "sell" | "buy";

const TABS: TabItem<Tab>[] = [
  { id: "sell", title: "Sell" },
  { id: "buy", title: "Buy" },
];

const MARKET_UI = {
  width: 720,
  columns: { look: 32, have: 110, amount: 170, price: 110, deal: 170 },
};

// one stepper a tab: what's picked to sell isn't what's picked to buy
export default class MarketUI {
  private readonly window = new UIWindow({ kind: "docked", width: MARKET_UI.width, title: "Market", closeOnMove: closeOnCameraMove() });
  private tab: Tab = "sell";
  private readonly picked: Record<Tab, Map<MarketGood, number>> = { sell: new Map(), buy: new Map() };
  // the price is built again on each step, the cost element is static
  private readonly priceCells = new Map<MarketGood, UINode>();
  declare private tabBar: UINode;
  declare private body: UINode;

  constructor(private readonly actions: MarketActions) {}

  public open() {
    if (this.window.isOpen) return;
    const content = this.window.open();
    this.tabBar = column(content);
    this.body = column(content);
    this.showTab();
  }

  public close() {
    this.window.close();
  }

  public update() {
    this.window.update();
  }

  private pickTab(tab: Tab) {
    this.tab = tab;
    this.showTab();
  }

  private showTab() {
    Navi.clear(this.tabBar);
    tabs(this.tabBar, TABS, this.tab, (tab) => this.pickTab(tab));
    Navi.clear(this.body);
    this.priceCells.clear();
    this.buildGoods(this.body);
  }

  private buildGoods(parent: UINode) {
    const columns = MARKET_UI.columns;
    const selling = this.tab === "sell";
    const list = table(parent, [
      { title: "", width: columns.look },
      { title: "In store", width: columns.have, align: "end" },
      { title: selling ? "Sell" : "Buy", width: columns.amount, align: "center" },
      { title: selling ? "Get" : "Pay", width: columns.price },
      { title: "", width: columns.deal, align: "end" },
    ]);
    for (const good of this.actions.goods)
      list.row([
        { build: (cell) => icon(cell, RESOURCES[good.id].icon, { tooltip: RESOURCES[good.id].name }) },
        () => formatAmount(good.id, this.actions.have(good.id)),
        { build: (cell) => stepper(cell, "", () => formatAmount(good.id, this.packsOf(good) * good.pack), (step) => this.pick(good, step)) },
        {
          build: (cell) => {
            this.priceCells.set(good, cell);
            this.showPrice(good);
          },
        },
        { build: (cell) => this.addDeal(cell, good) },
      ]);
  }

  private showPrice(good: MarketGood) {
    const cell = this.priceCells.get(good);
    if (cell === undefined) return;
    Navi.clear(cell);
    if (this.tab === "sell") {
      cost(cell, costEntries({ [ResourcesID.beer]: this.packsOf(good) * good.price }, []));
      return;
    }
    const price = { [ResourcesID.beer]: this.packsOf(good) * buyPrice(good) };
    cost(cell, costEntries(price, this.actions.missing(price)));
  }

  private addDeal(cell: UINode, good: MarketGood) {
    const buttons = row(cell, { fit: true });
    if (this.tab === "sell") {
      button(buttons, "Sell", () => this.deal(() => this.actions.sell(good, this.packsOf(good))), { sprite: "red" });
      button(buttons, "Sell all", () => this.deal(() => this.actions.sell(good, this.actions.packsHeld(good))));
      return;
    }
    button(buttons, "Buy", () => this.deal(() => this.actions.buy(good, this.packsOf(good))), { sprite: "red" });
  }

  // the store and the beer changed: every stepper follows them down, every price is marked anew
  private deal(run: () => void) {
    run();
    for (const good of this.actions.goods) this.pick(good, 0);
  }

  private packsOf(good: MarketGood) {
    return this.picked[this.tab].get(good) ?? 1;
  }

  // from one pack up to what the store holds (selling) or the beer pays for (buying)
  private pick(good: MarketGood, step: -1 | 0 | 1) {
    const most = Math.max(1, this.tab === "sell" ? this.actions.packsHeld(good) : this.actions.packsAffordable(good));
    this.picked[this.tab].set(good, Math.min(Math.max(1, this.packsOf(good) + step), most));
    this.showPrice(good);
  }
}
