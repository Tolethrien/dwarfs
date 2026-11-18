import { ResourcesID } from "./resources";

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
];
