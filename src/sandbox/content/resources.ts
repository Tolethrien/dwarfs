// written into saves (resources section): never renumber, a new resource takes the next number
export enum GameResourcesID {
  none = 0,
  stone = 1,
  bones = 2,
  coal = 3,
  copper = 4,
  silver = 5,
  gold = 6,
  sapphire = 7,
  diamonds = 8,
  wood = 9,
  cloth = 10,
  beer = 11,
  hops = 12,
  water = 13,
  research = 14,
  premium = 15,
  palisade = 16,
  track = 17,
  station = 18,
}
export interface ResourceData {
  crop: Crop;
  name: keyof typeof GameResourcesID;
  // shown to the player
  label: string;
  // the market buys amount of it for beer; none = not for sale
  sell?: { amount: number; beer: number };
}

export const RESOURCES: Record<GameResourcesID, ResourceData> = {
  [GameResourcesID.none]: {
    crop: { x: 0, y: 0, width: 0, height: 0 },
    name: "none",
    label: "—",
  },
  [GameResourcesID.stone]: {
    crop: { x: 125, y: 0, width: 125, height: 125 },
    name: "stone",
    label: "kamień",
    sell: { amount: 4, beer: 1 },
  },
  [GameResourcesID.bones]: {
    crop: { x: 0, y: 0, width: 125, height: 125 },
    name: "bones",
    label: "kości",
    sell: { amount: 4, beer: 1 },
  },
  [GameResourcesID.coal]: {
    crop: { x: 875, y: 0, width: 125, height: 125 },
    name: "coal",
    label: "węgiel",
    sell: { amount: 3, beer: 1 },
  },
  [GameResourcesID.copper]: {
    crop: { x: 750, y: 0, width: 125, height: 125 },
    name: "copper",
    label: "miedź",
    sell: { amount: 2, beer: 1 },
  },
  [GameResourcesID.silver]: {
    crop: { x: 500, y: 0, width: 125, height: 125 },
    name: "silver",
    label: "srebro",
    sell: { amount: 1, beer: 1 },
  },
  [GameResourcesID.gold]: {
    crop: { x: 250, y: 0, width: 125, height: 125 },
    name: "gold",
    label: "złoto",
    sell: { amount: 1, beer: 3 },
  },
  [GameResourcesID.sapphire]: {
    crop: { x: 625, y: 0, width: 125, height: 125 },
    name: "sapphire",
    label: "szafir",
    sell: { amount: 1, beer: 2 },
  },
  [GameResourcesID.diamonds]: {
    crop: { x: 375, y: 0, width: 125, height: 125 },
    name: "diamonds",
    label: "diamenty",
    sell: { amount: 1, beer: 5 },
  },
  [GameResourcesID.wood]: {
    crop: { x: 625, y: 125, width: 125, height: 125 },
    name: "wood",
    label: "drewno",
  },
  [GameResourcesID.cloth]: {
    crop: { x: 750, y: 125, width: 125, height: 125 },
    name: "cloth",
    label: "włókna",
  },
  [GameResourcesID.beer]: {
    crop: { x: 0, y: 125, width: 125, height: 125 },
    name: "beer",
    label: "piwo",
  },
  [GameResourcesID.hops]: {
    crop: { x: 1000, y: 0, width: 125, height: 125 },
    name: "hops",
    label: "chmiel",
  },
  [GameResourcesID.water]: {
    crop: { x: 1000, y: 0, width: 125, height: 125 },
    name: "water",
    label: "woda",
  },
  [GameResourcesID.research]: {
    crop: { x: 875, y: 125, width: 125, height: 125 },
    name: "research",
    label: "badania",
  },
  [GameResourcesID.premium]: {
    crop: { x: 125, y: 125, width: 125, height: 125 },
    name: "premium",
    label: "premium",
  },
  [GameResourcesID.palisade]: {
    crop: { x: 1000, y: 125, width: 125, height: 125 },
    name: "palisade",
    label: "palisada",
  },
  [GameResourcesID.track]: {
    crop: { x: 1125, y: 125, width: 125, height: 125 },
    name: "track",
    label: "tor",
  },
  [GameResourcesID.station]: {
    crop: { x: 0, y: 250, width: 125, height: 125 },
    name: "station",
    label: "stacja",
  },
};

// "15 drewno + 40 kamień"
export function describeAmounts(list: [GameResourcesID, number][]) {
  return list.map(([res, amount]) => `${amount} ${RESOURCES[res].label}`).join(" + ");
}
