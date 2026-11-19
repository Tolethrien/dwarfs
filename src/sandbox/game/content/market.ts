import { ResourcesID } from "./resources";

// buyMarkup: buying a pack costs this many times what selling it gives
export const MARKET = { buyMarkup: 3 };

export interface MarketGood {
  id: ResourcesID;
  pack: number;
  price: number;
}

export const MARKET_GOODS: MarketGood[] = [
  { id: ResourcesID.stone, pack: 10, price: 1 },
  { id: ResourcesID.coal, pack: 5, price: 1 },
  { id: ResourcesID.ironOre, pack: 5, price: 1 },
  { id: ResourcesID.boneMeal, pack: 1, price: 5 },
  { id: ResourcesID.ironBars, pack: 1, price: 2 },
  { id: ResourcesID.concrete, pack: 5, price: 2 },
];

export function buyPrice(good: MarketGood) {
  return good.price * MARKET.buyMarkup;
}
