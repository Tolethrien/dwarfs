import PragmaComponent from "@pragma/component";
import { formatAmount, ResourcesID } from "../content/resources";
import { buyPrice, MARKET_GOODS, type MarketGood } from "../content/market";
import Buildings from "../systems/buildings";
import MarketUI from "../ui/buildings/market";
import { toast } from "../ui/elements/toast";

export default class Market extends PragmaComponent {
  declare private buildings: Buildings;
  declare private window: MarketUI;

  awake(): void {
    this.buildings = this.scene.getSystem(Buildings);
    this.window = new MarketUI({
      goods: MARKET_GOODS,
      have: (id) => this.buildings.store.get(id),
      packsHeld: (good) => this.packsHeld(good),
      packsAffordable: (good) => this.packsAffordable(good),
      missing: (cost) => this.buildings.store.missing(cost),
      sell: (good, packs) => this.sell(good, packs),
      buy: (good, packs) => this.buy(good, packs),
    });
  }

  update(): void {
    this.window.update();
  }

  destroy(): void {
    this.window.close();
  }

  public open() {
    this.window.open();
  }

  private packsHeld(good: MarketGood) {
    return Math.floor(this.buildings.store.get(good.id) / good.pack);
  }

  private sell(good: MarketGood, packs: number) {
    const sold = Math.min(packs, this.packsHeld(good));
    if (sold === 0) {
      toast(`Not enough to sell: a pack is ${formatAmount(good.id, good.pack)}`, "error");
      return;
    }
    const amount = sold * good.pack;
    const beer = sold * good.price;
    this.buildings.store.pay({ [good.id]: amount });
    this.buildings.store.add(ResourcesID.beer, beer);
    toast(`Sold ${formatAmount(good.id, amount)} for ${formatAmount(ResourcesID.beer, beer)}`, "success");
  }

  private packsAffordable(good: MarketGood) {
    return Math.floor(this.buildings.store.get(ResourcesID.beer) / buyPrice(good));
  }

  private buy(good: MarketGood, packs: number) {
    const bought = Math.min(packs, this.packsAffordable(good));
    if (bought === 0) {
      toast(`Not enough beer: a pack is ${formatAmount(ResourcesID.beer, buyPrice(good))}`, "error");
      return;
    }
    const amount = bought * good.pack;
    const beer = bought * buyPrice(good);
    this.buildings.store.pay({ [ResourcesID.beer]: beer });
    this.buildings.store.add(good.id, amount);
    toast(`Bought ${formatAmount(good.id, amount)} for ${formatAmount(ResourcesID.beer, beer)}`, "success");
  }
}
